import { NotFoundException } from '@nestjs/common';

import {
  DtrStatus,
  HolidayType,
  OvertimeType,
  PayrollCutoffStatus,
} from '@payroll/database';

import { PrismaService } from '../database/prisma.service';
import { DtrAttendanceSummaryService } from './dtr-attendance-summary.service';

describe('DtrAttendanceSummaryService', () => {
  const dtrId = '11111111-1111-4111-8111-111111111111';

  const prismaMock = {
    dtr: {
      findUnique: jest.fn(),
    },
  };

  let service: DtrAttendanceSummaryService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new DtrAttendanceSummaryService(
      prismaMock as unknown as PrismaService,
    );
  });

  it('throws when the DTR does not exist', async () => {
    prismaMock.dtr.findUnique.mockResolvedValue(null);

    await expect(service.getSummary(dtrId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('builds a payroll-ready attendance aggregate from validated DTR entries', async () => {
    prismaMock.dtr.findUnique.mockResolvedValue({
      id: dtrId,

      companyId: '22222222-2222-4222-8222-222222222222',

      employeeId: '33333333-3333-4333-8333-333333333333',

      employmentRecordId: '44444444-4444-4444-8444-444444444444',

      payrollCutoffId: '55555555-5555-4555-8555-555555555555',

      status: DtrStatus.VALIDATED,

      validatedAt: new Date('2026-09-16T04:00:00.000Z'),

      payrollCutoff: {
        id: '55555555-5555-4555-8555-555555555555',

        startDate: new Date('2026-09-01T00:00:00.000Z'),

        endDate: new Date('2026-09-15T00:00:00.000Z'),

        payDate: new Date('2026-09-25T00:00:00.000Z'),

        status: PayrollCutoffStatus.REOPENED,
      },

      entries: [
        {
          workDate: new Date('2026-09-09T00:00:00.000Z'),

          regularMinutes: 240,
          lateMinutes: 0,
          undertimeMinutes: 0,
          absenceMinutes: 0,
          leaveMinutes: 240,
          nightDifferentialMinutes: 0,

          restDay: false,

          leaveType: {
            id: 'leave-other',
            code: 'OTHER',
            name: 'Other Approved Leave',
          },

          holiday: null,

          overtimeEntries: [],
        },

        {
          workDate: new Date('2026-09-10T00:00:00.000Z'),

          regularMinutes: 480,
          lateMinutes: 0,
          undertimeMinutes: 0,
          absenceMinutes: 0,
          leaveMinutes: 0,
          nightDifferentialMinutes: 120,

          restDay: false,

          leaveType: null,

          holiday: {
            id: 'holiday-regular',
            name: 'Step 19 Test Regular Holiday',
            type: HolidayType.REGULAR,
          },

          overtimeEntries: [
            {
              type: OvertimeType.REGULAR_HOLIDAY,
              minutes: 60,
            },
          ],
        },

        {
          workDate: new Date('2026-09-14T00:00:00.000Z'),

          regularMinutes: 0,
          lateMinutes: 0,
          undertimeMinutes: 0,
          absenceMinutes: 0,
          leaveMinutes: 0,
          nightDifferentialMinutes: 0,

          restDay: true,

          leaveType: null,
          holiday: null,

          overtimeEntries: [],
        },

        {
          workDate: new Date('2026-09-15T00:00:00.000Z'),

          regularMinutes: 435,
          lateMinutes: 15,
          undertimeMinutes: 30,
          absenceMinutes: 0,
          leaveMinutes: 0,
          nightDifferentialMinutes: 0,

          restDay: false,

          leaveType: null,
          holiday: null,

          overtimeEntries: [],
        },
      ],
    });

    const result = await service.getSummary(dtrId);

    expect(result.dtrId).toBe(dtrId);

    expect(result.status).toBe(DtrStatus.VALIDATED);

    expect(result.validatedAt).toBe('2026-09-16T04:00:00.000Z');

    expect(result.payrollCutoff.status).toBe(PayrollCutoffStatus.REOPENED);

    expect(result.payrollReady).toBe(true);

    expect(result.readinessIssues).toEqual([]);

    expect(result.attendance).toMatchObject({
      entryCount: 4,

      restDayEntryCount: 1,
      holidayEntryCount: 1,

      regularMinutes: 1155,
      lateMinutes: 15,
      undertimeMinutes: 30,
      absenceMinutes: 0,
      leaveMinutes: 240,

      overtimeMinutes: 60,

      nightDifferentialMinutes: 120,

      workedMinutes: 1215,

      restDayWorkedMinutes: 0,
    });

    expect(result.attendance.leaveBreakdown).toEqual([
      {
        leaveTypeId: 'leave-other',
        code: 'OTHER',
        name: 'Other Approved Leave',
        minutes: 240,
      },
    ]);

    expect(result.attendance.overtimeBreakdown).toEqual([
      {
        type: OvertimeType.REGULAR_HOLIDAY,
        minutes: 60,
      },
    ]);

    expect(result.attendance.holidayBreakdown).toEqual([
      {
        holidayId: 'holiday-regular',
        date: '2026-09-10',
        name: 'Step 19 Test Regular Holiday',
        type: HolidayType.REGULAR,

        entryCount: 1,

        regularMinutes: 480,
        overtimeMinutes: 60,
        nightDifferentialMinutes: 120,
        workedMinutes: 540,
      },
    ]);
  });

  it('marks a non-validated DTR as not payroll-ready', async () => {
    prismaMock.dtr.findUnique.mockResolvedValue({
      id: dtrId,

      companyId: '22222222-2222-4222-8222-222222222222',

      employeeId: '33333333-3333-4333-8333-333333333333',

      employmentRecordId: '44444444-4444-4444-8444-444444444444',

      payrollCutoffId: '55555555-5555-4555-8555-555555555555',

      status: DtrStatus.FOR_REVIEW,

      validatedAt: null,

      payrollCutoff: {
        id: '55555555-5555-4555-8555-555555555555',

        startDate: new Date('2026-09-01T00:00:00.000Z'),

        endDate: new Date('2026-09-15T00:00:00.000Z'),

        payDate: new Date('2026-09-25T00:00:00.000Z'),

        status: PayrollCutoffStatus.REOPENED,
      },

      entries: [],
    });

    const result = await service.getSummary(dtrId);

    expect(result.status).toBe(DtrStatus.FOR_REVIEW);

    expect(result.validatedAt).toBeNull();

    expect(result.payrollReady).toBe(false);

    expect(result.readinessIssues).toEqual([
      'DTR must be validated before payroll generation.',
    ]);

    expect(result.attendance.entryCount).toBe(0);
  });
});
