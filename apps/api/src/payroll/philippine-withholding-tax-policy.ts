import {
  type CorePayrollCalculationResult,
  type PayrollCalculationInput,
  type ProgressiveWithholdingTaxRule,
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

function readSemiMonthlyWithholdingRule(
  configSnapshot: Readonly<Record<string, unknown>>,
): ProgressiveWithholdingTaxRule {
  const statutory = requireObject(
    configSnapshot['statutory'],
    'Company statutory payroll configuration',
  );

  const tax = requireObject(
    statutory['tax'],
    'Philippine tax configuration',
  );

  const withholding = requireObject(
    tax['withholding'],
    'Philippine withholding-tax configuration',
  );

  const rules = requireObject(
    withholding['rules'],
    'Philippine withholding-tax rules',
  );

  const semiMonthly = requireObject(
    rules['SEMI_MONTHLY'],
    'Philippine semi-monthly withholding-tax rule',
  );

  return semiMonthly as unknown as ProgressiveWithholdingTaxRule;
}

function requireObject(
  value: unknown,
  fieldName: string,
): Readonly<Record<string, unknown>> {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== 'object'
  ) {
    throw new Error(
      `${fieldName} must be present as an object in the frozen payroll configuration snapshot.`,
    );
  }

  return value as Readonly<Record<string, unknown>>;
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

  const withholdingRule = readSemiMonthlyWithholdingRule(
    input.configSnapshot,
  );

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

      rule: withholdingRule,
    };
  };

  return {
    ready: true,

    classification,

    issues: [],

    taxResolver,
  };
}
