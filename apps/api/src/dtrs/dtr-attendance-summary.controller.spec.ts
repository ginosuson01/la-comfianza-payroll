import { DtrStatus, PayrollCutoffStatus } from '@payroll/database';

import { DtrAttendanceSummaryController } from './dtr-attendance-summary.controller';
import {
  DtrAttendanceSummaryService,
  type DtrAttendanceSummaryRecord,
} from './dtr-attendance-summary.service';

describe('DtrAttendanceSummaryController', () => {
  const dtrId = '11111111-1111-4111-8111-111111111111';

  const summary: DtrAttendanceSummaryRecord = {
    dtrId,

    companyId: '22222222-2222-4222-8222-222222222222',

    employeeId: '33333333-3333-4333-8333-333333333333',

    employmentRecordId: '44444444-4444-4444-8444-444444444444',

    payrollCutoffId: '55555555-5555-4555-8555-555555555555',

    status: DtrStatus.VALIDATED,

    validatedAt: '2026-09-16T04:00:00.000Z',

    payrollCutoff: {
      id: '55555555-5555-4555-8555-555555555555',

      startDate: '2026-09-01',

      endDate: '2026-09-15',

      payDate: '2026-09-25',

      status: PayrollCutoffStatus.REOPENED,
    },

    payrollReady: true,

    readinessIssues: [],

    attendance: {
      entryCount: 1,
      restDayEntryCount: 0,
      holidayEntryCount: 0,

      regularMinutes: 480,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 0,
      overtimeMinutes: 0,
      nightDifferentialMinutes: 0,

      workedMinutes: 480,
      restDayWorkedMinutes: 0,

      leaveBreakdown: [],
      overtimeBreakdown: [],
      holidayBreakdown: [],

      premiumWorkBreakdown: [],
    },
  };

  const attendanceSummaryServiceMock = {
    getSummary: jest.fn(),
  };

  let controller: DtrAttendanceSummaryController;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new DtrAttendanceSummaryController(
      attendanceSummaryServiceMock as unknown as DtrAttendanceSummaryService,
    );
  });

  it('returns the DTR attendance summary', async () => {
    attendanceSummaryServiceMock.getSummary.mockResolvedValue(summary);

    await expect(controller.getAttendanceSummary(dtrId)).resolves.toEqual(
      summary,
    );

    expect(attendanceSummaryServiceMock.getSummary).toHaveBeenCalledWith(dtrId);
  });
});
