import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import { EmployeeCompensationService } from './employee-compensation.service';

describe('EmployeeCompensationService current compensation', () => {
  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const employmentRecordId = '44444444-4444-4444-8444-444444444444';

  const compensationId = '55555555-5555-4555-8555-555555555555';

  function createService(employeeResult: unknown, compensationResult: unknown) {
    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue(employeeResult),
      },

      compensationRecord: {
        findFirst: jest.fn().mockResolvedValue(compensationResult),
      },
    } as unknown as PrismaService;

    const auditLog = {
      recordSuccessInTransaction: jest.fn(),
    } as unknown as AuditLogService;

    return {
      prisma,
      service: new EmployeeCompensationService(prisma, auditLog),
    };
  }

  it('returns the current compensation for the current employment', async () => {
    const effectiveFrom = new Date('2026-09-18T00:00:00.000Z');

    const createdAt = new Date('2026-09-18T01:00:00.000Z');

    const { service } = createService(
      {
        employmentRecords: [
          {
            id: employmentRecordId,
          },
        ],
      },
      {
        id: compensationId,

        employmentRecordId,

        payBasis: 'DAILY',

        rate: new Prisma.Decimal('750.50'),

        effectiveFrom,
        effectiveTo: null,

        createdAt,
      },
    );

    await expect(service.getCurrentCompensation(employeeId)).resolves.toEqual({
      id: compensationId,

      employmentRecordId,

      payBasis: 'DAILY',

      rate: '750.5',

      effectiveFrom,
      effectiveTo: null,

      createdAt,
    });
  });

  it('returns null when the current employment has no compensation', async () => {
    const { service } = createService(
      {
        employmentRecords: [
          {
            id: employmentRecordId,
          },
        ],
      },
      null,
    );

    await expect(
      service.getCurrentCompensation(employeeId),
    ).resolves.toBeNull();
  });

  it('rejects an unknown employee', async () => {
    const { service } = createService(null, null);

    await expect(
      service.getCurrentCompensation(employeeId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
