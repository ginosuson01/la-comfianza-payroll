import {
  calculateAttendanceFinancials,
  type AttendanceFinancialOptions,
} from './attendance-pay.ts';

import {
  calculateBasicPay,
  type BasicPayCalculationOptions,
} from './basic-pay.ts';

import {
  formatMoney,
  parseMoney,
} from './fixed-decimal.ts';

import {
  calculateFixedPayrollComponents,
} from './fixed-payroll-components.ts';

import {
  type PayrollCalculationInput,
  type PayrollComputedLineItem,
} from './payroll-calculation.ts';

import {
  calculatePremiumPay,
  type PremiumPayOptions,
} from './premium-pay.ts';

export type CorePayrollStatus =
  | 'COMPLETE'
  | 'INCOMPLETE';

export type CorePayrollIssueCode =
  | 'MISSING_MONTHLY_CUTOFF_BASE_AMOUNT'
  | 'MISSING_MONTHLY_ATTENDANCE_DAILY_RATE'
  | 'MISSING_MONTHLY_PREMIUM_DAILY_RATE'
  | 'UNRESOLVED_LEAVE_TREATMENT'
  | 'UNRESOLVED_PREMIUM_RULE';

export interface CorePayrollIssue {
  code: CorePayrollIssueCode;

  message: string;

  metadata:
    Readonly<Record<string, unknown>> | null;
}

export interface CorePayrollCalculationOptions {
  basicPay?: BasicPayCalculationOptions;

  attendance?: AttendanceFinancialOptions;

  premium?: PremiumPayOptions;
}

export interface CorePayrollCalculationResult {
  employeeId: string;

  employmentRecordId: string;

  payrollStatus:
    PayrollCalculationInput['payrollStatus'];

  payoutMethod:
    PayrollCalculationInput['payoutMethod'];

  status: CorePayrollStatus;

  issues:
    readonly CorePayrollIssue[];

  basicPay:
    string | null;

  paidLeaveEarningsTotal:
    string | null;

  allowancesTotal:
    string;

  taxableAllowancesTotal:
    string;

  earningAdjustmentsTotal:
    string;

  premiumPayTotal:
    string | null;

  /*
   * Null whenever any unresolved payroll rule could
   * change the resulting earnings/deductions.
   */
  grossPay:
    string | null;

  attendanceDeductionsTotal:
    string | null;

  fixedDeductionsTotal:
    string;

  deductionAdjustmentsTotal:
    string;

  otherDeductionsTotal:
    string | null;

  /*
   * Gross minus known non-government/non-tax deductions.
   *
   * This is NOT final Net Pay.
   * Contributions and tax are implemented in Step 20.3.
   */
  preContributionTaxPay:
    string | null;

  lineItems:
    readonly PayrollComputedLineItem[];
}

const MONTHLY_BASIC_MISSING =
  'Monthly basic pay requires an approved configured cutoff base amount.';

const MONTHLY_ATTENDANCE_RATE_MISSING =
  'Monthly attendance deductions require an approved configured attendance daily rate.';

const MONTHLY_PREMIUM_RATE_MISSING =
  'Monthly premium pay requires an approved configured premium daily rate.';

export function calculateCorePayroll(
  input: PayrollCalculationInput,
  options: CorePayrollCalculationOptions = {},
): CorePayrollCalculationResult {
  const issues: CorePayrollIssue[] = [];

  const lineItems:
    PayrollComputedLineItem[] = [];

  const fixed =
    calculateFixedPayrollComponents(
      input,
    );

  /*
   * Fixed components do not depend on unresolved company
   * formula rules, so they can always be retained.
   */
  lineItems.push(
    ...fixed.lineItems,
  );

  let basicPay:
    string | null = null;

  let paidLeaveEarningsTotal:
    string | null = null;

  let premiumPayTotal:
    string | null = null;

  let attendanceDeductionsTotal:
    string | null = null;

  /*
   * -------------------------------------------------------
   * BASIC PAY
   * -------------------------------------------------------
   */
  try {
    const basic =
      calculateBasicPay(
        input,
        options.basicPay,
      );

    basicPay =
      basic.basicPay;

    lineItems.unshift(
      ...basic.lineItems,
    );
  } catch (error) {
    if (
      hasExactMessage(
        error,
        MONTHLY_BASIC_MISSING,
      )
    ) {
      issues.push({
        code:
          'MISSING_MONTHLY_CUTOFF_BASE_AMOUNT',

        message:
          MONTHLY_BASIC_MISSING,

        metadata: {
          payBasis:
            input.payBasis,

          baseRate:
            input.baseRate,
        },
      });
    } else {
      throw error;
    }
  }

  /*
   * -------------------------------------------------------
   * ATTENDANCE FINANCIAL TREATMENT
   * -------------------------------------------------------
   */
  try {
    const attendance =
      calculateAttendanceFinancials(
        input,
        options.attendance,
      );

    paidLeaveEarningsTotal =
      attendance.paidLeaveEarningsTotal;

    attendanceDeductionsTotal =
      attendance.attendanceDeductionTotal;

    lineItems.push(
      ...attendance.lineItems,
    );

    for (
      const unresolved of
        attendance.unresolvedLeaveTreatments
    ) {
      issues.push({
        code:
          'UNRESOLVED_LEAVE_TREATMENT',

        message:
          `Leave pay treatment is not configured for ${unresolved.code} - ${unresolved.name}.`,

        metadata: {
          leaveTypeId:
            unresolved.leaveTypeId,

          leaveCode:
            unresolved.code,

          leaveName:
            unresolved.name,

          minutes:
            unresolved.minutes,
        },
      });
    }
  } catch (error) {
    if (
      hasExactMessage(
        error,
        MONTHLY_ATTENDANCE_RATE_MISSING,
      )
    ) {
      issues.push({
        code:
          'MISSING_MONTHLY_ATTENDANCE_DAILY_RATE',

        message:
          MONTHLY_ATTENDANCE_RATE_MISSING,

        metadata: {
          payBasis:
            input.payBasis,

          lateMinutes:
            input.attendance.lateMinutes,

          undertimeMinutes:
            input.attendance.undertimeMinutes,

          absenceMinutes:
            input.attendance.absenceMinutes,

          leaveMinutes:
            input.attendance.leaveMinutes,
        },
      });
    } else {
      throw error;
    }
  }

  /*
   * -------------------------------------------------------
   * OT / REST DAY / HOLIDAY / ND
   * -------------------------------------------------------
   */
  try {
    const premium =
      calculatePremiumPay(
        input,
        options.premium,
      );

    premiumPayTotal =
      premium.premiumPayTotal;

    lineItems.push(
      ...premium.lineItems,
    );

    for (
      const unresolved of
        premium.unresolvedRules
    ) {
      issues.push({
        code:
          'UNRESOLVED_PREMIUM_RULE',

        message:
          `Premium payroll rule is unresolved for ${unresolved.kind} ${unresolved.key}.`,

        metadata: {
          kind:
            unresolved.kind,

          key:
            unresolved.key,

          minutes:
            unresolved.minutes,

          reason:
            unresolved.reason,
        },
      });
    }
  } catch (error) {
    if (
      hasExactMessage(
        error,
        MONTHLY_PREMIUM_RATE_MISSING,
      )
    ) {
      issues.push({
        code:
          'MISSING_MONTHLY_PREMIUM_DAILY_RATE',

        message:
          MONTHLY_PREMIUM_RATE_MISSING,

        metadata: {
          payBasis:
            input.payBasis,

          regularMinutes:
            input.attendance.regularMinutes,

          overtimeMinutes:
            input.attendance.overtimeMinutes,

          nightDifferentialMinutes:
            input.attendance.nightDifferentialMinutes,
        },
      });
    } else {
      throw error;
    }
  }

  /*
   * Any unresolved rule means aggregate payroll totals
   * must not be represented as final/complete.
   *
   * We still expose safely known component values for
   * review and troubleshooting.
   */
  const complete =
    issues.length === 0 &&
    basicPay !== null &&
    paidLeaveEarningsTotal !== null &&
    premiumPayTotal !== null &&
    attendanceDeductionsTotal !== null;

  let grossPay:
    string | null = null;

  let otherDeductionsTotal:
    string | null = null;

  let preContributionTaxPay:
    string | null = null;

  if (
    complete &&
    basicPay !== null &&
    paidLeaveEarningsTotal !== null &&
    premiumPayTotal !== null &&
    attendanceDeductionsTotal !== null
  ) {
    const gross =
      parseMoney(
        basicPay,
      ) +
      parseMoney(
        paidLeaveEarningsTotal,
      ) +
      parseMoney(
        fixed.allowancesTotal,
      ) +
      parseMoney(
        fixed.earningAdjustmentsTotal,
      ) +
      parseMoney(
        premiumPayTotal,
      );

    const otherDeductions =
      parseMoney(
        attendanceDeductionsTotal,
      ) +
      parseMoney(
        fixed.fixedDeductionsTotal,
      ) +
      parseMoney(
        fixed.deductionAdjustmentsTotal,
      );

    grossPay =
      formatMoney(gross);

    otherDeductionsTotal =
      formatMoney(
        otherDeductions,
      );

    preContributionTaxPay =
      formatMoney(
        gross -
        otherDeductions,
      );
  }

  return {
    employeeId:
      input.employeeId,

    employmentRecordId:
      input.employmentRecordId,

    payrollStatus:
      input.payrollStatus,

    payoutMethod:
      input.payoutMethod,

    status:
      complete
        ? 'COMPLETE'
        : 'INCOMPLETE',

    issues,

    basicPay,

    paidLeaveEarningsTotal,

    allowancesTotal:
      fixed.allowancesTotal,

    taxableAllowancesTotal:
      fixed.taxableAllowancesTotal,

    earningAdjustmentsTotal:
      fixed.earningAdjustmentsTotal,

    premiumPayTotal,

    grossPay,

    attendanceDeductionsTotal,

    fixedDeductionsTotal:
      fixed.fixedDeductionsTotal,

    deductionAdjustmentsTotal:
      fixed.deductionAdjustmentsTotal,

    otherDeductionsTotal,

    preContributionTaxPay,

    lineItems,
  };
}

function hasExactMessage(
  error: unknown,
  message: string,
): boolean {
  return (
    error instanceof Error &&
    error.message === message
  );
}
