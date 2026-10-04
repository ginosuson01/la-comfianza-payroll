import {
  getBirWithholdingTaxRule,
  type CorePayrollCalculationResult,
  type PayrollCalculationInput,
  type StatutoryPayrollTaxResolver,
} from '@payroll/payroll-engine';

import {
  resolvePhilippineMinimumWageClassification,
  type PhilippineMinimumWageClassification,
} from './philippine-minimum-wage-policy';

import { resolvePhilippineComponentTaxTreatment } from './philippine-taxable-component-policy';

import { resolvePhilippineTaxableCompensation } from './philippine-taxable-compensation-policy';

export type PhilippineWithholdingPolicyIssueCode =
  | 'MINIMUM_WAGE_CLASSIFICATION_UNRESOLVED'
  | 'CORE_PAYROLL_INCOMPLETE'
  | 'COMPONENT_TAX_TREATMENT_UNRESOLVED';

export interface PhilippineWithholdingPolicyIssue {
  code: PhilippineWithholdingPolicyIssueCode;

  message: string;

  lineItemCode: string | null;
}

export interface BuildPhilippineWithholdingTaxResolverInput {
  payBasis: PayrollCalculationInput['payBasis'];

  baseRate: string;

  cutoffStartDate: string;

  cutoffEndDate: string;

  configSnapshot: Readonly<Record<string, unknown>>;

  corePayroll: CorePayrollCalculationResult;
}

export interface PhilippineWithholdingTaxResolverResolution {
  ready: boolean;

  classification: PhilippineMinimumWageClassification;

  issues: readonly PhilippineWithholdingPolicyIssue[];

  taxResolver: StatutoryPayrollTaxResolver | null;
}

export function buildPhilippineWithholdingTaxResolver(
  input: BuildPhilippineWithholdingTaxResolverInput,
): PhilippineWithholdingTaxResolverResolution {
  const wageClassification = resolvePhilippineMinimumWageClassification({
    payBasis: input.payBasis,

    baseRate: input.baseRate,

    cutoffStartDate: input.cutoffStartDate,

    cutoffEndDate: input.cutoffEndDate,

    configSnapshot: input.configSnapshot,
  });

  if (wageClassification.classification === 'UNRESOLVED') {
    return {
      ready: false,

      classification: wageClassification.classification,

      issues: [
        {
          code: 'MINIMUM_WAGE_CLASSIFICATION_UNRESOLVED',

          message:
            wageClassification.reason ??
            'Philippine minimum-wage classification is unresolved.',

          lineItemCode: null,
        },
      ],

      taxResolver: null,
    };
  }

  if (input.corePayroll.status !== 'COMPLETE') {
    return {
      ready: false,

      classification: wageClassification.classification,

      issues: [
        {
          code: 'CORE_PAYROLL_INCOMPLETE',

          message:
            'Core payroll must be complete before Philippine withholding tax can be resolved.',

          lineItemCode: null,
        },
      ],

      taxResolver: null,
    };
  }

  const componentIssues: PhilippineWithholdingPolicyIssue[] = [];

  for (const lineItem of input.corePayroll.lineItems) {
    const component = resolvePhilippineComponentTaxTreatment(
      wageClassification.classification,
      lineItem,
    );

    if (component.treatment !== 'UNRESOLVED') {
      continue;
    }

    componentIssues.push({
      code: 'COMPONENT_TAX_TREATMENT_UNRESOLVED',

      message:
        component.reason ?? `Tax treatment is unresolved for ${lineItem.code}.`,

      lineItemCode: lineItem.code,
    });
  }

  if (componentIssues.length > 0) {
    return {
      ready: false,

      classification: wageClassification.classification,

      issues: componentIssues,

      taxResolver: null,
    };
  }

  const classification = wageClassification.classification;

  const taxResolver: StatutoryPayrollTaxResolver = (context) => {
    const taxableCompensation = resolvePhilippineTaxableCompensation(
      classification,
      context.corePayroll,
      context.governmentContributionsTotal,
    );

    /*
     * Component taxability was preflighted above.
     *
     * Reaching an unresolved state here means the core
     * payroll presented to the late resolver differs from
     * the preflighted payroll or violates an invariant.
     */
    if (
      !taxableCompensation.ready ||
      taxableCompensation.taxableCompensation === null
    ) {
      throw new Error(
        taxableCompensation.issues[0]?.message ??
          'Philippine taxable compensation became unresolved after withholding preflight.',
      );
    }

    return {
      treatment: 'APPLY',

      taxableCompensation: taxableCompensation.taxableCompensation,

      rule: getBirWithholdingTaxRule('SEMI_MONTHLY'),
    };
  };

  return {
    ready: true,

    classification,

    issues: [],

    taxResolver,
  };
}
