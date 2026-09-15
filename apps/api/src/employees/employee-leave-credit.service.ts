import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveTransactionType, LeaveUnit, Prisma } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import type {
  AdjustEmployeeLeaveCreditDto,
  EmployeeLeaveCode,
} from './dto/adjust-employee-leave-credit.dto';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';

export interface EmployeeLeaveCreditView {
  leaveAccountId: string;
  leaveTransactionId: string;

  employeeId: string;
  employeeNumber: string;

  companyId: string;

  leaveTypeId: string;
  leaveCode: EmployeeLeaveCode;
  leaveName: string;
  unit: LeaveUnit;

  previousBalance: string;
  adjustmentQuantity: string;
  currentBalance: string;

  effectiveDate: Date;

  notes: string | null;
  createdAt: Date;
}

function getLeaveTypeName(leaveCode: EmployeeLeaveCode): string {
  return leaveCode === 'VL' ? 'Vacation Leave' : 'Sick Leave';
}

@Injectable()
export class EmployeeLeaveCreditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async adjustLeaveCredit(
    employeeId: string,
    input: AdjustEmployeeLeaveCreditDto,
    actorUserId: string,
  ): Promise<EmployeeLeaveCreditView> {
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

    const effectiveDate = new Date(input.effectiveDate);

    if (effectiveDate < currentEmployment.startDate) {
      throw new BadRequestException(
        'Leave credit effective date cannot be before the current employment start date.',
      );
    }

    const quantity = new Prisma.Decimal(input.quantity);

    if (quantity.isZero()) {
      throw new BadRequestException(
        'Leave credit adjustment quantity cannot be zero.',
      );
    }

    const companyId = currentEmployment.company.id;

    const leaveName = getLeaveTypeName(input.leaveCode);

    const result = await this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        const leaveType = await transaction.leaveType.upsert({
          where: {
            companyId_code: {
              companyId,
              code: input.leaveCode,
            },
          },

          create: {
            companyId,

            code: input.leaveCode,
            name: leaveName,

            unit: LeaveUnit.DAY,

            active: true,
          },

          update: {
            active: true,
          },

          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
          },
        });

        if (leaveType.unit !== LeaveUnit.DAY) {
          throw new BadRequestException(
            `${input.leaveCode} leave type must use DAY as its unit.`,
          );
        }

        const existingAccount =
          await transaction.employeeLeaveAccount.findUnique({
            where: {
              employeeId_leaveTypeId: {
                employeeId,
                leaveTypeId: leaveType.id,
              },
            },

            select: {
              id: true,
              currentBalance: true,
            },
          });

        const previousBalance =
          existingAccount?.currentBalance ?? new Prisma.Decimal(0);

        const currentBalance = previousBalance.plus(quantity);

        if (currentBalance.lt(0)) {
          throw new BadRequestException(
            `Insufficient ${input.leaveCode} balance. The resulting balance cannot be negative.`,
          );
        }

        const leaveAccount = existingAccount
          ? await transaction.employeeLeaveAccount.update({
              where: {
                id: existingAccount.id,
              },

              data: {
                currentBalance,
              },

              select: {
                id: true,
                currentBalance: true,
              },
            })
          : await transaction.employeeLeaveAccount.create({
              data: {
                employeeId,
                leaveTypeId: leaveType.id,

                currentBalance,
              },

              select: {
                id: true,
                currentBalance: true,
              },
            });

        const leaveTransaction = await transaction.leaveTransaction.create({
          data: {
            leaveAccountId: leaveAccount.id,

            type: LeaveTransactionType.MANUAL_ADJUSTMENT,

            quantity,

            effectiveDate,

            notes: input.notes ?? null,

            createdByUserId: actorUserId,
          },

          select: {
            id: true,
            effectiveDate: true,
            notes: true,
            createdAt: true,
          },
        });

        await this.auditLog.recordSuccessInTransaction(transaction, {
          actorUserId,

          companyId,

          action: EmployeeManagementAuditAction.LEAVE_BALANCE_ADJUSTED,

          module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

          entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

          entityId: employee.id,

          reference: employee.employeeNumber,

          details: `Adjusted ${input.leaveCode} balance for ${employee.firstName} ${employee.lastName} (${employee.employeeNumber}) by ${quantity.toString()} day(s).`,

          metadata: {
            employmentRecordId: currentEmployment.id,

            leaveAccountId: leaveAccount.id,

            leaveTransactionId: leaveTransaction.id,

            leaveTypeId: leaveType.id,

            leaveCode: input.leaveCode,

            previousBalance: previousBalance.toString(),

            adjustmentQuantity: quantity.toString(),

            currentBalance: leaveAccount.currentBalance.toString(),

            effectiveDate: input.effectiveDate,

            ...(input.notes
              ? {
                  notes: input.notes,
                }
              : {}),
          },
        });

        return {
          leaveAccountId: leaveAccount.id,

          leaveTransactionId: leaveTransaction.id,

          leaveTypeId: leaveType.id,

          leaveName: leaveType.name,

          unit: leaveType.unit,

          previousBalance: previousBalance.toString(),

          adjustmentQuantity: quantity.toString(),

          currentBalance: leaveAccount.currentBalance.toString(),

          effectiveDate: leaveTransaction.effectiveDate,

          notes: leaveTransaction.notes,

          createdAt: leaveTransaction.createdAt,
        };
      },
    );

    return {
      ...result,

      employeeId: employee.id,

      employeeNumber: employee.employeeNumber,

      companyId,

      leaveCode: input.leaveCode,
    };
  }
}
