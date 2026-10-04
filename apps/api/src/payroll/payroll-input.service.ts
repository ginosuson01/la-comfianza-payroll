import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  EmployeePayrollStatus,
  PayBasis,
  PayrollCompensationSource,
  PayrollAdjustmentType,
  PayoutMethod,
  Prisma,
  RecurringPayrollItemKind,
} from '@payroll/database';

import {
  validatePayrollCalculationInput,
  type PayrollCalculationInput,
  type PayrollEngineAdjustmentType,
  type PayrollEngineEmployeeStatus,
  type PayrollEnginePayBasis,
  type PayrollEnginePayoutMethod,
  type PayrollEngineRecurringItemKind,
} from '@payroll/payroll-engine';

import { PrismaService } from '../database/prisma.service';
import { DtrAttendanceSummaryService } from '../dtrs/dtr-attendance-summary.service';
import { DtrPayrollConfigService } from '../dtrs/dtr-payroll-config.service';

export interface PayrollInputCutoffSnapshot {
  id: string;

  startDate: string;
  endDate: string;
  payDate: string;
}

export interface PayrollEmployeeInputAssembly {
  companyId: string;

  payrollCutoffId: string;

  dtrId: string;

  employmentStartDate: string;

  cutoff: PayrollInputCutoffSnapshot;

  positionSnapshot: string | null;

  departmentSnapshot: string | null;

  compensationSource: PayrollCompensationSource;

  input: PayrollCalculationInput;
}

@Injectable()
export class PayrollInputService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceSummary: DtrAttendanceSummaryService,
    private readonly payrollConfig: DtrPayrollConfigService,
  ) {}

  async assembleEmployeeInput(
    companyId: string,
    payrollCutoffId: string,
    employeeId: string,
  ): Promise<PayrollEmployeeInputAssembly> {
    const dtr = await this.prisma.dtr.findFirst({
      where: {
        companyId,
        payrollCutoffId,
        employeeId,
      },

      select: {
        id: true,

        companyId: true,

        employeeId: true,

        employmentRecordId: true,

        employee: {
          select: {
            id: true,

            employeeNumber: true,

            firstName: true,
            middleName: true,
            lastName: true,
            suffix: true,

            currentStatus: true,
          },
        },

        employmentRecord: {
          select: {
            id: true,

            companyId: true,

            startDate: true,

            position: {
              select: {
                name: true,
              },
            },

            department: {
              select: {
                name: true,
              },
            },

            payrollProfile: {
              select: {
                payoutMethod: true,

                bankName: true,

                accountNumberLast4: true,

                contributionConfig: true,

                taxConfig: true,
              },
            },
          },
        },

        payrollCutoff: {
          select: {
            id: true,

            companyId: true,

            startDate: true,
            endDate: true,
            payDate: true,

            status: true,
          },
        },
      },
    });

    if (!dtr) {
      throw new NotFoundException(
        'DTR was not found for the employee and payroll cutoff.',
      );
    }

    if (
      dtr.payrollCutoff.companyId !== companyId ||
      dtr.employmentRecord.companyId !== companyId
    ) {
      throw new BadRequestException(
        'Payroll source records do not belong to the selected company.',
      );
    }

    const attendance = await this.attendanceSummary.getSummary(dtr.id);

    if (!attendance.payrollReady) {
      throw new BadRequestException(
        attendance.readinessIssues.length > 0
          ? attendance.readinessIssues.join(' ')
          : 'DTR is not ready for payroll generation.',
      );
    }

    const effectiveStatusHistory =
      await this.prisma.employeeStatusHistory.findFirst({
        where: {
          employeeId: dtr.employeeId,

          effectiveDate: {
            lte: dtr.payrollCutoff.endDate,
          },
        },

        orderBy: [
          {
            effectiveDate: 'desc',
          },
          {
            changedAt: 'desc',
          },
        ],

        select: {
          newStatus: true,
        },
      });

    const payrollStatus =
      effectiveStatusHistory?.newStatus ?? dtr.employee.currentStatus;

    const employeeCompensation = await this.prisma.compensationRecord.findFirst(
      {
        where: {
          employmentRecordId: dtr.employmentRecordId,

          effectiveFrom: {
            lte: dtr.payrollCutoff.endDate,
          },

          OR: [
            {
              effectiveTo: null,
            },
            {
              effectiveTo: {
                gt: dtr.payrollCutoff.endDate,
              },
            },
          ],
        },

        orderBy: {
          effectiveFrom: 'desc',
        },

        select: {
          id: true,

          payBasis: true,

          rate: true,

          effectiveFrom: true,

          effectiveTo: true,
        },
      },
    );

    const companyCompensation = employeeCompensation
      ? null
      : await this.prisma.companyCompensationRecord.findFirst({
          where: {
            companyId,

            effectiveFrom: {
              lte: dtr.payrollCutoff.endDate,
            },

            OR: [
              {
                effectiveTo: null,
              },
              {
                effectiveTo: {
                  gt: dtr.payrollCutoff.endDate,
                },
              },
            ],
          },

          orderBy: {
            effectiveFrom: 'desc',
          },

          select: {
            id: true,

            payBasis: true,

            rate: true,

            effectiveFrom: true,

            effectiveTo: true,
          },
        });

    const compensation = employeeCompensation ?? companyCompensation;

    if (!compensation) {
      throw new BadRequestException(
        'No effective employee compensation override or company standard compensation exists at the payroll cutoff end date.',
      );
    }

    if (compensation.effectiveFrom > dtr.payrollCutoff.startDate) {
      throw new BadRequestException(
        'Compensation changes within a payroll cutoff are not supported.',
      );
    }

    const compensationSource = employeeCompensation
      ? PayrollCompensationSource.EMPLOYEE_OVERRIDE
      : PayrollCompensationSource.COMPANY_STANDARD;

    const profile = dtr.employmentRecord.payrollProfile;

    if (!profile) {
      throw new BadRequestException(
        'Employee payroll profile is required before payroll generation.',
      );
    }

    if (
      profile.payoutMethod === PayoutMethod.ATM &&
      !profile.accountNumberLast4
    ) {
      throw new BadRequestException(
        'ATM payout requires a configured employee bank account.',
      );
    }

    const recurringItems = await this.prisma.recurringPayrollItem.findMany({
      where: {
        employmentRecordId: dtr.employmentRecordId,

        active: true,

        effectiveFrom: {
          lte: dtr.payrollCutoff.endDate,
        },

        OR: [
          {
            effectiveTo: null,
          },
          {
            effectiveTo: {
              gte: dtr.payrollCutoff.endDate,
            },
          },
        ],
      },

      orderBy: [
        {
          kind: 'asc',
        },
        {
          code: 'asc',
        },
      ],

      select: {
        kind: true,

        code: true,

        description: true,

        amount: true,

        taxable: true,

        effectiveFrom: true,
      },
    });

    const midCutoffRecurringItem = recurringItems.find(
      (item) => item.effectiveFrom > dtr.payrollCutoff.startDate,
    );

    if (midCutoffRecurringItem) {
      throw new BadRequestException(
        'Recurring payroll items that become effective within a payroll cutoff are not supported.',
      );
    }

    const adjustments = await this.prisma.payrollAdjustment.findMany({
      where: {
        companyId,

        payrollCutoffId,

        employeeId,
      },

      orderBy: {
        createdAt: 'asc',
      },

      select: {
        type: true,

        code: true,

        description: true,

        amount: true,

        taxable: true,

        reason: true,
      },
    });

    const attendanceConfig = await this.payrollConfig.getAttendanceConfig(
      companyId,
      dtr.payrollCutoff.endDate,
    );

    const setupVersion =
      await this.prisma.companyPayrollSetupVersion.findUnique({
        where: {
          id: attendanceConfig.companyPayrollSetupVersionId,
        },

        select: {
          id: true,

          version: true,

          config: true,

          effectiveFrom: true,

          effectiveTo: true,

          companyPayrollSetup: {
            select: {
              companyId: true,
            },
          },
        },
      });

    if (!setupVersion) {
      throw new BadRequestException(
        'The active company payroll configuration could not be loaded.',
      );
    }

    if (setupVersion.companyPayrollSetup.companyId !== companyId) {
      throw new BadRequestException(
        'Payroll configuration does not belong to the selected company.',
      );
    }

    /*
     * PayrollRun stores one configuration version for the
     * complete cutoff. Until multi-version cutoff computation
     * is explicitly approved, the selected configuration must
     * cover the entire payroll period.
     */
    if (
      setupVersion.effectiveFrom &&
      setupVersion.effectiveFrom > dtr.payrollCutoff.startDate
    ) {
      throw new BadRequestException(
        'The active payroll configuration does not cover the entire payroll cutoff.',
      );
    }

    if (
      setupVersion.effectiveTo &&
      setupVersion.effectiveTo < dtr.payrollCutoff.endDate
    ) {
      throw new BadRequestException(
        'The active payroll configuration does not cover the entire payroll cutoff.',
      );
    }

    const configSnapshot = this.requireJsonObject(
      setupVersion.config,
      'Company payroll configuration',
    );

    const contributionConfig = this.optionalJsonObject(
      profile.contributionConfig,
      'Employee contribution configuration',
    );

    const taxConfig = this.optionalJsonObject(
      profile.taxConfig,
      'Employee tax configuration',
    );

    const input: PayrollCalculationInput = {
      employeeId: dtr.employeeId,

      employmentRecordId: dtr.employmentRecordId,

      employeeNumber: dtr.employee.employeeNumber,

      employeeName: this.formatEmployeeName(
        dtr.employee.firstName,
        dtr.employee.middleName,
        dtr.employee.lastName,
        dtr.employee.suffix,
      ),

      payrollStatus: this.toPayrollStatus(payrollStatus),

      payoutMethod: this.toPayoutMethod(profile.payoutMethod),

      payoutAccountLast4: profile.accountNumberLast4,

      payBasis: this.toPayBasis(compensation.payBasis),

      baseRate: compensation.rate.toFixed(4),

      attendance: attendance.attendance,

      recurringItems: recurringItems.map((item) => ({
        code: item.code,

        description: item.description,

        kind: this.toRecurringItemKind(item.kind),

        amount: item.amount.toFixed(2),

        taxable: item.taxable,
      })),

      adjustments: adjustments.map((adjustment) => ({
        code: adjustment.code,

        description: adjustment.description,

        type: this.toAdjustmentType(adjustment.type),

        amount: adjustment.amount.toFixed(2),

        taxable: adjustment.taxable,

        reason: adjustment.reason,
      })),

      contributionConfig,

      taxConfig,

      config: {
        companyPayrollSetupVersionId: setupVersion.id,

        version: setupVersion.version,

        standardWorkMinutesPerDay: attendanceConfig.standardWorkMinutesPerDay,

        configSnapshot,
      },
    };

    validatePayrollCalculationInput(input);

    return {
      companyId,

      payrollCutoffId,

      dtrId: dtr.id,

      employmentStartDate: this.toDateString(dtr.employmentRecord.startDate),

      cutoff: {
        id: dtr.payrollCutoff.id,

        startDate: this.toDateString(dtr.payrollCutoff.startDate),

        endDate: this.toDateString(dtr.payrollCutoff.endDate),

        payDate: this.toDateString(dtr.payrollCutoff.payDate),
      },

      positionSnapshot: dtr.employmentRecord.position?.name ?? null,

      departmentSnapshot: dtr.employmentRecord.department?.name ?? null,

      compensationSource,

      input,
    };
  }

  private formatEmployeeName(
    firstName: string,
    middleName: string | null,
    lastName: string,
    suffix: string | null,
  ): string {
    return [firstName, middleName, lastName, suffix]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(' ');
  }

  private toPayrollStatus(
    value: EmployeePayrollStatus,
  ): PayrollEngineEmployeeStatus {
    switch (value) {
      case EmployeePayrollStatus.ACTIVE:
        return 'ACTIVE';

      case EmployeePayrollStatus.ACTIVE_HOLD:
        return 'ACTIVE_HOLD';

      case EmployeePayrollStatus.RESIGNED:
        return 'RESIGNED';
    }

    throw new Error(`Unsupported employee payroll status: ${String(value)}`);
  }

  private toPayBasis(value: PayBasis): PayrollEnginePayBasis {
    switch (value) {
      case PayBasis.DAILY:
        return 'DAILY';

      case PayBasis.MONTHLY:
        return 'MONTHLY';
    }

    throw new Error(`Unsupported pay basis: ${String(value)}`);
  }

  private toPayoutMethod(value: PayoutMethod): PayrollEnginePayoutMethod {
    switch (value) {
      case PayoutMethod.CASH:
        return 'CASH';

      case PayoutMethod.ATM:
        return 'ATM';
    }

    throw new Error(`Unsupported payout method: ${String(value)}`);
  }

  private toRecurringItemKind(
    value: RecurringPayrollItemKind,
  ): PayrollEngineRecurringItemKind {
    switch (value) {
      case RecurringPayrollItemKind.ALLOWANCE:
        return 'ALLOWANCE';

      case RecurringPayrollItemKind.FIXED_DEDUCTION:
        return 'FIXED_DEDUCTION';
    }

    throw new Error(
      `Unsupported recurring payroll item kind: ${String(value)}`,
    );
  }

  private toAdjustmentType(
    value: PayrollAdjustmentType,
  ): PayrollEngineAdjustmentType {
    switch (value) {
      case PayrollAdjustmentType.EARNING:
        return 'EARNING';

      case PayrollAdjustmentType.DEDUCTION:
        return 'DEDUCTION';
    }

    throw new Error(`Unsupported payroll adjustment type: ${String(value)}`);
  }

  private requireJsonObject(
    value: Prisma.JsonValue,
    fieldName: string,
  ): Readonly<Record<string, unknown>> {
    if (value === null || Array.isArray(value) || typeof value !== 'object') {
      throw new BadRequestException(`${fieldName} must be a JSON object.`);
    }

    return value;
  }

  private optionalJsonObject(
    value: Prisma.JsonValue | null,
    fieldName: string,
  ): Readonly<Record<string, unknown>> | null {
    if (value === null) {
      return null;
    }

    return this.requireJsonObject(value, fieldName);
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
