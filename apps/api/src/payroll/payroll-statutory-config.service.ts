import { BadRequestException, Injectable } from '@nestjs/common';

import type {
  ContributionTableBracket,
  GovernmentContributionCode,
  GovernmentContributionResolution,
  GovernmentContributionRule,
  PayrollCalculationInput,
  StatutoryPayrollCalculationOptions,
  StatutoryPayrollTaxResolver,
  WithholdingTaxBracket,
  WithholdingTaxResolution,
  WithholdingTaxRule,
} from '@payroll/payroll-engine';

export type PayrollStatutoryConfigIssueCode =
  | 'MISSING_EMPLOYEE_CONTRIBUTION_TREATMENT'
  | 'MISSING_EMPLOYEE_CONTRIBUTION_BASIS'
  | 'MISSING_COMPANY_CONTRIBUTION_RULE'
  | 'MISSING_EMPLOYEE_TAX_TREATMENT'
  | 'MISSING_EMPLOYEE_TAXABLE_COMPENSATION'
  | 'MISSING_COMPANY_TAX_RULE';

export interface PayrollStatutoryConfigIssue {
  code: PayrollStatutoryConfigIssueCode;

  message: string;

  metadata: Readonly<Record<string, unknown>> | null;
}

export interface PayrollStatutoryConfigResolution {
  ready: boolean;

  issues: readonly PayrollStatutoryConfigIssue[];

  options: Pick<
    StatutoryPayrollCalculationOptions,
    'contributions' | 'tax' | 'taxResolver'
  >;
}

const CONTRIBUTION_CODES: readonly GovernmentContributionCode[] = [
  'SSS',
  'PHILHEALTH',
  'PAGIBIG',
];

const CONTRIBUTION_DESCRIPTIONS: Readonly<
  Record<GovernmentContributionCode, string>
> = {
  SSS: 'SSS Contribution',

  PHILHEALTH: 'PhilHealth Contribution',

  PAGIBIG: 'Pag-IBIG Contribution',
};

@Injectable()
export class PayrollStatutoryConfigService {
  resolve(input: PayrollCalculationInput): PayrollStatutoryConfigResolution {
    const issues: PayrollStatutoryConfigIssue[] = [];

    const companyStatutory = this.optionalObject(
      input.config.configSnapshot['statutory'],

      'Company statutory payroll configuration',
    );

    const companyContributionRules = this.optionalObject(
      companyStatutory?.['contributions'],

      'Company government contribution configuration',
    );

    const companyTaxRule = this.optionalObject(
      companyStatutory?.['tax'],

      'Company withholding tax configuration',
    );

    const employeeContributionConfig = input.contributionConfig;

    const contributions: GovernmentContributionResolution[] = [];

    for (const code of CONTRIBUTION_CODES) {
      const employeeResolution = employeeContributionConfig?.[code];

      if (employeeResolution === undefined) {
        issues.push({
          code: 'MISSING_EMPLOYEE_CONTRIBUTION_TREATMENT',

          message: `${code} contribution treatment is not configured for the employee.`,

          metadata: {
            contributionCode: code,
          },
        });

        continue;
      }

      const employeeConfig = this.requireObject(
        employeeResolution,

        `Employee ${code} contribution configuration`,
      );

      const treatment = this.requireTreatment(
        employeeConfig['treatment'],

        `Employee ${code} contribution treatment`,
      );

      if (treatment === 'NOT_APPLICABLE') {
        contributions.push({
          treatment: 'NOT_APPLICABLE',

          code,

          description: CONTRIBUTION_DESCRIPTIONS[code],

          reason: this.requireNonBlankString(
            employeeConfig['reason'],

            `Employee ${code} NOT_APPLICABLE reason`,
          ),
        });

        continue;
      }

      const basisAmount = employeeConfig['basisAmount'];

      if (typeof basisAmount !== 'string' || !basisAmount.trim()) {
        issues.push({
          code: 'MISSING_EMPLOYEE_CONTRIBUTION_BASIS',

          message: `${code} contribution basis amount is not configured for the employee.`,

          metadata: {
            contributionCode: code,
          },
        });

        continue;
      }

      const companyConfigValue = companyContributionRules?.[code];

      if (companyConfigValue === undefined) {
        issues.push({
          code: 'MISSING_COMPANY_CONTRIBUTION_RULE',

          message: `${code} contribution rule is not configured in the company payroll configuration.`,

          metadata: {
            contributionCode: code,
          },
        });

        continue;
      }

      const companyConfig = this.requireObject(
        companyConfigValue,

        `Company ${code} contribution configuration`,
      );

      contributions.push({
        treatment: 'APPLY',

        code,

        description:
          this.optionalNonBlankString(companyConfig['description']) ??
          CONTRIBUTION_DESCRIPTIONS[code],

        basisAmount,

        rule: this.parseContributionRule(
          companyConfig['rule'],

          code,
        ),
      });
    }

    const tax = this.resolveTax(input, companyTaxRule, issues);

    return {
      ready: issues.length === 0,

      issues,

      options: {
        contributions,

        ...(tax
          ? {
              tax,
            }
          : {}),
      },
    };
  }

  /*
   * Used when government contributions have already been
   * authoritatively resolved by the Philippine statutory
   * policy/orchestration layer.
   *
   * This deliberately bypasses the legacy employee/company
   * contribution JSON resolution while preserving the existing
   * withholding-tax validation path.
   */
  resolveWithContributionOverride(
    input: PayrollCalculationInput,

    contributions: readonly GovernmentContributionResolution[],

    taxResolver?: StatutoryPayrollTaxResolver,
  ): PayrollStatutoryConfigResolution {
    const issues: PayrollStatutoryConfigIssue[] = [];

    if (taxResolver) {
      return {
        ready: true,

        issues,

        options: {
          contributions,

          taxResolver,
        },
      };
    }

    const companyStatutory = this.optionalObject(
      input.config.configSnapshot['statutory'],

      'Company statutory payroll configuration',
    );

    const companyTaxRule = this.optionalObject(
      companyStatutory?.['tax'],

      'Company withholding tax configuration',
    );

    const tax = this.resolveTax(input, companyTaxRule, issues);

    return {
      ready: issues.length === 0,

      issues,

      options: {
        contributions,

        ...(tax
          ? {
              tax,
            }
          : {}),
      },
    };
  }

  private resolveTax(
    input: PayrollCalculationInput,

    companyTaxRule: Readonly<Record<string, unknown>> | null,

    issues: PayrollStatutoryConfigIssue[],
  ): WithholdingTaxResolution | null {
    if (!input.taxConfig) {
      issues.push({
        code: 'MISSING_EMPLOYEE_TAX_TREATMENT',

        message:
          'Withholding tax treatment is not configured for the employee.',

        metadata: null,
      });

      return null;
    }

    const treatment = this.requireTreatment(
      input.taxConfig['treatment'],

      'Employee withholding tax treatment',
    );

    if (treatment === 'NOT_APPLICABLE') {
      return {
        treatment: 'NOT_APPLICABLE',

        reason: this.requireNonBlankString(
          input.taxConfig['reason'],

          'Employee withholding tax NOT_APPLICABLE reason',
        ),
      };
    }

    const taxableCompensation = input.taxConfig['taxableCompensation'];

    if (
      typeof taxableCompensation !== 'string' ||
      !taxableCompensation.trim()
    ) {
      issues.push({
        code: 'MISSING_EMPLOYEE_TAXABLE_COMPENSATION',

        message: 'Taxable compensation is not configured for the employee.',

        metadata: null,
      });

      return null;
    }

    if (!companyTaxRule) {
      issues.push({
        code: 'MISSING_COMPANY_TAX_RULE',

        message:
          'Withholding tax rule is not configured in the company payroll configuration.',

        metadata: null,
      });

      return null;
    }

    return {
      treatment: 'APPLY',

      taxableCompensation,

      rule: this.parseTaxRule(companyTaxRule['rule']),
    };
  }

  private parseContributionRule(
    value: unknown,

    code: GovernmentContributionCode,
  ): GovernmentContributionRule {
    const rule = this.requireObject(
      value,

      `${code} contribution rule`,
    );

    const method = this.requireNonBlankString(
      rule['method'],

      `${code} contribution rule method`,
    );

    switch (method) {
      case 'FIXED_AMOUNT':
        return {
          method: 'FIXED_AMOUNT',

          employeeAmount: this.requireNonBlankString(
            rule['employeeAmount'],

            `${code} employee contribution amount`,
          ),

          ...(this.optionalNonBlankString(rule['employerAmount'])
            ? {
                employerAmount: this.optionalNonBlankString(
                  rule['employerAmount'],
                ),
              }
            : {}),
        };

      case 'PERCENTAGE_OF_BASIS':
        return {
          method: 'PERCENTAGE_OF_BASIS',

          employeeRate: this.requireNonBlankString(
            rule['employeeRate'],

            `${code} employee contribution rate`,
          ),

          ...(this.optionalNonBlankString(rule['employerRate'])
            ? {
                employerRate: this.optionalNonBlankString(rule['employerRate']),
              }
            : {}),
        };

      case 'BRACKET_TABLE':
        return {
          method: 'BRACKET_TABLE',

          brackets: this.parseContributionBrackets(
            rule['brackets'],

            code,
          ),
        };

      default:
        throw new BadRequestException(
          `Unsupported ${code} contribution rule method: ${method}.`,
        );
    }
  }

  private parseContributionBrackets(
    value: unknown,

    code: GovernmentContributionCode,
  ): readonly ContributionTableBracket[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException(
        `${code} contribution brackets must be an array.`,
      );
    }

    return value.map((bracketValue, index) => {
      const bracket = this.requireObject(
        bracketValue,

        `${code} contribution bracket ${index + 1}`,
      );

      const maximum = bracket['maxBasisExclusive'];

      if (maximum !== null && typeof maximum !== 'string') {
        throw new BadRequestException(
          `${code} contribution bracket ${index + 1} maximum must be a decimal string or null.`,
        );
      }

      return {
        minBasisInclusive: this.requireNonBlankString(
          bracket['minBasisInclusive'],

          `${code} contribution bracket ${index + 1} minimum`,
        ),

        maxBasisExclusive: maximum,

        employeeAmount: this.requireNonBlankString(
          bracket['employeeAmount'],

          `${code} contribution bracket ${index + 1} employee amount`,
        ),

        ...(this.optionalNonBlankString(bracket['employerAmount'])
          ? {
              employerAmount: this.optionalNonBlankString(
                bracket['employerAmount'],
              ),
            }
          : {}),
      };
    });
  }

  private parseTaxRule(value: unknown): WithholdingTaxRule {
    const rule = this.requireObject(
      value,

      'Withholding tax rule',
    );

    const method = this.requireNonBlankString(
      rule['method'],

      'Withholding tax rule method',
    );

    switch (method) {
      case 'FIXED_AMOUNT':
        return {
          method: 'FIXED_AMOUNT',

          amount: this.requireNonBlankString(
            rule['amount'],

            'Fixed withholding tax amount',
          ),
        };

      case 'PROGRESSIVE_TABLE':
        return {
          method: 'PROGRESSIVE_TABLE',

          brackets: this.parseTaxBrackets(rule['brackets']),
        };

      default:
        throw new BadRequestException(
          `Unsupported withholding tax rule method: ${method}.`,
        );
    }
  }

  private parseTaxBrackets(value: unknown): readonly WithholdingTaxBracket[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException(
        'Withholding tax brackets must be an array.',
      );
    }

    return value.map((bracketValue, index) => {
      const bracket = this.requireObject(
        bracketValue,

        `Withholding tax bracket ${index + 1}`,
      );

      const maximum = bracket['maxExclusive'];

      if (maximum !== null && typeof maximum !== 'string') {
        throw new BadRequestException(
          `Withholding tax bracket ${index + 1} maximum must be a decimal string or null.`,
        );
      }

      return {
        minInclusive: this.requireNonBlankString(
          bracket['minInclusive'],

          `Withholding tax bracket ${index + 1} minimum`,
        ),

        maxExclusive: maximum,

        baseTax: this.requireNonBlankString(
          bracket['baseTax'],

          `Withholding tax bracket ${index + 1} base tax`,
        ),

        rateOnExcess: this.requireNonBlankString(
          bracket['rateOnExcess'],

          `Withholding tax bracket ${index + 1} rate on excess`,
        ),
      };
    });
  }

  private requireTreatment(
    value: unknown,

    fieldName: string,
  ): 'APPLY' | 'NOT_APPLICABLE' {
    if (value === 'APPLY' || value === 'NOT_APPLICABLE') {
      return value;
    }

    throw new BadRequestException(
      `${fieldName} must be APPLY or NOT_APPLICABLE.`,
    );
  }

  private requireObject(
    value: unknown,

    fieldName: string,
  ): Readonly<Record<string, unknown>> {
    if (value === null || Array.isArray(value) || typeof value !== 'object') {
      throw new BadRequestException(`${fieldName} must be a JSON object.`);
    }

    return value as Readonly<Record<string, unknown>>;
  }

  private optionalObject(
    value: unknown,

    fieldName: string,
  ): Readonly<Record<string, unknown>> | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.requireObject(value, fieldName);
  }

  private requireNonBlankString(
    value: unknown,

    fieldName: string,
  ): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required.`);
    }

    return value;
  }

  private optionalNonBlankString(value: unknown): string | undefined {
    if (typeof value !== 'string' || !value.trim()) {
      return undefined;
    }

    return value;
  }
}
