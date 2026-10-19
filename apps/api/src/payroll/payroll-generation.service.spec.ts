import {
  PayrollCutoffStatus,
  PayrollLineCategory,
  PayrollRunStatus,
} from '@payroll/database';

import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../database/prisma.service';

import type {
  PayrollCutoffCalculationPreflight,
  PayrollCutoffCalculationService,
} from './payroll-cutoff-calculation.service';

import { PayrollGenerationService } from './payroll-generation.service';

function createReadyPreflight(): PayrollCutoffCalculationPreflight {
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

      status: PayrollCutoffStatus.OPEN,
    },

    ready: true,

    eligibleEmployeeCount: 1,

    calculatedEmployeeCount: 1,

    inputIssues: [],

    calculationIssues: [],

    companyPayrollSetupVersionId: 'setup-version-1',

    configSnapshot: {
      test: true,
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

          lineItems: [
            {
              category: 'EARNING',

              code: 'BASIC_PAY',

              description: 'Basic Pay',

              quantity: null,

              rate: null,

              amount: '600.00',

              taxable: true,

              metadata: {
                source: 'synthetic-test',
              },
            },
          ],
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
  preflight: PayrollCutoffCalculationPreflight = createReadyPreflight(),
) {
  const transaction = {
    $queryRaw: jest.fn().mockResolvedValue([
      {
        id: preflight.payrollCutoffId,

        status: preflight.cutoff.status,
      },
    ]),

    payrollRun: {
      findFirst: jest.fn(),

      create: jest.fn(),
    },

    payrollCutoff: {
      updateMany: jest.fn<
        Promise<{ count: number }>,
        [
          {
            where: {
              id: string;

              companyId: string;

              status: PayrollCutoffStatus;
            };

            data: {
              status: PayrollCutoffStatus;

              lockedAt: Date;
            };
          },
        ]
      >(),
    },

    payrollRunEmployee: {
      create: jest.fn(),
    },

    payrollLineItem: {
      createMany: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(
      async (
        callback: (transactionClient: typeof transaction) => Promise<unknown>,
      ) => callback(transaction),
    ),
  };

  const auditLog = {
    recordSuccessInTransaction: jest.fn(),
  };

  const cutoffCalculation = {
    calculateCutoffPreflight: jest.fn().mockResolvedValue(preflight),
  };

  const service = new PayrollGenerationService(
    prisma as unknown as PrismaService,

    auditLog as unknown as AuditLogService,

    cutoffCalculation as unknown as PayrollCutoffCalculationService,
  );

  return {
    service,

    transaction,

    prisma,

    auditLog,

    cutoffCalculation,
  };
}

describe('PayrollGenerationService', () => {
  it('persists an initial payroll run atomically after successful preflight', async () => {
    const { service, transaction, auditLog, cutoffCalculation } =
      createFixture();

    transaction.payrollRun.findFirst.mockResolvedValue(null);

    transaction.payrollCutoff.updateMany.mockResolvedValue({
      count: 1,
    });

    transaction.payrollRun.create.mockResolvedValue({
      id: 'payroll-run-1',

      companyId: 'company-1',

      payrollCutoffId: 'cutoff-1',

      version: 1,

      status: PayrollRunStatus.CURRENT_LOCKED,
    });

    transaction.payrollRunEmployee.create.mockResolvedValue({
      id: 'payroll-run-employee-1',
    });

    transaction.payrollLineItem.createMany.mockResolvedValue({
      count: 1,
    });

    auditLog.recordSuccessInTransaction.mockResolvedValue(undefined);

    const result = await service.generateInitialPayroll({
      companyId: 'company-1',

      payrollCutoffId: 'cutoff-1',

      actorUserId: 'user-1',
    });

    expect(cutoffCalculation.calculateCutoffPreflight).toHaveBeenCalledWith(
      'company-1',
      'cutoff-1',
      {},
    );

    expect(cutoffCalculation.calculateCutoffPreflight).toHaveBeenCalledTimes(2);

    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);

    expect(transaction.payrollRun.findFirst).toHaveBeenCalledWith({
      where: {
        payrollCutoffId: 'cutoff-1',
      },

      select: {
        id: true,
        version: true,
        status: true,
      },
    });

    expect(transaction.payrollCutoff.updateMany).toHaveBeenCalledTimes(1);

    const cutoffUpdate =
      transaction.payrollCutoff.updateMany.mock.calls[0]?.[0];

    expect(cutoffUpdate).toBeDefined();

    expect(cutoffUpdate?.where).toEqual({
      id: 'cutoff-1',

      companyId: 'company-1',

      status: PayrollCutoffStatus.OPEN,
    });

    expect(cutoffUpdate?.data.status).toBe(PayrollCutoffStatus.LOCKED);

    expect(cutoffUpdate?.data.lockedAt).toBeInstanceOf(Date);

    expect(transaction.payrollRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',

        payrollCutoffId: 'cutoff-1',

        companyPayrollSetupVersionId: 'setup-version-1',

        version: 1,

        status: PayrollRunStatus.CURRENT_LOCKED,

        generatedByUserId: 'user-1',

        companySnapshot: {
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

        totalGross: '750.00',

        totalNet: '690.00',

        clientPayableGross: null,

        cashPayoutTotal: '690.00',

        atmPayoutTotal: '0.00',

        activeHoldTotal: '0.00',
      }) as unknown,

      select: {
        id: true,

        companyId: true,

        payrollCutoffId: true,

        version: true,

        status: true,
      },
    });

    expect(transaction.payrollRunEmployee.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payrollRunId: 'payroll-run-1',

        employeeId: 'employee-1',

        employmentRecordId: 'employment-1',

        employeeNumberSnapshot: 'EMP-001',

        employeeNameSnapshot: 'Juan Dela Cruz',

        positionSnapshot: 'Crew',

        departmentSnapshot: 'Operations',

        payrollStatusSnapshot: 'ACTIVE',

        payoutMethodSnapshot: 'CASH',

        payoutAccountLast4Snapshot: null,

        payBasisSnapshot: 'DAILY',

        baseRateSnapshot: '600.0000',

        compensationSourceSnapshot: 'EMPLOYEE_OVERRIDE',

        basicPay: '600.00',

        allowancesTotal: '100.00',

        premiumPayTotal: '50.00',

        grossPay: '750.00',

        governmentContributionsTotal: '30.00',

        taxTotal: '10.00',

        otherDeductionsTotal: '20.00',

        totalDeductions: '60.00',

        netPay: '690.00',

        cashPayout: '690.00',

        atmPayout: '0.00',

        heldAmount: '0.00',

        clientPayableGross: null,

        taxableCompensation: '750.00',

        withholdingTax: '10.00',

        thirteenthMonthPay: '0.00',

        lastPayAmount: '0.00',

        isLastPay: false,
      }) as unknown,

      select: {
        id: true,
      },
    });

    expect(transaction.payrollLineItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          payrollRunEmployeeId: 'payroll-run-employee-1',

          category: PayrollLineCategory.EARNING,

          code: 'BASIC_PAY',

          description: 'Basic Pay',

          quantity: null,

          rate: null,

          amount: '600.00',

          sequence: 1,

          metadata: {
            source: 'synthetic-test',

            taxable: true,
          },
        },
      ],
    });

    expect(auditLog.recordSuccessInTransaction).toHaveBeenCalledWith(
      transaction,

      expect.objectContaining({
        actorUserId: 'user-1',

        companyId: 'company-1',

        action: 'PAYROLL_GENERATED',

        module: 'PAYROLL',

        entityType: 'PAYROLL_RUN',

        entityId: 'payroll-run-1',
      }),
    );

    expect(result).toEqual({
      id: 'payroll-run-1',

      companyId: 'company-1',

      payrollCutoffId: 'cutoff-1',

      version: 1,

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

  it('does not start persistence when cutoff preflight is incomplete', async () => {
    const incomplete = createReadyPreflight();

    incomplete.ready = false;

    incomplete.totals = null;

    const { service, prisma } = createFixture(incomplete);

    await expect(
      service.generateInitialPayroll({
        companyId: 'company-1',

        payrollCutoffId: 'cutoff-1',

        actorUserId: 'user-1',
      }),
    ).rejects.toThrow('Payroll cutoff is not ready for generation.');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects initial generation when a payroll run already exists', async () => {
    const { service, transaction, auditLog } = createFixture();

    transaction.payrollRun.findFirst.mockResolvedValue({
      id: 'existing-run',

      version: 1,

      status: PayrollRunStatus.CURRENT_LOCKED,
    });

    await expect(
      service.generateInitialPayroll({
        companyId: 'company-1',

        payrollCutoffId: 'cutoff-1',

        actorUserId: 'user-1',
      }),
    ).rejects.toThrow('Payroll cutoff already has payroll run version 1.');

    expect(transaction.payrollCutoff.updateMany).not.toHaveBeenCalled();

    expect(transaction.payrollRun.create).not.toHaveBeenCalled();

    expect(auditLog.recordSuccessInTransaction).not.toHaveBeenCalled();
  });

  it('rejects generation if the cutoff is no longer OPEN inside the transaction', async () => {
    const { service, transaction, auditLog } = createFixture();

    transaction.payrollRun.findFirst.mockResolvedValue(null);

    transaction.payrollCutoff.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.generateInitialPayroll({
        companyId: 'company-1',

        payrollCutoffId: 'cutoff-1',

        actorUserId: 'user-1',
      }),
    ).rejects.toThrow('Payroll cutoff is no longer OPEN');

    expect(transaction.payrollRun.create).not.toHaveBeenCalled();

    expect(auditLog.recordSuccessInTransaction).not.toHaveBeenCalled();
  });

  it('does not write the success audit when payroll persistence fails', async () => {
    const { service, transaction, auditLog } = createFixture();

    transaction.payrollRun.findFirst.mockResolvedValue(null);

    transaction.payrollCutoff.updateMany.mockResolvedValue({
      count: 1,
    });

    transaction.payrollRun.create.mockResolvedValue({
      id: 'payroll-run-1',

      companyId: 'company-1',

      payrollCutoffId: 'cutoff-1',

      version: 1,

      status: PayrollRunStatus.CURRENT_LOCKED,
    });

    transaction.payrollRunEmployee.create.mockRejectedValue(
      new Error('Synthetic payroll persistence failure.'),
    );

    await expect(
      service.generateInitialPayroll({
        companyId: 'company-1',

        payrollCutoffId: 'cutoff-1',

        actorUserId: 'user-1',
      }),
    ).rejects.toThrow('Synthetic payroll persistence failure.');

    expect(auditLog.recordSuccessInTransaction).not.toHaveBeenCalled();
  });
});
