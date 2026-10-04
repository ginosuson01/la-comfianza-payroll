import {
  summarizeAttendance,
  type GovernmentContributionResolution,
  type StatutoryPayrollTaxResolverContext,
} from '@payroll/payroll-engine';

import { PayrollCalculationService } from './payroll-calculation.service';

import type { PayrollEmployeeInputAssembly } from './payroll-input.service';

import { PayrollStatutoryConfigService } from './payroll-statutory-config.service';

function createAssembly(taxConfigured = true): PayrollEmployeeInputAssembly {
  return {
    companyId: 'company-1',

    payrollCutoffId: 'cutoff-2',

    dtrId: 'dtr-1',

    employmentStartDate: '2026-09-18',

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

      attendance: summarizeAttendance([
        {
          workDate: '2026-09-16',

          regularMinutes: 480,

          lateMinutes: 0,

          undertimeMinutes: 0,

          absenceMinutes: 0,

          leaveMinutes: 0,

          nightDifferentialMinutes: 0,

          restDay: false,

          leaveType: null,

          holiday: null,

          overtimeEntries: [],
        },
      ]),

      recurringItems: [],

      adjustments: [],

      contributionConfig: null,

      taxConfig: taxConfigured
        ? {
            treatment: 'NOT_APPLICABLE',

            reason: 'Synthetic focused test.',
          }
        : null,

      config: {
        companyPayrollSetupVersionId: 'setup-version-2',

        version: 2,

        standardWorkMinutesPerDay: 480,

        configSnapshot: {},
      },
    },
  };
}

function createContributions(): readonly GovernmentContributionResolution[] {
  return [
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
  ];
}

describe('PayrollCalculationService contribution override', () => {
  const statutoryConfig = new PayrollStatutoryConfigService();

  const service = new PayrollCalculationService(statutoryConfig);

  it('calculates payroll from Philippine policy-resolved contributions without legacy contribution config', () => {
    const result = service.calculateEmployeeWithContributionOverride(
      createAssembly(),
      createContributions(),
    );

    expect(result.ready).toBe(true);

    expect(result.statutoryConfig.ready).toBe(true);

    expect(result.calculation?.corePayroll.grossPay).toBe('600.00');

    expect(result.calculation?.governmentContributionsTotal).toBe('250.00');

    expect(result.calculation?.netPayBeforeStatusTreatment).toBe('350.00');

    expect(result.treatment?.payableAmount).toBe('350.00');

    expect(result.treatment?.cashPayout).toBe('350.00');
  });

  it('calculates with an authoritative late tax resolver without legacy tax config', () => {
    const taxResolver = jest.fn(
      (context: StatutoryPayrollTaxResolverContext) => {
        expect(context.corePayroll.grossPay).toBe('600.00');

        expect(context.governmentContributionsTotal).toBe('250.00');

        expect(context.employerGovernmentContributionsTotal).toBe('510.00');

        return {
          treatment: 'NOT_APPLICABLE' as const,

          reason: 'Synthetic late tax resolution.',
        };
      },
    );

    const result = service.calculateEmployeeWithContributionOverride(
      createAssembly(false),

      createContributions(),

      {},

      taxResolver,
    );

    expect(taxResolver).toHaveBeenCalledTimes(1);

    expect(result.ready).toBe(true);

    expect(result.statutoryConfig.ready).toBe(true);

    expect(result.statutoryConfig.options.tax).toBeUndefined();

    expect(result.statutoryConfig.options.taxResolver).toBe(taxResolver);

    expect(result.calculation?.corePayroll.grossPay).toBe('600.00');

    expect(result.calculation?.governmentContributionsTotal).toBe('250.00');

    expect(result.calculation?.withholdingTax).toBe('0.00');

    expect(result.calculation?.netPayBeforeStatusTreatment).toBe('350.00');

    expect(result.treatment?.payableAmount).toBe('350.00');
  });

  it('still blocks the calculation when withholding tax treatment is unresolved', () => {
    const result = service.calculateEmployeeWithContributionOverride(
      createAssembly(false),

      createContributions(),
    );

    expect(result.ready).toBe(false);

    expect(result.calculation).toBeNull();

    expect(result.statutoryConfig.issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_EMPLOYEE_TAX_TREATMENT',
      }),
    ]);
  });
});
