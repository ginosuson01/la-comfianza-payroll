import {
  MONEY_SCALE,
  RATE_SCALE,
  divideRoundHalfUp,
  formatMoney,
  parseMoney,
  parseRate,
  rescaleFixedDecimal,
  type PayrollCalculationInput,
} from '@payroll/payroll-engine';

import type { SemiMonthlyCutoffPosition } from './payroll-cutoff-period.service';

export type PhilHealthDailyWorkerScheduleDaysPerWeek = 5 | 6;

export interface ResolvePhilHealthMonthlyBasicSalaryInput {
  payBasis: PayrollCalculationInput['payBasis'];

  /*
   * DAILY   -> applicable daily rate
   * MONTHLY -> contractual monthly salary
   */
  baseRate: string;

  dailyWorkerScheduleDaysPerWeek?: PhilHealthDailyWorkerScheduleDaysPerWeek;
}

/*
 * PhilHealth Monthly Basic Salary policy.
 *
 * DAILY
 *   5-day schedule: daily rate × 261 / 12
 *   6-day schedule: daily rate × 313 / 12
 *
 * MONTHLY
 *   CompensationRecord.rate already represents the
 *   contractual monthly salary.
 *
 * Attendance reductions, OT, allowances, and similar
 * variable payroll results are deliberately not used.
 */
export interface ResolveSssMonthlyCompensationCompletenessInput {
  cutoffPosition: SemiMonthlyCutoffPosition;

  employmentStartDate: string;

  currentCutoffStartDate: string;

  priorLockedRunCount: number;

  openingGrossPayProvided: boolean;

  monthlyActualRemuneration: string;
}

export interface SssMonthlyCompensationCompleteness {
  ready: boolean;

  priorRemunerationExpected: boolean;

  monthlyCompensation: string | null;

  issue: string | null;
}

export function resolveSssMonthlyCompensationCompleteness(
  input: ResolveSssMonthlyCompensationCompletenessInput,
): SssMonthlyCompensationCompleteness {
  if (input.cutoffPosition !== 'SECOND') {
    throw new Error(
      'SSS monthly compensation completeness is evaluated on the SECOND semi-monthly cutoff.',
    );
  }

  if (
    !Number.isInteger(input.priorLockedRunCount) ||
    input.priorLockedRunCount < 0
  ) {
    throw new Error(
      'Prior locked payroll run count must be a non-negative integer.',
    );
  }

  const employmentStartDate = requireDateOnly(
    input.employmentStartDate,
    'Employment start date',
  );

  const currentCutoffStartDate = requireDateOnly(
    input.currentCutoffStartDate,
    'Current cutoff start date',
  );

  /*
   * Once the cutoff has been authoritatively resolved as SECOND,
   * employment before its start means the employee was already
   * employed during an earlier portion of the statutory month.
   *
   * This works for both 1-15 / 16-last-day and cross-month
   * 26-10 / 11-25 semi-monthly templates without guessing the
   * cutoff position from the calendar day.
   */
  const priorRemunerationExpected =
    employmentStartDate < currentCutoffStartDate;

  if (
    priorRemunerationExpected &&
    input.priorLockedRunCount === 0 &&
    !input.openingGrossPayProvided
  ) {
    return {
      ready: false,

      priorRemunerationExpected: true,

      monthlyCompensation: null,

      issue:
        'Prior statutory-month remuneration is expected, but no prior locked payroll or explicit opening gross pay is available.',
    };
  }

  return {
    ready: true,

    priorRemunerationExpected,

    monthlyCompensation: resolveSssMonthlyCompensation({
      monthlyActualRemuneration: input.monthlyActualRemuneration,
    }),

    issue: null,
  };
}

export interface ResolveSssMonthlyCompensationInput {
  /*
   * Total actual remuneration accumulated for the SSS
   * statutory month.
   *
   * The caller is responsible for assembling the complete
   * monthly amount from prior locked payroll, opening values
   * when applicable, and the current cutoff.
   */
  monthlyActualRemuneration: string;
}

export function resolveSssMonthlyCompensation(
  input: ResolveSssMonthlyCompensationInput,
): string {
  const amount = parseMoney(input.monthlyActualRemuneration);

  if (amount < 0n) {
    throw new Error('SSS monthly actual remuneration must not be negative.');
  }

  return formatMoney(amount);
}

function requireDateOnly(value: string, fieldName: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${fieldName} is not a valid calendar date.`);
  }

  return value;
}

export function resolvePhilHealthMonthlyBasicSalary(
  input: ResolvePhilHealthMonthlyBasicSalaryInput,
): string {
  const rate = parseRate(input.baseRate);

  if (input.payBasis === 'MONTHLY') {
    return formatMoney(rescaleFixedDecimal(rate, RATE_SCALE, MONEY_SCALE));
  }

  const scheduleDays = input.dailyWorkerScheduleDaysPerWeek;

  if (scheduleDays !== 5 && scheduleDays !== 6) {
    throw new Error(
      'PhilHealth daily-worker schedule must be configured as 5 or 6 days per week.',
    );
  }

  const annualPaidDays = scheduleDays === 5 ? 261n : 313n;

  const monthlyAtRateScale = divideRoundHalfUp(rate * annualPaidDays, 12n);

  return formatMoney(
    rescaleFixedDecimal(monthlyAtRateScale, RATE_SCALE, MONEY_SCALE),
  );
}
