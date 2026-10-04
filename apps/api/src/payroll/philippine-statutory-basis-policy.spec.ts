import {
  resolvePhilHealthMonthlyBasicSalary,
  resolveSssMonthlyCompensation,
  resolveSssMonthlyCompensationCompleteness,
} from './philippine-statutory-basis-policy';

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
