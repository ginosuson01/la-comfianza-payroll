import {
  calculateCorePayroll,
  type CorePayrollCalculationOptions,
  type CorePayrollCalculationResult,
} from './core-payroll.ts';

import {
  formatMoney,
  parseMoney,
} from './fixed-decimal.ts';

import {
  calculateGovernmentContributions,
  type GovernmentContributionCode,
  type GovernmentContributionInput,
  type GovernmentContributionRule,
} from './government-contributions.ts';

import {
  type PayrollCalculationInput,
  type PayrollComputedLineItem,
} from './payroll-calculation.ts';

import {
  calculateWithholdingTax,
  type WithholdingTaxRule,
} from './withholding-tax.ts';

export type StatutoryPayrollStatus =
  | 'COMPLETE'
  | 'INCOMPLETE';

export type StatutoryPayrollIssueCode =
  | 'CORE_PAYROLL_INCOMPLETE'
  | 'MISSING_CONTRIBUTION_RESOLUTION'
  | 'MISSING_TAX_RESOLUTION';

export interface StatutoryPayrollIssue {
  code: StatutoryPayrollIssueCode;

  message: string;

  metadata:
    Readonly<Record<string, unknown>> | null;
}

export interface AppliedGovernmentContributionResolution {
  treatment:
    'APPLY';

  code:
    GovernmentContributionCode;

  description:
    string;

  basisAmount:
    string;

  rule:
    GovernmentContributionRule;
}

export interface NotApplicableGovernmentContributionResolution {
  treatment:
    'NOT_APPLICABLE';

  code:
    GovernmentContributionCode;

  description:
    string;

  reason:
    string;
}

/*
 * Contribution applies to the employee, but collection is
 * intentionally assigned to another payroll cutoff.
 *
 * This is not an exemption and must not be represented as
 * NOT_APPLICABLE.
 */
export interface DeferredGovernmentContributionResolution {
  treatment:
    'DEFERRED';

  code:
    GovernmentContributionCode;

  description:
    string;

  reason:
    string;
}

export type GovernmentContributionResolution =
  | AppliedGovernmentContributionResolution
  | NotApplicableGovernmentContributionResolution
  | DeferredGovernmentContributionResolution;

export interface AppliedWithholdingTaxResolution {
  treatment:
    'APPLY';

  taxableCompensation:
    string;

  rule:
    WithholdingTaxRule;
}

export interface NotApplicableWithholdingTaxResolution {
  treatment:
    'NOT_APPLICABLE';

  reason:
    string;
}

export type WithholdingTaxResolution =
  | AppliedWithholdingTaxResolution
  | NotApplicableWithholdingTaxResolution;

export interface StatutoryPayrollTaxResolverContext {
  corePayroll:
    CorePayrollCalculationResult;

  governmentContributionsTotal:
    string;

  employerGovernmentContributionsTotal:
    string;
}

export type StatutoryPayrollTaxResolver = (
  context: StatutoryPayrollTaxResolverContext,
) => WithholdingTaxResolution;

export interface StatutoryPayrollCalculationOptions {
  core?:
    CorePayrollCalculationOptions;

  contributions?:
    readonly GovernmentContributionResolution[];

  tax?:
    WithholdingTaxResolution;

  taxResolver?:
    StatutoryPayrollTaxResolver;
}

export interface StatutoryPayrollCalculationResult {
  employeeId:
    string;

  employmentRecordId:
    string;

  payrollStatus:
    PayrollCalculationInput['payrollStatus'];

  payoutMethod:
    PayrollCalculationInput['payoutMethod'];

  status:
    StatutoryPayrollStatus;

  issues:
    readonly StatutoryPayrollIssue[];

  corePayroll:
    CorePayrollCalculationResult;

  governmentContributionsTotal:
    string | null;

  employerGovernmentContributionsTotal:
    string | null;

  taxableCompensation:
    string | null;

  withholdingTax:
    string | null;

  taxTotal:
    string | null;

  totalDeductions:
    string | null;

  /*
   * This is the employee amount after ordinary deductions,
   * government contributions, and withholding tax.
   *
   * It is NOT yet the final payout because Step 20.4 still
   * needs to apply ACTIVE / ACTIVE_HOLD / RESIGNED,
   * Last Pay, CASH/ATM, and hold/release rules.
   */
  netPayBeforeStatusTreatment:
    string | null;

  lineItems:
    readonly PayrollComputedLineItem[];
}

const REQUIRED_CONTRIBUTION_CODES:
  readonly GovernmentContributionCode[] = [
    'SSS',
    'PHILHEALTH',
    'PAGIBIG',
  ];

export function calculateStatutoryPayroll(
  input: PayrollCalculationInput,
  options: StatutoryPayrollCalculationOptions = {},
): StatutoryPayrollCalculationResult {
  const corePayroll =
    calculateCorePayroll(
      input,
      options.core,
    );

  const issues:
    StatutoryPayrollIssue[] = [];

  if (
    corePayroll.status !==
    'COMPLETE'
  ) {
    issues.push({
      code:
        'CORE_PAYROLL_INCOMPLETE',

      message:
        'Core payroll calculation is incomplete.',

      metadata: {
        coreIssueCount:
          corePayroll.issues.length,
      },
    });
  }

  const contributionResolutions =
    resolveContributionSet(
      options.contributions,
      issues,
    );

  let governmentContributionsTotal:
    string | null = null;

  let employerGovernmentContributionsTotal:
    string | null = null;

  const statutoryLineItems:
    PayrollComputedLineItem[] = [];

  if (
    contributionResolutions !==
    null
  ) {
    const contributionInputs:
      GovernmentContributionInput[] =
        contributionResolutions
          .filter(
            (
              resolution,
            ): resolution is AppliedGovernmentContributionResolution =>
              resolution.treatment ===
              'APPLY',
          )
          .map(
            (
              resolution,
            ): GovernmentContributionInput => ({
              code:
                resolution.code,

              description:
                resolution.description,

              basisAmount:
                resolution.basisAmount,

              rule:
                resolution.rule,
            }),
          );

    const contributions =
      calculateGovernmentContributions(
        contributionInputs,
      );

    governmentContributionsTotal =
      contributions.employeeContributionTotal;

    employerGovernmentContributionsTotal =
      contributions.employerContributionTotal;

    statutoryLineItems.push(
      ...contributions.lineItems,
    );
  }

  let taxableCompensation:
    string | null = null;

  let withholdingTax:
    string | null = null;

  let taxTotal:
    string | null = null;

  if (
    options.tax &&
    options.taxResolver
  ) {
    throw new Error(
      'Provide either a withholding tax resolution or a tax resolver, not both.',
    );
  }

  const resolvedTax =
    options.taxResolver &&
    governmentContributionsTotal !== null &&
    employerGovernmentContributionsTotal !== null
      ? options.taxResolver({
          corePayroll,

          governmentContributionsTotal,

          employerGovernmentContributionsTotal,
        })
      : options.tax;

  if (!resolvedTax) {
    issues.push({
      code:
        'MISSING_TAX_RESOLUTION',

      message:
        'Withholding tax treatment must be explicitly resolved.',

      metadata:
        null,
    });
  } else if (
    resolvedTax.treatment ===
    'NOT_APPLICABLE'
  ) {
    if (
      !resolvedTax.reason.trim()
    ) {
      throw new Error(
        'Withholding tax NOT_APPLICABLE reason is required.',
      );
    }

    withholdingTax =
      '0.00';

    taxTotal =
      '0.00';
  } else {
    const tax =
      calculateWithholdingTax({
        taxableCompensation:
          resolvedTax.taxableCompensation,

        rule:
          resolvedTax.rule,
      });

    taxableCompensation =
      tax.taxableCompensation;

    withholdingTax =
      tax.withholdingTax;

    taxTotal =
      tax.withholdingTax;

    statutoryLineItems.push(
      ...tax.lineItems,
    );
  }

  const complete =
    corePayroll.status ===
      'COMPLETE' &&
    issues.length === 0 &&
    governmentContributionsTotal !==
      null &&
    withholdingTax !== null &&
    taxTotal !== null;

  let totalDeductions:
    string | null = null;

  let netPayBeforeStatusTreatment:
    string | null = null;

  if (
    complete &&
    corePayroll.otherDeductionsTotal !==
      null &&
    corePayroll.preContributionTaxPay !==
      null &&
    governmentContributionsTotal !==
      null &&
    withholdingTax !== null
  ) {
    const total =
      parseMoney(
        corePayroll.otherDeductionsTotal,
      ) +
      parseMoney(
        governmentContributionsTotal,
      ) +
      parseMoney(
        withholdingTax,
      );

    totalDeductions =
      formatMoney(total);

    netPayBeforeStatusTreatment =
      formatMoney(
        parseMoney(
          corePayroll.preContributionTaxPay,
        ) -
          parseMoney(
            governmentContributionsTotal,
          ) -
          parseMoney(
            withholdingTax,
          ),
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

    corePayroll,

    governmentContributionsTotal,

    employerGovernmentContributionsTotal,

    taxableCompensation,

    withholdingTax,

    taxTotal,

    totalDeductions,

    netPayBeforeStatusTreatment,

    lineItems: [
      ...corePayroll.lineItems,
      ...statutoryLineItems,
    ],
  };
}

function resolveContributionSet(
  resolutions:
    readonly GovernmentContributionResolution[] |
    undefined,
  issues:
    StatutoryPayrollIssue[],
): readonly GovernmentContributionResolution[] | null {
  const byCode =
    new Map<
      GovernmentContributionCode,
      GovernmentContributionResolution
    >();

  for (
    const resolution of
      resolutions ?? []
  ) {
    if (
      byCode.has(
        resolution.code,
      )
    ) {
      throw new Error(
        `Duplicate government contribution resolution: ${resolution.code}.`,
      );
    }

    if (
      !resolution.description.trim()
    ) {
      throw new Error(
        `Government contribution ${resolution.code} description is required.`,
      );
    }

    if (
      (
        resolution.treatment ===
          'NOT_APPLICABLE' ||
        resolution.treatment ===
          'DEFERRED'
      ) &&
      !resolution.reason.trim()
    ) {
      throw new Error(
        `Government contribution ${resolution.code} ${resolution.treatment} reason is required.`,
      );
    }

    byCode.set(
      resolution.code,
      resolution,
    );
  }

  for (
    const code of
      REQUIRED_CONTRIBUTION_CODES
  ) {
    if (!byCode.has(code)) {
      issues.push({
        code:
          'MISSING_CONTRIBUTION_RESOLUTION',

        message:
          `${code} contribution treatment must be explicitly resolved.`,

        metadata: {
          contributionCode:
            code,
        },
      });
    }
  }

  if (
    REQUIRED_CONTRIBUTION_CODES.some(
      (code) =>
        !byCode.has(code),
    )
  ) {
    return null;
  }

  return REQUIRED_CONTRIBUTION_CODES.map(
    (code) =>
      byCode.get(code)!,
  );
}
