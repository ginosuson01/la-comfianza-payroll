import type {
  PremiumMultiplierRule,
  ProgressiveWithholdingTaxRule,
} from '@payroll/payroll-engine';

export type GoldenPayrollConfigSchemaVersion = 1;

export type PhilippineWithholdingPeriod =
  | 'DAILY'
  | 'WEEKLY'
  | 'SEMI_MONTHLY'
  | 'MONTHLY';

export interface PhilippineSssStatutoryConfig {
  effectiveFrom: string;

  minimumMsc: string;
  maximumMsc: string;

  mscStep: string;
  mscMidpoint: string;

  /*
   * Regular Social Security MSC is capped separately from the
   * Mandatory Provident Fund / MySSS Pension Booster portion.
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

export interface PhilippinePhilHealthStatutoryConfig {
  effectiveFrom: string;

  salaryFloor: string;
  salaryCeiling: string;

  premiumRate: string;

  employeeShareRate: string;
  employerShareRate: string;

  oddCentavoRecipient: 'EMPLOYER';
}

export interface PhilippinePagIbigStatutoryConfig {
  effectiveFrom: string;

  maximumFundSalary: string;

  employeeRateThreshold: string;

  lowerEmployeeRate: string;
  upperEmployeeRate: string;

  employerRate: string;
}

export interface PhilippineWithholdingTaxStatutoryConfig {
  effectiveFrom: string;

  rules: Readonly<
    Record<
      PhilippineWithholdingPeriod,
      ProgressiveWithholdingTaxRule
    >
  >;
}

export interface PhilippineAnnualIncomeTaxStatutoryConfig {
  effectiveFrom: string;

  rule: ProgressiveWithholdingTaxRule;
}

export interface PhilippineThirteenthMonthOtherBenefitsTaxConfig {
  effectiveFrom: string;

  taxExemptCeiling: string;
}

export type PhilippineDeMinimisLimit =
  | {
      type: 'DAYS_PER_YEAR';
      days: number;
    }
  | {
      type: 'AMOUNT_PER_MONTH';
      amount: string;
    }
  | {
      type: 'AMOUNT_PER_YEAR';
      amount: string;
    }
  | {
      type: 'AMOUNT_PER_SEMESTER_OR_MONTH';
      amountPerSemester: string;
      amountPerMonth: string;
    }
  | {
      type: 'PERCENT_OF_REGIONAL_BASIC_MINIMUM_WAGE_PER_DAY';
      rate: string;
    };

export interface PhilippineDeMinimisBenefitRule {
  code: string;

  description: string;

  limit: PhilippineDeMinimisLimit;
}

export interface PhilippineDeMinimisStatutoryConfig {
  effectiveFrom: string;

  benefits: readonly PhilippineDeMinimisBenefitRule[];
}

export interface PhilippineTaxStatutoryConfig {
  withholding: PhilippineWithholdingTaxStatutoryConfig;

  annualIncomeTax: PhilippineAnnualIncomeTaxStatutoryConfig;

  thirteenthMonthOtherBenefits:
    PhilippineThirteenthMonthOtherBenefitsTaxConfig;

  deMinimis: PhilippineDeMinimisStatutoryConfig;
}

export interface PhilippineMinimumWageReference {
  regionCode: string;

  wageOrderCode: string;

  areaClassification: string;

  sector: string;

  dailyRate: string;

  rateEffectiveFrom: string;
}

export interface PhilippinePremiumStatutoryConfig {
  regularWorkRules: Readonly<
    Record<string, PremiumMultiplierRule>
  >;

  overtimeRules: Readonly<
    Record<string, PremiumMultiplierRule>
  >;

  /*
   * Philippine Night Differential is applied against the
   * applicable hourly rate. It is intentionally not represented
   * as the generic PremiumPayOptions.nightDifferentialRule.
   */
  nightDifferentialRate: string;
}

export interface GoldenPayrollTemplateConfigV1 {
  schemaVersion: GoldenPayrollConfigSchemaVersion;

  jurisdiction: 'PH';

  statutory: {
    sss: PhilippineSssStatutoryConfig;

    philHealth: PhilippinePhilHealthStatutoryConfig;

    pagIbig: PhilippinePagIbigStatutoryConfig;

    tax: PhilippineTaxStatutoryConfig;

    minimumWageReferences:
      readonly PhilippineMinimumWageReference[];

    premium: PhilippinePremiumStatutoryConfig;
  };
}

export type GoldenPayrollTemplateConfig =
  GoldenPayrollTemplateConfigV1;
