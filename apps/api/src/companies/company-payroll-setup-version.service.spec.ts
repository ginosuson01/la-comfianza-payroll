import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { ConfigStatus, type Prisma } from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import {
  COMPANY_PAYROLL_SETUP_AUDIT_MODULE,
  COMPANY_PAYROLL_SETUP_ENTITY_TYPE,
  CompanyPayrollSetupAuditAction,
} from './company-payroll-setup-audit.constants';
import { CompanyPayrollSetupService } from './company-payroll-setup.service';
import { CompanyPayrollConfigResolverService } from './company-payroll-config-resolver.service';
import type { GoldenPayrollTemplateService } from './golden-payroll-template.service';
import { createValidGoldenPayrollTemplateConfig } from './golden-payroll-template.test-fixture';

describe('CompanyPayrollSetupService version creation', () => {
  const actorUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const setupId = '22222222-2222-4222-8222-222222222222';

  const version1Id = '33333333-3333-4333-8333-333333333333';

  const version2Id = '44444444-4444-4444-8444-444444444444';

  const company = {
    id: companyId,

    code: 'GINO-BINANGONAN',

    name: 'Gino-Binangonan',
  };

  const setup = {
    id: setupId,

    companyId,

    name: 'Gino-Binangonan Payroll Setup',

    status: ConfigStatus.ACTIVE,

    createdAt: new Date('2026-01-01T00:00:00.000Z'),

    updatedAt: new Date('2026-09-20T00:00:00.000Z'),
  };

  const currentVersion = {
    id: version1Id,

    version: 1,

    sourceTemplateVersionId: null,

    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),

    effectiveTo: null,
  };

  const createdVersion = {
    id: version2Id,

    version: 2,

    status: ConfigStatus.ACTIVE,

    effectiveFrom: new Date('2026-09-20T00:00:00.000Z'),

    effectiveTo: null,

    config: {
      attendance: {
        standardWorkMinutesPerDay: 480,
      },

      statutory: {
        philHealth: {
          dailyWorkerScheduleDaysPerWeek: 6,
        },
      },
    },

    createdAt: new Date('2026-09-20T00:00:00.000Z'),
  };

  function buildService(options?: {
    companyResult?: typeof company | null;

    setupResult?: typeof setup | null;

    activeVersionResult?: typeof currentVersion | null;
  }) {
    const companyFindUnique = jest
      .fn()
      .mockResolvedValue(
        options?.companyResult === undefined ? company : options.companyResult,
      );

    const setupFindUnique = jest
      .fn()
      .mockResolvedValue(
        options?.setupResult === undefined ? setup : options.setupResult,
      );

    const setupVersionFindFirst = jest
      .fn()
      .mockResolvedValue(
        options?.activeVersionResult === undefined
          ? currentVersion
          : options.activeVersionResult,
      );

    const setupVersionUpdate = jest.fn().mockResolvedValue({
      id: version1Id,
    });

    const setupVersionCreate = jest.fn().mockResolvedValue(createdVersion);

    const transaction = {
      companyPayrollSetupVersion: {
        update: setupVersionUpdate,

        create: setupVersionCreate,
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
        findUnique: companyFindUnique,
      },

      companyPayrollSetup: {
        findUnique: setupFindUnique,
      },

      companyPayrollSetupVersion: {
        findFirst: setupVersionFindFirst,
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    const getActiveVersionForDate = jest.fn().mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      payrollTemplateId: '55555555-5555-4555-8555-555555555555',
      templateCode: 'PH_STANDARD_PAYROLL',
      templateName: 'Philippine Standard Payroll',
      version: 1,
      name: 'Philippine Standard Payroll — Test Baseline',
      status: ConfigStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-06T00:00:00.000Z'),
      effectiveTo: null,
      config: createValidGoldenPayrollTemplateConfig(),
      createdAt: new Date('2026-01-06T00:00:00.000Z'),
    });

    const goldenPayrollTemplate = {
      getActiveVersionForDate,
    } as unknown as GoldenPayrollTemplateService;

    const payrollConfigResolver =
      new CompanyPayrollConfigResolverService();

    return {
      service: new CompanyPayrollSetupService(
        prisma,
        auditLog,
        goldenPayrollTemplate,
        payrollConfigResolver,
      ),

      companyFindUnique,
      setupFindUnique,
      setupVersionFindFirst,

      setupVersionUpdate,
      setupVersionCreate,

      executeTransaction,
      transaction,

      recordSuccessInTransaction,
    };
  }

  it('creates version 2 and closes version 1 on the day before the new effective date', async () => {
    const { service, setupVersionUpdate, setupVersionCreate } = buildService();

    const result = await service.createCompanyPayrollSetupVersion(
      companyId,
      {
        standardWorkMinutesPerDay: 480,

        philHealthDailyWorkerScheduleDaysPerWeek: 6,

        effectiveFrom: '2026-09-20',
      },
      actorUserId,
    );

    expect(setupVersionUpdate).toHaveBeenCalledWith({
      where: {
        id: version1Id,
      },

      data: {
        effectiveTo: new Date('2026-09-19T00:00:00.000Z'),
      },
    });

    expect(setupVersionCreate).toHaveBeenCalledWith({
      data: {
        companyPayrollSetupId: setupId,

        sourceTemplateVersionId: '44444444-4444-4444-8444-444444444444',

        version: 2,

        config: expect.objectContaining({
          schemaVersion: 1,
          jurisdiction: 'PH',

          attendance: {
            standardWorkMinutesPerDay: 480,
          },

          statutory: expect.objectContaining({
            sss: expect.objectContaining({
              maximumMsc: '35000.00',
            }),

            philHealth: expect.objectContaining({
              premiumRate: '0.0500',
              dailyWorkerScheduleDaysPerWeek: 6,
            }),

            pagIbig: expect.objectContaining({
              maximumFundSalary: '10000.00',
            }),

            premium: expect.objectContaining({
              nightDifferentialRate: '0.1000',
            }),
          }),
        }),

        status: ConfigStatus.ACTIVE,

        effectiveFrom: new Date('2026-09-20T00:00:00.000Z'),

        effectiveTo: null,
      },

      select: {
        id: true,
        version: true,
        status: true,
        effectiveFrom: true,
        effectiveTo: true,
        config: true,
        createdAt: true,
      },
    });

    expect(result).toEqual({
      ...setup,

      activeVersion: createdVersion,
    });
  });

  it('records an audit entry for payroll setup version creation', async () => {
    const { service, transaction, recordSuccessInTransaction } = buildService();

    await service.createCompanyPayrollSetupVersion(
      companyId,
      {
        standardWorkMinutesPerDay: 480,

        philHealthDailyWorkerScheduleDaysPerWeek: 5,

        effectiveFrom: '2026-09-20',
      },
      actorUserId,
    );

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        actorUserId,

        companyId,

        action: CompanyPayrollSetupAuditAction.VERSION_CREATED,

        module: COMPANY_PAYROLL_SETUP_AUDIT_MODULE,

        entityType: COMPANY_PAYROLL_SETUP_ENTITY_TYPE,

        entityId: setupId,

        reference: 'GINO-BINANGONAN',

        metadata: expect.objectContaining({
          previousVersion: 1,

          version: 2,

          previousEffectiveTo: '2026-09-19',

          effectiveFrom: '2026-09-20',

          standardWorkMinutesPerDay: 480,

          philHealthDailyWorkerScheduleDaysPerWeek: 5,
        }) as unknown,
      }),
    );
  });

  it('rejects an effective date that is not later than the current version effective date', async () => {
    const { service, executeTransaction } = buildService();

    await expect(
      service.createCompanyPayrollSetupVersion(
        companyId,
        {
          standardWorkMinutesPerDay: 480,

          philHealthDailyWorkerScheduleDaysPerWeek: 6,

          effectiveFrom: '2026-01-01',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects version creation when payroll setup does not exist', async () => {
    const { service, executeTransaction } = buildService({
      setupResult: null,
    });

    await expect(
      service.createCompanyPayrollSetupVersion(
        companyId,
        {
          standardWorkMinutesPerDay: 480,

          philHealthDailyWorkerScheduleDaysPerWeek: 6,

          effectiveFrom: '2026-09-20',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects version creation when no active source version exists', async () => {
    const { service, executeTransaction } = buildService({
      activeVersionResult: null,
    });

    await expect(
      service.createCompanyPayrollSetupVersion(
        companyId,
        {
          standardWorkMinutesPerDay: 480,

          philHealthDailyWorkerScheduleDaysPerWeek: 6,

          effectiveFrom: '2026-09-20',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });
});
