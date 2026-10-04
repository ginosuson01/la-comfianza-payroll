import { NotFoundException } from '@nestjs/common';
import {
  EmployeePayrollStatus,
  PayBasis,
  PayrollCompensationSource,
  PayrollCutoffStatus,
  PayrollRunStatus,
  PayoutMethod,
} from '@payroll/database';

import type { PrismaService } from '../database/prisma.service';
import { PayrollHistoryService } from './payroll-history.service';

interface MoneyValue {
  toFixed(decimalPlaces: number): string;
}

interface PayrollRunWhere {
  companyId: string;

  payrollCutoffId?: string;

  status?: PayrollRunStatus;
}

interface PayrollRunCountArgs {
  where: PayrollRunWhere;
}

interface PayrollRunFindManyArgs {
  where: PayrollRunWhere;

  select: unknown;

  orderBy: Array<Record<string, 'asc' | 'desc'>>;

  skip: number;

  take: number;
}

interface PayrollRunFindFirstArgs {
  where: {
    id: string;

    companyId: string;
  };

  select: unknown;
}

interface PayrollRunRecord {
  id: string;

  companyId: string;

  payrollCutoffId: string;

  companyPayrollSetupVersionId: string;

  version: number;

  status: PayrollRunStatus;

  generatedAt: Date;

  totalGross: MoneyValue;

  totalNet: MoneyValue;

  clientPayableGross: MoneyValue | null;

  cashPayoutTotal: MoneyValue;

  atmPayoutTotal: MoneyValue;

  activeHoldTotal: MoneyValue;

  generatedBy: {
    id: string;

    username: string;

    firstName: string;

    lastName: string;
  };

  payrollCutoff: {
    startDate: Date;

    endDate: Date;

    payDate: Date;

    status: PayrollCutoffStatus;
  };

  _count: {
    employeeResults: number;
  };
}

interface PayrollRunEmployeeRecord {
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
}

interface PayrollRunDetailRecord extends PayrollRunRecord {
  configSnapshot: Record<string, unknown>;

  employeeResults: PayrollRunEmployeeRecord[];
}

function money(value: string): MoneyValue {
  return {
    toFixed: () => value,
  };
}

function buildHistoryRun(
  clientPayableGross: MoneyValue | null = null,
): PayrollRunRecord {
  return {
    id: 'run-2',

    companyId: 'company-1',

    payrollCutoffId: 'cutoff-1',

    companyPayrollSetupVersionId: 'setup-version-2',

    version: 2,

    status: PayrollRunStatus.CURRENT_LOCKED,

    generatedAt: new Date('2026-09-17T01:30:00.000Z'),

    totalGross: money('10000.00'),

    totalNet: money('9000.00'),

    clientPayableGross,

    cashPayoutTotal: money('4000.00'),

    atmPayoutTotal: money('5000.00'),

    activeHoldTotal: money('0.00'),

    generatedBy: {
      id: 'user-1',

      username: 'payroll.manager',

      firstName: 'Payroll',

      lastName: 'Manager',
    },

    payrollCutoff: {
      startDate: new Date('2026-09-01T00:00:00.000Z'),

      endDate: new Date('2026-09-15T00:00:00.000Z'),

      payDate: new Date('2026-09-25T00:00:00.000Z'),

      status: PayrollCutoffStatus.LOCKED,
    },

    _count: {
      employeeResults: 3,
    },
  };
}

function buildEmployee(
  id: string,
  employeeNumber: string,
  payrollStatus: EmployeePayrollStatus,
): PayrollRunEmployeeRecord {
  return {
    id,

    employeeId: `employee-${id}`,

    employmentRecordId: `employment-${id}`,

    employeeNumberSnapshot: employeeNumber,

    employeeNameSnapshot: `Employee ${employeeNumber}`,

    positionSnapshot: 'Crew',

    departmentSnapshot: 'Operations',

    payrollStatusSnapshot: payrollStatus,

    payoutMethodSnapshot: PayoutMethod.CASH,

    payoutAccountLast4Snapshot: null,

    payBasisSnapshot: PayBasis.DAILY,

    baseRateSnapshot: money('600.0000'),

    compensationSourceSnapshot: PayrollCompensationSource.COMPANY_STANDARD,

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
  };
}

function buildDetailRun(): PayrollRunDetailRecord {
  return {
    ...buildHistoryRun(),

    configSnapshot: {
      test: true,

      version: 2,
    },

    employeeResults: [
      buildEmployee('1', 'EMP-001', EmployeePayrollStatus.ACTIVE),

      buildEmployee('2', 'EMP-002', EmployeePayrollStatus.ACTIVE_HOLD),

      buildEmployee('3', 'EMP-003', EmployeePayrollStatus.RESIGNED),
    ],
  };
}

describe('PayrollHistoryService', () => {
  const countPayrollRunMock: jest.MockedFunction<
    (input: PayrollRunCountArgs) => Promise<number>
  > = jest.fn();

  const findManyPayrollRunMock: jest.MockedFunction<
    (input: PayrollRunFindManyArgs) => Promise<PayrollRunRecord[]>
  > = jest.fn();

  const findFirstPayrollRunMock: jest.MockedFunction<
    (input: PayrollRunFindFirstArgs) => Promise<PayrollRunDetailRecord | null>
  > = jest.fn();

  const transactionMock: jest.MockedFunction<
    (operations: readonly Promise<unknown>[]) => Promise<unknown[]>
  > = jest.fn();

  const prisma = {
    payrollRun: {
      count: countPayrollRunMock,

      findMany: findManyPayrollRunMock,

      findFirst: findFirstPayrollRunMock,
    },

    $transaction: transactionMock,
  };

  let service: PayrollHistoryService;

  beforeEach(() => {
    jest.resetAllMocks();

    transactionMock.mockImplementation(async (operations) =>
      Promise.all(operations),
    );

    service = new PayrollHistoryService(prisma as unknown as PrismaService);
  });

  it('lists company payroll history with cutoff and status filters', async () => {
    countPayrollRunMock.mockResolvedValue(11);

    findManyPayrollRunMock.mockResolvedValue([buildHistoryRun()]);

    const result = await service.listPayrollRuns('company-1', {
      payrollCutoffId: '11111111-1111-4111-8111-111111111111',

      status: PayrollRunStatus.CURRENT_LOCKED,

      page: 2,

      pageSize: 10,
    });

    expect(countPayrollRunMock).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',

        payrollCutoffId: '11111111-1111-4111-8111-111111111111',

        status: PayrollRunStatus.CURRENT_LOCKED,
      },
    });

    expect(findManyPayrollRunMock).toHaveBeenCalledTimes(1);

    const findCall = findManyPayrollRunMock.mock.calls[0];

    if (!findCall) {
      throw new Error('Expected payroll history query.');
    }

    const findInput = findCall[0];

    expect(findInput.skip).toBe(10);

    expect(findInput.take).toBe(10);

    expect(result.pagination).toEqual({
      page: 2,

      pageSize: 10,

      total: 11,

      totalPages: 2,
    });

    expect(result.items).toHaveLength(1);

    expect(result.items[0]?.totalGross).toBe('10000.00');
  });

  it('uses company-only filtering when optional history filters are absent', async () => {
    countPayrollRunMock.mockResolvedValue(0);

    findManyPayrollRunMock.mockResolvedValue([]);

    const result = await service.listPayrollRuns('company-1', {
      page: 1,

      pageSize: 25,
    });

    expect(countPayrollRunMock).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
      },
    });

    const findCall = findManyPayrollRunMock.mock.calls[0];

    if (!findCall) {
      throw new Error('Expected payroll history query.');
    }

    expect(findCall[0].where).toEqual({
      companyId: 'company-1',
    });

    expect(findCall[0].skip).toBe(0);

    expect(findCall[0].take).toBe(25);

    expect(result.pagination).toEqual({
      page: 1,

      pageSize: 25,

      total: 0,

      totalPages: 0,
    });
  });

  it('serializes a resolved client payable gross when one exists', async () => {
    countPayrollRunMock.mockResolvedValue(1);

    findManyPayrollRunMock.mockResolvedValue([
      buildHistoryRun(money('12000.00')),
    ]);

    const result = await service.listPayrollRuns('company-1', {
      page: 1,

      pageSize: 25,
    });

    expect(result.items[0]?.clientPayableGross).toBe('12000.00');
  });

  it('returns payroll run detail with frozen employee results and status breakdown', async () => {
    const payrollRun = buildDetailRun();

    findFirstPayrollRunMock.mockResolvedValue(payrollRun);

    const result = await service.getPayrollRunDetail('company-1', 'run-2');

    expect(findFirstPayrollRunMock).toHaveBeenCalledTimes(1);

    const findCall = findFirstPayrollRunMock.mock.calls[0];

    if (!findCall) {
      throw new Error('Expected payroll run detail query.');
    }

    expect(findCall[0].where).toEqual({
      id: 'run-2',

      companyId: 'company-1',
    });

    expect(result.statusBreakdown).toEqual({
      totalEmployees: 3,

      active: 1,

      activeHold: 1,

      resigned: 1,
    });

    expect(result.employees).toHaveLength(3);

    expect(result.employees[0]).toEqual(
      expect.objectContaining({
        employeeNumber: 'EMP-001',

        payrollStatus: EmployeePayrollStatus.ACTIVE,

        baseRate: '600.0000',

        compensationSource: PayrollCompensationSource.COMPANY_STANDARD,

        grossPay: '750.00',

        netPay: '690.00',
      }),
    );

    expect(result.configSnapshot).toEqual({
      test: true,

      version: 2,
    });
  });

  it('preserves an unknown compensation source for legacy payroll history', async () => {
    const payrollRun = buildDetailRun();

    const employee = payrollRun.employeeResults[0];

    if (!employee) {
      throw new Error('Expected a payroll employee result.');
    }

    employee.compensationSourceSnapshot = null;

    findFirstPayrollRunMock.mockResolvedValue(payrollRun);

    const result = await service.getPayrollRunDetail('company-1', 'run-2');

    expect(result.employees[0]?.compensationSource).toBeNull();
  });

  it('returns not found when the payroll run does not belong to the requested company', async () => {
    findFirstPayrollRunMock.mockResolvedValue(null);

    await expect(
      service.getPayrollRunDetail('company-1', 'run-missing'),
    ).rejects.toThrow(NotFoundException);
  });
});
