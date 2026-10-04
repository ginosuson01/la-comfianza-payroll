import type { PrismaService } from '../database/prisma.service';

import { PayrollMonthlyStatutoryBasisService } from './payroll-monthly-statutory-basis.service';

describe('PayrollMonthlyStatutoryBasisService opening state', () => {
  const findMany = jest.fn();

  const prisma = {
    payrollRunEmployee: {
      findMany,
    },
  } as unknown as PrismaService;

  const service = new PayrollMonthlyStatutoryBasisService(prisma);

  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([]);
  });

  it('reports that no opening was supplied', async () => {
    const result = await service.resolve({
      companyId: 'company-1',

      employeeId: 'employee-1',

      payrollCutoffId: 'cutoff-2',

      monthReferenceDate: '2026-09-30',

      current: {
        basicPay: '600.00',

        grossPay: '600.00',
      },
    });

    expect(result.openingProvided).toBe(false);

    expect(result.openingGrossPayProvided).toBe(false);

    expect(result.opening.grossPay).toBe('0.00');
  });

  it('preserves an explicitly supplied zero opening', async () => {
    const result = await service.resolve({
      companyId: 'company-1',

      employeeId: 'employee-1',

      payrollCutoffId: 'cutoff-2',

      monthReferenceDate: '2026-09-30',

      current: {
        basicPay: '600.00',

        grossPay: '600.00',
      },

      opening: {
        basicPay: '0.00',

        grossPay: '0.00',
      },
    });

    expect(result.openingProvided).toBe(true);

    expect(result.openingGrossPayProvided).toBe(true);

    expect(result.opening.grossPay).toBe('0.00');
  });
  it('does not treat a contribution-only opening as an earnings opening', async () => {
    const result = await service.resolve({
      companyId: 'company-1',

      employeeId: 'employee-1',

      payrollCutoffId: 'cutoff-2',

      monthReferenceDate: '2026-09-30',

      current: {
        basicPay: '600.00',

        grossPay: '600.00',
      },

      opening: {
        contributionAmounts: {
          SSS: '0.00',
        },
      },
    });

    expect(result.openingProvided).toBe(true);

    expect(result.openingGrossPayProvided).toBe(false);
  });
});
