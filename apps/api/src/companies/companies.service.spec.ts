import { ConflictException } from '@nestjs/common';
import { CompanyStatus } from '@payroll/database';
import type { Prisma } from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import {
  COMPANY_MANAGEMENT_AUDIT_MODULE,
  COMPANY_MANAGEMENT_ENTITY_TYPE,
  CompanyManagementAuditAction,
} from './company-management-audit.constants';
import { CompaniesService } from './companies.service';

describe('CompaniesService createCompany', () => {
  const actorUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const createdAt = new Date('2026-08-02T00:00:00.000Z');

  const updatedAt = new Date('2026-08-02T00:00:00.000Z');

  const companySelect = {
    id: true,
    code: true,
    name: true,

    addressLine1: true,
    addressLine2: true,
    barangay: true,
    city: true,
    province: true,
    postalCode: true,
    country: true,

    contactName: true,
    contactEmail: true,
    contactPhone: true,

    status: true,

    createdAt: true,
    updatedAt: true,
  } as const;

  const createdCompany = {
    id: companyId,

    code: 'YAK-QC',

    name: 'Yakiniku – Quezon City',

    addressLine1: 'Quezon Avenue',

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
    updatedAt,
  };

  it('creates an active company profile and audit record', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);

    const create = jest.fn().mockResolvedValue(createdCompany);

    const transaction = {
      company: {
        create,
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
      company: {
        findUnique,
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new CompaniesService(prisma, auditLog);

    const result = await service.createCompany(
      {
        code: 'YAK-QC',

        name: 'Yakiniku – Quezon City',

        addressLine1: 'Quezon Avenue',

        city: 'Quezon City',
      },

      actorUserId,
    );

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        code: 'YAK-QC',
      },

      select: {
        id: true,
      },
    });

    expect(executeTransaction).toHaveBeenCalledTimes(1);

    expect(create).toHaveBeenCalledWith({
      data: {
        code: 'YAK-QC',

        name: 'Yakiniku – Quezon City',

        addressLine1: 'Quezon Avenue',

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
      },

      select: companySelect,
    });

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

    expect(result.status).toBe(CompanyStatus.ACTIVE);

    expect(result.formattedAddress).toBe(
      'Quezon Avenue, Quezon City, Philippines',
    );
  });

  it('rejects an existing company code', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: companyId,
        }),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn();

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new CompaniesService(prisma, auditLog);

    await expect(
      service.createCompany(
        {
          code: 'YAK-QC',

          name: 'Another Company',
        },

        actorUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(executeTransaction).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });

  it('converts a database unique violation to conflict', async () => {
    const create = jest.fn().mockRejectedValue({
      code: 'P2002',
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

    const recordSuccessInTransaction = jest.fn();

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new CompaniesService(prisma, auditLog);

    await expect(
      service.createCompany(
        {
          code: 'YAK-QC',

          name: 'Yakiniku – Quezon City',
        },

        actorUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });
});
