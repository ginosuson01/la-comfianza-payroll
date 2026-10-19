import {
  resolvePagIbigFundSalaryComponentTreatment,
  resolvePagIbigFundSalaryComponents,
  resolvePhilHealthMonthlyBasicSalary,
  resolveSssMonthlyCompensation,
  resolveSssMonthlyCompensationCompleteness,
} from './philippine-statutory-basis-policy';

import type { PayrollComputedLineItem } from '@payroll/payroll-engine';

describe('Pag-IBIG Fund Salary policy', () => {
  function lineItem(
    overrides: Partial<PayrollComputedLineItem> = {},
  ): PayrollComputedLineItem {
    return {
      category: 'EARNING',
      code: 'BASIC_PAY',
      description: 'Basic Pay',
      quantity: null,
      rate: null,
      amount: '5000.00',
      taxable: null,
      metadata: {
        source: 'ATTENDANCE_REGULAR_MINUTES',
      },
      ...overrides,
    };
  }

  it('includes known system-generated earnings', () => {
    expect(resolvePagIbigFundSalaryComponentTreatment(lineItem())).toEqual({
      treatment: 'INCLUDE',
      reason: null,
    });
  });

  it('honors INCLUDE for a recurring allowance', () => {
    expect(
      resolvePagIbigFundSalaryComponentTreatment(
        lineItem({
          code: 'MEAL_ALLOWANCE',
          amount: '1000.00',
          metadata: {
            source: 'RECURRING_PAYROLL_ITEM',
            recurringItemKind: 'ALLOWANCE',
            pagIbigFundSalaryTreatment: 'INCLUDE',
          },
        }),
      ),
    ).toEqual({
      treatment: 'INCLUDE',
      reason: null,
    });
  });

  it('honors EXCLUDE for a recurring allowance', () => {
    expect(
      resolvePagIbigFundSalaryComponentTreatment(
        lineItem({
          code: 'TRANSPORT_ALLOWANCE',
          amount: '800.00',
          metadata: {
            source: 'RECURRING_PAYROLL_ITEM',
            recurringItemKind: 'ALLOWANCE',
            pagIbigFundSalaryTreatment: 'EXCLUDE',
          },
        }),
      ),
    ).toEqual({
      treatment: 'EXCLUDE',
      reason: null,
    });
  });

  it('blocks a legacy recurring earning with no classification', () => {
    expect(
      resolvePagIbigFundSalaryComponentTreatment(
        lineItem({
          code: 'LEGACY_ALLOWANCE',
          metadata: {
            source: 'RECURRING_PAYROLL_ITEM',
            recurringItemKind: 'ALLOWANCE',
            pagIbigFundSalaryTreatment: null,
          },
        }),
      ),
    ).toEqual({
      treatment: 'UNRESOLVED',
      reason:
        'Pag-IBIG Fund Salary treatment is unresolved for recurring earning LEGACY_ALLOWANCE.',
    });
  });

  it('honors structured earning-adjustment classification', () => {
    expect(
      resolvePagIbigFundSalaryComponentTreatment(
        lineItem({
          category: 'ADJUSTMENT',
          code: 'BONUS_ADJ',
          amount: '750.00',
          metadata: {
            source: 'PAYROLL_ADJUSTMENT',
            adjustmentType: 'EARNING',
            pagIbigFundSalaryTreatment: 'INCLUDE',
          },
        }),
      ),
    ).toEqual({
      treatment: 'INCLUDE',
      reason: null,
    });
  });

  it('ignores deduction adjustments', () => {
    expect(
      resolvePagIbigFundSalaryComponentTreatment(
        lineItem({
          category: 'ADJUSTMENT',
          code: 'DEDUCTION_ADJ',
          amount: '500.00',
          metadata: {
            source: 'PAYROLL_ADJUSTMENT',
            adjustmentType: 'DEDUCTION',
            pagIbigFundSalaryTreatment: null,
          },
        }),
      ),
    ).toEqual({
      treatment: 'IGNORE',
      reason: null,
    });
  });

  it('does not guess the treatment of an unknown earning source', () => {
    expect(
      resolvePagIbigFundSalaryComponentTreatment(
        lineItem({
          code: 'FUTURE_EARNING',
          metadata: {
            source: 'FUTURE_SOURCE',
          },
        }),
      ),
    ).toEqual({
      treatment: 'UNRESOLVED',
      reason:
        'Pag-IBIG Fund Salary treatment is not defined for earning FUTURE_EARNING from source FUTURE_SOURCE.',
    });
  });

  it('sums only Pag-IBIG-included earnings', () => {
    expect(
      resolvePagIbigFundSalaryComponents([
        lineItem({
          amount: '5000.00',
        }),
        lineItem({
          code: 'ALLOWANCE_INCLUDED',
          amount: '1200.00',
          metadata: {
            source: 'RECURRING_PAYROLL_ITEM',
            recurringItemKind: 'ALLOWANCE',
            pagIbigFundSalaryTreatment: 'INCLUDE',
          },
        }),
        lineItem({
          code: 'ALLOWANCE_EXCLUDED',
          amount: '900.00',
          metadata: {
            source: 'RECURRING_PAYROLL_ITEM',
            recurringItemKind: 'ALLOWANCE',
            pagIbigFundSalaryTreatment: 'EXCLUDE',
          },
        }),
        lineItem({
          category: 'DEDUCTION',
          code: 'FIXED_DEDUCTION',
          amount: '400.00',
          metadata: {
            source: 'RECURRING_PAYROLL_ITEM',
            recurringItemKind: 'FIXED_DEDUCTION',
            pagIbigFundSalaryTreatment: null,
          },
        }),
      ]),
    ).toEqual({
      ready: true,
      monthlyCompensation: '6200.00',
      issues: [],
    });
  });

  it('returns not ready instead of guessing an unclassified structured earning', () => {
    expect(
      resolvePagIbigFundSalaryComponents([
        lineItem(),
        lineItem({
          code: 'LEGACY_ALLOWANCE',
          amount: '500.00',
          metadata: {
            source: 'RECURRING_PAYROLL_ITEM',
            recurringItemKind: 'ALLOWANCE',
            pagIbigFundSalaryTreatment: null,
          },
        }),
      ]),
    ).toEqual({
      ready: false,
      monthlyCompensation: null,
      issues: [
        'Pag-IBIG Fund Salary treatment is unresolved for recurring earning LEGACY_ALLOWANCE.',
      ],
    });
  });

  it('rejects a negative included earning amount', () => {
    expect(() =>
      resolvePagIbigFundSalaryComponents([
        lineItem({
          amount: '-1.00',
        }),
      ]),
    ).toThrow(/must not be negative/);
  });
});

describe('Philippine statutory basis policy', () => {
  it('blocks SSS when prior remuneration is expected but missing', () => {
    expect(
      resolveSssMonthlyCompensationCompleteness({
        cutoffPosition: 'SECOND',

        employmentStartDate: '2026-08-01',

        currentCutoffStartDate: '2026-09-16',

        priorLockedRunCount: 0,

        openingGrossPayProvided: false,

        monthlyActualRemuneration: '3600.00',
      }),
    ).toEqual({
      ready: false,

      priorRemunerationExpected: true,

      monthlyCompensation: null,

      issue:
        'Prior statutory-month remuneration is expected, but no prior locked payroll or explicit opening gross pay is available.',
    });
  });

  it('allows a new employee whose employment starts during the second cutoff', () => {
    expect(
      resolveSssMonthlyCompensationCompleteness({
        cutoffPosition: 'SECOND',

        employmentStartDate: '2026-09-18',

        currentCutoffStartDate: '2026-09-16',

        priorLockedRunCount: 0,

        openingGrossPayProvided: false,

        monthlyActualRemuneration: '2400.00',
      }),
    ).toEqual({
      ready: true,

      priorRemunerationExpected: false,

      monthlyCompensation: '2400.00',

      issue: null,
    });
  });

  it('allows SSS when authoritative prior locked payroll exists', () => {
    expect(
      resolveSssMonthlyCompensationCompleteness({
        cutoffPosition: 'SECOND',

        employmentStartDate: '2026-08-01',

        currentCutoffStartDate: '2026-09-16',

        priorLockedRunCount: 1,

        openingGrossPayProvided: false,

        monthlyActualRemuneration: '12000.00',
      }),
    ).toEqual({
      ready: true,

      priorRemunerationExpected: true,

      monthlyCompensation: '12000.00',

      issue: null,
    });
  });

  it('allows an explicit zero opening gross pay when prior remuneration is expected', () => {
    expect(
      resolveSssMonthlyCompensationCompleteness({
        cutoffPosition: 'SECOND',

        employmentStartDate: '2026-08-01',

        currentCutoffStartDate: '2026-09-16',

        priorLockedRunCount: 0,

        openingGrossPayProvided: true,

        monthlyActualRemuneration: '3600.00',
      }),
    ).toEqual({
      ready: true,

      priorRemunerationExpected: true,

      monthlyCompensation: '3600.00',

      issue: null,
    });
  });

  it('does not infer SSS completeness on a FIRST cutoff', () => {
    expect(() =>
      resolveSssMonthlyCompensationCompleteness({
        cutoffPosition: 'FIRST',

        employmentStartDate: '2026-08-01',

        currentCutoffStartDate: '2026-09-01',

        priorLockedRunCount: 0,

        openingGrossPayProvided: false,

        monthlyActualRemuneration: '3600.00',
      }),
    ).toThrow(/SECOND semi-monthly cutoff/);
  });

  it('uses accumulated actual monthly remuneration as the SSS compensation basis', () => {
    expect(
      resolveSssMonthlyCompensation({
        monthlyActualRemuneration: '12000.00',
      }),
    ).toBe('12000.00');
  });

  it('allows zero SSS monthly remuneration without inventing earnings', () => {
    expect(
      resolveSssMonthlyCompensation({
        monthlyActualRemuneration: '0.00',
      }),
    ).toBe('0.00');
  });

  it('rejects negative SSS monthly remuneration', () => {
    expect(() =>
      resolveSssMonthlyCompensation({
        monthlyActualRemuneration: '-1.00',
      }),
    ).toThrow(/must not be negative/);
  });

  it('calculates PhilHealth MBS for a five-day daily-paid employee', () => {
    expect(
      resolvePhilHealthMonthlyBasicSalary({
        payBasis: 'DAILY',

        baseRate: '600.0000',

        dailyWorkerScheduleDaysPerWeek: 5,
      }),
    ).toBe('13050.00');
  });

  it('calculates PhilHealth MBS for a six-day daily-paid employee', () => {
    expect(
      resolvePhilHealthMonthlyBasicSalary({
        payBasis: 'DAILY',

        baseRate: '600.0000',

        dailyWorkerScheduleDaysPerWeek: 6,
      }),
    ).toBe('15650.00');
  });

  it('uses the contractual monthly salary for a monthly-paid employee', () => {
    expect(
      resolvePhilHealthMonthlyBasicSalary({
        payBasis: 'MONTHLY',

        baseRate: '30000.0000',
      }),
    ).toBe('30000.00');
  });

  it('does not reduce PhilHealth MBS because of attendance', () => {
    /*
     * Attendance is deliberately not an input to this
     * policy. The same daily rate and schedule therefore
     * always produce the same statutory MBS.
     */
    expect(
      resolvePhilHealthMonthlyBasicSalary({
        payBasis: 'DAILY',

        baseRate: '600.0000',

        dailyWorkerScheduleDaysPerWeek: 5,
      }),
    ).toBe('13050.00');
  });

  it('requires the work-week schedule for a daily-paid employee', () => {
    expect(() =>
      resolvePhilHealthMonthlyBasicSalary({
        payBasis: 'DAILY',

        baseRate: '600.0000',
      }),
    ).toThrow(/5 or 6 days per week/);
  });
});
