import {
  EmployeeType,
  LeaveBalanceKind,
  LeaveTransactionType,
  Prisma,
} from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';
import type { EmployeeLeaveEntitlementView } from './employee-leave-entitlement.service';
import type { EmployeeLeaveEntitlementService } from './employee-leave-entitlement.service';
import { EmployeeLeaveEntitlementCycleService } from './employee-leave-entitlement-cycle.service';

describe('EmployeeLeaveEntitlementCycleService', () => {
  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const employmentRecordId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const actorUserId = '99999999-9999-4999-8999-999999999999';

  function createEntitlement(
    overrides: Partial<EmployeeLeaveEntitlementView> = {},
  ): EmployeeLeaveEntitlementView {
    return {
      employeeId,

      employeeNumber: 'EMP-000001',

      employmentRecordId,

      employeeType: EmployeeType.LACOM_INTERNAL,

      employmentStartDate: '2026-01-01',

      asOfDate: '2026-09-28',

      eligibilityStatus: 'ELIGIBLE',

      eligibilityDate: '2026-07-01',

      eligible: true,

      annualPaidLeaveDays: 10,

      balanceAllocation: {
        mode: 'SEPARATE_VL_SL',
        vacationLeaveDays: 5,
        sickLeaveDays: 5,
        sharedVlSlPoolDays: 0,
      },

      calendarAllocationPolicy:
        'FULL_ON_ELIGIBILITY_RESET_JANUARY_1_NO_CARRYOVER',

      ...overrides,
    };
  }

  function createEntitlementService(
    entitlement: EmployeeLeaveEntitlementView,
  ): EmployeeLeaveEntitlementService {
    return {
      getLeaveEntitlement: jest.fn().mockResolvedValue(entitlement),
    } as unknown as EmployeeLeaveEntitlementService;
  }

  function createAuditLogService(): AuditLogService {
    return {
      recordSuccessInTransaction: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditLogService;
  }

  it('does not create a cycle when employee classification is required', async () => {
    const upsert = jest.fn();

    const prisma = {
      employeeLeaveEntitlementCycle: {
        upsert,
      },
    } as unknown as PrismaService;

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(
        createEntitlement({
          employeeType: null,

          eligibilityStatus: 'CLASSIFICATION_REQUIRED',

          eligibilityDate: null,
          eligible: null,
          annualPaidLeaveDays: null,

          balanceAllocation: null,

          calendarAllocationPolicy: null,
        }),
      ),
      createAuditLogService(),
    );

    const result = await service.ensureAnnualCycle(
      employeeId,
      '2026-09-28',
      actorUserId,
    );

    expect(result.status).toBe('CLASSIFICATION_REQUIRED');

    expect(result.cycle).toBeNull();

    expect(upsert).not.toHaveBeenCalled();
  });

  it('does not create a cycle before eligibility date', async () => {
    const upsert = jest.fn();

    const prisma = {
      employeeLeaveEntitlementCycle: {
        upsert,
      },
    } as unknown as PrismaService;

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(
        createEntitlement({
          employeeType: EmployeeType.CLIENT_EMPLOYEE,

          asOfDate: '2026-12-31',

          eligibilityStatus: 'NOT_YET_ELIGIBLE',

          eligibilityDate: '2027-01-01',

          eligible: false,

          annualPaidLeaveDays: 5,
        }),
      ),
      createAuditLogService(),
    );

    const result = await service.ensureAnnualCycle(
      employeeId,
      '2026-12-31',
      actorUserId,
    );

    expect(result.status).toBe('NOT_YET_ELIGIBLE');

    expect(result.cycle).toBeNull();

    expect(upsert).not.toHaveBeenCalled();
  });

  it('creates internal VL and SL balances for a mid-year normal entitlement cycle', async () => {
    const createdAt = new Date('2026-09-28T07:30:00.000Z');
    const updatedAt = new Date('2026-09-28T07:30:00.000Z');

    const cycle = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

      employeeId,
      employmentRecordId,

      calendarYear: 2026,

      employeeType: EmployeeType.LACOM_INTERNAL,

      employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),

      eligibilityDate: new Date('2026-07-01T00:00:00.000Z'),

      annualEntitlementDays: new Prisma.Decimal(10),

      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),

      expiresOn: new Date('2026-12-31T00:00:00.000Z'),

      initializationReviewRequired: false,

      createdAt,
      updatedAt,
    };

    const upsert = jest.fn().mockResolvedValue({
      id: cycle.id,
    });

    const leaveAccountCreateMany = jest
      .fn()
      .mockResolvedValueOnce({
        count: 1,
      })
      .mockResolvedValueOnce({
        count: 1,
      });

    const leaveAccountFindUniqueOrThrow = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      })
      .mockResolvedValueOnce({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      });

    const leaveTransactionCreate = jest.fn().mockResolvedValue({});

    const transaction = {
      employeeLeaveEntitlementCycle: {
        upsert,
        findUniqueOrThrow: jest.fn().mockResolvedValue(cycle),
      },

      employeeLeaveAccount: {
        createMany: leaveAccountCreateMany,
        findUniqueOrThrow: leaveAccountFindUniqueOrThrow,
      },

      leaveTransaction: {
        create: leaveTransactionCreate,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        ),
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(createEntitlement()),
      auditLog,
    );

    const result = await service.ensureAnnualCycle(
      employeeId,
      '2026-09-28',
      actorUserId,
    );

    expect(upsert).toHaveBeenCalledWith({
      where: {
        employeeId_calendarYear: {
          employeeId,
          calendarYear: 2026,
        },
      },

      create: {
        employeeId,
        employmentRecordId,
        calendarYear: 2026,
        employeeType: EmployeeType.LACOM_INTERNAL,
        employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
        eligibilityDate: new Date('2026-07-01T00:00:00.000Z'),
        annualEntitlementDays: new Prisma.Decimal(10),
        effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
        expiresOn: new Date('2026-12-31T00:00:00.000Z'),
        initializationReviewRequired: false,
      },

      update: {},

      select: {
        id: true,
      },
    });

    expect(leaveAccountCreateMany).toHaveBeenCalledTimes(2);

    expect(leaveAccountCreateMany).toHaveBeenNthCalledWith(1, {
      data: {
        employeeId,
        leaveTypeId: null,
        entitlementCycleId: cycle.id,
        balanceKind: LeaveBalanceKind.VL,
        currentBalance: new Prisma.Decimal(5),
      },

      skipDuplicates: true,
    });

    expect(leaveAccountCreateMany).toHaveBeenNthCalledWith(2, {
      data: {
        employeeId,
        leaveTypeId: null,
        entitlementCycleId: cycle.id,
        balanceKind: LeaveBalanceKind.SL,
        currentBalance: new Prisma.Decimal(5),
      },

      skipDuplicates: true,
    });

    expect(leaveTransactionCreate).toHaveBeenCalledTimes(2);

    expect(leaveTransactionCreate).toHaveBeenNthCalledWith(1, {
      data: {
        leaveAccountId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

        type: LeaveTransactionType.INITIAL_ALLOCATION,

        quantity: new Prisma.Decimal(5),

        effectiveDate: cycle.effectiveFrom,

        referenceType: 'LEAVE_ENTITLEMENT_CYCLE',
        referenceId: cycle.id,

        notes: '2026 VL annual leave entitlement allocation.',

        createdByUserId: actorUserId,
      },
    });

    expect(leaveTransactionCreate).toHaveBeenNthCalledWith(2, {
      data: {
        leaveAccountId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',

        type: LeaveTransactionType.INITIAL_ALLOCATION,

        quantity: new Prisma.Decimal(5),

        effectiveDate: cycle.effectiveFrom,

        referenceType: 'LEAVE_ENTITLEMENT_CYCLE',
        referenceId: cycle.id,

        notes: '2026 SL annual leave entitlement allocation.',

        createdByUserId: actorUserId,
      },
    });

    expect(result.status).toBe('CYCLE_READY');

    expect(result.cycle).toEqual({
      id: cycle.id,

      employeeId,
      employmentRecordId,

      calendarYear: 2026,

      employeeType: EmployeeType.LACOM_INTERNAL,

      employmentStartDate: '2026-01-01',

      eligibilityDate: '2026-07-01',

      annualEntitlementDays: '10',

      effectiveFrom: '2026-07-01',

      expiresOn: '2026-12-31',

      initializationReviewRequired: false,

      createdAt,
      updatedAt,
    });

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });

  it('creates one shared client VL/SL balance effective January 1 on normal ensure', async () => {
    const cycle = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

      employeeId,
      employmentRecordId,

      calendarYear: 2026,

      employeeType: EmployeeType.CLIENT_EMPLOYEE,

      employmentStartDate: new Date('2024-01-01T00:00:00.000Z'),

      eligibilityDate: new Date('2025-01-01T00:00:00.000Z'),

      annualEntitlementDays: new Prisma.Decimal(5),

      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),

      expiresOn: new Date('2026-12-31T00:00:00.000Z'),

      initializationReviewRequired: false,

      createdAt: new Date('2026-09-28T07:30:00.000Z'),

      updatedAt: new Date('2026-09-28T07:30:00.000Z'),
    };

    const upsert = jest.fn().mockResolvedValue({
      id: cycle.id,
    });

    const leaveAccountCreateMany = jest.fn().mockResolvedValue({
      count: 1,
    });

    const leaveAccountFindUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    });

    const leaveTransactionCreate = jest.fn().mockResolvedValue({});

    const transaction = {
      employeeLeaveEntitlementCycle: {
        upsert,
        findUniqueOrThrow: jest.fn().mockResolvedValue(cycle),
      },

      employeeLeaveAccount: {
        createMany: leaveAccountCreateMany,
        findUniqueOrThrow: leaveAccountFindUniqueOrThrow,
      },

      leaveTransaction: {
        create: leaveTransactionCreate,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        ),
    } as unknown as PrismaService;

    const entitlement = createEntitlement({
      employeeType: EmployeeType.CLIENT_EMPLOYEE,

      employmentStartDate: '2024-01-01',

      eligibilityDate: '2025-01-01',

      annualPaidLeaveDays: 5,

      balanceAllocation: {
        mode: 'SHARED_VL_SL_POOL',
        vacationLeaveDays: 0,
        sickLeaveDays: 0,
        sharedVlSlPoolDays: 5,
      },
    });

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(entitlement),
      createAuditLogService(),
    );

    const result = await service.ensureAnnualCycle(
      employeeId,
      '2026-09-28',
      actorUserId,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employeeId_calendarYear: {
            employeeId,
            calendarYear: 2026,
          },
        },

        create: expect.objectContaining({
          employeeType: EmployeeType.CLIENT_EMPLOYEE,

          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),

          initializationReviewRequired: false,
        }) as unknown,
      }),
    );

    expect(leaveAccountCreateMany).toHaveBeenCalledTimes(1);

    expect(leaveAccountCreateMany).toHaveBeenCalledWith({
      data: {
        employeeId,
        leaveTypeId: null,
        entitlementCycleId: cycle.id,
        balanceKind: LeaveBalanceKind.SHARED_VL_SL_POOL,
        currentBalance: new Prisma.Decimal(5),
      },

      skipDuplicates: true,
    });

    expect(leaveTransactionCreate).toHaveBeenCalledTimes(1);

    expect(leaveTransactionCreate).toHaveBeenCalledWith({
      data: {
        leaveAccountId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',

        type: LeaveTransactionType.INITIAL_ALLOCATION,

        quantity: new Prisma.Decimal(5),

        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),

        referenceType: 'LEAVE_ENTITLEMENT_CYCLE',
        referenceId: cycle.id,

        notes: '2026 SHARED_VL_SL_POOL annual leave entitlement allocation.',

        createdByUserId: actorUserId,
      },
    });

    expect(result.cycle?.initializationReviewRequired).toBe(false);
    expect(result.cycle?.annualEntitlementDays).toBe('5');
  });

  it('does not duplicate normal annual allocations on repeated ensure calls', async () => {
    const cycle = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

      employeeId,
      employmentRecordId,

      calendarYear: 2026,

      employeeType: EmployeeType.LACOM_INTERNAL,

      employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),

      eligibilityDate: new Date('2026-07-01T00:00:00.000Z'),

      annualEntitlementDays: new Prisma.Decimal(10),

      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),

      expiresOn: new Date('2026-12-31T00:00:00.000Z'),

      initializationReviewRequired: false,

      createdAt: new Date('2026-09-28T07:30:00.000Z'),

      updatedAt: new Date('2026-09-28T07:30:00.000Z'),
    };

    const upsert = jest.fn().mockResolvedValue({
      id: cycle.id,
    });

    const leaveAccountCreateMany = jest
      .fn()
      .mockResolvedValueOnce({
        count: 1,
      })
      .mockResolvedValueOnce({
        count: 1,
      })
      .mockResolvedValueOnce({
        count: 0,
      })
      .mockResolvedValueOnce({
        count: 0,
      });

    const leaveAccountFindUniqueOrThrow = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      })
      .mockResolvedValueOnce({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      })
      .mockResolvedValueOnce({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      })
      .mockResolvedValueOnce({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      });

    const leaveTransactionCreate = jest.fn().mockResolvedValue({});

    const transaction = {
      employeeLeaveEntitlementCycle: {
        upsert,
        findUniqueOrThrow: jest.fn().mockResolvedValue(cycle),
      },

      employeeLeaveAccount: {
        createMany: leaveAccountCreateMany,
        findUniqueOrThrow: leaveAccountFindUniqueOrThrow,
      },

      leaveTransaction: {
        create: leaveTransactionCreate,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        ),
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(createEntitlement()),
      auditLog,
    );

    await service.ensureAnnualCycle(employeeId, '2026-09-28', actorUserId);

    const result = await service.ensureAnnualCycle(
      employeeId,
      '2026-09-28',
      actorUserId,
    );

    expect(upsert).toHaveBeenCalledTimes(2);

    for (const [rawCall] of upsert.mock.calls) {
      const call = rawCall as unknown as { where: unknown };

      expect(call.where).toEqual({
        employeeId_calendarYear: {
          employeeId,
          calendarYear: 2026,
        },
      });
    }

    expect(leaveAccountCreateMany).toHaveBeenCalledTimes(4);

    expect(leaveAccountFindUniqueOrThrow).toHaveBeenCalledTimes(4);

    expect(leaveTransactionCreate).toHaveBeenCalledTimes(2);

    expect(result.cycle?.initializationReviewRequired).toBe(false);

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });

  it('initializes an eligible annual cycle and audits the review transition once', async () => {
    const actorUserId = '99999999-9999-4999-8999-999999999999';
    const companyId = '11111111-1111-4111-8111-111111111111';

    const createdAt = new Date('2026-09-29T03:30:00.000Z');
    const updatedAt = new Date('2026-09-29T03:30:00.000Z');

    const cycle = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      employeeId,
      employmentRecordId,
      calendarYear: 2026,
      employeeType: EmployeeType.LACOM_INTERNAL,
      employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
      eligibilityDate: new Date('2026-07-01T00:00:00.000Z'),
      annualEntitlementDays: new Prisma.Decimal(10),
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      expiresOn: new Date('2026-12-31T00:00:00.000Z'),
      initializationReviewRequired: true,
      createdAt,
      updatedAt,
    };

    const upsert = jest.fn().mockResolvedValue({
      id: cycle.id,
    });

    const updateMany = jest.fn().mockResolvedValue({
      count: 1,
    });

    const findUniqueOrThrow = jest.fn().mockResolvedValue(cycle);

    const employmentRecordFindUniqueOrThrow = jest.fn().mockResolvedValue({
      companyId,
    });

    const leaveAccountCreateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const leaveAccountFindUniqueOrThrow = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      })
      .mockResolvedValueOnce({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      });

    const leaveTransactionCreate = jest.fn().mockResolvedValue({});

    const transaction = {
      employeeLeaveEntitlementCycle: {
        upsert,
        updateMany,
        findUniqueOrThrow,
      },

      employeeLeaveAccount: {
        createMany: leaveAccountCreateMany,
        findUniqueOrThrow: leaveAccountFindUniqueOrThrow,
      },

      leaveTransaction: {
        create: leaveTransactionCreate,
      },

      employmentRecord: {
        findUniqueOrThrow: employmentRecordFindUniqueOrThrow,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        ),
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(createEntitlement()),
      auditLog,
    );

    const result = await service.initializeAnnualCycle(
      employeeId,
      '2026-09-29',
      actorUserId,
    );

    expect(upsert).toHaveBeenCalledWith({
      where: {
        employeeId_calendarYear: {
          employeeId,
          calendarYear: 2026,
        },
      },

      create: {
        employeeId,
        employmentRecordId,
        calendarYear: 2026,
        employeeType: EmployeeType.LACOM_INTERNAL,
        employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
        eligibilityDate: new Date('2026-07-01T00:00:00.000Z'),
        annualEntitlementDays: new Prisma.Decimal(10),
        effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
        expiresOn: new Date('2026-12-31T00:00:00.000Z'),
        initializationReviewRequired: false,
      },

      update: {},

      select: {
        id: true,
      },
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        employeeId,
        calendarYear: 2026,
        initializationReviewRequired: false,
      },

      data: {
        initializationReviewRequired: true,
      },
    });

    expect(leaveAccountCreateMany).toHaveBeenCalledTimes(2);

    expect(leaveAccountCreateMany).toHaveBeenNthCalledWith(1, {
      data: {
        employeeId,
        leaveTypeId: null,
        entitlementCycleId: cycle.id,
        balanceKind: LeaveBalanceKind.VL,
        currentBalance: new Prisma.Decimal(5),
      },
      skipDuplicates: true,
    });

    expect(leaveAccountCreateMany).toHaveBeenNthCalledWith(2, {
      data: {
        employeeId,
        leaveTypeId: null,
        entitlementCycleId: cycle.id,
        balanceKind: LeaveBalanceKind.SL,
        currentBalance: new Prisma.Decimal(5),
      },
      skipDuplicates: true,
    });

    expect(leaveTransactionCreate).toHaveBeenCalledTimes(2);

    expect(leaveTransactionCreate).toHaveBeenNthCalledWith(1, {
      data: {
        leaveAccountId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        type: LeaveTransactionType.INITIAL_ALLOCATION,
        quantity: new Prisma.Decimal(5),
        effectiveDate: cycle.effectiveFrom,
        referenceType: 'LEAVE_ENTITLEMENT_CYCLE',
        referenceId: cycle.id,
        notes: '2026 VL annual leave entitlement allocation.',
        createdByUserId: actorUserId,
      },
    });

    expect(leaveTransactionCreate).toHaveBeenNthCalledWith(2, {
      data: {
        leaveAccountId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        type: LeaveTransactionType.INITIAL_ALLOCATION,
        quantity: new Prisma.Decimal(5),
        effectiveDate: cycle.effectiveFrom,
        referenceType: 'LEAVE_ENTITLEMENT_CYCLE',
        referenceId: cycle.id,
        notes: '2026 SL annual leave entitlement allocation.',
        createdByUserId: actorUserId,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledTimes(1);

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,
      companyId,
      action: EmployeeManagementAuditAction.LEAVE_ENTITLEMENT_INITIALIZED,
      module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
      entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
      entityId: employeeId,
      reference: 'EMP-000001',
      details:
        'Initialized 2026 leave entitlement cycle for ' +
        'employee EMP-000001 and marked it for review.',
      metadata: {
        leaveEntitlementCycleId: cycle.id,
        employmentRecordId,
        calendarYear: 2026,
        employeeType: EmployeeType.LACOM_INTERNAL,
        employmentStartDate: '2026-01-01',
        eligibilityDate: '2026-07-01',
        annualEntitlementDays: 10,
        effectiveFrom: '2026-07-01',
        expiresOn: '2026-12-31',
        initializationReviewRequired: true,
      },
    });

    expect(result.status).toBe('CYCLE_READY');
    expect(result.cycle?.initializationReviewRequired).toBe(true);
  });

  it('creates one shared VL/SL annual balance for a client employee', async () => {
    const actorUserId = '99999999-9999-4999-8999-999999999999';

    const cycle = {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      employeeId,
      employmentRecordId,
      calendarYear: 2026,
      employeeType: EmployeeType.CLIENT_EMPLOYEE,
      employmentStartDate: new Date('2025-01-01T00:00:00.000Z'),
      eligibilityDate: new Date('2026-01-01T00:00:00.000Z'),
      annualEntitlementDays: new Prisma.Decimal(5),
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      expiresOn: new Date('2026-12-31T00:00:00.000Z'),
      initializationReviewRequired: true,
      createdAt: new Date('2026-09-29T03:30:00.000Z'),
      updatedAt: new Date('2026-09-29T03:30:00.000Z'),
    };

    const leaveAccountCreateMany = jest.fn().mockResolvedValue({
      count: 1,
    });

    const leaveAccountFindUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'abababab-abab-4bab-8bab-abababababab',
    });

    const leaveTransactionCreate = jest.fn().mockResolvedValue({});

    const transaction = {
      employeeLeaveEntitlementCycle: {
        upsert: jest.fn().mockResolvedValue({
          id: cycle.id,
        }),

        updateMany: jest.fn().mockResolvedValue({
          count: 0,
        }),

        findUniqueOrThrow: jest.fn().mockResolvedValue(cycle),
      },

      employeeLeaveAccount: {
        createMany: leaveAccountCreateMany,
        findUniqueOrThrow: leaveAccountFindUniqueOrThrow,
      },

      leaveTransaction: {
        create: leaveTransactionCreate,
      },

      employmentRecord: {
        findUniqueOrThrow: jest.fn(),
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        ),
    } as unknown as PrismaService;

    const auditLog = createAuditLogService();

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(
        createEntitlement({
          employeeType: EmployeeType.CLIENT_EMPLOYEE,

          employmentStartDate: '2025-01-01',

          asOfDate: '2026-09-29',

          eligibilityDate: '2026-01-01',

          annualPaidLeaveDays: 5,

          balanceAllocation: {
            mode: 'SHARED_VL_SL_POOL',
            vacationLeaveDays: 0,
            sickLeaveDays: 0,
            sharedVlSlPoolDays: 5,
          },
        }),
      ),
      auditLog,
    );

    const result = await service.initializeAnnualCycle(
      employeeId,
      '2026-09-29',
      actorUserId,
    );

    expect(leaveAccountCreateMany).toHaveBeenCalledTimes(1);

    expect(leaveAccountCreateMany).toHaveBeenCalledWith({
      data: {
        employeeId,
        leaveTypeId: null,
        entitlementCycleId: cycle.id,
        balanceKind: LeaveBalanceKind.SHARED_VL_SL_POOL,
        currentBalance: new Prisma.Decimal(5),
      },
      skipDuplicates: true,
    });

    expect(leaveAccountFindUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        entitlementCycleId_balanceKind: {
          entitlementCycleId: cycle.id,
          balanceKind: LeaveBalanceKind.SHARED_VL_SL_POOL,
        },
      },

      select: {
        id: true,
      },
    });

    expect(leaveTransactionCreate).toHaveBeenCalledTimes(1);

    expect(leaveTransactionCreate).toHaveBeenCalledWith({
      data: {
        leaveAccountId: 'abababab-abab-4bab-8bab-abababababab',

        type: LeaveTransactionType.INITIAL_ALLOCATION,

        quantity: new Prisma.Decimal(5),

        effectiveDate: cycle.effectiveFrom,

        referenceType: 'LEAVE_ENTITLEMENT_CYCLE',
        referenceId: cycle.id,

        notes: '2026 SHARED_VL_SL_POOL annual leave entitlement allocation.',

        createdByUserId: actorUserId,
      },
    });

    expect(result.status).toBe('CYCLE_READY');
    expect(result.cycle?.employeeType).toBe(EmployeeType.CLIENT_EMPLOYEE);
    expect(result.cycle?.annualEntitlementDays).toBe('5');
  });

  it('does not duplicate the initialization audit when the cycle is already marked for review', async () => {
    const actorUserId = '99999999-9999-4999-8999-999999999999';

    const cycle = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      employeeId,
      employmentRecordId,
      calendarYear: 2026,
      employeeType: EmployeeType.LACOM_INTERNAL,
      employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
      eligibilityDate: new Date('2026-07-01T00:00:00.000Z'),
      annualEntitlementDays: new Prisma.Decimal(10),
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      expiresOn: new Date('2026-12-31T00:00:00.000Z'),
      initializationReviewRequired: true,
      createdAt: new Date('2026-09-29T03:30:00.000Z'),
      updatedAt: new Date('2026-09-29T03:30:00.000Z'),
    };

    const employmentRecordFindUniqueOrThrow = jest.fn();

    const leaveAccountCreateMany = jest.fn().mockResolvedValue({
      count: 0,
    });

    const leaveAccountFindUniqueOrThrow = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      })
      .mockResolvedValueOnce({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      });

    const leaveTransactionCreate = jest.fn();

    const transaction = {
      employeeLeaveEntitlementCycle: {
        upsert: jest.fn().mockResolvedValue({
          id: cycle.id,
        }),

        updateMany: jest.fn().mockResolvedValue({
          count: 0,
        }),

        findUniqueOrThrow: jest.fn().mockResolvedValue(cycle),
      },

      employeeLeaveAccount: {
        createMany: leaveAccountCreateMany,
        findUniqueOrThrow: leaveAccountFindUniqueOrThrow,
      },

      leaveTransaction: {
        create: leaveTransactionCreate,
      },

      employmentRecord: {
        findUniqueOrThrow: employmentRecordFindUniqueOrThrow,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        ),
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(createEntitlement()),
      auditLog,
    );

    const result = await service.initializeAnnualCycle(
      employeeId,
      '2026-09-29',
      actorUserId,
    );

    expect(leaveAccountCreateMany).toHaveBeenCalledTimes(2);

    expect(leaveAccountFindUniqueOrThrow).toHaveBeenCalledTimes(2);

    expect(leaveTransactionCreate).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();

    expect(employmentRecordFindUniqueOrThrow).not.toHaveBeenCalled();

    expect(result.status).toBe('CYCLE_READY');
    expect(result.cycle?.id).toBe(cycle.id);
    expect(result.cycle?.initializationReviewRequired).toBe(true);
  });

  it('does not reopen initialization review after review was already completed', async () => {
    const actorUserId = '99999999-9999-4999-8999-999999999999';

    const cycle = {
      id: 'abababab-cdcd-4efe-8aaa-bbbbbbbbbbbb',
      employeeId,
      employmentRecordId,
      calendarYear: 2026,
      employeeType: EmployeeType.LACOM_INTERNAL,
      employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
      eligibilityDate: new Date('2026-07-01T00:00:00.000Z'),
      annualEntitlementDays: new Prisma.Decimal(10),
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      expiresOn: new Date('2026-12-31T00:00:00.000Z'),
      initializationReviewRequired: false,
      createdAt: new Date('2026-09-29T03:30:00.000Z'),
      updatedAt: new Date('2026-09-30T03:30:00.000Z'),
    };

    const updateMany = jest.fn();

    const leaveAccountCreateMany = jest.fn().mockResolvedValue({
      count: 0,
    });

    const leaveAccountFindUniqueOrThrow = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      })
      .mockResolvedValueOnce({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      });

    const leaveTransactionCreate = jest.fn();

    const employmentRecordFindUniqueOrThrow = jest.fn();

    const transaction = {
      employeeLeaveEntitlementCycle: {
        upsert: jest.fn().mockResolvedValue({
          id: cycle.id,
        }),

        updateMany,

        findUniqueOrThrow: jest.fn().mockResolvedValue(cycle),
      },

      employeeLeaveAccount: {
        createMany: leaveAccountCreateMany,
        findUniqueOrThrow: leaveAccountFindUniqueOrThrow,
      },

      leaveTransaction: {
        create: leaveTransactionCreate,
      },

      employmentRecord: {
        findUniqueOrThrow: employmentRecordFindUniqueOrThrow,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        ),
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(createEntitlement()),
      auditLog,
    );

    const result = await service.initializeAnnualCycle(
      employeeId,
      '2026-09-29',
      actorUserId,
    );

    expect(leaveAccountCreateMany).toHaveBeenCalledTimes(2);

    expect(leaveAccountFindUniqueOrThrow).toHaveBeenCalledTimes(2);

    expect(updateMany).not.toHaveBeenCalled();

    expect(leaveTransactionCreate).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();

    expect(employmentRecordFindUniqueOrThrow).not.toHaveBeenCalled();

    expect(result.status).toBe('CYCLE_READY');

    expect(result.cycle?.id).toBe(cycle.id);

    expect(result.cycle?.initializationReviewRequired).toBe(false);
  });

  it('completes initialization review and audits the transition', async () => {
    const actorUserId = '99999999-9999-4999-8999-999999999999';
    const companyId = '11111111-1111-4111-8111-111111111111';

    const existingCycle = {
      id: '12121212-1212-4121-8121-121212121212',
      employeeId,
      employmentRecordId,
      calendarYear: 2026,
      employeeType: EmployeeType.LACOM_INTERNAL,
      employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
      eligibilityDate: new Date('2026-07-01T00:00:00.000Z'),
      annualEntitlementDays: new Prisma.Decimal(10),
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      expiresOn: new Date('2026-12-31T00:00:00.000Z'),
      initializationReviewRequired: true,
      createdAt: new Date('2026-09-29T03:30:00.000Z'),
      updatedAt: new Date('2026-09-29T03:30:00.000Z'),
    };

    const savedCycle = {
      ...existingCycle,
      initializationReviewRequired: false,
      updatedAt: new Date('2026-10-01T01:00:00.000Z'),
    };

    const findUnique = jest.fn().mockResolvedValue(existingCycle);

    const updateMany = jest.fn().mockResolvedValue({
      count: 1,
    });

    const findUniqueOrThrow = jest.fn().mockResolvedValue(savedCycle);

    const employmentRecordFindUniqueOrThrow = jest.fn().mockResolvedValue({
      companyId,
    });

    const employeeFindUniqueOrThrow = jest.fn().mockResolvedValue({
      employeeNumber: 'EMP-000001',
    });

    const transaction = {
      employeeLeaveEntitlementCycle: {
        findUnique,
        updateMany,
        findUniqueOrThrow,
      },

      employmentRecord: {
        findUniqueOrThrow: employmentRecordFindUniqueOrThrow,
      },

      employee: {
        findUniqueOrThrow: employeeFindUniqueOrThrow,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        ),
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(createEntitlement()),
      auditLog,
    );

    const result = await service.completeInitializationReview(
      employeeId,
      '2026-10-01',
      actorUserId,
    );

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        employeeId_calendarYear: {
          employeeId,
          calendarYear: 2026,
        },
      },

      select: {
        id: true,
        employeeId: true,
        employmentRecordId: true,
        calendarYear: true,
        employeeType: true,
        employmentStartDate: true,
        eligibilityDate: true,
        annualEntitlementDays: true,
        effectiveFrom: true,
        expiresOn: true,
        initializationReviewRequired: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: existingCycle.id,
        initializationReviewRequired: true,
      },

      data: {
        initializationReviewRequired: false,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledTimes(1);

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId,

      action: EmployeeManagementAuditAction.LEAVE_ENTITLEMENT_REVIEW_COMPLETED,

      module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

      entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

      entityId: employeeId,

      reference: 'EMP-000001',

      details:
        'Completed 2026 leave entitlement initialization ' +
        'review for employee EMP-000001.',

      metadata: {
        leaveEntitlementCycleId: savedCycle.id,
        employmentRecordId,
        calendarYear: 2026,
        employeeType: EmployeeType.LACOM_INTERNAL,
        initializationReviewRequired: false,
      },
    });

    expect(result.initializationReviewRequired).toBe(false);
    expect(result.calendarYear).toBe(2026);
    expect(result.annualEntitlementDays).toBe('10');
  });

  it('is idempotent when initialization review is already complete', async () => {
    const actorUserId = '99999999-9999-4999-8999-999999999999';

    const cycle = {
      id: '34343434-3434-4343-8343-343434343434',
      employeeId,
      employmentRecordId,
      calendarYear: 2026,
      employeeType: EmployeeType.LACOM_INTERNAL,
      employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
      eligibilityDate: new Date('2026-07-01T00:00:00.000Z'),
      annualEntitlementDays: new Prisma.Decimal(10),
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
      expiresOn: new Date('2026-12-31T00:00:00.000Z'),
      initializationReviewRequired: false,
      createdAt: new Date('2026-09-29T03:30:00.000Z'),
      updatedAt: new Date('2026-10-01T01:00:00.000Z'),
    };

    const updateMany = jest.fn();
    const findUniqueOrThrow = jest.fn();
    const employmentRecordFindUniqueOrThrow = jest.fn();
    const employeeFindUniqueOrThrow = jest.fn();

    const transaction = {
      employeeLeaveEntitlementCycle: {
        findUnique: jest.fn().mockResolvedValue(cycle),
        updateMany,
        findUniqueOrThrow,
      },

      employmentRecord: {
        findUniqueOrThrow: employmentRecordFindUniqueOrThrow,
      },

      employee: {
        findUniqueOrThrow: employeeFindUniqueOrThrow,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        ),
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn();

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(createEntitlement()),
      auditLog,
    );

    const result = await service.completeInitializationReview(
      employeeId,
      '2026-10-01',
      actorUserId,
    );

    expect(updateMany).not.toHaveBeenCalled();

    expect(findUniqueOrThrow).not.toHaveBeenCalled();

    expect(employmentRecordFindUniqueOrThrow).not.toHaveBeenCalled();

    expect(employeeFindUniqueOrThrow).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();

    expect(result.initializationReviewRequired).toBe(false);
    expect(result.id).toBe(cycle.id);
  });

  it('rejects review completion when the annual cycle does not exist', async () => {
    const actorUserId = '99999999-9999-4999-8999-999999999999';

    const updateMany = jest.fn();

    const transaction = {
      employeeLeaveEntitlementCycle: {
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: Prisma.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        ),
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn();

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(createEntitlement()),
      auditLog,
    );

    await expect(
      service.completeInitializationReview(
        employeeId,
        '2026-10-01',
        actorUserId,
      ),
    ).rejects.toThrow(
      'Employee does not have an initialized 2026 leave entitlement.',
    );

    expect(updateMany).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });

  it('does not initialize a cycle when classification is required', async () => {
    const transaction = jest.fn();

    const prisma = {
      $transaction: transaction,
    } as unknown as PrismaService;

    const auditLog = createAuditLogService();

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(
        createEntitlement({
          employeeType: null,
          eligibilityStatus: 'CLASSIFICATION_REQUIRED',
          eligibilityDate: null,
          eligible: null,
          annualPaidLeaveDays: null,
          calendarAllocationPolicy: null,
        }),
      ),
      auditLog,
    );

    const result = await service.initializeAnnualCycle(
      employeeId,
      '2026-09-29',
      '99999999-9999-4999-8999-999999999999',
    );

    expect(result.status).toBe('CLASSIFICATION_REQUIRED');
    expect(result.cycle).toBeNull();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not initialize a cycle before the employee is eligible', async () => {
    const transaction = jest.fn();

    const prisma = {
      $transaction: transaction,
    } as unknown as PrismaService;

    const auditLog = createAuditLogService();

    const service = new EmployeeLeaveEntitlementCycleService(
      prisma,
      createEntitlementService(
        createEntitlement({
          employeeType: EmployeeType.CLIENT_EMPLOYEE,
          asOfDate: '2026-12-31',
          eligibilityStatus: 'NOT_YET_ELIGIBLE',
          eligibilityDate: '2027-01-01',
          eligible: false,
          annualPaidLeaveDays: 5,
        }),
      ),
      auditLog,
    );

    const result = await service.initializeAnnualCycle(
      employeeId,
      '2026-12-31',
      '99999999-9999-4999-8999-999999999999',
    );

    expect(result.status).toBe('NOT_YET_ELIGIBLE');
    expect(result.cycle).toBeNull();
    expect(transaction).not.toHaveBeenCalled();
  });
});
