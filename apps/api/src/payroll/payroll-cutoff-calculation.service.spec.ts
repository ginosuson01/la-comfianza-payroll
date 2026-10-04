import { PayrollCutoffStatus } from '@payroll/database';

import {
  summarizeAttendance,
  type EmployeePayrollTreatmentOptions,
} from '@payroll/payroll-engine';

import {
  type PayrollCalculationService,
  type PayrollEmployeeCalculationResult,
} from './payroll-calculation.service';

import type { PhilippineGovernmentContributionOrchestrationService } from './philippine-government-contribution-orchestration.service';

import {
  PayrollCutoffCalculationService,
  type EmployeeTreatmentOptionsByEmployeeId,
} from './payroll-cutoff-calculation.service';

import type {
  PayrollCutoffInputCollection,
  PayrollCutoffInputService,
} from './payroll-cutoff-input.service';

import type { PayrollEmployeeInputAssembly } from './payroll-input.service';

function createAssembly(
  employeeId: string,
  employeeNumber: string,
): PayrollEmployeeInputAssembly {
  return {
    companyId: 'company-1',

    payrollCutoffId: 'cutoff-1',

    dtrId: `dtr-${employeeId}`,

    employmentStartDate: '2026-08-01',

    cutoff: {
      id: 'cutoff-1',

      startDate: '2026-09-01',

      endDate: '2026-09-15',

      payDate: '2026-09-25',
    },

    positionSnapshot: 'Crew',

    departmentSnapshot: 'Operations',

    compensationSource: 'EMPLOYEE_OVERRIDE',

    input: {
      employeeId,

      employmentRecordId: `employment-${employeeId}`,

      employeeNumber,

      employeeName: `Employee ${employeeNumber}`,

      payrollStatus: 'ACTIVE',

      payoutMethod: 'CASH',

      payoutAccountLast4: null,

      payBasis: 'DAILY',

      baseRate: '600.0000',

      attendance: summarizeAttendance([]),

      recurringItems: [],

      adjustments: [],

      contributionConfig: null,

      taxConfig: null,

      config: {
        companyPayrollSetupVersionId: 'setup-version-1',

        version: 1,

        standardWorkMinutesPerDay: 480,

        configSnapshot: {
          test: true,
        },
      },
    },
  };
}

function createCollection(
  employees: PayrollEmployeeInputAssembly[],
): PayrollCutoffInputCollection {
  return {
    companyId: 'company-1',

    payrollCutoffId: 'cutoff-1',

    cutoff: {
      id: 'cutoff-1',

      startDate: '2026-09-01',

      endDate: '2026-09-15',

      payDate: '2026-09-25',

      status: PayrollCutoffStatus.OPEN,
    },

    ready: true,

    eligibleEmployeeCount: employees.length,

    assembledEmployeeCount: employees.length,

    issues: [],

    employees,
  };
}

function createReadyCalculation(
  assembly: PayrollEmployeeInputAssembly,

  values: {
    grossPay: string;

    netPay: string;

    payableAmount: string;

    cashPayout: string;

    atmPayout: string;

    heldAmount: string;
  },
): PayrollEmployeeCalculationResult {
  return {
    companyId: assembly.companyId,

    payrollCutoffId: assembly.payrollCutoffId,

    dtrId: assembly.dtrId,

    employeeId: assembly.input.employeeId,

    employmentRecordId: assembly.input.employmentRecordId,

    employeeNumber: assembly.input.employeeNumber,

    employeeName: assembly.input.employeeName,

    positionSnapshot: assembly.positionSnapshot,

    departmentSnapshot: assembly.departmentSnapshot,

    payrollStatus: assembly.input.payrollStatus,

    payoutMethod: assembly.input.payoutMethod,

    payoutAccountLast4: assembly.input.payoutAccountLast4,

    payBasis: assembly.input.payBasis,

    baseRate: assembly.input.baseRate,

    compensationSource: assembly.compensationSource,

    ready: true,

    statutoryConfig: {
      ready: true,

      issues: [],

      options: {},
    },

    calculation: {
      status: 'COMPLETE',

      corePayroll: {
        grossPay: values.grossPay,
      },

      netPayBeforeStatusTreatment: values.netPay,

      issues: [],
    } as unknown as NonNullable<
      PayrollEmployeeCalculationResult['calculation']
    >,

    treatment: {
      status: 'COMPLETE',

      issues: [],

      payableAmount: values.payableAmount,

      cashPayout: values.cashPayout,

      atmPayout: values.atmPayout,

      heldAmount: values.heldAmount,
    } as unknown as NonNullable<PayrollEmployeeCalculationResult['treatment']>,
  };
}

function createFixture(collection: PayrollCutoffInputCollection) {
  const cutoffInput = {
    collectCutoffInputs: jest.fn().mockResolvedValue(collection),
  };

  const calculation = {
    calculateEmployee: jest.fn(),

    calculateEmployeeWithContributionOverride: jest.fn(),
  };

  /*
   * Existing cutoff-calculation tests use FIRST-cutoff fixtures.
   *
   * Until FIRST-cutoff PH contribution orchestration is wired,
   * UNSUPPORTED_CUTOFF_POSITION intentionally exercises the
   * existing generic calculation path.
   */
  const philippineContributions = {
    resolveSecondCutoff: jest.fn().mockResolvedValue({
      ready: false,

      cutoffPosition: 'FIRST',

      corePayroll: null,

      monthlyBasis: null,

      contributions: [],

      issues: [
        {
          code: 'UNSUPPORTED_CUTOFF_POSITION',

          message: 'Synthetic FIRST-cutoff fallback.',
        },
      ],
    }),
  };

  const service = new PayrollCutoffCalculationService(
    cutoffInput as unknown as PayrollCutoffInputService,

    calculation as unknown as PayrollCalculationService,

    philippineContributions as unknown as PhilippineGovernmentContributionOrchestrationService,
  );

  return {
    cutoffInput,
    calculation,
    philippineContributions,
    service,
  };
}

describe('PayrollCutoffCalculationService', () => {
  it('calculates every employee and produces exact cutoff totals', async () => {
    const employee1 = createAssembly('employee-1', 'EMP-001');

    const employee2 = createAssembly('employee-2', 'EMP-002');

    const { calculation, service } = createFixture(
      createCollection([employee1, employee2]),
    );

    calculation.calculateEmployee
      .mockReturnValueOnce(
        createReadyCalculation(employee1, {
          grossPay: '600.00',

          netPay: '550.00',

          payableAmount: '550.00',

          cashPayout: '550.00',

          atmPayout: '0.00',

          heldAmount: '0.00',
        }),
      )
      .mockReturnValueOnce(
        createReadyCalculation(employee2, {
          grossPay: '800.00',

          netPay: '700.00',

          payableAmount: '500.00',

          cashPayout: '0.00',

          atmPayout: '500.00',

          heldAmount: '200.00',
        }),
      );

    const result = await service.calculateCutoffPreflight(
      'company-1',
      'cutoff-1',
    );

    expect(result.ready).toBe(true);

    expect(result.calculatedEmployeeCount).toBe(2);

    expect(result.companyPayrollSetupVersionId).toBe('setup-version-1');

    expect(result.totals).toEqual({
      totalGross: '1400.00',

      totalNetBeforeStatusTreatment: '1250.00',

      totalPayable: '1050.00',

      cashPayoutTotal: '550.00',

      atmPayoutTotal: '500.00',

      heldAmountTotal: '200.00',
    });
  });

  it('does not calculate a partial cutoff when input readiness fails', async () => {
    const employee = createAssembly('employee-1', 'EMP-001');

    const collection = createCollection([employee]);

    collection.ready = false;

    collection.assembledEmployeeCount = 0;

    collection.employees = [];

    collection.issues = [
      {
        code: 'MISSING_DTR',

        employeeId: 'employee-1',

        employeeNumber: 'EMP-001',

        message: 'Employee EMP-001 does not have a DTR.',
      },
    ];

    const { calculation, service } = createFixture(collection);

    const result = await service.calculateCutoffPreflight(
      'company-1',
      'cutoff-1',
    );

    expect(result.ready).toBe(false);

    expect(result.calculatedEmployeeCount).toBe(0);

    expect(result.totals).toBeNull();

    expect(calculation.calculateEmployee).not.toHaveBeenCalled();
  });

  it('blocks cutoff generation when one employee calculation is incomplete', async () => {
    const employee = createAssembly('employee-1', 'EMP-001');

    const { calculation, service } = createFixture(
      createCollection([employee]),
    );

    calculation.calculateEmployee.mockReturnValue({
      ...createReadyCalculation(employee, {
        grossPay: '600.00',

        netPay: '600.00',

        payableAmount: '600.00',

        cashPayout: '600.00',

        atmPayout: '0.00',

        heldAmount: '0.00',
      }),

      ready: false,

      treatment: {
        status: 'INCOMPLETE',

        issues: [
          {
            code: 'ACTIVE_HOLD_RULE_REQUIRED',

            message: 'ACTIVE_HOLD payout treatment requires an approved rule.',

            metadata: null,
          },
        ],
      },
    });

    const result = await service.calculateCutoffPreflight(
      'company-1',
      'cutoff-1',
    );

    expect(result.ready).toBe(false);

    expect(result.totals).toBeNull();

    expect(result.calculationIssues).toEqual([
      expect.objectContaining({
        code: 'EMPLOYEE_CALCULATION_INCOMPLETE',

        employeeId: 'employee-1',

        employeeNumber: 'EMP-001',
      }),
    ]);
  });

  it('passes employee-specific treatment options to calculation', async () => {
    const employee = createAssembly('employee-1', 'EMP-001');

    const { calculation, service } = createFixture(
      createCollection([employee]),
    );

    calculation.calculateEmployee.mockReturnValue(
      createReadyCalculation(employee, {
        grossPay: '600.00',

        netPay: '600.00',

        payableAmount: '200.00',

        cashPayout: '200.00',

        atmPayout: '0.00',

        heldAmount: '400.00',
      }),
    );

    const options: EmployeePayrollTreatmentOptions = {
      activeHold: {
        payableAmount: '200.00',

        heldAmount: '400.00',

        reason: 'Synthetic approved hold.',
      },
    };

    const optionsByEmployee: EmployeeTreatmentOptionsByEmployeeId = {
      'employee-1': options,
    };

    await service.calculateCutoffPreflight(
      'company-1',
      'cutoff-1',
      optionsByEmployee,
    );

    expect(calculation.calculateEmployee).toHaveBeenCalledWith(
      employee,
      options,
    );
  });
  it('uses Philippine contribution and withholding overrides when SECOND-cutoff statutory inputs are resolved', async () => {
    const employee = createAssembly('employee-1', 'EMP-001');

    employee.payrollCutoffId = 'cutoff-2';

    employee.cutoff = {
      id: 'cutoff-2',

      startDate: '2026-09-16',

      endDate: '2026-09-30',

      payDate: '2026-10-10',
    };

    employee.input.baseRate = '650.0000';

    employee.input.config.configSnapshot = {
      statutory: {
        minimumWage: {
          regionCode: 'IVA',

          wageOrderCode: 'SYNTHETIC-WAGE-ORDER',

          areaClassification: 'Synthetic area classification',

          sector: 'Synthetic sector',

          dailyRate: '600.00',

          rateEffectiveFrom: '2026-01-01',
        },
      },
    };

    const { calculation, philippineContributions, service } = createFixture(
      createCollection([employee]),
    );

    const contributions = [
      {
        treatment: 'APPLY',

        code: 'SSS',

        description: 'SSS Contribution',

        basisAmount: '5000.00',

        rule: {
          method: 'FIXED_AMOUNT',

          employeeAmount: '250.00',

          employerAmount: '510.00',
        },
      },

      {
        treatment: 'DEFERRED',

        code: 'PHILHEALTH',

        description: 'PhilHealth Contribution',

        reason: 'Collected on FIRST cutoff.',
      },

      {
        treatment: 'DEFERRED',

        code: 'PAGIBIG',

        description: 'Pag-IBIG Contribution',

        reason: 'Collected on FIRST cutoff.',
      },
    ] as const;

    const corePayroll = {
      status: 'COMPLETE',

      lineItems: [
        {
          category: 'EARNING',

          code: 'BASIC_PAY',

          description: 'Basic Pay',

          quantity: '1.0000',

          rate: '650.0000',

          amount: '650.00',

          taxable: null,

          metadata: {
            source: 'ATTENDANCE_REGULAR_MINUTES',
          },
        },
      ],
    };

    philippineContributions.resolveSecondCutoff.mockResolvedValue({
      ready: true,

      cutoffPosition: 'SECOND',

      corePayroll,

      monthlyBasis: null,

      contributions,

      issues: [],
    });

    calculation.calculateEmployeeWithContributionOverride.mockReturnValue(
      createReadyCalculation(employee, {
        grossPay: '650.00',

        netPay: '400.00',

        payableAmount: '400.00',

        cashPayout: '400.00',

        atmPayout: '0.00',

        heldAmount: '0.00',
      }),
    );

    const result = await service.calculateCutoffPreflight(
      'company-1',
      'cutoff-1',
    );

    expect(result.ready).toBe(true);

    expect(
      calculation.calculateEmployeeWithContributionOverride,
    ).toHaveBeenCalledWith(employee, contributions, {}, expect.any(Function));

    expect(calculation.calculateEmployee).not.toHaveBeenCalled();
  });

  it('blocks SECOND-cutoff calculation when Philippine withholding policy is unresolved', async () => {
    const employee = createAssembly('employee-1', 'EMP-001');

    employee.payrollCutoffId = 'cutoff-2';

    employee.cutoff = {
      id: 'cutoff-2',

      startDate: '2026-09-16',

      endDate: '2026-09-30',

      payDate: '2026-10-10',
    };

    /*
     * Deliberately leave the synthetic setup without a
     * minimum-wage reference.
     */
    employee.input.config.configSnapshot = {
      test: true,
    };

    const { calculation, philippineContributions, service } = createFixture(
      createCollection([employee]),
    );

    philippineContributions.resolveSecondCutoff.mockResolvedValue({
      ready: true,

      cutoffPosition: 'SECOND',

      corePayroll: {
        status: 'COMPLETE',

        lineItems: [
          {
            category: 'EARNING',

            code: 'BASIC_PAY',

            description: 'Basic Pay',

            quantity: '1.0000',

            rate: '600.0000',

            amount: '600.00',

            taxable: null,

            metadata: {
              source: 'ATTENDANCE_REGULAR_MINUTES',
            },
          },
        ],
      },

      monthlyBasis: null,

      contributions: [],

      issues: [],
    });

    const result = await service.calculateCutoffPreflight(
      'company-1',
      'cutoff-1',
    );

    expect(result.ready).toBe(false);

    expect(result.calculatedEmployeeCount).toBe(0);

    expect(result.calculationIssues).toEqual([
      expect.objectContaining({
        code: 'EMPLOYEE_CALCULATION_INCOMPLETE',

        employeeId: 'employee-1',

        employeeNumber: 'EMP-001',
      }),
    ]);

    expect(
      calculation.calculateEmployeeWithContributionOverride,
    ).not.toHaveBeenCalled();

    expect(calculation.calculateEmployee).not.toHaveBeenCalled();
  });

  it('blocks SECOND-cutoff calculation when SSS monthly remuneration history is incomplete', async () => {
    const employee = createAssembly('employee-1', 'EMP-001');

    const { calculation, philippineContributions, service } = createFixture(
      createCollection([employee]),
    );

    philippineContributions.resolveSecondCutoff.mockResolvedValue({
      ready: false,

      cutoffPosition: 'SECOND',

      corePayroll: null,

      monthlyBasis: null,

      contributions: [],

      issues: [
        {
          code: 'SSS_MONTHLY_BASIS_INCOMPLETE',

          message:
            'Prior statutory-month remuneration is expected, but no prior locked payroll or explicit opening gross pay is available.',
        },
      ],
    });

    const result = await service.calculateCutoffPreflight(
      'company-1',
      'cutoff-1',
    );

    expect(result.ready).toBe(false);

    expect(result.calculatedEmployeeCount).toBe(0);

    expect(result.calculationIssues).toEqual([
      {
        code: 'EMPLOYEE_CALCULATION_INCOMPLETE',

        employeeId: 'employee-1',

        employeeNumber: 'EMP-001',

        message:
          'Prior statutory-month remuneration is expected, but no prior locked payroll or explicit opening gross pay is available.',
      },
    ]);

    expect(
      calculation.calculateEmployeeWithContributionOverride,
    ).not.toHaveBeenCalled();

    expect(calculation.calculateEmployee).not.toHaveBeenCalled();
  });
});
