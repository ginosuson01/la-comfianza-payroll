import { formatMoney, parseMoney } from './fixed-decimal.ts';

import type {
  PayrollCalculationInput,
  PayrollComputedLineItem,
} from './payroll-calculation.ts';

import type { StatutoryPayrollCalculationResult } from './statutory-payroll.ts';

export type EmployeePayrollTreatmentStatus =
  | 'COMPLETE'
  | 'INCOMPLETE';

export type EmployeePayrollTreatmentIssueCode =
  | 'STATUTORY_PAYROLL_INCOMPLETE'
  | 'ACTIVE_HOLD_RULE_REQUIRED'
  | 'LAST_PAY_RULE_REQUIRED'
  | 'ATM_ACCOUNT_REQUIRED'
  | 'NEGATIVE_NET_PAY_REQUIRES_REVIEW';

export interface EmployeePayrollTreatmentIssue {
  code: EmployeePayrollTreatmentIssueCode;

  message: string;

  metadata: Readonly<Record<string, unknown>> | null;
}

/*
 * Explicitly resolved ACTIVE_HOLD amounts.
 *
 * The payroll engine does not determine how much must be
 * held. A later approved company/client rule must resolve
 * these values.
 */
export interface ActiveHoldResolution {
  payableAmount: string;

  heldAmount: string;

  reason: string;
}

/*
 * Explicitly resolved Last Pay values.
 *
 * The payroll engine deliberately does not infer how
 * Last Pay or 13th-month pay is calculated.
 */
export interface ResignedLastPayResolution {
  lastPayAmount: string;

  thirteenthMonthPay: string;

  reason: string;
}

export interface EmployeePayrollTreatmentOptions {
  activeHold?: ActiveHoldResolution;

  resignedLastPay?: ResignedLastPayResolution;
}

export interface EmployeePayrollTreatmentResult {
  employeeId: string;

  employmentRecordId: string;

  payrollStatus: PayrollCalculationInput['payrollStatus'];

  payoutMethod: PayrollCalculationInput['payoutMethod'];

  status: EmployeePayrollTreatmentStatus;

  issues: readonly EmployeePayrollTreatmentIssue[];

  calculatedNetBeforeStatusTreatment: string | null;

  payableAmount: string | null;

  cashPayout: string | null;

  atmPayout: string | null;

  heldAmount: string | null;

  thirteenthMonthPay: string | null;

  lastPayAmount: string | null;

  isLastPay: boolean | null;

  lineItems: readonly PayrollComputedLineItem[];
}

export function calculateEmployeePayrollTreatment(
  input: PayrollCalculationInput,
  statutory: StatutoryPayrollCalculationResult,
  options: EmployeePayrollTreatmentOptions = {},
): EmployeePayrollTreatmentResult {
  const issues: EmployeePayrollTreatmentIssue[] = [];

  const calculatedNet =
    statutory.netPayBeforeStatusTreatment;

  if (
    statutory.status !== 'COMPLETE' ||
    calculatedNet === null
  ) {
    issues.push({
      code: 'STATUTORY_PAYROLL_INCOMPLETE',

      message:
        'Employee payroll cannot proceed to payout treatment because statutory payroll is incomplete.',

      metadata: {
        statutoryStatus: statutory.status,

        statutoryIssueCount:
          statutory.issues.length,
      },
    });

    return incompleteResult(
      input,
      statutory,
      calculatedNet,
      issues,
    );
  }

  const netAmount =
    parseMoney(calculatedNet);

  if (netAmount < 0n) {
    issues.push({
      code:
        'NEGATIVE_NET_PAY_REQUIRES_REVIEW',

      message:
        'Negative payroll net pay requires Payroll Manager review before payout treatment.',

      metadata: {
        netPayBeforeStatusTreatment:
          calculatedNet,
      },
    });

    return incompleteResult(
      input,
      statutory,
      calculatedNet,
      issues,
    );
  }

  const normalizedNet =
    formatMoney(netAmount);

  switch (input.payrollStatus) {
    case 'ACTIVE':
      return completePayout(
        input,
        statutory,
        normalizedNet,
        normalizedNet,
        '0.00',
        null,
        null,
        false,
      );

    case 'ACTIVE_HOLD':
      return resolveActiveHold(
        input,
        statutory,
        normalizedNet,
        options.activeHold,
      );

    case 'RESIGNED':
      return resolveResignedLastPay(
        input,
        statutory,
        normalizedNet,
        options.resignedLastPay,
      );
  }
}

function resolveActiveHold(
  input: PayrollCalculationInput,
  statutory: StatutoryPayrollCalculationResult,
  calculatedNet: string,
  resolution: ActiveHoldResolution | undefined,
): EmployeePayrollTreatmentResult {
  if (!resolution) {
    return incompleteResult(
      input,
      statutory,
      calculatedNet,
      [
        {
          code:
            'ACTIVE_HOLD_RULE_REQUIRED',

          message:
            'ACTIVE_HOLD payout treatment requires an approved hold and release rule.',

          metadata: {
            calculatedNet,
          },
        },
      ],
    );
  }

  requireReason(
    resolution.reason,
    'ACTIVE_HOLD resolution reason',
  );

  const payableAmount =
    requireNonNegativeMoney(
      resolution.payableAmount,
      'ACTIVE_HOLD payable amount',
    );

  const heldAmount =
    requireNonNegativeMoney(
      resolution.heldAmount,
      'ACTIVE_HOLD held amount',
    );

  const calculatedNetAmount =
    parseMoney(calculatedNet);

  if (
    payableAmount +
      heldAmount !==
    calculatedNetAmount
  ) {
    throw new Error(
      'ACTIVE_HOLD payable amount plus held amount must equal calculated net pay.',
    );
  }

  return completePayout(
    input,
    statutory,
    calculatedNet,
    formatMoney(payableAmount),
    formatMoney(heldAmount),
    null,
    null,
    false,
  );
}

function resolveResignedLastPay(
  input: PayrollCalculationInput,
  statutory: StatutoryPayrollCalculationResult,
  calculatedNet: string,
  resolution:
    ResignedLastPayResolution |
    undefined,
): EmployeePayrollTreatmentResult {
  if (!resolution) {
    return incompleteResult(
      input,
      statutory,
      calculatedNet,
      [
        {
          code:
            'LAST_PAY_RULE_REQUIRED',

          message:
            'RESIGNED employee payroll requires an approved Last Pay calculation and release rule.',

          metadata: {
            calculatedNet,
          },
        },
      ],
    );
  }

  requireReason(
    resolution.reason,
    'Last Pay resolution reason',
  );

  const lastPayAmount =
    requireNonNegativeMoney(
      resolution.lastPayAmount,
      'Last Pay amount',
    );

  const thirteenthMonthPay =
    requireNonNegativeMoney(
      resolution.thirteenthMonthPay,
      '13th-month pay amount',
    );

  /*
   * No relationship between calculatedNet, lastPayAmount,
   * and thirteenthMonthPay is assumed here.
   *
   * The approved Last Pay calculator/configuration will
   * be responsible for producing these resolved values.
   */
  return completePayout(
    input,
    statutory,
    calculatedNet,
    formatMoney(lastPayAmount),
    '0.00',
    formatMoney(thirteenthMonthPay),
    formatMoney(lastPayAmount),
    true,
  );
}

function completePayout(
  input: PayrollCalculationInput,
  statutory: StatutoryPayrollCalculationResult,
  calculatedNet: string,
  payableAmount: string,
  heldAmount: string,
  thirteenthMonthPay: string | null,
  lastPayAmount: string | null,
  isLastPay: boolean,
): EmployeePayrollTreatmentResult {
  if (
    input.payoutMethod === 'ATM' &&
    !input.payoutAccountLast4
  ) {
    return incompleteResult(
      input,
      statutory,
      calculatedNet,
      [
        {
          code:
            'ATM_ACCOUNT_REQUIRED',

          message:
            'ATM payroll payout requires a configured employee account.',

          metadata: null,
        },
      ],
    );
  }

  return {
    employeeId:
      input.employeeId,

    employmentRecordId:
      input.employmentRecordId,

    payrollStatus:
      input.payrollStatus,

    payoutMethod:
      input.payoutMethod,

    status:
      'COMPLETE',

    issues:
      [],

    calculatedNetBeforeStatusTreatment:
      calculatedNet,

    payableAmount,

    cashPayout:
      input.payoutMethod === 'CASH'
        ? payableAmount
        : '0.00',

    atmPayout:
      input.payoutMethod === 'ATM'
        ? payableAmount
        : '0.00',

    heldAmount,

    thirteenthMonthPay,

    lastPayAmount,

    isLastPay,

    lineItems:
      statutory.lineItems,
  };
}

function incompleteResult(
  input: PayrollCalculationInput,
  statutory: StatutoryPayrollCalculationResult,
  calculatedNet: string | null,
  issues:
    readonly EmployeePayrollTreatmentIssue[],
): EmployeePayrollTreatmentResult {
  return {
    employeeId:
      input.employeeId,

    employmentRecordId:
      input.employmentRecordId,

    payrollStatus:
      input.payrollStatus,

    payoutMethod:
      input.payoutMethod,

    status:
      'INCOMPLETE',

    issues,

    calculatedNetBeforeStatusTreatment:
      calculatedNet,

    payableAmount:
      null,

    cashPayout:
      null,

    atmPayout:
      null,

    heldAmount:
      null,

    thirteenthMonthPay:
      null,

    lastPayAmount:
      null,

    isLastPay:
      null,

    lineItems:
      statutory.lineItems,
  };
}

function requireNonNegativeMoney(
  value: string,
  fieldName: string,
): bigint {
  const amount =
    parseMoney(value);

  if (amount < 0n) {
    throw new Error(
      `${fieldName} must not be negative.`,
    );
  }

  return amount;
}

function requireReason(
  value: string,
  fieldName: string,
): void {
  if (!value.trim()) {
    throw new Error(
      `${fieldName} is required.`,
    );
  }
}
