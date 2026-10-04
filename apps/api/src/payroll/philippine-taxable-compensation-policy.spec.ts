import type {
  CorePayrollCalculationResult,
  PayrollComputedLineItem,
} from '@payroll/payroll-engine';

import { resolvePhilippineTaxableCompensation } from './philippine-taxable-compensation-policy';

function lineItem(
  overrides: Partial<PayrollComputedLineItem>,
): PayrollComputedLineItem {
  return {
    category: 'EARNING',
    code: 'BASIC_PAY',
    description: 'Basic Pay',
    quantity: null,
    rate: null,
    amount: '600.00',
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
    basicPay: '600.00',
    paidLeaveEarningsTotal: '0.00',
    allowancesTotal: '0.00',
    taxableAllowancesTotal: '0.00',
    earningAdjustmentsTotal: '0.00',
    premiumPayTotal: '0.00',
    grossPay: '600.00',
    attendanceDeductionsTotal: '0.00',
    fixedDeductionsTotal: '0.00',
    deductionAdjustmentsTotal: '0.00',
    otherDeductionsTotal: '0.00',
    preContributionTaxPay: '600.00',
    lineItems: items,
  };
}

describe('Philippine taxable-compensation policy', () => {
  it('taxes NON_MWE basic pay then subtracts employee government contributions', () => {
    const result = resolvePhilippineTaxableCompensation(
      'NON_MWE',
      corePayroll([lineItem({})]),
      '100.00',
    );

    expect(result).toEqual({
      ready: true,
      taxableEarningsTotal: '600.00',
      governmentContributionsTotal: '100.00',
      taxableCompensation: '500.00',
      issues: [],
    });
  });

  it('exempts MWE basic pay but includes an explicitly taxable allowance', () => {
    const result = resolvePhilippineTaxableCompensation(
      'MWE',
      corePayroll([
        lineItem({}),
        lineItem({
          code: 'MEAL_ALLOWANCE',
          description: 'Meal Allowance',
          amount: '300.00',
          taxable: true,
          metadata: {
            source: 'RECURRING_PAYROLL_ITEM',
            recurringItemKind: 'ALLOWANCE',
          },
        }),
      ]),
      '100.00',
    );

    expect(result.taxableEarningsTotal).toBe('300.00');

    expect(result.taxableCompensation).toBe('200.00');

    expect(result.ready).toBe(true);
  });

  it('includes an MWE rest-day-only premium in taxable earnings', () => {
    const result = resolvePhilippineTaxableCompensation(
      'MWE',
      corePayroll([
        lineItem({}),
        lineItem({
          code: 'PREMIUM_REST_DAY_NO_HOLIDAY',
          description: 'Rest Day Premium',
          amount: '180.00',
          metadata: {
            source: 'ATTENDANCE_REGULAR_PREMIUM',
            restDay: true,
            holidayType: null,
          },
        }),
      ]),
      '50.00',
    );

    expect(result.taxableEarningsTotal).toBe('180.00');

    expect(result.taxableCompensation).toBe('130.00');
  });

  it('excludes MWE overtime and night differential from taxable earnings', () => {
    const result = resolvePhilippineTaxableCompensation(
      'MWE',
      corePayroll([
        lineItem({}),
        lineItem({
          code: 'OVERTIME_REGULAR',
          amount: '125.00',
          metadata: {
            source: 'ATTENDANCE_OVERTIME',
          },
        }),
        lineItem({
          code: 'NIGHT_DIFFERENTIAL',
          amount: '60.00',
          metadata: {
            source: 'ATTENDANCE_NIGHT_DIFFERENTIAL',
          },
        }),
      ]),
      '100.00',
    );

    expect(result.taxableEarningsTotal).toBe('0.00');

    expect(result.taxableCompensation).toBe('0.00');

    expect(result.ready).toBe(true);
  });

  it('never produces negative taxable compensation when contributions exceed taxable earnings', () => {
    const result = resolvePhilippineTaxableCompensation(
      'NON_MWE',
      corePayroll([
        lineItem({
          amount: '100.00',
        }),
      ]),
      '250.00',
    );

    expect(result.taxableCompensation).toBe('0.00');
  });

  it('blocks when an earning adjustment has unresolved taxability', () => {
    const result = resolvePhilippineTaxableCompensation(
      'NON_MWE',
      corePayroll([
        lineItem({}),
        lineItem({
          category: 'ADJUSTMENT',
          code: 'BONUS_ADJUSTMENT',
          amount: '200.00',
          taxable: null,
          metadata: {
            source: 'PAYROLL_ADJUSTMENT',
            adjustmentType: 'EARNING',
          },
        }),
      ]),
      '100.00',
    );

    expect(result.ready).toBe(false);

    expect(result.taxableCompensation).toBeNull();

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'UNRESOLVED_COMPONENT_TAX_TREATMENT',
        lineItemCode: 'BONUS_ADJUSTMENT',
      }),
    ]);
  });

  it('blocks MWE paid leave until its tax treatment is explicitly resolved', () => {
    const result = resolvePhilippineTaxableCompensation(
      'MWE',
      corePayroll([
        lineItem({}),
        lineItem({
          code: 'PAID_LEAVE_VL',
          amount: '600.00',
          metadata: {
            source: 'ATTENDANCE_LEAVE',
          },
        }),
      ]),
      '100.00',
    );

    expect(result.ready).toBe(false);

    expect(result.taxableCompensation).toBeNull();

    expect(result.issues[0]?.message).toMatch(/paid-leave/i);
  });

  it('blocks when core payroll is incomplete', () => {
    const incomplete = {
      ...corePayroll([lineItem({})]),
      status: 'INCOMPLETE' as const,
    };

    const result = resolvePhilippineTaxableCompensation(
      'NON_MWE',
      incomplete,
      '100.00',
    );

    expect(result.ready).toBe(false);

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'CORE_PAYROLL_INCOMPLETE',
      }),
    ]);
  });
});
