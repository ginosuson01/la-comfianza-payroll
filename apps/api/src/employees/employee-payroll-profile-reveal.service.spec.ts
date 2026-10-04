import { BadRequestException } from '@nestjs/common';
import { PayoutMethod } from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import type { FieldEncryptionService } from '../security/field-encryption.service';
import { EmployeeManagementAuditAction } from './employee-management-audit.constants';
import { EmployeePayrollProfileService } from './employee-payroll-profile.service';

describe('EmployeePayrollProfileService revealPayrollAccount', () => {
  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const actorUserId = '99999999-9999-4999-8999-999999999999';

  const employmentRecordId = '44444444-4444-4444-8444-444444444444';

  const payrollProfileId = '55555555-5555-4555-8555-555555555555';

  const companyId = '11111111-1111-4111-8111-111111111111';

  function createEmployee(
    payoutMethod: PayoutMethod = PayoutMethod.ATM,
    accountNumberEncrypted: string | null = 'encrypted-account',
    accountNumberLast4: string | null = '5546',
  ) {
    return {
      id: employeeId,
      employeeNumber: 'EMP-000001',

      firstName: 'Kai',
      lastName: 'Suson',

      employmentRecords: [
        {
          id: employmentRecordId,

          company: {
            id: companyId,
          },

          payrollProfile: {
            id: payrollProfileId,

            payoutMethod,

            accountNumberEncrypted,
            accountNumberLast4,
          },
        },
      ],
    };
  }

  it('decrypts the stored ATM account and audits the reveal', async () => {
    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(createEmployee()),
      },
    } as unknown as PrismaService;

    const recordSuccess = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccess,
    } as unknown as AuditLogService;

    const decrypt = jest.fn().mockReturnValue('123456785546');

    const fieldEncryption = {
      decrypt,
    } as unknown as FieldEncryptionService;

    const service = new EmployeePayrollProfileService(
      prisma,
      auditLog,
      fieldEncryption,
    );

    const result = await service.revealPayrollAccount(employeeId, actorUserId);

    expect(decrypt).toHaveBeenCalledWith('encrypted-account');

    expect(result).toEqual({
      accountNumber: '123456785546',

      accountNumberLast4: '5546',
    });

    expect(recordSuccess).toHaveBeenCalledWith({
      actorUserId,

      companyId,

      action: EmployeeManagementAuditAction.PAYROLL_ACCOUNT_REVEALED,

      module: 'EMPLOYEE_MANAGEMENT',

      entityType: 'Employee',

      entityId: employeeId,

      reference: 'EMP-000001',

      details: 'Revealed stored ATM account number for Kai Suson (EMP-000001).',

      metadata: {
        employmentRecordId,

        payrollProfileId,

        accountNumberLast4: '5546',
      },
    });
  });

  it('rejects reveal when payout method is CASH', async () => {
    const prisma = {
      employee: {
        findUnique: jest
          .fn()
          .mockResolvedValue(createEmployee(PayoutMethod.CASH, null, null)),
      },
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccess: jest.fn(),
    } as unknown as AuditLogService;

    const decrypt = jest.fn();

    const fieldEncryption = {
      decrypt,
    } as unknown as FieldEncryptionService;

    const service = new EmployeePayrollProfileService(
      prisma,
      auditLog,
      fieldEncryption,
    );

    await expect(
      service.revealPayrollAccount(employeeId, actorUserId),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(decrypt).not.toHaveBeenCalled();
  });

  it('does not return the account when audit recording fails', async () => {
    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(createEmployee()),
      },
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccess: jest
        .fn()
        .mockRejectedValue(new Error('Audit write failed.')),
    } as unknown as AuditLogService;

    const fieldEncryption = {
      decrypt: jest.fn().mockReturnValue('123456785546'),
    } as unknown as FieldEncryptionService;

    const service = new EmployeePayrollProfileService(
      prisma,
      auditLog,
      fieldEncryption,
    );

    await expect(
      service.revealPayrollAccount(employeeId, actorUserId),
    ).rejects.toThrow('Audit write failed.');
  });
});
