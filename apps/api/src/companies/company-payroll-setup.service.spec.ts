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

describe('CompanyPayrollSetupService', () => {
  const actorUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const setupId = '22222222-2222-4222-8222-222222222222';

  const setupVersionId = '33333333-3333-4333-8333-333333333333';

  const createdAt = new Date('2026-09-19T00:00:00.000Z');

  const updatedAt = new Date('2026-09-19T00:00:00.000Z');

  const effectiveFrom = new Date('2026-09-01T00:00:00.000Z');

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
    createdAt,
    updatedAt,
  };

  const setupVersion = {
    id: setupVersionId,
    version: 1,
    status: ConfigStatus.ACTIVE,
    effectiveFrom,
    effectiveTo: null,
    config: {
      attendance: {
        standardWorkMinutesPerDay: 480,
      },
    },
    createdAt,
  };

  function buildService(options?: {
    companyResult?: typeof company | null;
    setupResult?: typeof setup | null;
    activeVersionResult?: typeof setupVersion | null;
  }) {
    const companyFindUnique = jest
      .fn()
      .mockResolvedValue(
        options?.companyResult === undefined ? company : options.companyResult,
      );

    const setupFindUnique = jest
      .fn()
      .mockResolvedValue(
        options?.setupResult === undefined ? null : options.setupResult,
      );

    const setupVersionFindFirst = jest
      .fn()
      .mockResolvedValue(
        options?.activeVersionResult === undefined
          ? null
          : options.activeVersionResult,
      );

    const setupCreate = jest.fn().mockResolvedValue(setup);

    const setupVersionCreate = jest.fn().mockResolvedValue(setupVersion);

    const transaction = {
      companyPayrollSetup: {
        create: setupCreate,
      },

      companyPayrollSetupVersion: {
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

    return {
      service: new CompanyPayrollSetupService(prisma, auditLog),

      companyFindUnique,
      setupFindUnique,
      setupVersionFindFirst,
      setupCreate,
      setupVersionCreate,
      executeTransaction,
      transaction,
      recordSuccessInTransaction,
    };
  }

  it('returns null when the company exists but has no payroll setup', async () => {
    const {
      service,
      companyFindUnique,
      setupFindUnique,
      setupVersionFindFirst,
    } = buildService();

    const result = await service.getCompanyPayrollSetup(companyId);

    expect(result).toBeNull();

    expect(companyFindUnique).toHaveBeenCalledWith({
      where: {
        id: companyId,
      },

      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    expect(setupFindUnique).toHaveBeenCalledWith({
      where: {
        companyId,
      },

      select: {
        id: true,
        companyId: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    expect(setupVersionFindFirst).not.toHaveBeenCalled();
  });

  it('returns the active payroll setup version', async () => {
    const { service, setupVersionFindFirst } = buildService({
      setupResult: setup,
      activeVersionResult: setupVersion,
    });

    const result = await service.getCompanyPayrollSetup(companyId);

    expect(result).toEqual({
      ...setup,
      activeVersion: setupVersion,
    });

    expect(setupVersionFindFirst).toHaveBeenCalledWith({
      where: {
        companyPayrollSetupId: setupId,
        status: ConfigStatus.ACTIVE,
      },

      orderBy: {
        version: 'desc',
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
  });

  it('creates an active initial payroll setup and version 1', async () => {
    const { service, setupCreate, setupVersionCreate, executeTransaction } =
      buildService();

    const result = await service.createCompanyPayrollSetup(
      companyId,
      {
        standardWorkMinutesPerDay: 480,
        effectiveFrom: '2026-09-01',
      },
      actorUserId,
    );

    expect(executeTransaction).toHaveBeenCalledTimes(1);

    expect(setupCreate).toHaveBeenCalledWith({
      data: {
        companyId,

        name: 'Gino-Binangonan Payroll Setup',

        status: ConfigStatus.ACTIVE,
      },

      select: {
        id: true,
        companyId: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    expect(setupVersionCreate).toHaveBeenCalledWith({
      data: {
        companyPayrollSetupId: setupId,

        sourceTemplateVersionId: null,

        version: 1,

        config: {
          attendance: {
            standardWorkMinutesPerDay: 480,
          },
        },

        status: ConfigStatus.ACTIVE,

        effectiveFrom,

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
      activeVersion: setupVersion,
    });
  });

  it('records a success audit for initial payroll setup creation', async () => {
    const { service, transaction, recordSuccessInTransaction } = buildService();

    await service.createCompanyPayrollSetup(
      companyId,
      {
        standardWorkMinutesPerDay: 480,
        effectiveFrom: '2026-09-01',
      },
      actorUserId,
    );

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId,

      action: CompanyPayrollSetupAuditAction.CREATED,

      module: COMPANY_PAYROLL_SETUP_AUDIT_MODULE,

      entityType: COMPANY_PAYROLL_SETUP_ENTITY_TYPE,

      entityId: setupId,

      reference: 'GINO-BINANGONAN',

      details:
        'Created payroll setup version 1 for ' +
        'Gino-Binangonan (GINO-BINANGONAN).',

      metadata: {
        version: 1,

        status: ConfigStatus.ACTIVE,

        effectiveFrom: '2026-09-01',

        effectiveTo: null,

        standardWorkMinutesPerDay: 480,
      },
    });
  });

  it('rejects creation when the company already has a payroll setup', async () => {
    const { service, executeTransaction, recordSuccessInTransaction } =
      buildService({
        setupResult: setup,
      });

    await expect(
      service.createCompanyPayrollSetup(
        companyId,
        {
          standardWorkMinutesPerDay: 480,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(executeTransaction).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });

  it('persists a complete Philippine minimum-wage reference in the setup snapshot', async () => {
    const { service, setupVersionCreate } = buildService();

    await service.createCompanyPayrollSetup(
      companyId,
      {
        standardWorkMinutesPerDay: 480,

        philHealthDailyWorkerScheduleDaysPerWeek: 5,

        minimumWageRegionCode: 'IVA',

        minimumWageOrderCode: 'IVA-22',

        minimumWageAreaClassification: 'Synthetic test area classification',

        minimumWageSector: 'Synthetic test sector',

        minimumWageDailyRate: '600.00',

        minimumWageRateEffectiveFrom: '2026-01-01',

        effectiveFrom: '2026-09-01',
      },
      actorUserId,
    );

    expect(setupVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          config: {
            attendance: {
              standardWorkMinutesPerDay: 480,
            },

            statutory: {
              philHealth: {
                dailyWorkerScheduleDaysPerWeek: 5,
              },

              minimumWage: {
                regionCode: 'IVA',

                wageOrderCode: 'IVA-22',

                areaClassification: 'Synthetic test area classification',

                sector: 'Synthetic test sector',

                dailyRate: '600.00',

                rateEffectiveFrom: '2026-01-01',
              },
            },
          },
        }) as unknown,
      }),
    );
  });

  it('persists the Phase 1 minimum-wage core without optional reference fields', async () => {
    const { service, setupVersionCreate } = buildService();

    await service.createCompanyPayrollSetup(
      companyId,
      {
        standardWorkMinutesPerDay: 480,

        philHealthDailyWorkerScheduleDaysPerWeek: 5,

        minimumWageDailyRate: '600.00',

        minimumWageRateEffectiveFrom: '2026-01-01',

        effectiveFrom: '2026-09-01',
      },
      actorUserId,
    );

    expect(setupVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          config: {
            attendance: {
              standardWorkMinutesPerDay: 480,
            },

            statutory: {
              philHealth: {
                dailyWorkerScheduleDaysPerWeek: 5,
              },

              minimumWage: {
                dailyRate: '600.00',
                rateEffectiveFrom: '2026-01-01',
              },
            },
          },
        }) as unknown,
      }),
    );
  });

  it('rejects a minimum-wage daily rate without an effective date', async () => {
    const { service, executeTransaction } = buildService();

    await expect(
      service.createCompanyPayrollSetup(
        companyId,
        {
          standardWorkMinutesPerDay: 480,

          minimumWageDailyRate: '600.00',
        },
        actorUserId,
      ),
    ).rejects.toThrow(
      'Minimum-wage configuration must include both daily rate and rate effective date.',
    );

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects an unsupported PhilHealth daily-worker schedule', async () => {
    const { service, executeTransaction } = buildService();

    await expect(
      service.createCompanyPayrollSetup(
        companyId,
        {
          standardWorkMinutesPerDay: 480,
          philHealthDailyWorkerScheduleDaysPerWeek: 7,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects an effectiveTo earlier than effectiveFrom', async () => {
    const { service, executeTransaction } = buildService();

    await expect(
      service.createCompanyPayrollSetup(
        companyId,
        {
          standardWorkMinutesPerDay: 480,
          effectiveFrom: '2026-09-15',
          effectiveTo: '2026-09-01',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects an invalid calendar date', async () => {
    const { service, executeTransaction } = buildService();

    await expect(
      service.createCompanyPayrollSetup(
        companyId,
        {
          standardWorkMinutesPerDay: 480,
          effectiveFrom: '2026-02-30',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects a missing company', async () => {
    const { service, setupFindUnique, executeTransaction } = buildService({
      companyResult: null,
    });

    await expect(
      service.createCompanyPayrollSetup(
        companyId,
        {
          standardWorkMinutesPerDay: 480,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(setupFindUnique).not.toHaveBeenCalled();

    expect(executeTransaction).not.toHaveBeenCalled();
  });
});
