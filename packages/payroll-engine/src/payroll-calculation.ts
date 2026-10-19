import type {
  AttendanceAggregate,
} from './attendance-summary.ts';

import {
  parseMoney,
  parseRate,
} from './fixed-decimal.ts';

export type PayrollEngineEmployeeStatus =
  | 'ACTIVE'
  | 'ACTIVE_HOLD'
  | 'RESIGNED';

export type PayrollEnginePayBasis =
  | 'DAILY'
  | 'MONTHLY';

export type PayrollEnginePayoutMethod =
  | 'CASH'
  | 'ATM';

export type PayrollEngineAdjustmentType =
  | 'EARNING'
  | 'DEDUCTION';

export type PayrollEngineRecurringItemKind =
  | 'ALLOWANCE'
  | 'FIXED_DEDUCTION';

export type PayrollEngineStatutoryBasisTreatment =
  | 'INCLUDE'
  | 'EXCLUDE';

export type PayrollEngineLineCategory =
  | 'EARNING'
  | 'DEDUCTION'
  | 'CONTRIBUTION'
  | 'TAX'
  | 'ADJUSTMENT'
  | 'INFORMATION';

export interface PayrollEngineRecurringItemInput {
  code: string;
  description: string;

  kind: PayrollEngineRecurringItemKind;

  amount: string;

  taxable: boolean;

  pagIbigFundSalaryTreatment?: PayrollEngineStatutoryBasisTreatment | null;
}

export interface PayrollEngineAdjustmentInput {
  code: string;
  description: string;

  type: PayrollEngineAdjustmentType;

  amount: string;

  taxable: boolean | null;

  pagIbigFundSalaryTreatment?: PayrollEngineStatutoryBasisTreatment | null;

  reason: string;
}

export interface PayrollEngineConfigInput {
  companyPayrollSetupVersionId: string;

  version: number;

  standardWorkMinutesPerDay: number;

  /*
   * Frozen source configuration.
   *
   * Step 20 calculation rules will be read from this
   * configuration as the client-approved formulas and
   * payroll rules are implemented.
   */
  configSnapshot: Readonly<Record<string, unknown>>;
}

export interface PayrollCalculationInput {
  employeeId: string;

  employmentRecordId: string;

  employeeNumber: string;

  employeeName: string;

  payrollStatus: PayrollEngineEmployeeStatus;

  payoutMethod: PayrollEnginePayoutMethod;

  payoutAccountLast4: string | null;

  payBasis: PayrollEnginePayBasis;

  /*
   * Decimal string using the same 4-decimal precision
   * as CompensationRecord.rate.
   */
  baseRate: string;

  attendance: AttendanceAggregate;

  recurringItems:
    readonly PayrollEngineRecurringItemInput[];

  adjustments:
    readonly PayrollEngineAdjustmentInput[];

  contributionConfig:
    Readonly<Record<string, unknown>> | null;

  taxConfig:
    Readonly<Record<string, unknown>> | null;

  config: PayrollEngineConfigInput;
}

export interface PayrollComputedLineItem {
  category: PayrollEngineLineCategory;

  code: string;

  description: string;

  quantity: string | null;

  rate: string | null;

  amount: string;

  taxable: boolean | null;

  metadata:
    Readonly<Record<string, unknown>> | null;
}

export interface PayrollCalculationResult {
  employeeId: string;

  employmentRecordId: string;

  payrollStatus: PayrollEngineEmployeeStatus;

  payoutMethod: PayrollEnginePayoutMethod;

  basicPay: string;

  allowancesTotal: string;

  premiumPayTotal: string;

  grossPay: string;

  governmentContributionsTotal: string;

  taxTotal: string;

  otherDeductionsTotal: string;

  totalDeductions: string;

  netPay: string;

  cashPayout: string;

  atmPayout: string;

  heldAmount: string;

  clientPayableGross: string;

  taxableCompensation: string;

  withholdingTax: string;

  thirteenthMonthPay: string;

  lastPayAmount: string;

  isLastPay: boolean;

  lineItems:
    readonly PayrollComputedLineItem[];
}

function assertNonBlank(
  value: string,
  fieldName: string,
): void {
  if (!value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
}

function assertNonNegativeMoney(
  value: string,
  fieldName: string,
): void {
  const amount = parseMoney(value);

  if (amount < 0n) {
    throw new Error(
      `${fieldName} must not be negative.`,
    );
  }
}

export function validatePayrollCalculationInput(
  input: PayrollCalculationInput,
): void {
  assertNonBlank(
    input.employeeId,
    'employeeId',
  );

  assertNonBlank(
    input.employmentRecordId,
    'employmentRecordId',
  );

  assertNonBlank(
    input.employeeNumber,
    'employeeNumber',
  );

  assertNonBlank(
    input.employeeName,
    'employeeName',
  );

  const baseRate = parseRate(input.baseRate);

  if (baseRate <= 0n) {
    throw new Error(
      'baseRate must be greater than zero.',
    );
  }

  if (
    !Number.isInteger(
      input.config.standardWorkMinutesPerDay,
    ) ||
    input.config.standardWorkMinutesPerDay <= 0
  ) {
    throw new Error(
      'standardWorkMinutesPerDay must be a positive integer.',
    );
  }

  if (
    !Number.isInteger(input.config.version) ||
    input.config.version <= 0
  ) {
    throw new Error(
      'Payroll configuration version must be a positive integer.',
    );
  }

  assertNonBlank(
    input.config.companyPayrollSetupVersionId,
    'companyPayrollSetupVersionId',
  );

  for (const item of input.recurringItems) {
    assertNonBlank(
      item.code,
      'Recurring payroll item code',
    );

    assertNonBlank(
      item.description,
      'Recurring payroll item description',
    );

    assertNonNegativeMoney(
      item.amount,
      `Recurring payroll item ${item.code} amount`,
    );
  }

  for (const adjustment of input.adjustments) {
    assertNonBlank(
      adjustment.code,
      'Payroll adjustment code',
    );

    assertNonBlank(
      adjustment.description,
      'Payroll adjustment description',
    );

    assertNonBlank(
      adjustment.reason,
      'Payroll adjustment reason',
    );

    assertNonNegativeMoney(
      adjustment.amount,
      `Payroll adjustment ${adjustment.code} amount`,
    );
  }
}
