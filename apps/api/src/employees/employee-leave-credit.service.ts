import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveTransactionType, LeaveUnit, Prisma } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import { resolveAnnualLeaveBalanceKind } from './employee-annual-leave-allocation';
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
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const effectiveDate = new Date(input.effectiveDate);

    const quantity = new Prisma.Decimal(input.quantity);

    if (quantity.isZero()) {
      throw new BadRequestException(
        'Leave credit adjustment quantity cannot be zero.',
      );
    }

    const leaveName = getLeaveTypeName(input.leaveCode);

    const result = await this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        const calendarYear = effectiveDate.getUTCFullYear();

        const entitlementCycle =
          await transaction.employeeLeaveEntitlementCycle.findUnique({
            where: {
              employeeId_calendarYear: {
                employeeId,
                calendarYear,
              },
            },

            select: {
              id: true,
              employmentRecordId: true,
              employeeType: true,
              effectiveFrom: true,
              expiresOn: true,

              employmentRecord: {
                select: {
                  companyId: true,
                },
              },
            },
          });

        if (!entitlementCycle) {
          throw new BadRequestException(
            `Employee does not have an initialized ${calendarYear} leave entitlement.`,
          );
        }

        if (
          effectiveDate < entitlementCycle.effectiveFrom ||
          effectiveDate > entitlementCycle.expiresOn
        ) {
          throw new BadRequestException(
            `Leave credit effective date is outside the ${calendarYear} entitlement period.`,
          );
        }

        const balanceKind = resolveAnnualLeaveBalanceKind(
          entitlementCycle.employeeType,
          input.leaveCode,
        );

        if (!balanceKind) {
          throw new BadRequestException(
            'Unsupported annual leave balance type.',
          );
        }

        const companyId = entitlementCycle.employmentRecord.companyId;

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
              entitlementCycleId_balanceKind: {
                entitlementCycleId: entitlementCycle.id,
                balanceKind,
              },
            },

            select: {
              id: true,
              currentBalance: true,
            },
          });

        if (!existingAccount) {
          throw new BadRequestException(
            `Employee does not have an initialized ${input.leaveCode} leave balance for ${calendarYear}.`,
          );
        }

        const previousBalance = existingAccount.currentBalance;

        const currentBalance = previousBalance.plus(quantity);

        if (currentBalance.lt(0)) {
          throw new BadRequestException(
            `Insufficient ${input.leaveCode} balance. The resulting balance cannot be negative.`,
          );
        }

        const leaveAccount = await transaction.employeeLeaveAccount.update({
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
            employmentRecordId: entitlementCycle.employmentRecordId,

            leaveEntitlementCycleId: entitlementCycle.id,

            balanceKind,

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
          companyId,

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

      leaveCode: input.leaveCode,
    };
  }
}
