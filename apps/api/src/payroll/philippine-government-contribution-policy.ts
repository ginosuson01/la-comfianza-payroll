import {
  calculatePagIbigContribution,
  calculatePhilHealthContribution,
  calculateSssContribution,
  getSemiMonthlyGovernmentContributionCodes,
  type GovernmentContributionCode,
  type GovernmentContributionResolution,
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
}

export function buildPhilippineGovernmentContributionResolutions(
  input: BuildPhilippineGovernmentContributionInput,
): readonly GovernmentContributionResolution[] {
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
        );

      case 'PHILHEALTH':
        return buildPhilHealthResolution(
          requireBasis(
            input.basis.philHealthMonthlyBasicSalary,

            'PhilHealth monthly basic salary',
          ),
        );

      case 'PAGIBIG':
        return buildPagIbigResolution(
          requireBasis(
            input.basis.pagIbigMonthlyCompensation,

            'Pag-IBIG monthly compensation',
          ),
        );
    }
  });
}

function buildSssResolution(
  monthlyCompensation: string,
): GovernmentContributionResolution {
  const result = calculateSssContribution(monthlyCompensation);

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
): GovernmentContributionResolution {
  const result = calculatePhilHealthContribution(monthlyBasicSalary);

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
): GovernmentContributionResolution {
  const result = calculatePagIbigContribution(monthlyCompensation);

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

function requireBasis(value: string | undefined, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `${fieldName} is required on the cutoff where the contribution is collected.`,
    );
  }

  return value;
}
