import {
  EmployeePayrollStatus,
  PayBasis,
  PayrollCompensationSource,
  PayrollRunStatus,
  PayoutMethod,
} from '@payroll/database';

import type { PrismaService } from '../database/prisma.service';
import { PayrollEmployeeHistoryService } from './payroll-employee-history.service';

interface MoneyValue {
  toFixed(decimalPlaces: number): string;
}

interface PayrollRunEmployeeWhere {
  employeeId: string;

  payrollRun: {
    is: {
      companyId: string;

      status?: PayrollRunStatus;
    };
  };
}

interface PayrollRunEmployeeCountArgs {
  where: PayrollRunEmployeeWhere;
}

interface PayrollRunEmployeeFindManyArgs {
  where: PayrollRunEmployeeWhere;

  select: unknown;

  orderBy: {
    createdAt: 'desc';
  };

  skip: number;

  take: number;
}

interface EmployeePayrollHistoryRecord {
  id: string;

  employeeId: string;

  employmentRecordId: string;

  employeeNumberSnapshot: string;

  employeeNameSnapshot: string;

  positionSnapshot: string | null;

  departmentSnapshot: string | null;

  payrollStatusSnapshot: EmployeePayrollStatus;

  payoutMethodSnapshot: PayoutMethod;

  payoutAccountLast4Snapshot: string | null;

  payBasisSnapshot: PayBasis;

  baseRateSnapshot: MoneyValue;

  compensationSourceSnapshot: PayrollCompensationSource | null;

  basicPay: MoneyValue;

  allowancesTotal: MoneyValue;

  premiumPayTotal: MoneyValue;

  grossPay: MoneyValue;

  governmentContributionsTotal: MoneyValue;

  taxTotal: MoneyValue;

  otherDeductionsTotal: MoneyValue;

  totalDeductions: MoneyValue;

  netPay: MoneyValue;

  cashPayout: MoneyValue;

  atmPayout: MoneyValue;

  heldAmount: MoneyValue;

  clientPayableGross: MoneyValue | null;

  taxableCompensation: MoneyValue;

  withholdingTax: MoneyValue;

  thirteenthMonthPay: MoneyValue;

  lastPayAmount: MoneyValue;

  isLastPay: boolean;

  createdAt: Date;

  payrollRun: {
    id: string;

    version: number;

    status: PayrollRunStatus;

    generatedAt: Date;

    payrollCutoff: {
      id: string;

      startDate: Date;

      endDate: Date;

      payDate: Date;
    };
  };
}

function money(value: string): MoneyValue {
  return {
    toFixed: () => value,
  };
}

function buildRecord(): EmployeePayrollHistoryRecord {
  return {
    id: 'result-1',

    employeeId: 'employee-1',

    employmentRecordId: 'employment-1',

    employeeNumberSnapshot: 'EMP-001',

    employeeNameSnapshot: 'Juan Dela Cruz',

    positionSnapshot: 'Crew',

    departmentSnapshot: 'Operations',

    payrollStatusSnapshot: EmployeePayrollStatus.ACTIVE,

    payoutMethodSnapshot: PayoutMethod.CASH,

    payoutAccountLast4Snapshot: null,

    payBasisSnapshot: PayBasis.DAILY,

    baseRateSnapshot: money('600.0000'),

    compensationSourceSnapshot: PayrollCompensationSource.EMPLOYEE_OVERRIDE,

    basicPay: money('600.00'),

    allowancesTotal: money('100.00'),

    premiumPayTotal: money('50.00'),

    grossPay: money('750.00'),

    governmentContributionsTotal: money('30.00'),

    taxTotal: money('10.00'),

    otherDeductionsTotal: money('20.00'),

    totalDeductions: money('60.00'),

    netPay: money('690.00'),

    cashPayout: money('690.00'),

    atmPayout: money('0.00'),

    heldAmount: money('0.00'),

    clientPayableGross: null,

    taxableCompensation: money('750.00'),

    withholdingTax: money('10.00'),

    thirteenthMonthPay: money('0.00'),

    lastPayAmount: money('0.00'),

    isLastPay: false,

    createdAt: new Date('2026-09-17T01:30:00.000Z'),

    payrollRun: {
      id: 'run-2',

      version: 2,

      status: PayrollRunStatus.CURRENT_LOCKED,

      generatedAt: new Date('2026-09-17T01:30:00.000Z'),

      payrollCutoff: {
        id: 'cutoff-1',

        startDate: new Date('2026-09-01T00:00:00.000Z'),

        endDate: new Date('2026-09-15T00:00:00.000Z'),

        payDate: new Date('2026-09-25T00:00:00.000Z'),
      },
    },
  };
}

describe('PayrollEmployeeHistoryService', () => {
  const countMock: jest.MockedFunction<
    (input: PayrollRunEmployeeCountArgs) => Promise<number>
  > = jest.fn();

  const findManyMock: jest.MockedFunction<
    (
      input: PayrollRunEmployeeFindManyArgs,
    ) => Promise<EmployeePayrollHistoryRecord[]>
  > = jest.fn();

  const transactionMock: jest.MockedFunction<
    (operations: readonly Promise<unknown>[]) => Promise<unknown[]>
  > = jest.fn();

  const prisma = {
    payrollRunEmployee: {
      count: countMock,

      findMany: findManyMock,
    },

    $transaction: transactionMock,
  };

  let service: PayrollEmployeeHistoryService;

  beforeEach(() => {
    jest.resetAllMocks();

    transactionMock.mockImplementation(async (operations) =>
      Promise.all(operations),
    );

    service = new PayrollEmployeeHistoryService(
      prisma as unknown as PrismaService,
    );
  });

  it('returns immutable employee payroll history across payroll runs', async () => {
    countMock.mockResolvedValue(1);

    findManyMock.mockResolvedValue([buildRecord()]);

    const result = await service.listEmployeePayrollHistory(
      'company-1',
      'employee-1',
      {
        page: 1,

        pageSize: 25,
      },
    );

    expect(result.items).toHaveLength(1);

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        employeeNumber: 'EMP-001',

        payrollStatus: EmployeePayrollStatus.ACTIVE,

        compensationSource: PayrollCompensationSource.EMPLOYEE_OVERRIDE,

        grossPay: '750.00',

        netPay: '690.00',

        payrollRun: {
          id: 'run-2',

          version: 2,

          status: PayrollRunStatus.CURRENT_LOCKED,

          generatedAt: expect.any(Date) as Date,
        },
      }),
    );

    expect(result.pagination).toEqual({
      page: 1,

      pageSize: 25,

      total: 1,

      totalPages: 1,
    });
  });

  it('preserves an unknown compensation source for legacy employee payroll history', async () => {
    const record = buildRecord();

    record.compensationSourceSnapshot = null;

    countMock.mockResolvedValue(1);
    findManyMock.mockResolvedValue([record]);

    const result = await service.listEmployeePayrollHistory(
      'company-1',
      'employee-1',
      {
        page: 1,
        pageSize: 25,
      },
    );

    expect(result.items[0]?.compensationSource).toBeNull();
  });

  it('can filter employee payroll history by payroll run status', async () => {
    countMock.mockResolvedValue(0);

    findManyMock.mockResolvedValue([]);

    await service.listEmployeePayrollHistory('company-1', 'employee-1', {
      runStatus: PayrollRunStatus.SUPERSEDED,

      page: 1,

      pageSize: 25,
    });

    const countCall = countMock.mock.calls[0];

    if (!countCall) {
      throw new Error('Expected employee payroll history count query.');
    }

    expect(countCall[0].where).toEqual({
      employeeId: 'employee-1',

      payrollRun: {
        is: {
          companyId: 'company-1',

          status: PayrollRunStatus.SUPERSEDED,
        },
      },
    });
  });
});
