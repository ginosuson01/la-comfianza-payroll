import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  DtrStatus,
  OvertimeType,
  PayrollCutoffStatus,
} from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import {
  DTR_AUDIT_MODULE,
  DTR_ENTRY_ENTITY_TYPE,
  DtrAuditAction,
} from './dtr-audit.constants';
import { DtrEntryValidationService } from './dtr-entry-validation.service';
import { DtrEntriesService } from './dtr-entries.service';
import { DtrLeaveBalanceService } from './dtr-leave-balance.service';
import type { CreateDtrEntryDto } from './dto/create-dtr-entry.dto';
import type { UpdateDtrEntryDto } from './dto/update-dtr-entry.dto';

describe('DtrEntriesService', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const employeeId = '22222222-2222-4222-8222-222222222222';

  const payrollCutoffId = '33333333-3333-4333-8333-333333333333';

  const dtrId = '44444444-4444-4444-8444-444444444444';

  const entryId = '55555555-5555-4555-8555-555555555555';

  const leaveTypeId = '66666666-6666-4666-8666-666666666666';

  const cutoffStartDate = new Date('2026-09-01T00:00:00.000Z');

  const cutoffEndDate = new Date('2026-09-15T00:00:00.000Z');

  const workDate = new Date('2026-09-05T00:00:00.000Z');

  const dtrContext = {
    id: dtrId,
    companyId,
    employeeId,
    status: DtrStatus.DRAFT,

    payrollCutoff: {
      id: payrollCutoffId,
      startDate: cutoffStartDate,
      endDate: cutoffEndDate,
      status: PayrollCutoffStatus.OPEN,
    },
  };

  const entryContext = {
    id: entryId,
    workDate,

    leaveMinutes: 0,
    leaveTypeId: null,
    holidayId: null,

    overtimeEntries: [],

    dtr: dtrContext,
  };

  const prismaMock = {
    dtr: {
      findUnique: jest.fn(),
    },

    dtrEntry: {
      findFirst: jest.fn(),
    },

    $transaction: jest.fn(),
  };

  const auditLogMock = {
    recordSuccessInTransaction: jest.fn(),
  };

  const validationServiceMock = {
    validateEntry: jest.fn(),
  };

  const leaveBalanceServiceMock = {
    applyUsageInTransaction: jest.fn(),

    reverseUsageInTransaction: jest.fn(),
  };

  let service: DtrEntriesService;

  beforeEach(() => {
    jest.clearAllMocks();

    validationServiceMock.validateEntry.mockResolvedValue(undefined);

    leaveBalanceServiceMock.applyUsageInTransaction.mockResolvedValue(
      undefined,
    );

    leaveBalanceServiceMock.reverseUsageInTransaction.mockResolvedValue(
      undefined,
    );

    service = new DtrEntriesService(
      prismaMock as unknown as PrismaService,

      auditLogMock as unknown as AuditLogService,

      validationServiceMock as unknown as DtrEntryValidationService,

      leaveBalanceServiceMock as unknown as DtrLeaveBalanceService,
    );
  });

  it('throws when the parent DTR does not exist', async () => {
    prismaMock.dtr.findUnique.mockResolvedValue(null);

    const input: CreateDtrEntryDto = {
      workDate: '2026-09-05',

      regularMinutes: 480,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 0,
      nightDifferentialMinutes: 0,
      restDay: false,
    };

    await expect(
      service.createEntry(dtrId, input, actorUserId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaMock.dtrEntry.findFirst).not.toHaveBeenCalled();
  });

  it('rejects entry creation when the cutoff is locked', async () => {
    prismaMock.dtr.findUnique.mockResolvedValue({
      ...dtrContext,

      payrollCutoff: {
        ...dtrContext.payrollCutoff,

        status: PayrollCutoffStatus.LOCKED,
      },
    });

    const input: CreateDtrEntryDto = {
      workDate: '2026-09-05',

      regularMinutes: 480,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 0,
      nightDifferentialMinutes: 0,
      restDay: false,
    };

    await expect(
      service.createEntry(dtrId, input, actorUserId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects entry creation when the DTR is validated', async () => {
    prismaMock.dtr.findUnique.mockResolvedValue({
      ...dtrContext,
      status: DtrStatus.VALIDATED,
    });

    const input: CreateDtrEntryDto = {
      workDate: '2026-09-05',

      regularMinutes: 480,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 0,
      nightDifferentialMinutes: 0,
      restDay: false,
    };

    await expect(
      service.createEntry(dtrId, input, actorUserId),
    ).rejects.toThrow(
      'Attendance cannot be modified because the DTR is validated. Return the DTR to review before editing attendance.',
    );

    expect(prismaMock.dtrEntry.findFirst).not.toHaveBeenCalled();

    expect(validationServiceMock.validateEntry).not.toHaveBeenCalled();

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a work date outside the payroll cutoff', async () => {
    prismaMock.dtr.findUnique.mockResolvedValue(dtrContext);

    const input: CreateDtrEntryDto = {
      workDate: '2026-09-16',

      regularMinutes: 480,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 0,
      nightDifferentialMinutes: 0,
      restDay: false,
    };

    await expect(
      service.createEntry(dtrId, input, actorUserId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a duplicate daily entry', async () => {
    prismaMock.dtr.findUnique.mockResolvedValue(dtrContext);

    prismaMock.dtrEntry.findFirst.mockResolvedValue({
      id: entryId,
    });

    const input: CreateDtrEntryDto = {
      workDate: '2026-09-05',

      regularMinutes: 480,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 0,
      nightDifferentialMinutes: 0,
      restDay: false,
    };

    await expect(
      service.createEntry(dtrId, input, actorUserId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('does not create a DTR entry when VL or SL balance validation fails', async () => {
    prismaMock.dtr.findUnique.mockResolvedValue(dtrContext);

    prismaMock.dtrEntry.findFirst.mockResolvedValue(null);

    validationServiceMock.validateEntry.mockRejectedValue(
      new BadRequestException('Insufficient VL balance.'),
    );

    const input: CreateDtrEntryDto = {
      workDate: '2026-09-05',

      regularMinutes: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 480,
      nightDifferentialMinutes: 0,
      restDay: false,
      leaveTypeId,
    };

    await expect(
      service.createEntry(dtrId, input, actorUserId),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();

    expect(
      leaveBalanceServiceMock.applyUsageInTransaction,
    ).not.toHaveBeenCalled();
  });

  it('creates a daily entry with overtime and records an audit log', async () => {
    prismaMock.dtr.findUnique.mockResolvedValue(dtrContext);

    prismaMock.dtrEntry.findFirst.mockResolvedValue(null);

    const input: CreateDtrEntryDto = {
      workDate: '2026-09-05',

      regularMinutes: 480,
      lateMinutes: 15,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 0,
      nightDifferentialMinutes: 60,
      restDay: false,

      notes: 'Regular attendance',

      overtimeEntries: [
        {
          type: OvertimeType.REGULAR,

          minutes: 120,
        },
      ],
    };

    const createdEntry = {
      id: entryId,
      dtrId,
      workDate,

      regularMinutes: 480,
      lateMinutes: 15,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 0,
      nightDifferentialMinutes: 60,

      restDay: false,

      leaveTypeId: null,
      holidayId: null,

      notes: 'Regular attendance',

      createdAt: new Date(),

      updatedAt: new Date(),

      overtimeEntries: [
        {
          id: '77777777-7777-4777-8777-777777777777',

          type: OvertimeType.REGULAR,

          minutes: 120,

          createdAt: new Date(),
        },
      ],
    };

    const transaction = {
      dtrEntry: {
        create: jest.fn().mockResolvedValue(createdEntry),
      },
    };

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    auditLogMock.recordSuccessInTransaction.mockResolvedValue(undefined);

    const result = await service.createEntry(dtrId, input, actorUserId);

    expect(
      leaveBalanceServiceMock.applyUsageInTransaction,
    ).not.toHaveBeenCalled();

    expect(auditLogMock.recordSuccessInTransaction).toHaveBeenCalledWith(
      transaction,

      expect.objectContaining({
        actorUserId,
        companyId,

        action: DtrAuditAction.ENTRY_CREATED,

        module: DTR_AUDIT_MODULE,

        entityType: DTR_ENTRY_ENTITY_TYPE,

        entityId: entryId,

        reference: '2026-09-05',
      }),
    );

    expect(result).toEqual(createdEntry);
  });

  it('applies leave usage transactionally when creating a VL or SL DTR entry', async () => {
    prismaMock.dtr.findUnique.mockResolvedValue(dtrContext);

    prismaMock.dtrEntry.findFirst.mockResolvedValue(null);

    const input: CreateDtrEntryDto = {
      workDate: '2026-09-05',

      regularMinutes: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 480,
      nightDifferentialMinutes: 0,

      restDay: false,

      leaveTypeId,
    };

    const createdEntry = {
      id: entryId,
      dtrId,
      workDate,

      regularMinutes: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceMinutes: 0,

      leaveMinutes: 480,

      nightDifferentialMinutes: 0,

      restDay: false,

      leaveTypeId,
      holidayId: null,

      notes: null,

      createdAt: new Date(),

      updatedAt: new Date(),

      overtimeEntries: [],
    };

    const transaction = {
      dtrEntry: {
        create: jest.fn().mockResolvedValue(createdEntry),
      },
    };

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    auditLogMock.recordSuccessInTransaction.mockResolvedValue(undefined);

    await service.createEntry(dtrId, input, actorUserId);

    expect(
      leaveBalanceServiceMock.applyUsageInTransaction,
    ).toHaveBeenCalledWith(transaction, {
      employeeId,
      companyId,

      leaveTypeId,
      leaveMinutes: 480,

      workDate,
      entryId,

      actorUserId,
    });
  });

  it('rejects entry updates when the DTR is validated', async () => {
    prismaMock.dtrEntry.findFirst.mockResolvedValue({
      ...entryContext,

      dtr: {
        ...dtrContext,
        status: DtrStatus.VALIDATED,
      },
    });

    const input: UpdateDtrEntryDto = {
      lateMinutes: 15,
    };

    await expect(
      service.updateEntry(dtrId, entryId, input, actorUserId),
    ).rejects.toThrow(
      'Attendance cannot be modified because the DTR is validated. Return the DTR to review before editing attendance.',
    );

    expect(validationServiceMock.validateEntry).not.toHaveBeenCalled();

    expect(prismaMock.$transaction).not.toHaveBeenCalled();

    expect(
      leaveBalanceServiceMock.reverseUsageInTransaction,
    ).not.toHaveBeenCalled();

    expect(
      leaveBalanceServiceMock.applyUsageInTransaction,
    ).not.toHaveBeenCalled();
  });

  it('does not update a DTR entry when VL or SL balance validation fails', async () => {
    prismaMock.dtrEntry.findFirst.mockResolvedValue(entryContext);

    validationServiceMock.validateEntry.mockRejectedValue(
      new BadRequestException('Insufficient VL balance.'),
    );

    const input: UpdateDtrEntryDto = {
      leaveMinutes: 480,
      leaveTypeId,
    };

    await expect(
      service.updateEntry(dtrId, entryId, input, actorUserId),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();

    expect(
      leaveBalanceServiceMock.reverseUsageInTransaction,
    ).not.toHaveBeenCalled();

    expect(
      leaveBalanceServiceMock.applyUsageInTransaction,
    ).not.toHaveBeenCalled();
  });

  it('reverses old leave usage and applies replacement usage transactionally', async () => {
    const leaveEntryContext = {
      ...entryContext,

      leaveMinutes: 480,
      leaveTypeId,
    };

    prismaMock.dtrEntry.findFirst.mockResolvedValue(leaveEntryContext);

    const input: UpdateDtrEntryDto = {
      leaveMinutes: 240,
      leaveTypeId,
    };

    const refreshedEntry = {
      id: entryId,
      dtrId,
      workDate,

      regularMinutes: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceMinutes: 0,

      leaveMinutes: 240,

      nightDifferentialMinutes: 0,

      restDay: false,

      leaveTypeId,
      holidayId: null,

      notes: null,

      createdAt: new Date(),

      updatedAt: new Date(),

      overtimeEntries: [],
    };

    const transaction = {
      dtrEntry: {
        update: jest.fn().mockResolvedValue({
          id: entryId,
        }),

        findUnique: jest.fn().mockResolvedValue(refreshedEntry),
      },
    };

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    auditLogMock.recordSuccessInTransaction.mockResolvedValue(undefined);

    await service.updateEntry(dtrId, entryId, input, actorUserId);

    expect(
      leaveBalanceServiceMock.reverseUsageInTransaction,
    ).toHaveBeenCalledWith(transaction, {
      employeeId,
      companyId,

      leaveTypeId,
      leaveMinutes: 480,

      workDate,
      entryId,

      actorUserId,
    });

    expect(
      leaveBalanceServiceMock.applyUsageInTransaction,
    ).toHaveBeenCalledWith(transaction, {
      employeeId,
      companyId,

      leaveTypeId,
      leaveMinutes: 240,

      workDate,
      entryId,

      actorUserId,
    });
  });

  it('does not rewrite leave ledger history when unrelated DTR fields are updated', async () => {
    prismaMock.dtrEntry.findFirst.mockResolvedValue(entryContext);

    const input: UpdateDtrEntryDto = {
      lateMinutes: 30,

      overtimeEntries: [
        {
          type: OvertimeType.REGULAR,

          minutes: 90,
        },
      ],
    };

    const refreshedEntry = {
      id: entryId,
      dtrId,
      workDate,

      regularMinutes: 480,
      lateMinutes: 30,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 0,
      nightDifferentialMinutes: 0,

      restDay: false,

      leaveTypeId: null,
      holidayId: null,

      notes: null,

      createdAt: new Date(),

      updatedAt: new Date(),

      overtimeEntries: [
        {
          id: '88888888-8888-4888-8888-888888888888',

          type: OvertimeType.REGULAR,

          minutes: 90,

          createdAt: new Date(),
        },
      ],
    };

    const transaction = {
      overtimeEntry: {
        deleteMany: jest.fn().mockResolvedValue({
          count: 1,
        }),

        createMany: jest.fn().mockResolvedValue({
          count: 1,
        }),
      },

      dtrEntry: {
        update: jest.fn().mockResolvedValue({
          id: entryId,
        }),

        findUnique: jest.fn().mockResolvedValue(refreshedEntry),
      },
    };

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    auditLogMock.recordSuccessInTransaction.mockResolvedValue(undefined);

    const result = await service.updateEntry(
      dtrId,
      entryId,
      input,
      actorUserId,
    );

    expect(
      leaveBalanceServiceMock.reverseUsageInTransaction,
    ).not.toHaveBeenCalled();

    expect(
      leaveBalanceServiceMock.applyUsageInTransaction,
    ).not.toHaveBeenCalled();

    expect(result).toEqual(refreshedEntry);
  });

  it('rejects entry deletion when the DTR is validated', async () => {
    prismaMock.dtrEntry.findFirst.mockResolvedValue({
      ...entryContext,

      dtr: {
        ...dtrContext,
        status: DtrStatus.VALIDATED,
      },
    });

    await expect(
      service.deleteEntry(dtrId, entryId, actorUserId),
    ).rejects.toThrow(
      'Attendance cannot be modified because the DTR is validated. Return the DTR to review before editing attendance.',
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();

    expect(
      leaveBalanceServiceMock.reverseUsageInTransaction,
    ).not.toHaveBeenCalled();
  });

  it('reverses leave usage before deleting a VL or SL DTR entry', async () => {
    const leaveEntryContext = {
      ...entryContext,

      leaveMinutes: 480,
      leaveTypeId,
    };

    prismaMock.dtrEntry.findFirst.mockResolvedValue(leaveEntryContext);

    const transaction = {
      overtimeEntry: {
        deleteMany: jest.fn().mockResolvedValue({
          count: 0,
        }),
      },

      dtrEntry: {
        delete: jest.fn().mockResolvedValue({
          id: entryId,
        }),
      },
    };

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    auditLogMock.recordSuccessInTransaction.mockResolvedValue(undefined);

    await service.deleteEntry(dtrId, entryId, actorUserId);

    expect(
      leaveBalanceServiceMock.reverseUsageInTransaction,
    ).toHaveBeenCalledWith(transaction, {
      employeeId,
      companyId,

      leaveTypeId,
      leaveMinutes: 480,

      workDate,
      entryId,

      actorUserId,
    });
  });

  it('deletes overtime rows and the daily entry transactionally', async () => {
    prismaMock.dtrEntry.findFirst.mockResolvedValue(entryContext);

    const transaction = {
      overtimeEntry: {
        deleteMany: jest.fn().mockResolvedValue({
          count: 1,
        }),
      },

      dtrEntry: {
        delete: jest.fn().mockResolvedValue({
          id: entryId,
        }),
      },
    };

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    auditLogMock.recordSuccessInTransaction.mockResolvedValue(undefined);

    const result = await service.deleteEntry(dtrId, entryId, actorUserId);

    expect(transaction.overtimeEntry.deleteMany).toHaveBeenCalledWith({
      where: {
        dtrEntryId: entryId,
      },
    });

    expect(transaction.dtrEntry.delete).toHaveBeenCalledWith({
      where: {
        id: entryId,
      },
    });

    expect(auditLogMock.recordSuccessInTransaction).toHaveBeenCalledWith(
      transaction,

      expect.objectContaining({
        actorUserId,
        companyId,

        action: DtrAuditAction.ENTRY_DELETED,

        module: DTR_AUDIT_MODULE,

        entityType: DTR_ENTRY_ENTITY_TYPE,

        entityId: entryId,

        reference: '2026-09-05',
      }),
    );

    expect(result).toEqual({
      deleted: true,
      entryId,
    });
  });
});
