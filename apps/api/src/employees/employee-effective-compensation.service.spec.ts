import {
  ConfigStatus,
  PayBasis,
  PayrollCompensationSource,
  Prisma,
} from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import { EmployeeCompensationService } from './employee-compensation.service';

describe('EmployeeCompensationService effective compensation', () => {
  const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const employmentRecordId = '44444444-4444-4444-8444-444444444444';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const payrollSetupId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-09-23T04:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function buildService(
    options: {
      employeeCompensation?: object | null;
      companyCompensation?: object | null;
      payrollSetup?: object | null;
      payrollSetupVersion?: object | null;
    } = {},
  ) {
    const employeeFindUnique = jest.fn().mockResolvedValue({
      id: employeeId,

      employmentRecords: [
        {
          id: employmentRecordId,

          company: {
            id: companyId,
          },
        },
      ],
    });

    const employeeCompensationFindFirst = jest
      .fn()
      .mockResolvedValue(options.employeeCompensation ?? null);

    const companyCompensationFindFirst = jest
      .fn()
      .mockResolvedValue(options.companyCompensation ?? null);

    const companyPayrollSetupFindUnique = jest.fn().mockResolvedValue(
      options.payrollSetup === undefined
        ? {
            id: payrollSetupId,
          }
        : options.payrollSetup,
    );

    const companyPayrollSetupVersionFindFirst = jest.fn().mockResolvedValue(
      options.payrollSetupVersion === undefined
        ? {
            config: {
              statutory: {
                minimumWage: {
                  regionCode: 'IVA',
                  wageOrderCode: 'IVA-22',
                  areaClassification: 'Binangonan',
                  sector: 'NON_AGRICULTURE',
                  dailyRate: '550.00',
                  rateEffectiveFrom: '2025-10-05',
                },
              },
            },
          }
        : options.payrollSetupVersion,
    );

    const prisma = {
      employee: {
        findUnique: employeeFindUnique,
      },

      compensationRecord: {
        findFirst: employeeCompensationFindFirst,
      },

      companyCompensationRecord: {
        findFirst: companyCompensationFindFirst,
      },

      companyPayrollSetup: {
        findUnique: companyPayrollSetupFindUnique,
      },

      companyPayrollSetupVersion: {
        findFirst: companyPayrollSetupVersionFindFirst,
      },
    } as unknown as PrismaService;

    const auditLog = {} as AuditLogService;

    return {
      service: new EmployeeCompensationService(prisma, auditLog),

      employeeFindUnique,
      employeeCompensationFindFirst,
      companyCompensationFindFirst,
      companyPayrollSetupFindUnique,
      companyPayrollSetupVersionFindFirst,
    };
  }

  it('prefers an effective employee override and classifies it', async () => {
    const {
      service,
      employeeFindUnique,
      employeeCompensationFindFirst,
      companyCompensationFindFirst,
      companyPayrollSetupVersionFindFirst,
    } = buildService({
      employeeCompensation: {
        id: '55555555-5555-4555-8555-555555555555',
        payBasis: PayBasis.DAILY,
        rate: new Prisma.Decimal('600.0000'),
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
        effectiveTo: null,
      },
    });

    const result = await service.getEffectiveCompensation(employeeId);

    expect(employeeFindUnique).toHaveBeenCalledWith({
      where: {
        id: employeeId,
      },

      select: {
        id: true,

        employmentRecords: {
          where: {
            startDate: {
              lte: new Date('2026-09-23T00:00:00.000Z'),
            },

            OR: [
              {
                endDate: null,
              },
              {
                endDate: {
                  gt: new Date('2026-09-23T00:00:00.000Z'),
                },
              },
            ],
          },

          orderBy: {
            startDate: 'desc',
          },

          take: 1,

          select: {
            id: true,

            company: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    expect(employeeCompensationFindFirst).toHaveBeenCalledWith({
      where: {
        employmentRecordId,

        effectiveFrom: {
          lte: new Date('2026-09-23T00:00:00.000Z'),
        },

        OR: [
          {
            effectiveTo: null,
          },
          {
            effectiveTo: {
              gt: new Date('2026-09-23T00:00:00.000Z'),
            },
          },
        ],
      },

      orderBy: {
        effectiveFrom: 'desc',
      },

      select: {
        id: true,

        payBasis: true,
        rate: true,

        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    expect(companyCompensationFindFirst).not.toHaveBeenCalled();

    expect(companyPayrollSetupVersionFindFirst).toHaveBeenCalledWith({
      where: {
        companyPayrollSetupId: payrollSetupId,

        status: ConfigStatus.ACTIVE,

        AND: [
          {
            OR: [
              {
                effectiveFrom: null,
              },
              {
                effectiveFrom: {
                  lte: new Date('2026-09-23T00:00:00.000Z'),
                },
              },
            ],
          },
          {
            OR: [
              {
                effectiveTo: null,
              },
              {
                effectiveTo: {
                  gte: new Date('2026-09-23T00:00:00.000Z'),
                },
              },
            ],
          },
        ],
      },

      orderBy: {
        version: 'desc',
      },

      select: {
        config: true,
      },
    });

    expect(result.source).toBe(PayrollCompensationSource.EMPLOYEE_OVERRIDE);

    expect(result.rate).toBe('600');

    expect(result.classification).toBe('NON_MWE');

    expect(result.minimumWage).toEqual({
      regionCode: 'IVA',
      wageOrderCode: 'IVA-22',
      areaClassification: 'Binangonan',
      sector: 'NON_AGRICULTURE',
      dailyRate: '550.0000',
      rateEffectiveFrom: '2025-10-05',
    });

    expect(result.classificationReason).toBeNull();
  });

  it('classifies a lower employee override as MWE', async () => {
    const { service, companyCompensationFindFirst } = buildService({
      employeeCompensation: {
        id: '77777777-7777-4777-8777-777777777777',
        payBasis: PayBasis.DAILY,
        rate: new Prisma.Decimal('500.0000'),
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
        effectiveTo: null,
      },
    });

    const result = await service.getEffectiveCompensation(employeeId);

    expect(companyCompensationFindFirst).not.toHaveBeenCalled();

    expect(result.source).toBe(PayrollCompensationSource.EMPLOYEE_OVERRIDE);

    expect(result.rate).toBe('500');

    expect(result.classification).toBe('MWE');

    expect(result.classificationReason).toBeNull();
  });

  it('falls back to company standard compensation', async () => {
    const { service, companyCompensationFindFirst } = buildService({
      employeeCompensation: null,

      companyCompensation: {
        id: '66666666-6666-4666-8666-666666666666',
        payBasis: PayBasis.DAILY,
        rate: new Prisma.Decimal('550.0000'),
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
        effectiveTo: null,
      },
    });

    const result = await service.getEffectiveCompensation(employeeId);

    expect(companyCompensationFindFirst).toHaveBeenCalledWith({
      where: {
        companyId,

        effectiveFrom: {
          lte: new Date('2026-09-23T00:00:00.000Z'),
        },

        OR: [
          {
            effectiveTo: null,
          },
          {
            effectiveTo: {
              gt: new Date('2026-09-23T00:00:00.000Z'),
            },
          },
        ],
      },

      orderBy: {
        effectiveFrom: 'desc',
      },

      select: {
        id: true,

        payBasis: true,
        rate: true,

        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    expect(result.source).toBe(PayrollCompensationSource.COMPANY_STANDARD);

    expect(result.rate).toBe('550');

    expect(result.classification).toBe('MWE');
    expect(result.classificationReason).toBeNull();
  });

  it('returns unresolved when no compensation is effective', async () => {
    const { service, companyPayrollSetupFindUnique } = buildService({
      employeeCompensation: null,
      companyCompensation: null,
    });

    const result = await service.getEffectiveCompensation(employeeId);

    expect(result.source).toBeNull();
    expect(result.payBasis).toBeNull();
    expect(result.rate).toBeNull();

    expect(result.classification).toBe('UNRESOLVED');

    expect(result.classificationReason).toMatch(
      /no employee compensation override or company standard compensation/i,
    );

    expect(companyPayrollSetupFindUnique).not.toHaveBeenCalled();
  });

  it('returns unresolved classification when no payroll setup is effective', async () => {
    const { service } = buildService({
      employeeCompensation: null,

      companyCompensation: {
        id: '66666666-6666-4666-8666-666666666666',
        payBasis: PayBasis.DAILY,
        rate: new Prisma.Decimal('550.0000'),
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
        effectiveTo: null,
      },

      payrollSetup: null,
    });

    const result = await service.getEffectiveCompensation(employeeId);

    expect(result.source).toBe(PayrollCompensationSource.COMPANY_STANDARD);

    expect(result.classification).toBe('UNRESOLVED');

    expect(result.minimumWage).toBeNull();

    expect(result.classificationReason).toMatch(
      /minimum-wage reference is not configured/i,
    );
  });
});
