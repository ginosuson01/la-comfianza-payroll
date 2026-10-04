import {
  formatMoney,
  parseMoney,
  type CorePayrollCalculationResult,
} from '@payroll/payroll-engine';

import type { PhilippineMinimumWageClassification } from './philippine-minimum-wage-policy';

import { resolvePhilippineComponentTaxTreatment } from './philippine-taxable-component-policy';

export type PhilippineTaxableCompensationIssueCode =
  | 'CORE_PAYROLL_INCOMPLETE'
  | 'UNRESOLVED_COMPONENT_TAX_TREATMENT'
  | 'INVALID_TAXABLE_EARNING';

export interface PhilippineTaxableCompensationIssue {
  code: PhilippineTaxableCompensationIssueCode;

  message: string;

  lineItemCode: string | null;
}

export interface PhilippineTaxableCompensationResolution {
  ready: boolean;

  taxableEarningsTotal: string | null;

  governmentContributionsTotal: string;

  taxableCompensation: string | null;

  issues: readonly PhilippineTaxableCompensationIssue[];
}

export function resolvePhilippineTaxableCompensation(
  classification: Exclude<PhilippineMinimumWageClassification, 'UNRESOLVED'>,
  corePayroll: CorePayrollCalculationResult,
  governmentContributionsTotal: string,
): PhilippineTaxableCompensationResolution {
  const contributions = parseMoney(governmentContributionsTotal);

  if (contributions < 0n) {
    throw new Error('Government contributions total must not be negative.');
  }

  if (corePayroll.status !== 'COMPLETE') {
    return {
      ready: false,

      taxableEarningsTotal: null,

      governmentContributionsTotal: formatMoney(contributions),

      taxableCompensation: null,

      issues: [
        {
          code: 'CORE_PAYROLL_INCOMPLETE',

          message:
            'Core payroll must be complete before Philippine taxable compensation can be resolved.',

          lineItemCode: null,
        },
      ],
    };
  }

  let taxableEarnings = 0n;

  const issues: PhilippineTaxableCompensationIssue[] = [];

  for (const lineItem of corePayroll.lineItems) {
    const taxTreatment = resolvePhilippineComponentTaxTreatment(
      classification,
      lineItem,
    );

    if (
      taxTreatment.treatment === 'IGNORE' ||
      taxTreatment.treatment === 'EXEMPT'
    ) {
      continue;
    }

    if (taxTreatment.treatment === 'UNRESOLVED') {
      issues.push({
        code: 'UNRESOLVED_COMPONENT_TAX_TREATMENT',

        message:
          taxTreatment.reason ??
          `Tax treatment is unresolved for ${lineItem.code}.`,

        lineItemCode: lineItem.code,
      });

      continue;
    }

    const amount = parseMoney(lineItem.amount);

    if (amount < 0n) {
      issues.push({
        code: 'INVALID_TAXABLE_EARNING',

        message: `Taxable earning ${lineItem.code} must not be negative.`,

        lineItemCode: lineItem.code,
      });

      continue;
    }

    taxableEarnings += amount;
  }

  if (issues.length > 0) {
    return {
      ready: false,

      taxableEarningsTotal: formatMoney(taxableEarnings),

      governmentContributionsTotal: formatMoney(contributions),

      taxableCompensation: null,

      issues,
    };
  }

  const taxableCompensation =
    taxableEarnings > contributions ? taxableEarnings - contributions : 0n;

  return {
    ready: true,

    taxableEarningsTotal: formatMoney(taxableEarnings),

    governmentContributionsTotal: formatMoney(contributions),

    taxableCompensation: formatMoney(taxableCompensation),

    issues: [],
  };
}
