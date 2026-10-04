import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateEmployeePayrollTreatment,
  type PayrollCalculationInput,
  type StatutoryPayrollCalculationResult,
} from '../src/index.ts';

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

    attendance: {
      entryCount: 0,

      restDayEntryCount: 0,
      holidayEntryCount: 0,

      regularMinutes: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      absenceMinutes: 0,
      leaveMinutes: 0,
      overtimeMinutes: 0,
      nightDifferentialMinutes: 0,

      workedMinutes: 0,
      restDayWorkedMinutes: 0,

      leaveBreakdown: [],
      overtimeBreakdown: [],
      holidayBreakdown: [],

      premiumWorkBreakdown: [],
    },

    recurringItems: [],

    adjustments: [],

    contributionConfig: null,

    taxConfig: null,

    config: {
      companyPayrollSetupVersionId:
        'setup-version-1',

      version: 1,

      standardWorkMinutesPerDay:
        480,

      configSnapshot: {},
    },

    ...overrides,
  };
}

function createStatutoryResult(
  overrides:
    Partial<StatutoryPayrollCalculationResult> = {},
): StatutoryPayrollCalculationResult {
  return {
    employeeId: 'employee-1',

    employmentRecordId: 'employment-1',

    payrollStatus: 'ACTIVE',

    payoutMethod: 'CASH',

    status: 'COMPLETE',

    issues: [],

    corePayroll:
      {} as StatutoryPayrollCalculationResult['corePayroll'],

    governmentContributionsTotal:
      '0.00',

    employerGovernmentContributionsTotal:
      '0.00',

    taxableCompensation:
      null,

    withholdingTax:
      '0.00',

    taxTotal:
      '0.00',

    totalDeductions:
      '0.00',

    netPayBeforeStatusTreatment:
      '600.00',

    lineItems: [],

    ...overrides,
  };
}

test('routes ACTIVE CASH payroll to cash payout', () => {
  const result =
    calculateEmployeePayrollTreatment(
      createInput(),
      createStatutoryResult(),
    );

  assert.equal(result.status, 'COMPLETE');

  assert.equal(
    result.payableAmount,
    '600.00',
  );

  assert.equal(
    result.cashPayout,
    '600.00',
  );

  assert.equal(
    result.atmPayout,
    '0.00',
  );

  assert.equal(
    result.heldAmount,
    '0.00',
  );

  assert.equal(
    result.isLastPay,
    false,
  );
});

test('routes ACTIVE ATM payroll to ATM payout', () => {
  const result =
    calculateEmployeePayrollTreatment(
      createInput({
        payoutMethod: 'ATM',

        payoutAccountLast4: '1234',
      }),

      createStatutoryResult({
        payoutMethod: 'ATM',
      }),
    );

  assert.equal(result.status, 'COMPLETE');

  assert.equal(
    result.cashPayout,
    '0.00',
  );

  assert.equal(
    result.atmPayout,
    '600.00',
  );
});

test('does not guess ACTIVE_HOLD hold or release behavior', () => {
  const result =
    calculateEmployeePayrollTreatment(
      createInput({
        payrollStatus: 'ACTIVE_HOLD',
      }),

      createStatutoryResult({
        payrollStatus: 'ACTIVE_HOLD',
      }),
    );

  assert.equal(
    result.status,
    'INCOMPLETE',
  );

  assert.equal(
    result.issues[0]?.code,
    'ACTIVE_HOLD_RULE_REQUIRED',
  );

  assert.equal(
    result.payableAmount,
    null,
  );

  assert.equal(
    result.heldAmount,
    null,
  );
});

test('accepts an explicitly resolved full ACTIVE_HOLD', () => {
  const result =
    calculateEmployeePayrollTreatment(
      createInput({
        payrollStatus: 'ACTIVE_HOLD',
      }),

      createStatutoryResult({
        payrollStatus: 'ACTIVE_HOLD',
      }),

      {
        activeHold: {
          payableAmount: '0.00',

          heldAmount: '600.00',

          reason:
            'Synthetic approved full-hold test.',
        },
      },
    );

  assert.equal(result.status, 'COMPLETE');

  assert.equal(
    result.payableAmount,
    '0.00',
  );

  assert.equal(
    result.heldAmount,
    '600.00',
  );

  assert.equal(
    result.cashPayout,
    '0.00',
  );
});

test('accepts an explicitly resolved partial ACTIVE_HOLD', () => {
  const result =
    calculateEmployeePayrollTreatment(
      createInput({
        payrollStatus: 'ACTIVE_HOLD',

        payoutMethod: 'ATM',

        payoutAccountLast4: '1234',
      }),

      createStatutoryResult({
        payrollStatus: 'ACTIVE_HOLD',

        payoutMethod: 'ATM',
      }),

      {
        activeHold: {
          payableAmount: '200.00',

          heldAmount: '400.00',

          reason:
            'Synthetic approved partial-hold test.',
        },
      },
    );

  assert.equal(result.status, 'COMPLETE');

  assert.equal(
    result.atmPayout,
    '200.00',
  );

  assert.equal(
    result.heldAmount,
    '400.00',
  );
});

test('rejects ACTIVE_HOLD amounts that do not reconcile to calculated net', () => {
  assert.throws(
    () =>
      calculateEmployeePayrollTreatment(
        createInput({
          payrollStatus: 'ACTIVE_HOLD',
        }),

        createStatutoryResult({
          payrollStatus: 'ACTIVE_HOLD',
        }),

        {
          activeHold: {
            payableAmount: '200.00',

            heldAmount: '300.00',

            reason:
              'Synthetic invalid hold test.',
          },
        },
      ),

    /must equal calculated net pay/,
  );
});

test('does not process RESIGNED employee as normal payroll without Last Pay resolution', () => {
  const result =
    calculateEmployeePayrollTreatment(
      createInput({
        payrollStatus: 'RESIGNED',
      }),

      createStatutoryResult({
        payrollStatus: 'RESIGNED',
      }),
    );

  assert.equal(
    result.status,
    'INCOMPLETE',
  );

  assert.equal(
    result.issues[0]?.code,
    'LAST_PAY_RULE_REQUIRED',
  );

  assert.equal(
    result.payableAmount,
    null,
  );

  assert.equal(
    result.isLastPay,
    null,
  );
});

test('accepts explicitly resolved Last Pay without inventing its formula', () => {
  const result =
    calculateEmployeePayrollTreatment(
      createInput({
        payrollStatus: 'RESIGNED',
      }),

      createStatutoryResult({
        payrollStatus: 'RESIGNED',
      }),

      {
        resignedLastPay: {
          lastPayAmount: '950.00',

          thirteenthMonthPay:
            '350.00',

          reason:
            'Synthetic approved Last Pay test.',
        },
      },
    );

  assert.equal(result.status, 'COMPLETE');

  assert.equal(
    result.calculatedNetBeforeStatusTreatment,
    '600.00',
  );

  assert.equal(
    result.lastPayAmount,
    '950.00',
  );

  assert.equal(
    result.thirteenthMonthPay,
    '350.00',
  );

  assert.equal(
    result.payableAmount,
    '950.00',
  );

  assert.equal(
    result.cashPayout,
    '950.00',
  );

  assert.equal(
    result.isLastPay,
    true,
  );
});

test('requires an ATM account before normal payout', () => {
  const result =
    calculateEmployeePayrollTreatment(
      createInput({
        payoutMethod: 'ATM',

        payoutAccountLast4: null,
      }),

      createStatutoryResult({
        payoutMethod: 'ATM',
      }),
    );

  assert.equal(
    result.status,
    'INCOMPLETE',
  );

  assert.equal(
    result.issues[0]?.code,
    'ATM_ACCOUNT_REQUIRED',
  );

  assert.equal(
    result.atmPayout,
    null,
  );
});

test('does not create payout when statutory payroll is incomplete', () => {
  const result =
    calculateEmployeePayrollTreatment(
      createInput(),

      createStatutoryResult({
        status: 'INCOMPLETE',

        netPayBeforeStatusTreatment:
          null,

        issues: [
          {
            code:
              'MISSING_TAX_RESOLUTION',

            message:
              'Test unresolved tax.',

            metadata: null,
          },
        ],
      }),
    );

  assert.equal(
    result.status,
    'INCOMPLETE',
  );

  assert.equal(
    result.issues[0]?.code,
    'STATUTORY_PAYROLL_INCOMPLETE',
  );

  assert.equal(
    result.payableAmount,
    null,
  );
});
