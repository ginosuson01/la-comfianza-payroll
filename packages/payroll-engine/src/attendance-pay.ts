import {
  MONEY_SCALE,
  RATE_SCALE,
  divideRoundHalfUp,
  formatMoney,
  parseRate,
  rescaleFixedDecimal,
} from './fixed-decimal.ts';

import {
  validatePayrollCalculationInput,
  type PayrollCalculationInput,
  type PayrollComputedLineItem,
} from './payroll-calculation.ts';

export type LeavePayTreatment =
  | 'PAID'
  | 'UNPAID';

export interface AttendanceFinancialOptions {
  /*
   * Required for MONTHLY employees when the cutoff contains
   * late, undertime, absence, or leave minutes.
   *
   * This must come from an approved company payroll rule.
   * The engine does not derive a monthly daily rate itself.
   */
  monthlyAttendanceDailyRate?: string;

  /*
   * Leave treatment is keyed by the stable LeaveType id.
   */
  leaveTreatmentByLeaveTypeId?: Readonly<
    Record<string, LeavePayTreatment>
  >;
}

export interface UnresolvedLeavePayTreatment {
  leaveTypeId: string;

  code: string;
  name: string;

  minutes: number;
}

export interface AttendanceFinancialResult {
  lateReferenceAmount: string;

  undertimeReferenceAmount: string;

  absenceReferenceAmount: string;

  leaveReferenceAmount: string;

  attendanceDeductionTotal: string;

  paidLeaveEarningsTotal: string;

  attendanceReductionAlreadyReflectedInBasicPay: boolean;

  unresolvedLeaveTreatments:
    readonly UnresolvedLeavePayTreatment[];

  lineItems:
    readonly PayrollComputedLineItem[];
}

export function calculateAttendanceFinancials(
  input: PayrollCalculationInput,
  options: AttendanceFinancialOptions = {},
): AttendanceFinancialResult {
  validatePayrollCalculationInput(input);

  const financialDailyRate =
    resolveAttendanceDailyRate(
      input,
      options,
    );

  const lateReferenceAmount =
    valueMinutes(
      financialDailyRate,
      input.attendance.lateMinutes,
      input.config.standardWorkMinutesPerDay,
    );

  const undertimeReferenceAmount =
    valueMinutes(
      financialDailyRate,
      input.attendance.undertimeMinutes,
      input.config.standardWorkMinutesPerDay,
    );

  const absenceReferenceAmount =
    valueMinutes(
      financialDailyRate,
      input.attendance.absenceMinutes,
      input.config.standardWorkMinutesPerDay,
    );

  let leaveReferenceAmount = 0n;

  let attendanceDeductionTotal = 0n;

  let paidLeaveEarningsTotal = 0n;

  const unresolvedLeaveTreatments:
    UnresolvedLeavePayTreatment[] = [];

  const lineItems: PayrollComputedLineItem[] = [];

  if (input.payBasis === 'MONTHLY') {
    addMonthlyAttendanceDeduction(
      lineItems,
      'LATE',
      'Late Deduction',
      input.attendance.lateMinutes,
      lateReferenceAmount,
    );

    addMonthlyAttendanceDeduction(
      lineItems,
      'UNDERTIME',
      'Undertime Deduction',
      input.attendance.undertimeMinutes,
      undertimeReferenceAmount,
    );

    addMonthlyAttendanceDeduction(
      lineItems,
      'ABSENCE',
      'Absence Deduction',
      input.attendance.absenceMinutes,
      absenceReferenceAmount,
    );

    attendanceDeductionTotal +=
      lateReferenceAmount +
      undertimeReferenceAmount +
      absenceReferenceAmount;
  }

  for (
    const leave of input.attendance.leaveBreakdown
  ) {
    const amount =
      valueMinutes(
        financialDailyRate,
        leave.minutes,
        input.config.standardWorkMinutesPerDay,
      );

    leaveReferenceAmount += amount;

    const treatment =
      options.leaveTreatmentByLeaveTypeId?.[
        leave.leaveTypeId
      ];

    if (!treatment) {
      unresolvedLeaveTreatments.push({
        leaveTypeId:
          leave.leaveTypeId,

        code:
          leave.code,

        name:
          leave.name,

        minutes:
          leave.minutes,
      });

      continue;
    }

    if (
      input.payBasis === 'DAILY' &&
      treatment === 'PAID'
    ) {
      paidLeaveEarningsTotal += amount;

      lineItems.push({
        category:
          'EARNING',

        code:
          `PAID_LEAVE_${leave.code}`,

        description:
          `${leave.name} - Paid Leave`,

        quantity:
          String(leave.minutes),

        rate:
          null,

        amount:
          formatMoney(amount),

        taxable:
          null,

        metadata: {
          source:
            'ATTENDANCE_LEAVE',

          leaveTypeId:
            leave.leaveTypeId,

          leaveCode:
            leave.code,

          leavePayTreatment:
            treatment,

          leaveMinutes:
            leave.minutes,

          payBasis:
            input.payBasis,
        },
      });

      continue;
    }

    if (
      input.payBasis === 'MONTHLY' &&
      treatment === 'UNPAID'
    ) {
      attendanceDeductionTotal += amount;

      lineItems.push({
        category:
          'DEDUCTION',

        code:
          `UNPAID_LEAVE_${leave.code}`,

        description:
          `${leave.name} - Unpaid Leave`,

        quantity:
          String(leave.minutes),

        rate:
          null,

        amount:
          formatMoney(amount),

        taxable:
          null,

        metadata: {
          source:
            'ATTENDANCE_LEAVE',

          leaveTypeId:
            leave.leaveTypeId,

          leaveCode:
            leave.code,

          leavePayTreatment:
            treatment,

          leaveMinutes:
            leave.minutes,

          payBasis:
            input.payBasis,
        },
      });
    }
  }

  return {
    lateReferenceAmount:
      formatMoney(
        lateReferenceAmount,
      ),

    undertimeReferenceAmount:
      formatMoney(
        undertimeReferenceAmount,
      ),

    absenceReferenceAmount:
      formatMoney(
        absenceReferenceAmount,
      ),

    leaveReferenceAmount:
      formatMoney(
        leaveReferenceAmount,
      ),

    attendanceDeductionTotal:
      formatMoney(
        attendanceDeductionTotal,
      ),

    paidLeaveEarningsTotal:
      formatMoney(
        paidLeaveEarningsTotal,
      ),

    attendanceReductionAlreadyReflectedInBasicPay:
      input.payBasis === 'DAILY',

    unresolvedLeaveTreatments,

    lineItems,
  };
}

function resolveAttendanceDailyRate(
  input: PayrollCalculationInput,
  options: AttendanceFinancialOptions,
): bigint {
  if (input.payBasis === 'DAILY') {
    return parseRate(input.baseRate);
  }

  const unavailableMinutes =
    input.attendance.lateMinutes +
    input.attendance.undertimeMinutes +
    input.attendance.absenceMinutes +
    input.attendance.leaveMinutes;

  if (
    unavailableMinutes === 0 &&
    options.monthlyAttendanceDailyRate ===
      undefined
  ) {
    return 0n;
  }

  if (
    options.monthlyAttendanceDailyRate ===
    undefined
  ) {
    throw new Error(
      'Monthly attendance deductions require an approved configured attendance daily rate.',
    );
  }

  const dailyRate =
    parseRate(
      options.monthlyAttendanceDailyRate,
    );

  if (dailyRate <= 0n) {
    throw new Error(
      'Monthly attendance daily rate must be greater than zero.',
    );
  }

  return dailyRate;
}

function valueMinutes(
  dailyRate: bigint,
  minutes: number,
  standardWorkMinutesPerDay: number,
): bigint {
  if (minutes === 0) {
    return 0n;
  }

  const amountAtRateScale =
    divideRoundHalfUp(
      dailyRate * BigInt(minutes),
      BigInt(
        standardWorkMinutesPerDay,
      ),
    );

  return rescaleFixedDecimal(
    amountAtRateScale,
    RATE_SCALE,
    MONEY_SCALE,
  );
}

function addMonthlyAttendanceDeduction(
  lineItems: PayrollComputedLineItem[],
  code: string,
  description: string,
  minutes: number,
  amount: bigint,
): void {
  if (minutes === 0) {
    return;
  }

  lineItems.push({
    category:
      'DEDUCTION',

    code:
      `ATTENDANCE_${code}`,

    description,

    quantity:
      String(minutes),

    rate:
      null,

    amount:
      formatMoney(amount),

    taxable:
      null,

    metadata: {
      source:
        'ATTENDANCE',

      attendanceType:
        code,

      minutes,

      payBasis:
        'MONTHLY',
    },
  });
}
