import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type RecurringPayrollItemKind } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import type { CreateRecurringPayrollItemDto } from './dto/create-recurring-payroll-item.dto';
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
  active: boolean;

  effectiveFrom: Date;
  effectiveTo: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class EmployeeRecurringPayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async createRecurringPayrollItem(
    employeeId: string,
    input: CreateRecurringPayrollItemDto,
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
      const item = await transaction.recurringPayrollItem.create({
        data: {
          employmentRecordId: currentEmployment.id,

          kind: input.kind,

          code: input.code,
          description: input.description,

          amount,

          taxable: input.taxable ?? false,
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
      active: createdItem.active,

      effectiveFrom: createdItem.effectiveFrom,

      effectiveTo: createdItem.effectiveTo,

      createdAt: createdItem.createdAt,

      updatedAt: createdItem.updatedAt,
    };
  }
}
