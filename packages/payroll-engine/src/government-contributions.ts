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

export type GovernmentContributionCode =
  | 'SSS'
  | 'PHILHEALTH'
  | 'PAGIBIG';

export interface FixedContributionRule {
  method:
    'FIXED_AMOUNT';

  employeeAmount:
    string;

  employerAmount?:
    string;
}

export interface PercentageContributionRule {
  method:
    'PERCENTAGE_OF_BASIS';

  /*
   * Decimal rate:
   *
   * 0.0500 = 5%
   *
   * These values are configuration inputs.
   * The engine defines no statutory percentage.
   */
  employeeRate:
    string;

  employerRate?:
    string;
}

export interface ContributionTableBracket {
  /*
   * Range semantics:
   *
   * minBasisInclusive <= basis < maxBasisExclusive
   *
   * maxBasisExclusive = null means no upper limit.
   */
  minBasisInclusive:
    string;

  maxBasisExclusive:
    string | null;

  employeeAmount:
    string;

  employerAmount?:
    string;
}

export interface TableContributionRule {
  method:
    'BRACKET_TABLE';

  brackets:
    readonly ContributionTableBracket[];
}

export type GovernmentContributionRule =
  | FixedContributionRule
  | PercentageContributionRule
  | TableContributionRule;

export interface GovernmentContributionInput {
  code:
    GovernmentContributionCode;

  description:
    string;

  /*
   * Explicit payroll basis supplied by the approved
   * rule/configuration layer.
   *
   * The engine does not assume whether SSS, PhilHealth,
   * or Pag-IBIG uses Gross Pay, Basic Pay, Monthly Salary,
   * or another basis.
   */
  basisAmount:
    string;

  rule:
    GovernmentContributionRule;
}

export interface GovernmentContributionItemResult {
  code:
    GovernmentContributionCode;

  description:
    string;

  basisAmount:
    string;

  employeeAmount:
    string;

  employerAmount:
    string;
}

export interface GovernmentContributionsResult {
  employeeContributionTotal:
    string;

  employerContributionTotal:
    string;

  items:
    readonly GovernmentContributionItemResult[];

  lineItems:
    readonly PayrollComputedLineItem[];
}

const RATE_FACTOR =
  10n ** BigInt(RATE_SCALE);

export function calculateGovernmentContributions(
  inputs: readonly GovernmentContributionInput[],
): GovernmentContributionsResult {
  let employeeContributionTotal = 0n;

  let employerContributionTotal = 0n;

  const items:
    GovernmentContributionItemResult[] = [];

  const lineItems:
    PayrollComputedLineItem[] = [];

  const seenCodes =
    new Set<GovernmentContributionCode>();

  for (const input of inputs) {
    if (seenCodes.has(input.code)) {
      throw new Error(
        `Duplicate government contribution code: ${input.code}.`,
      );
    }

    seenCodes.add(input.code);

    if (!input.description.trim()) {
      throw new Error(
        `Government contribution ${input.code} description is required.`,
      );
    }

    const basis =
      parseMoney(
        input.basisAmount,
      );

    if (basis < 0n) {
      throw new Error(
        `Government contribution ${input.code} basis must not be negative.`,
      );
    }

    const amounts =
      calculateContributionAmounts(
        input.code,
        basis,
        input.rule,
      );

    employeeContributionTotal +=
      amounts.employeeAmount;

    employerContributionTotal +=
      amounts.employerAmount;

    const employeeAmount =
      formatMoney(
        amounts.employeeAmount,
      );

    const employerAmount =
      formatMoney(
        amounts.employerAmount,
      );

    items.push({
      code:
        input.code,

      description:
        input.description,

      basisAmount:
        formatMoney(basis),

      employeeAmount,

      employerAmount,
    });

    lineItems.push({
      category:
        'CONTRIBUTION',

      code:
        input.code,

      description:
        input.description,

      quantity:
        null,

      rate:
        contributionRateForLineItem(
          input.rule,
        ),

      amount:
        employeeAmount,

      taxable:
        null,

      metadata: {
        source:
          'GOVERNMENT_CONTRIBUTION',

        contributionCode:
          input.code,

        calculationMethod:
          input.rule.method,

        basisAmount:
          formatMoney(basis),

        employerAmount,
      },
    });
  }

  return {
    employeeContributionTotal:
      formatMoney(
        employeeContributionTotal,
      ),

    employerContributionTotal:
      formatMoney(
        employerContributionTotal,
      ),

    items,

    lineItems,
  };
}

function calculateContributionAmounts(
  code: GovernmentContributionCode,
  basis: bigint,
  rule: GovernmentContributionRule,
): {
  employeeAmount: bigint;
  employerAmount: bigint;
} {
  switch (rule.method) {
    case 'FIXED_AMOUNT':
      return {
        employeeAmount:
          requireNonNegativeMoney(
            rule.employeeAmount,
            `${code} employee amount`,
          ),

        employerAmount:
          rule.employerAmount ===
          undefined
            ? 0n
            : requireNonNegativeMoney(
                rule.employerAmount,
                `${code} employer amount`,
              ),
      };

    case 'PERCENTAGE_OF_BASIS': {
      const employeeRate =
        requireNonNegativeRate(
          rule.employeeRate,
          `${code} employee rate`,
        );

      const employerRate =
        rule.employerRate ===
        undefined
          ? 0n
          : requireNonNegativeRate(
              rule.employerRate,
              `${code} employer rate`,
            );

      return {
        employeeAmount:
          applyRate(
            basis,
            employeeRate,
          ),

        employerAmount:
          applyRate(
            basis,
            employerRate,
          ),
      };
    }

    case 'BRACKET_TABLE': {
      if (
        rule.brackets.length === 0
      ) {
        throw new Error(
          `${code} contribution table must contain at least one bracket.`,
        );
      }

      const bracket =
        rule.brackets.find(
          (candidate) =>
            bracketMatches(
              basis,
              candidate,
            ),
        );

      if (!bracket) {
        throw new Error(
          `${code} contribution table has no bracket for basis ${formatMoney(
            basis,
          )}.`,
        );
      }

      return {
        employeeAmount:
          requireNonNegativeMoney(
            bracket.employeeAmount,
            `${code} bracket employee amount`,
          ),

        employerAmount:
          bracket.employerAmount ===
          undefined
            ? 0n
            : requireNonNegativeMoney(
                bracket.employerAmount,
                `${code} bracket employer amount`,
              ),
      };
    }
  }
}

function bracketMatches(
  basis: bigint,
  bracket: ContributionTableBracket,
): boolean {
  const minimum =
    requireNonNegativeMoney(
      bracket.minBasisInclusive,
      'Contribution bracket minimum',
    );

  if (basis < minimum) {
    return false;
  }

  if (
    bracket.maxBasisExclusive ===
    null
  ) {
    return true;
  }

  const maximum =
    requireNonNegativeMoney(
      bracket.maxBasisExclusive,
      'Contribution bracket maximum',
    );

  if (maximum <= minimum) {
    throw new Error(
      'Contribution bracket maximum must be greater than its minimum.',
    );
  }

  return basis < maximum;
}

function applyRate(
  basis: bigint,
  rate: bigint,
): bigint {
  return divideRoundHalfUp(
    basis * rate,
    RATE_FACTOR,
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

function contributionRateForLineItem(
  rule: GovernmentContributionRule,
): string | null {
  if (
    rule.method !==
    'PERCENTAGE_OF_BASIS'
  ) {
    return null;
  }

  return formatRate(
    parseRate(
      rule.employeeRate,
    ),
  );
}
