import { BadRequestException } from '@nestjs/common';
import {
  HolidayType,
  LeaveUnit,
  OvertimeType,
  Prisma,
} from '@payroll/database';

import { PrismaService } from '../database/prisma.service';
import {
  DtrEntryValidationService,
  type DtrEntryValidationInput,
} from './dtr-entry-validation.service';
import { DtrPayrollConfigService } from './dtr-payroll-config.service';

describe('DtrEntryValidationService', () => {
  const companyId = '11111111-1111-4111-8111-111111111111';

  const otherCompanyId = '22222222-2222-4222-8222-222222222222';

  const employeeId = '33333333-3333-4333-8333-333333333333';

  const dtrId = '44444444-4444-4444-8444-444444444444';

  const entryId = '55555555-5555-4555-8555-555555555555';

  const leaveTypeId = '66666666-6666-4666-8666-666666666666';

  const holidayId = '77777777-7777-4777-8777-777777777777';

  const leaveAccountId = '88888888-8888-4888-8888-888888888888';

  const existingEntryId = '99999999-9999-4999-8999-999999999999';

  const workDate = new Date('2026-09-05T00:00:00.000Z');

  const otherWorkDate = new Date('2026-09-06T00:00:00.000Z');

  const prismaMock = {
    leaveType: {
      findUnique: jest.fn(),
    },

    holiday: {
      findUnique: jest.fn(),
    },

    employeeLeaveAccount: {
      findUnique: jest.fn(),
    },

    dtrEntry: {
      findMany: jest.fn(),
    },

    leaveTransaction: {
      aggregate: jest.fn(),
    },
  };

  const payrollConfigServiceMock = {
    getAttendanceConfig: jest.fn(),
    convertLeaveMinutesToDays: jest.fn(),
  };

  let service: DtrEntryValidationService;

  function createInput(
    overrides: Partial<DtrEntryValidationInput> = {},
  ): DtrEntryValidationInput {
    return {
      dtrId,
      employeeId,
      companyId,

      entryId: null,

      workDate,

      regularMinutes: 480,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 0,
      nightDifferentialMinutes: 0,

      restDay: false,

      leaveTypeId: null,

      holidayId: null,

      overtimeEntries: [],

      ...overrides,
    };
  }

  function mockValidLeaveType(
    code = 'OTHER',
    unit: LeaveUnit = LeaveUnit.DAY,
  ): void {
    prismaMock.leaveType.findUnique.mockResolvedValue({
      id: leaveTypeId,
      companyId,
      code,
      unit,
      active: true,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();

    payrollConfigServiceMock.getAttendanceConfig.mockResolvedValue({
      companyPayrollSetupVersionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      version: 1,
      standardWorkMinutesPerDay: 480,
    });

    prismaMock.leaveTransaction.aggregate.mockResolvedValue({
      _sum: {
        quantity: null,
      },
    });

    service = new DtrEntryValidationService(
      prismaMock as unknown as PrismaService,
      payrollConfigServiceMock as unknown as DtrPayrollConfigService,
    );
  });

  it('requires a leave type when leave minutes are greater than zero', async () => {
    await expect(
      service.validateEntry(
        createInput({
          leaveMinutes: 480,
          leaveTypeId: null,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.leaveType.findUnique).not.toHaveBeenCalled();
  });

  it('requires leave minutes when a leave type is selected', async () => {
    await expect(
      service.validateEntry(
        createInput({
          leaveMinutes: 0,
          leaveTypeId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.leaveType.findUnique).not.toHaveBeenCalled();
  });

  it('rejects duplicate overtime types', async () => {
    await expect(
      service.validateEntry(
        createInput({
          overtimeEntries: [
            {
              type: OvertimeType.REGULAR,
              minutes: 60,
            },
            {
              type: OvertimeType.REGULAR,
              minutes: 120,
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a leave type that does not exist', async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue(null);

    await expect(
      service.validateEntry(
        createInput({
          leaveMinutes: 480,
          leaveTypeId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a leave type from another company', async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue({
      id: leaveTypeId,
      companyId: otherCompanyId,
      code: 'OTHER',
      unit: LeaveUnit.DAY,
      active: true,
    });

    await expect(
      service.validateEntry(
        createInput({
          leaveMinutes: 480,
          leaveTypeId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive leave type', async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue({
      id: leaveTypeId,
      companyId,
      code: 'OTHER',
      unit: LeaveUnit.DAY,
      active: false,
    });

    await expect(
      service.validateEntry(
        createInput({
          leaveMinutes: 480,
          leaveTypeId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a holiday that does not exist', async () => {
    prismaMock.holiday.findUnique.mockResolvedValue(null);

    await expect(
      service.validateEntry(
        createInput({
          holidayId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a holiday from another company', async () => {
    prismaMock.holiday.findUnique.mockResolvedValue({
      id: holidayId,
      companyId: otherCompanyId,
      date: workDate,
      active: true,
    });

    await expect(
      service.validateEntry(
        createInput({
          holidayId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive holiday', async () => {
    prismaMock.holiday.findUnique.mockResolvedValue({
      id: holidayId,
      companyId,
      date: workDate,
      active: false,
    });

    await expect(
      service.validateEntry(
        createInput({
          holidayId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a holiday that does not match the work date', async () => {
    prismaMock.holiday.findUnique.mockResolvedValue({
      id: holidayId,
      companyId,
      date: otherWorkDate,
      active: true,
    });

    await expect(
      service.validateEntry(
        createInput({
          holidayId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts valid leave, holiday, and overtime data', async () => {
    mockValidLeaveType('OTHER');

    prismaMock.holiday.findUnique.mockResolvedValue({
      id: holidayId,
      companyId,
      date: workDate,
      active: true,
    });

    await expect(
      service.validateEntry(
        createInput({
          leaveMinutes: 240,
          leaveTypeId,

          holidayId,

          overtimeEntries: [
            {
              type: OvertimeType.REGULAR,
              minutes: 60,
            },
          ],
        }),
      ),
    ).resolves.toBeUndefined();

    expect(prismaMock.employeeLeaveAccount.findUnique).not.toHaveBeenCalled();
  });

  it('accepts VL when the employee has enough leave balance', async () => {
    mockValidLeaveType('VL');

    prismaMock.employeeLeaveAccount.findUnique.mockResolvedValue({
      id: leaveAccountId,
      currentBalance: new Prisma.Decimal('1.0000'),
    });

    prismaMock.dtrEntry.findMany.mockResolvedValue([]);

    payrollConfigServiceMock.convertLeaveMinutesToDays.mockResolvedValue(
      new Prisma.Decimal('0.5000'),
    );

    await expect(
      service.validateEntry(
        createInput({
          leaveMinutes: 240,
          leaveTypeId,
        }),
      ),
    ).resolves.toBeUndefined();

    expect(prismaMock.employeeLeaveAccount.findUnique).toHaveBeenCalledWith({
      where: {
        employeeId_leaveTypeId: {
          employeeId,
          leaveTypeId,
        },
      },

      select: {
        id: true,
        currentBalance: true,
      },
    });
  });

  it('treats a missing VL account as zero available balance', async () => {
    mockValidLeaveType('VL');

    prismaMock.employeeLeaveAccount.findUnique.mockResolvedValue(null);

    prismaMock.dtrEntry.findMany.mockResolvedValue([]);

    payrollConfigServiceMock.convertLeaveMinutesToDays.mockResolvedValue(
      new Prisma.Decimal('0.5000'),
    );

    await expect(
      service.validateEntry(
        createInput({
          leaveMinutes: 240,
          leaveTypeId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates cumulative VL usage across multiple DTR entries', async () => {
    mockValidLeaveType('VL');

    prismaMock.employeeLeaveAccount.findUnique.mockResolvedValue({
      id: leaveAccountId,
      currentBalance: new Prisma.Decimal('0.7500'),
    });

    prismaMock.dtrEntry.findMany.mockResolvedValue([
      {
        id: existingEntryId,
        workDate: otherWorkDate,
        leaveMinutes: 240,
      },
    ]);

    payrollConfigServiceMock.convertLeaveMinutesToDays
      .mockResolvedValueOnce(new Prisma.Decimal('0.5000'))
      .mockResolvedValueOnce(new Prisma.Decimal('0.5000'));

    await expect(
      service.validateEntry(
        createInput({
          leaveMinutes: 240,
          leaveTypeId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adds already-posted DTR usage back when validating an updated entry', async () => {
    mockValidLeaveType('VL');

    prismaMock.employeeLeaveAccount.findUnique.mockResolvedValue({
      id: leaveAccountId,
      currentBalance: new Prisma.Decimal('0.5000'),
    });

    prismaMock.dtrEntry.findMany.mockResolvedValue([]);

    prismaMock.leaveTransaction.aggregate.mockResolvedValue({
      _sum: {
        quantity: new Prisma.Decimal('-0.5000'),
      },
    });

    payrollConfigServiceMock.convertLeaveMinutesToDays.mockResolvedValue(
      new Prisma.Decimal('0.7500'),
    );

    await expect(
      service.validateEntry(
        createInput({
          entryId,

          leaveMinutes: 360,
          leaveTypeId,
        }),
      ),
    ).resolves.toBeUndefined();

    expect(prismaMock.leaveTransaction.aggregate).toHaveBeenCalled();
  });

  it('requires VL to use DAY as its leave unit', async () => {
    mockValidLeaveType('VL', LeaveUnit.HOUR);

    await expect(
      service.validateEntry(
        createInput({
          leaveMinutes: 240,
          leaveTypeId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      payrollConfigServiceMock.convertLeaveMinutesToDays,
    ).not.toHaveBeenCalled();
  });

  it('requires SL to use DAY as its leave unit', async () => {
    mockValidLeaveType('SL', LeaveUnit.HOUR);

    await expect(
      service.validateEntry(
        createInput({
          leaveMinutes: 240,
          leaveTypeId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not apply VL or SL balance validation to other leave types', async () => {
    mockValidLeaveType('OTHER');

    await expect(
      service.validateEntry(
        createInput({
          leaveMinutes: 480,
          leaveTypeId,
        }),
      ),
    ).resolves.toBeUndefined();

    expect(prismaMock.employeeLeaveAccount.findUnique).not.toHaveBeenCalled();

    expect(prismaMock.dtrEntry.findMany).not.toHaveBeenCalled();

    expect(
      payrollConfigServiceMock.convertLeaveMinutesToDays,
    ).not.toHaveBeenCalled();
  });

  it('rejects late minutes on a rest day', async () => {
    await expect(
      service.validateEntry(
        createInput({
          restDay: true,
          regularMinutes: 480,
          lateMinutes: 15,
        }),
      ),
    ).rejects.toThrow(
      'Late, undertime, absence, and leave minutes must be zero on a rest day.',
    );
  });

  it('rejects undertime minutes on a rest day', async () => {
    await expect(
      service.validateEntry(
        createInput({
          restDay: true,
          regularMinutes: 480,
          undertimeMinutes: 30,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects absence minutes on a rest day', async () => {
    await expect(
      service.validateEntry(
        createInput({
          restDay: true,
          absenceMinutes: 480,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects leave minutes on a rest day', async () => {
    await expect(
      service.validateEntry(
        createInput({
          restDay: true,
          leaveMinutes: 240,
          leaveTypeId,
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.leaveType.findUnique).not.toHaveBeenCalled();
  });

  it('allows actual regular work minutes on a rest day', async () => {
    await expect(
      service.validateEntry(
        createInput({
          restDay: true,
          regularMinutes: 480,

          overtimeEntries: [
            {
              type: OvertimeType.REST_DAY,
              minutes: 120,
            },
          ],
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects Regular OT on a rest day', async () => {
    await expect(
      service.validateEntry(
        createInput({
          restDay: true,
          regularMinutes: 480,

          overtimeEntries: [
            {
              type: OvertimeType.REGULAR,
              minutes: 120,
            },
          ],
        }),
      ),
    ).rejects.toThrow(
      'Overtime type REGULAR does not match the selected Rest Day / Holiday classification.',
    );
  });

  it('rejects Rest Day OT on an ordinary workday', async () => {
    await expect(
      service.validateEntry(
        createInput({
          overtimeEntries: [
            {
              type: OvertimeType.REST_DAY,
              minutes: 60,
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows Regular Holiday OT on a regular holiday', async () => {
    prismaMock.holiday.findUnique.mockResolvedValue({
      id: holidayId,
      companyId,
      date: workDate,
      type: HolidayType.REGULAR,
      active: true,
    });

    await expect(
      service.validateEntry(
        createInput({
          holidayId,

          overtimeEntries: [
            {
              type: OvertimeType.REGULAR_HOLIDAY,
              minutes: 120,
            },
          ],
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects Regular OT on a regular holiday', async () => {
    prismaMock.holiday.findUnique.mockResolvedValue({
      id: holidayId,
      companyId,
      date: workDate,
      type: HolidayType.REGULAR,
      active: true,
    });

    await expect(
      service.validateEntry(
        createInput({
          holidayId,

          overtimeEntries: [
            {
              type: OvertimeType.REGULAR,
              minutes: 120,
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows Rest Day Regular Holiday OT when both classifications apply', async () => {
    prismaMock.holiday.findUnique.mockResolvedValue({
      id: holidayId,
      companyId,
      date: workDate,
      type: HolidayType.REGULAR,
      active: true,
    });

    await expect(
      service.validateEntry(
        createInput({
          restDay: true,
          regularMinutes: 480,
          holidayId,

          overtimeEntries: [
            {
              type: OvertimeType.REST_DAY_REGULAR_HOLIDAY,
              minutes: 120,
            },
          ],
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects scheduled unavailable minutes above the configured workday', async () => {
    await expect(
      service.validateEntry(
        createInput({
          regularMinutes: 0,
          lateMinutes: 300,
          undertimeMinutes: 200,
        }),
      ),
    ).rejects.toThrow(
      'Late, undertime, absence, and leave minutes cannot exceed the configured 480-minute workday.',
    );
  });

  it('allows a Payroll Manager regular-minute override even when accounted minutes differ', async () => {
    await expect(
      service.validateEntry(
        createInput({
          regularMinutes: 450,
          lateMinutes: 15,
          undertimeMinutes: 30,
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects Night Differential when it exceeds total worked minutes', async () => {
    await expect(
      service.validateEntry(
        createInput({
          regularMinutes: 0,
          nightDifferentialMinutes: 60,
        }),
      ),
    ).rejects.toThrow(
      'Night Differential minutes cannot exceed total worked Regular + Overtime minutes.',
    );
  });

  it('allows Night Differential within Regular plus Overtime worked minutes', async () => {
    await expect(
      service.validateEntry(
        createInput({
          regularMinutes: 420,
          nightDifferentialMinutes: 120,

          overtimeEntries: [
            {
              type: OvertimeType.REGULAR,
              minutes: 60,
            },
          ],
        }),
      ),
    ).resolves.toBeUndefined();
  });
});
