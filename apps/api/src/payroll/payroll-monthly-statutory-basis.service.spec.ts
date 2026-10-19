import {
  PayrollLineCategory,
  PayrollRunStatus,
  Prisma,
} from '@payroll/database';

import type { PrismaService } from '../database/prisma.service';

import { PayrollMonthlyStatutoryBasisService } from './payroll-monthly-statutory-basis.service';

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function createFixture() {
  const prisma = {
    payrollRunEmployee: {
      findMany: jest.fn(),
    },
  };

  const service = new PayrollMonthlyStatutoryBasisService(
    prisma as unknown as PrismaService,
  );

  return {
    prisma,
    service,
  };
}

describe('PayrollMonthlyStatutoryBasisService', () => {
  it('combines opening values, prior locked payroll and current cutoff earnings', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollRunEmployee.findMany.mockResolvedValueOnce([
      {
        basicPay: decimal('5000.00'),

        grossPay: decimal('5500.00'),

        lineItems: [
          {
            category: PayrollLineCategory.CONTRIBUTION,

            code: 'PHILHEALTH',

            amount: decimal('250.00'),

            metadata: null,
          },

          {
            category: PayrollLineCategory.CONTRIBUTION,

            code: 'PAGIBIG',

            amount: decimal('100.00'),

            metadata: null,
          },

          /*
           * Non-government contribution codes are not
           * allowed to contaminate statutory totals.
           */
          {
            category: PayrollLineCategory.CONTRIBUTION,

            code: 'OTHER',

            amount: decimal('999.00'),

            metadata: null,
          },
        ],

        payrollRun: {
          id: 'run-first',

          payrollCutoffId: 'cutoff-first',

          version: 1,

          payrollCutoff: {
            startDate: new Date('2026-09-01T00:00:00.000Z'),

            endDate: new Date('2026-09-15T00:00:00.000Z'),

            payDate: new Date('2026-09-25T00:00:00.000Z'),
          },
        },
      },
    ]);

    const result = await service.resolve({
      companyId: 'company-1',

      employeeId: 'employee-1',

      payrollCutoffId: 'cutoff-second',

      monthReferenceDate: '2026-09-30',

      opening: {
        basicPay: '1000.00',

        grossPay: '1200.00',

        contributionAmounts: {
          SSS: '50.00',
        },
      },

      current: {
        basicPay: '6000.00',

        grossPay: '6500.00',
      },
    });

    expect(result.referenceMonth).toBe('2026-09');

    expect(result.monthStart).toBe('2026-09-01');

    expect(result.nextMonthStart).toBe('2026-10-01');

    expect(result.prior.basicPay).toBe('5000.00');

    expect(result.prior.grossPay).toBe('5500.00');

    expect(result.prior.contributionAmounts).toEqual({
      SSS: '0.00',

      PHILHEALTH: '250.00',

      PAGIBIG: '100.00',
    });

    expect(result.monthly.basicPay).toBe('12000.00');

    expect(result.monthly.grossPay).toBe('13200.00');

    expect(result.monthly.contributionAmountsAlreadyCollected).toEqual({
      SSS: '50.00',

      PHILHEALTH: '250.00',

      PAGIBIG: '100.00',
    });
  });

  it('queries only authoritative CURRENT_LOCKED payroll from the same statutory month and excludes the current cutoff', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollRunEmployee.findMany.mockResolvedValueOnce([]);

    await service.resolve({
      companyId: 'company-1',

      employeeId: 'employee-1',

      payrollCutoffId: 'cutoff-current',

      monthReferenceDate: '2026-02-28',

      current: {
        basicPay: '1000.00',

        grossPay: '1000.00',
      },
    });

    expect(prisma.payrollRunEmployee.findMany).toHaveBeenCalledWith({
      where: {
        employeeId: 'employee-1',

        payrollRun: {
          is: {
            companyId: 'company-1',

            status: PayrollRunStatus.CURRENT_LOCKED,

            payrollCutoffId: {
              not: 'cutoff-current',
            },

            payrollCutoff: {
              is: {
                endDate: {
                  gte: new Date('2026-02-01T00:00:00.000Z'),

                  lt: new Date('2026-03-01T00:00:00.000Z'),
                },
              },
            },
          },
        },
      },

      select: {
        basicPay: true,

        grossPay: true,

        lineItems: {
          where: {
            category: {
              in: [
                PayrollLineCategory.CONTRIBUTION,
                PayrollLineCategory.EARNING,
                PayrollLineCategory.ADJUSTMENT,
              ],
            },
          },

          select: {
            category: true,
            code: true,
            amount: true,
            metadata: true,
          },
        },

        payrollRun: {
          select: {
            id: true,

            payrollCutoffId: true,

            version: true,

            payrollCutoff: {
              select: {
                startDate: true,

                endDate: true,

                payDate: true,
              },
            },
          },
        },
      },
    });
  });

  it('returns only the current cutoff when the statutory month has no history', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollRunEmployee.findMany.mockResolvedValueOnce([]);

    const result = await service.resolve({
      companyId: 'company-1',

      employeeId: 'employee-1',

      payrollCutoffId: 'cutoff-first',

      monthReferenceDate: '2026-09-15',

      current: {
        basicPay: '4200.00',

        grossPay: '4500.00',
      },
    });

    expect(result.priorLockedRuns).toHaveLength(0);

    expect(result.monthly.basicPay).toBe('4200.00');

    expect(result.monthly.grossPay).toBe('4500.00');

    expect(result.monthly.contributionAmountsAlreadyCollected).toEqual({
      SSS: '0.00',

      PHILHEALTH: '0.00',

      PAGIBIG: '0.00',
    });
  });

  it('accumulates uncapped Pag-IBIG compensation from opening, frozen prior payroll and the current cutoff', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollRunEmployee.findMany.mockResolvedValueOnce([
      {
        basicPay: decimal('5000.00'),

        grossPay: decimal('6500.00'),

        lineItems: [
          {
            category: PayrollLineCategory.EARNING,
            code: 'BASIC_PAY',
            amount: decimal('5000.00'),
            metadata: {
              source: 'ATTENDANCE_REGULAR_MINUTES',
            },
          },
          {
            category: PayrollLineCategory.EARNING,
            code: 'MEAL_ALLOWANCE',
            amount: decimal('1000.00'),
            metadata: {
              source: 'RECURRING_PAYROLL_ITEM',
              recurringItemKind: 'ALLOWANCE',
              pagIbigFundSalaryTreatment: 'INCLUDE',
            },
          },
          {
            category: PayrollLineCategory.EARNING,
            code: 'TRANSPORT_ALLOWANCE',
            amount: decimal('500.00'),
            metadata: {
              source: 'RECURRING_PAYROLL_ITEM',
              recurringItemKind: 'ALLOWANCE',
              pagIbigFundSalaryTreatment: 'EXCLUDE',
            },
          },
        ],

        payrollRun: {
          id: 'run-first',
          payrollCutoffId: 'cutoff-first',
          version: 1,
          payrollCutoff: {
            startDate: new Date('2026-09-01T00:00:00.000Z'),
            endDate: new Date('2026-09-15T00:00:00.000Z'),
            payDate: new Date('2026-09-25T00:00:00.000Z'),
          },
        },
      },
    ]);

    const result = await service.resolve({
      companyId: 'company-1',
      employeeId: 'employee-1',
      payrollCutoffId: 'cutoff-second',
      monthReferenceDate: '2026-09-30',

      opening: {
        pagIbigMonthlyCompensation: '500.00',
      },

      current: {
        basicPay: '6000.00',
        grossPay: '7000.00',
        pagIbigMonthlyCompensation: '6200.00',
      },
    });

    expect(result.priorLockedRuns[0]?.pagIbigMonthlyCompensation).toBe(
      '6000.00',
    );

    expect(result.prior.pagIbigMonthlyCompensation).toBe('6000.00');

    expect(result.current.pagIbigMonthlyCompensation).toBe('6200.00');

    expect(result.monthly.pagIbigMonthlyCompensation).toBe('12700.00');

    expect(result.monthly.pagIbigIssues).toEqual([]);

    expect(result.openingPagIbigMonthlyCompensationProvided).toBe(true);
  });

  it('keeps Pag-IBIG basis unresolved when frozen prior payroll contains an unclassified structured earning', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollRunEmployee.findMany.mockResolvedValueOnce([
      {
        basicPay: decimal('5000.00'),

        grossPay: decimal('5500.00'),

        lineItems: [
          {
            category: PayrollLineCategory.EARNING,
            code: 'LEGACY_ALLOWANCE',
            amount: decimal('500.00'),
            metadata: {
              source: 'RECURRING_PAYROLL_ITEM',
              recurringItemKind: 'ALLOWANCE',
              pagIbigFundSalaryTreatment: null,
            },
          },
        ],

        payrollRun: {
          id: 'run-legacy',
          payrollCutoffId: 'cutoff-legacy',
          version: 1,
          payrollCutoff: {
            startDate: new Date('2026-09-01T00:00:00.000Z'),
            endDate: new Date('2026-09-15T00:00:00.000Z'),
            payDate: new Date('2026-09-25T00:00:00.000Z'),
          },
        },
      },
    ]);

    const result = await service.resolve({
      companyId: 'company-1',
      employeeId: 'employee-1',
      payrollCutoffId: 'cutoff-current',
      monthReferenceDate: '2026-09-30',

      current: {
        basicPay: '6000.00',
        grossPay: '6000.00',
        pagIbigMonthlyCompensation: '6000.00',
      },
    });

    expect(result.prior.pagIbigMonthlyCompensation).toBeNull();

    expect(result.monthly.pagIbigMonthlyCompensation).toBeNull();

    expect(result.monthly.pagIbigIssues).toEqual([
      'Prior locked payroll run-legacy: Pag-IBIG Fund Salary treatment is unresolved for recurring earning LEGACY_ALLOWANCE.',
    ]);

    /*
     * Existing monthly SSS/gross accumulation remains usable.
     */
    expect(result.monthly.grossPay).toBe('11500.00');
  });

  it('does not invent current Pag-IBIG compensation when it has not yet been supplied by orchestration', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollRunEmployee.findMany.mockResolvedValueOnce([]);

    const result = await service.resolve({
      companyId: 'company-1',
      employeeId: 'employee-1',
      payrollCutoffId: 'cutoff-current',
      monthReferenceDate: '2026-09-15',

      current: {
        basicPay: '4000.00',
        grossPay: '4500.00',
      },
    });

    expect(result.current.pagIbigMonthlyCompensation).toBeNull();

    expect(result.monthly.pagIbigMonthlyCompensation).toBeNull();

    expect(result.monthly.pagIbigIssues).toEqual([
      'Current cutoff Pag-IBIG monthly compensation has not been resolved.',
    ]);
  });

  it('sorts prior payroll history by cutoff end date', async () => {
    const { prisma, service } = createFixture();

    prisma.payrollRunEmployee.findMany.mockResolvedValueOnce([
      {
        basicPay: decimal('2000.00'),

        grossPay: decimal('2000.00'),

        lineItems: [],

        payrollRun: {
          id: 'run-2',

          payrollCutoffId: 'cutoff-2',

          version: 1,

          payrollCutoff: {
            startDate: new Date('2026-09-11T00:00:00.000Z'),

            endDate: new Date('2026-09-25T00:00:00.000Z'),

            payDate: new Date('2026-09-30T00:00:00.000Z'),
          },
        },
      },

      {
        basicPay: decimal('1000.00'),

        grossPay: decimal('1000.00'),

        lineItems: [],

        payrollRun: {
          id: 'run-1',

          payrollCutoffId: 'cutoff-1',

          version: 1,

          payrollCutoff: {
            startDate: new Date('2026-08-26T00:00:00.000Z'),

            endDate: new Date('2026-09-10T00:00:00.000Z'),

            payDate: new Date('2026-09-15T00:00:00.000Z'),
          },
        },
      },
    ]);

    const result = await service.resolve({
      companyId: 'company-1',

      employeeId: 'employee-1',

      payrollCutoffId: 'cutoff-current',

      monthReferenceDate: '2026-09-30',

      current: {
        basicPay: '500.00',

        grossPay: '500.00',
      },
    });

    expect(result.priorLockedRuns.map((run) => run.payrollCutoffId)).toEqual([
      'cutoff-1',
      'cutoff-2',
    ]);
  });
});
