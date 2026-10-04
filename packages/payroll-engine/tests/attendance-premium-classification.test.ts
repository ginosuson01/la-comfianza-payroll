import test from 'node:test';
import assert from 'node:assert/strict';

import {
  summarizeAttendance,
  type AttendanceSummaryEntryInput,
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

test('preserves combined rest-day and regular-holiday classification', () => {
  const result = summarizeAttendance([
    createEntry({
      restDay: true,

      holiday: {
        id: 'holiday-1',

        name: 'Regular Holiday',

        type: 'REGULAR',
      },

      regularMinutes: 480,

      nightDifferentialMinutes: 120,

      overtimeEntries: [
        {
          type: 'REST_DAY_REGULAR_HOLIDAY',

          minutes: 60,
        },
      ],
    }),
  ]);

  assert.deepEqual(
    result.premiumWorkBreakdown,
    [
      {
        restDay: true,

        holidayType: 'REGULAR',

        regularMinutes: 480,

        overtimeMinutes: 60,

        nightDifferentialMinutes: 120,

        workedMinutes: 540,
      },
    ],
  );
});

test('keeps regular-holiday workday and rest-day holiday work separate', () => {
  const result = summarizeAttendance([
    createEntry({
      workDate: '2026-09-10',

      restDay: false,

      holiday: {
        id: 'holiday-1',

        name: 'Regular Holiday',

        type: 'REGULAR',
      },

      regularMinutes: 480,
    }),

    createEntry({
      workDate: '2026-09-11',

      restDay: true,

      holiday: {
        id: 'holiday-2',

        name: 'Another Regular Holiday',

        type: 'REGULAR',
      },

      regularMinutes: 240,

      overtimeEntries: [
        {
          type: 'REST_DAY_REGULAR_HOLIDAY',

          minutes: 120,
        },
      ],
    }),
  ]);

  assert.deepEqual(
    result.premiumWorkBreakdown,
    [
      {
        restDay: false,

        holidayType: 'REGULAR',

        regularMinutes: 480,

        overtimeMinutes: 0,

        nightDifferentialMinutes: 0,

        workedMinutes: 480,
      },

      {
        restDay: true,

        holidayType: 'REGULAR',

        regularMinutes: 240,

        overtimeMinutes: 120,

        nightDifferentialMinutes: 0,

        workedMinutes: 360,
      },
    ],
  );
});
