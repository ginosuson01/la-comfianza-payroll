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

test('returns a zero attendance summary for no entries', () => {
  const result = summarizeAttendance([]);

  assert.deepEqual(result, {
    entryCount: 0,
    restDayEntryCount: 0,
    holidayEntryCount: 0,

    regularMinutes: 0,
    lateMinutes: 0,
    undertimeMinutes: 0,
    absenceMinutes: 0,
    leaveMinutes: 0,
    overtimeMinutes: 0,
    nightDifferentialMinutes: 0,

    workedMinutes: 0,
    restDayWorkedMinutes: 0,

    leaveBreakdown: [],
    overtimeBreakdown: [],
    holidayBreakdown: [],
  });
});

test('aggregates attendance minute totals', () => {
  const result = summarizeAttendance([
    createEntry({
      regularMinutes: 435,
      lateMinutes: 15,
      undertimeMinutes: 30,
      nightDifferentialMinutes: 60,

      overtimeEntries: [
        {
          type: 'REGULAR',
          minutes: 120,
        },
      ],
    }),

    createEntry({
      workDate: '2026-09-02',

      regularMinutes: 240,
      absenceMinutes: 240,

      overtimeEntries: [
        {
          type: 'REGULAR',
          minutes: 60,
        },
      ],
    }),
  ]);

  assert.equal(result.entryCount, 2);

  assert.equal(result.regularMinutes, 675);
  assert.equal(result.lateMinutes, 15);
  assert.equal(result.undertimeMinutes, 30);
  assert.equal(result.absenceMinutes, 240);

  assert.equal(result.overtimeMinutes, 180);
  assert.equal(result.nightDifferentialMinutes, 60);

  assert.equal(
    result.workedMinutes,
    855,
  );
});

test('groups leave minutes by leave type', () => {
  const vacationLeave = {
    id: 'leave-vl',
    code: 'VL',
    name: 'Vacation Leave',
  };

  const sickLeave = {
    id: 'leave-sl',
    code: 'SL',
    name: 'Sick Leave',
  };

  const result = summarizeAttendance([
    createEntry({
      regularMinutes: 240,
      leaveMinutes: 240,
      leaveType: vacationLeave,
    }),

    createEntry({
      workDate: '2026-09-02',
      regularMinutes: 0,
      leaveMinutes: 480,
      leaveType: vacationLeave,
    }),

    createEntry({
      workDate: '2026-09-03',
      regularMinutes: 240,
      leaveMinutes: 240,
      leaveType: sickLeave,
    }),
  ]);

  assert.equal(result.leaveMinutes, 960);

  assert.deepEqual(
    result.leaveBreakdown,
    [
      {
        leaveTypeId: 'leave-sl',
        code: 'SL',
        name: 'Sick Leave',
        minutes: 240,
      },
      {
        leaveTypeId: 'leave-vl',
        code: 'VL',
        name: 'Vacation Leave',
        minutes: 720,
      },
    ],
  );
});

test('groups overtime by overtime classification', () => {
  const result = summarizeAttendance([
    createEntry({
      overtimeEntries: [
        {
          type: 'REGULAR',
          minutes: 60,
        },
        {
          type: 'REGULAR_HOLIDAY',
          minutes: 120,
        },
      ],
    }),

    createEntry({
      workDate: '2026-09-02',

      overtimeEntries: [
        {
          type: 'REGULAR',
          minutes: 30,
        },
      ],
    }),
  ]);

  assert.equal(result.overtimeMinutes, 210);

  assert.deepEqual(
    result.overtimeBreakdown,
    [
      {
        type: 'REGULAR',
        minutes: 90,
      },
      {
        type: 'REGULAR_HOLIDAY',
        minutes: 120,
      },
    ],
  );
});

test('summarizes rest-day and holiday attendance', () => {
  const regularHoliday = {
    id: 'holiday-1',
    name: 'Test Regular Holiday',
    type: 'REGULAR',
  };

  const result = summarizeAttendance([
    createEntry({
      workDate: '2026-09-10',

      regularMinutes: 480,
      nightDifferentialMinutes: 120,

      holiday: regularHoliday,

      overtimeEntries: [
        {
          type: 'REGULAR_HOLIDAY',
          minutes: 60,
        },
      ],
    }),

    createEntry({
      workDate: '2026-09-13',

      regularMinutes: 480,
      restDay: true,

      overtimeEntries: [
        {
          type: 'REST_DAY',
          minutes: 120,
        },
      ],
    }),
  ]);

  assert.equal(result.holidayEntryCount, 1);
  assert.equal(result.restDayEntryCount, 1);

  assert.equal(
    result.restDayWorkedMinutes,
    600,
  );

  assert.deepEqual(
    result.holidayBreakdown,
    [
      {
        holidayId: 'holiday-1',
        date: '2026-09-10',
        name: 'Test Regular Holiday',
        type: 'REGULAR',

        entryCount: 1,

        regularMinutes: 480,
        overtimeMinutes: 60,
        nightDifferentialMinutes: 120,
        workedMinutes: 540,
      },
    ],
  );
});

test('does not count night differential as additional worked minutes', () => {
  const result = summarizeAttendance([
    createEntry({
      regularMinutes: 480,
      nightDifferentialMinutes: 240,

      overtimeEntries: [
        {
          type: 'REGULAR',
          minutes: 120,
        },
      ],
    }),
  ]);

  assert.equal(
    result.workedMinutes,
    600,
  );

  assert.equal(
    result.nightDifferentialMinutes,
    240,
  );
});

test('rejects invalid negative attendance minutes', () => {
  assert.throws(
    () =>
      summarizeAttendance([
        createEntry({
          lateMinutes: -1,
        }),
      ]),
    /lateMinutes must be a non-negative whole number/,
  );
});

test('rejects leave minutes without a leave type', () => {
  assert.throws(
    () =>
      summarizeAttendance([
        createEntry({
          regularMinutes: 240,
          leaveMinutes: 240,
          leaveType: null,
        }),
      ]),
    /leaveType is required/,
  );
});
