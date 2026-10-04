import {
  formatRate,
  parseRate,
  type PayrollCalculationInput,
} from '@payroll/payroll-engine';

export type PhilippineMinimumWageClassification =
  'MWE' | 'NON_MWE' | 'UNRESOLVED';

export interface PhilippineMinimumWageReference {
  regionCode?: string;

  wageOrderCode?: string;

  areaClassification?: string;

  sector?: string;

  dailyRate: string;

  rateEffectiveFrom: string;
}

export interface ResolvePhilippineMinimumWageClassificationInput {
  payBasis: PayrollCalculationInput['payBasis'];

  /*
   * DAILY   -> contractual/effective daily rate.
   * MONTHLY -> contractual monthly salary.
   */
  baseRate: string;

  cutoffStartDate: string;

  cutoffEndDate: string;

  configSnapshot: Readonly<Record<string, unknown>>;
}

export interface ResolvePhilippineMinimumWageClassificationAtDateInput {
  payBasis: PayrollCalculationInput['payBasis'];

  baseRate: string;

  asOfDate: string;

  configSnapshot: Readonly<Record<string, unknown>>;
}

export interface PhilippineMinimumWageClassificationResolution {
  classification: PhilippineMinimumWageClassification;

  minimumWage: PhilippineMinimumWageReference | null;

  reason: string | null;
}

/*
 * Resolve Philippine MWE / NON_MWE classification from the
 * effective company minimum-wage reference and the employee's
 * effective compensation rate.
 *
 * This function deliberately does not guess:
 *
 * - MONTHLY compensation cannot yet be converted to an
 *   authoritative statutory daily equivalent.
 *
 * - For La Comfianza Phase 1, DAILY compensation at or below
 *   the configured statutory wage is classified as MWE.
 *   Compensation above the statutory wage is NON_MWE.
 *
 * - Region, wage order, area classification, sector, and legal
 *   effective-date metadata remain available for future statutory
 *   policy refinement.
 *
 * - A wage rate beginning inside the payroll cutoff cannot
 *   classify the complete cutoff under the current one-config-
 *   version-per-run design.
 */
export function resolvePhilippineMinimumWageClassification(
  input: ResolvePhilippineMinimumWageClassificationInput,
): PhilippineMinimumWageClassificationResolution {
  const cutoffStartDate = requireDateOnly(
    input.cutoffStartDate,
    'Payroll cutoff start date',
  );

  const cutoffEndDate = requireDateOnly(
    input.cutoffEndDate,
    'Payroll cutoff end date',
  );

  if (cutoffEndDate < cutoffStartDate) {
    throw new Error(
      'Payroll cutoff end date cannot be earlier than the start date.',
    );
  }

  if (input.payBasis === 'MONTHLY') {
    return unresolved(
      null,
      'MWE classification for MONTHLY compensation is unresolved until an approved monthly-to-daily statutory equivalence rule is implemented.',
    );
  }

  const minimumWage = readMinimumWageReference(input.configSnapshot);

  if (!minimumWage) {
    return unresolved(
      null,
      'A complete Philippine minimum-wage reference is not configured for the payroll setup version.',
    );
  }

  if (minimumWage.rateEffectiveFrom > cutoffStartDate) {
    return unresolved(
      minimumWage,
      'The configured minimum-wage rate does not cover the complete payroll cutoff.',
    );
  }

  return classifyDailyRate(input.baseRate, minimumWage);
}

export function resolvePhilippineMinimumWageClassificationAtDate(
  input: ResolvePhilippineMinimumWageClassificationAtDateInput,
): PhilippineMinimumWageClassificationResolution {
  const asOfDate = requireDateOnly(
    input.asOfDate,
    'Minimum-wage classification date',
  );

  if (input.payBasis === 'MONTHLY') {
    return unresolved(
      null,
      'MWE classification for MONTHLY compensation is unresolved until an approved monthly-to-daily statutory equivalence rule is implemented.',
    );
  }

  const minimumWage = readMinimumWageReference(input.configSnapshot);

  if (!minimumWage) {
    return unresolved(
      null,
      'A complete Philippine minimum-wage reference is not configured for the payroll setup version.',
    );
  }

  if (minimumWage.rateEffectiveFrom > asOfDate) {
    return unresolved(
      minimumWage,
      'The configured minimum-wage rate is not yet effective on the classification date.',
    );
  }

  return classifyDailyRate(input.baseRate, minimumWage);
}

function classifyDailyRate(
  baseRate: string,
  minimumWage: PhilippineMinimumWageReference,
): PhilippineMinimumWageClassificationResolution {
  let employeeDailyRate: bigint;

  let statutoryDailyRate: bigint;

  try {
    employeeDailyRate = parseRate(baseRate);

    statutoryDailyRate = parseRate(minimumWage.dailyRate);
  } catch {
    return unresolved(
      minimumWage,
      'The employee or configured statutory daily rate is not a valid payroll rate.',
    );
  }

  if (employeeDailyRate < 0n) {
    return unresolved(
      minimumWage,
      'Employee daily compensation must not be negative.',
    );
  }

  if (statutoryDailyRate <= 0n) {
    return unresolved(
      minimumWage,
      'Configured statutory minimum-wage daily rate must be greater than zero.',
    );
  }

  const normalizedMinimumWage: PhilippineMinimumWageReference = {
    ...minimumWage,

    dailyRate: formatRate(statutoryDailyRate),
  };

  if (employeeDailyRate <= statutoryDailyRate) {
    return {
      classification: 'MWE',

      minimumWage: normalizedMinimumWage,

      reason: null,
    };
  }

  return {
    classification: 'NON_MWE',

    minimumWage: normalizedMinimumWage,

    reason: null,
  };
}

function readMinimumWageReference(
  configSnapshot: Readonly<Record<string, unknown>>,
): PhilippineMinimumWageReference | null {
  const statutory = asObject(configSnapshot.statutory);

  if (!statutory) {
    return null;
  }

  const minimumWage = asObject(statutory.minimumWage);

  if (!minimumWage) {
    return null;
  }

  const regionCode = nonBlankString(minimumWage.regionCode);

  const wageOrderCode = nonBlankString(minimumWage.wageOrderCode);

  const areaClassification = nonBlankString(minimumWage.areaClassification);

  const sector = nonBlankString(minimumWage.sector);

  const dailyRate = nonBlankString(minimumWage.dailyRate);

  const rateEffectiveFrom = nonBlankString(minimumWage.rateEffectiveFrom);

  if (!dailyRate || !rateEffectiveFrom) {
    return null;
  }

  if (!isValidDateOnly(rateEffectiveFrom)) {
    return null;
  }

  return {
    ...(regionCode ? { regionCode } : {}),

    ...(wageOrderCode ? { wageOrderCode } : {}),

    ...(areaClassification ? { areaClassification } : {}),

    ...(sector ? { sector } : {}),

    dailyRate,

    rateEffectiveFrom,
  };
}

function asObject(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    return null;
  }

  return value as Readonly<Record<string, unknown>>;
}

function nonBlankString(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function requireDateOnly(value: string, fieldName: string): string {
  if (!isValidDateOnly(value)) {
    throw new Error(`${fieldName} must be a valid YYYY-MM-DD calendar date.`);
  }

  return value;
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function unresolved(
  minimumWage: PhilippineMinimumWageReference | null,
  reason: string,
): PhilippineMinimumWageClassificationResolution {
  return {
    classification: 'UNRESOLVED',

    minimumWage,

    reason,
  };
}
