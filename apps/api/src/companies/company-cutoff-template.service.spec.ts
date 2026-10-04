import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CutoffFrequency, type Prisma } from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';
import {
  CUTOFF_TEMPLATE_AUDIT_MODULE,
  CUTOFF_TEMPLATE_ENTITY_TYPE,
  CutoffTemplateAuditAction,
} from './cutoff-template-audit.constants';
import { CompanyCutoffTemplateService } from './company-cutoff-template.service';
import type { CreateCutoffTemplateDto } from './dto/create-cutoff-template.dto';

describe('CompanyCutoffTemplateService', () => {
  const actorUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const companyId = '11111111-1111-4111-8111-111111111111';

  const templateId = '22222222-2222-4222-8222-222222222222';

  const now = new Date('2026-09-19T00:00:00.000Z');

  const company = {
    id: companyId,
    code: 'GINO-BINANGONAN',
    name: 'Gino-Binangonan',
  };

  function validInput(): CreateCutoffTemplateDto {
    return {
      code: 'SEMI-MONTHLY',

      name: 'Standard Semi-Monthly',

      frequency: CutoffFrequency.SEMI_MONTHLY,

      configuration: {
        periods: [
          {
            code: 'FIRST',
            name: 'First Period',

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
            name: 'Second Period',

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
      },
    };
  }

  const createdTemplate = {
    id: templateId,
    companyId,

    code: 'SEMI-MONTHLY',

    name: 'Standard Semi-Monthly',

    frequency: CutoffFrequency.SEMI_MONTHLY,

    configuration: {
      periods: [
        {
          code: 'FIRST',
          name: 'First Period',

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
          name: 'Second Period',

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
    },

    active: true,

    createdAt: now,
    updatedAt: now,
  };

  function buildService(options?: {
    companyResult?: typeof company | null;

    existingTemplate?: {
      id: string;
    } | null;
  }) {
    const companyFindUnique = jest
      .fn()
      .mockResolvedValue(
        options?.companyResult === undefined ? company : options.companyResult,
      );

    const templateFindUnique = jest
      .fn()
      .mockResolvedValue(options?.existingTemplate ?? null);

    const templateFindMany = jest.fn().mockResolvedValue([createdTemplate]);

    const templateCreate = jest.fn().mockResolvedValue(createdTemplate);

    const transaction = {
      cutoffTemplate: {
        create: templateCreate,
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

      cutoffTemplate: {
        findUnique: templateFindUnique,

        findMany: templateFindMany,
      },

      $transaction: executeTransaction,
    } as unknown as PrismaService;

    const recordSuccessInTransaction = jest.fn().mockResolvedValue(undefined);

    const auditLog = {
      recordSuccessInTransaction,
    } as unknown as AuditLogService;

    return {
      service: new CompanyCutoffTemplateService(prisma, auditLog),

      templateFindMany,
      templateFindUnique,
      templateCreate,
      executeTransaction,
      transaction,
      recordSuccessInTransaction,
    };
  }

  it('lists cutoff templates for an existing company', async () => {
    const { service, templateFindMany } = buildService();

    const result = await service.listCompanyCutoffTemplates(companyId);

    expect(result).toEqual([createdTemplate]);

    expect(templateFindMany).toHaveBeenCalledWith({
      where: {
        companyId,
      },

      select: {
        id: true,
        companyId: true,
        code: true,
        name: true,
        frequency: true,
        configuration: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },

      orderBy: [
        {
          active: 'desc',
        },
        {
          name: 'asc',
        },
      ],
    });
  });

  it('creates an active SEMI_MONTHLY cutoff template', async () => {
    const { service, templateCreate } = buildService();

    const result = await service.createCompanyCutoffTemplate(
      companyId,
      validInput(),
      actorUserId,
    );

    expect(templateCreate).toHaveBeenCalledWith({
      data: {
        companyId,

        code: 'SEMI-MONTHLY',

        name: 'Standard Semi-Monthly',

        frequency: CutoffFrequency.SEMI_MONTHLY,

        configuration: createdTemplate.configuration,

        active: true,
      },

      select: {
        id: true,
        companyId: true,
        code: true,
        name: true,
        frequency: true,
        configuration: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    expect(result).toEqual(createdTemplate);
  });

  it('records a success audit when creating a cutoff template', async () => {
    const { service, transaction, recordSuccessInTransaction } = buildService();

    await service.createCompanyCutoffTemplate(
      companyId,
      validInput(),
      actorUserId,
    );

    expect(recordSuccessInTransaction).toHaveBeenCalledWith(transaction, {
      actorUserId,

      companyId,

      action: CutoffTemplateAuditAction.CREATED,

      module: CUTOFF_TEMPLATE_AUDIT_MODULE,

      entityType: CUTOFF_TEMPLATE_ENTITY_TYPE,

      entityId: templateId,

      reference: 'GINO-BINANGONAN:SEMI-MONTHLY',

      details:
        'Created cutoff template Standard Semi-Monthly ' +
        '(SEMI-MONTHLY) for ' +
        'Gino-Binangonan (GINO-BINANGONAN).',

      metadata: {
        code: 'SEMI-MONTHLY',

        name: 'Standard Semi-Monthly',

        frequency: CutoffFrequency.SEMI_MONTHLY,

        active: true,
      },
    });
  });

  it('rejects duplicate period codes', async () => {
    const { service, executeTransaction } = buildService();

    const input = validInput();

    input.configuration.periods[1].code = 'FIRST';

    await expect(
      service.createCompanyCutoffTemplate(companyId, input, actorUserId),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects overlapping cutoff periods', async () => {
    const { service, executeTransaction } = buildService();

    const input = validInput();

    input.configuration.periods[1].start.day = 15;

    await expect(
      service.createCompanyCutoffTemplate(companyId, input, actorUserId),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects pay date before the cutoff end date', async () => {
    const { service, executeTransaction } = buildService();

    const input = validInput();

    input.configuration.periods[0].pay.day = 10;

    await expect(
      service.createCompanyCutoffTemplate(companyId, input, actorUserId),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects an existing cutoff template code', async () => {
    const { service, executeTransaction } = buildService({
      existingTemplate: {
        id: templateId,
      },
    });

    await expect(
      service.createCompanyCutoffTemplate(companyId, validInput(), actorUserId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(executeTransaction).not.toHaveBeenCalled();
  });

  it('rejects a missing company', async () => {
    const { service, templateFindUnique, executeTransaction } = buildService({
      companyResult: null,
    });

    await expect(
      service.createCompanyCutoffTemplate(companyId, validInput(), actorUserId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(templateFindUnique).not.toHaveBeenCalled();

    expect(executeTransaction).not.toHaveBeenCalled();
  });
});
