import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculatePremiumPay,
  summarizeAttendance,
  type AttendanceSummaryEntryInput,
  type PayrollCalculationInput,
} from '../src/index.ts';

function createEntry(
  overrides: Partial<AttendanceSummaryEntryInput> = {},
): AttendanceSummaryEntryInput {
  return {
    workDate: '2026-09-01',

    regularMinutes: 480,
    lateMinutes: 0,
    undertimeMinutes: 0,
    absenceMinutes: 0,
    leaveMinutes: 0,
    nightDifferentialMinutes: 0,

    restDay: false,

    leaveType: null,

    holiday: null,

    overtimeEntries: [],

    ...overrides,
  };
}

function createInput(
  entries: AttendanceSummaryEntryInput[],
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

    baseRate: '600.0000',

    attendance:
      summarizeAttendance(
        entries,
      ),

    recurringItems: [],

    adjustments: [],

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

test('reports a missing rest-day premium rule instead of guessing', () => {
  const result =
    calculatePremiumPay(
      createInput([
        createEntry({
          restDay: true,
        }),
      ]),
    );

  assert.equal(
    result.premiumPayTotal,
    '0.00',
  );

  assert.deepEqual(
    result.unresolvedRules,
    [
      {
        kind: 'REGULAR_WORK',

        key: 'REST_DAY|NO_HOLIDAY',

        minutes: 480,

        reason: 'MISSING_RULE',
      },
    ],
  );
});

test('applies only the additional portion of a TOTAL daily regular-work premium', () => {
  const result =
    calculatePremiumPay(
      createInput([
        createEntry({
          restDay: true,
        }),
      ]),

      {
        regularWorkRules: {
          'REST_DAY|NO_HOLIDAY': {
            multiplier: '1.3000',

            semantics: 'TOTAL',
          },
        },
      },
    );

  /*
   * Test configuration only:
   *
   * Daily basic already contains 600.
   * TOTAL multiplier 1.3000 means only
   * additional 0.3000 is added:
   *
   * 600 × .30 = 180
   */
  assert.equal(
    result.regularWorkPremiumTotal,
    '180.00',
  );

  assert.equal(
    result.premiumPayTotal,
    '180.00',
  );
});

test('applies a holiday TOTAL multiplier without duplicating daily base pay', () => {
  const result =
    calculatePremiumPay(
      createInput([
        createEntry({
          holiday: {
            id: 'holiday-1',

            name: 'Test Holiday',

            type: 'REGULAR',
          },
        }),
      ]),

      {
        regularWorkRules: {
          'WORKDAY|REGULAR': {
            multiplier: '2.0000',

            semantics: 'TOTAL',
          },
        },
      },
    );

  assert.equal(
    result.regularWorkPremiumTotal,
    '600.00',
  );
});

test('calculates overtime using a TOTAL multiplier because OT base is not in basic pay', () => {
  const result =
    calculatePremiumPay(
      createInput([
        createEntry({
          overtimeEntries: [
            {
              type: 'REGULAR',

              minutes: 120,
            },
          ],
        }),
      ]),

      {
        overtimeRules: {
          REGULAR: {
            multiplier: '1.2500',

            semantics: 'TOTAL',
          },
        },
      },
    );

  assert.equal(
    result.overtimePayTotal,
    '187.50',
  );
});

test('converts an ADDITIONAL OT multiplier to total OT compensation', () => {
  const result =
    calculatePremiumPay(
      createInput([
        createEntry({
          overtimeEntries: [
            {
              type: 'REGULAR',

              minutes: 120,
            },
          ],
        }),
      ]),

      {
        overtimeRules: {
          REGULAR: {
            multiplier: '0.2500',

            semantics: 'ADDITIONAL',
          },
        },
      },
    );

  assert.equal(
    result.overtimePayTotal,
    '187.50',
  );
});

test('calculates night differential as an overlapping additional premium', () => {
  const result =
    calculatePremiumPay(
      createInput([
        createEntry({
          nightDifferentialMinutes: 120,
        }),
      ]),

      {
        nightDifferentialRule: {
          multiplier: '1.1000',

          semantics: 'TOTAL',
        },
      },
    );

  /*
   * Test configuration only:
   *
   * 600 / 8 = 75 per hour
   * 2 hours × 75 × .10 = 15
   */
  assert.equal(
    result.nightDifferentialPremiumTotal,
    '15.00',
  );

  assert.equal(
    result.premiumPayTotal,
    '15.00',
  );
});

test('uses the combined rest-day and holiday classification', () => {
  const result =
    calculatePremiumPay(
      createInput([
        createEntry({
          restDay: true,

          holiday: {
            id: 'holiday-1',

            name: 'Test Holiday',

            type: 'REGULAR',
          },
        }),
      ]),

      {
        regularWorkRules: {
          'REST_DAY|REGULAR': {
            multiplier: '2.6000',

            semantics: 'TOTAL',
          },

          'WORKDAY|REGULAR': {
            multiplier: '2.0000',

            semantics: 'TOTAL',
          },
        },
      },
    );

  /*
   * Uses REST_DAY|REGULAR exactly.
   *
   * Since DAILY basic already contains 600,
   * effective additional multiplier is 1.6000.
   */
  assert.equal(
    result.regularWorkPremiumTotal,
    '960.00',
  );

  assert.equal(
    result.unresolvedRules.length,
    0,
  );
});

test('requires explicit monthly base treatment for regular-work premiums', () => {
  const result =
    calculatePremiumPay(
      createInput(
        [
          createEntry({
            restDay: true,
          }),
        ],

        {
          payBasis: 'MONTHLY',

          baseRate: '30000.0000',
        },
      ),

      {
        monthlyPremiumDailyRate:
          '600.0000',

        regularWorkRules: {
          'REST_DAY|NO_HOLIDAY': {
            multiplier: '1.3000',

            semantics: 'TOTAL',
          },
        },
      },
    );

  assert.equal(
    result.regularWorkPremiumTotal,
    '0.00',
  );

  assert.deepEqual(
    result.unresolvedRules,
    [
      {
        kind: 'REGULAR_WORK',

        key: 'REST_DAY|NO_HOLIDAY',

        minutes: 480,

        reason:
          'MISSING_MONTHLY_BASE_TREATMENT',
      },
    ],
  );
});

test('supports monthly regular premium when the base treatment is explicit', () => {
  const result =
    calculatePremiumPay(
      createInput(
        [
          createEntry({
            restDay: true,
          }),
        ],

        {
          payBasis: 'MONTHLY',

          baseRate: '30000.0000',
        },
      ),

      {
        monthlyPremiumDailyRate:
          '600.0000',

        regularWorkRules: {
          'REST_DAY|NO_HOLIDAY': {
            multiplier: '1.3000',

            semantics: 'TOTAL',

            monthlyBaseTreatment:
              'NOT_INCLUDED',
          },
        },
      },
    );

  assert.equal(
    result.regularWorkPremiumTotal,
    '780.00',
  );
});
