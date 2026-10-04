import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateCorePayroll,
  summarizeAttendance,
  type AttendanceSummaryEntryInput,
  type PayrollCalculationInput,
} from '../src/index.ts';

function createEntry(
  overrides: Partial<AttendanceSummaryEntryInput> = {},
): AttendanceSummaryEntryInput {
  return {
    workDate:
      '2026-09-01',

    regularMinutes:
      480,

    lateMinutes:
      0,

    undertimeMinutes:
      0,

    absenceMinutes:
      0,

    leaveMinutes:
      0,

    nightDifferentialMinutes:
      0,

    restDay:
      false,

    leaveType:
      null,

    holiday:
      null,

    overtimeEntries:
      [],

    ...overrides,
  };
}

function createInput(
  entries: AttendanceSummaryEntryInput[] = [
    createEntry(),
  ],

  overrides: Partial<PayrollCalculationInput> = {},
): PayrollCalculationInput {
  return {
    employeeId:
      'employee-1',

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
      summarizeAttendance(
        entries,
      ),

    recurringItems:
      [],

    adjustments:
      [],

    contributionConfig:
      null,

    taxConfig:
      null,

    config: {
      companyPayrollSetupVersionId:
        'setup-version-1',

      version:
        1,

      standardWorkMinutesPerDay:
        480,

      configSnapshot:
        {},
    },

    ...overrides,
  };
}

test('composes a complete pre-contribution payroll result', () => {
  const result =
    calculateCorePayroll(
      createInput(
        [createEntry()],

        {
          recurringItems: [
            {
              code:
                'MEAL',

              description:
                'Meal Allowance',

              kind:
                'ALLOWANCE',

              amount:
                '100.00',

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
                '25.00',

              taxable:
                false,
            },
          ],

          adjustments: [
            {
              code:
                'ADJ-EARN',

              description:
                'Earning Adjustment',

              type:
                'EARNING',

              amount:
                '50.00',

              reason:
                'Approved correction',
            },

            {
              code:
                'ADJ-DED',

              description:
                'Deduction Adjustment',

              type:
                'DEDUCTION',

              amount:
                '10.00',

              reason:
                'Approved correction',
            },
          ],
        },
      ),
    );

  assert.equal(
    result.status,
    'COMPLETE',
  );

  assert.deepEqual(
    result.issues,
    [],
  );

  assert.equal(
    result.basicPay,
    '600.00',
  );

  assert.equal(
    result.allowancesTotal,
    '100.00',
  );

  assert.equal(
    result.earningAdjustmentsTotal,
    '50.00',
  );

  assert.equal(
    result.premiumPayTotal,
    '0.00',
  );

  assert.equal(
    result.grossPay,
    '750.00',
  );

  assert.equal(
    result.attendanceDeductionsTotal,
    '0.00',
  );

  assert.equal(
    result.fixedDeductionsTotal,
    '25.00',
  );

  assert.equal(
    result.deductionAdjustmentsTotal,
    '10.00',
  );

  assert.equal(
    result.otherDeductionsTotal,
    '35.00',
  );

  assert.equal(
    result.preContributionTaxPay,
    '715.00',
  );
});

test('includes paid leave earnings in daily gross pay', () => {
  const result =
    calculateCorePayroll(
      createInput([
        createEntry({
          regularMinutes:
            240,

          leaveMinutes:
            240,

          leaveType: {
            id:
              'leave-vl',

            code:
              'VL',

            name:
              'Vacation Leave',
          },
        }),
      ]),

      {
        attendance: {
          leaveTreatmentByLeaveTypeId: {
            'leave-vl':
              'PAID',
          },
        },
      },
    );

  assert.equal(
    result.status,
    'COMPLETE',
  );

  assert.equal(
    result.basicPay,
    '300.00',
  );

  assert.equal(
    result.paidLeaveEarningsTotal,
    '300.00',
  );

  assert.equal(
    result.grossPay,
    '600.00',
  );

  assert.equal(
    result.preContributionTaxPay,
    '600.00',
  );
});

test('marks payroll incomplete when leave treatment is unresolved', () => {
  const result =
    calculateCorePayroll(
      createInput([
        createEntry({
          regularMinutes:
            240,

          leaveMinutes:
            240,

          leaveType: {
            id:
              'leave-vl',

            code:
              'VL',

            name:
              'Vacation Leave',
          },
        }),
      ]),
    );

  assert.equal(
    result.status,
    'INCOMPLETE',
  );

  assert.equal(
    result.issues[0]?.code,
    'UNRESOLVED_LEAVE_TREATMENT',
  );

  /*
   * Never expose an aggregate gross/final subtotal when
   * an unresolved rule could alter employee pay.
   */
  assert.equal(
    result.grossPay,
    null,
  );

  assert.equal(
    result.preContributionTaxPay,
    null,
  );
});

test('marks payroll incomplete when a premium rule is unresolved', () => {
  const result =
    calculateCorePayroll(
      createInput([
        createEntry({
          restDay:
            true,
        }),
      ]),
    );

  assert.equal(
    result.status,
    'INCOMPLETE',
  );

  assert.equal(
    result.issues[0]?.code,
    'UNRESOLVED_PREMIUM_RULE',
  );

  assert.equal(
    result.grossPay,
    null,
  );
});

test('reports a missing monthly cutoff base amount instead of throwing', () => {
  const result =
    calculateCorePayroll(
      createInput(
        [
          createEntry({
            regularMinutes:
              480,
          }),
        ],

        {
          payBasis:
            'MONTHLY',

          baseRate:
            '30000.0000',
        },
      ),
    );

  assert.equal(
    result.status,
    'INCOMPLETE',
  );

  assert.equal(
    result.basicPay,
    null,
  );

  assert.equal(
    result.issues[0]?.code,
    'MISSING_MONTHLY_CUTOFF_BASE_AMOUNT',
  );

  assert.equal(
    result.grossPay,
    null,
  );
});

test('reports a missing monthly attendance daily rate instead of throwing', () => {
  const result =
    calculateCorePayroll(
      createInput(
        [
          createEntry({
            regularMinutes:
              420,

            lateMinutes:
              60,
          }),
        ],

        {
          payBasis:
            'MONTHLY',

          baseRate:
            '30000.0000',
        },
      ),

      {
        basicPay: {
          monthlyCutoffBaseAmount:
            '15000.00',
        },
      },
    );

  assert.equal(
    result.status,
    'INCOMPLETE',
  );

  assert.equal(
    result.issues[0]?.code,
    'MISSING_MONTHLY_ATTENDANCE_DAILY_RATE',
  );

  assert.equal(
    result.grossPay,
    null,
  );
});

test('reports a missing monthly premium daily rate instead of throwing', () => {
  const result =
    calculateCorePayroll(
      createInput(
        [
          createEntry({
            restDay:
              true,
          }),
        ],

        {
          payBasis:
            'MONTHLY',

          baseRate:
            '30000.0000',
        },
      ),

      {
        basicPay: {
          monthlyCutoffBaseAmount:
            '15000.00',
        },

        premium: {
          regularWorkRules: {
            'REST_DAY|NO_HOLIDAY': {
              multiplier:
                '1.3000',

              semantics:
                'TOTAL',

              monthlyBaseTreatment:
                'NOT_INCLUDED',
            },
          },
        },
      },
    );

  assert.equal(
    result.status,
    'INCOMPLETE',
  );

  assert.equal(
    result.issues[0]?.code,
    'MISSING_MONTHLY_PREMIUM_DAILY_RATE',
  );

  assert.equal(
    result.grossPay,
    null,
  );
});
