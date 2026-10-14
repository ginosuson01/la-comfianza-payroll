import {
  MONEY_SCALE,
  RATE_SCALE,
  divideRoundHalfUp,
  formatMoney,
  formatRate,
  multiplyFixedDecimals,
  parseMoney,
  parseRate,
  rescaleFixedDecimal,
} from './fixed-decimal.ts';

import type {
  PremiumPayOptions,
} from './premium-pay.ts';

import {
  calculateWithholdingTax,
  type ProgressiveWithholdingTaxRule,
  type WithholdingTaxResult,
} from './withholding-tax.ts';

/*
 * ============================================================
 * PHILIPPINE PAYROLL RULESET
 * ============================================================
 *
 * This module contains approved statutory/client calculation
 * rules used by the La Comfianza / MT payroll implementation.
 *
 * Rules which still require a client business-policy decision
 * are NOT guessed. They are explicitly marked UNRESOLVED.
 */

export const PHILIPPINE_PAYROLL_RULESET_VERSION =
  'PH-2026-09-19';

export const PHILIPPINE_PAYROLL_RULE_EFFECTIVE_DATES = {
  sss: '2025-01-01',
  philHealth: '2025-01-01',
  pagIbig: '2024-02-01',
  withholdingTax: '2023-01-01',
} as const;

/*
 * ============================================================
 * PARKED BUSINESS-POLICY DECISIONS
 * ============================================================
 */

export type SemiMonthlyCutoffPosition =
  | 'FIRST'
  | 'SECOND';

export type PhilippineGovernmentContributionCode =
  | 'SSS'
  | 'PHILHEALTH'
  | 'PAGIBIG';

export const PAYROLL_BUSINESS_POLICIES = {
  /*
   * Semi-monthly payroll:
   *
   * FIRST  = day 1 through day 15
   * SECOND = day 16 through LAST_DAY
   */
  governmentContributionCutoffAllocation: {
    FIRST: [
      'PHILHEALTH',
      'PAGIBIG',
    ],

    SECOND: [
      'SSS',
    ],
  },

  leaveCalendar: {
    internalEligibilityMonths: 6,
    internalAnnualPaidLeaveDays: 10,

    internalBalanceMode:
      'SEPARATE_VL_SL',

    internalVacationLeaveDays: 5,
    internalSickLeaveDays: 5,

    clientEligibilityMonths: 12,
    clientAnnualPaidLeaveDays: 5,

    clientBalanceMode:
      'SHARED_VL_SL_POOL',

    clientSharedVlSlPoolDays: 5,

    grantMode:
      'FULL_ON_ELIGIBILITY',

    reset:
      'JANUARY_1',

    carryOver: false,

    unusedBalanceTreatment:
      'EXPIRE',
  },

  resignationActiveHold: {
    /*
     * One complete cutoff is held while exit
     * clearance is pending.
     */
    holdCutoffs: 1,

    holdPercent:
      '1.0000',

    releaseCondition:
      'EXIT_CLEARANCE_APPROVED',

    finalPayIncludes: [
      'HELD_CUTOFF',
      'PRORATED_13TH_MONTH',
    ],

    finalPayDeductions: [
      'APPROVED_CHARGES',
      'GOVERNMENT_CONTRIBUTIONS',
      'WITHHOLDING_TAX',
    ],
  },

  governmentLoanDeduction: {
    /*
     * One monthly agency amortization is split
     * between the two semi-monthly cutoffs.
     */
    semiMonthlyMode:
      'SPLIT_MONTHLY_AMORTIZATION',

    firstCutoffShare:
      'HALF_ROUND_HALF_UP',

    secondCutoffShare:
      'REMAINDER',
  },
} as const;

export function getSemiMonthlyGovernmentContributionCodes(
  cutoffPosition:
    SemiMonthlyCutoffPosition,
): readonly PhilippineGovernmentContributionCode[] {
  return PAYROLL_BUSINESS_POLICIES
    .governmentContributionCutoffAllocation[
      cutoffPosition
    ];
}

/*
 * ============================================================
 * DAILY RATE / MINUTE VALUATION
 * ============================================================
 */

export interface DailyMinuteValueInput {
  dailyRate: string;
  minutes: number;
  standardWorkMinutesPerDay: number;
}

export function calculateDailyMinuteValue(
  input: DailyMinuteValueInput,
): string {
  if (
    !Number.isInteger(input.minutes) ||
    input.minutes < 0
  ) {
    throw new Error(
      'Minutes must be a non-negative whole number.',
    );
  }

  if (
    !Number.isInteger(
      input.standardWorkMinutesPerDay,
    ) ||
    input.standardWorkMinutesPerDay <= 0
  ) {
    throw new Error(
      'Standard work minutes per day must be a positive integer.',
    );
  }

  const dailyRate =
    parseRate(input.dailyRate);

  if (dailyRate < 0n) {
    throw new Error(
      'Daily rate must not be negative.',
    );
  }

  const valueAtRateScale =
    divideRoundHalfUp(
      dailyRate * BigInt(input.minutes),
      BigInt(input.standardWorkMinutesPerDay),
    );

  return formatMoney(
    rescaleFixedDecimal(
      valueAtRateScale,
      RATE_SCALE,
      MONEY_SCALE,
    ),
  );
}

/*
 * Late and undertime both use:
 *
 * daily rate / standard work minutes × minutes
 *
 * With an 8-hour / 480-minute day:
 * daily rate / 8 / 60 × affected minutes.
 */
export const calculateLateDeductionReference =
  calculateDailyMinuteValue;

export const calculateUndertimeDeductionReference =
  calculateDailyMinuteValue;

export const calculateAbsenceReference =
  calculateDailyMinuteValue;

/*
 * ============================================================
 * PHILIPPINE PREMIUM / OT RULES
 * ============================================================
 *
 * DAILY basic pay already contains regular worked minutes.
 * TOTAL multipliers therefore allow the existing premium engine
 * to add only the premium portion for regular work.
 */

export const PHILIPPINE_DAILY_PREMIUM_OPTIONS:
  Readonly<PremiumPayOptions> = {
    regularWorkRules: {
      /*
       * Rest day - first 8 hours:
       * 130% total.
       */
      'REST_DAY|NO_HOLIDAY': {
        multiplier: '1.3000',
        semantics: 'TOTAL',
      },

      /*
       * Special non-working day:
       * 130% total.
       */
      'WORKDAY|SPECIAL_NON_WORKING': {
        multiplier: '1.3000',
        semantics: 'TOTAL',
      },

      /*
       * Special non-working day falling on rest day:
       * 150% total.
       */
      'REST_DAY|SPECIAL_NON_WORKING': {
        multiplier: '1.5000',
        semantics: 'TOTAL',
      },

      /*
       * Regular holiday:
       * 200% total.
       */
      'WORKDAY|REGULAR': {
        multiplier: '2.0000',
        semantics: 'TOTAL',
      },

      /*
       * Regular holiday falling on rest day:
       * 260% total.
       */
      'REST_DAY|REGULAR': {
        multiplier: '2.6000',
        semantics: 'TOTAL',
      },

      /*
       * Special working day is treated as an ordinary
       * workday unless it is also the employee's rest day.
       */
      'WORKDAY|SPECIAL_WORKING': {
        multiplier: '1.0000',
        semantics: 'TOTAL',
      },

      'REST_DAY|SPECIAL_WORKING': {
        multiplier: '1.3000',
        semantics: 'TOTAL',
      },
    },

    overtimeRules: {
      /*
       * Ordinary day OT:
       * 125%.
       */
      REGULAR: {
        multiplier: '1.2500',
        semantics: 'TOTAL',
      },

      /*
       * Rest day OT:
       * 130% × 130% = 169%.
       */
      REST_DAY: {
        multiplier: '1.6900',
        semantics: 'TOTAL',
      },

      /*
       * Special non-working day OT:
       * 130% × 130% = 169%.
       */
      SPECIAL_HOLIDAY: {
        multiplier: '1.6900',
        semantics: 'TOTAL',
      },

      /*
       * Regular holiday OT:
       * 200% × 130% = 260%.
       */
      REGULAR_HOLIDAY: {
        multiplier: '2.6000',
        semantics: 'TOTAL',
      },

      /*
       * Rest day + special non-working day OT:
       * 150% × 130% = 195%.
       */
      REST_DAY_SPECIAL_HOLIDAY: {
        multiplier: '1.9500',
        semantics: 'TOTAL',
      },

      /*
       * Rest day + regular holiday OT:
       * 260% × 130% = 338%.
       */
      REST_DAY_REGULAR_HOLIDAY: {
        multiplier: '3.3800',
        semantics: 'TOTAL',
      },
    },

    /*
     * IMPORTANT:
     *
     * Do not set the generic nightDifferentialRule here.
     *
     * Philippine ND is 10% of the APPLICABLE hourly rate.
     * Example: rest-day ND uses 130% × 10%, not simply
     * base hourly rate × 10%.
     *
     * The current DTR field contains one combined ND minute
     * count and does not yet identify how many ND minutes
     * overlap regular work versus OT.
     *
     * The dedicated calculation below is correct once the
     * applicable work multiplier is known. DTR classification
     * wiring will be updated in the next implementation block.
     */
  };

export const PHILIPPINE_NIGHT_DIFFERENTIAL_RATE =
  '0.1000';

export interface PhilippineNightDifferentialInput {
  dailyRate: string;

  nightDifferentialMinutes: number;

  standardWorkMinutesPerDay: number;

  /*
   * Applicable underlying wage multiplier:
   *
   * ordinary day                 1.0000
   * rest day                     1.3000
   * special holiday             1.3000
   * special holiday + rest      1.5000
   * regular holiday             2.0000
   * regular holiday + rest      2.6000
   * ordinary OT                 1.2500
   * etc.
   */
  applicableBaseMultiplier: string;
}

export function calculatePhilippineNightDifferential(
  input: PhilippineNightDifferentialInput,
): string {
  if (
    !Number.isInteger(
      input.nightDifferentialMinutes,
    ) ||
    input.nightDifferentialMinutes < 0
  ) {
    throw new Error(
      'Night differential minutes must be a non-negative whole number.',
    );
  }

  if (
    !Number.isInteger(
      input.standardWorkMinutesPerDay,
    ) ||
    input.standardWorkMinutesPerDay <= 0
  ) {
    throw new Error(
      'Standard work minutes per day must be a positive integer.',
    );
  }

  const dailyRate =
    parseRate(input.dailyRate);

  const applicableBaseMultiplier =
    parseRate(
      input.applicableBaseMultiplier,
    );

  const nightDifferentialRate =
    parseRate(
      PHILIPPINE_NIGHT_DIFFERENTIAL_RATE,
    );

  if (
    dailyRate < 0n ||
    applicableBaseMultiplier < 0n
  ) {
    throw new Error(
      'Night differential inputs must not be negative.',
    );
  }

  const rateFactor =
    10n ** BigInt(RATE_SCALE);

  const combinedMultiplier =
    divideRoundHalfUp(
      applicableBaseMultiplier *
        nightDifferentialRate,
      rateFactor,
    );

  const amountAtRateScale =
    divideRoundHalfUp(
      dailyRate *
        BigInt(
          input.nightDifferentialMinutes,
        ) *
        combinedMultiplier,

      BigInt(
        input.standardWorkMinutesPerDay,
      ) *
        rateFactor,
    );

  return formatMoney(
    rescaleFixedDecimal(
      amountAtRateScale,
      RATE_SCALE,
      MONEY_SCALE,
    ),
  );
}

/*
 * ============================================================
 * SSS — EFFECTIVE JANUARY 2025
 * ============================================================
 */

export interface SssContributionRule {
  minimumMsc: string;

  maximumMsc: string;

  mscStep: string;

  mscMidpoint: string;

  /*
   * These fields are already part of the frozen Golden-derived
   * statutory configuration.
   *
   * The current aggregate contribution result intentionally
   * preserves the existing Step 20 behavior: employeeShare and
   * employerSocialSecurityShare remain aggregate SSS shares.
   *
   * A later reporting refinement may expose Regular SS and MPF
   * components separately without changing the frozen rule source.
   */
  regularSocialSecurityMaximumMsc: string;

  employeeRate: string;

  employerRate: string;

  mandatoryProvidentFund: {
    startsAboveMsc: string;

    employeeRate: string;

    employerRate: string;
  };

  employeesCompensation: {
    thresholdMsc: string;

    atOrBelowThresholdAmount: string;

    aboveThresholdAmount: string;
  };
}

export interface SssContributionResult {
  monthlyCompensation: string;

  monthlySalaryCredit: string;

  employeeShare: string;

  employerSocialSecurityShare: string;

  employerEmployeesCompensationShare: string;

  employerTotal: string;

  totalContribution: string;
}

export function calculateSssContribution(
  monthlyCompensation: string,
  rule: SssContributionRule,
): SssContributionResult {
  const compensation =
    requireNonNegativeMoney(
      monthlyCompensation,
      'SSS monthly compensation',
    );

  const minimumMsc =
    requireNonNegativeMoney(
      rule.minimumMsc,
      'SSS minimum MSC',
    );

  const maximumMsc =
    requireNonNegativeMoney(
      rule.maximumMsc,
      'SSS maximum MSC',
    );

  const step =
    requireNonNegativeMoney(
      rule.mscStep,
      'SSS MSC step',
    );

  const midpoint =
    requireNonNegativeMoney(
      rule.mscMidpoint,
      'SSS MSC midpoint',
    );

  if (step <= 0n) {
    throw new Error(
      'SSS MSC step must be greater than zero.',
    );
  }

  if (minimumMsc > maximumMsc) {
    throw new Error(
      'SSS minimum MSC must not exceed maximum MSC.',
    );
  }

  /*
   * Validate the already-frozen Regular SS / MPF rule data even
   * though the current aggregate result does not yet expose the
   * two components separately.
   */
  requireNonNegativeMoney(
    rule.regularSocialSecurityMaximumMsc,
    'SSS regular Social Security maximum MSC',
  );

  requireNonNegativeMoney(
    rule.mandatoryProvidentFund.startsAboveMsc,
    'SSS MPF starting MSC',
  );

  requireNonNegativeRate(
    rule.mandatoryProvidentFund.employeeRate,
    'SSS MPF employee rate',
  );

  requireNonNegativeRate(
    rule.mandatoryProvidentFund.employerRate,
    'SSS MPF employer rate',
  );

  let msc =
    ((compensation + midpoint) /
      step) *
    step;

  if (msc < minimumMsc) {
    msc = minimumMsc;
  }

  if (msc > maximumMsc) {
    msc = maximumMsc;
  }

  const employeeRate =
    requireNonNegativeRate(
      rule.employeeRate,
      'SSS employee rate',
    );

  const employerRate =
    requireNonNegativeRate(
      rule.employerRate,
      'SSS employer rate',
    );

  const employeeShare =
    multiplyFixedDecimals(
      msc,
      MONEY_SCALE,
      employeeRate,
      RATE_SCALE,
      MONEY_SCALE,
    );

  const employerSocialSecurityShare =
    multiplyFixedDecimals(
      msc,
      MONEY_SCALE,
      employerRate,
      RATE_SCALE,
      MONEY_SCALE,
    );

  const ecThreshold =
    requireNonNegativeMoney(
      rule.employeesCompensation.thresholdMsc,
      'SSS EC threshold MSC',
    );

  const ecAtOrBelow =
    requireNonNegativeMoney(
      rule.employeesCompensation.atOrBelowThresholdAmount,
      'SSS EC amount at or below threshold',
    );

  const ecAbove =
    requireNonNegativeMoney(
      rule.employeesCompensation.aboveThresholdAmount,
      'SSS EC amount above threshold',
    );

  const employerEmployeesCompensationShare =
    msc <= ecThreshold
      ? ecAtOrBelow
      : ecAbove;

  const employerTotal =
    employerSocialSecurityShare +
    employerEmployeesCompensationShare;

  return {
    monthlyCompensation:
      formatMoney(compensation),

    monthlySalaryCredit:
      formatMoney(msc),

    employeeShare:
      formatMoney(employeeShare),

    employerSocialSecurityShare:
      formatMoney(
        employerSocialSecurityShare,
      ),

    employerEmployeesCompensationShare:
      formatMoney(
        employerEmployeesCompensationShare,
      ),

    employerTotal:
      formatMoney(employerTotal),

    totalContribution:
      formatMoney(
        employeeShare +
          employerTotal,
      ),
  };
}

/*
 * ============================================================
 * PHILHEALTH
 * ============================================================
 */

export interface PhilHealthContributionRule {
  salaryFloor: string;

  salaryCeiling: string;

  premiumRate: string;

  employeeShareRate: string;

  employerShareRate: string;

  oddCentavoRecipient:
    | 'EMPLOYEE'
    | 'EMPLOYER';
}

export interface PhilHealthContributionResult {
  monthlyBasicSalary: string;

  contributionBasis: string;

  premiumRate: string;

  totalPremium: string;

  employeeShare: string;

  employerShare: string;
}

export function calculatePhilHealthContribution(
  monthlyBasicSalary: string,
  rule: PhilHealthContributionRule,
): PhilHealthContributionResult {
  const salary =
    requireNonNegativeMoney(
      monthlyBasicSalary,
      'PhilHealth monthly basic salary',
    );

  const floor =
    requireNonNegativeMoney(
      rule.salaryFloor,
      'PhilHealth salary floor',
    );

  const ceiling =
    requireNonNegativeMoney(
      rule.salaryCeiling,
      'PhilHealth salary ceiling',
    );

  if (floor > ceiling) {
    throw new Error(
      'PhilHealth salary floor must not exceed salary ceiling.',
    );
  }

  const premiumRate =
    requireNonNegativeRate(
      rule.premiumRate,
      'PhilHealth premium rate',
    );

  const employeeShareRate =
    requireNonNegativeRate(
      rule.employeeShareRate,
      'PhilHealth employee share rate',
    );

  const employerShareRate =
    requireNonNegativeRate(
      rule.employerShareRate,
      'PhilHealth employer share rate',
    );

  const oneRate =
    10n ** BigInt(RATE_SCALE);

  if (
    employeeShareRate +
      employerShareRate !==
    oneRate
  ) {
    throw new Error(
      'PhilHealth employee and employer share rates must total 1.0000.',
    );
  }

  const basis =
    salary < floor
      ? floor
      : salary > ceiling
        ? ceiling
        : salary;

  const totalPremium =
    multiplyFixedDecimals(
      basis,
      MONEY_SCALE,
      premiumRate,
      RATE_SCALE,
      MONEY_SCALE,
    );

  /*
   * Allocate the indivisible centavo to the configured recipient.
   *
   * For the current Philippine rule the employer receives the
   * excess centavo, preserving the existing calculation behavior.
   */
  let employeeShare: bigint;
  let employerShare: bigint;

  if (
    rule.oddCentavoRecipient ===
    'EMPLOYER'
  ) {
    employeeShare =
      (totalPremium *
        employeeShareRate) /
      oneRate;

    employerShare =
      totalPremium -
      employeeShare;
  } else {
    employerShare =
      (totalPremium *
        employerShareRate) /
      oneRate;

    employeeShare =
      totalPremium -
      employerShare;
  }

  return {
    monthlyBasicSalary:
      formatMoney(salary),

    contributionBasis:
      formatMoney(basis),

    premiumRate:
      formatRate(premiumRate),

    totalPremium:
      formatMoney(totalPremium),

    employeeShare:
      formatMoney(employeeShare),

    employerShare:
      formatMoney(employerShare),
  };
}

/*
 * ============================================================
 * PAG-IBIG / HDMF
 * ============================================================
 */

export interface PagIbigContributionRule {
  maximumFundSalary: string;

  employeeRateThreshold: string;

  lowerEmployeeRate: string;

  upperEmployeeRate: string;

  employerRate: string;
}

export interface PagIbigContributionResult {
  monthlyCompensation: string;

  monthlyFundSalary: string;

  employeeRate: string;

  employerRate: string;

  employeeShare: string;

  employerShare: string;

  totalContribution: string;
}

export function calculatePagIbigContribution(
  monthlyCompensation: string,
  rule: PagIbigContributionRule,
): PagIbigContributionResult {
  const compensation =
    requireNonNegativeMoney(
      monthlyCompensation,
      'Pag-IBIG monthly compensation',
    );

  const maximumFundSalary =
    requireNonNegativeMoney(
      rule.maximumFundSalary,
      'Pag-IBIG maximum fund salary',
    );

  const employeeRateThreshold =
    requireNonNegativeMoney(
      rule.employeeRateThreshold,
      'Pag-IBIG employee rate threshold',
    );

  const lowerEmployeeRate =
    requireNonNegativeRate(
      rule.lowerEmployeeRate,
      'Pag-IBIG lower employee rate',
    );

  const upperEmployeeRate =
    requireNonNegativeRate(
      rule.upperEmployeeRate,
      'Pag-IBIG upper employee rate',
    );

  const employerRate =
    requireNonNegativeRate(
      rule.employerRate,
      'Pag-IBIG employer rate',
    );

  const fundSalary =
    compensation > maximumFundSalary
      ? maximumFundSalary
      : compensation;

  const employeeRate =
    compensation <= employeeRateThreshold
      ? lowerEmployeeRate
      : upperEmployeeRate;

  const employeeShare =
    multiplyFixedDecimals(
      fundSalary,
      MONEY_SCALE,
      employeeRate,
      RATE_SCALE,
      MONEY_SCALE,
    );

  const employerShare =
    multiplyFixedDecimals(
      fundSalary,
      MONEY_SCALE,
      employerRate,
      RATE_SCALE,
      MONEY_SCALE,
    );

  return {
    monthlyCompensation:
      formatMoney(compensation),

    monthlyFundSalary:
      formatMoney(fundSalary),

    employeeRate:
      formatRate(employeeRate),

    employerRate:
      formatRate(employerRate),

    employeeShare:
      formatMoney(employeeShare),

    employerShare:
      formatMoney(employerShare),

    totalContribution:
      formatMoney(
        employeeShare +
          employerShare,
      ),
  };
}

/*
 * ============================================================
 * BIR WITHHOLDING TAX TABLE
 * Effective January 1, 2023 and onwards
 * ============================================================
 */

export type PhilippineWithholdingPeriod =
  | 'DAILY'
  | 'WEEKLY'
  | 'SEMI_MONTHLY'
  | 'MONTHLY';

const BIR_WITHHOLDING_RULES:
  Readonly<
    Record<
      PhilippineWithholdingPeriod,
      ProgressiveWithholdingTaxRule
    >
  > = {
    DAILY: {
      method: 'PROGRESSIVE_TABLE',

      brackets: [
        {
          minInclusive: '0.00',
          maxExclusive: '685.01',
          baseTax: '0.00',
          rateOnExcess: '0.0000',
        },
        {
          minInclusive: '685.01',
          maxExclusive: '1096.00',
          baseTax: '0.00',
          rateOnExcess: '0.1500',
        },
        {
          minInclusive: '1096.00',
          maxExclusive: '2192.00',
          baseTax: '61.65',
          rateOnExcess: '0.2000',
        },
        {
          minInclusive: '2192.00',
          maxExclusive: '5479.00',
          baseTax: '280.85',
          rateOnExcess: '0.2500',
        },
        {
          minInclusive: '5479.00',
          maxExclusive: '21918.00',
          baseTax: '1102.60',
          rateOnExcess: '0.3000',
        },
        {
          minInclusive: '21918.00',
          maxExclusive: null,
          baseTax: '6034.00',
          rateOnExcess: '0.3500',
        },
      ],
    },

    WEEKLY: {
      method: 'PROGRESSIVE_TABLE',

      brackets: [
        {
          minInclusive: '0.00',
          maxExclusive: '4808.01',
          baseTax: '0.00',
          rateOnExcess: '0.0000',
        },
        {
          minInclusive: '4808.01',
          maxExclusive: '7692.00',
          baseTax: '0.00',
          rateOnExcess: '0.1500',
        },
        {
          minInclusive: '7692.00',
          maxExclusive: '15385.00',
          baseTax: '432.60',
          rateOnExcess: '0.2000',
        },
        {
          minInclusive: '15385.00',
          maxExclusive: '38462.00',
          baseTax: '1971.20',
          rateOnExcess: '0.2500',
        },
        {
          minInclusive: '38462.00',
          maxExclusive: '153846.00',
          baseTax: '7740.45',
          rateOnExcess: '0.3000',
        },
        {
          minInclusive: '153846.00',
          maxExclusive: null,
          baseTax: '42355.65',
          rateOnExcess: '0.3500',
        },
      ],
    },

    SEMI_MONTHLY: {
      method: 'PROGRESSIVE_TABLE',

      brackets: [
        {
          minInclusive: '0.00',
          maxExclusive: '10417.01',
          baseTax: '0.00',
          rateOnExcess: '0.0000',
        },
        {
          minInclusive: '10417.01',
          maxExclusive: '16667.00',
          baseTax: '0.00',
          rateOnExcess: '0.1500',
        },
        {
          minInclusive: '16667.00',
          maxExclusive: '33333.00',
          baseTax: '937.50',
          rateOnExcess: '0.2000',
        },
        {
          minInclusive: '33333.00',
          maxExclusive: '83333.00',
          baseTax: '4270.70',
          rateOnExcess: '0.2500',
        },
        {
          minInclusive: '83333.00',
          maxExclusive: '333333.00',
          baseTax: '16770.70',
          rateOnExcess: '0.3000',
        },
        {
          minInclusive: '333333.00',
          maxExclusive: null,
          baseTax: '91770.70',
          rateOnExcess: '0.3500',
        },
      ],
    },

    MONTHLY: {
      method: 'PROGRESSIVE_TABLE',

      brackets: [
        {
          minInclusive: '0.00',
          maxExclusive: '20833.01',
          baseTax: '0.00',
          rateOnExcess: '0.0000',
        },
        {
          minInclusive: '20833.01',
          maxExclusive: '33333.00',
          baseTax: '0.00',
          rateOnExcess: '0.1500',
        },
        {
          minInclusive: '33333.00',
          maxExclusive: '66667.00',
          baseTax: '1875.00',
          rateOnExcess: '0.2000',
        },
        {
          minInclusive: '66667.00',
          maxExclusive: '166667.00',
          baseTax: '8541.80',
          rateOnExcess: '0.2500',
        },
        {
          minInclusive: '166667.00',
          maxExclusive: '666667.00',
          baseTax: '33541.80',
          rateOnExcess: '0.3000',
        },
        {
          minInclusive: '666667.00',
          maxExclusive: null,
          baseTax: '183541.80',
          rateOnExcess: '0.3500',
        },
      ],
    },
  };

export function getBirWithholdingTaxRule(
  period: PhilippineWithholdingPeriod,
): ProgressiveWithholdingTaxRule {
  return BIR_WITHHOLDING_RULES[period];
}

export function calculateBirWithholdingTax(
  period: PhilippineWithholdingPeriod,
  taxableCompensation: string,
): WithholdingTaxResult {
  return calculateWithholdingTax({
    taxableCompensation,

    rule:
      getBirWithholdingTaxRule(
        period,
      ),
  });
}

/*
 * ============================================================
 * 13TH MONTH PAY
 * ============================================================
 */

export interface ThirteenthMonthInput {
  totalBasicSalaryEarned: string;

  monthsWithServiceInCalendarYear: number;
}

export interface ThirteenthMonthResult {
  eligible: boolean;

  totalBasicSalaryEarned: string;

  monthsWithServiceInCalendarYear: number;

  thirteenthMonthPay: string;
}

export function calculateThirteenthMonthPay(
  input: ThirteenthMonthInput,
): ThirteenthMonthResult {
  if (
    !Number.isInteger(
      input.monthsWithServiceInCalendarYear,
    ) ||
    input.monthsWithServiceInCalendarYear < 0 ||
    input.monthsWithServiceInCalendarYear > 12
  ) {
    throw new Error(
      'Months with service in calendar year must be a whole number from 0 to 12.',
    );
  }

  const totalBasicSalaryEarned =
    requireNonNegativeMoney(
      input.totalBasicSalaryEarned,
      'Total basic salary earned',
    );

  const eligible =
    input.monthsWithServiceInCalendarYear >=
    1;

  const amount =
    eligible
      ? divideRoundHalfUp(
          totalBasicSalaryEarned,
          12n,
        )
      : 0n;

  return {
    eligible,

    totalBasicSalaryEarned:
      formatMoney(
        totalBasicSalaryEarned,
      ),

    monthsWithServiceInCalendarYear:
      input.monthsWithServiceInCalendarYear,

    thirteenthMonthPay:
      formatMoney(amount),
  };
}

/*
 * ============================================================
 * CLIENT LEAVE ENTITLEMENT
 * ============================================================
 */

export type PayrollEmploymentGroup =
  | 'INTERNAL'
  | 'CLIENT';

export interface LeaveEntitlementInput {
  employmentGroup: PayrollEmploymentGroup;

  hireDate: string;

  asOfDate: string;
}

export type LeaveBalanceMode =
  | 'SEPARATE_VL_SL'
  | 'SHARED_VL_SL_POOL';

export interface LeaveBalanceAllocation {
  mode: LeaveBalanceMode;

  vacationLeaveDays: number;
  sickLeaveDays: number;

  sharedVlSlPoolDays: number;
}

export interface LeaveEntitlementResult {
  employmentGroup: PayrollEmploymentGroup;

  hireDate: string;

  eligibilityDate: string;

  eligible: boolean;

  annualPaidLeaveDays: number;

  balanceAllocation: LeaveBalanceAllocation;

  calendarAllocationPolicy:
    'FULL_ON_ELIGIBILITY_RESET_JANUARY_1_NO_CARRYOVER';
}

export function calculateLeaveEntitlement(
  input: LeaveEntitlementInput,
): LeaveEntitlementResult {
  const hireDate =
    parseDateOnly(
      input.hireDate,
      'Hire date',
    );

  const asOfDate =
    parseDateOnly(
      input.asOfDate,
      'As-of date',
    );

  const leavePolicy =
    PAYROLL_BUSINESS_POLICIES.leaveCalendar;

  const waitingMonths =
    input.employmentGroup ===
    'INTERNAL'
      ? leavePolicy.internalEligibilityMonths
      : leavePolicy.clientEligibilityMonths;

  const annualPaidLeaveDays =
    input.employmentGroup ===
    'INTERNAL'
      ? leavePolicy.internalAnnualPaidLeaveDays
      : leavePolicy.clientAnnualPaidLeaveDays;

  const balanceAllocation: LeaveBalanceAllocation =
    input.employmentGroup ===
    'INTERNAL'
      ? {
          mode:
            leavePolicy.internalBalanceMode,

          vacationLeaveDays:
            leavePolicy.internalVacationLeaveDays,

          sickLeaveDays:
            leavePolicy.internalSickLeaveDays,

          sharedVlSlPoolDays:
            0,
        }
      : {
          mode:
            leavePolicy.clientBalanceMode,

          vacationLeaveDays:
            0,

          sickLeaveDays:
            0,

          sharedVlSlPoolDays:
            leavePolicy.clientSharedVlSlPoolDays,
        };

  const eligibilityDate =
    addUtcMonths(
      hireDate,
      waitingMonths,
    );

  return {
    employmentGroup:
      input.employmentGroup,

    hireDate:
      toDateOnly(hireDate),

    eligibilityDate:
      toDateOnly(
        eligibilityDate,
      ),

    eligible:
      asOfDate >=
      eligibilityDate,

    annualPaidLeaveDays,

    balanceAllocation,

    calendarAllocationPolicy:
      'FULL_ON_ELIGIBILITY_RESET_JANUARY_1_NO_CARRYOVER',
  };
}

/*
 * ============================================================
 * SSS MATERNITY BENEFIT
 * ============================================================
 */

export type MaternityContingencyType =
  | 'LIVE_BIRTH'
  | 'LIVE_BIRTH_SOLO_PARENT'
  | 'MISCARRIAGE_OR_ETP';

export interface HistoricalSssMonthlySalaryCredit {
  /*
   * YYYY-MM
   */
  yearMonth: string;

  monthlySalaryCredit: string;

  contributionPaid: boolean;
}

export interface SssMaternityInput {
  contingencyDate: string;

  contingencyType:
    MaternityContingencyType;

  monthlySalaryCredits:
    readonly HistoricalSssMonthlySalaryCredit[];
}

export interface SssMaternityResult {
  qualified: boolean;

  qualifyingContributionMonths: number;

  lookbackStartMonth: string;
  lookbackEndMonth: string;

  compensableDays:
    60 | 105 | 120;

  selectedMonthlySalaryCredits:
    string[];

  totalSelectedMonthlySalaryCredits:
    string;

  averageDailySalaryCredit:
    string;

  maternityBenefit:
    string | null;

  employerAdvanceRequired:
    boolean;
}

export function calculateSssMaternityBenefit(
  input: SssMaternityInput,
): SssMaternityResult {
  const contingencyDate =
    parseDateOnly(
      input.contingencyDate,
      'Maternity contingency date',
    );

  const {
    startMonth,
    endMonth,
    months,
  } =
    getMaternityLookbackMonths(
      contingencyDate,
    );

  const historyByMonth =
    new Map<
      string,
      HistoricalSssMonthlySalaryCredit
    >();

  for (
    const record of
    input.monthlySalaryCredits
  ) {
    if (
      !/^\d{4}-\d{2}$/.test(
        record.yearMonth,
      )
    ) {
      throw new Error(
        `Invalid SSS maternity history month ${record.yearMonth}.`,
      );
    }

    if (
      historyByMonth.has(
        record.yearMonth,
      )
    ) {
      throw new Error(
        `Duplicate SSS maternity history month ${record.yearMonth}.`,
      );
    }

    historyByMonth.set(
      record.yearMonth,
      record,
    );
  }

  const values: bigint[] = [];

  let qualifyingContributionMonths =
    0;

  /*
   * Maternity benefit under the Regular SSS program
   * uses MSC up to 20,000.
   */
  const maternityMscCeiling =
    parseMoney('20000.00');

  for (const month of months) {
    const record =
      historyByMonth.get(month);

    if (
      !record ||
      !record.contributionPaid
    ) {
      values.push(0n);

      continue;
    }

    const originalMsc =
      requireNonNegativeMoney(
        record.monthlySalaryCredit,
        `SSS MSC for ${month}`,
      );

    qualifyingContributionMonths +=
      1;

    values.push(
      originalMsc >
        maternityMscCeiling
        ? maternityMscCeiling
        : originalMsc,
    );
  }

  const selected =
    [...values]
      .sort(
        (left, right) =>
          left === right
            ? 0
            : left > right
              ? -1
              : 1,
      )
      .slice(0, 6);

  while (
    selected.length < 6
  ) {
    selected.push(0n);
  }

  const totalSelected =
    selected.reduce(
      (total, value) =>
        total + value,
      0n,
    );

  const qualified =
    qualifyingContributionMonths >= 3;

  const compensableDays:
    60 | 105 | 120 =
      input.contingencyType ===
      'LIVE_BIRTH'
        ? 105
        : input.contingencyType ===
            'LIVE_BIRTH_SOLO_PARENT'
          ? 120
          : 60;

  const averageDailySalaryCredit =
    divideRoundHalfUp(
      totalSelected,
      180n,
    );

  const maternityBenefit =
    qualified
      ? divideRoundHalfUp(
          totalSelected *
            BigInt(
              compensableDays,
            ),
          180n,
        )
      : null;

  return {
    qualified,

    qualifyingContributionMonths,

    lookbackStartMonth:
      startMonth,

    lookbackEndMonth:
      endMonth,

    compensableDays,

    selectedMonthlySalaryCredits:
      selected.map(
        (value) =>
          formatMoney(value),
      ),

    totalSelectedMonthlySalaryCredits:
      formatMoney(totalSelected),

    averageDailySalaryCredit:
      formatMoney(
        averageDailySalaryCredit,
      ),

    maternityBenefit:
      maternityBenefit === null
        ? null
        : formatMoney(
            maternityBenefit,
          ),

    /*
     * Employed-member workflow:
     * employer advances qualified maternity benefit,
     * then seeks SSS reimbursement.
     */
    employerAdvanceRequired:
      qualified,
  };
}

/*
 * ============================================================
 * SSS / PAG-IBIG LOAN PAYROLL DEDUCTION
 * ============================================================
 */

export type GovernmentLoanProvider =
  | 'SSS'
  | 'PAGIBIG';

export interface GovernmentLoanScheduleInput {
  provider:
    GovernmentLoanProvider;

  monthlyAmortization: string;

  startMonth: string;

  numberOfMonthlyAmortizations: number;
}

export interface GovernmentLoanSchedule {
  provider:
    GovernmentLoanProvider;

  monthlyAmortization: string;

  startMonth: string;

  endMonth: string;

  numberOfMonthlyAmortizations: number;

  deductionMode:
    'SPLIT_BETWEEN_SEMI_MONTHLY_CUTOFFS';

  firstCutoffDeduction: string;

  secondCutoffDeduction: string;
}

export function createGovernmentLoanSchedule(
  input: GovernmentLoanScheduleInput,
): GovernmentLoanSchedule {
  requireNonNegativeMoney(
    input.monthlyAmortization,
    'Government loan monthly amortization',
  );

  if (
    !/^\d{4}-\d{2}$/.test(
      input.startMonth,
    )
  ) {
    throw new Error(
      'Government loan start month must use YYYY-MM.',
    );
  }

  if (
    !Number.isInteger(
      input.numberOfMonthlyAmortizations,
    ) ||
    input.numberOfMonthlyAmortizations <= 0
  ) {
    throw new Error(
      'Number of monthly amortizations must be a positive whole number.',
    );
  }

  const monthlyAmortization =
    parseMoney(
      input.monthlyAmortization,
    );

  const firstCutoffDeduction =
    divideRoundHalfUp(
      monthlyAmortization,
      2n,
    );

  const secondCutoffDeduction =
    monthlyAmortization -
    firstCutoffDeduction;

  const start =
    parseYearMonth(
      input.startMonth,
    );

  const end =
    addUtcMonths(
      start,
      input.numberOfMonthlyAmortizations -
        1,
    );

  return {
    provider:
      input.provider,

    monthlyAmortization:
      formatMoney(
        monthlyAmortization,
      ),

    startMonth:
      input.startMonth,

    endMonth:
      toYearMonth(end),

    numberOfMonthlyAmortizations:
      input.numberOfMonthlyAmortizations,

    deductionMode:
      'SPLIT_BETWEEN_SEMI_MONTHLY_CUTOFFS',

    firstCutoffDeduction:
      formatMoney(
        firstCutoffDeduction,
      ),

    secondCutoffDeduction:
      formatMoney(
        secondCutoffDeduction,
      ),
  };
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function requireNonNegativeMoney(
  value: string,
  fieldName: string,
): bigint {
  const amount =
    parseMoney(value);

  if (amount < 0n) {
    throw new Error(
      `${fieldName} must not be negative.`,
    );
  }

  return amount;
}

function requireNonNegativeRate(
  value: string,
  fieldName: string,
): bigint {
  const rate =
    parseRate(value);

  if (rate < 0n) {
    throw new Error(
      `${fieldName} must not be negative.`,
    );
  }

  return rate;
}

function percentageOfMoney(
  amount: bigint,
  numerator: bigint,
  denominator: bigint,
): bigint {
  return divideRoundHalfUp(
    amount * numerator,
    denominator,
  );
}

function parseDateOnly(
  value: string,
  fieldName: string,
): Date {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    throw new Error(
      `${fieldName} must use YYYY-MM-DD.`,
    );
  }

  const date =
    new Date(
      `${value}T00:00:00.000Z`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    ) ||
    toDateOnly(date) !== value
  ) {
    throw new Error(
      `${fieldName} is not a valid calendar date.`,
    );
  }

  return date;
}

function parseYearMonth(
  value: string,
): Date {
  if (
    !/^\d{4}-\d{2}$/.test(
      value,
    )
  ) {
    throw new Error(
      'Year-month must use YYYY-MM.',
    );
  }

  const date =
    new Date(
      `${value}-01T00:00:00.000Z`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    ) ||
    toYearMonth(date) !== value
  ) {
    throw new Error(
      `Invalid year-month ${value}.`,
    );
  }

  return date;
}

function addUtcMonths(
  source: Date,
  months: number,
): Date {
  const target =
    new Date(
      Date.UTC(
        source.getUTCFullYear(),
        source.getUTCMonth() +
          months,
        1,
      ),
    );

  /*
   * Preserve the original day where possible.
   * If the target month is shorter, use its last day.
   */
  const lastDay =
    new Date(
      Date.UTC(
        target.getUTCFullYear(),
        target.getUTCMonth() + 1,
        0,
      ),
    ).getUTCDate();

  target.setUTCDate(
    Math.min(
      source.getUTCDate(),
      lastDay,
    ),
  );

  return target;
}

function toDateOnly(
  value: Date,
): string {
  return value
    .toISOString()
    .slice(0, 10);
}

function toYearMonth(
  value: Date,
): string {
  return value
    .toISOString()
    .slice(0, 7);
}

function getMaternityLookbackMonths(
  contingencyDate: Date,
): {
  startMonth: string;
  endMonth: string;
  months: string[];
} {
  const year =
    contingencyDate.getUTCFullYear();

  const month =
    contingencyDate.getUTCMonth();

  const quarterStartMonth =
    Math.floor(
      month / 3,
    ) * 3;

  /*
   * Semester of contingency = current quarter
   * plus the immediately preceding quarter.
   */
  const semesterStart =
    quarterStartMonth === 0
      ? new Date(
          Date.UTC(
            year - 1,
            9,
            1,
          ),
        )
      : new Date(
          Date.UTC(
            year,
            quarterStartMonth - 3,
            1,
          ),
        );

  const lookbackEnd =
    addUtcMonths(
      semesterStart,
      -1,
    );

  const lookbackStart =
    addUtcMonths(
      lookbackEnd,
      -11,
    );

  const months: string[] = [];

  for (
    let index = 0;
    index < 12;
    index += 1
  ) {
    months.push(
      toYearMonth(
        addUtcMonths(
          lookbackStart,
          index,
        ),
      ),
    );
  }

  return {
    startMonth:
      toYearMonth(
        lookbackStart,
      ),

    endMonth:
      toYearMonth(
        lookbackEnd,
      ),

    months,
  };
}
