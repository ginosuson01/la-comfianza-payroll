import { BadRequestException, Injectable } from '@nestjs/common';
import {
  HolidayType,
  LeaveBalanceKind,
  LeaveTransactionType,
  LeaveUnit,
  OvertimeType,
  Prisma,
} from '@payroll/database';

import { PrismaService } from '../database/prisma.service';
import { resolveAnnualLeaveBalanceKind } from '../employees/employee-annual-leave-allocation';
import { DTR_LEAVE_TRANSACTION_REFERENCE_TYPE } from './dtr-leave.constants';
import { DtrPayrollConfigService } from './dtr-payroll-config.service';
import type { OvertimeEntryInputDto } from './dto/overtime-entry-input.dto';

export interface DtrEntryValidationInput {
  dtrId: string;
  employeeId: string;
  companyId: string;

  entryId?: string | null;

  workDate: Date;

  regularMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  absenceMinutes: number;
  leaveMinutes: number;
  nightDifferentialMinutes: number;

  restDay: boolean;

  leaveTypeId: string | null;
  holidayId: string | null;

  overtimeEntries: OvertimeEntryInputDto[];
}

interface ValidatedLeaveType {
  id: string;
  code: string;
  unit: LeaveUnit;
}

interface ValidatedHoliday {
  id: string;
  type: HolidayType;
}

@Injectable()
export class DtrEntryValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollConfigService: DtrPayrollConfigService,
  ) {}

  async validateEntry(input: DtrEntryValidationInput): Promise<void> {
    const attendanceConfig =
      await this.payrollConfigService.getAttendanceConfig(
        input.companyId,
        input.workDate,
      );

    this.validateScheduledAttendance(
      input,
      attendanceConfig.standardWorkMinutesPerDay,
    );

    this.validateLeaveClassification(input.leaveMinutes, input.leaveTypeId);

    this.validateOvertimeEntries(input.overtimeEntries);

    const leaveType = await this.validateLeaveType(
      input.companyId,
      input.leaveTypeId,
    );

    const holiday = await this.validateHoliday(
      input.companyId,
      input.workDate,
      input.holidayId,
    );

    this.validateOvertimeClassification(
      input.restDay,
      holiday?.type ?? null,
      input.overtimeEntries,
    );

    this.validateNightDifferential(
      input.regularMinutes,
      input.nightDifferentialMinutes,
      input.overtimeEntries,
    );

    await this.validateTrackedLeaveBalance(input, leaveType);
  }

  private validateScheduledAttendance(
    input: DtrEntryValidationInput,
    standardWorkMinutesPerDay: number,
  ): void {
    if (input.restDay) {
      if (
        input.lateMinutes > 0 ||
        input.undertimeMinutes > 0 ||
        input.absenceMinutes > 0 ||
        input.leaveMinutes > 0
      ) {
        throw new BadRequestException(
          'Late, undertime, absence, and leave minutes must be zero on a rest day.',
        );
      }

      return;
    }

    const unavailableScheduledMinutes =
      input.lateMinutes +
      input.undertimeMinutes +
      input.absenceMinutes +
      input.leaveMinutes;

    if (unavailableScheduledMinutes > standardWorkMinutesPerDay) {
      throw new BadRequestException(
        'Late, undertime, absence, and leave minutes cannot exceed ' +
          `the configured ${standardWorkMinutesPerDay}-minute workday.`,
      );
    }
  }

  private validateLeaveClassification(
    leaveMinutes: number,
    leaveTypeId: string | null,
  ): void {
    if (leaveMinutes > 0 && leaveTypeId === null) {
      throw new BadRequestException(
        'A leave type is required when leave minutes are greater than zero.',
      );
    }

    if (leaveMinutes === 0 && leaveTypeId !== null) {
      throw new BadRequestException(
        'Leave minutes must be greater than zero when a leave type is selected.',
      );
    }
  }

  private validateOvertimeEntries(
    overtimeEntries: OvertimeEntryInputDto[],
  ): void {
    const overtimeTypes = overtimeEntries.map((entry) => entry.type);

    if (new Set(overtimeTypes).size !== overtimeTypes.length) {
      throw new BadRequestException(
        'Duplicate overtime types are not allowed for the same DTR entry.',
      );
    }
  }

  private validateOvertimeClassification(
    restDay: boolean,
    holidayType: HolidayType | null,
    overtimeEntries: OvertimeEntryInputDto[],
  ): void {
    if (overtimeEntries.length === 0) {
      return;
    }

    const allowedTypes = this.getAllowedOvertimeTypes(restDay, holidayType);

    for (const overtimeEntry of overtimeEntries) {
      if (!allowedTypes.includes(overtimeEntry.type)) {
        throw new BadRequestException(
          `Overtime type ${overtimeEntry.type} does not match ` +
            'the selected Rest Day / Holiday classification.',
        );
      }
    }
  }

  private getAllowedOvertimeTypes(
    restDay: boolean,
    holidayType: HolidayType | null,
  ): OvertimeType[] {
    if (!holidayType) {
      return [restDay ? OvertimeType.REST_DAY : OvertimeType.REGULAR];
    }

    if (holidayType === HolidayType.REGULAR) {
      return [
        restDay
          ? OvertimeType.REST_DAY_REGULAR_HOLIDAY
          : OvertimeType.REGULAR_HOLIDAY,
      ];
    }

    if (holidayType === HolidayType.SPECIAL_NON_WORKING) {
      return [
        restDay
          ? OvertimeType.REST_DAY_SPECIAL_HOLIDAY
          : OvertimeType.SPECIAL_HOLIDAY,
      ];
    }

    if (holidayType === HolidayType.SPECIAL_WORKING) {
      return [restDay ? OvertimeType.REST_DAY : OvertimeType.REGULAR];
    }

    /*
     * LOCAL and OTHER do not currently carry enough information
     * to determine whether the holiday is working or non-working.
     * Keep those classifications flexible until Holiday Management
     * includes explicit payroll treatment.
     */
    return restDay
      ? [OvertimeType.REST_DAY, OvertimeType.REST_DAY_SPECIAL_HOLIDAY]
      : [OvertimeType.REGULAR, OvertimeType.SPECIAL_HOLIDAY];
  }

  private validateNightDifferential(
    regularMinutes: number,
    nightDifferentialMinutes: number,
    overtimeEntries: OvertimeEntryInputDto[],
  ): void {
    if (nightDifferentialMinutes === 0) {
      return;
    }

    const overtimeMinutes = overtimeEntries.reduce(
      (total, overtime) => total + overtime.minutes,
      0,
    );

    const totalWorkedMinutes = regularMinutes + overtimeMinutes;

    if (nightDifferentialMinutes > totalWorkedMinutes) {
      throw new BadRequestException(
        'Night Differential minutes cannot exceed total worked Regular + Overtime minutes.',
      );
    }
  }

  private async validateLeaveType(
    companyId: string,
    leaveTypeId: string | null,
  ): Promise<ValidatedLeaveType | null> {
    if (!leaveTypeId) {
      return null;
    }

    const leaveType = await this.prisma.leaveType.findUnique({
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
      throw new BadRequestException('The selected leave type does not exist.');
    }

    if (leaveType.companyId !== companyId) {
      throw new BadRequestException(
        'The selected leave type does not belong to the DTR company.',
      );
    }

    if (!leaveType.active) {
      throw new BadRequestException('The selected leave type is inactive.');
    }

    return {
      id: leaveType.id,
      code: leaveType.code,
      unit: leaveType.unit,
    };
  }

  private async validateTrackedLeaveBalance(
    input: DtrEntryValidationInput,
    leaveType: ValidatedLeaveType | null,
  ): Promise<void> {
    if (!leaveType || input.leaveMinutes <= 0) {
      return;
    }

    if (leaveType.code !== 'VL' && leaveType.code !== 'SL') {
      return;
    }

    if (leaveType.unit !== LeaveUnit.DAY) {
      throw new BadRequestException(
        `${leaveType.code} leave type must use DAY as its unit.`,
      );
    }

    const calendarYear = input.workDate.getUTCFullYear();

    const yearStart = new Date(Date.UTC(calendarYear, 0, 1));
    const nextYearStart = new Date(Date.UTC(calendarYear + 1, 0, 1));

    const entitlementCycle =
      await this.prisma.employeeLeaveEntitlementCycle.findUnique({
        where: {
          employeeId_calendarYear: {
            employeeId: input.employeeId,
            calendarYear,
          },
        },

        select: {
          id: true,
          employeeType: true,
          initializationReviewRequired: true,
        },
      });

    if (!entitlementCycle) {
      throw new BadRequestException(
        `Employee does not have an initialized ${calendarYear} leave entitlement.`,
      );
    }

    if (entitlementCycle.initializationReviewRequired) {
      throw new BadRequestException(
        `${calendarYear} leave balances require Payroll Manager review before use.`,
      );
    }

    const balanceKind = resolveAnnualLeaveBalanceKind(
      entitlementCycle.employeeType,
      leaveType.code,
    );

    if (!balanceKind) {
      return;
    }

    const leaveAccount = await this.prisma.employeeLeaveAccount.findUnique({
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

    let trackedLeaveTypeIds = [leaveType.id];

    if (balanceKind === LeaveBalanceKind.SHARED_VL_SL_POOL) {
      const sharedLeaveTypes = await this.prisma.leaveType.findMany({
        where: {
          companyId: input.companyId,

          code: {
            in: ['VL', 'SL'],
          },
        },

        select: {
          id: true,
        },
      });

      trackedLeaveTypeIds = Array.from(
        new Set([leaveType.id, ...sharedLeaveTypes.map((item) => item.id)]),
      );
    }

    const existingEntries = await this.prisma.dtrEntry.findMany({
      where: {
        dtrId: input.dtrId,

        leaveTypeId: {
          in: trackedLeaveTypeIds,
        },

        workDate: {
          gte: yearStart,
          lt: nextYearStart,
        },

        leaveMinutes: {
          gt: 0,
        },

        ...(input.entryId
          ? {
              id: {
                not: input.entryId,
              },
            }
          : {}),
      },

      select: {
        id: true,
        workDate: true,
        leaveMinutes: true,
      },
    });

    let requestedLeaveDays =
      await this.payrollConfigService.convertLeaveMinutesToDays(
        input.companyId,
        input.workDate,
        input.leaveMinutes,
      );

    for (const existingEntry of existingEntries) {
      const existingLeaveDays =
        await this.payrollConfigService.convertLeaveMinutesToDays(
          input.companyId,
          existingEntry.workDate,
          existingEntry.leaveMinutes,
        );

      requestedLeaveDays = requestedLeaveDays.plus(existingLeaveDays);
    }

    const currentBalance = new Prisma.Decimal(
      leaveAccount?.currentBalance ?? 0,
    );

    let postedDtrQuantity = new Prisma.Decimal(0);

    if (leaveAccount) {
      const relevantEntryIds = existingEntries.map((entry) => entry.id);

      if (input.entryId) {
        relevantEntryIds.push(input.entryId);
      }

      if (relevantEntryIds.length > 0) {
        const transactionAggregate =
          await this.prisma.leaveTransaction.aggregate({
            where: {
              leaveAccountId: leaveAccount.id,

              referenceType: DTR_LEAVE_TRANSACTION_REFERENCE_TYPE,

              referenceId: {
                in: relevantEntryIds,
              },

              type: {
                in: [LeaveTransactionType.USAGE, LeaveTransactionType.REVERSAL],
              },
            },

            _sum: {
              quantity: true,
            },
          });

        postedDtrQuantity = new Prisma.Decimal(
          transactionAggregate._sum.quantity ?? 0,
        );
      }
    }

    /*
     * DTR ledger quantities are netted.
     *
     * USAGE    -1.0000
     * REVERSAL +1.0000
     * USAGE    -0.5000
     * ----------------
     * NET      -0.5000
     *
     * currentBalance already contains that net movement.
     * Removing the posted DTR quantity restores the amount
     * available to this DTR for validation.
     */
    const availableForDtr = currentBalance.minus(postedDtrQuantity);

    if (requestedLeaveDays.gt(availableForDtr)) {
      throw new BadRequestException(
        `Insufficient ${leaveType.code} balance. ` +
          `This DTR requires ${requestedLeaveDays.toFixed(
            4,
          )} day(s), but only ${availableForDtr.toFixed(
            4,
          )} day(s) are available.`,
      );
    }
  }

  private async validateHoliday(
    companyId: string,
    workDate: Date,
    holidayId: string | null,
  ): Promise<ValidatedHoliday | null> {
    if (!holidayId) {
      return null;
    }

    const holiday = await this.prisma.holiday.findUnique({
      where: {
        id: holidayId,
      },

      select: {
        id: true,
        companyId: true,
        date: true,
        type: true,
        active: true,
      },
    });

    if (!holiday) {
      throw new BadRequestException('The selected holiday does not exist.');
    }

    if (holiday.companyId !== companyId) {
      throw new BadRequestException(
        'The selected holiday does not belong to the DTR company.',
      );
    }

    if (!holiday.active) {
      throw new BadRequestException('The selected holiday is inactive.');
    }

    if (this.toDateString(holiday.date) !== this.toDateString(workDate)) {
      throw new BadRequestException(
        'The selected holiday does not match the DTR work date.',
      );
    }

    return {
      id: holiday.id,
      type: holiday.type,
    };
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
