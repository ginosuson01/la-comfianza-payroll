import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateAttendanceFinancials,
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
  options: {
    regularMinutes?: number;
    lateMinutes?: number;
    undertimeMinutes?: number;
    absenceMinutes?: number;
    leaveMinutes?: number;
  } = {},
) {
  const leaveMinutes =
    options.leaveMinutes ?? 0;

  return summarizeAttendance([
    {
      workDate:
        '2026-09-01',

      regularMinutes:
        options.regularMinutes ?? 480,

      lateMinutes:
        options.lateMinutes ?? 0,

      undertimeMinutes:
        options.undertimeMinutes ?? 0,

      absenceMinutes:
        options.absenceMinutes ?? 0,

      leaveMinutes,

      nightDifferentialMinutes:
        0,

      restDay:
        false,

      leaveType:
        leaveMinutes > 0
          ? {
              id:
                'leave-vl',

              code:
                'VL',

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

test('values daily late minutes without deducting them a second time', () => {
  const result =
    calculateAttendanceFinancials(
      createInput({
        attendance:
          attendance({
            regularMinutes: 420,
            lateMinutes: 60,
          }),
      }),
    );

  assert.equal(
    result.lateReferenceAmount,
    '75.00',
  );

  assert.equal(
    result.attendanceDeductionTotal,
    '0.00',
  );

  assert.equal(
    result.attendanceReductionAlreadyReflectedInBasicPay,
    true,
  );
});

test('restores paid leave earnings for a daily employee', () => {
  const result =
    calculateAttendanceFinancials(
      createInput({
        attendance:
          attendance({
            regularMinutes: 240,
            leaveMinutes: 240,
          }),
      }),

      {
        leaveTreatmentByLeaveTypeId: {
          'leave-vl': 'PAID',
        },
      },
    );

  assert.equal(
    result.leaveReferenceAmount,
    '300.00',
  );

  assert.equal(
    result.paidLeaveEarningsTotal,
    '300.00',
  );

  assert.equal(
    result.attendanceDeductionTotal,
    '0.00',
  );

  assert.equal(
    result.lineItems.length,
    1,
  );

  assert.equal(
    result.lineItems[0]?.code,
    'PAID_LEAVE_VL',
  );
});

test('does not restore unpaid leave for a daily employee', () => {
  const result =
    calculateAttendanceFinancials(
      createInput({
        attendance:
          attendance({
            regularMinutes: 240,
            leaveMinutes: 240,
          }),
      }),

      {
        leaveTreatmentByLeaveTypeId: {
          'leave-vl': 'UNPAID',
        },
      },
    );

  assert.equal(
    result.leaveReferenceAmount,
    '300.00',
  );

  assert.equal(
    result.paidLeaveEarningsTotal,
    '0.00',
  );

  assert.equal(
    result.attendanceDeductionTotal,
    '0.00',
  );
});

test('reports unresolved leave treatment instead of guessing', () => {
  const result =
    calculateAttendanceFinancials(
      createInput({
        attendance:
          attendance({
            regularMinutes: 240,
            leaveMinutes: 240,
          }),
      }),
    );

  assert.equal(
    result.unresolvedLeaveTreatments.length,
    1,
  );

  assert.deepEqual(
    result.unresolvedLeaveTreatments[0],
    {
      leaveTypeId:
        'leave-vl',

      code:
        'VL',

      name:
        'Vacation Leave',

      minutes:
        240,
    },
  );
});

test('allows monthly payroll without a deduction daily rate when there are no unavailable minutes', () => {
  const result =
    calculateAttendanceFinancials(
      createInput({
        payBasis:
          'MONTHLY',

        baseRate:
          '30000.0000',

        attendance:
          attendance({
            regularMinutes: 480,
          }),
      }),
    );

  assert.equal(
    result.attendanceDeductionTotal,
    '0.00',
  );
});

test('requires an approved daily rate for monthly attendance deductions', () => {
  assert.throws(
    () =>
      calculateAttendanceFinancials(
        createInput({
          payBasis:
            'MONTHLY',

          baseRate:
            '30000.0000',

          attendance:
            attendance({
              regularMinutes: 420,
              lateMinutes: 60,
            }),
        }),
      ),

    /Monthly attendance deductions require an approved configured attendance daily rate/,
  );
});

test('calculates monthly late undertime and absence deductions', () => {
  const result =
    calculateAttendanceFinancials(
      createInput({
        payBasis:
          'MONTHLY',

        baseRate:
          '30000.0000',

        attendance:
          attendance({
            regularMinutes: 375,

            lateMinutes: 15,

            undertimeMinutes: 30,

            absenceMinutes: 60,
          }),
      }),

      {
        monthlyAttendanceDailyRate:
          '600.0000',
      },
    );

  assert.equal(
    result.lateReferenceAmount,
    '18.75',
  );

  assert.equal(
    result.undertimeReferenceAmount,
    '37.50',
  );

  assert.equal(
    result.absenceReferenceAmount,
    '75.00',
  );

  assert.equal(
    result.attendanceDeductionTotal,
    '131.25',
  );

  assert.equal(
    result.lineItems.length,
    3,
  );
});

test('deducts unpaid leave for a monthly employee', () => {
  const result =
    calculateAttendanceFinancials(
      createInput({
        payBasis:
          'MONTHLY',

        baseRate:
          '30000.0000',

        attendance:
          attendance({
            regularMinutes: 240,
            leaveMinutes: 240,
          }),
      }),

      {
        monthlyAttendanceDailyRate:
          '600.0000',

        leaveTreatmentByLeaveTypeId: {
          'leave-vl': 'UNPAID',
        },
      },
    );

  assert.equal(
    result.attendanceDeductionTotal,
    '300.00',
  );

  assert.equal(
    result.lineItems[0]?.code,
    'UNPAID_LEAVE_VL',
  );
});

test('does not deduct paid leave for a monthly employee', () => {
  const result =
    calculateAttendanceFinancials(
      createInput({
        payBasis:
          'MONTHLY',

        baseRate:
          '30000.0000',

        attendance:
          attendance({
            regularMinutes: 240,
            leaveMinutes: 240,
          }),
      }),

      {
        monthlyAttendanceDailyRate:
          '600.0000',

        leaveTreatmentByLeaveTypeId: {
          'leave-vl': 'PAID',
        },
      },
    );

  assert.equal(
    result.leaveReferenceAmount,
    '300.00',
  );

  assert.equal(
    result.attendanceDeductionTotal,
    '0.00',
  );

  assert.equal(
    result.paidLeaveEarningsTotal,
    '0.00',
  );
});
