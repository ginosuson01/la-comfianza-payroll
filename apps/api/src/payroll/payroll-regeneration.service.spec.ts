import { PayrollCutoffStatus, PayrollRunStatus } from '@payroll/database';

import type {
  AuditLogService,
  RecordSuccessfulAuditInput,
} from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';

import type {
  PayrollCutoffCalculationPreflight,
  PayrollCutoffCalculationService,
} from './payroll-cutoff-calculation.service';
import { PayrollGenerationService } from './payroll-generation.service';

interface PayrollRunState {
  id: string;
  version: number;
  status: PayrollRunStatus;
}

interface PersistedPayrollRunState extends PayrollRunState {
  companyId: string;
  payrollCutoffId: string;
}

interface PayrollCutoffUpdateManyArgs {
  where: {
    id: string;
    companyId: string;
    status: PayrollCutoffStatus;
  };

  data: {
    status: PayrollCutoffStatus;
    lockedAt: Date;
  };
}

interface PayrollRunUpdateManyArgs {
  where: {
    id: string;
    status: PayrollRunStatus;
  };

  data: {
    status: PayrollRunStatus;
  };
}

interface PayrollRunCreateArgs {
  data: {
    companyId: string;
    payrollCutoffId: string;
    version: number;
    status: PayrollRunStatus;
    generatedByUserId: string;
    [key: string]: unknown;
  };

  select: Record<string, unknown>;
}

function createReadyRegenerationPreflight(): PayrollCutoffCalculationPreflight {
  return {
    companyId: 'company-1',

    payrollCutoffId: 'cutoff-1',

    company: {
      id: 'company-1',
      code: 'COMPANY-1',
      name: 'Test Company',

      addressLine1: '123 Test Street',
      addressLine2: null,
      barangay: 'Test Barangay',
      city: 'Quezon City',
      province: 'Metro Manila',
      postalCode: '1100',
      country: 'Philippines',

      contactName: 'Test Contact',
      contactEmail: 'payroll@testcompany.example',
      contactPhone: '+639171234567',
    },

    cutoff: {
      id: 'cutoff-1',

      startDate: '2026-09-01',

      endDate: '2026-09-15',

      payDate: '2026-09-25',

      status: PayrollCutoffStatus.REOPENED,
    },

    ready: true,

    eligibleEmployeeCount: 1,

    calculatedEmployeeCount: 1,

    inputIssues: [],

    calculationIssues: [],

    companyPayrollSetupVersionId: 'setup-version-2',

    configSnapshot: {
      test: true,
      generation: 2,
    },

    employees: [
      {
        companyId: 'company-1',

        payrollCutoffId: 'cutoff-1',

        dtrId: 'dtr-1',

        employeeId: 'employee-1',

        employmentRecordId: 'employment-1',

        employeeNumber: 'EMP-001',

        employeeName: 'Juan Dela Cruz',

        positionSnapshot: 'Crew',

        departmentSnapshot: 'Operations',

        payrollStatus: 'ACTIVE',

        payoutMethod: 'CASH',

        payoutAccountLast4: null,

        payBasis: 'DAILY',

        baseRate: '600.0000',

        compensationSource: 'EMPLOYEE_OVERRIDE',

        ready: true,

        statutoryConfig: {
          ready: true,

          issues: [],

          options: {},
        },

        calculation: {
          employeeId: 'employee-1',

          employmentRecordId: 'employment-1',

          payrollStatus: 'ACTIVE',

          payoutMethod: 'CASH',

          status: 'COMPLETE',

          issues: [],

          corePayroll: {
            employeeId: 'employee-1',

            employmentRecordId: 'employment-1',

            payrollStatus: 'ACTIVE',

            payoutMethod: 'CASH',

            status: 'COMPLETE',

            issues: [],

            basicPay: '600.00',

            paidLeaveEarningsTotal: '0.00',

            allowancesTotal: '100.00',

            taxableAllowancesTotal: '100.00',

            earningAdjustmentsTotal: '0.00',

            premiumPayTotal: '50.00',

            grossPay: '750.00',

            attendanceDeductionsTotal: '0.00',

            fixedDeductionsTotal: '20.00',

            deductionAdjustmentsTotal: '0.00',

            otherDeductionsTotal: '20.00',

            preContributionTaxPay: '730.00',

            lineItems: [],
          },

          governmentContributionsTotal: '30.00',

          employerGovernmentContributionsTotal: '30.00',

          taxableCompensation: '750.00',

          withholdingTax: '10.00',

          taxTotal: '10.00',

          totalDeductions: '60.00',

          netPayBeforeStatusTreatment: '690.00',

          lineItems: [],
        },

        treatment: {
          employeeId: 'employee-1',

          employmentRecordId: 'employment-1',

          payrollStatus: 'ACTIVE',

          payoutMethod: 'CASH',

          status: 'COMPLETE',

          issues: [],

          calculatedNetBeforeStatusTreatment: '690.00',

          payableAmount: '690.00',

          cashPayout: '690.00',

          atmPayout: '0.00',

          heldAmount: '0.00',

          thirteenthMonthPay: null,

          lastPayAmount: null,

          isLastPay: false,

          lineItems: [],
        },
      },
    ],

    totals: {
      totalGross: '750.00',

      totalNetBeforeStatusTreatment: '690.00',

      totalPayable: '690.00',

      cashPayoutTotal: '690.00',

      atmPayoutTotal: '0.00',

      heldAmountTotal: '0.00',
    },
  };
}

function createFixture(
  preflight: PayrollCutoffCalculationPreflight = createReadyRegenerationPreflight(),
) {
  const findFirstPayrollRunMock: jest.MockedFunction<
    (input: unknown) => Promise<PayrollRunState | null>
  > = jest.fn();

  const updateManyPayrollRunMock: jest.MockedFunction<
    (input: PayrollRunUpdateManyArgs) => Promise<{ count: number }>
  > = jest.fn();

  const createPayrollRunMock: jest.MockedFunction<
    (input: PayrollRunCreateArgs) => Promise<PersistedPayrollRunState>
  > = jest.fn();

  const updateManyPayrollCutoffMock: jest.MockedFunction<
    (input: PayrollCutoffUpdateManyArgs) => Promise<{ count: number }>
  > = jest.fn();

  const createPayrollRunEmployeeMock: jest.MockedFunction<
    (input: unknown) => Promise<{ id: string }>
  > = jest.fn();

  const createManyPayrollLineItemMock: jest.MockedFunction<
    (input: unknown) => Promise<{ count: number }>
  > = jest.fn();

  const transaction = {
    payrollRun: {
      findFirst: findFirstPayrollRunMock,

      updateMany: updateManyPayrollRunMock,

      create: createPayrollRunMock,
    },

    payrollCutoff: {
      updateMany: updateManyPayrollCutoffMock,
    },

    payrollRunEmployee: {
      create: createPayrollRunEmployeeMock,
    },

    payrollLineItem: {
      createMany: createManyPayrollLineItemMock,
    },
  };

  type TransactionMock = typeof transaction;

  const prismaTransactionMock: jest.MockedFunction<
    (
      callback: (transactionClient: TransactionMock) => Promise<unknown>,
    ) => Promise<unknown>
  > = jest.fn();

  prismaTransactionMock.mockImplementation(async (callback) =>
    callback(transaction),
  );

  const prisma = {
    $transaction: prismaTransactionMock,
  };

  const recordSuccessInTransactionMock: jest.MockedFunction<
    (
      transactionClient: TransactionMock,

      input: RecordSuccessfulAuditInput,
    ) => Promise<void>
  > = jest.fn();

  const auditLog = {
    recordSuccessInTransaction: recordSuccessInTransactionMock,
  };

  const calculateCutoffPreflightMock: jest.MockedFunction<
    PayrollCutoffCalculationService['calculateCutoffPreflight']
  > = jest.fn();

  calculateCutoffPreflightMock.mockResolvedValue(preflight);

  const cutoffCalculation = {
    calculateCutoffPreflight: calculateCutoffPreflightMock,
  };

  const service = new PayrollGenerationService(
    prisma as unknown as PrismaService,

    auditLog as unknown as AuditLogService,

    cutoffCalculation as unknown as PayrollCutoffCalculationService,
  );

  return {
    service,

    transaction,

    prismaTransactionMock,

    findFirstPayrollRunMock,

    updateManyPayrollRunMock,

    createPayrollRunMock,

    updateManyPayrollCutoffMock,

    createPayrollRunEmployeeMock,

    createManyPayrollLineItemMock,

    recordSuccessInTransactionMock,

    calculateCutoffPreflightMock,
  };
}

describe('PayrollGenerationService regeneration', () => {
  const actorUserId = '99999999-9999-4999-8999-999999999999';

  it('supersedes the pending run and creates the next locked payroll version', async () => {
    const fixture = createFixture();

    fixture.findFirstPayrollRunMock.mockResolvedValue({
      id: 'payroll-run-v1',

      version: 1,

      status: PayrollRunStatus.REOPENED_PENDING_REGENERATION,
    });

    fixture.updateManyPayrollCutoffMock.mockResolvedValue({
      count: 1,
    });

    fixture.updateManyPayrollRunMock.mockResolvedValue({
      count: 1,
    });

    fixture.createPayrollRunMock.mockResolvedValue({
      id: 'payroll-run-v2',

      companyId: 'company-1',

      payrollCutoffId: 'cutoff-1',

      version: 2,

      status: PayrollRunStatus.CURRENT_LOCKED,
    });

    fixture.createPayrollRunEmployeeMock.mockResolvedValue({
      id: 'payroll-run-employee-v2',
    });

    fixture.recordSuccessInTransactionMock.mockResolvedValue(undefined);

    const result = await fixture.service.regeneratePayroll({
      companyId: 'company-1',

      payrollCutoffId: 'cutoff-1',

      actorUserId,
    });

    expect(fixture.calculateCutoffPreflightMock).toHaveBeenCalledWith(
      'company-1',
      'cutoff-1',
      {},
    );

    expect(fixture.findFirstPayrollRunMock).toHaveBeenCalledWith({
      where: {
        payrollCutoffId: 'cutoff-1',

        status: PayrollRunStatus.REOPENED_PENDING_REGENERATION,
      },

      orderBy: {
        version: 'desc',
      },

      select: {
        id: true,
        version: true,
        status: true,
      },
    });

    expect(fixture.updateManyPayrollCutoffMock).toHaveBeenCalledTimes(1);

    const cutoffUpdate = fixture.updateManyPayrollCutoffMock.mock.calls[0]?.[0];

    expect(cutoffUpdate).toBeDefined();

    expect(cutoffUpdate?.where).toEqual({
      id: 'cutoff-1',

      companyId: 'company-1',

      status: PayrollCutoffStatus.REOPENED,
    });

    expect(cutoffUpdate?.data.status).toBe(PayrollCutoffStatus.LOCKED);

    expect(cutoffUpdate?.data.lockedAt).toBeInstanceOf(Date);

    expect(fixture.updateManyPayrollRunMock).toHaveBeenCalledWith({
      where: {
        id: 'payroll-run-v1',

        status: PayrollRunStatus.REOPENED_PENDING_REGENERATION,
      },

      data: {
        status: PayrollRunStatus.SUPERSEDED,
      },
    });

    expect(fixture.createPayrollRunMock).toHaveBeenCalledTimes(1);

    const createCall = fixture.createPayrollRunMock.mock.calls[0];

    if (!createCall) {
      throw new Error('Expected payroll run create call.');
    }

    const createInput = createCall[0];

    expect(createInput.data.companyId).toBe('company-1');

    expect(createInput.data.payrollCutoffId).toBe('cutoff-1');

    expect(createInput.data.version).toBe(2);

    expect(createInput.data.status).toBe(PayrollRunStatus.CURRENT_LOCKED);

    expect(createInput.data.generatedByUserId).toBe(actorUserId);

    expect(createInput.data.companySnapshot).toEqual({
      id: 'company-1',
      code: 'COMPANY-1',
      name: 'Test Company',

      addressLine1: '123 Test Street',
      addressLine2: null,
      barangay: 'Test Barangay',
      city: 'Quezon City',
      province: 'Metro Manila',
      postalCode: '1100',
      country: 'Philippines',

      contactName: 'Test Contact',
      contactEmail: 'payroll@testcompany.example',
      contactPhone: '+639171234567',
    });

    expect(fixture.recordSuccessInTransactionMock).toHaveBeenCalledTimes(1);

    const auditCall = fixture.recordSuccessInTransactionMock.mock.calls[0];

    if (!auditCall) {
      throw new Error('Expected payroll regeneration audit call.');
    }

    const [auditTransaction, auditInput] = auditCall;

    expect(auditTransaction).toBe(fixture.transaction);

    expect(auditInput.action).toBe('PAYROLL_REGENERATED');

    expect(auditInput.entityId).toBe('payroll-run-v2');

    expect(result).toEqual({
      id: 'payroll-run-v2',

      companyId: 'company-1',

      payrollCutoffId: 'cutoff-1',

      version: 2,

      status: PayrollRunStatus.CURRENT_LOCKED,

      employeeCount: 1,

      totalGross: '750.00',

      totalNet: '690.00',

      cashPayoutTotal: '690.00',

      atmPayoutTotal: '0.00',

      activeHoldTotal: '0.00',

      clientPayableGross: null,
    });
  });

  it('rejects regeneration when no payroll run is pending regeneration', async () => {
    const fixture = createFixture();

    fixture.findFirstPayrollRunMock.mockResolvedValue(null);

    await expect(
      fixture.service.regeneratePayroll({
        companyId: 'company-1',

        payrollCutoffId: 'cutoff-1',

        actorUserId,
      }),
    ).rejects.toThrow(
      'Payroll cutoff does not have a payroll run pending regeneration.',
    );

    expect(fixture.updateManyPayrollCutoffMock).not.toHaveBeenCalled();

    expect(fixture.createPayrollRunMock).not.toHaveBeenCalled();

    expect(fixture.recordSuccessInTransactionMock).not.toHaveBeenCalled();
  });

  it('rejects regeneration when the cutoff is no longer REOPENED inside the transaction', async () => {
    const fixture = createFixture();

    fixture.findFirstPayrollRunMock.mockResolvedValue({
      id: 'payroll-run-v1',

      version: 1,

      status: PayrollRunStatus.REOPENED_PENDING_REGENERATION,
    });

    fixture.updateManyPayrollCutoffMock.mockResolvedValue({
      count: 0,
    });

    await expect(
      fixture.service.regeneratePayroll({
        companyId: 'company-1',

        payrollCutoffId: 'cutoff-1',

        actorUserId,
      }),
    ).rejects.toThrow('Payroll cutoff is no longer REOPENED');

    expect(fixture.updateManyPayrollRunMock).not.toHaveBeenCalled();

    expect(fixture.createPayrollRunMock).not.toHaveBeenCalled();

    expect(fixture.recordSuccessInTransactionMock).not.toHaveBeenCalled();
  });

  it('rejects regeneration when the pending payroll run changes concurrently', async () => {
    const fixture = createFixture();

    fixture.findFirstPayrollRunMock.mockResolvedValue({
      id: 'payroll-run-v1',

      version: 1,

      status: PayrollRunStatus.REOPENED_PENDING_REGENERATION,
    });

    fixture.updateManyPayrollCutoffMock.mockResolvedValue({
      count: 1,
    });

    fixture.updateManyPayrollRunMock.mockResolvedValue({
      count: 0,
    });

    await expect(
      fixture.service.regeneratePayroll({
        companyId: 'company-1',

        payrollCutoffId: 'cutoff-1',

        actorUserId,
      }),
    ).rejects.toThrow(
      'Previous payroll run changed while regeneration was being processed.',
    );

    expect(fixture.createPayrollRunMock).not.toHaveBeenCalled();

    expect(fixture.recordSuccessInTransactionMock).not.toHaveBeenCalled();
  });

  it('does not write a regeneration success audit when new-version persistence fails', async () => {
    const fixture = createFixture();

    fixture.findFirstPayrollRunMock.mockResolvedValue({
      id: 'payroll-run-v1',

      version: 1,

      status: PayrollRunStatus.REOPENED_PENDING_REGENERATION,
    });

    fixture.updateManyPayrollCutoffMock.mockResolvedValue({
      count: 1,
    });

    fixture.updateManyPayrollRunMock.mockResolvedValue({
      count: 1,
    });

    fixture.createPayrollRunMock.mockRejectedValue(
      new Error('Synthetic regeneration persistence failure.'),
    );

    await expect(
      fixture.service.regeneratePayroll({
        companyId: 'company-1',

        payrollCutoffId: 'cutoff-1',

        actorUserId,
      }),
    ).rejects.toThrow('Synthetic regeneration persistence failure.');

    expect(fixture.recordSuccessInTransactionMock).not.toHaveBeenCalled();
  });
});
