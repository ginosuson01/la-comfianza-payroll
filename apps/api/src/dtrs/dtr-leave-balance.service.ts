import { BadRequestException, Injectable } from '@nestjs/common';
import { LeaveTransactionType, LeaveUnit, Prisma } from '@payroll/database';

import { DTR_LEAVE_TRANSACTION_REFERENCE_TYPE } from './dtr-leave.constants';
import { DtrPayrollConfigService } from './dtr-payroll-config.service';

interface DtrLeaveUsageInput {
  employeeId: string;
  companyId: string;

  leaveTypeId: string | null;
  leaveMinutes: number;

  workDate: Date;
  entryId: string;

  actorUserId: string;
}

interface TrackedLeaveContext {
  leaveTypeId: string;
  leaveCode: string;
  leaveAccountId: string;
}

@Injectable()
export class DtrLeaveBalanceService {
  constructor(private readonly payrollConfigService: DtrPayrollConfigService) {}

  async applyUsageInTransaction(
    transaction: Prisma.TransactionClient,
    input: DtrLeaveUsageInput,
  ): Promise<void> {
    if (!input.leaveTypeId || input.leaveMinutes <= 0) {
      return;
    }

    const leaveContext = await this.getTrackedLeaveContext(
      transaction,
      input.employeeId,
      input.companyId,
      input.leaveTypeId,
      true,
    );

    if (!leaveContext) {
      return;
    }

    const leaveDays = await this.payrollConfigService.convertLeaveMinutesToDays(
      input.companyId,
      input.workDate,
      input.leaveMinutes,
    );

    if (leaveDays.lte(0)) {
      return;
    }

    const balanceUpdate = await transaction.employeeLeaveAccount.updateMany({
      where: {
        id: leaveContext.leaveAccountId,

        currentBalance: {
          gte: leaveDays,
        },
      },

      data: {
        currentBalance: {
          decrement: leaveDays,
        },
      },
    });

    if (balanceUpdate.count !== 1) {
      throw new BadRequestException(
        `Insufficient ${leaveContext.leaveCode} balance. ` +
          `The requested DTR leave requires ${leaveDays.toFixed(4)} day(s).`,
      );
    }

    await transaction.leaveTransaction.create({
      data: {
        leaveAccountId: leaveContext.leaveAccountId,

        type: LeaveTransactionType.USAGE,

        quantity: leaveDays.mul(-1),

        effectiveDate: input.workDate,

        referenceType: DTR_LEAVE_TRANSACTION_REFERENCE_TYPE,

        referenceId: input.entryId,

        notes:
          `DTR ${leaveContext.leaveCode} usage for ` +
          `${this.toDateString(input.workDate)}.`,

        createdByUserId: input.actorUserId,
      },
    });
  }

  async reverseUsageInTransaction(
    transaction: Prisma.TransactionClient,
    input: DtrLeaveUsageInput,
  ): Promise<void> {
    if (!input.leaveTypeId || input.leaveMinutes <= 0) {
      return;
    }

    const leaveContext = await this.getTrackedLeaveContext(
      transaction,
      input.employeeId,
      input.companyId,
      input.leaveTypeId,
      false,
    );

    if (!leaveContext) {
      return;
    }

    const postedAggregate = await transaction.leaveTransaction.aggregate({
      where: {
        leaveAccountId: leaveContext.leaveAccountId,

        referenceType: DTR_LEAVE_TRANSACTION_REFERENCE_TYPE,

        referenceId: input.entryId,

        type: {
          in: [LeaveTransactionType.USAGE, LeaveTransactionType.REVERSAL],
        },
      },

      _sum: {
        quantity: true,
      },
    });

    const netPostedQuantity = new Prisma.Decimal(
      postedAggregate._sum.quantity ?? 0,
    );

    if (netPostedQuantity.gte(0)) {
      return;
    }

    const reversalQuantity = netPostedQuantity.abs();

    await transaction.employeeLeaveAccount.update({
      where: {
        id: leaveContext.leaveAccountId,
      },

      data: {
        currentBalance: {
          increment: reversalQuantity,
        },
      },
    });

    await transaction.leaveTransaction.create({
      data: {
        leaveAccountId: leaveContext.leaveAccountId,

        type: LeaveTransactionType.REVERSAL,

        quantity: reversalQuantity,

        effectiveDate: input.workDate,

        referenceType: DTR_LEAVE_TRANSACTION_REFERENCE_TYPE,

        referenceId: input.entryId,

        notes:
          `Reversed DTR ${leaveContext.leaveCode} usage for ` +
          `${this.toDateString(input.workDate)}.`,

        createdByUserId: input.actorUserId,
      },
    });
  }

  private async getTrackedLeaveContext(
    transaction: Prisma.TransactionClient,
    employeeId: string,
    companyId: string,
    leaveTypeId: string,
    requireAccount: boolean,
  ): Promise<TrackedLeaveContext | null> {
    const leaveType = await transaction.leaveType.findUnique({
      where: {
        id: leaveTypeId,
      },

      select: {
        id: true,
        companyId: true,
        code: true,
        unit: true,
        active: true,
      },
    });

    if (!leaveType) {
      if (!requireAccount) {
        return null;
      }

      throw new BadRequestException('The selected leave type does not exist.');
    }

    if (leaveType.companyId !== companyId) {
      throw new BadRequestException(
        'The selected leave type does not belong to the DTR company.',
      );
    }

    if (requireAccount && !leaveType.active) {
      throw new BadRequestException('The selected leave type is inactive.');
    }

    if (leaveType.code !== 'VL' && leaveType.code !== 'SL') {
      return null;
    }

    if (leaveType.unit !== LeaveUnit.DAY) {
      throw new BadRequestException(
        `${leaveType.code} leave type must use DAY as its unit.`,
      );
    }

    const leaveAccount = await transaction.employeeLeaveAccount.findUnique({
      where: {
        employeeId_leaveTypeId: {
          employeeId,
          leaveTypeId,
        },
      },

      select: {
        id: true,
      },
    });

    if (!leaveAccount) {
      if (!requireAccount) {
        return null;
      }

      throw new BadRequestException(
        `Employee does not have a ${leaveType.code} leave balance account.`,
      );
    }

    return {
      leaveTypeId: leaveType.id,

      leaveCode: leaveType.code,

      leaveAccountId: leaveAccount.id,
    };
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
