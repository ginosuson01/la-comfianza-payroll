import { NotFoundException } from '@nestjs/common';
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

describe('CompaniesService updateCompanyStatus', () => {
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

  const activeCompany = {
    id: '11111111-1111-4111-8111-111111111111',

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

    updatedAt: createdAt,
  };

  it('deactivates an active company and records an audit entry', async () => {
    const updatedCompany = {
      ...activeCompany,

      status: CompanyStatus.INACTIVE,

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
        findUnique: jest.fn().mockResolvedValue(activeCompany),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new CompaniesService(prisma, auditLog);

    const result = await service.updateCompanyStatus(
      activeCompany.id,
      CompanyStatus.INACTIVE,
      actorUserId,
    );

    expect(executeTransaction).toHaveBeenCalledTimes(1);

    expect(update).toHaveBeenCalledWith({
      where: {
        id: activeCompany.id,
      },

      data: {
        status: CompanyStatus.INACTIVE,
      },

      select: companySelect,
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId: activeCompany.id,

      action: CompanyManagementAuditAction.STATUS_CHANGED,

      module: COMPANY_MANAGEMENT_AUDIT_MODULE,

      entityType: COMPANY_MANAGEMENT_ENTITY_TYPE,

      entityId: activeCompany.id,

      reference: 'YAK-QC',

      details:
        'Changed company Yakiniku – Quezon City status from ACTIVE to INACTIVE.',

      metadata: {
        previousStatus: CompanyStatus.ACTIVE,

        newStatus: CompanyStatus.INACTIVE,
      },
    });

    expect(result.status).toBe(CompanyStatus.INACTIVE);
  });

  it('reactivates an inactive company and records an audit entry', async () => {
    const inactiveCompany = {
      ...activeCompany,

      status: CompanyStatus.INACTIVE,
    };

    const update = jest.fn().mockResolvedValue({
      ...inactiveCompany,

      status: CompanyStatus.ACTIVE,

      updatedAt,
    });

    const transaction = {
      company: {
        update,
      },
    } as unknown as Prisma.TransactionClient;

    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue(inactiveCompany),
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

    const result = await service.updateCompanyStatus(
      inactiveCompany.id,
      CompanyStatus.ACTIVE,
      actorUserId,
    );

    expect(update).toHaveBeenCalledWith({
      where: {
        id: inactiveCompany.id,
      },

      data: {
        status: CompanyStatus.ACTIVE,
      },

      select: companySelect,
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId: inactiveCompany.id,

      action: CompanyManagementAuditAction.STATUS_CHANGED,

      module: COMPANY_MANAGEMENT_AUDIT_MODULE,

      entityType: COMPANY_MANAGEMENT_ENTITY_TYPE,

      entityId: inactiveCompany.id,

      reference: 'YAK-QC',

      details:
        'Changed company Yakiniku – Quezon City status from INACTIVE to ACTIVE.',

      metadata: {
        previousStatus: CompanyStatus.INACTIVE,

        newStatus: CompanyStatus.ACTIVE,
      },
    });

    expect(result.status).toBe(CompanyStatus.ACTIVE);
  });

  it('does not update or audit when status is unchanged', async () => {
    const executeTransaction = jest.fn();

    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue(activeCompany),
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn();

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const service = new CompaniesService(prisma, auditLog);

    const result = await service.updateCompanyStatus(
      activeCompany.id,
      CompanyStatus.ACTIVE,
      actorUserId,
    );

    expect(executeTransaction).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();

    expect(result.status).toBe(CompanyStatus.ACTIVE);
  });

  it('rejects a missing company without updating or auditing', async () => {
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
      service.updateCompanyStatus(
        activeCompany.id,
        CompanyStatus.INACTIVE,
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(executeTransaction).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });
});
