import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateBasicPay,
  summarizeAttendance,
  type PayrollCalculationInput,
} from '../src/index.ts';

function createInput(
  overrides: Partial<PayrollCalculationInput> = {},
): PayrollCalculationInput {
  return {
    employeeId: 'employee-1',

    employmentRecordId:
      'employment-1',

    employeeNumber:
      'EMP-001',

    employeeName:
      'Juan Dela Cruz',

    payrollStatus:
      'ACTIVE',

    payoutMethod:
      'ATM',

    payoutAccountLast4:
      '1234',

    payBasis:
      'DAILY',

    baseRate:
      '600.0000',

    attendance:
      summarizeAttendance([]),

    recurringItems: [],

    adjustments: [],

    contributionConfig: null,

    taxConfig: null,

    config: {
      companyPayrollSetupVersionId:
        'setup-version-1',

      version: 1,

      standardWorkMinutesPerDay:
        480,

      configSnapshot: {},
    },

    ...overrides,
  };
}

function attendance(
  regularMinutes: number,
  lateMinutes = 0,
  undertimeMinutes = 0,
  absenceMinutes = 0,
  leaveMinutes = 0,
) {
  return summarizeAttendance([
    {
      workDate:
        '2026-09-01',

      regularMinutes,

      lateMinutes,

      undertimeMinutes,

      absenceMinutes,

      leaveMinutes,

      nightDifferentialMinutes:
        0,

      restDay:
        false,

      leaveType:
        leaveMinutes > 0
          ? {
              id: 'leave-1',

              code: 'VL',

              name:
                'Vacation Leave',
            }
          : null,

      holiday:
        null,

      overtimeEntries:
        [],
    },
  ]);
}

test('calculates a full daily basic-pay day', () => {
  const result =
    calculateBasicPay(
      createInput({
        attendance:
          attendance(480),
      }),
    );

  assert.equal(
    result.basicPay,
    '600.00',
  );

  assert.equal(
    result.equivalentRegularDays,
    '1.0000',
  );

  assert.equal(
    result.calculationMode,
    'DAILY_BY_REGULAR_MINUTES',
  );

  assert.equal(
    result.attendanceReductionAlreadyReflected,
    true,
  );
});

test('calculates daily basic pay from regular worked minutes', () => {
  const result =
    calculateBasicPay(
      createInput({
        attendance:
          attendance(
            420,
            60,
          ),
      }),
    );

  assert.equal(
    result.basicPay,
    '525.00',
  );

  assert.equal(
    result.equivalentRegularDays,
    '0.8750',
  );
});

test('does not subtract late and undertime a second time', () => {
  const result =
    calculateBasicPay(
      createInput({
        attendance:
          attendance(
            450,
            15,
            30,
          ),
      }),
    );

  /*
   * regularMinutes is authoritative.
   *
   * 450 / 480 × 600 = 562.50
   *
   * The 15 late + 30 undertime minutes are not
   * subtracted again here.
   */
  assert.equal(
    result.basicPay,
    '562.50',
  );
});

test('calculates multiple equivalent daily-rate days', () => {
  const input =
    createInput();

  input.attendance = {
    ...input.attendance,

    entryCount: 10,

    regularMinutes:
      4800,

    workedMinutes:
      4800,
  };

  const result =
    calculateBasicPay(input);

  assert.equal(
    result.basicPay,
    '6000.00',
  );

  assert.equal(
    result.equivalentRegularDays,
    '10.0000',
  );
});

test('rounds daily basic pay only at the final money boundary', () => {
  const result =
    calculateBasicPay(
      createInput({
        baseRate:
          '537.5000',

        attendance:
          attendance(420),
      }),
    );

  assert.equal(
    result.basicPay,
    '470.31',
  );
});

test('requires an approved cutoff amount for monthly employees', () => {
  assert.throws(
    () =>
      calculateBasicPay(
        createInput({
          payBasis:
            'MONTHLY',

          baseRate:
            '30000.0000',

          attendance:
            attendance(420),
        }),
      ),

    /Monthly basic pay requires an approved configured cutoff base amount/,
  );
});

test('uses an explicitly configured monthly cutoff base amount', () => {
  const result =
    calculateBasicPay(
      createInput({
        payBasis:
          'MONTHLY',

        baseRate:
          '30000.0000',

        attendance:
          attendance(
            420,
            60,
          ),
      }),

      {
        monthlyCutoffBaseAmount:
          '15000.00',
      },
    );

  assert.equal(
    result.basicPay,
    '15000.00',
  );

  assert.equal(
    result.calculationMode,
    'MONTHLY_CONFIGURED_CUTOFF_AMOUNT',
  );

  assert.equal(
    result.attendanceReductionAlreadyReflected,
    false,
  );
});
