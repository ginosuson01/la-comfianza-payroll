import { createValidGoldenPayrollTemplateConfig } from '../companies/golden-payroll-template.test-fixture';
import { buildPhilippineGovernmentContributionResolutions } from './philippine-government-contribution-policy';

function createConfigSnapshot(): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(createValidGoldenPayrollTemplateConfig()),
  ) as Record<string, unknown>;
}

describe('Philippine government contribution policy', () => {
  it('collects PhilHealth and Pag-IBIG on FIRST and defers SSS', () => {
    const result = buildPhilippineGovernmentContributionResolutions({
      cutoffPosition: 'FIRST',

      configSnapshot: createConfigSnapshot(),

      basis: {
        philHealthMonthlyBasicSalary: '13050.00',

        pagIbigMonthlyCompensation: '12000.00',
      },
    });

    expect(result).toEqual([
      {
        treatment: 'DEFERRED',

        code: 'SSS',

        description: 'SSS Contribution',

        reason:
          'SSS is collected on the SECOND semi-monthly cutoff under the approved contribution allocation policy.',
      },

      {
        treatment: 'APPLY',

        code: 'PHILHEALTH',

        description: 'PhilHealth Contribution',

        basisAmount: '13050.00',

        rule: {
          method: 'FIXED_AMOUNT',

          employeeAmount: '326.25',

          employerAmount: '326.25',
        },
      },

      {
        treatment: 'APPLY',

        code: 'PAGIBIG',

        description: 'Pag-IBIG Contribution',

        basisAmount: '10000.00',

        rule: {
          method: 'FIXED_AMOUNT',

          employeeAmount: '200.00',

          employerAmount: '200.00',
        },
      },
    ]);
  });

  it('collects SSS on SECOND and defers PhilHealth and Pag-IBIG', () => {
    const result = buildPhilippineGovernmentContributionResolutions({
      cutoffPosition: 'SECOND',

      configSnapshot: createConfigSnapshot(),

      basis: {
        sssMonthlyCompensation: '12000.00',
      },
    });

    expect(result).toEqual([
      {
        treatment: 'APPLY',

        code: 'SSS',

        description: 'SSS Contribution',

        basisAmount: '12000.00',

        rule: {
          method: 'FIXED_AMOUNT',

          employeeAmount: '600.00',

          employerAmount: '1210.00',
        },
      },

      {
        treatment: 'DEFERRED',

        code: 'PHILHEALTH',

        description: 'PhilHealth Contribution',

        reason:
          'PHILHEALTH is collected on the FIRST semi-monthly cutoff under the approved contribution allocation policy.',
      },

      {
        treatment: 'DEFERRED',

        code: 'PAGIBIG',

        description: 'Pag-IBIG Contribution',

        reason:
          'PAGIBIG is collected on the FIRST semi-monthly cutoff under the approved contribution allocation policy.',
      },
    ]);
  });

  it('does not require a basis for a deferred contribution', () => {
    expect(() =>
      buildPhilippineGovernmentContributionResolutions({
        cutoffPosition: 'SECOND',

        configSnapshot: createConfigSnapshot(),

        basis: {
          sssMonthlyCompensation: '12000.00',
        },
      }),
    ).not.toThrow();
  });

  it('requires Pag-IBIG monthly compensation on FIRST', () => {
    expect(() =>
      buildPhilippineGovernmentContributionResolutions({
        cutoffPosition: 'FIRST',

        configSnapshot: createConfigSnapshot(),

        basis: {
          philHealthMonthlyBasicSalary: '13050.00',
        },
      }),
    ).toThrow(/Pag-IBIG monthly compensation is required/);
  });

  it('requires SSS monthly compensation on SECOND', () => {
    expect(() =>
      buildPhilippineGovernmentContributionResolutions({
        cutoffPosition: 'SECOND',

        configSnapshot: createConfigSnapshot(),

        basis: {},
      }),
    ).toThrow(/SSS monthly compensation is required/);
  });

  it('uses SSS rates from the frozen company payroll config snapshot', () => {
    const configSnapshot = createConfigSnapshot();

    const statutory =
      configSnapshot['statutory'] as Record<string, unknown>;

    const sss =
      statutory['sss'] as Record<string, unknown>;

    sss['employeeRate'] = '0.0400';
    sss['employerRate'] = '0.0900';

    const result = buildPhilippineGovernmentContributionResolutions({
      cutoffPosition: 'SECOND',

      configSnapshot,

      basis: {
        sssMonthlyCompensation: '12000.00',
      },
    });

    expect(result[0]).toEqual({
      treatment: 'APPLY',

      code: 'SSS',

      description: 'SSS Contribution',

      basisAmount: '12000.00',

      rule: {
        method: 'FIXED_AMOUNT',

        employeeAmount: '480.00',

        employerAmount: '1090.00',
      },
    });
  });

  it('uses PhilHealth and Pag-IBIG rates from the frozen company payroll config snapshot', () => {
    const configSnapshot = createConfigSnapshot();

    const statutory =
      configSnapshot['statutory'] as Record<string, unknown>;

    const philHealth =
      statutory['philHealth'] as Record<string, unknown>;

    philHealth['premiumRate'] = '0.0400';

    const pagIbig =
      statutory['pagIbig'] as Record<string, unknown>;

    pagIbig['maximumFundSalary'] = '8000.00';
    pagIbig['upperEmployeeRate'] = '0.0150';
    pagIbig['employerRate'] = '0.0250';

    const result = buildPhilippineGovernmentContributionResolutions({
      cutoffPosition: 'FIRST',

      configSnapshot,

      basis: {
        philHealthMonthlyBasicSalary: '20000.00',

        pagIbigMonthlyCompensation: '15000.00',
      },
    });

    expect(result[1]).toEqual({
      treatment: 'APPLY',

      code: 'PHILHEALTH',

      description: 'PhilHealth Contribution',

      basisAmount: '20000.00',

      rule: {
        method: 'FIXED_AMOUNT',

        employeeAmount: '400.00',

        employerAmount: '400.00',
      },
    });

    expect(result[2]).toEqual({
      treatment: 'APPLY',

      code: 'PAGIBIG',

      description: 'Pag-IBIG Contribution',

      basisAmount: '8000.00',

      rule: {
        method: 'FIXED_AMOUNT',

        employeeAmount: '120.00',

        employerAmount: '200.00',
      },
    });
  });

  it('rejects a frozen config snapshot without statutory contribution rules', () => {
    expect(() =>
      buildPhilippineGovernmentContributionResolutions({
        cutoffPosition: 'SECOND',

        configSnapshot: {},

        basis: {
          sssMonthlyCompensation: '12000.00',
        },
      }),
    ).toThrow(
      /Company statutory payroll configuration must be present as an object/,
    );
  });

});
