import test from 'node:test';
import assert from 'node:assert/strict';

import {
  summarizeAttendance,
  validatePayrollCalculationInput,
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

    recurringItems: [
      {
        code: 'MEAL',
        description: 'Meal Allowance',
        kind: 'ALLOWANCE',
        amount: '500.00',
        taxable: false,
      },
    ],

    adjustments: [
      {
        code: 'ADJ-001',
        description: 'Approved payroll adjustment',
        type: 'EARNING',
        amount: '100.00',
        reason: 'Test adjustment',
      },
    ],

    contributionConfig: null,

    taxConfig: null,

    config: {
      companyPayrollSetupVersionId:
        'setup-version-1',

      version: 1,

      standardWorkMinutesPerDay: 480,

      configSnapshot: {},
    },

    ...overrides,
  };
}

test('accepts a valid payroll calculation input', () => {
  assert.doesNotThrow(() => {
    validatePayrollCalculationInput(
      createInput(),
    );
  });
});

test('rejects a zero payroll base rate', () => {
  assert.throws(
    () =>
      validatePayrollCalculationInput(
        createInput({
          baseRate: '0.0000',
        }),
      ),
    /baseRate must be greater than zero/,
  );
});

test('rejects invalid standard work minutes', () => {
  const input = createInput();

  assert.throws(
    () =>
      validatePayrollCalculationInput({
        ...input,

        config: {
          ...input.config,
          standardWorkMinutesPerDay: 0,
        },
      }),
    /standardWorkMinutesPerDay must be a positive integer/,
  );
});

test('rejects recurring payroll amounts with unsupported precision', () => {
  assert.throws(
    () =>
      validatePayrollCalculationInput(
        createInput({
          recurringItems: [
            {
              code: 'MEAL',
              description: 'Meal Allowance',
              kind: 'ALLOWANCE',
              amount: '500.001',
              taxable: false,
            },
          ],
        }),
      ),
    /exceeds the allowed scale of 2/,
  );
});

test('rejects negative payroll adjustment amounts', () => {
  assert.throws(
    () =>
      validatePayrollCalculationInput(
        createInput({
          adjustments: [
            {
              code: 'ADJ-001',
              description: 'Adjustment',
              type: 'DEDUCTION',
              amount: '-1.00',
              reason: 'Test adjustment',
            },
          ],
        }),
      ),
    /must not be negative/,
  );
});
