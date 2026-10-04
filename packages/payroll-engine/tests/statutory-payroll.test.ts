import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateStatutoryPayroll,
  summarizeAttendance,
  type AttendanceSummaryEntryInput,
  type GovernmentContributionResolution,
  type PayrollCalculationInput,
} from '../src/index.ts';

function createEntry(
  overrides: Partial<AttendanceSummaryEntryInput> = {},
): AttendanceSummaryEntryInput {
  return {
    workDate:
      '2026-09-01',

    regularMinutes:
      480,

    lateMinutes:
      0,

    undertimeMinutes:
      0,

    absenceMinutes:
      0,

    leaveMinutes:
      0,

    nightDifferentialMinutes:
      0,

    restDay:
      false,

    leaveType:
      null,

    holiday:
      null,

    overtimeEntries:
      [],

    ...overrides,
  };
}

function createInput(
  entries: AttendanceSummaryEntryInput[] = [
    createEntry(),
  ],

  overrides: Partial<PayrollCalculationInput> = {},
): PayrollCalculationInput {
  return {
    employeeId:
      'employee-1',

    employmentRecordId:
      'employment-1',

    employeeNumber:
      'EMP-001',

    employeeName:
      'Juan Dela Cruz',

    payrollStatus:
      'ACTIVE',

    payoutMethod:
      'ATM',

    payoutAccountLast4:
      '1234',

    payBasis:
      'DAILY',

    baseRate:
      '600.0000',

    attendance:
      summarizeAttendance(
        entries,
      ),

    recurringItems:
      [],

    adjustments:
      [],

    contributionConfig:
      null,

    taxConfig:
      null,

    config: {
      companyPayrollSetupVersionId:
        'setup-version-1',

      version:
        1,

      standardWorkMinutesPerDay:
        480,

      configSnapshot:
        {},
    },

    ...overrides,
  };
}

function noContributions(): GovernmentContributionResolution[] {
  return [
    {
      treatment:
        'NOT_APPLICABLE',

      code:
        'SSS',

      description:
        'SSS Contribution',

      reason:
        'Synthetic test exemption.',
    },

    {
      treatment:
        'NOT_APPLICABLE',

      code:
        'PHILHEALTH',

      description:
        'PhilHealth Contribution',

      reason:
        'Synthetic test exemption.',
    },

    {
      treatment:
        'NOT_APPLICABLE',

      code:
        'PAGIBIG',

      description:
        'Pag-IBIG Contribution',

      reason:
        'Synthetic test exemption.',
    },
  ];
}

test('requires explicit statutory treatment even when amounts are zero', () => {
  const result =
    calculateStatutoryPayroll(
      createInput(),
      {
        contributions:
          noContributions(),

        tax: {
          treatment:
            'NOT_APPLICABLE',

          reason:
            'Synthetic test exemption.',
        },
      },
    );

  assert.equal(
    result.status,
    'COMPLETE',
  );

  assert.equal(
    result.governmentContributionsTotal,
    '0.00',
  );

  assert.equal(
    result.withholdingTax,
    '0.00',
  );

  assert.equal(
    result.totalDeductions,
    '0.00',
  );

  assert.equal(
    result.netPayBeforeStatusTreatment,
    '600.00',
  );
});

test('combines employee contributions and withholding tax into deductions', () => {
  const result =
    calculateStatutoryPayroll(
      createInput(),
      {
        contributions: [
          {
            treatment:
              'APPLY',

            code:
              'SSS',

            description:
              'SSS Contribution',

            basisAmount:
              '600.00',

            rule: {
              method:
                'FIXED_AMOUNT',

              employeeAmount:
                '100.00',

              employerAmount:
                '200.00',
            },
          },

          {
            treatment:
              'APPLY',

            code:
              'PHILHEALTH',

            description:
              'PhilHealth Contribution',

            basisAmount:
              '600.00',

            rule: {
              method:
                'FIXED_AMOUNT',

              employeeAmount:
                '50.00',

              employerAmount:
                '50.00',
            },
          },

          {
            treatment:
              'APPLY',

            code:
              'PAGIBIG',

            description:
              'Pag-IBIG Contribution',

            basisAmount:
              '600.00',

            rule: {
              method:
                'FIXED_AMOUNT',

              employeeAmount:
                '25.00',

              employerAmount:
                '25.00',
            },
          },
        ],

        tax: {
          treatment:
            'APPLY',

          taxableCompensation:
            '600.00',

          rule: {
            method:
              'FIXED_AMOUNT',

            amount:
              '50.00',
          },
        },
      },
    );

  assert.equal(
    result.status,
    'COMPLETE',
  );

  assert.equal(
    result.governmentContributionsTotal,
    '175.00',
  );

  assert.equal(
    result.employerGovernmentContributionsTotal,
    '275.00',
  );

  assert.equal(
    result.withholdingTax,
    '50.00',
  );

  assert.equal(
    result.totalDeductions,
    '225.00',
  );

  assert.equal(
    result.netPayBeforeStatusTreatment,
    '375.00',
  );
});

test('resolves withholding tax after government contribution amounts are known', () => {
  let resolverContributionTotal:
    string | null = null;

  const result =
    calculateStatutoryPayroll(
      createInput(),
      {
        contributions: [
          {
            treatment:
              'APPLY',

            code:
              'SSS',

            description:
              'SSS Contribution',

            basisAmount:
              '5000.00',

            rule: {
              method:
                'FIXED_AMOUNT',

              employeeAmount:
                '250.00',

              employerAmount:
                '500.00',
            },
          },

          {
            treatment:
              'NOT_APPLICABLE',

            code:
              'PHILHEALTH',

            description:
              'PhilHealth Contribution',

            reason:
              'Synthetic focused test.',
          },

          {
            treatment:
              'NOT_APPLICABLE',

            code:
              'PAGIBIG',

            description:
              'Pag-IBIG Contribution',

            reason:
              'Synthetic focused test.',
          },
        ],

        taxResolver: (context) => {
          resolverContributionTotal =
            context.governmentContributionsTotal;

          assert.equal(
            context.corePayroll.grossPay,
            '600.00',
          );

          assert.equal(
            context.employerGovernmentContributionsTotal,
            '500.00',
          );

          return {
            treatment:
              'APPLY',

            taxableCompensation:
              '350.00',

            rule: {
              method:
                'FIXED_AMOUNT',

              amount:
                '50.00',
            },
          };
        },
      },
    );

  assert.equal(
    resolverContributionTotal,
    '250.00',
  );

  assert.equal(
    result.governmentContributionsTotal,
    '250.00',
  );

  assert.equal(
    result.taxableCompensation,
    '350.00',
  );

  assert.equal(
    result.withholdingTax,
    '50.00',
  );

  assert.equal(
    result.netPayBeforeStatusTreatment,
    '300.00',
  );

  assert.equal(
    result.status,
    'COMPLETE',
  );
});

test('does not silently treat a missing contribution as zero', () => {
  const result =
    calculateStatutoryPayroll(
      createInput(),
      {
        contributions: [
          {
            treatment:
              'NOT_APPLICABLE',

            code:
              'SSS',

            description:
              'SSS Contribution',

            reason:
              'Synthetic test exemption.',
          },

          {
            treatment:
              'NOT_APPLICABLE',

            code:
              'PHILHEALTH',

            description:
              'PhilHealth Contribution',

            reason:
              'Synthetic test exemption.',
          },
        ],

        tax: {
          treatment:
            'NOT_APPLICABLE',

          reason:
            'Synthetic test exemption.',
        },
      },
    );

  assert.equal(
    result.status,
    'INCOMPLETE',
  );

  assert.equal(
    result.issues.some(
      (issue) =>
        issue.code ===
          'MISSING_CONTRIBUTION_RESOLUTION' &&
        issue.metadata?.contributionCode ===
          'PAGIBIG',
    ),
    true,
  );

  assert.equal(
    result.netPayBeforeStatusTreatment,
    null,
  );
});

test('does not silently treat missing tax configuration as zero', () => {
  const result =
    calculateStatutoryPayroll(
      createInput(),
      {
        contributions:
          noContributions(),
      },
    );

  assert.equal(
    result.status,
    'INCOMPLETE',
  );

  assert.equal(
    result.issues.some(
      (issue) =>
        issue.code ===
        'MISSING_TAX_RESOLUTION',
    ),
    true,
  );

  assert.equal(
    result.netPayBeforeStatusTreatment,
    null,
  );
});

test('remains incomplete when the underlying core payroll is incomplete', () => {
  const result =
    calculateStatutoryPayroll(
      createInput([
        createEntry({
          restDay:
            true,
        }),
      ]),
      {
        contributions:
          noContributions(),

        tax: {
          treatment:
            'NOT_APPLICABLE',

          reason:
            'Synthetic test exemption.',
        },
      },
    );

  assert.equal(
    result.corePayroll.status,
    'INCOMPLETE',
  );

  assert.equal(
    result.status,
    'INCOMPLETE',
  );

  assert.equal(
    result.issues.some(
      (issue) =>
        issue.code ===
        'CORE_PAYROLL_INCOMPLETE',
    ),
    true,
  );

  assert.equal(
    result.netPayBeforeStatusTreatment,
    null,
  );
});

test('preserves contribution and tax line items in the composed result', () => {
  const result =
    calculateStatutoryPayroll(
      createInput(),
      {
        contributions: [
          {
            treatment:
              'APPLY',

            code:
              'SSS',

            description:
              'SSS Contribution',

            basisAmount:
              '600.00',

            rule: {
              method:
                'PERCENTAGE_OF_BASIS',

              employeeRate:
                '0.1000',
            },
          },

          {
            treatment:
              'NOT_APPLICABLE',

            code:
              'PHILHEALTH',

            description:
              'PhilHealth Contribution',

            reason:
              'Synthetic test exemption.',
          },

          {
            treatment:
              'NOT_APPLICABLE',

            code:
              'PAGIBIG',

            description:
              'Pag-IBIG Contribution',

            reason:
              'Synthetic test exemption.',
          },
        ],

        tax: {
          treatment:
            'APPLY',

          taxableCompensation:
            '600.00',

          rule: {
            method:
              'FIXED_AMOUNT',

            amount:
              '20.00',
          },
        },
      },
    );

  assert.equal(
    result.lineItems.some(
      (item) =>
        item.category ===
          'CONTRIBUTION' &&
        item.code ===
          'SSS',
    ),
    true,
  );

  assert.equal(
    result.lineItems.some(
      (item) =>
        item.category ===
          'TAX' &&
        item.code ===
          'WITHHOLDING_TAX',
    ),
    true,
  );

  assert.equal(
    result.taxableCompensation,
    '600.00',
  );
});
