import {
  summarizeAttendance,
  type GovernmentContributionResolution,
  type PayrollCalculationInput,
} from '@payroll/payroll-engine';

import { PayrollStatutoryConfigService } from './payroll-statutory-config.service';

function createInput(
  overrides: Partial<PayrollCalculationInput> = {},
): PayrollCalculationInput {
  return {
    employeeId: 'employee-1',

    employmentRecordId: 'employment-1',

    employeeNumber: 'EMP-001',

    employeeName: 'Juan Dela Cruz',

    payrollStatus: 'ACTIVE',

    payoutMethod: 'CASH',

    payoutAccountLast4: null,

    payBasis: 'DAILY',

    baseRate: '600.0000',

    attendance: summarizeAttendance([]),

    recurringItems: [],

    adjustments: [],

    /*
     * Deliberately absent.
     *
     * Philippine government contributions are supplied by
     * the authoritative policy/orchestration layer instead.
     */
    contributionConfig: null,

    taxConfig: {
      treatment: 'NOT_APPLICABLE',

      reason: 'Synthetic focused test.',
    },

    config: {
      companyPayrollSetupVersionId: 'setup-version-2',

      version: 2,

      standardWorkMinutesPerDay: 480,

      configSnapshot: {},
    },

    ...overrides,
  };
}

function createContributionOverride(): readonly GovernmentContributionResolution[] {
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

describe('PayrollStatutoryConfigService contribution override', () => {
  const service = new PayrollStatutoryConfigService();

  it('uses authoritative contribution resolutions without requiring legacy contribution configuration', () => {
    const contributions = createContributionOverride();

    const result = service.resolveWithContributionOverride(
      createInput(),
      contributions,
    );

    expect(result.ready).toBe(true);

    expect(result.issues).toEqual([]);

    expect(result.options.contributions).toEqual(contributions);

    expect(result.options.tax).toEqual({
      treatment: 'NOT_APPLICABLE',

      reason: 'Synthetic focused test.',
    });
  });

  it('accepts an authoritative late tax resolver without legacy employee tax configuration', () => {
    const contributions = createContributionOverride();

    const taxResolver = jest.fn(() => ({
      treatment: 'NOT_APPLICABLE' as const,

      reason: 'Synthetic late tax resolution.',
    }));

    const result = service.resolveWithContributionOverride(
      createInput({
        taxConfig: null,
      }),

      contributions,

      taxResolver,
    );

    expect(result.ready).toBe(true);

    expect(result.issues).toEqual([]);

    expect(result.options.contributions).toEqual(contributions);

    expect(result.options.tax).toBeUndefined();

    expect(result.options.taxResolver).toBe(taxResolver);

    /*
     * Configuration resolution carries the callback only.
     * Statutory payroll invokes it later, after contribution
     * amounts have actually been calculated.
     */
    expect(taxResolver).not.toHaveBeenCalled();
  });

  it('still blocks when withholding-tax treatment is unresolved', () => {
    const contributions = createContributionOverride();

    const result = service.resolveWithContributionOverride(
      createInput({
        taxConfig: null,
      }),

      contributions,
    );

    expect(result.ready).toBe(false);

    expect(result.options.contributions).toEqual(contributions);

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'MISSING_EMPLOYEE_TAX_TREATMENT',
      }),
    ]);
  });
});
