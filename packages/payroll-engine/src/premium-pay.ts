import {
  MONEY_SCALE,
  RATE_SCALE,
  divideFixedDecimals,
  divideRoundHalfUp,
  formatFixedDecimal,
  formatMoney,
  formatRate,
  parseRate,
  rescaleFixedDecimal,
} from './fixed-decimal.ts';

import {
  validatePayrollCalculationInput,
  type PayrollCalculationInput,
  type PayrollComputedLineItem,
} from './payroll-calculation.ts';

export type PremiumMultiplierSemantics =
  | 'TOTAL'
  | 'ADDITIONAL';

export type MonthlyRegularBaseTreatment =
  | 'ALREADY_INCLUDED'
  | 'NOT_INCLUDED';

export interface PremiumMultiplierRule {
  /*
   * Examples only:
   *
   * TOTAL 1.3000 means total pay is 130% of base.
   * ADDITIONAL 0.3000 means add 30% of base.
   *
   * No multiplier is assumed by the engine.
   */
  multiplier: string;

  semantics: PremiumMultiplierSemantics;
}

export interface RegularWorkPremiumRule
  extends PremiumMultiplierRule {
  /*
   * DAILY basic pay already includes regularMinutes,
   * so this option is not needed for DAILY employees.
   *
   * MONTHLY payroll needs an explicit statement because
   * the approved cutoff salary treatment has not yet
   * been defined.
   */
  monthlyBaseTreatment?: MonthlyRegularBaseTreatment;
}

export interface PremiumPayOptions {
  /*
   * Required for MONTHLY employees whenever a premium
   * must be valued.
   *
   * The engine deliberately does not derive this value
   * from monthly salary.
   */
  monthlyPremiumDailyRate?: string;

  /*
   * Keys are generated as:
   *
   * WORKDAY|REGULAR
   * REST_DAY|REGULAR
   * WORKDAY|SPECIAL_NON_WORKING
   * REST_DAY|SPECIAL_NON_WORKING
   * etc.
   */
  regularWorkRules?: Readonly<
    Record<string, RegularWorkPremiumRule>
  >;

  /*
   * Keys match DTR overtime classifications:
   *
   * REGULAR
   * REST_DAY
   * SPECIAL_HOLIDAY
   * REGULAR_HOLIDAY
   * REST_DAY_SPECIAL_HOLIDAY
   * REST_DAY_REGULAR_HOLIDAY
   */
  overtimeRules?: Readonly<
    Record<string, PremiumMultiplierRule>
  >;

  /*
   * Night Differential overlaps worked time and is
   * therefore always treated as an additional premium
   * over its underlying base pay.
   *
   * The current DTR model supports a base-hourly ND
   * calculation. It does not identify which ND minutes
   * overlap Regular versus OT minutes.
   */
  nightDifferentialRule?: PremiumMultiplierRule;
}

export type PremiumRuleKind =
  | 'REGULAR_WORK'
  | 'OVERTIME'
  | 'NIGHT_DIFFERENTIAL';

export type PremiumRuleIssueReason =
  | 'MISSING_RULE'
  | 'MISSING_MONTHLY_BASE_TREATMENT';

export interface UnresolvedPremiumRule {
  kind: PremiumRuleKind;

  key: string;

  minutes: number;

  reason: PremiumRuleIssueReason;
}

export interface PremiumPayResult {
  regularWorkPremiumTotal: string;

  overtimePayTotal: string;

  nightDifferentialPremiumTotal: string;

  premiumPayTotal: string;

  unresolvedRules:
    readonly UnresolvedPremiumRule[];

  lineItems:
    readonly PayrollComputedLineItem[];
}

const ONE_RATE =
  10n ** BigInt(RATE_SCALE);

export function getRegularWorkPremiumKey(
  restDay: boolean,
  holidayType: string | null,
): string {
  return `${
    restDay ? 'REST_DAY' : 'WORKDAY'
  }|${holidayType ?? 'NO_HOLIDAY'}`;
}

export function calculatePremiumPay(
  input: PayrollCalculationInput,
  options: PremiumPayOptions = {},
): PremiumPayResult {
  validatePayrollCalculationInput(input);

  let regularWorkPremiumTotal = 0n;

  let overtimePayTotal = 0n;

  let nightDifferentialPremiumTotal = 0n;

  const unresolvedRules:
    UnresolvedPremiumRule[] = [];

  const lineItems:
    PayrollComputedLineItem[] = [];

  for (
    const classification of
      input.attendance.premiumWorkBreakdown
  ) {
    if (
      classification.regularMinutes === 0
    ) {
      continue;
    }

    /*
     * Ordinary workday regular minutes are handled by
     * Basic Pay and need no premium rule.
     */
    if (
      !classification.restDay &&
      classification.holidayType === null
    ) {
      continue;
    }

    const key =
      getRegularWorkPremiumKey(
        classification.restDay,
        classification.holidayType,
      );

    const rule =
      options.regularWorkRules?.[key];

    if (!rule) {
      unresolvedRules.push({
        kind:
          'REGULAR_WORK',

        key,

        minutes:
          classification.regularMinutes,

        reason:
          'MISSING_RULE',
      });

      continue;
    }

    const baseAlreadyIncluded =
      resolveRegularBaseTreatment(
        input,
        rule,
      );

    if (
      baseAlreadyIncluded === null
    ) {
      unresolvedRules.push({
        kind:
          'REGULAR_WORK',

        key,

        minutes:
          classification.regularMinutes,

        reason:
          'MISSING_MONTHLY_BASE_TREATMENT',
      });

      continue;
    }

    const dailyRate =
      resolvePremiumDailyRate(
        input,
        options,
      );

    const effectiveMultiplier =
      resolveEffectiveMultiplier(
        rule,
        baseAlreadyIncluded,
      );

    const amount =
      calculateMinutePay(
        dailyRate,
        classification.regularMinutes,
        input.config.standardWorkMinutesPerDay,
        effectiveMultiplier,
      );

    regularWorkPremiumTotal += amount;

    if (amount !== 0n) {
      lineItems.push({
        category:
          'EARNING',

        code:
          `PREMIUM_${sanitizeCode(key)}`,

        description:
          describeRegularPremium(
            classification.restDay,
            classification.holidayType,
          ),

        quantity:
          formatHours(
            classification.regularMinutes,
          ),

        rate:
          formatRate(
            effectiveMultiplier,
          ),

        amount:
          formatMoney(amount),

        taxable:
          null,

        metadata: {
          source:
            'ATTENDANCE_REGULAR_PREMIUM',

          classification:
            key,

          restDay:
            classification.restDay,

          holidayType:
            classification.holidayType,

          regularMinutes:
            classification.regularMinutes,

          configuredMultiplier:
            rule.multiplier,

          multiplierSemantics:
            rule.semantics,

          effectiveMultiplier:
            formatRate(
              effectiveMultiplier,
            ),

          baseAlreadyIncluded,
        },
      });
    }
  }

  for (
    const overtime of
      input.attendance.overtimeBreakdown
  ) {
    if (overtime.minutes === 0) {
      continue;
    }

    const rule =
      options.overtimeRules?.[
        overtime.type
      ];

    if (!rule) {
      unresolvedRules.push({
        kind:
          'OVERTIME',

        key:
          overtime.type,

        minutes:
          overtime.minutes,

        reason:
          'MISSING_RULE',
      });

      continue;
    }

    const dailyRate =
      resolvePremiumDailyRate(
        input,
        options,
      );

    /*
     * OT minutes are not part of Basic Pay because
     * Basic Pay uses regularMinutes only.
     */
    const effectiveMultiplier =
      resolveEffectiveMultiplier(
        rule,
        false,
      );

    const amount =
      calculateMinutePay(
        dailyRate,
        overtime.minutes,
        input.config.standardWorkMinutesPerDay,
        effectiveMultiplier,
      );

    overtimePayTotal += amount;

    if (amount !== 0n) {
      lineItems.push({
        category:
          'EARNING',

        code:
          `OVERTIME_${sanitizeCode(
            overtime.type,
          )}`,

        description:
          `${humanize(
            overtime.type,
          )} Overtime`,

        quantity:
          formatHours(
            overtime.minutes,
          ),

        rate:
          formatRate(
            effectiveMultiplier,
          ),

        amount:
          formatMoney(amount),

        taxable:
          null,

        metadata: {
          source:
            'ATTENDANCE_OVERTIME',

          overtimeType:
            overtime.type,

          overtimeMinutes:
            overtime.minutes,

          configuredMultiplier:
            rule.multiplier,

          multiplierSemantics:
            rule.semantics,

          effectiveMultiplier:
            formatRate(
              effectiveMultiplier,
            ),

          baseAlreadyIncluded:
            false,
        },
      });
    }
  }

  if (
    input.attendance
      .nightDifferentialMinutes > 0
  ) {
    const rule =
      options.nightDifferentialRule;

    if (!rule) {
      unresolvedRules.push({
        kind:
          'NIGHT_DIFFERENTIAL',

        key:
          'NIGHT_DIFFERENTIAL',

        minutes:
          input.attendance
            .nightDifferentialMinutes,

        reason:
          'MISSING_RULE',
      });
    } else {
      const dailyRate =
        resolvePremiumDailyRate(
          input,
          options,
        );

      /*
       * ND minutes overlap already-paid worked time.
       */
      const effectiveMultiplier =
        resolveEffectiveMultiplier(
          rule,
          true,
        );

      const amount =
        calculateMinutePay(
          dailyRate,
          input.attendance
            .nightDifferentialMinutes,
          input.config
            .standardWorkMinutesPerDay,
          effectiveMultiplier,
        );

      nightDifferentialPremiumTotal +=
        amount;

      if (amount !== 0n) {
        lineItems.push({
          category:
            'EARNING',

          code:
            'NIGHT_DIFFERENTIAL',

          description:
            'Night Differential',

          quantity:
            formatHours(
              input.attendance
                .nightDifferentialMinutes,
            ),

          rate:
            formatRate(
              effectiveMultiplier,
            ),

          amount:
            formatMoney(amount),

          taxable:
            null,

          metadata: {
            source:
              'ATTENDANCE_NIGHT_DIFFERENTIAL',

            nightDifferentialMinutes:
              input.attendance
                .nightDifferentialMinutes,

            configuredMultiplier:
              rule.multiplier,

            multiplierSemantics:
              rule.semantics,

            effectiveMultiplier:
              formatRate(
                effectiveMultiplier,
              ),

            baseAlreadyIncluded:
              true,

            calculationBasis:
              'BASE_HOURLY_RATE',
          },
        });
      }
    }
  }

  const premiumPayTotal =
    regularWorkPremiumTotal +
    overtimePayTotal +
    nightDifferentialPremiumTotal;

  return {
    regularWorkPremiumTotal:
      formatMoney(
        regularWorkPremiumTotal,
      ),

    overtimePayTotal:
      formatMoney(
        overtimePayTotal,
      ),

    nightDifferentialPremiumTotal:
      formatMoney(
        nightDifferentialPremiumTotal,
      ),

    premiumPayTotal:
      formatMoney(
        premiumPayTotal,
      ),

    unresolvedRules,

    lineItems,
  };
}

function resolveRegularBaseTreatment(
  input: PayrollCalculationInput,
  rule: RegularWorkPremiumRule,
): boolean | null {
  /*
   * DAILY Basic Pay is calculated directly from all
   * regularMinutes, including Rest Day / Holiday entries.
   */
  if (input.payBasis === 'DAILY') {
    return true;
  }

  if (
    rule.monthlyBaseTreatment ===
    undefined
  ) {
    return null;
  }

  return (
    rule.monthlyBaseTreatment ===
    'ALREADY_INCLUDED'
  );
}

function resolvePremiumDailyRate(
  input: PayrollCalculationInput,
  options: PremiumPayOptions,
): bigint {
  if (input.payBasis === 'DAILY') {
    return parseRate(
      input.baseRate,
    );
  }

  if (
    options.monthlyPremiumDailyRate ===
    undefined
  ) {
    throw new Error(
      'Monthly premium pay requires an approved configured premium daily rate.',
    );
  }

  const rate =
    parseRate(
      options.monthlyPremiumDailyRate,
    );

  if (rate <= 0n) {
    throw new Error(
      'Monthly premium daily rate must be greater than zero.',
    );
  }

  return rate;
}

function resolveEffectiveMultiplier(
  rule: PremiumMultiplierRule,
  baseAlreadyIncluded: boolean,
): bigint {
  const multiplier =
    parseRate(
      rule.multiplier,
    );

  if (multiplier < 0n) {
    throw new Error(
      'Premium multiplier must not be negative.',
    );
  }

  if (baseAlreadyIncluded) {
    if (
      rule.semantics === 'TOTAL'
    ) {
      if (multiplier < ONE_RATE) {
        throw new Error(
          'TOTAL premium multiplier must be at least 1.0000 when base pay is already included.',
        );
      }

      return (
        multiplier -
        ONE_RATE
      );
    }

    return multiplier;
  }

  if (
    rule.semantics === 'TOTAL'
  ) {
    return multiplier;
  }

  return (
    ONE_RATE +
    multiplier
  );
}

function calculateMinutePay(
  dailyRate: bigint,
  minutes: number,
  standardWorkMinutesPerDay: number,
  multiplier: bigint,
): bigint {
  if (
    minutes === 0 ||
    multiplier === 0n
  ) {
    return 0n;
  }

  /*
   * Keep precision at RATE_SCALE until the final
   * conversion to money.
   *
   * dailyRate × minutes/workday × multiplier
   */
  const amountAtRateScale =
    divideRoundHalfUp(
      dailyRate *
        BigInt(minutes) *
        multiplier,

      BigInt(
        standardWorkMinutesPerDay,
      ) * ONE_RATE,
    );

  return rescaleFixedDecimal(
    amountAtRateScale,
    RATE_SCALE,
    MONEY_SCALE,
  );
}

function formatHours(
  minutes: number,
): string {
  const hours =
    divideFixedDecimals(
      BigInt(minutes),
      0,
      60n,
      0,
      RATE_SCALE,
    );

  return formatFixedDecimal(
    hours,
    RATE_SCALE,
  );
}

function describeRegularPremium(
  restDay: boolean,
  holidayType: string | null,
): string {
  const parts: string[] = [];

  if (restDay) {
    parts.push('Rest Day');
  }

  if (holidayType) {
    parts.push(
      humanize(
        holidayType,
      ),
    );
  }

  parts.push('Regular Work Premium');

  return parts.join(' - ');
}

function sanitizeCode(
  value: string,
): string {
  return value
    .replaceAll('|', '_')
    .replaceAll(' ', '_')
    .replaceAll('-', '_')
    .toUpperCase();
}

function humanize(
  value: string,
): string {
  return value
    .toLowerCase()
    .split('_')
    .map(
      (part) =>
        part.length === 0
          ? part
          : part[0]?.toUpperCase() +
            part.slice(1),
    )
    .join(' ');
}
