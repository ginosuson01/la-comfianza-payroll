import { BadRequestException } from '@nestjs/common';
import { PayoutMethod, type Prisma } from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import type { FieldEncryptionService } from '../security/field-encryption.service';
import {
  EMPLOYEE_MANAGEMENT_AUDIT_MODULE,
  EMPLOYEE_MANAGEMENT_ENTITY_TYPE,
  EmployeeManagementAuditAction,
} from './employee-management-audit.constants';
import { EmployeePayrollProfileService } from './employee-payroll-profile.service';

describe('EmployeePayrollProfileService', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const employmentRecordId = '44444444-4444-4444-8444-444444444444';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const payrollProfileId = '55555555-5555-4555-8555-555555555555';

  const createdAt = new Date('2026-09-15T00:00:00.000Z');

  const updatedAt = new Date('2026-09-15T01:00:00.000Z');

  function createEmployee(
    payrollProfile: {
      id: string;
      payoutMethod: PayoutMethod;
      bankName: string | null;
      accountNumberEncrypted: string | null;
      accountNumberLast4: string | null;
    } | null = null,
  ) {
    return {
      id: employeeId,
      employeeNumber: 'EMP-0001',
      firstName: 'Gino',
      lastName: 'Suson',

      employmentRecords: [
        {
          id: employmentRecordId,

          company: {
            id: companyId,
          },

          payrollProfile,
        },
      ],
    };
  }

  it('creates an ATM payroll profile with encrypted account number', async () => {
    const encryptedAccount = 'v1:test-iv:test-tag:test-ciphertext';

    const encrypt = jest.fn().mockReturnValue(encryptedAccount);

    const upsert = jest.fn().mockResolvedValue({
      id: payrollProfileId,

      employmentRecordId,

      payoutMethod: PayoutMethod.ATM,

      bankName: 'BDO',

      accountNumberLast4: '9012',

      createdAt,
      updatedAt,
    });

    const transaction = {
      employeePayrollProfile: {
        upsert,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(createEmployee()),
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

    const fieldEncryption = {
      encrypt,
    } as unknown as FieldEncryptionService;

    const service = new EmployeePayrollProfileService(
      prisma,
      auditLog,
      fieldEncryption,
    );

    const result = await service.setPayrollProfile(
      employeeId,
      {
        payoutMethod: PayoutMethod.ATM,
        bankName: 'BDO',
        accountNumber: '123456789012',
      },
      actorUserId,
    );

    expect(encrypt).toHaveBeenCalledWith('123456789012');

    expect(upsert).toHaveBeenCalledWith({
      where: {
        employmentRecordId,
      },

      create: {
        employmentRecordId,

        payoutMethod: PayoutMethod.ATM,

        bankName: 'BDO',

        accountNumberEncrypted: encryptedAccount,

        accountNumberLast4: '9012',
      },

      update: {
        payoutMethod: PayoutMethod.ATM,

        bankName: 'BDO',

        accountNumberEncrypted: encryptedAccount,

        accountNumberLast4: '9012',
      },

      select: {
        id: true,

        employmentRecordId: true,

        payoutMethod: true,

        bankName: true,

        accountNumberLast4: true,

        createdAt: true,
        updatedAt: true,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId,

      action: EmployeeManagementAuditAction.PAYROLL_PROFILE_UPDATED,

      module: EMPLOYEE_MANAGEMENT_AUDIT_MODULE,

      entityType: EMPLOYEE_MANAGEMENT_ENTITY_TYPE,

      entityId: employeeId,

      reference: 'EMP-0001',

      details:
        'Updated payroll payout profile for Gino Suson (EMP-0001) to ATM.',

      metadata: {
        employmentRecordId,

        payoutMethod: PayoutMethod.ATM,

        bankName: 'BDO',

        accountNumberLast4: '9012',
      },
    });

    expect(result).toEqual({
      id: payrollProfileId,

      employmentRecordId,

      payoutMethod: PayoutMethod.ATM,

      bankName: 'BDO',

      accountNumberLast4: '9012',

      createdAt,
      updatedAt,
    });
  });

  it('retains the existing ATM account when only the bank name changes', async () => {
    const existingEncryptedAccount =
      'v1:existing-iv:existing-tag:existing-ciphertext';

    const existingProfile = {
      id: payrollProfileId,

      payoutMethod: PayoutMethod.ATM,

      bankName: 'BDO',

      accountNumberEncrypted: existingEncryptedAccount,

      accountNumberLast4: '9012',
    };

    const encrypt = jest.fn();

    const upsert = jest.fn().mockResolvedValue({
      id: payrollProfileId,

      employmentRecordId,

      payoutMethod: PayoutMethod.ATM,

      bankName: 'BPI',

      accountNumberLast4: '9012',

      createdAt,
      updatedAt,
    });

    const transaction = {
      employeePayrollProfile: {
        upsert,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest
          .fn()
          .mockResolvedValue(createEmployee(existingProfile)),
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

    const fieldEncryption = {
      encrypt,
    } as unknown as FieldEncryptionService;

    const service = new EmployeePayrollProfileService(
      prisma,
      auditLog,
      fieldEncryption,
    );

    const result = await service.setPayrollProfile(
      employeeId,
      {
        payoutMethod: PayoutMethod.ATM,
        bankName: 'BPI',
      },
      actorUserId,
    );

    expect(encrypt).not.toHaveBeenCalled();

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          payoutMethod: PayoutMethod.ATM,

          bankName: 'BPI',

          accountNumberEncrypted: existingEncryptedAccount,

          accountNumberLast4: '9012',
        },
      }),
    );

    expect(result.bankName).toBe('BPI');

    expect(result.accountNumberLast4).toBe('9012');
  });

  it('clears banking information when payout method changes to CASH', async () => {
    const existingProfile = {
      id: payrollProfileId,

      payoutMethod: PayoutMethod.ATM,

      bankName: 'BDO',

      accountNumberEncrypted: 'v1:existing-iv:existing-tag:existing-ciphertext',

      accountNumberLast4: '9012',
    };

    const encrypt = jest.fn();

    const upsert = jest.fn().mockResolvedValue({
      id: payrollProfileId,

      employmentRecordId,

      payoutMethod: PayoutMethod.CASH,

      bankName: null,

      accountNumberLast4: null,

      createdAt,
      updatedAt,
    });

    const transaction = {
      employeePayrollProfile: {
        upsert,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      employee: {
        findUnique: jest
          .fn()
          .mockResolvedValue(createEmployee(existingProfile)),
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

    const fieldEncryption = {
      encrypt,
    } as unknown as FieldEncryptionService;

    const service = new EmployeePayrollProfileService(
      prisma,
      auditLog,
      fieldEncryption,
    );

    const result = await service.setPayrollProfile(
      employeeId,
      {
        payoutMethod: PayoutMethod.CASH,
      },
      actorUserId,
    );

    expect(encrypt).not.toHaveBeenCalled();

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          payoutMethod: PayoutMethod.CASH,

          bankName: null,

          accountNumberEncrypted: null,

          accountNumberLast4: null,
        },
      }),
    );

    expect(result.payoutMethod).toBe(PayoutMethod.CASH);

    expect(result.bankName).toBeNull();

    expect(result.accountNumberLast4).toBeNull();
  });

  it('rejects first-time ATM setup without a bank name', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(createEmployee()),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const fieldEncryption = {
      encrypt: jest.fn(),
    } as unknown as FieldEncryptionService;

    const service = new EmployeePayrollProfileService(
      prisma,
      auditLog,
      fieldEncryption,
    );

    await expect(
      service.setPayrollProfile(
        employeeId,
        {
          payoutMethod: PayoutMethod.ATM,

          accountNumber: '123456789012',
        },
        actorUserId,
      ),
    ).rejects.toThrow('Bank name is required for ATM payout.');

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects first-time ATM setup without an account number', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(createEmployee()),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const fieldEncryption = {
      encrypt: jest.fn(),
    } as unknown as FieldEncryptionService;

    const service = new EmployeePayrollProfileService(
      prisma,
      auditLog,
      fieldEncryption,
    );

    await expect(
      service.setPayrollProfile(
        employeeId,
        {
          payoutMethod: PayoutMethod.ATM,

          bankName: 'BDO',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });
});
