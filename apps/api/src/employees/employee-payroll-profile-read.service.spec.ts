import { NotFoundException } from '@nestjs/common';
import { PayoutMethod } from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import type { FieldEncryptionService } from '../security/field-encryption.service';
import { EmployeePayrollProfileService } from './employee-payroll-profile.service';

describe('EmployeePayrollProfileService current profile', () => {
  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const employmentRecordId = '44444444-4444-4444-8444-444444444444';

  const payrollProfileId = '55555555-5555-4555-8555-555555555555';

  function createService(employeeResult: unknown) {
    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employeeResult),
      },
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    const fieldEncryption = {
      encrypt: jest.fn(),
    } as unknown as FieldEncryptionService;

    return new EmployeePayrollProfileService(prisma, auditLog, fieldEncryption);
  }

  it('returns the safe current payroll profile', async () => {
    const createdAt = new Date('2026-09-18T01:00:00.000Z');

    const updatedAt = new Date('2026-09-18T02:00:00.000Z');

    const profile = {
      id: payrollProfileId,

      employmentRecordId,

      payoutMethod: PayoutMethod.ATM,

      bankName: 'BDO',

      accountNumberLast4: '9012',

      createdAt,
      updatedAt,
    };

    const service = createService({
      employmentRecords: [
        {
          id: employmentRecordId,
          payrollProfile: profile,
        },
      ],
    });

    await expect(service.getPayrollProfile(employeeId)).resolves.toEqual(
      profile,
    );
  });

  it('returns null when the current employment has no payroll profile', async () => {
    const service = createService({
      employmentRecords: [
        {
          id: employmentRecordId,
          payrollProfile: null,
        },
      ],
    });

    await expect(service.getPayrollProfile(employeeId)).resolves.toBeNull();
  });

  it('rejects an unknown employee', async () => {
    const service = createService(null);

    await expect(service.getPayrollProfile(employeeId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
