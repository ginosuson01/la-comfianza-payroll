import { BadRequestException } from '@nestjs/common';
import { EmployeePayrollStatus, type Prisma } from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';
import { EmployeeStatusService } from './employee-status.service';

describe('EmployeeStatusService', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const statusHistoryId = '55555555-5555-4555-8555-555555555555';

  const employee = {
    id: employeeId,
    employeeNumber: 'EMP-0001',

    firstName: 'Gino',
    lastName: 'Suson',

    currentStatus: EmployeePayrollStatus.ACTIVE,

    employmentRecords: [
      {
        company: {
          id: companyId,
        },
      },
    ],
  };

  it('changes ACTIVE to ACTIVE_HOLD and records history and audit', async () => {
    const effectiveDate = new Date('2026-09-15T00:00:00.000Z');

    const changedAt = new Date('2026-09-15T01:00:00.000Z');

    const employeeUpdate = jest.fn().mockResolvedValue({
      id: employeeId,
    });

    const statusHistoryCreate = jest.fn().mockResolvedValue({
      id: statusHistoryId,
      effectiveDate,
      changedAt,
    });

    const transaction = {
      employee: {
        update: employeeUpdate,
      },

      employeeStatusHistory: {
        create: statusHistoryCreate,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      employeeStatusHistory: {
        findFirst: jest.fn().mockResolvedValue({
          effectiveDate: new Date('2026-01-01T00:00:00.000Z'),

          newStatus: EmployeePayrollStatus.ACTIVE,
        }),
      },

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

    const service = new EmployeeStatusService(prisma, auditLog);

    const result = await service.changeStatus(
      employeeId,
      {
        status: EmployeePayrollStatus.ACTIVE_HOLD,

        effectiveDate: '2026-09-15',

        reason: 'Pending payroll release',
      },

      actorUserId,
    );

    expect(employeeUpdate).toHaveBeenCalledWith({
      where: {
        id: employeeId,
      },

      data: {
        currentStatus: EmployeePayrollStatus.ACTIVE_HOLD,
      },
    });

    expect(statusHistoryCreate).toHaveBeenCalledWith({
      data: {
        employeeId,

        previousStatus: EmployeePayrollStatus.ACTIVE,

        newStatus: EmployeePayrollStatus.ACTIVE_HOLD,

        effectiveDate,

        changedByUserId: actorUserId,
      },

      select: {
        id: true,
        effectiveDate: true,
        changedAt: true,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId,

      action: EmployeeManagementAuditAction.STATUS_CHANGED,

      module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

      entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

      entityId: employeeId,

      reference: 'EMP-0001',

      details:
        'Changed employee status for Gino Suson (EMP-0001) from ACTIVE to ACTIVE_HOLD.',

      metadata: {
        previousStatus: EmployeePayrollStatus.ACTIVE,

        newStatus: EmployeePayrollStatus.ACTIVE_HOLD,

        effectiveDate: '2026-09-15',

        reason: 'Pending payroll release',
      },
    });

    expect(result).toEqual({
      employeeId,

      employeeNumber: 'EMP-0001',

      previousStatus: EmployeePayrollStatus.ACTIVE,

      currentStatus: EmployeePayrollStatus.ACTIVE_HOLD,

      effectiveDate,

      statusHistoryId,

      changedAt,
    });
  });

  it('allows ACTIVE_HOLD to return to ACTIVE without touching historical payroll', async () => {
    const holdEmployee = {
      ...employee,

      currentStatus: EmployeePayrollStatus.ACTIVE_HOLD,
    };

    const transaction = {
      employee: {
        update: jest.fn().mockResolvedValue({
          id: employeeId,
        }),
      },

      employeeStatusHistory: {
        create: jest.fn().mockResolvedValue({
          id: statusHistoryId,

          effectiveDate: new Date('2026-09-20T00:00:00.000Z'),

          changedAt: new Date('2026-09-20T01:00:00.000Z'),
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(holdEmployee),
      },

      employeeStatusHistory: {
        findFirst: jest.fn().mockResolvedValue({
          effectiveDate: new Date('2026-09-15T00:00:00.000Z'),

          newStatus: EmployeePayrollStatus.ACTIVE_HOLD,
        }),
      },

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

    const auditLog = {
      recordSuccessInTransaction: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditLogService;

    const service = new EmployeeStatusService(prisma, auditLog);

    const result = await service.changeStatus(
      employeeId,
      {
        status: EmployeePayrollStatus.ACTIVE,
        effectiveDate: '2026-09-20',
      },
      actorUserId,
    );

    expect(result.previousStatus).toBe(EmployeePayrollStatus.ACTIVE_HOLD);

    expect(result.currentStatus).toBe(EmployeePayrollStatus.ACTIVE);

    expect(Object.keys(transaction)).toEqual([
      'employee',
      'employeeStatusHistory',
    ]);
  });

  it('changes an employee to RESIGNED', async () => {
    const transaction = {
      employee: {
        update: jest.fn().mockResolvedValue({
          id: employeeId,
        }),
      },

      employeeStatusHistory: {
        create: jest.fn().mockResolvedValue({
          id: statusHistoryId,

          effectiveDate: new Date('2026-09-30T00:00:00.000Z'),

          changedAt: new Date('2026-09-30T01:00:00.000Z'),
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      employeeStatusHistory: {
        findFirst: jest.fn().mockResolvedValue({
          effectiveDate: new Date('2026-01-01T00:00:00.000Z'),

          newStatus: EmployeePayrollStatus.ACTIVE,
        }),
      },

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

    const auditLog = {
      recordSuccessInTransaction: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditLogService;

    const service = new EmployeeStatusService(prisma, auditLog);

    const result = await service.changeStatus(
      employeeId,
      {
        status: EmployeePayrollStatus.RESIGNED,

        effectiveDate: '2026-09-30',

        reason: 'Employee resigned',
      },

      actorUserId,
    );

    expect(result.currentStatus).toBe(EmployeePayrollStatus.RESIGNED);
  });

  it('rejects changing to the employee current status', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      employeeStatusHistory: {
        findFirst: jest.fn(),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const service = new EmployeeStatusService(prisma, auditLog);

    await expect(
      service.changeStatus(
        employeeId,
        {
          status: EmployeePayrollStatus.ACTIVE,

          effectiveDate: '2026-09-15',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects an effective date before the latest status effective date', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      employeeStatusHistory: {
        findFirst: jest.fn().mockResolvedValue({
          effectiveDate: new Date('2026-09-15T00:00:00.000Z'),

          newStatus: EmployeePayrollStatus.ACTIVE,
        }),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const service = new EmployeeStatusService(prisma, auditLog);

    await expect(
      service.changeStatus(
        employeeId,
        {
          status: EmployeePayrollStatus.ACTIVE_HOLD,

          effectiveDate: '2026-09-14',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });
});
