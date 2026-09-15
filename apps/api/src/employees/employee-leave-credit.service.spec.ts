import { BadRequestException } from '@nestjs/common';
import {
  LeaveUnit,
  Prisma,
  type Prisma as PrismaTypes,
} from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';
import { EmployeeLeaveCreditService } from './employee-leave-credit.service';

describe('EmployeeLeaveCreditService', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const employmentRecordId = '44444444-4444-4444-8444-444444444444';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const leaveTypeId = '22222222-2222-4222-8222-222222222222';

  const leaveAccountId = '33333333-3333-4333-8333-333333333333';

  const leaveTransactionId = '55555555-5555-4555-8555-555555555555';

  const employee = {
    id: employeeId,
    employeeNumber: 'EMP-0001',

    firstName: 'Gino',
    lastName: 'Suson',

    employmentRecords: [
      {
        id: employmentRecordId,

        startDate: new Date('2026-01-01T00:00:00.000Z'),

        company: {
          id: companyId,
        },
      },
    ],
  };

  it('creates VL type/account and adds leave credit', async () => {
    const createdAt = new Date('2026-09-15T01:00:00.000Z');

    const leaveTypeUpsert = jest.fn().mockResolvedValue({
      id: leaveTypeId,
      code: 'VL',
      name: 'Vacation Leave',
      unit: LeaveUnit.DAY,
    });

    const leaveAccountFindUnique = jest.fn().mockResolvedValue(null);

    const leaveAccountCreate = jest.fn().mockResolvedValue({
      id: leaveAccountId,
      currentBalance: new Prisma.Decimal(5),
    });

    const leaveTransactionCreate = jest.fn().mockResolvedValue({
      id: leaveTransactionId,

      effectiveDate: new Date('2026-09-15T00:00:00.000Z'),

      notes: 'Initial allocation',

      createdAt,
    });

    const transaction = {
      leaveType: {
        upsert: leaveTypeUpsert,
      },

      employeeLeaveAccount: {
        findUnique: leaveAccountFindUnique,
        create: leaveAccountCreate,
        update: jest.fn(),
      },

      leaveTransaction: {
        create: leaveTransactionCreate,
      },
    } as unknown as PrismaTypes.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      $transaction: jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: PrismaTypes.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        ),
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeeLeaveCreditService(prisma, auditLog);

    const result = await service.adjustLeaveCredit(
      employeeId,
      {
        leaveCode: 'VL',
        quantity: 5,
        effectiveDate: '2026-09-15',
        notes: 'Initial allocation',
      },
      actorUserId,
    );

    expect(leaveTypeUpsert).toHaveBeenCalledWith({
      where: {
        companyId_code: {
          companyId,
          code: 'VL',
        },
      },

      create: {
        companyId,
        code: 'VL',
        name: 'Vacation Leave',
        unit: LeaveUnit.DAY,
        active: true,
      },

      update: {
        active: true,
      },

      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
      },
    });

    expect(leaveAccountCreate).toHaveBeenCalledWith({
      data: {
        employeeId,
        leaveTypeId,
        currentBalance: new Prisma.Decimal(5),
      },

      select: {
        id: true,
        currentBalance: true,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId,

      action: EmployeeManagementAuditAction.LEAVE_BALANCE_ADJUSTED,

      module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

      entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

      entityId: employeeId,

      reference: 'EMP-0001',

      details: 'Adjusted VL balance for Gino Suson (EMP-0001) by 5 day(s).',

      metadata: {
        employmentRecordId,

        leaveAccountId,

        leaveTransactionId,

        leaveTypeId,

        leaveCode: 'VL',

        previousBalance: '0',

        adjustmentQuantity: '5',

        currentBalance: '5',

        effectiveDate: '2026-09-15',

        notes: 'Initial allocation',
      },
    });

    expect(result).toEqual({
      leaveAccountId,

      leaveTransactionId,

      employeeId,
      employeeNumber: 'EMP-0001',

      companyId,

      leaveTypeId,

      leaveCode: 'VL',

      leaveName: 'Vacation Leave',

      unit: LeaveUnit.DAY,

      previousBalance: '0',

      adjustmentQuantity: '5',

      currentBalance: '5',

      effectiveDate: new Date('2026-09-15T00:00:00.000Z'),

      notes: 'Initial allocation',

      createdAt,
    });
  });

  it('updates an existing SL account with a negative adjustment', async () => {
    const transaction = {
      leaveType: {
        upsert: jest.fn().mockResolvedValue({
          id: leaveTypeId,
          code: 'SL',
          name: 'Sick Leave',
          unit: LeaveUnit.DAY,
        }),
      },

      employeeLeaveAccount: {
        findUnique: jest.fn().mockResolvedValue({
          id: leaveAccountId,

          currentBalance: new Prisma.Decimal(5),
        }),

        update: jest.fn().mockResolvedValue({
          id: leaveAccountId,

          currentBalance: new Prisma.Decimal(3.5),
        }),

        create: jest.fn(),
      },

      leaveTransaction: {
        create: jest.fn().mockResolvedValue({
          id: leaveTransactionId,

          effectiveDate: new Date('2026-09-15T00:00:00.000Z'),

          notes: null,

          createdAt: new Date('2026-09-15T01:00:00.000Z'),
        }),
      },
    } as unknown as PrismaTypes.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      $transaction: jest
        .fn()
        .mockImplementation(
          (
            callback: (
              transaction: PrismaTypes.TransactionClient,
            ) => Promise<unknown>,
          ) => callback(transaction),
        ),
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditLogService;

    const service = new EmployeeLeaveCreditService(prisma, auditLog);

    const result = await service.adjustLeaveCredit(
      employeeId,
      {
        leaveCode: 'SL',
        quantity: -1.5,
        effectiveDate: '2026-09-15',
      },
      actorUserId,
    );

    expect(result.previousBalance).toBe('5');

    expect(result.adjustmentQuantity).toBe('-1.5');

    expect(result.currentBalance).toBe('3.5');

    expect(result.leaveName).toBe('Sick Leave');
  });

  it('rejects an adjustment that would make the balance negative', async () => {
    const executeTransaction = jest
      .fn()
      .mockImplementation(
        async (
          callback: (
            transaction: PrismaTypes.TransactionClient,
          ) => Promise<unknown>,
        ) => {
          const transaction = {
            leaveType: {
              upsert: jest.fn().mockResolvedValue({
                id: leaveTypeId,

                code: 'VL',

                name: 'Vacation Leave',

                unit: LeaveUnit.DAY,
              }),
            },

            employeeLeaveAccount: {
              findUnique: jest.fn().mockResolvedValue({
                id: leaveAccountId,

                currentBalance: new Prisma.Decimal(2),
              }),
            },
          } as unknown as PrismaTypes.TransactionClient;

          return callback(transaction);
        },
      );

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const service = new EmployeeLeaveCreditService(prisma, auditLog);

    await expect(
      service.adjustLeaveCredit(
        employeeId,
        {
          leaveCode: 'VL',
          quantity: -3,
          effectiveDate: '2026-09-15',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a zero adjustment', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const service = new EmployeeLeaveCreditService(prisma, auditLog);

    await expect(
      service.adjustLeaveCredit(
        employeeId,
        {
          leaveCode: 'VL',
          quantity: 0,
          effectiveDate: '2026-09-15',
        },
        actorUserId,
      ),
    ).rejects.toThrow('Leave credit adjustment quantity cannot be zero.');

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects an effective date before current employment start', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const service = new EmployeeLeaveCreditService(prisma, auditLog);

    await expect(
      service.adjustLeaveCredit(
        employeeId,
        {
          leaveCode: 'VL',
          quantity: 5,
          effectiveDate: '2025-12-31',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });
});
