export type AttendanceOvertimeType = string;
export type AttendanceHolidayType = string;

export interface AttendanceLeaveTypeInput {
  id: string;
  code: string;
  name: string;
}

export interface AttendanceHolidayInput {
  id: string;
  name: string;
  type: AttendanceHolidayType;
}

export interface AttendanceOvertimeInput {
  type: AttendanceOvertimeType;
  minutes: number;
}

export interface AttendanceSummaryEntryInput {
  workDate: string;

  regularMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  absenceMinutes: number;
  leaveMinutes: number;
  nightDifferentialMinutes: number;

  restDay: boolean;

  leaveType: AttendanceLeaveTypeInput | null;
  holiday: AttendanceHolidayInput | null;

  overtimeEntries: readonly AttendanceOvertimeInput[];
}

export interface AttendanceLeaveBreakdown {
  leaveTypeId: string;
  code: string;
  name: string;
  minutes: number;
}

export interface AttendanceOvertimeBreakdown {
  type: AttendanceOvertimeType;
  minutes: number;
}

export interface AttendanceHolidayBreakdown {
  holidayId: string;
  date: string;
  name: string;
  type: AttendanceHolidayType;

  entryCount: number;

  regularMinutes: number;
  overtimeMinutes: number;
  nightDifferentialMinutes: number;
  workedMinutes: number;
}

export interface AttendanceAggregate {
  entryCount: number;
  restDayEntryCount: number;
  holidayEntryCount: number;

  regularMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  absenceMinutes: number;
  leaveMinutes: number;
  overtimeMinutes: number;
  nightDifferentialMinutes: number;

  workedMinutes: number;
  restDayWorkedMinutes: number;

  leaveBreakdown: AttendanceLeaveBreakdown[];
  overtimeBreakdown: AttendanceOvertimeBreakdown[];
  holidayBreakdown: AttendanceHolidayBreakdown[];
}

interface MutableLeaveBreakdown extends AttendanceLeaveBreakdown {}

interface MutableOvertimeBreakdown extends AttendanceOvertimeBreakdown {}

interface MutableHolidayBreakdown extends AttendanceHolidayBreakdown {}

function assertNonNegativeWholeMinutes(
  value: number,
  fieldName: string,
): void {
  if (
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `${fieldName} must be a non-negative whole number.`,
    );
  }
}

function validateEntry(
  entry: AttendanceSummaryEntryInput,
): void {
  if (!entry.workDate.trim()) {
    throw new Error('workDate is required.');
  }

  assertNonNegativeWholeMinutes(
    entry.regularMinutes,
    'regularMinutes',
  );

  assertNonNegativeWholeMinutes(
    entry.lateMinutes,
    'lateMinutes',
  );

  assertNonNegativeWholeMinutes(
    entry.undertimeMinutes,
    'undertimeMinutes',
  );

  assertNonNegativeWholeMinutes(
    entry.absenceMinutes,
    'absenceMinutes',
  );

  assertNonNegativeWholeMinutes(
    entry.leaveMinutes,
    'leaveMinutes',
  );

  assertNonNegativeWholeMinutes(
    entry.nightDifferentialMinutes,
    'nightDifferentialMinutes',
  );

  if (
    entry.leaveMinutes > 0 &&
    !entry.leaveType
  ) {
    throw new Error(
      'leaveType is required when leaveMinutes is greater than zero.',
    );
  }

  if (
    entry.leaveType &&
    entry.leaveMinutes === 0
  ) {
    throw new Error(
      'leaveMinutes must be greater than zero when leaveType is provided.',
    );
  }

  for (const overtime of entry.overtimeEntries) {
    if (!overtime.type.trim()) {
      throw new Error('Overtime type is required.');
    }

    assertNonNegativeWholeMinutes(
      overtime.minutes,
      'overtime.minutes',
    );
  }
}

export function summarizeAttendance(
  entries: readonly AttendanceSummaryEntryInput[],
): AttendanceAggregate {
  let regularMinutes = 0;
  let lateMinutes = 0;
  let undertimeMinutes = 0;
  let absenceMinutes = 0;
  let leaveMinutes = 0;
  let overtimeMinutes = 0;
  let nightDifferentialMinutes = 0;

  let restDayEntryCount = 0;
  let holidayEntryCount = 0;
  let restDayWorkedMinutes = 0;

  const leaveBreakdownById =
    new Map<string, MutableLeaveBreakdown>();

  const overtimeBreakdownByType =
    new Map<string, MutableOvertimeBreakdown>();

  const holidayBreakdownById =
    new Map<string, MutableHolidayBreakdown>();

  for (const entry of entries) {
    validateEntry(entry);

    regularMinutes += entry.regularMinutes;
    lateMinutes += entry.lateMinutes;
    undertimeMinutes += entry.undertimeMinutes;
    absenceMinutes += entry.absenceMinutes;
    leaveMinutes += entry.leaveMinutes;
    nightDifferentialMinutes +=
      entry.nightDifferentialMinutes;

    let entryOvertimeMinutes = 0;

    for (const overtime of entry.overtimeEntries) {
      entryOvertimeMinutes += overtime.minutes;
      overtimeMinutes += overtime.minutes;

      const existing =
        overtimeBreakdownByType.get(overtime.type);

      if (existing) {
        existing.minutes += overtime.minutes;
      } else {
        overtimeBreakdownByType.set(
          overtime.type,
          {
            type: overtime.type,
            minutes: overtime.minutes,
          },
        );
      }
    }

    const entryWorkedMinutes =
      entry.regularMinutes +
      entryOvertimeMinutes;

    if (entry.restDay) {
      restDayEntryCount += 1;
      restDayWorkedMinutes += entryWorkedMinutes;
    }

    if (
      entry.leaveType &&
      entry.leaveMinutes > 0
    ) {
      const existing =
        leaveBreakdownById.get(entry.leaveType.id);

      if (existing) {
        existing.minutes += entry.leaveMinutes;
      } else {
        leaveBreakdownById.set(
          entry.leaveType.id,
          {
            leaveTypeId: entry.leaveType.id,
            code: entry.leaveType.code,
            name: entry.leaveType.name,
            minutes: entry.leaveMinutes,
          },
        );
      }
    }

    if (entry.holiday) {
      holidayEntryCount += 1;

      const existing =
        holidayBreakdownById.get(entry.holiday.id);

      if (existing) {
        existing.entryCount += 1;
        existing.regularMinutes +=
          entry.regularMinutes;
        existing.overtimeMinutes +=
          entryOvertimeMinutes;
        existing.nightDifferentialMinutes +=
          entry.nightDifferentialMinutes;
        existing.workedMinutes +=
          entryWorkedMinutes;
      } else {
        holidayBreakdownById.set(
          entry.holiday.id,
          {
            holidayId: entry.holiday.id,
            date: entry.workDate,
            name: entry.holiday.name,
            type: entry.holiday.type,

            entryCount: 1,

            regularMinutes:
              entry.regularMinutes,

            overtimeMinutes:
              entryOvertimeMinutes,

            nightDifferentialMinutes:
              entry.nightDifferentialMinutes,

            workedMinutes:
              entryWorkedMinutes,
          },
        );
      }
    }
  }

  return {
    entryCount: entries.length,

    restDayEntryCount,
    holidayEntryCount,

    regularMinutes,
    lateMinutes,
    undertimeMinutes,
    absenceMinutes,
    leaveMinutes,
    overtimeMinutes,
    nightDifferentialMinutes,

    /*
     * Night Differential is intentionally excluded here because
     * it overlaps worked Regular/Overtime minutes rather than
     * representing additional time worked.
     */
    workedMinutes:
      regularMinutes +
      overtimeMinutes,

    restDayWorkedMinutes,

    leaveBreakdown:
      Array.from(
        leaveBreakdownById.values(),
      ).sort((left, right) =>
        left.code.localeCompare(right.code),
      ),

    overtimeBreakdown:
      Array.from(
        overtimeBreakdownByType.values(),
      ).sort((left, right) =>
        left.type.localeCompare(right.type),
      ),

    holidayBreakdown:
      Array.from(
        holidayBreakdownById.values(),
      ).sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
  };
}
