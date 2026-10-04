import { buildPhilippineGovernmentContributionResolutions } from './philippine-government-contribution-policy';

describe('Philippine government contribution policy', () => {
  it('collects PhilHealth and Pag-IBIG on FIRST and defers SSS', () => {
    const result = buildPhilippineGovernmentContributionResolutions({
      cutoffPosition: 'FIRST',

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

        basis: {},
      }),
    ).toThrow(/SSS monthly compensation is required/);
  });
});
