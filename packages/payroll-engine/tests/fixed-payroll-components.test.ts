import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateFixedPayrollComponents,
  summarizeAttendance,
  type PayrollCalculationInput,
} from '../src/index.ts';

function createInput(
  overrides: Partial<PayrollCalculationInput> = {},
): PayrollCalculationInput {
  return {
    employeeId: 'employee-1',

    employmentRecordId: 'employment-1',

    employeeNumber: 'EMP-001',

    employeeName: 'Juan Dela Cruz',

    payrollStatus: 'ACTIVE',

    payoutMethod: 'ATM',

    payoutAccountLast4: '1234',

    payBasis: 'DAILY',

    baseRate: '537.5000',

    attendance: summarizeAttendance([]),

    recurringItems: [],

    adjustments: [],

    contributionConfig: null,

    taxConfig: null,

    config: {
      companyPayrollSetupVersionId: 'setup-version-1',

      version: 1,

      standardWorkMinutesPerDay: 480,

      configSnapshot: {},
    },

    ...overrides,
  };
}

test('returns zero fixed payroll totals when no fixed items exist', () => {
  const result =
    calculateFixedPayrollComponents(
      createInput(),
    );

  assert.equal(
    result.allowancesTotal,
    '0.00',
  );

  assert.equal(
    result.fixedDeductionsTotal,
    '0.00',
  );

  assert.equal(
    result.earningAdjustmentsTotal,
    '0.00',
  );

  assert.equal(
    result.deductionAdjustmentsTotal,
    '0.00',
  );

  assert.equal(
    result.additionalEarningsTotal,
    '0.00',
  );

  assert.equal(
    result.otherDeductionsTotal,
    '0.00',
  );

  assert.deepEqual(
    result.lineItems,
    [],
  );
});

test('calculates recurring allowances and fixed deductions', () => {
  const result =
    calculateFixedPayrollComponents(
      createInput({
        recurringItems: [
          {
            code: 'MEAL',

            description:
              'Meal Allowance',

            kind:
              'ALLOWANCE',

            amount:
              '500.00',

            taxable:
              false,
          },

          {
            code:
              'TRANSPORT',

            description:
              'Transportation Allowance',

            kind:
              'ALLOWANCE',

            amount:
              '250.25',

            taxable:
              true,
          },

          {
            code:
              'MEDICAL',

            description:
              'Medical Deduction',

            kind:
              'FIXED_DEDUCTION',

            amount:
              '100.00',

            taxable:
              false,
          },
        ],
      }),
    );

  assert.equal(
    result.allowancesTotal,
    '750.25',
  );

  assert.equal(
    result.taxableAllowancesTotal,
    '250.25',
  );

  assert.equal(
    result.fixedDeductionsTotal,
    '100.00',
  );

  assert.equal(
    result.additionalEarningsTotal,
    '750.25',
  );

  assert.equal(
    result.otherDeductionsTotal,
    '100.00',
  );
});

test('calculates earning and deduction adjustments separately', () => {
  const result =
    calculateFixedPayrollComponents(
      createInput({
        adjustments: [
          {
            code: 'ADJ-EARN-1',

            description:
              'Approved earning adjustment',

            type:
              'EARNING',

            amount:
              '100.10',

            taxable:
              true,

            reason:
              'Payroll correction',
          },

          {
            code: 'ADJ-EARN-2',

            description:
              'Second earning adjustment',

            type:
              'EARNING',

            amount:
              '50.05',

            taxable:
              null,

            reason:
              'Payroll correction',
          },

          {
            code: 'ADJ-DED-1',

            description:
              'Approved deduction adjustment',

            type:
              'DEDUCTION',

            amount:
              '25.15',

            taxable:
              false,

            reason:
              'Payroll correction',
          },
        ],
      }),
    );

  assert.equal(
    result.earningAdjustmentsTotal,
    '150.15',
  );

  assert.equal(
    result.deductionAdjustmentsTotal,
    '25.15',
  );

  assert.equal(
    result.additionalEarningsTotal,
    '150.15',
  );

  assert.equal(
    result.otherDeductionsTotal,
    '25.15',
  );

  assert.equal(
    result.lineItems[0]?.taxable,
    true,
  );

  assert.equal(
    result.lineItems[1]?.taxable,
    null,
  );

  assert.equal(
    result.lineItems[2]?.taxable,
    false,
  );
});

test('creates payroll line items for recurring items and adjustments', () => {
  const result =
    calculateFixedPayrollComponents(
      createInput({
        recurringItems: [
          {
            code: 'MEAL',

            description:
              'Meal Allowance',

            kind:
              'ALLOWANCE',

            amount:
              '500.00',

            taxable:
              true,
          },

          {
            code: 'MEDICAL',

            description:
              'Medical Deduction',

            kind:
              'FIXED_DEDUCTION',

            amount:
              '100.00',

            taxable:
              false,
          },
        ],

        adjustments: [
          {
            code: 'ADJ-001',

            description:
              'Approved adjustment',

            type:
              'EARNING',

            amount:
              '50.00',

            taxable:
              true,

            reason:
              'Manual correction',
          },
        ],
      }),
    );

  assert.equal(
    result.lineItems.length,
    3,
  );

  assert.deepEqual(
    result.lineItems[0],
    {
      category: 'EARNING',

      code: 'MEAL',

      description:
        'Meal Allowance',

      quantity: null,

      rate: null,

      amount:
        '500.00',

      taxable:
        true,

      metadata: {
        source:
          'RECURRING_PAYROLL_ITEM',

        recurringItemKind:
          'ALLOWANCE',
      },
    },
  );

  assert.deepEqual(
    result.lineItems[2],
    {
      category:
        'ADJUSTMENT',

      code:
        'ADJ-001',

      description:
        'Approved adjustment',

      quantity:
        null,

      rate:
        null,

      amount:
        '50.00',

      taxable:
        true,

      metadata: {
        source:
          'PAYROLL_ADJUSTMENT',

        adjustmentType:
          'EARNING',

        reason:
          'Manual correction',
      },
    },
  );
});

test('sums centavo values without floating-point drift', () => {
  const result =
    calculateFixedPayrollComponents(
      createInput({
        recurringItems: [
          {
            code: 'A',

            description:
              'Allowance A',

            kind:
              'ALLOWANCE',

            amount:
              '0.10',

            taxable:
              false,
          },

          {
            code: 'B',

            description:
              'Allowance B',

            kind:
              'ALLOWANCE',

            amount:
              '0.20',

            taxable:
              false,
          },
        ],
      }),
    );

  assert.equal(
    result.allowancesTotal,
    '0.30',
  );
});
