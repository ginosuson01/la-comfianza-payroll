import { BadRequestException, NotFoundException } from '@nestjs/common';
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

describe('CompaniesService updateCompany', () => {
  const actorUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const createdAt = new Date('2026-08-02T00:00:00.000Z');

  const updatedAt = new Date('2026-08-02T01:00:00.000Z');

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

  const currentCompany = {
    id: '11111111-1111-4111-8111-111111111111',

    code: 'YAK-QC',

    name: 'Yakiniku – Quezon City',

    addressLine1: 'Old Address',

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
  };

  it('updates editable fields and records an audit entry', async () => {
    const updatedCompany = {
      ...currentCompany,

      name: 'Yakiniku – QC',

      addressLine1: null,

      contactPhone: '09171234567',

      updatedAt,
    };

    const update = jest.fn().mockResolvedValue(updatedCompany);

    const transaction = {
      company: {
        update,
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
        findUnique: jest.fn().mockResolvedValue(currentCompany),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new CompaniesService(prisma, auditLog);

    const result = await service.updateCompany(
      currentCompany.id,
      {
        name: 'Yakiniku – QC',

        addressLine1: null,

        contactPhone: '09171234567',
      },

      actorUserId,
    );

    expect(executeTransaction).toHaveBeenCalledTimes(1);

    expect(update).toHaveBeenCalledWith({
      where: {
        id: currentCompany.id,
      },

      data: {
        name: 'Yakiniku – QC',

        addressLine1: null,

        contactPhone: '09171234567',
      },

      select: companySelect,
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId: currentCompany.id,

      action: CompanyManagementAuditAction.UPDATED,

      module: COMPANY_MANAGEMENT_AUDIT_MODULE,

      entityType: COMPANY_MANAGEMENT_ENTITY_TYPE,

      entityId: currentCompany.id,

      reference: 'YAK-QC',

      details: 'Updated company profile Yakiniku – Quezon City (YAK-QC).',

      metadata: {
        changedFields: ['name', 'addressLine1', 'contactPhone'],

        previousValues: {
          name: 'Yakiniku – Quezon City',

          addressLine1: 'Old Address',

          addressLine2: null,

          barangay: null,

          city: 'Quezon City',

          province: null,

          postalCode: null,

          country: 'Philippines',

          contactName: null,

          contactEmail: null,

          contactPhone: null,
        },

        newValues: {
          name: 'Yakiniku – QC',

          addressLine1: null,

          addressLine2: null,

          barangay: null,

          city: 'Quezon City',

          province: null,

          postalCode: null,

          country: 'Philippines',

          contactName: null,

          contactEmail: null,

          contactPhone: '09171234567',
        },
      },
    });

    expect(result.name).toBe('Yakiniku – QC');

    expect(result.addressLine1).toBeNull();

    expect(result.contactPhone).toBe('09171234567');
  });

  it('returns the existing company when values are unchanged', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue(currentCompany),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn();

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new CompaniesService(prisma, auditLog);

    const result = await service.updateCompany(
      currentCompany.id,
      {
        name: currentCompany.name,

        city: currentCompany.city,
      },

      actorUserId,
    );

    expect(executeTransaction).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();

    expect(result.code).toBe('YAK-QC');
  });

  it('rejects an empty update request', async () => {
    const findUnique = jest.fn();

    const executeTransaction = jest.fn();

    const prisma = {
      company: {
        findUnique,
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn();

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new CompaniesService(prisma, auditLog);

    await expect(
      service.updateCompany(currentCompany.id, {}, actorUserId),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(findUnique).not.toHaveBeenCalled();

    expect(executeTransaction).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });

  it('rejects a missing company', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue(null),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn();

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new CompaniesService(prisma, auditLog);

    await expect(
      service.updateCompany(
        currentCompany.id,
        {
          name: 'Updated Company',
        },

        actorUserId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(executeTransaction).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });
});
