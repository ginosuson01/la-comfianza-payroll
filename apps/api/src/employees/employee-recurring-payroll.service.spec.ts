import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  PayrollStatutoryBasisTreatment,
  Prisma,
  RecurringPayrollItemKind,
} from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';
import { EmployeeRecurringPayrollService } from './employee-recurring-payroll.service';

describe('EmployeeRecurringPayrollService', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const employmentRecordId = '44444444-4444-4444-8444-444444444444';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const payrollItemId = '55555555-5555-4555-8555-555555555555';

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

  it('creates a recurring allowance and records an audit', async () => {
    const createdAt = new Date('2026-09-15T00:00:00.000Z');

    const updatedAt = new Date('2026-09-15T00:00:00.000Z');

    const createdItem = {
      id: payrollItemId,

      employmentRecordId,

      kind: RecurringPayrollItemKind.ALLOWANCE,

      code: 'RICE',
      description: 'Rice Allowance',

      amount: new Prisma.Decimal(1500),

      taxable: false,

      pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,

      active: true,

      effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),

      effectiveTo: null,

      createdAt,
      updatedAt,
    };

    const recurringPayrollItemCreate = jest.fn().mockResolvedValue(createdItem);

    const lockAffectedCutoffs = jest.fn().mockResolvedValue([]);

    const transaction = {
      $queryRaw: lockAffectedCutoffs,

      recurringPayrollItem: {
        create: recurringPayrollItemCreate,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      recurringPayrollItem: {
        findFirst: jest.fn().mockResolvedValue(null),
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

    const service = new EmployeeRecurringPayrollService(prisma, auditLog);

    const result = await service.createRecurringPayrollItem(
      employeeId,
      {
        kind: RecurringPayrollItemKind.ALLOWANCE,

        code: 'RICE',
        description: 'Rice Allowance',

        amount: 1500,
        taxable: false,

        pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,

        effectiveFrom: '2026-09-15',
      },

      actorUserId,
    );

    expect(lockAffectedCutoffs).toHaveBeenCalledTimes(1);

    expect(lockAffectedCutoffs.mock.invocationCallOrder[0]).toBeLessThan(
      recurringPayrollItemCreate.mock.invocationCallOrder[0],
    );

    expect(recurringPayrollItemCreate).toHaveBeenCalledWith({
      data: {
        employmentRecordId,

        kind: RecurringPayrollItemKind.ALLOWANCE,

        code: 'RICE',
        description: 'Rice Allowance',

        amount: new Prisma.Decimal(1500),

        taxable: false,

        pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,

        active: true,

        effectiveFrom: new Date('2026-09-15'),
      },

      select: {
        id: true,
        employmentRecordId: true,

        kind: true,

        code: true,
        description: true,

        amount: true,

        taxable: true,

        pagIbigFundSalaryTreatment: true,

        active: true,

        effectiveFrom: true,
        effectiveTo: true,

        createdAt: true,
        updatedAt: true,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId,

      action: EmployeeManagementAuditAction.RECURRING_PAYROLL_ITEM_CREATED,

      module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

      entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

      entityId: employeeId,

      reference: 'EMP-0001',

      details: 'Added recurring allowance RICE for Gino Suson (EMP-0001).',

      metadata: {
        recurringPayrollItemId: payrollItemId,

        employmentRecordId,

        kind: RecurringPayrollItemKind.ALLOWANCE,

        code: 'RICE',

        amount: '1500',

        taxable: false,

        pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,

        effectiveFrom: '2026-09-15',
      },
    });

    expect(result).toEqual({
      id: payrollItemId,

      employmentRecordId,

      kind: RecurringPayrollItemKind.ALLOWANCE,

      code: 'RICE',
      description: 'Rice Allowance',

      amount: '1500',

      taxable: false,

      pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,

      active: true,

      effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),

      effectiveTo: null,

      createdAt,
      updatedAt,
    });
  });

  it('creates a recurring fixed deduction', async () => {
    const createdItem = {
      id: payrollItemId,

      employmentRecordId,

      kind: RecurringPayrollItemKind.FIXED_DEDUCTION,

      code: 'MEDICAL',
      description: 'Medical Deduction',

      amount: new Prisma.Decimal(500),

      taxable: false,

      pagIbigFundSalaryTreatment: null,

      active: true,

      effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),

      effectiveTo: null,

      createdAt: new Date('2026-09-15T00:00:00.000Z'),

      updatedAt: new Date('2026-09-15T00:00:00.000Z'),
    };

    const lockAffectedCutoffs = jest.fn().mockResolvedValue([]);

    const transaction = {
      $queryRaw: lockAffectedCutoffs,

      recurringPayrollItem: {
        create: jest.fn().mockResolvedValue(createdItem),
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      recurringPayrollItem: {
        findFirst: jest.fn().mockResolvedValue(null),
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

    const service = new EmployeeRecurringPayrollService(prisma, auditLog);

    const result = await service.createRecurringPayrollItem(
      employeeId,
      {
        kind: RecurringPayrollItemKind.FIXED_DEDUCTION,

        code: 'MEDICAL',
        description: 'Medical Deduction',

        amount: 500,

        effectiveFrom: '2026-09-15',
      },

      actorUserId,
    );

    expect(lockAffectedCutoffs).toHaveBeenCalledTimes(1);

    expect(result.kind).toBe(RecurringPayrollItemKind.FIXED_DEDUCTION);

    expect(result.code).toBe('MEDICAL');
    expect(result.amount).toBe('500');
    expect(result.taxable).toBe(false);
  });

  it('requires Pag-IBIG treatment for a recurring allowance', async () => {
    const employeeFindUnique = jest.fn();

    const prisma = {
      employee: {
        findUnique: employeeFindUnique,
      },

      $transaction: jest.fn(),
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const service = new EmployeeRecurringPayrollService(prisma, auditLog);

    await expect(
      service.createRecurringPayrollItem(
        employeeId,
        {
          kind: RecurringPayrollItemKind.ALLOWANCE,

          code: 'RICE',
          description: 'Rice Allowance',

          amount: 1500,

          effectiveFrom: '2026-09-15',
        },

        actorUserId,
      ),
    ).rejects.toThrow(
      'Pag-IBIG Fund Salary treatment is required for recurring allowances.',
    );

    expect(employeeFindUnique).not.toHaveBeenCalled();
  });

  it('rejects Pag-IBIG treatment on a recurring fixed deduction', async () => {
    const employeeFindUnique = jest.fn();

    const prisma = {
      employee: {
        findUnique: employeeFindUnique,
      },

      $transaction: jest.fn(),
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const service = new EmployeeRecurringPayrollService(prisma, auditLog);

    await expect(
      service.createRecurringPayrollItem(
        employeeId,
        {
          kind: RecurringPayrollItemKind.FIXED_DEDUCTION,

          code: 'MEDICAL',
          description: 'Medical Deduction',

          amount: 500,

          pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.EXCLUDE,

          effectiveFrom: '2026-09-15',
        },

        actorUserId,
      ),
    ).rejects.toThrow(
      'Pag-IBIG Fund Salary treatment applies only to recurring allowances.',
    );

    expect(employeeFindUnique).not.toHaveBeenCalled();
  });

  it('rejects a duplicate active code for the same kind', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      recurringPayrollItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: payrollItemId,
        }),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const service = new EmployeeRecurringPayrollService(prisma, auditLog);

    await expect(
      service.createRecurringPayrollItem(
        employeeId,
        {
          kind: RecurringPayrollItemKind.ALLOWANCE,

          code: 'RICE',
          description: 'Rice Allowance',

          amount: 1500,

          pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,

          effectiveFrom: '2026-09-15',
        },

        actorUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects an effective date before the current employment start date', async () => {
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

    const service = new EmployeeRecurringPayrollService(prisma, auditLog);

    await expect(
      service.createRecurringPayrollItem(
        employeeId,
        {
          kind: RecurringPayrollItemKind.ALLOWANCE,

          code: 'RICE',
          description: 'Rice Allowance',

          amount: 1500,

          pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,

          effectiveFrom: '2025-12-31',
        },

        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });
  it('lists active recurring payroll items for the current employment assignment', async () => {
    const createdAt = new Date('2026-09-15T00:00:00.000Z');
    const updatedAt = new Date('2026-09-15T00:00:00.000Z');

    const recurringPayrollItemFindMany = jest.fn().mockResolvedValue([
      {
        id: payrollItemId,

        employmentRecordId,

        kind: RecurringPayrollItemKind.ALLOWANCE,

        code: 'RICE',
        description: 'Rice Allowance',

        amount: new Prisma.Decimal(1500),

        taxable: false,

        pagIbigFundSalaryTreatment: null,

        active: true,

        effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),
        effectiveTo: null,

        createdAt,
        updatedAt,
      },
    ]);

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
      },

      recurringPayrollItem: {
        findMany: recurringPayrollItemFindMany,
      },
    } as unknown as PrismaService;

    const auditLog = {} as AuditLogService;

    const service = new EmployeeRecurringPayrollService(prisma, auditLog);

    const result = await service.listActiveRecurringPayrollItems(employeeId);

    expect(recurringPayrollItemFindMany).toHaveBeenCalledWith({
      where: {
        employmentRecordId,
        active: true,
        effectiveTo: null,
      },

      orderBy: [
        {
          kind: 'asc',
        },
        {
          code: 'asc',
        },
        {
          effectiveFrom: 'desc',
        },
      ],

      select: {
        id: true,
        employmentRecordId: true,

        kind: true,

        code: true,
        description: true,

        amount: true,

        taxable: true,

        pagIbigFundSalaryTreatment: true,

        active: true,

        effectiveFrom: true,
        effectiveTo: true,

        createdAt: true,
        updatedAt: true,
      },
    });

    expect(result).toEqual([
      {
        id: payrollItemId,

        employmentRecordId,

        kind: RecurringPayrollItemKind.ALLOWANCE,

        code: 'RICE',
        description: 'Rice Allowance',

        amount: '1500',

        taxable: false,

        pagIbigFundSalaryTreatment: null,

        active: true,

        effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),
        effectiveTo: null,

        createdAt,
        updatedAt,
      },
    ]);
  });

  it('corrects Pag-IBIG treatment for an active recurring allowance and records an audit', async () => {
    const createdAt = new Date('2026-09-15T00:00:00.000Z');
    const updatedAt = new Date('2026-10-16T00:00:00.000Z');

    const existingItem = {
      id: payrollItemId,

      employmentRecordId,

      kind: RecurringPayrollItemKind.ALLOWANCE,

      code: 'RICE',
      description: 'Rice Allowance',

      amount: new Prisma.Decimal(1500),

      taxable: false,

      pagIbigFundSalaryTreatment: null,

      active: true,

      effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),
      effectiveTo: null,

      createdAt,
      updatedAt: createdAt,
    };

    const updatedItem = {
      ...existingItem,

      pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,

      updatedAt,
    };

    const recurringPayrollItemFindFirst = jest
      .fn()
      .mockResolvedValue(existingItem);

    const recurringPayrollItemUpdate = jest.fn().mockResolvedValue(updatedItem);

    const lockAffectedCutoffs = jest.fn().mockResolvedValue([]);

    const transaction = {
      $queryRaw: lockAffectedCutoffs,

      recurringPayrollItem: {
        findFirst: recurringPayrollItemFindFirst,
        update: recurringPayrollItemUpdate,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
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

    const service = new EmployeeRecurringPayrollService(prisma, auditLog);

    const result = await service.updatePagIbigFundSalaryTreatment(
      employeeId,
      payrollItemId,
      {
        pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,
      },
      actorUserId,
    );

    expect(lockAffectedCutoffs).toHaveBeenCalledTimes(1);

    expect(lockAffectedCutoffs.mock.invocationCallOrder[0]).toBeLessThan(
      recurringPayrollItemUpdate.mock.invocationCallOrder[0],
    );

    expect(recurringPayrollItemUpdate).toHaveBeenCalledWith({
      where: {
        id: payrollItemId,
      },

      data: {
        pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,
      },

      select: {
        id: true,
        employmentRecordId: true,

        kind: true,

        code: true,
        description: true,

        amount: true,

        taxable: true,

        pagIbigFundSalaryTreatment: true,

        active: true,

        effectiveFrom: true,
        effectiveTo: true,

        createdAt: true,
        updatedAt: true,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        actorUserId,

        companyId,

        action:
          EmployeeManagementAuditAction.RECURRING_PAYROLL_ITEM_PAGIBIG_TREATMENT_CHANGED,

        module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

        entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

        entityId: employeeId,

        reference: 'EMP-0001',

        metadata: {
          recurringPayrollItemId: payrollItemId,

          employmentRecordId,

          kind: RecurringPayrollItemKind.ALLOWANCE,

          code: 'RICE',

          previousPagIbigFundSalaryTreatment: null,

          pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,
        },
      }),
    );

    expect(result.pagIbigFundSalaryTreatment).toBe(
      PayrollStatutoryBasisTreatment.INCLUDE,
    );
  });

  it('rejects Pag-IBIG treatment correction for a recurring fixed deduction', async () => {
    const recurringPayrollItemUpdate = jest.fn();

    const lockAffectedCutoffs = jest.fn().mockResolvedValue([]);

    const transaction = {
      $queryRaw: lockAffectedCutoffs,

      recurringPayrollItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: payrollItemId,

          employmentRecordId,

          kind: RecurringPayrollItemKind.FIXED_DEDUCTION,

          code: 'MEDICAL',
          description: 'Medical Deduction',

          amount: new Prisma.Decimal(500),

          taxable: false,

          pagIbigFundSalaryTreatment: null,

          active: true,

          effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),
          effectiveTo: null,

          createdAt: new Date('2026-09-15T00:00:00.000Z'),
          updatedAt: new Date('2026-09-15T00:00:00.000Z'),
        }),

        update: recurringPayrollItemUpdate,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
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

    const recordSuccessInTransaction = jest.fn();

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeeRecurringPayrollService(prisma, auditLog);

    await expect(
      service.updatePagIbigFundSalaryTreatment(
        employeeId,
        payrollItemId,
        {
          pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,
        },
        actorUserId,
      ),
    ).rejects.toThrow(
      'Pag-IBIG Fund Salary treatment applies only to recurring allowances.',
    );

    expect(lockAffectedCutoffs).not.toHaveBeenCalled();
    expect(recurringPayrollItemUpdate).not.toHaveBeenCalled();
    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });

  it('rejects a no-op recurring allowance Pag-IBIG treatment correction', async () => {
    const recurringPayrollItemUpdate = jest.fn();

    const lockAffectedCutoffs = jest.fn().mockResolvedValue([]);

    const transaction = {
      $queryRaw: lockAffectedCutoffs,

      recurringPayrollItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: payrollItemId,

          employmentRecordId,

          kind: RecurringPayrollItemKind.ALLOWANCE,

          code: 'RICE',
          description: 'Rice Allowance',

          amount: new Prisma.Decimal(1500),

          taxable: false,

          pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,

          active: true,

          effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),
          effectiveTo: null,

          createdAt: new Date('2026-09-15T00:00:00.000Z'),
          updatedAt: new Date('2026-09-15T00:00:00.000Z'),
        }),

        update: recurringPayrollItemUpdate,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employee),
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

    const recordSuccessInTransaction = jest.fn();

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new EmployeeRecurringPayrollService(prisma, auditLog);

    await expect(
      service.updatePagIbigFundSalaryTreatment(
        employeeId,
        payrollItemId,
        {
          pagIbigFundSalaryTreatment: PayrollStatutoryBasisTreatment.INCLUDE,
        },
        actorUserId,
      ),
    ).rejects.toThrow(
      'Recurring allowance already has the requested Pag-IBIG Fund Salary treatment.',
    );

    expect(lockAffectedCutoffs).not.toHaveBeenCalled();
    expect(recurringPayrollItemUpdate).not.toHaveBeenCalled();
    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });
});
