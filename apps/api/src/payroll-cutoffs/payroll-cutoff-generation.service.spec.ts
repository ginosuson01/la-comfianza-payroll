import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CutoffFrequency,
  PayrollCutoffStatus,
  type Prisma,
} from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import { PayrollCutoffAuditAction } from './payroll-cutoff-audit.constants';
import {
  PayrollCutoffGenerationService,
  type GeneratedPayrollCutoffRecord,
  type GeneratedPayrollCutoffResultItem,
} from './payroll-cutoff-generation.service';

interface CutoffTemplateFixture {
  id: string;
  companyId: string;
  code: string;
  name: string;
  frequency: CutoffFrequency;
  configuration: Prisma.JsonValue;
}

type FindTemplateFn = (input: unknown) => Promise<CutoffTemplateFixture | null>;

type FindCutoffFn = (
  input: unknown,
) => Promise<GeneratedPayrollCutoffRecord | null>;

type CreateCutoffFn = (input: unknown) => Promise<GeneratedPayrollCutoffRecord>;

type TransactionCallback = (
  transaction: Prisma.TransactionClient,
) => Promise<GeneratedPayrollCutoffResultItem[]>;

type TransactionFn = (
  callback: TransactionCallback,
) => Promise<GeneratedPayrollCutoffResultItem[]>;

describe('PayrollCutoffGenerationService', () => {
  const companyId = '11111111-1111-4111-8111-111111111111';

  const templateId = '22222222-2222-4222-8222-222222222222';

  const actorUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const period1CutoffId = '33333333-3333-4333-8333-333333333333';

  const period2CutoffId = '44444444-4444-4444-8444-444444444444';

  const now = new Date('2026-09-19T00:00:00.000Z');

  function standardConfiguration(): Prisma.JsonObject {
    return {
      periods: [
        {
          code: 'FIRST',
          name: 'First Cutoff',

          start: {
            mode: 'DAY',
            day: 1,
            monthOffset: 0,
          },

          end: {
            mode: 'DAY',
            day: 15,
            monthOffset: 0,
          },

          pay: {
            mode: 'DAY',
            day: 25,
            monthOffset: 0,
          },
        },

        {
          code: 'SECOND',
          name: 'Second Cutoff',

          start: {
            mode: 'DAY',
            day: 16,
            monthOffset: 0,
          },

          end: {
            mode: 'LAST_DAY',
            monthOffset: 0,
          },

          pay: {
            mode: 'DAY',
            day: 10,
            monthOffset: 1,
          },
        },
      ],
    };
  }

  function standardTemplate(): CutoffTemplateFixture {
    return {
      id: templateId,
      companyId,

      code: 'SEMI-MONTHLY',
      name: 'Standard Semi-Monthly',

      frequency: CutoffFrequency.SEMI_MONTHLY,

      configuration: standardConfiguration(),
    };
  }

  function buildCutoff(input: {
    id: string;
    startDate: Date;
    endDate: Date;
    payDate: Date;
    cutoffTemplateId?: string | null;
  }): GeneratedPayrollCutoffRecord {
    return {
      id: input.id,
      companyId,

      cutoffTemplateId:
        input.cutoffTemplateId === undefined
          ? templateId
          : input.cutoffTemplateId,

      startDate: input.startDate,

      endDate: input.endDate,

      payDate: input.payDate,

      status: PayrollCutoffStatus.OPEN,

      lockedAt: null,
      reopenedAt: null,
      lastReopenReason: null,

      createdAt: now,
      updatedAt: now,
    };
  }

  function buildService(options?: {
    template?: CutoffTemplateFixture | null;

    existingCutoffs?: Array<GeneratedPayrollCutoffRecord | null>;

    createdCutoffs?: GeneratedPayrollCutoffRecord[];
  }) {
    const findTemplate: jest.MockedFunction<FindTemplateFn> = jest.fn();

    findTemplate.mockResolvedValue(
      options?.template === undefined ? standardTemplate() : options.template,
    );

    const findCutoff: jest.MockedFunction<FindCutoffFn> = jest.fn();

    for (const existing of options?.existingCutoffs ?? [null, null]) {
      findCutoff.mockResolvedValueOnce(existing);
    }

    const createCutoff: jest.MockedFunction<CreateCutoffFn> = jest.fn();

    for (const created of options?.createdCutoffs ?? []) {
      createCutoff.mockResolvedValueOnce(created);
    }

    const transactionClient = {
      payrollCutoff: {
        findUnique: findCutoff,

        create: createCutoff,
      },
    } as unknown as Prisma.TransactionClient;

    const transaction: jest.MockedFunction<TransactionFn> = jest.fn(
      async (callback: TransactionCallback) => callback(transactionClient),
    );

    const prisma = {
      cutoffTemplate: {
        findFirst: findTemplate,
      },

      $transaction: transaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    return {
      service: new PayrollCutoffGenerationService(prisma, auditLog),

      findTemplate,
      findCutoff,
      createCutoff,
      transaction,
      transactionClient,
      recordSuccessInTransaction,
    };
  }

  it('generates both September 2026 semi-monthly cutoffs', async () => {
    const first = buildCutoff({
      id: period1CutoffId,

      startDate: new Date('2026-09-01T00:00:00.000Z'),

      endDate: new Date('2026-09-15T00:00:00.000Z'),

      payDate: new Date('2026-09-25T00:00:00.000Z'),
    });

    const second = buildCutoff({
      id: period2CutoffId,

      startDate: new Date('2026-09-16T00:00:00.000Z'),

      endDate: new Date('2026-09-30T00:00:00.000Z'),

      payDate: new Date('2026-10-10T00:00:00.000Z'),
    });

    const { service, createCutoff } = buildService({
      createdCutoffs: [first, second],
    });

    const result = await service.generateForMonth(
      {
        companyId,
        cutoffTemplateId: templateId,
        referenceMonth: '2026-09',
      },
      actorUserId,
    );

    expect(result.createdCount).toBe(2);

    expect(result.existingCount).toBe(0);

    expect(result.cutoffs).toHaveLength(2);

    expect(createCutoff).toHaveBeenNthCalledWith(1, {
      data: {
        companyId,

        cutoffTemplateId: templateId,

        startDate: new Date('2026-09-01T00:00:00.000Z'),

        endDate: new Date('2026-09-15T00:00:00.000Z'),

        payDate: new Date('2026-09-25T00:00:00.000Z'),
      },

      select: {
        id: true,
        companyId: true,
        cutoffTemplateId: true,
        startDate: true,
        endDate: true,
        payDate: true,
        status: true,
        lockedAt: true,
        reopenedAt: true,
        lastReopenReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    expect(createCutoff).toHaveBeenNthCalledWith(2, {
      data: {
        companyId,

        cutoffTemplateId: templateId,

        startDate: new Date('2026-09-16T00:00:00.000Z'),

        endDate: new Date('2026-09-30T00:00:00.000Z'),

        payDate: new Date('2026-10-10T00:00:00.000Z'),
      },

      select: {
        id: true,
        companyId: true,
        cutoffTemplateId: true,
        startDate: true,
        endDate: true,
        payDate: true,
        status: true,
        lockedAt: true,
        reopenedAt: true,
        lastReopenReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('resolves LAST_DAY correctly for February 2026', async () => {
    const first = buildCutoff({
      id: period1CutoffId,

      startDate: new Date('2026-02-01T00:00:00.000Z'),

      endDate: new Date('2026-02-15T00:00:00.000Z'),

      payDate: new Date('2026-02-25T00:00:00.000Z'),
    });

    const second = buildCutoff({
      id: period2CutoffId,

      startDate: new Date('2026-02-16T00:00:00.000Z'),

      endDate: new Date('2026-02-28T00:00:00.000Z'),

      payDate: new Date('2026-03-10T00:00:00.000Z'),
    });

    const { service, createCutoff } = buildService({
      createdCutoffs: [first, second],
    });

    await service.generateForMonth(
      {
        companyId,
        cutoffTemplateId: templateId,
        referenceMonth: '2026-02',
      },
      actorUserId,
    );

    expect(createCutoff).toHaveBeenNthCalledWith(2, {
      data: {
        companyId,

        cutoffTemplateId: templateId,

        startDate: new Date('2026-02-16T00:00:00.000Z'),

        endDate: new Date('2026-02-28T00:00:00.000Z'),

        payDate: new Date('2026-03-10T00:00:00.000Z'),
      },

      select: {
        id: true,
        companyId: true,
        cutoffTemplateId: true,
        startDate: true,
        endDate: true,
        payDate: true,
        status: true,
        lockedAt: true,
        reopenedAt: true,
        lastReopenReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('is idempotent when matching cutoff rows already exist', async () => {
    const first = buildCutoff({
      id: period1CutoffId,

      startDate: new Date('2026-09-01T00:00:00.000Z'),

      endDate: new Date('2026-09-15T00:00:00.000Z'),

      payDate: new Date('2026-09-25T00:00:00.000Z'),
    });

    const second = buildCutoff({
      id: period2CutoffId,

      startDate: new Date('2026-09-16T00:00:00.000Z'),

      endDate: new Date('2026-09-30T00:00:00.000Z'),

      payDate: new Date('2026-10-10T00:00:00.000Z'),
    });

    const { service, createCutoff, recordSuccessInTransaction } = buildService({
      existingCutoffs: [first, second],
    });

    const result = await service.generateForMonth(
      {
        companyId,
        cutoffTemplateId: templateId,
        referenceMonth: '2026-09',
      },
      actorUserId,
    );

    expect(result.createdCount).toBe(0);

    expect(result.existingCount).toBe(2);

    expect(createCutoff).not.toHaveBeenCalled();

    expect(recordSuccessInTransaction).not.toHaveBeenCalled();
  });

  it('rejects a template date that does not exist in the reference month', async () => {
    const configuration = standardConfiguration();

    const periods = configuration.periods;

    if (
      !Array.isArray(periods) ||
      typeof periods[0] !== 'object' ||
      periods[0] === null ||
      Array.isArray(periods[0])
    ) {
      throw new Error('Unexpected test fixture shape.');
    }

    periods[0] = {
      ...periods[0],

      end: {
        mode: 'DAY',
        day: 31,
        monthOffset: 0,
      },

      pay: {
        mode: 'DAY',
        day: 10,
        monthOffset: 1,
      },
    };

    const { service, transaction } = buildService({
      template: {
        ...standardTemplate(),
        configuration,
      },
    });

    await expect(
      service.generateForMonth(
        {
          companyId,
          cutoffTemplateId: templateId,
          referenceMonth: '2026-02',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects malformed stored periods that overlap', async () => {
    const configuration: Prisma.JsonObject = {
      periods: [
        {
          code: 'FIRST',
          name: 'First Cutoff',

          start: {
            mode: 'DAY',
            day: 1,
            monthOffset: 0,
          },

          end: {
            mode: 'DAY',
            day: 20,
            monthOffset: 0,
          },

          pay: {
            mode: 'DAY',
            day: 25,
            monthOffset: 0,
          },
        },

        {
          code: 'SECOND',
          name: 'Second Cutoff',

          start: {
            mode: 'DAY',
            day: 15,
            monthOffset: 0,
          },

          end: {
            mode: 'LAST_DAY',
            monthOffset: 0,
          },

          pay: {
            mode: 'DAY',
            day: 10,
            monthOffset: 1,
          },
        },
      ],
    };

    const { service, transaction } = buildService({
      template: {
        ...standardTemplate(),
        configuration,
      },
    });

    await expect(
      service.generateForMonth(
        {
          companyId,
          cutoffTemplateId: templateId,
          referenceMonth: '2026-09',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a template that is not active for the company', async () => {
    const { service, transaction } = buildService({
      template: null,
    });

    await expect(
      service.generateForMonth(
        {
          companyId,
          cutoffTemplateId: templateId,
          referenceMonth: '2026-09',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects an existing manual cutoff that conflicts with the template', async () => {
    const manualCutoff = buildCutoff({
      id: period1CutoffId,

      cutoffTemplateId: null,

      startDate: new Date('2026-09-01T00:00:00.000Z'),

      endDate: new Date('2026-09-15T00:00:00.000Z'),

      payDate: new Date('2026-09-25T00:00:00.000Z'),
    });

    const { service, createCutoff } = buildService({
      existingCutoffs: [manualCutoff],
    });

    await expect(
      service.generateForMonth(
        {
          companyId,
          cutoffTemplateId: templateId,
          referenceMonth: '2026-09',
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(createCutoff).not.toHaveBeenCalled();
  });

  it('records generation audit only for newly created cutoff rows', async () => {
    const first = buildCutoff({
      id: period1CutoffId,

      startDate: new Date('2026-09-01T00:00:00.000Z'),

      endDate: new Date('2026-09-15T00:00:00.000Z'),

      payDate: new Date('2026-09-25T00:00:00.000Z'),
    });

    const second = buildCutoff({
      id: period2CutoffId,

      startDate: new Date('2026-09-16T00:00:00.000Z'),

      endDate: new Date('2026-09-30T00:00:00.000Z'),

      payDate: new Date('2026-10-10T00:00:00.000Z'),
    });

    const { service, recordSuccessInTransaction } = buildService({
      createdCutoffs: [first, second],
    });

    await service.generateForMonth(
      {
        companyId,
        cutoffTemplateId: templateId,
        referenceMonth: '2026-09',
      },
      actorUserId,
    );

    expect(recordSuccessInTransaction).toHaveBeenCalledTimes(2);

    expect(recordSuccessInTransaction).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        actorUserId,
        companyId,

        action: PayrollCutoffAuditAction.GENERATED,

        entityId: period1CutoffId,

        reference: '2026-09-01 to 2026-09-15',
      }),
    );

    expect(recordSuccessInTransaction).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        actorUserId,
        companyId,

        action: PayrollCutoffAuditAction.GENERATED,

        entityId: period2CutoffId,

        reference: '2026-09-16 to 2026-09-30',
      }),
    );
  });
});
