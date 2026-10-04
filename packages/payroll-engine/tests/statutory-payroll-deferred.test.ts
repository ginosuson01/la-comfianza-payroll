import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateStatutoryPayroll,
  summarizeAttendance,
  type PayrollCalculationInput,
} from '../src/index.ts';

function createInput(): PayrollCalculationInput {
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
      'CASH',

    payoutAccountLast4:
      null,

    payBasis:
      'DAILY',

    baseRate:
      '600.0000',

    attendance:
      summarizeAttendance([
        {
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
        },
      ]),

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
  };
}

test(
  'treats DEFERRED contributions as explicitly resolved without deducting them',
  () => {
    const result =
      calculateStatutoryPayroll(
        createInput(),
        {
          contributions: [
            {
              treatment:
                'DEFERRED',

              code:
                'SSS',

              description:
                'SSS Contribution',

              reason:
                'Collected on SECOND semi-monthly cutoff.',
            },

            {
              treatment:
                'DEFERRED',

              code:
                'PHILHEALTH',

              description:
                'PhilHealth Contribution',

              reason:
                'Collected on FIRST semi-monthly cutoff.',
            },

            {
              treatment:
                'DEFERRED',

              code:
                'PAGIBIG',

              description:
                'Pag-IBIG Contribution',

              reason:
                'Collected on FIRST semi-monthly cutoff.',
            },
          ],

          tax: {
            treatment:
              'NOT_APPLICABLE',

            reason:
              'Synthetic focused test.',
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
      result.employerGovernmentContributionsTotal,
      '0.00',
    );

    assert.equal(
      result.netPayBeforeStatusTreatment,
      '600.00',
    );

    assert.equal(
      result.issues.length,
      0,
    );
  },
);

test(
  'requires an explanation for a DEFERRED contribution',
  () => {
    assert.throws(
      () =>
        calculateStatutoryPayroll(
          createInput(),
          {
            contributions: [
              {
                treatment:
                  'DEFERRED',

                code:
                  'SSS',

                description:
                  'SSS Contribution',

                reason:
                  '',
              },

              {
                treatment:
                  'NOT_APPLICABLE',

                code:
                  'PHILHEALTH',

                description:
                  'PhilHealth Contribution',

                reason:
                  'Synthetic exemption.',
              },

              {
                treatment:
                  'NOT_APPLICABLE',

                code:
                  'PAGIBIG',

                description:
                  'Pag-IBIG Contribution',

                reason:
                  'Synthetic exemption.',
              },
            ],

            tax: {
              treatment:
                'NOT_APPLICABLE',

              reason:
                'Synthetic focused test.',
            },
          },
        ),
      /DEFERRED reason is required/,
    );
  },
);
