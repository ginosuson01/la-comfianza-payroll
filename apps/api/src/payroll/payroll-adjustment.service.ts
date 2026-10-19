import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayrollAdjustmentType,
  PayrollCutoffStatus,
  PayrollStatutoryBasisTreatment,
  Prisma,
} from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import type { CreatePayrollAdjustmentDto } from './dto/create-payroll-adjustment.dto';
import type { UpdatePayrollAdjustmentDto } from './dto/update-payroll-adjustment.dto';

interface LockedPayrollCutoffRow {
  id: string;
  companyId: string;

  startDate: Date;
  endDate: Date;

  status: PayrollCutoffStatus;
}

export interface PayrollAdjustmentView {
  id: string;

  companyId: string;
  payrollCutoffId: string;
  employeeId: string;

  type: PayrollAdjustmentType;

  code: string;
  description: string;

  amount: string;

  reason: string;

  taxable: boolean | null;

  pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment | null;

  createdByUserId: string;
  createdAt: Date;
}

export interface DeletedPayrollAdjustmentResult {
  id: string;
  deleted: true;
}

@Injectable()
export class PayrollAdjustmentService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly auditLog: AuditLogService,
  ) {}

  async listAdjustments(
    companyId: string,
    payrollCutoffId: string,
    employeeId?: string,
  ): Promise<PayrollAdjustmentView[]> {
    const cutoff = await this.prisma.payrollCutoff.findFirst({
      where: {
        id: payrollCutoffId,
        companyId,
      },

      select: {
        id: true,
      },
    });

    if (!cutoff) {
      throw new NotFoundException(
        'Payroll cutoff not found for the requested company.',
      );
    }

    const adjustments = await this.prisma.payrollAdjustment.findMany({
      where: {
        companyId,
        payrollCutoffId,

        ...(employeeId
          ? {
              employeeId,
            }
          : {}),
      },

      orderBy: [
        {
          createdAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],

      select: {
        id: true,

        companyId: true,
        payrollCutoffId: true,
        employeeId: true,

        type: true,

        code: true,
        description: true,

        amount: true,

        reason: true,

        taxable: true,

        pagIbigFundSalaryTreatment: true,

        createdByUserId: true,
        createdAt: true,
      },
    });

    return adjustments.map((adjustment) => this.toView(adjustment));
  }

  async createAdjustment(
    companyId: string,
    payrollCutoffId: string,
    employeeId: string,
    input: CreatePayrollAdjustmentDto,
    actorUserId: string,
  ): Promise<PayrollAdjustmentView> {
    this.validateCreateSemantics(input);

    const amount = new Prisma.Decimal(input.amount);

    const adjustment = await this.prisma.$transaction(async (transaction) => {
      const cutoff = await this.lockMutableCutoff(
        transaction,
        companyId,
        payrollCutoffId,
      );

      await this.requireEmployeeAssignmentForCutoff(
        transaction,
        companyId,
        employeeId,
        cutoff,
      );

      const created = await transaction.payrollAdjustment.create({
        data: {
          companyId,
          payrollCutoffId,
          employeeId,

          type: input.type,

          code: input.code,
          description: input.description,

          amount,

          reason: input.reason,

          taxable: input.taxable ?? null,

          pagIbigFundSalaryTreatment:
            input.type === PayrollAdjustmentType.EARNING
              ? input.pagIbigFundSalaryTreatment!
              : null,

          createdByUserId: actorUserId,
        },

        select: {
          id: true,

          companyId: true,
          payrollCutoffId: true,
          employeeId: true,

          type: true,

          code: true,
          description: true,

          amount: true,

          reason: true,

          taxable: true,

          pagIbigFundSalaryTreatment: true,

          createdByUserId: true,
          createdAt: true,
        },
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,

        companyId,

        action: 'PAYROLL_ADJUSTMENT_CREATED',

        module: 'PAYROLL',

        entityType: 'PAYROLL_ADJUSTMENT',

        entityId: created.id,

        reference: created.code,

        details:
          `Created payroll adjustment ${created.code} for employee ` +
          `${employeeId} on cutoff ${payrollCutoffId}.`,

        metadata: {
          payrollCutoffId,
          employeeId,

          type: created.type,

          code: created.code,

          amount: created.amount.toString(),

          taxable: created.taxable,

          pagIbigFundSalaryTreatment: created.pagIbigFundSalaryTreatment,
        },
      });

      return created;
    });

    return this.toView(adjustment);
  }

  async updateAdjustment(
    companyId: string,
    payrollCutoffId: string,
    employeeId: string,
    adjustmentId: string,
    input: UpdatePayrollAdjustmentDto,
    actorUserId: string,
  ): Promise<PayrollAdjustmentView> {
    if (!this.hasUpdate(input)) {
      throw new BadRequestException(
        'At least one payroll adjustment field must be provided.',
      );
    }

    const adjustment = await this.prisma.$transaction(async (transaction) => {
      const cutoff = await this.lockMutableCutoff(
        transaction,
        companyId,
        payrollCutoffId,
      );

      await this.requireEmployeeAssignmentForCutoff(
        transaction,
        companyId,
        employeeId,
        cutoff,
      );

      const existing = await transaction.payrollAdjustment.findFirst({
        where: {
          id: adjustmentId,

          companyId,
          payrollCutoffId,
          employeeId,
        },

        select: {
          id: true,

          type: true,

          code: true,
          description: true,

          amount: true,

          reason: true,

          taxable: true,

          pagIbigFundSalaryTreatment: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          'Payroll adjustment not found for the requested employee and cutoff.',
        );
      }

      const nextType = input.type ?? existing.type;

      let nextPagIbigTreatment =
        input.pagIbigFundSalaryTreatment ?? existing.pagIbigFundSalaryTreatment;

      if (nextType === PayrollAdjustmentType.DEDUCTION) {
        if (input.pagIbigFundSalaryTreatment !== undefined) {
          throw new BadRequestException(
            'Pag-IBIG Fund Salary treatment applies only to earning adjustments.',
          );
        }

        nextPagIbigTreatment = null;
      } else if (!nextPagIbigTreatment) {
        throw new BadRequestException(
          'Pag-IBIG Fund Salary treatment is required for earning adjustments.',
        );
      }

      const updated = await transaction.payrollAdjustment.update({
        where: {
          id: adjustmentId,
        },

        data: {
          ...(input.type !== undefined
            ? {
                type: input.type,
              }
            : {}),

          ...(input.code !== undefined
            ? {
                code: input.code,
              }
            : {}),

          ...(input.description !== undefined
            ? {
                description: input.description,
              }
            : {}),

          ...(input.amount !== undefined
            ? {
                amount: new Prisma.Decimal(input.amount),
              }
            : {}),

          ...(input.reason !== undefined
            ? {
                reason: input.reason,
              }
            : {}),

          ...(input.taxable !== undefined
            ? {
                taxable: input.taxable,
              }
            : {}),

          pagIbigFundSalaryTreatment: nextPagIbigTreatment,
        },

        select: {
          id: true,

          companyId: true,
          payrollCutoffId: true,
          employeeId: true,

          type: true,

          code: true,
          description: true,

          amount: true,

          reason: true,

          taxable: true,

          pagIbigFundSalaryTreatment: true,

          createdByUserId: true,
          createdAt: true,
        },
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,

        companyId,

        action: 'PAYROLL_ADJUSTMENT_UPDATED',

        module: 'PAYROLL',

        entityType: 'PAYROLL_ADJUSTMENT',

        entityId: updated.id,

        reference: updated.code,

        details:
          `Updated payroll adjustment ${updated.code} for employee ` +
          `${employeeId} on cutoff ${payrollCutoffId}.`,

        metadata: {
          payrollCutoffId,
          employeeId,

          previous: {
            type: existing.type,

            code: existing.code,

            description: existing.description,

            amount: existing.amount.toString(),

            reason: existing.reason,

            taxable: existing.taxable,

            pagIbigFundSalaryTreatment: existing.pagIbigFundSalaryTreatment,
          },

          current: {
            type: updated.type,

            code: updated.code,

            description: updated.description,

            amount: updated.amount.toString(),

            reason: updated.reason,

            taxable: updated.taxable,

            pagIbigFundSalaryTreatment: updated.pagIbigFundSalaryTreatment,
          },
        },
      });

      return updated;
    });

    return this.toView(adjustment);
  }

  async deleteAdjustment(
    companyId: string,
    payrollCutoffId: string,
    employeeId: string,
    adjustmentId: string,
    actorUserId: string,
  ): Promise<DeletedPayrollAdjustmentResult> {
    return this.prisma.$transaction(async (transaction) => {
      const cutoff = await this.lockMutableCutoff(
        transaction,
        companyId,
        payrollCutoffId,
      );

      await this.requireEmployeeAssignmentForCutoff(
        transaction,
        companyId,
        employeeId,
        cutoff,
      );

      const existing = await transaction.payrollAdjustment.findFirst({
        where: {
          id: adjustmentId,

          companyId,
          payrollCutoffId,
          employeeId,
        },

        select: {
          id: true,

          type: true,

          code: true,
          description: true,

          amount: true,

          reason: true,

          taxable: true,

          pagIbigFundSalaryTreatment: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          'Payroll adjustment not found for the requested employee and cutoff.',
        );
      }

      await transaction.payrollAdjustment.delete({
        where: {
          id: adjustmentId,
        },
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,

        companyId,

        action: 'PAYROLL_ADJUSTMENT_DELETED',

        module: 'PAYROLL',

        entityType: 'PAYROLL_ADJUSTMENT',

        entityId: existing.id,

        reference: existing.code,

        details:
          `Deleted payroll adjustment ${existing.code} for employee ` +
          `${employeeId} on cutoff ${payrollCutoffId}.`,

        metadata: {
          payrollCutoffId,
          employeeId,

          type: existing.type,

          code: existing.code,

          description: existing.description,

          amount: existing.amount.toString(),

          reason: existing.reason,

          taxable: existing.taxable,

          pagIbigFundSalaryTreatment: existing.pagIbigFundSalaryTreatment,
        },
      });

      return {
        id: existing.id,
        deleted: true as const,
      };
    });
  }

  private validateCreateSemantics(input: CreatePayrollAdjustmentDto): void {
    if (input.type === PayrollAdjustmentType.EARNING) {
      if (!input.pagIbigFundSalaryTreatment) {
        throw new BadRequestException(
          'Pag-IBIG Fund Salary treatment is required for earning adjustments.',
        );
      }

      return;
    }

    if (input.pagIbigFundSalaryTreatment !== undefined) {
      throw new BadRequestException(
        'Pag-IBIG Fund Salary treatment applies only to earning adjustments.',
      );
    }
  }

  private hasUpdate(input: UpdatePayrollAdjustmentDto): boolean {
    return (
      input.type !== undefined ||
      input.code !== undefined ||
      input.description !== undefined ||
      input.amount !== undefined ||
      input.reason !== undefined ||
      input.taxable !== undefined ||
      input.pagIbigFundSalaryTreatment !== undefined
    );
  }

  private async lockMutableCutoff(
    transaction: Prisma.TransactionClient,
    companyId: string,
    payrollCutoffId: string,
  ): Promise<LockedPayrollCutoffRow> {
    const rows = await transaction.$queryRaw<LockedPayrollCutoffRow[]>`
      SELECT
        "id",
        "companyId",
        "startDate",
        "endDate",
        "status"
      FROM "payroll_cutoffs"
      WHERE "id" = CAST(${payrollCutoffId} AS uuid)
        AND "companyId" = CAST(${companyId} AS uuid)
      FOR UPDATE
    `;

    const cutoff = rows[0];

    if (!cutoff) {
      throw new NotFoundException(
        'Payroll cutoff not found for the requested company.',
      );
    }

    if (
      cutoff.status !== PayrollCutoffStatus.OPEN &&
      cutoff.status !== PayrollCutoffStatus.REOPENED
    ) {
      throw new ConflictException(
        'Payroll adjustments can be changed only while the payroll cutoff is OPEN or REOPENED.',
      );
    }

    return cutoff;
  }

  private async requireEmployeeAssignmentForCutoff(
    transaction: Prisma.TransactionClient,
    companyId: string,
    employeeId: string,
    cutoff: LockedPayrollCutoffRow,
  ): Promise<void> {
    const employment = await transaction.employmentRecord.findFirst({
      where: {
        companyId,
        employeeId,

        startDate: {
          lte: cutoff.endDate,
        },

        OR: [
          {
            endDate: null,
          },
          {
            endDate: {
              gte: cutoff.startDate,
            },
          },
        ],
      },

      select: {
        id: true,
      },
    });

    if (!employment) {
      throw new NotFoundException(
        'Employee employment assignment not found for this company and payroll cutoff.',
      );
    }
  }

  private toView(adjustment: {
    id: string;

    companyId: string;
    payrollCutoffId: string;
    employeeId: string;

    type: PayrollAdjustmentType;

    code: string;
    description: string;

    amount: Prisma.Decimal;

    reason: string;

    taxable: boolean | null;

    pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment | null;

    createdByUserId: string;
    createdAt: Date;
  }): PayrollAdjustmentView {
    return {
      id: adjustment.id,

      companyId: adjustment.companyId,
      payrollCutoffId: adjustment.payrollCutoffId,
      employeeId: adjustment.employeeId,

      type: adjustment.type,

      code: adjustment.code,
      description: adjustment.description,

      amount: adjustment.amount.toString(),

      reason: adjustment.reason,

      taxable: adjustment.taxable,

      pagIbigFundSalaryTreatment: adjustment.pagIbigFundSalaryTreatment,

      createdByUserId: adjustment.createdByUserId,
      createdAt: adjustment.createdAt,
    };
  }
}
