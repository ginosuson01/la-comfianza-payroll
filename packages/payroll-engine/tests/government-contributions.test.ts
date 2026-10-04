import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateGovernmentContributions,
} from '../src/index.ts';

test('calculates fixed employee and employer contribution amounts', () => {
  const result =
    calculateGovernmentContributions([
      {
        code:
          'SSS',

        description:
          'SSS Contribution',

        basisAmount:
          '20000.00',

        rule: {
          method:
            'FIXED_AMOUNT',

          employeeAmount:
            '900.00',

          employerAmount:
            '1900.00',
        },
      },
    ]);

  assert.equal(
    result.employeeContributionTotal,
    '900.00',
  );

  assert.equal(
    result.employerContributionTotal,
    '1900.00',
  );

  assert.equal(
    result.lineItems[0]?.category,
    'CONTRIBUTION',
  );
});

test('calculates a percentage contribution from an explicit basis', () => {
  const result =
    calculateGovernmentContributions([
      {
        code:
          'PHILHEALTH',

        description:
          'PhilHealth Contribution',

        basisAmount:
          '10000.00',

        rule: {
          method:
            'PERCENTAGE_OF_BASIS',

          employeeRate:
            '0.0250',

          employerRate:
            '0.0250',
        },
      },
    ]);

  assert.equal(
    result.employeeContributionTotal,
    '250.00',
  );

  assert.equal(
    result.employerContributionTotal,
    '250.00',
  );

  assert.equal(
    result.lineItems[0]?.rate,
    '0.0250',
  );
});

test('selects a contribution table bracket by explicit basis', () => {
  const result =
    calculateGovernmentContributions([
      {
        code:
          'PAGIBIG',

        description:
          'Pag-IBIG Contribution',

        basisAmount:
          '7500.00',

        rule: {
          method:
            'BRACKET_TABLE',

          brackets: [
            {
              minBasisInclusive:
                '0.00',

              maxBasisExclusive:
                '5000.00',

              employeeAmount:
                '50.00',

              employerAmount:
                '50.00',
            },

            {
              minBasisInclusive:
                '5000.00',

              maxBasisExclusive:
                null,

              employeeAmount:
                '100.00',

              employerAmount:
                '100.00',
            },
          ],
        },
      },
    ]);

  assert.equal(
    result.employeeContributionTotal,
    '100.00',
  );

  assert.equal(
    result.employerContributionTotal,
    '100.00',
  );
});

test('adds multiple government contributions exactly', () => {
  const result =
    calculateGovernmentContributions([
      {
        code:
          'SSS',

        description:
          'SSS Contribution',

        basisAmount:
          '10000.00',

        rule: {
          method:
            'FIXED_AMOUNT',

          employeeAmount:
            '123.45',
        },
      },

      {
        code:
          'PHILHEALTH',

        description:
          'PhilHealth Contribution',

        basisAmount:
          '10000.00',

        rule: {
          method:
            'FIXED_AMOUNT',

          employeeAmount:
            '234.56',
        },
      },

      {
        code:
          'PAGIBIG',

        description:
          'Pag-IBIG Contribution',

        basisAmount:
          '10000.00',

        rule: {
          method:
            'FIXED_AMOUNT',

          employeeAmount:
            '345.67',
        },
      },
    ]);

  assert.equal(
    result.employeeContributionTotal,
    '703.68',
  );
});

test('rejects a contribution table with no matching bracket', () => {
  assert.throws(
    () =>
      calculateGovernmentContributions([
        {
          code:
            'SSS',

          description:
            'SSS Contribution',

          basisAmount:
            '5000.00',

          rule: {
            method:
              'BRACKET_TABLE',

            brackets: [
              {
                minBasisInclusive:
                  '0.00',

                maxBasisExclusive:
                  '1000.00',

                employeeAmount:
                  '100.00',
              },
            ],
          },
        },
      ]),

    /has no bracket for basis/,
  );
});
