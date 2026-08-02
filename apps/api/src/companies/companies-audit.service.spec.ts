import type { Prisma } from '@payroll/database';
import { CompanyStatus } from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import {
  COMPANY_MANAGEMENT_AUDIT_MODULE,
  COMPANY_MANAGEMENT_ENTITY_TYPE,
  CompanyManagementAuditAction,
} from './company-management-audit.constants';
import { CompaniesService } from './companies.service';

describe('CompaniesService audit logging', () => {
  it('records company creation in the same transaction', async () => {
    const actorUserId = '11111111-1111-4111-8111-111111111111';

    const companyId = '22222222-2222-4222-8222-222222222222';

    const createdAt = new Date('2026-08-02T00:00:00.000Z');

    const create = jest.fn().mockResolvedValue({
      id: companyId,

      code: 'YAK-QC',

      name: 'Yakiniku – Quezon City',

      addressLine1: null,

      addressLine2: null,

      barangay: null,

      city: 'Quezon City',

      province: null,

      postalCode: null,

      country: 'Philippines',

      contactName: null,

      contactEmail: null,

      contactPhone: null,

      status: CompanyStatus.ACTIVE,

      createdAt,
      updatedAt: createdAt,
    });

    const transaction = {
      company: {
        create,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue(null),
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

    const service = new CompaniesService(prisma, auditLog);

    await service.createCompany(
      {
        code: 'YAK-QC',

        name: 'Yakiniku – Quezon City',

        city: 'Quezon City',
      },

      actorUserId,
    );

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId,

      action: CompanyManagementAuditAction.CREATED,

      module: COMPANY_MANAGEMENT_AUDIT_MODULE,

      entityType: COMPANY_MANAGEMENT_ENTITY_TYPE,

      entityId: companyId,

      reference: 'YAK-QC',

      details: 'Created company Yakiniku – Quezon City (YAK-QC).',

      metadata: {
        code: 'YAK-QC',

        name: 'Yakiniku – Quezon City',

        status: CompanyStatus.ACTIVE,
      },
    });
  });
});
