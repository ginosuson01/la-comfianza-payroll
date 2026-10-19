import type { CorePayrollCalculationResult } from '@payroll/payroll-engine';

import { createValidGoldenPayrollTemplateConfig } from '../companies/golden-payroll-template.test-fixture';
import type { PayrollCalculationService } from './payroll-calculation.service';

import type { PayrollCutoffPeriodService } from './payroll-cutoff-period.service';

import type { PayrollEmployeeInputAssembly } from './payroll-input.service';

import type {
  PayrollMonthlyStatutoryBasis,
  PayrollMonthlyStatutoryBasisService,
} from './payroll-monthly-statutory-basis.service';

import { PhilippineGovernmentContributionOrchestrationService } from './philippine-government-contribution-orchestration.service';

function createAssembly(
  employmentStartDate: string,
): PayrollEmployeeInputAssembly {
  return {
    companyId: 'company-1',

    payrollCutoffId: 'cutoff-2',

    dtrId: 'dtr-1',

    employmentStartDate,

    cutoff: {
      id: 'cutoff-2',

      startDate: '2026-09-16',

      endDate: '2026-09-30',

      payDate: '2026-10-10',
    },

    positionSnapshot: 'Crew',

    departmentSnapshot: 'Operations',

    compensationSource: 'EMPLOYEE_OVERRIDE',

    input: {
      employeeId: 'employee-1',

      employmentRecordId: 'employment-1',

      employeeNumber: 'EMP-001',

      employeeName: 'Juan Dela Cruz',

      payrollStatus: 'ACTIVE',

      payoutMethod: 'CASH',

      payoutAccountLast4: null,

      payBasis: 'DAILY',

      baseRate: '600.0000',

      attendance: {
        entryCount: 0,

        restDayEntryCount: 0,

        holidayEntryCount: 0,

        regularMinutes: 0,

        lateMinutes: 0,

        undertimeMinutes: 0,

        absenceMinutes: 0,

        leaveMinutes: 0,

        overtimeMinutes: 0,

        nightDifferentialMinutes: 0,

        workedMinutes: 0,

        restDayWorkedMinutes: 0,

        leaveBreakdown: [],

        overtimeBreakdown: [],

        holidayBreakdown: [],

        premiumWorkBreakdown: [],
      },

      recurringItems: [],

      adjustments: [],

      contributionConfig: null,

      taxConfig: null,

      config: {
        companyPayrollSetupVersionId: 'setup-version-2',

        version: 2,

        standardWorkMinutesPerDay: 480,

        configSnapshot: JSON.parse(
          JSON.stringify(createValidGoldenPayrollTemplateConfig()),
        ) as Record<string, unknown>,
      },
    },
  };
}

function createCorePayroll(
  basicPay: string,

  grossPay: string,
): CorePayrollCalculationResult {
  return {
    employeeId: 'employee-1',

    employmentRecordId: 'employment-1',

    payrollStatus: 'ACTIVE',

    payoutMethod: 'CASH',

    status: 'COMPLETE',

    issues: [],

    basicPay,

    paidLeaveEarningsTotal: '0.00',

    allowancesTotal: '0.00',

    taxableAllowancesTotal: '0.00',

    earningAdjustmentsTotal: '0.00',

    premiumPayTotal: '0.00',

    grossPay,

    attendanceDeductionsTotal: '0.00',

    fixedDeductionsTotal: '0.00',

    deductionAdjustmentsTotal: '0.00',

    otherDeductionsTotal: '0.00',

    preContributionTaxPay: grossPay,

    lineItems: [],
  };
}

function createMonthlyBasis(
  grossPay: string,

  priorLockedRunCount: number,
): PayrollMonthlyStatutoryBasis {
  return {
    referenceMonth: '2026-09',

    monthStart: '2026-09-01',

    nextMonthStart: '2026-10-01',

    openingProvided: false,

    openingGrossPayProvided: false,

    openingPagIbigMonthlyCompensationProvided: false,

    opening: {
      basicPay: '0.00',

      grossPay: '0.00',

      pagIbigMonthlyCompensation: '0.00',

      contributionAmounts: {
        SSS: '0.00',

        PHILHEALTH: '0.00',

        PAGIBIG: '0.00',
      },
    },

    priorLockedRuns: Array.from(
      {
        length: priorLockedRunCount,
      },

      (_, index) => ({
        payrollRunId: `run-${index + 1}`,

        payrollCutoffId: `prior-cutoff-${index + 1}`,

        version: 1,

        cutoff: {
          startDate: '2026-09-01',

          endDate: '2026-09-15',

          payDate: '2026-09-25',
        },

        basicPay: '0.00',

        grossPay: '0.00',

        pagIbigMonthlyCompensation: '0.00',

        pagIbigIssues: [],

        contributionAmounts: {
          SSS: '0.00',

          PHILHEALTH: '0.00',

          PAGIBIG: '0.00',
        },
      }),
    ),

    prior: {
      basicPay: '0.00',

      grossPay: '0.00',

      pagIbigMonthlyCompensation: '0.00',

      pagIbigIssues: [],

      contributionAmounts: {
        SSS: '0.00',

        PHILHEALTH: '0.00',

        PAGIBIG: '0.00',
      },
    },

    current: {
      basicPay: grossPay,

      grossPay,

      pagIbigMonthlyCompensation: null,
    },

    monthly: {
      basicPay: grossPay,

      grossPay,

      pagIbigMonthlyCompensation: null,

      pagIbigIssues: [
        'Current cutoff Pag-IBIG monthly compensation has not been resolved.',
      ],

      contributionAmountsAlreadyCollected: {
        SSS: '0.00',

        PHILHEALTH: '0.00',

        PAGIBIG: '0.00',
      },
    },
  };
}

describe('PhilippineGovernmentContributionOrchestrationService', () => {
  const calculateEmployeeCore = jest.fn();

  const resolveCutoffPeriod = jest.fn();

  const resolveMonthlyBasis = jest.fn();

  const calculation = {
    calculateEmployeeCore,
  } as unknown as PayrollCalculationService;

  const cutoffPeriod = {
    resolve: resolveCutoffPeriod,
  } as unknown as PayrollCutoffPeriodService;

  const monthlyBasis = {
    resolve: resolveMonthlyBasis,
  } as unknown as PayrollMonthlyStatutoryBasisService;

  const service = new PhilippineGovernmentContributionOrchestrationService(
    calculation,
    cutoffPeriod,
    monthlyBasis,
  );

  beforeEach(() => {
    calculateEmployeeCore.mockReset();

    resolveCutoffPeriod.mockReset();

    resolveMonthlyBasis.mockReset();

    resolveCutoffPeriod.mockResolvedValue({
      payrollCutoffId: 'cutoff-2',

      cutoffTemplateId: 'template-1',

      position: 'SECOND',

      cutoff: {
        startDate: '2026-09-16',

        endDate: '2026-09-30',

        payDate: '2026-10-10',
      },
    });
  });

  it('resolves SSS on SECOND for an employee who started during the second cutoff', async () => {
    calculateEmployeeCore.mockReturnValue(
      createCorePayroll('2400.00', '2400.00'),
    );

    resolveMonthlyBasis.mockResolvedValue(createMonthlyBasis('2400.00', 0));

    const result = await service.resolveSecondCutoff(
      createAssembly('2026-09-18'),
    );

    expect(result.ready).toBe(true);

    expect(result.issues).toEqual([]);

    expect(resolveMonthlyBasis).toHaveBeenCalledWith(
      expect.objectContaining({
        current: {
          basicPay: '2400.00',
          grossPay: '2400.00',
          pagIbigMonthlyCompensation: '0.00',
        },
      }),
    );

    expect(result.contributions).toHaveLength(3);

    expect(result.contributions[0]).toEqual(
      expect.objectContaining({
        treatment: 'APPLY',

        code: 'SSS',

        basisAmount: '5000.00',

        rule: expect.objectContaining({
          method: 'FIXED_AMOUNT',

          employeeAmount: '250.00',
        }) as unknown,
      }),
    );

    expect(result.contributions[1]).toEqual(
      expect.objectContaining({
        treatment: 'DEFERRED',

        code: 'PHILHEALTH',
      }),
    );

    expect(result.contributions[2]).toEqual(
      expect.objectContaining({
        treatment: 'DEFERRED',

        code: 'PAGIBIG',
      }),
    );
  });

  it('preserves current Pag-IBIG classification issues without blocking SECOND-cutoff SSS', async () => {
    const corePayroll = createCorePayroll('2400.00', '2900.00');

    corePayroll.lineItems = [
      {
        category: 'EARNING',
        code: 'LEGACY_ALLOWANCE',
        description: 'Legacy Allowance',
        quantity: null,
        rate: null,
        amount: '500.00',
        taxable: false,
        metadata: {
          source: 'RECURRING_PAYROLL_ITEM',
          recurringItemKind: 'ALLOWANCE',
          pagIbigFundSalaryTreatment: null,
        },
      },
    ];

    calculateEmployeeCore.mockReturnValue(corePayroll);

    resolveMonthlyBasis.mockResolvedValue(createMonthlyBasis('2900.00', 0));

    const result = await service.resolveSecondCutoff(
      createAssembly('2026-09-18'),
    );

    expect(result.ready).toBe(true);

    expect(resolveMonthlyBasis).toHaveBeenCalledWith(
      expect.objectContaining({
        current: {
          basicPay: '2400.00',
          grossPay: '2900.00',
          pagIbigIssues: [
            'Pag-IBIG Fund Salary treatment is unresolved for recurring earning LEGACY_ALLOWANCE.',
          ],
        },
      }),
    );

    expect(result.contributions[0]).toEqual(
      expect.objectContaining({
        treatment: 'APPLY',
        code: 'SSS',
      }),
    );

    expect(result.contributions[2]).toEqual(
      expect.objectContaining({
        treatment: 'DEFERRED',
        code: 'PAGIBIG',
      }),
    );
  });

  it('blocks an employee who was already employed before SECOND when prior remuneration is missing', async () => {
    calculateEmployeeCore.mockReturnValue(
      createCorePayroll('3600.00', '3600.00'),
    );

    resolveMonthlyBasis.mockResolvedValue(createMonthlyBasis('3600.00', 0));

    const result = await service.resolveSecondCutoff(
      createAssembly('2026-08-01'),
    );

    expect(result.ready).toBe(false);

    expect(result.contributions).toEqual([]);

    expect(result.issues).toEqual([
      {
        code: 'SSS_MONTHLY_BASIS_INCOMPLETE',

        message:
          'Prior statutory-month remuneration is expected, but no prior locked payroll or explicit opening gross pay is available.',
      },
    ]);
  });

  it('uses prior locked payroll when the employee was already employed before SECOND', async () => {
    calculateEmployeeCore.mockReturnValue(
      createCorePayroll('3600.00', '3600.00'),
    );

    const basis = createMonthlyBasis('9600.00', 1);

    resolveMonthlyBasis.mockResolvedValue(basis);

    const result = await service.resolveSecondCutoff(
      createAssembly('2026-08-01'),
    );

    expect(result.ready).toBe(true);

    expect(result.contributions[0]).toEqual(
      expect.objectContaining({
        treatment: 'APPLY',

        code: 'SSS',
      }),
    );
  });

  it('does not run SECOND orchestration on the FIRST cutoff', async () => {
    resolveCutoffPeriod.mockResolvedValue({
      payrollCutoffId: 'cutoff-1',

      cutoffTemplateId: 'template-1',

      position: 'FIRST',

      cutoff: {
        startDate: '2026-09-01',

        endDate: '2026-09-15',

        payDate: '2026-09-25',
      },
    });

    calculateEmployeeCore.mockReturnValue(
      createCorePayroll('3600.00', '3600.00'),
    );

    const result = await service.resolveSecondCutoff(
      createAssembly('2026-08-01'),
    );

    expect(result.ready).toBe(false);

    expect(result.issues[0]?.code).toBe('UNSUPPORTED_CUTOFF_POSITION');

    expect(resolveMonthlyBasis).not.toHaveBeenCalled();
  });
});
