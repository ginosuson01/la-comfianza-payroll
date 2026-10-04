import {
  MONEY_SCALE,
  RATE_SCALE,
  divideFixedDecimals,
  divideRoundHalfUp,
  formatFixedDecimal,
  formatMoney,
  formatRate,
  parseMoney,
  parseRate,
  rescaleFixedDecimal,
} from './fixed-decimal.ts';

import {
  validatePayrollCalculationInput,
  type PayrollCalculationInput,
  type PayrollComputedLineItem,
} from './payroll-calculation.ts';

export type BasicPayCalculationMode =
  | 'DAILY_BY_REGULAR_MINUTES'
  | 'MONTHLY_CONFIGURED_CUTOFF_AMOUNT';

export interface BasicPayCalculationOptions {
  /*
   * Required only for MONTHLY employees.
   *
   * This is deliberately supplied as an engine input instead
   * of assuming how a monthly salary is allocated to a cutoff.
   *
   * The API/configuration layer will provide this value once
   * the approved company payroll rule is implemented.
   */
  monthlyCutoffBaseAmount?: string;
}

export interface BasicPayResult {
  basicPay: string;

  equivalentRegularDays: string;

  calculationMode: BasicPayCalculationMode;

  attendanceReductionAlreadyReflected: boolean;

  lineItems: readonly PayrollComputedLineItem[];
}

export function calculateBasicPay(
  input: PayrollCalculationInput,
  options: BasicPayCalculationOptions = {},
): BasicPayResult {
  validatePayrollCalculationInput(input);

  if (input.payBasis === 'DAILY') {
    return calculateDailyBasicPay(input);
  }

  return calculateMonthlyBasicPay(
    input,
    options,
  );
}

function calculateDailyBasicPay(
  input: PayrollCalculationInput,
): BasicPayResult {
  const dailyRate =
    parseRate(input.baseRate);

  const regularMinutes =
    BigInt(input.attendance.regularMinutes);

  const standardWorkMinutesPerDay =
    BigInt(
      input.config.standardWorkMinutesPerDay,
    );

  /*
   * Keep the calculation at the 4-decimal rate scale until
   * the final monetary rounding step.
   *
   * Example:
   *
   * daily rate      600.0000
   * regular minutes 420
   * workday minutes 480
   *
   * 600 × 420 / 480 = 525.00
   */
  const payAtRateScale =
    divideRoundHalfUp(
      dailyRate * regularMinutes,
      standardWorkMinutesPerDay,
    );

  const basicPay =
    rescaleFixedDecimal(
      payAtRateScale,
      RATE_SCALE,
      MONEY_SCALE,
    );

  const equivalentRegularDays =
    divideFixedDecimals(
      regularMinutes,
      0,
      standardWorkMinutesPerDay,
      0,
      RATE_SCALE,
    );

  const lineItem: PayrollComputedLineItem = {
    category: 'EARNING',

    code: 'BASIC_PAY',

    description: 'Basic Pay',

    quantity:
      formatFixedDecimal(
        equivalentRegularDays,
        RATE_SCALE,
      ),

    rate:
      formatRate(dailyRate),

    amount:
      formatMoney(basicPay),

    taxable: null,

    metadata: {
      source:
        'ATTENDANCE_REGULAR_MINUTES',

      payBasis:
        'DAILY',

      regularMinutes:
        input.attendance.regularMinutes,

      standardWorkMinutesPerDay:
        input.config.standardWorkMinutesPerDay,

      lateMinutes:
        input.attendance.lateMinutes,

      undertimeMinutes:
        input.attendance.undertimeMinutes,

      absenceMinutes:
        input.attendance.absenceMinutes,

      leaveMinutes:
        input.attendance.leaveMinutes,

      attendanceReductionAlreadyReflected:
        true,
    },
  };

  return {
    basicPay:
      formatMoney(basicPay),

    equivalentRegularDays:
      formatFixedDecimal(
        equivalentRegularDays,
        RATE_SCALE,
      ),

    calculationMode:
      'DAILY_BY_REGULAR_MINUTES',

    attendanceReductionAlreadyReflected:
      true,

    lineItems: [
      lineItem,
    ],
  };
}

function calculateMonthlyBasicPay(
  input: PayrollCalculationInput,
  options: BasicPayCalculationOptions,
): BasicPayResult {
  if (
    options.monthlyCutoffBaseAmount ===
    undefined
  ) {
    throw new Error(
      'Monthly basic pay requires an approved configured cutoff base amount.',
    );
  }

  const cutoffBaseAmount =
    parseMoney(
      options.monthlyCutoffBaseAmount,
    );

  if (cutoffBaseAmount < 0n) {
    throw new Error(
      'Monthly cutoff base amount must not be negative.',
    );
  }

  const equivalentRegularDays =
    divideFixedDecimals(
      BigInt(
        input.attendance.regularMinutes,
      ),
      0,
      BigInt(
        input.config.standardWorkMinutesPerDay,
      ),
      0,
      RATE_SCALE,
    );

  const lineItem: PayrollComputedLineItem = {
    category: 'EARNING',

    code: 'BASIC_PAY',

    description: 'Basic Pay',

    quantity: '1.0000',

    rate:
      input.baseRate,

    amount:
      formatMoney(cutoffBaseAmount),

    taxable: null,

    metadata: {
      source:
        'CONFIGURED_MONTHLY_CUTOFF_AMOUNT',

      payBasis:
        'MONTHLY',

      monthlyBaseRate:
        input.baseRate,

      regularMinutes:
        input.attendance.regularMinutes,

      standardWorkMinutesPerDay:
        input.config.standardWorkMinutesPerDay,

      /*
       * Monthly attendance deductions must be computed
       * separately after the approved deduction rules
       * are available.
       */
      attendanceReductionAlreadyReflected:
        false,
    },
  };

  return {
    basicPay:
      formatMoney(cutoffBaseAmount),

    equivalentRegularDays:
      formatFixedDecimal(
        equivalentRegularDays,
        RATE_SCALE,
      ),

    calculationMode:
      'MONTHLY_CONFIGURED_CUTOFF_AMOUNT',

    attendanceReductionAlreadyReflected:
      false,

    lineItems: [
      lineItem,
    ],
  };
}
