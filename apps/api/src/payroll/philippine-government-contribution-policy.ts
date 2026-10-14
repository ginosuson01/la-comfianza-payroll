import {
  calculatePagIbigContribution,
  calculatePhilHealthContribution,
  calculateSssContribution,
  getSemiMonthlyGovernmentContributionCodes,
  type GovernmentContributionCode,
  type GovernmentContributionResolution,
  type PagIbigContributionRule,
  type PhilHealthContributionRule,
  type SssContributionRule,
} from '@payroll/payroll-engine';

import type { SemiMonthlyCutoffPosition } from './payroll-cutoff-period.service';

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

export interface PhilippineGovernmentContributionBasis {
  /*
   * SSS:
   * total monthly compensation/remuneration basis.
   *
   * Required only when SSS is collected on this cutoff.
   */
  sssMonthlyCompensation?: string;

  /*
   * PhilHealth:
   * statutory Monthly Basic Salary.
   *
   * Required only when PhilHealth is collected on this cutoff.
   */
  philHealthMonthlyBasicSalary?: string;

  /*
   * Pag-IBIG:
   * statutory monthly compensation.
   *
   * Required only when Pag-IBIG is collected on this cutoff.
   */
  pagIbigMonthlyCompensation?: string;
}

export interface BuildPhilippineGovernmentContributionInput {
  cutoffPosition: SemiMonthlyCutoffPosition;

  basis: PhilippineGovernmentContributionBasis;

  configSnapshot: Readonly<Record<string, unknown>>;
}

export function buildPhilippineGovernmentContributionResolutions(
  input: BuildPhilippineGovernmentContributionInput,
): readonly GovernmentContributionResolution[] {
  const rules = readContributionRules(input.configSnapshot);

  const collectedCodes = new Set<GovernmentContributionCode>(
    getSemiMonthlyGovernmentContributionCodes(input.cutoffPosition),
  );

  return CONTRIBUTION_CODES.map((code): GovernmentContributionResolution => {
    if (!collectedCodes.has(code)) {
      return {
        treatment: 'DEFERRED',

        code,

        description: CONTRIBUTION_DESCRIPTIONS[code],

        reason: `${code} is collected on the ${
          input.cutoffPosition === 'FIRST' ? 'SECOND' : 'FIRST'
        } semi-monthly cutoff under the approved contribution allocation policy.`,
      };
    }

    switch (code) {
      case 'SSS':
        return buildSssResolution(
          requireBasis(
            input.basis.sssMonthlyCompensation,

            'SSS monthly compensation',
          ),

          rules.sss,
        );

      case 'PHILHEALTH':
        return buildPhilHealthResolution(
          requireBasis(
            input.basis.philHealthMonthlyBasicSalary,

            'PhilHealth monthly basic salary',
          ),

          rules.philHealth,
        );

      case 'PAGIBIG':
        return buildPagIbigResolution(
          requireBasis(
            input.basis.pagIbigMonthlyCompensation,

            'Pag-IBIG monthly compensation',
          ),

          rules.pagIbig,
        );
    }
  });
}

function buildSssResolution(
  monthlyCompensation: string,
  rule: SssContributionRule,
): GovernmentContributionResolution {
  const result = calculateSssContribution(
    monthlyCompensation,
    rule,
  );

  return {
    treatment: 'APPLY',

    code: 'SSS',

    description: CONTRIBUTION_DESCRIPTIONS.SSS,

    /*
     * The calculated MSC is the contribution basis
     * actually used by the current SSS schedule.
     */
    basisAmount: result.monthlySalaryCredit,

    rule: {
      method: 'FIXED_AMOUNT',

      employeeAmount: result.employeeShare,

      employerAmount: result.employerTotal,
    },
  };
}

function buildPhilHealthResolution(
  monthlyBasicSalary: string,
  rule: PhilHealthContributionRule,
): GovernmentContributionResolution {
  const result = calculatePhilHealthContribution(
    monthlyBasicSalary,
    rule,
  );

  return {
    treatment: 'APPLY',

    code: 'PHILHEALTH',

    description: CONTRIBUTION_DESCRIPTIONS.PHILHEALTH,

    basisAmount: result.contributionBasis,

    rule: {
      method: 'FIXED_AMOUNT',

      employeeAmount: result.employeeShare,

      employerAmount: result.employerShare,
    },
  };
}

function buildPagIbigResolution(
  monthlyCompensation: string,
  rule: PagIbigContributionRule,
): GovernmentContributionResolution {
  const result = calculatePagIbigContribution(
    monthlyCompensation,
    rule,
  );

  return {
    treatment: 'APPLY',

    code: 'PAGIBIG',

    description: CONTRIBUTION_DESCRIPTIONS.PAGIBIG,

    basisAmount: result.monthlyFundSalary,

    rule: {
      method: 'FIXED_AMOUNT',

      employeeAmount: result.employeeShare,

      employerAmount: result.employerShare,
    },
  };
}

interface PhilippineGovernmentContributionRules {
  sss: SssContributionRule;

  philHealth: PhilHealthContributionRule;

  pagIbig: PagIbigContributionRule;
}

function readContributionRules(
  configSnapshot: Readonly<Record<string, unknown>>,
): PhilippineGovernmentContributionRules {
  const statutory = requireObject(
    configSnapshot['statutory'],
    'Company statutory payroll configuration',
  );

  return {
    sss: requireObject(
      statutory['sss'],
      'SSS statutory configuration',
    ) as unknown as SssContributionRule,

    philHealth: requireObject(
      statutory['philHealth'],
      'PhilHealth statutory configuration',
    ) as unknown as PhilHealthContributionRule,

    pagIbig: requireObject(
      statutory['pagIbig'],
      'Pag-IBIG statutory configuration',
    ) as unknown as PagIbigContributionRule,
  };
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

function requireBasis(value: string | undefined, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `${fieldName} is required on the cutoff where the contribution is collected.`,
    );
  }

  return value;
}
