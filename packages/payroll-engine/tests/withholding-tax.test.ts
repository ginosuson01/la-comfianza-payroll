import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateWithholdingTax,
} from '../src/index.ts';

test('calculates a configured fixed withholding tax', () => {
  const result =
    calculateWithholdingTax({
      taxableCompensation:
        '10000.00',

      rule: {
        method:
          'FIXED_AMOUNT',

        amount:
          '250.00',
      },
    });

  assert.equal(
    result.withholdingTax,
    '250.00',
  );

  assert.equal(
    result.lineItems[0]?.category,
    'TAX',
  );
});

test('calculates tax from a progressive bracket', () => {
  const result =
    calculateWithholdingTax({
      taxableCompensation:
        '15000.00',

      rule: {
        method:
          'PROGRESSIVE_TABLE',

        brackets: [
          {
            minInclusive:
              '0.00',

            maxExclusive:
              '10000.00',

            baseTax:
              '0.00',

            rateOnExcess:
              '0.0000',
          },

          {
            minInclusive:
              '10000.00',

            maxExclusive:
              '20000.00',

            baseTax:
              '0.00',

            rateOnExcess:
              '0.1000',
          },

          {
            minInclusive:
              '20000.00',

            maxExclusive:
              null,

            baseTax:
              '1000.00',

            rateOnExcess:
              '0.2000',
          },
        ],
      },
    });

  /*
   * Synthetic test table only:
   *
   * (15,000 - 10,000) × 10% = 500
   */
  assert.equal(
    result.withholdingTax,
    '500.00',
  );

  assert.equal(
    result.lineItems[0]?.rate,
    '0.1000',
  );
});

test('supports an open-ended progressive tax bracket', () => {
  const result =
    calculateWithholdingTax({
      taxableCompensation:
        '25000.00',

      rule: {
        method:
          'PROGRESSIVE_TABLE',

        brackets: [
          {
            minInclusive:
              '0.00',

            maxExclusive:
              '20000.00',

            baseTax:
              '0.00',

            rateOnExcess:
              '0.0000',
          },

          {
            minInclusive:
              '20000.00',

            maxExclusive:
              null,

            baseTax:
              '1000.00',

            rateOnExcess:
              '0.2000',
          },
        ],
      },
    });

  /*
   * Synthetic test table only:
   *
   * 1,000 base
   * + (25,000 - 20,000) × 20%
   * = 2,000
   */
  assert.equal(
    result.withholdingTax,
    '2000.00',
  );
});

test('allows zero withholding tax', () => {
  const result =
    calculateWithholdingTax({
      taxableCompensation:
        '5000.00',

      rule: {
        method:
          'FIXED_AMOUNT',

        amount:
          '0.00',
      },
    });

  assert.equal(
    result.withholdingTax,
    '0.00',
  );
});

test('rejects a tax table with no matching bracket', () => {
  assert.throws(
    () =>
      calculateWithholdingTax({
        taxableCompensation:
          '50000.00',

        rule: {
          method:
            'PROGRESSIVE_TABLE',

          brackets: [
            {
              minInclusive:
                '0.00',

              maxExclusive:
                '10000.00',

              baseTax:
                '0.00',

              rateOnExcess:
                '0.0000',
            },
          ],
        },
      }),

    /has no bracket for taxable compensation/,
  );
});
