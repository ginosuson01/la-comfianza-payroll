import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayrollCutoffStatus,
  PayrollRunStatus,
  type Prisma,
} from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import type { ListPayrollCutoffsQueryDto } from './dto/list-payroll-cutoffs-query.dto';
import {
  PAYROLL_CUTOFF_AUDIT_MODULE,
  PAYROLL_CUTOFF_ENTITY_TYPE,
  PayrollCutoffAuditAction,
} from './payroll-cutoff-audit.constants';

const PAYROLL_CUTOFF_SELECT = {
  id: true,
  companyId: true,
  cutoffTemplateId: true,

  startDate: true,
  endDate: true,
  payDate: true,

  status: true,

  lockedAt: true,
  reopenedAt: true,
  lastReopenReason: true,

  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PayrollCutoffSelect;

export type PayrollCutoffView = Prisma.PayrollCutoffGetPayload<{
  select: typeof PAYROLL_CUTOFF_SELECT;
}>;

@Injectable()
export class PayrollCutoffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listPayrollCutoffs(
    query: ListPayrollCutoffsQueryDto,
  ): Promise<PayrollCutoffView[]> {
    const where: Prisma.PayrollCutoffWhereInput = {
      companyId: query.companyId,
    };

    if (query.status) {
      where.status = query.status;
    }

    return this.prisma.payrollCutoff.findMany({
      where,

      select: PAYROLL_CUTOFF_SELECT,

      orderBy: [
        {
          startDate: 'desc',
        },
        {
          endDate: 'desc',
        },
      ],
    });
  }

  async listEditablePayrollCutoffs(
    companyId: string,
  ): Promise<PayrollCutoffView[]> {
    return this.prisma.payrollCutoff.findMany({
      where: {
        companyId,

        status: {
          in: [PayrollCutoffStatus.OPEN, PayrollCutoffStatus.REOPENED],
        },
      },

      select: PAYROLL_CUTOFF_SELECT,

      orderBy: [
        {
          startDate: 'desc',
        },
        {
          endDate: 'desc',
        },
      ],
    });
  }

  async lockPayrollCutoff(
    payrollCutoffId: string,
    actorUserId: string,
  ): Promise<PayrollCutoffView> {
    const currentCutoff = await this.getPayrollCutoffOrThrow(payrollCutoffId);

    if (
      currentCutoff.status !== PayrollCutoffStatus.OPEN &&
      currentCutoff.status !== PayrollCutoffStatus.REOPENED
    ) {
      throw new ConflictException(
        `Payroll cutoff cannot be locked from status ${currentCutoff.status}.`,
      );
    }

    const previousStatus = currentCutoff.status;
    const lockedAt = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.payrollCutoff.update({
        where: {
          id: payrollCutoffId,
        },

        data: {
          status: PayrollCutoffStatus.LOCKED,
          lockedAt,
        },

        select: PAYROLL_CUTOFF_SELECT,
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,
        companyId: currentCutoff.companyId,

        action: PayrollCutoffAuditAction.LOCKED,

        module: PAYROLL_CUTOFF_AUDIT_MODULE,
        entityType: PAYROLL_CUTOFF_ENTITY_TYPE,
        entityId: currentCutoff.id,

        reference: this.getCutoffReference(currentCutoff),

        details:
          `Locked payroll cutoff ` +
          `${this.getCutoffReference(currentCutoff)}.`,

        metadata: {
          previousStatus,
          newStatus: PayrollCutoffStatus.LOCKED,
          lockedAt: lockedAt.toISOString(),
        },
      });

      return updated;
    });
  }

  async reopenPayrollCutoff(
    payrollCutoffId: string,
    reason: string,
    actorUserId: string,
  ): Promise<PayrollCutoffView> {
    const normalizedReason = reason.trim();

    if (!normalizedReason) {
      throw new BadRequestException(
        'A reason is required when reopening a payroll cutoff.',
      );
    }

    const currentCutoff = await this.getPayrollCutoffOrThrow(payrollCutoffId);

    if (currentCutoff.status !== PayrollCutoffStatus.LOCKED) {
      throw new ConflictException(
        `Payroll cutoff cannot be reopened from status ${currentCutoff.status}.`,
      );
    }

    const previousStatus = currentCutoff.status;
    const reopenedAt = new Date();

    return this.prisma.$transaction(async (transaction) => {
      /*
       * Compare-and-set the cutoff from LOCKED -> REOPENED.
       *
       * This prevents two concurrent reopen requests from
       * independently succeeding against the same locked cutoff.
       */
      const cutoffUpdate = await transaction.payrollCutoff.updateMany({
        where: {
          id: payrollCutoffId,
          status: PayrollCutoffStatus.LOCKED,
        },

        data: {
          status: PayrollCutoffStatus.REOPENED,
          reopenedAt,
          lastReopenReason: normalizedReason,
        },
      });

      if (cutoffUpdate.count !== 1) {
        throw new ConflictException(
          'Payroll cutoff is no longer LOCKED and cannot be reopened.',
        );
      }

      /*
       * A cutoff can exist without a generated PayrollRun because
       * cutoff locking infrastructure existed before payroll
       * generation.
       *
       * Therefore, absence of a PayrollRun is valid here.
       *
       * When a generated CURRENT_LOCKED run does exist, reopening
       * the cutoff makes that frozen version no longer current for
       * operational use. Preserve it in history and mark it as
       * pending regeneration.
       */
      const currentPayrollRun = await transaction.payrollRun.findFirst({
        where: {
          payrollCutoffId,
          status: PayrollRunStatus.CURRENT_LOCKED,
        },

        orderBy: {
          version: 'desc',
        },

        select: {
          id: true,
          version: true,
          status: true,
        },
      });

      if (currentPayrollRun) {
        const payrollRunUpdate = await transaction.payrollRun.updateMany({
          where: {
            id: currentPayrollRun.id,
            status: PayrollRunStatus.CURRENT_LOCKED,
          },

          data: {
            status: PayrollRunStatus.REOPENED_PENDING_REGENERATION,
          },
        });

        if (payrollRunUpdate.count !== 1) {
          throw new ConflictException(
            'Current payroll run changed while the cutoff was being reopened.',
          );
        }
      }

      const updated = await transaction.payrollCutoff.findUnique({
        where: {
          id: payrollCutoffId,
        },

        select: PAYROLL_CUTOFF_SELECT,
      });

      if (!updated) {
        throw new NotFoundException(
          'Payroll cutoff was not found after reopening.',
        );
      }

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,
        companyId: currentCutoff.companyId,

        action: PayrollCutoffAuditAction.REOPENED,

        module: PAYROLL_CUTOFF_AUDIT_MODULE,
        entityType: PAYROLL_CUTOFF_ENTITY_TYPE,
        entityId: currentCutoff.id,

        reference: this.getCutoffReference(currentCutoff),

        details: currentPayrollRun
          ? `Reopened payroll cutoff ${this.getCutoffReference(
              currentCutoff,
            )}. Payroll run version ${
              currentPayrollRun.version
            } is pending regeneration. Reason: ${normalizedReason}`
          : `Reopened payroll cutoff ${this.getCutoffReference(
              currentCutoff,
            )}. Reason: ${normalizedReason}`,

        metadata: {
          previousStatus,
          newStatus: PayrollCutoffStatus.REOPENED,
          reopenedAt: reopenedAt.toISOString(),
          reason: normalizedReason,

          payrollRunTransition: currentPayrollRun
            ? {
                payrollRunId: currentPayrollRun.id,

                version: currentPayrollRun.version,

                previousStatus: PayrollRunStatus.CURRENT_LOCKED,

                newStatus: PayrollRunStatus.REOPENED_PENDING_REGENERATION,
              }
            : null,
        },
      });

      return updated;
    });
  }

  private async getPayrollCutoffOrThrow(
    payrollCutoffId: string,
  ): Promise<PayrollCutoffView> {
    const cutoff = await this.prisma.payrollCutoff.findUnique({
      where: {
        id: payrollCutoffId,
      },

      select: PAYROLL_CUTOFF_SELECT,
    });

    if (!cutoff) {
      throw new NotFoundException('Payroll cutoff was not found.');
    }

    return cutoff;
  }

  private getCutoffReference(
    cutoff: Pick<PayrollCutoffView, 'startDate' | 'endDate'>,
  ): string {
    return `${this.toDateString(
      cutoff.startDate,
    )} to ${this.toDateString(cutoff.endDate)}`;
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
