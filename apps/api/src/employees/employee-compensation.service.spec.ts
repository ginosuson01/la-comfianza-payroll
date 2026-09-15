import { BadRequestException } from '@nestjs/common';
import {
  PayBasis,
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
import { EmployeeCompensationService } from './employee-compensation.service';

describe('EmployeeCompensationService', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const employmentRecordId = '44444444-4444-4444-8444-444444444444';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const compensationId = '55555555-5555-4555-8555-555555555555';

  const newCompensationId = '66666666-6666-4666-8666-666666666666';

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

  it('creates the first compensation record', async () => {
    const createdAt = new Date('2026-09-15T00:00:00.000Z');

    const createdCompensation = {
      id: compensationId,

      employmentRecordId,

      payBasis: PayBasis.DAILY,

      rate: new Prisma.Decimal(750),

      effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),

      effectiveTo: null,

      createdAt,
    };

    const compensationCreate = jest.fn().mockResolvedValue(createdCompensation);

    const transaction = {
      compensationRecord: {
        create: compensationCreate,
      },
    } as unknown as PrismaTypes.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      compensationRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
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

    const service = new EmployeeCompensationService(prisma, auditLog);

    const result = await service.setCompensation(
      employeeId,
      {
        payBasis: PayBasis.DAILY,
        rate: 750,
        effectiveFrom: '2026-09-15',
      },
      actorUserId,
    );

    expect(compensationCreate).toHaveBeenCalledWith({
      data: {
        employmentRecordId,

        payBasis: PayBasis.DAILY,

        rate: new Prisma.Decimal(750),

        effectiveFrom: new Date('2026-09-15'),
      },

      select: {
        id: true,
        employmentRecordId: true,

        payBasis: true,
        rate: true,

        effectiveFrom: true,
        effectiveTo: true,

        createdAt: true,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId,

      action: EmployeeManagementAuditAction.COMPENSATION_CHANGED,

      module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

      entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

      entityId: employeeId,

      reference: 'EMP-0001',

      details: 'Updated compensation for Gino Suson (EMP-0001).',

      metadata: {
        employmentRecordId,

        previousCompensationId: null,

        newCompensationId: compensationId,

        payBasis: PayBasis.DAILY,

        rate: '750',

        effectiveFrom: '2026-09-15',
      },
    });

    expect(result).toEqual({
      id: compensationId,

      employmentRecordId,

      payBasis: PayBasis.DAILY,

      rate: '750',

      effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),

      effectiveTo: null,

      createdAt,
    });
  });

  it('closes the previous salary and creates a new salary record', async () => {
    const currentCompensation = {
      id: compensationId,

      payBasis: PayBasis.DAILY,

      rate: new Prisma.Decimal(700),

      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),

      effectiveTo: null,

      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const compensationUpdate = jest.fn().mockResolvedValue(currentCompensation);

    const compensationCreate = jest.fn().mockResolvedValue({
      id: newCompensationId,

      employmentRecordId,

      payBasis: PayBasis.DAILY,

      rate: new Prisma.Decimal(750),

      effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),

      effectiveTo: null,

      createdAt: new Date('2026-09-15T00:00:00.000Z'),
    });

    const transaction = {
      compensationRecord: {
        update: compensationUpdate,
        create: compensationCreate,
      },
    } as unknown as PrismaTypes.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      compensationRecord: {
        findFirst: jest.fn().mockResolvedValue(currentCompensation),
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

    const service = new EmployeeCompensationService(prisma, auditLog);

    const result = await service.setCompensation(
      employeeId,
      {
        payBasis: PayBasis.DAILY,
        rate: 750,
        effectiveFrom: '2026-09-15',
      },
      actorUserId,
    );

    expect(compensationUpdate).toHaveBeenCalledWith({
      where: {
        id: compensationId,
      },

      data: {
        effectiveTo: new Date('2026-09-15'),
      },
    });

    expect(result.id).toBe(newCompensationId);

    expect(result.rate).toBe('750');
  });

  it('rejects compensation before the current employment start date', async () => {
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

    const service = new EmployeeCompensationService(prisma, auditLog);

    await expect(
      service.setCompensation(
        employeeId,
        {
          payBasis: PayBasis.DAILY,
          rate: 750,
          effectiveFrom: '2025-12-31',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects an effective date that is not after the current salary effective date', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      compensationRecord: {
        findFirst: jest.fn().mockResolvedValue({
          id: compensationId,

          payBasis: PayBasis.DAILY,

          rate: new Prisma.Decimal(700),

          effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),

          effectiveTo: null,

          createdAt: new Date('2026-09-15T00:00:00.000Z'),
        }),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const service = new EmployeeCompensationService(prisma, auditLog);

    await expect(
      service.setCompensation(
        employeeId,
        {
          payBasis: PayBasis.DAILY,
          rate: 750,
          effectiveFrom: '2026-09-15',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects a new salary with the same pay basis and rate', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      compensationRecord: {
        findFirst: jest.fn().mockResolvedValue({
          id: compensationId,

          payBasis: PayBasis.DAILY,

          rate: new Prisma.Decimal(750),

          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),

          effectiveTo: null,

          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const service = new EmployeeCompensationService(prisma, auditLog);

    await expect(
      service.setCompensation(
        employeeId,
        {
          payBasis: PayBasis.DAILY,
          rate: 750,
          effectiveFrom: '2026-09-15',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });
});
