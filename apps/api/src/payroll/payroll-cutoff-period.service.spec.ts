import { BadRequestException, NotFoundException } from '@nestjs/common';

import { CutoffFrequency } from '@payroll/database';

import type { PrismaService } from '../database/prisma.service';

import { PayrollCutoffPeriodService } from './payroll-cutoff-period.service';

function standardConfiguration() {
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

function crossMonthConfiguration() {
  return {
    periods: [
      {
        code: 'FIRST',

        name: '26 to 10',

        start: {
          mode: 'DAY',
          day: 26,
          monthOffset: -1,
        },

        end: {
          mode: 'DAY',
          day: 10,
          monthOffset: 0,
        },

        pay: {
          mode: 'DAY',
          day: 15,
          monthOffset: 0,
        },
      },

      {
        code: 'SECOND',

        name: '11 to 25',

        start: {
          mode: 'DAY',
          day: 11,
          monthOffset: 0,
        },

        end: {
          mode: 'DAY',
          day: 25,
          monthOffset: 0,
        },

        pay: {
          mode: 'DAY',
          day: 30,
          monthOffset: 0,
        },
      },
    ],
  };
}

function createFixture() {
  const prisma = {
    payrollCutoff: {
      findFirst: jest.fn(),
    },
  };

  const service = new PayrollCutoffPeriodService(
    prisma as unknown as PrismaService,
  );

  return {
    prisma,
    service,
  };
}

describe('PayrollCutoffPeriodService', () => {
  it('resolves the standard first semi-monthly cutoff', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollCutoff.findFirst.mockResolvedValueOnce({
      id: 'cutoff-first',

      cutoffTemplateId: 'template-1',

      startDate: new Date('2026-09-01T00:00:00.000Z'),

      endDate: new Date('2026-09-15T00:00:00.000Z'),

      payDate: new Date('2026-09-25T00:00:00.000Z'),

      cutoffTemplate: {
        id: 'template-1',

        frequency: CutoffFrequency.SEMI_MONTHLY,

        configuration: standardConfiguration(),
      },
    });

    const result = await service.resolve('company-1', 'cutoff-first');

    expect(result.position).toBe('FIRST');
  });

  it('resolves LAST_DAY as the standard second cutoff', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollCutoff.findFirst.mockResolvedValueOnce({
      id: 'cutoff-second',

      cutoffTemplateId: 'template-1',

      startDate: new Date('2026-09-16T00:00:00.000Z'),

      endDate: new Date('2026-09-30T00:00:00.000Z'),

      payDate: new Date('2026-10-10T00:00:00.000Z'),

      cutoffTemplate: {
        id: 'template-1',

        frequency: CutoffFrequency.SEMI_MONTHLY,

        configuration: standardConfiguration(),
      },
    });

    const result = await service.resolve('company-1', 'cutoff-second');

    expect(result.position).toBe('SECOND');
  });

  it('resolves a cross-month 26-to-10 cutoff as FIRST', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollCutoff.findFirst.mockResolvedValueOnce({
      id: 'cutoff-cross-month',

      cutoffTemplateId: 'template-2',

      startDate: new Date('2026-08-26T00:00:00.000Z'),

      endDate: new Date('2026-09-10T00:00:00.000Z'),

      payDate: new Date('2026-09-15T00:00:00.000Z'),

      cutoffTemplate: {
        id: 'template-2',

        frequency: CutoffFrequency.SEMI_MONTHLY,

        configuration: crossMonthConfiguration(),
      },
    });

    const result = await service.resolve('company-1', 'cutoff-cross-month');

    expect(result.position).toBe('FIRST');
  });

  it('resolves 11-to-25 as SECOND', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollCutoff.findFirst.mockResolvedValueOnce({
      id: 'cutoff-second-cross',

      cutoffTemplateId: 'template-2',

      startDate: new Date('2026-09-11T00:00:00.000Z'),

      endDate: new Date('2026-09-25T00:00:00.000Z'),

      payDate: new Date('2026-09-30T00:00:00.000Z'),

      cutoffTemplate: {
        id: 'template-2',

        frequency: CutoffFrequency.SEMI_MONTHLY,

        configuration: crossMonthConfiguration(),
      },
    });

    const result = await service.resolve('company-1', 'cutoff-second-cross');

    expect(result.position).toBe('SECOND');
  });

  it('rejects a cutoff without a template', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollCutoff.findFirst.mockResolvedValueOnce({
      id: 'cutoff-manual',

      cutoffTemplateId: null,

      startDate: new Date('2026-09-01T00:00:00.000Z'),

      endDate: new Date('2026-09-15T00:00:00.000Z'),

      payDate: new Date('2026-09-25T00:00:00.000Z'),

      cutoffTemplate: null,
    });

    await expect(
      service.resolve('company-1', 'cutoff-manual'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a cutoff whose dates no longer match its template', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollCutoff.findFirst.mockResolvedValueOnce({
      id: 'cutoff-invalid',

      cutoffTemplateId: 'template-1',

      startDate: new Date('2026-09-02T00:00:00.000Z'),

      endDate: new Date('2026-09-15T00:00:00.000Z'),

      payDate: new Date('2026-09-25T00:00:00.000Z'),

      cutoffTemplate: {
        id: 'template-1',

        frequency: CutoffFrequency.SEMI_MONTHLY,

        configuration: standardConfiguration(),
      },
    });

    await expect(
      service.resolve('company-1', 'cutoff-invalid'),
    ).rejects.toThrow('does not match FIRST or SECOND');
  });

  it('returns not found when the company/cutoff pair does not exist', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollCutoff.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.resolve('company-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
