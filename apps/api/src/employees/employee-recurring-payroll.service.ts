import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  RecurringPayrollItemKind,
  type PayrollStatutoryBasisTreatment,
} from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import type { CreateRecurringPayrollItemDto } from './dto/create-recurring-payroll-item.dto';
import type { UpdateRecurringPayrollItemPagIbigTreatmentDto } from './dto/update-recurring-payroll-item-pagibig-treatment.dto';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';

export interface RecurringPayrollItemView {
  id: string;
  employmentRecordId: string;

  kind: RecurringPayrollItemKind;

  code: string;
  description: string;

  amount: string;

  taxable: boolean;

  pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment | null;

  active: boolean;

  effectiveFrom: Date;
  effectiveTo: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

interface LockedMutablePayrollCutoffRow {
  id: string;
}

@Injectable()
export class EmployeeRecurringPayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listActiveRecurringPayrollItems(
    employeeId: string,
  ): Promise<RecurringPayrollItemView[]> {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        employmentRecords: {
          where: {
            endDate: null,
          },

          orderBy: {
            startDate: 'desc',
          },

          take: 1,

          select: {
            id: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const currentEmployment = employee.employmentRecords[0];

    if (!currentEmployment) {
      throw new NotFoundException('Current employment assignment not found.');
    }

    const items = await this.prisma.recurringPayrollItem.findMany({
      where: {
        employmentRecordId: currentEmployment.id,
        active: true,
        effectiveTo: null,
      },

      orderBy: [
        {
          kind: 'asc',
        },
        {
          code: 'asc',
        },
        {
          effectiveFrom: 'desc',
        },
      ],

      select: {
        id: true,
        employmentRecordId: true,

        kind: true,

        code: true,
        description: true,

        amount: true,

        taxable: true,

        pagIbigFundSalaryTreatment: true,

        active: true,

        effectiveFrom: true,
        effectiveTo: true,

        createdAt: true,
        updatedAt: true,
      },
    });

    return items.map((item) => ({
      id: item.id,

      employmentRecordId: item.employmentRecordId,

      kind: item.kind,

      code: item.code,
      description: item.description,

      amount: item.amount.toString(),

      taxable: item.taxable,

      pagIbigFundSalaryTreatment: item.pagIbigFundSalaryTreatment,

      active: item.active,

      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo,

      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  async createRecurringPayrollItem(
    employeeId: string,
    input: CreateRecurringPayrollItemDto,
    actorUserId: string,
  ): Promise<RecurringPayrollItemView> {
    this.validateCreateSemantics(input);

    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,

        employmentRecords: {
          where: {
            endDate: null,
          },

          orderBy: {
            startDate: 'desc',
          },

          take: 1,

          select: {
            id: true,
            startDate: true,

            company: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const currentEmployment = employee.employmentRecords[0];

    if (!currentEmployment) {
      throw new NotFoundException('Current employment assignment not found.');
    }

    const effectiveFrom = new Date(input.effectiveFrom);

    if (effectiveFrom < currentEmployment.startDate) {
      throw new BadRequestException(
        'Recurring payroll item effective date cannot be before the current employment start date.',
      );
    }

    const existingItem = await this.prisma.recurringPayrollItem.findFirst({
      where: {
        employmentRecordId: currentEmployment.id,

        kind: input.kind,

        code: input.code,

        active: true,
        effectiveTo: null,
      },

      select: {
        id: true,
      },
    });

    if (existingItem) {
      throw new ConflictException(
        `An active ${input.kind.toLowerCase()} with code ${input.code} already exists for this employee.`,
      );
    }

    const amount = new Prisma.Decimal(input.amount);

    const createdItem = await this.prisma.$transaction(async (transaction) => {
      await this.lockAffectedMutableCutoffs(
        transaction,
        currentEmployment.company.id,
        effectiveFrom,
      );

      const item = await transaction.recurringPayrollItem.create({
        data: {
          employmentRecordId: currentEmployment.id,

          kind: input.kind,

          code: input.code,
          description: input.description,

          amount,

          taxable: input.taxable ?? false,

          pagIbigFundSalaryTreatment:
            input.kind === RecurringPayrollItemKind.ALLOWANCE
              ? input.pagIbigFundSalaryTreatment!
              : null,

          active: true,

          effectiveFrom,
        },

        select: {
          id: true,
          employmentRecordId: true,

          kind: true,

          code: true,
          description: true,

          amount: true,

          taxable: true,

          pagIbigFundSalaryTreatment: true,

          active: true,

          effectiveFrom: true,
          effectiveTo: true,

          createdAt: true,
          updatedAt: true,
        },
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,

        companyId: currentEmployment.company.id,

        action: EmployeeManagementAuditAction.RECURRING_PAYROLL_ITEM_CREATED,

        module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

        entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

        entityId: employee.id,

        reference: employee.employeeNumber,

        details: `Added recurring ${input.kind.toLowerCase()} ${input.code} for ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}).`,

        metadata: {
          recurringPayrollItemId: item.id,

          employmentRecordId: currentEmployment.id,

          kind: item.kind,

          code: item.code,

          amount: item.amount.toString(),

          taxable: item.taxable,

          pagIbigFundSalaryTreatment: item.pagIbigFundSalaryTreatment,

          effectiveFrom: input.effectiveFrom,
        },
      });

      return item;
    });

    return {
      id: createdItem.id,

      employmentRecordId: createdItem.employmentRecordId,

      kind: createdItem.kind,

      code: createdItem.code,
      description: createdItem.description,

      amount: createdItem.amount.toString(),

      taxable: createdItem.taxable,

      pagIbigFundSalaryTreatment: createdItem.pagIbigFundSalaryTreatment,

      active: createdItem.active,

      effectiveFrom: createdItem.effectiveFrom,

      effectiveTo: createdItem.effectiveTo,

      createdAt: createdItem.createdAt,

      updatedAt: createdItem.updatedAt,
    };
  }

  async updatePagIbigFundSalaryTreatment(
    employeeId: string,
    recurringPayrollItemId: string,
    input: UpdateRecurringPayrollItemPagIbigTreatmentDto,
    actorUserId: string,
  ): Promise<RecurringPayrollItemView> {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,

        employmentRecords: {
          where: {
            endDate: null,
          },

          orderBy: {
            startDate: 'desc',
          },

          take: 1,

          select: {
            id: true,

            company: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const currentEmployment = employee.employmentRecords[0];

    if (!currentEmployment) {
      throw new NotFoundException('Current employment assignment not found.');
    }

    const updatedItem = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.recurringPayrollItem.findFirst({
        where: {
          id: recurringPayrollItemId,

          employmentRecordId: currentEmployment.id,

          active: true,
          effectiveTo: null,
        },

        select: {
          id: true,
          employmentRecordId: true,

          kind: true,

          code: true,
          description: true,

          amount: true,

          taxable: true,

          pagIbigFundSalaryTreatment: true,

          active: true,

          effectiveFrom: true,
          effectiveTo: true,

          createdAt: true,
          updatedAt: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          'Active recurring payroll item not found for the current employment assignment.',
        );
      }

      if (existing.kind !== RecurringPayrollItemKind.ALLOWANCE) {
        throw new BadRequestException(
          'Pag-IBIG Fund Salary treatment applies only to recurring allowances.',
        );
      }

      if (
        existing.pagIbigFundSalaryTreatment === input.pagIbigFundSalaryTreatment
      ) {
        throw new BadRequestException(
          'Recurring allowance already has the requested Pag-IBIG Fund Salary treatment.',
        );
      }

      await this.lockAffectedMutableCutoffs(
        transaction,
        currentEmployment.company.id,
        existing.effectiveFrom,
      );

      const updated = await transaction.recurringPayrollItem.update({
        where: {
          id: existing.id,
        },

        data: {
          pagIbigFundSalaryTreatment: input.pagIbigFundSalaryTreatment,
        },

        select: {
          id: true,
          employmentRecordId: true,

          kind: true,

          code: true,
          description: true,

          amount: true,

          taxable: true,

          pagIbigFundSalaryTreatment: true,

          active: true,

          effectiveFrom: true,
          effectiveTo: true,

          createdAt: true,
          updatedAt: true,
        },
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,

        companyId: currentEmployment.company.id,

        action:
          EmployeeManagementAuditAction.RECURRING_PAYROLL_ITEM_PAGIBIG_TREATMENT_CHANGED,

        module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

        entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

        entityId: employee.id,

        reference: employee.employeeNumber,

        details:
          `Corrected Pag-IBIG Fund Salary treatment for recurring allowance ` +
          `${updated.code} for ${employee.firstName} ${employee.lastName} ` +
          `(${employee.employeeNumber}).`,

        metadata: {
          recurringPayrollItemId: updated.id,

          employmentRecordId: currentEmployment.id,

          kind: updated.kind,

          code: updated.code,

          previousPagIbigFundSalaryTreatment:
            existing.pagIbigFundSalaryTreatment,

          pagIbigFundSalaryTreatment: updated.pagIbigFundSalaryTreatment,
        },
      });

      return updated;
    });

    return {
      id: updatedItem.id,

      employmentRecordId: updatedItem.employmentRecordId,

      kind: updatedItem.kind,

      code: updatedItem.code,
      description: updatedItem.description,

      amount: updatedItem.amount.toString(),

      taxable: updatedItem.taxable,

      pagIbigFundSalaryTreatment: updatedItem.pagIbigFundSalaryTreatment,

      active: updatedItem.active,

      effectiveFrom: updatedItem.effectiveFrom,
      effectiveTo: updatedItem.effectiveTo,

      createdAt: updatedItem.createdAt,
      updatedAt: updatedItem.updatedAt,
    };
  }

  private async lockAffectedMutableCutoffs(
    transaction: Prisma.TransactionClient,
    companyId: string,
    effectiveFrom: Date,
  ): Promise<void> {
    /*
     * Recurring payroll items are not tied to one cutoff.
     *
     * Lock every currently mutable company cutoff whose end
     * date can include this recurring item. Payroll generation
     * and regeneration acquire the same payroll_cutoffs row
     * lock before their authoritative preflight, so whichever
     * transaction obtains the lock first becomes authoritative.
     *
     * LOCKED historical payroll is deliberately not changed.
     */
    await transaction.$queryRaw<LockedMutablePayrollCutoffRow[]>`
      SELECT
        "id"
      FROM "payroll_cutoffs"
      WHERE "companyId" = CAST(${companyId} AS uuid)
        AND "status" IN ('OPEN', 'REOPENED')
        AND "endDate" >= ${effectiveFrom}
      ORDER BY
        "startDate" ASC,
        "endDate" ASC,
        "id" ASC
      FOR UPDATE
    `;
  }

  private validateCreateSemantics(input: CreateRecurringPayrollItemDto): void {
    if (input.kind === RecurringPayrollItemKind.ALLOWANCE) {
      if (!input.pagIbigFundSalaryTreatment) {
        throw new BadRequestException(
          'Pag-IBIG Fund Salary treatment is required for recurring allowances.',
        );
      }

      return;
    }

    if (input.pagIbigFundSalaryTreatment !== undefined) {
      throw new BadRequestException(
        'Pag-IBIG Fund Salary treatment applies only to recurring allowances.',
      );
    }
  }
}
