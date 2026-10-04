import {
  getBirWithholdingTaxRule,
  type CorePayrollCalculationResult,
  type PayrollComputedLineItem,
} from '@payroll/payroll-engine';

import { buildPhilippineWithholdingTaxResolver } from './philippine-withholding-tax-policy';

function earning(
  overrides: Partial<PayrollComputedLineItem> = {},
): PayrollComputedLineItem {
  return {
    category: 'EARNING',

    code: 'BASIC_PAY',

    description: 'Basic Pay',

    quantity: null,

    rate: null,

    amount: '650.00',

    taxable: null,

    metadata: {
      source: 'ATTENDANCE_REGULAR_MINUTES',
    },

    ...overrides,
  };
}

function corePayroll(
  items: readonly PayrollComputedLineItem[],
): CorePayrollCalculationResult {
  return {
    employeeId: 'employee-1',

    employmentRecordId: 'employment-1',

    payrollStatus: 'ACTIVE',

    payoutMethod: 'CASH',

    status: 'COMPLETE',

    issues: [],

    basicPay: '650.00',

    paidLeaveEarningsTotal: '0.00',

    allowancesTotal: '0.00',

    taxableAllowancesTotal: '0.00',

    earningAdjustmentsTotal: '0.00',

    premiumPayTotal: '0.00',

    grossPay: '650.00',

    attendanceDeductionsTotal: '0.00',

    fixedDeductionsTotal: '0.00',

    deductionAdjustmentsTotal: '0.00',

    otherDeductionsTotal: '0.00',

    preContributionTaxPay: '650.00',

    lineItems: items,
  };
}

function minimumWageConfig() {
  return {
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
}

describe('Philippine withholding-tax policy', () => {
  it('creates a semi-monthly BIR resolver for a resolved NON_MWE employee', () => {
    const result = buildPhilippineWithholdingTaxResolver({
      payBasis: 'DAILY',

      baseRate: '650.0000',

      cutoffStartDate: '2026-09-16',

      cutoffEndDate: '2026-09-30',

      configSnapshot: minimumWageConfig(),

      corePayroll: corePayroll([earning()]),
    });

    expect(result.ready).toBe(true);

    expect(result.classification).toBe('NON_MWE');

    expect(result.taxResolver).not.toBeNull();

    const tax = result.taxResolver?.({
      corePayroll: corePayroll([earning()]),

      governmentContributionsTotal: '100.00',

      employerGovernmentContributionsTotal: '200.00',
    });

    expect(tax).toEqual({
      treatment: 'APPLY',

      taxableCompensation: '550.00',

      rule: getBirWithholdingTaxRule('SEMI_MONTHLY'),
    });
  });

  it('creates APPLY with zero taxable compensation for an MWE rather than NOT_APPLICABLE', () => {
    const mweCore = corePayroll([
      earning({
        amount: '600.00',
      }),
    ]);

    const result = buildPhilippineWithholdingTaxResolver({
      payBasis: 'DAILY',

      baseRate: '600.0000',

      cutoffStartDate: '2026-09-16',

      cutoffEndDate: '2026-09-30',

      configSnapshot: minimumWageConfig(),

      corePayroll: mweCore,
    });

    expect(result.ready).toBe(true);

    expect(result.classification).toBe('MWE');

    const tax = result.taxResolver?.({
      corePayroll: mweCore,

      governmentContributionsTotal: '100.00',

      employerGovernmentContributionsTotal: '200.00',
    });

    expect(tax?.treatment).toBe('APPLY');

    if (tax?.treatment === 'APPLY') {
      expect(tax.taxableCompensation).toBe('0.00');

      expect(tax.rule).toEqual(getBirWithholdingTaxRule('SEMI_MONTHLY'));
    }
  });

  it('includes explicitly taxable additional MWE compensation before mandatory contributions', () => {
    const mweCore = corePayroll([
      earning({
        amount: '600.00',
      }),

      earning({
        code: 'TAXABLE_ALLOWANCE',

        amount: '300.00',

        taxable: true,

        metadata: {
          source: 'RECURRING_PAYROLL_ITEM',

          recurringItemKind: 'ALLOWANCE',
        },
      }),
    ]);

    const result = buildPhilippineWithholdingTaxResolver({
      payBasis: 'DAILY',

      baseRate: '600.00',

      cutoffStartDate: '2026-09-16',

      cutoffEndDate: '2026-09-30',

      configSnapshot: minimumWageConfig(),

      corePayroll: mweCore,
    });

    expect(result.ready).toBe(true);

    const tax = result.taxResolver?.({
      corePayroll: mweCore,

      governmentContributionsTotal: '100.00',

      employerGovernmentContributionsTotal: '200.00',
    });

    if (tax?.treatment === 'APPLY') {
      expect(tax.taxableCompensation).toBe('200.00');
    } else {
      throw new Error('Expected APPLY withholding resolution.');
    }
  });

  it('blocks when minimum-wage classification is unresolved', () => {
    const result = buildPhilippineWithholdingTaxResolver({
      payBasis: 'DAILY',

      baseRate: '600.00',

      cutoffStartDate: '2026-09-16',

      cutoffEndDate: '2026-09-30',

      configSnapshot: {},

      corePayroll: corePayroll([
        earning({
          amount: '600.00',
        }),
      ]),
    });

    expect(result.ready).toBe(false);

    expect(result.classification).toBe('UNRESOLVED');

    expect(result.taxResolver).toBeNull();

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'MINIMUM_WAGE_CLASSIFICATION_UNRESOLVED',
      }),
    ]);
  });

  it('blocks before creating the resolver when component tax treatment is unresolved', () => {
    const result = buildPhilippineWithholdingTaxResolver({
      payBasis: 'DAILY',

      baseRate: '600.00',

      cutoffStartDate: '2026-09-16',

      cutoffEndDate: '2026-09-30',

      configSnapshot: minimumWageConfig(),

      corePayroll: corePayroll([
        earning({
          amount: '600.00',
        }),

        earning({
          category: 'ADJUSTMENT',

          code: 'BONUS_ADJUSTMENT',

          amount: '100.00',

          taxable: null,

          metadata: {
            source: 'PAYROLL_ADJUSTMENT',

            adjustmentType: 'EARNING',
          },
        }),
      ]),
    });

    expect(result.ready).toBe(false);

    expect(result.taxResolver).toBeNull();

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'COMPONENT_TAX_TREATMENT_UNRESOLVED',

        lineItemCode: 'BONUS_ADJUSTMENT',
      }),
    ]);
  });

  it('blocks MONTHLY compensation until MWE classification has an approved daily-equivalence rule', () => {
    const result = buildPhilippineWithholdingTaxResolver({
      payBasis: 'MONTHLY',

      baseRate: '30000.0000',

      cutoffStartDate: '2026-09-16',

      cutoffEndDate: '2026-09-30',

      configSnapshot: minimumWageConfig(),

      corePayroll: corePayroll([
        earning({
          metadata: {
            source: 'CONFIGURED_MONTHLY_CUTOFF_AMOUNT',
          },
        }),
      ]),
    });

    expect(result.ready).toBe(false);

    expect(result.classification).toBe('UNRESOLVED');

    expect(result.taxResolver).toBeNull();
  });
});
