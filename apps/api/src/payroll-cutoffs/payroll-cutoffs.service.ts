import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollCutoffStatus, type Prisma } from '@payroll/database';

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

        details: `Locked payroll cutoff ${this.getCutoffReference(currentCutoff)}.`,

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
      const updated = await transaction.payrollCutoff.update({
        where: {
          id: payrollCutoffId,
        },

        data: {
          status: PayrollCutoffStatus.REOPENED,
          reopenedAt,
          lastReopenReason: normalizedReason,
        },

        select: PAYROLL_CUTOFF_SELECT,
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,
        companyId: currentCutoff.companyId,

        action: PayrollCutoffAuditAction.REOPENED,

        module: PAYROLL_CUTOFF_AUDIT_MODULE,
        entityType: PAYROLL_CUTOFF_ENTITY_TYPE,
        entityId: currentCutoff.id,

        reference: this.getCutoffReference(currentCutoff),

        details:
          `Reopened payroll cutoff ${this.getCutoffReference(currentCutoff)}. ` +
          `Reason: ${normalizedReason}`,

        metadata: {
          previousStatus,
          newStatus: PayrollCutoffStatus.REOPENED,
          reopenedAt: reopenedAt.toISOString(),
          reason: normalizedReason,
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
    return `${this.toDateString(cutoff.startDate)} to ${this.toDateString(
      cutoff.endDate,
    )}`;
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
