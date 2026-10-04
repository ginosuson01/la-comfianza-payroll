import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PayBasis,
  PayrollCutoffStatus,
  Prisma,
  type Prisma as PrismaTypes,
} from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import {
  COMPANY_COMPENSATION_AUDIT_MODULE,
  COMPANY_COMPENSATION_ENTITY_TYPE,
  CompanyCompensationAuditAction,
} from './company-compensation-audit.constants';
import { CompanyCompensationService } from './company-compensation.service';

describe('CompanyCompensationService', () => {
  const actorUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const compensationId = '22222222-2222-4222-8222-222222222222';

  const company = {
    id: companyId,
    code: 'CHUBBS-BINANGONAN',
    name: 'CHUBBS-BINANGONAN',
  };

  const createdAt = new Date('2026-09-23T00:00:00.000Z');

  const compensation = {
    id: compensationId,
    companyId,

    payBasis: PayBasis.DAILY,
    rate: new Prisma.Decimal(600),

    effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
    effectiveTo: null,

    createdAt,
  };

  const nextCompensation = {
    ...compensation,

    id: '33333333-3333-4333-8333-333333333333',

    rate: new Prisma.Decimal(650),

    effectiveFrom: new Date('2026-11-01T00:00:00.000Z'),
  };

  const nextCutoff = {
    id: '44444444-4444-4444-8444-444444444444',

    startDate: new Date('2026-11-01T00:00:00.000Z'),
    endDate: new Date('2026-11-15T00:00:00.000Z'),
  };

  const historicalCompensation = {
    ...compensation,

    effectiveTo: new Date('2026-11-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-10-23T02:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function buildService(options?: {
    companyResult?: typeof company | null;
    compensationResult?: typeof compensation | null;
    existingResult?: { id: string } | null;
    nextCutoffResult?: typeof nextCutoff | null;
    createdCompensationResult?: typeof compensation;
    currentUpdateCount?: number;
  }) {
    const companyFindUnique = jest.fn((): Promise<typeof company | null> =>
      Promise.resolve(
        options?.companyResult === undefined ? company : options.companyResult,
      ),
    );

    const compensationFindFirst = jest.fn(
      (): Promise<typeof compensation | null> =>
        Promise.resolve(
          options?.compensationResult === undefined
            ? compensation
            : options.compensationResult,
        ),
    );

    const existingFindFirst = jest.fn((): Promise<{ id: string } | null> =>
      Promise.resolve(options?.existingResult ?? null),
    );

    const compensationCreate = jest.fn((): Promise<typeof compensation> =>
      Promise.resolve(options?.createdCompensationResult ?? compensation),
    );

    const compensationUpdateMany = jest.fn((): Promise<{ count: number }> =>
      Promise.resolve({
        count: options?.currentUpdateCount ?? 1,
      }),
    );

    const transaction = {
      companyCompensationRecord: {
        create: compensationCreate,
        updateMany: compensationUpdateMany,
      },
    } as unknown as PrismaTypes.TransactionClient;

    const executeTransaction = jest.fn(
      (
        callback: (
          transaction: PrismaTypes.TransactionClient,
        ) => Promise<unknown>,
      ): Promise<unknown> => callback(transaction),
    );

    const findFirst = jest.fn(
      (args: {
        where?: {
          companyId?: string;
          effectiveTo?: null;
        };
      }): Promise<typeof compensation | { id: string } | null> => {
        if (
          args.where &&
          Object.prototype.hasOwnProperty.call(args.where, 'effectiveTo')
        ) {
          return compensationFindFirst();
        }

        return existingFindFirst();
      },
    );

    const payrollCutoffFindFirst = jest.fn(
      (): Promise<typeof nextCutoff | null> =>
        Promise.resolve(
          options?.nextCutoffResult === undefined
            ? nextCutoff
            : options.nextCutoffResult,
        ),
    );

    const compensationHistoryFindMany = jest.fn(
      (): Promise<
        Array<typeof nextCompensation | typeof historicalCompensation>
      > => Promise.resolve([nextCompensation, historicalCompensation]),
    );

    const prisma = {
      company: {
        findUnique: companyFindUnique,
      },

      companyCompensationRecord: {
        findFirst,
        findMany: compensationHistoryFindMany,
      },

      payrollCutoff: {
        findFirst: payrollCutoffFindFirst,
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn((): Promise<void> =>
      Promise.resolve(),
    );

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    return {
      service: new CompanyCompensationService(prisma, auditLog),

      companyFindUnique,
      compensationFindFirst,
      existingFindFirst,
      findFirst,

      compensationCreate,
      compensationUpdateMany,
      compensationHistoryFindMany,

      payrollCutoffFindFirst,

      executeTransaction,
      transaction,

      recordSuccessInTransaction,
    };
  }

  it('returns the current company standard compensation', async () => {
    const { service, compensationFindFirst } = buildService();

    const result = await service.getLatestCompanyCompensation(companyId);

    expect(compensationFindFirst).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      id: compensationId,
      companyId,

      payBasis: PayBasis.DAILY,
      rate: '600',

      effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
      effectiveTo: null,

      createdAt,
    });
  });

  it('returns null when the company has no standard compensation', async () => {
    const { service } = buildService({
      compensationResult: null,
    });

    await expect(
      service.getLatestCompanyCompensation(companyId),
    ).resolves.toBeNull();
  });

  it('rejects reading compensation for a missing company', async () => {
    const { service, findFirst } = buildService({
      companyResult: null,
    });

    await expect(
      service.getLatestCompanyCompensation(companyId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns company compensation history newest effective rate first', async () => {
    const { service, compensationHistoryFindMany } = buildService();

    const result = await service.listCompanyCompensationHistory(companyId);

    expect(compensationHistoryFindMany).toHaveBeenCalledWith({
      where: {
        companyId,
      },

      select: {
        id: true,
        companyId: true,
        payBasis: true,
        rate: true,
        effectiveFrom: true,
        effectiveTo: true,
        createdAt: true,
      },

      orderBy: [
        {
          effectiveFrom: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    expect(result).toEqual([
      {
        id: nextCompensation.id,
        companyId,

        payBasis: PayBasis.DAILY,
        rate: '650',

        effectiveFrom: new Date('2026-11-01T00:00:00.000Z'),
        effectiveTo: null,

        createdAt,
      },
      {
        id: compensationId,
        companyId,

        payBasis: PayBasis.DAILY,
        rate: '600',

        effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-11-01T00:00:00.000Z'),

        createdAt,
      },
    ]);
  });

  it('rejects reading compensation history for a missing company', async () => {
    const { service, compensationHistoryFindMany } = buildService({
      companyResult: null,
    });

    await expect(
      service.listCompanyCompensationHistory(companyId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(compensationHistoryFindMany).not.toHaveBeenCalled();
  });

  it('creates the initial company standard compensation', async () => {
    const {
      service,
      compensationCreate,
      executeTransaction,
      transaction,
      recordSuccessInTransaction,
    } = buildService({
      compensationResult: null,
      existingResult: null,
    });

    const result = await service.createInitialCompanyCompensation(
      companyId,
      {
        payBasis: PayBasis.DAILY,
        rate: 600,
        effectiveFrom: '2026-10-01',
      },
      actorUserId,
    );

    expect(executeTransaction).toHaveBeenCalledTimes(1);

    expect(compensationCreate).toHaveBeenCalledWith({
      data: {
        companyId,

        payBasis: PayBasis.DAILY,
        rate: new Prisma.Decimal(600),

        effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
      },

      select: {
        id: true,
        companyId: true,
        payBasis: true,
        rate: true,
        effectiveFrom: true,
        effectiveTo: true,
        createdAt: true,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId,

      action: CompanyCompensationAuditAction.CREATED,

      module: COMPANY_COMPENSATION_AUDIT_MODULE,

      entityType: COMPANY_COMPENSATION_ENTITY_TYPE,

      entityId: compensationId,

      reference: 'CHUBBS-BINANGONAN',

      details:
        'Created company standard compensation for ' +
        'CHUBBS-BINANGONAN (CHUBBS-BINANGONAN).',

      metadata: {
        payBasis: PayBasis.DAILY,
        rate: '600',
        effectiveFrom: '2026-10-01',
      },
    });

    expect(result).toEqual({
      id: compensationId,
      companyId,

      payBasis: PayBasis.DAILY,
      rate: '600',

      effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
      effectiveTo: null,

      createdAt,
    });
  });

  it('rejects initial compensation when the company is already configured', async () => {
    const { service, executeTransaction } = buildService({
      existingResult: {
        id: compensationId,
      },
    });

    await expect(
      service.createInitialCompanyCompensation(
        companyId,
        {
          payBasis: PayBasis.DAILY,
          rate: 650,
          effectiveFrom: '2026-10-16',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects initial compensation for a missing company', async () => {
    const { service, findFirst, executeTransaction } = buildService({
      companyResult: null,
    });

    await expect(
      service.createInitialCompanyCompensation(
        companyId,
        {
          payBasis: PayBasis.DAILY,
          rate: 600,
          effectiveFrom: '2026-10-01',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(findFirst).not.toHaveBeenCalled();
    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects an invalid calendar effective date', async () => {
    const { service, executeTransaction } = buildService({
      compensationResult: null,
      existingResult: null,
    });

    await expect(
      service.createInitialCompanyCompensation(
        companyId,
        {
          payBasis: PayBasis.DAILY,
          rate: 600,
          effectiveFrom: '2026-02-30',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('starts a changed company rate exactly on the next OPEN cutoff', async () => {
    const {
      service,
      payrollCutoffFindFirst,
      compensationUpdateMany,
      compensationCreate,
      transaction,
      recordSuccessInTransaction,
    } = buildService({
      createdCompensationResult: nextCompensation,
    });

    const result = await service.createNextCompanyCompensationVersion(
      companyId,
      {
        payBasis: PayBasis.DAILY,
        rate: 650,
      },
      actorUserId,
    );

    expect(payrollCutoffFindFirst).toHaveBeenCalledWith({
      where: {
        companyId,

        status: PayrollCutoffStatus.OPEN,

        startDate: {
          gt: new Date('2026-10-23T00:00:00.000Z'),
        },
      },

      orderBy: {
        startDate: 'asc',
      },

      select: {
        id: true,
        startDate: true,
        endDate: true,
      },
    });

    expect(compensationUpdateMany).toHaveBeenCalledWith({
      where: {
        id: compensationId,
        effectiveTo: null,
      },

      data: {
        effectiveTo: nextCutoff.startDate,
      },
    });

    expect(compensationCreate).toHaveBeenCalledWith({
      data: {
        companyId,

        payBasis: PayBasis.DAILY,
        rate: new Prisma.Decimal(650),

        effectiveFrom: nextCutoff.startDate,
      },

      select: {
        id: true,
        companyId: true,
        payBasis: true,
        rate: true,
        effectiveFrom: true,
        effectiveTo: true,
        createdAt: true,
      },
    });

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId,

      action: CompanyCompensationAuditAction.VERSION_CREATED,

      module: COMPANY_COMPENSATION_AUDIT_MODULE,

      entityType: COMPANY_COMPENSATION_ENTITY_TYPE,

      entityId: nextCompensation.id,

      reference: 'CHUBBS-BINANGONAN',

      details:
        'Changed company standard compensation for ' +
        'CHUBBS-BINANGONAN (CHUBBS-BINANGONAN) ' +
        'effective 2026-11-01.',

      metadata: {
        previousCompensationId: compensationId,
        newCompensationId: nextCompensation.id,

        previousPayBasis: PayBasis.DAILY,
        previousRate: '600',

        payBasis: PayBasis.DAILY,
        rate: '650',

        effectiveFrom: '2026-11-01',

        payrollCutoffId: nextCutoff.id,
        payrollCutoffStartDate: '2026-11-01',
        payrollCutoffEndDate: '2026-11-15',
      },
    });

    expect(result).toEqual({
      id: nextCompensation.id,
      companyId,

      payBasis: PayBasis.DAILY,
      rate: '650',

      effectiveFrom: nextCutoff.startDate,
      effectiveTo: null,

      createdAt,
    });
  });

  it('rejects a company rate change when there is no current standard compensation', async () => {
    const { service, payrollCutoffFindFirst, executeTransaction } =
      buildService({
        compensationResult: null,
      });

    await expect(
      service.createNextCompanyCompensationVersion(
        companyId,
        {
          payBasis: PayBasis.DAILY,
          rate: 650,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(payrollCutoffFindFirst).not.toHaveBeenCalled();

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects a company rate change when the rate and pay basis are unchanged', async () => {
    const { service, payrollCutoffFindFirst, executeTransaction } =
      buildService();

    await expect(
      service.createNextCompanyCompensationVersion(
        companyId,
        {
          payBasis: PayBasis.DAILY,
          rate: 600,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(payrollCutoffFindFirst).not.toHaveBeenCalled();

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects a company rate change when the next OPEN cutoff has not been generated', async () => {
    const { service, executeTransaction } = buildService({
      nextCutoffResult: null,
    });

    await expect(
      service.createNextCompanyCompensationVersion(
        companyId,
        {
          payBasis: PayBasis.DAILY,
          rate: 650,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('uses the Philippine business date when resolving the next cutoff', async () => {
    jest.setSystemTime(new Date('2026-10-31T16:30:00.000Z'));

    const boundaryCutoff = {
      id: '55555555-5555-4555-8555-555555555555',

      startDate: new Date('2026-11-16T00:00:00.000Z'),
      endDate: new Date('2026-11-30T00:00:00.000Z'),
    };

    const boundaryCompensation = {
      ...nextCompensation,

      id: '66666666-6666-4666-8666-666666666666',

      effectiveFrom: boundaryCutoff.startDate,
    };

    const { service, payrollCutoffFindFirst } = buildService({
      nextCutoffResult: boundaryCutoff,
      createdCompensationResult: boundaryCompensation,
    });

    await service.createNextCompanyCompensationVersion(
      companyId,
      {
        payBasis: PayBasis.DAILY,
        rate: 650,
      },
      actorUserId,
    );

    expect(payrollCutoffFindFirst).toHaveBeenCalledWith({
      where: {
        companyId,

        status: PayrollCutoffStatus.OPEN,

        startDate: {
          gt: new Date('2026-11-01T00:00:00.000Z'),
        },
      },

      orderBy: {
        startDate: 'asc',
      },

      select: {
        id: true,
        startDate: true,
        endDate: true,
      },
    });
  });

  it('rejects a concurrent company compensation change', async () => {
    const { service, compensationCreate } = buildService({
      currentUpdateCount: 0,
    });

    await expect(
      service.createNextCompanyCompensationVersion(
        companyId,
        {
          payBasis: PayBasis.DAILY,
          rate: 650,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(compensationCreate).not.toHaveBeenCalled();
  });
});
