import { NotFoundException } from '@nestjs/common';
import {
  EmployeePayrollStatus,
  PayoutMethod,
  type Prisma,
} from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';
import { EmployeesService } from './employees.service';

describe('EmployeesService updateEmployee', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const companyId = '11111111-1111-4111-8111-111111111111';

  const createdAt = new Date('2026-09-01T00:00:00.000Z');
  const updatedAt = new Date('2026-09-15T00:00:00.000Z');

  const currentEmployee = {
    id: employeeId,
    employeeNumber: 'EMP-0001',

    firstName: 'Gino',
    middleName: 'Dela Cruz',
    lastName: 'Suson',
    suffix: null,

    email: 'old@example.com',
    mobile: '+639170000000',

    addressLine1: 'Old Address',
    addressLine2: null,
    barangay: null,
    city: 'Quezon City',
    province: 'Metro Manila',
    postalCode: '1100',
    country: 'Philippines',

    currentStatus: EmployeePayrollStatus.ACTIVE,

    createdAt,
    updatedAt,

    employmentRecords: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        companyEmployeeNumber: 'YAK-001',

        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: null,

        company: {
          id: companyId,
          code: 'YAK-QC',
          name: 'Yakiniku – Quezon City',
        },

        department: null,
        position: null,

        payrollProfile: {
          payoutMethod: PayoutMethod.ATM,
        },
      },
    ],
  };

  it('updates changed profile fields and records a successful audit', async () => {
    const updatedEmployee = {
      ...currentEmployee,

      firstName: 'Gino Angelo',
      email: 'new@example.com',
      mobile: null,
      addressLine1: 'New Address',
    };

    const employeeUpdate = jest.fn((args: Prisma.EmployeeUpdateArgs) => {
      expect(args.where).toEqual({
        id: employeeId,
      });

      expect(args.data).toEqual({
        firstName: 'Gino Angelo',
        email: 'new@example.com',
        mobile: null,
        addressLine1: 'New Address',
      });

      return Promise.resolve(updatedEmployee);
    });

    const transaction = {
      employee: {
        update: employeeUpdate,
      },
    } as unknown as Prisma.TransactionClient;

    const executeTransaction = jest
      .fn()
      .mockImplementation(
        (
          callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
        ) => callback(transaction),
      );

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(currentEmployee),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeesService(prisma, auditLog);

    const result = await service.updateEmployee(
      employeeId,
      {
        firstName: 'Gino Angelo',
        email: 'new@example.com',
        mobile: null,
        addressLine1: 'New Address',
      },
      actorUserId,
    );

    expect(employeeUpdate).toHaveBeenCalledTimes(1);

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId,

      action: EmployeeManagementAuditAction.UPDATED,

      module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

      entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

      entityId: employeeId,

      reference: 'EMP-0001',

      details: 'Updated employee Gino Angelo Dela Cruz Suson (EMP-0001).',

      metadata: {
        changedFields: ['firstName', 'email', 'mobile', 'addressLine1'],
      },
    });

    expect(result.firstName).toBe('Gino Angelo');
    expect(result.email).toBe('new@example.com');
    expect(result.mobile).toBeNull();
  });

  it('does not write or audit when there are no profile changes', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(currentEmployee),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn();

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeesService(prisma, auditLog);

    const result = await service.updateEmployee(
      employeeId,
      {
        firstName: 'Gino',
        email: 'old@example.com',
      },
      actorUserId,
    );

    expect(executeTransaction).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();

    expect(result.firstName).toBe('Gino');
    expect(result.email).toBe('old@example.com');
  });

  it('rejects an unknown employee', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(null),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn();

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeesService(prisma, auditLog);

    await expect(
      service.updateEmployee(
        employeeId,
        {
          firstName: 'Gino Angelo',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(executeTransaction).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });
});
