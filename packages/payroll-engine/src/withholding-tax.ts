import {
  RATE_SCALE,
  divideRoundHalfUp,
  formatMoney,
  formatRate,
  parseMoney,
  parseRate,
} from './fixed-decimal.ts';

import type {
  PayrollComputedLineItem,
} from './payroll-calculation.ts';

export interface FixedWithholdingTaxRule {
  method:
    'FIXED_AMOUNT';

  amount:
    string;
}

export interface WithholdingTaxBracket {
  /*
   * Range semantics:
   *
   * minInclusive <= taxable compensation < maxExclusive
   *
   * maxExclusive = null means no upper limit.
   */
  minInclusive:
    string;

  maxExclusive:
    string | null;

  /*
   * Tax amount already due at minInclusive.
   */
  baseTax:
    string;

  /*
   * Decimal rate applied only to compensation above
   * minInclusive.
   *
   * 0.1500 = 15%
   *
   * Rates are supplied by configuration.
   */
  rateOnExcess:
    string;
}

export interface ProgressiveWithholdingTaxRule {
  method:
    'PROGRESSIVE_TABLE';

  brackets:
    readonly WithholdingTaxBracket[];
}

export type WithholdingTaxRule =
  | FixedWithholdingTaxRule
  | ProgressiveWithholdingTaxRule;

export interface WithholdingTaxInput {
  /*
   * Taxable compensation must already be resolved by
   * the approved payroll/tax configuration layer.
   *
   * The engine does not currently assume which earning
   * components are taxable.
   */
  taxableCompensation:
    string;

  rule:
    WithholdingTaxRule;
}

export interface WithholdingTaxResult {
  taxableCompensation:
    string;

  withholdingTax:
    string;

  lineItems:
    readonly PayrollComputedLineItem[];
}

const RATE_FACTOR =
  10n ** BigInt(RATE_SCALE);

export function calculateWithholdingTax(
  input: WithholdingTaxInput,
): WithholdingTaxResult {
  const taxableCompensation =
    parseMoney(
      input.taxableCompensation,
    );

  if (taxableCompensation < 0n) {
    throw new Error(
      'Taxable compensation must not be negative.',
    );
  }

  const withholdingTax =
    calculateTaxAmount(
      taxableCompensation,
      input.rule,
    );

  const lineItem:
    PayrollComputedLineItem = {
      category:
        'TAX',

      code:
        'WITHHOLDING_TAX',

      description:
        'Withholding Tax',

      quantity:
        null,

      rate:
        effectiveRateForLineItem(
          taxableCompensation,
          input.rule,
        ),

      amount:
        formatMoney(
          withholdingTax,
        ),

      taxable:
        null,

      metadata: {
        source:
          'WITHHOLDING_TAX',

        calculationMethod:
          input.rule.method,

        taxableCompensation:
          formatMoney(
            taxableCompensation,
          ),
      },
    };

  return {
    taxableCompensation:
      formatMoney(
        taxableCompensation,
      ),

    withholdingTax:
      formatMoney(
        withholdingTax,
      ),

    lineItems: [
      lineItem,
    ],
  };
}

function calculateTaxAmount(
  taxableCompensation: bigint,
  rule: WithholdingTaxRule,
): bigint {
  switch (rule.method) {
    case 'FIXED_AMOUNT': {
      const amount =
        parseMoney(
          rule.amount,
        );

      if (amount < 0n) {
        throw new Error(
          'Fixed withholding tax must not be negative.',
        );
      }

      return amount;
    }

    case 'PROGRESSIVE_TABLE': {
      if (
        rule.brackets.length === 0
      ) {
        throw new Error(
          'Withholding tax table must contain at least one bracket.',
        );
      }

      const bracket =
        rule.brackets.find(
          (candidate) =>
            bracketMatches(
              taxableCompensation,
              candidate,
            ),
        );

      if (!bracket) {
        throw new Error(
          `Withholding tax table has no bracket for taxable compensation ${formatMoney(
            taxableCompensation,
          )}.`,
        );
      }

      const minimum =
        requireNonNegativeMoney(
          bracket.minInclusive,
          'Tax bracket minimum',
        );

      const baseTax =
        requireNonNegativeMoney(
          bracket.baseTax,
          'Tax bracket base tax',
        );

      const rate =
        requireNonNegativeRate(
          bracket.rateOnExcess,
          'Tax bracket rate on excess',
        );

      const excess =
        taxableCompensation -
        minimum;

      const taxOnExcess =
        divideRoundHalfUp(
          excess * rate,
          RATE_FACTOR,
        );

      return (
        baseTax +
        taxOnExcess
      );
    }
  }
}

function bracketMatches(
  taxableCompensation: bigint,
  bracket: WithholdingTaxBracket,
): boolean {
  const minimum =
    requireNonNegativeMoney(
      bracket.minInclusive,
      'Tax bracket minimum',
    );

  if (
    taxableCompensation <
    minimum
  ) {
    return false;
  }

  if (
    bracket.maxExclusive ===
    null
  ) {
    return true;
  }

  const maximum =
    requireNonNegativeMoney(
      bracket.maxExclusive,
      'Tax bracket maximum',
    );

  if (maximum <= minimum) {
    throw new Error(
      'Tax bracket maximum must be greater than its minimum.',
    );
  }

  return (
    taxableCompensation <
    maximum
  );
}

function effectiveRateForLineItem(
  taxableCompensation: bigint,
  rule: WithholdingTaxRule,
): string | null {
  if (
    rule.method !==
    'PROGRESSIVE_TABLE'
  ) {
    return null;
  }

  const bracket =
    rule.brackets.find(
      (candidate) =>
        bracketMatches(
          taxableCompensation,
          candidate,
        ),
    );

  if (!bracket) {
    return null;
  }

  return formatRate(
    parseRate(
      bracket.rateOnExcess,
    ),
  );
}

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
