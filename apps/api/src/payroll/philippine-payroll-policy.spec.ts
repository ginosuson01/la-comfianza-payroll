import {
  PHILIPPINE_DAILY_PREMIUM_OPTIONS,
  summarizeAttendance,
  type PayrollCalculationInput,
} from '@payroll/payroll-engine';

import {
  buildPhilippineCorePayrollOptions,
  buildPhilippineEmployeeTreatmentOptions,
} from './philippine-payroll-policy';

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

    baseRate: '800.0000',

    attendance: summarizeAttendance([]),

    recurringItems: [],

    adjustments: [],

    contributionConfig: null,

    taxConfig: null,

    config: {
      companyPayrollSetupVersionId: 'setup-version-1',

      version: 1,

      standardWorkMinutesPerDay: 480,

      configSnapshot: {
        statutory: {
          premium: {
            regularWorkRules:
              PHILIPPINE_DAILY_PREMIUM_OPTIONS.regularWorkRules ?? {},

            overtimeRules:
              PHILIPPINE_DAILY_PREMIUM_OPTIONS.overtimeRules ?? {},

            nightDifferentialRate: '0.1000',
          },
        },
      },
    },

    ...overrides,
  };
}

describe('Philippine payroll policy adapter', () => {
  it('treats tracked DTR leave as paid leave', () => {
    const input = createInput({
      attendance: summarizeAttendance([
        {
          workDate: '2026-09-01',

          regularMinutes: 0,
          lateMinutes: 0,
          undertimeMinutes: 0,
          absenceMinutes: 0,
          leaveMinutes: 480,
          nightDifferentialMinutes: 0,

          restDay: false,

          leaveType: {
            id: 'leave-vl',
            code: 'VL',
            name: 'Vacation Leave',
          },

          holiday: null,

          overtimeEntries: [],
        },
      ]),
    });

    const options = buildPhilippineCorePayrollOptions(input);

    expect(options.attendance?.leaveTreatmentByLeaveTypeId?.['leave-vl']).toBe(
      'PAID',
    );
  });

  it('supplies the approved Philippine regular holiday premium rule', () => {
    const options = buildPhilippineCorePayrollOptions(createInput());

    expect(
      options.premium?.regularWorkRules?.['WORKDAY|REGULAR']?.multiplier,
    ).toBe('2.0000');

    expect(
      options.premium?.overtimeRules?.['REGULAR_HOLIDAY']?.multiplier,
    ).toBe('2.6000');
  });

  it('does not guess LOCAL or OTHER holiday premium treatment', () => {
    const options = buildPhilippineCorePayrollOptions(createInput());

    expect(
      options.premium?.regularWorkRules?.['WORKDAY|LOCAL'],
    ).toBeUndefined();

    expect(
      options.premium?.regularWorkRules?.['WORKDAY|OTHER'],
    ).toBeUndefined();
  });

  it('does not use the generic flat night-differential rule', () => {
    const options = buildPhilippineCorePayrollOptions(createInput());

    expect(options.premium?.nightDifferentialRule).toBeUndefined();
  });

  it('holds 100 percent of ACTIVE_HOLD net pay', () => {
    const input = createInput({
      payrollStatus: 'ACTIVE_HOLD',
    });

    const result = buildPhilippineEmployeeTreatmentOptions(
      input,
      {
        netPayBeforeStatusTreatment: '1250.55',
      },
      {
        activeHold: {
          payableAmount: '250.00',

          heldAmount: '1000.55',

          reason: 'Caller attempted a partial hold.',
        },
      },
    );

    expect(result.activeHold).toEqual({
      payableAmount: '0.00',

      heldAmount: '1250.55',

      reason:
        'One payroll cutoff is held in full while exit clearance is pending.',
    });
  });

  it('preserves explicit RESIGNED Final Pay input for the later Final Pay workflow', () => {
    const input = createInput({
      payrollStatus: 'RESIGNED',
    });

    const explicit = {
      resignedLastPay: {
        lastPayAmount: '5000.00',

        thirteenthMonthPay: '1000.00',

        reason: 'Approved final-pay test.',
      },
    };

    expect(
      buildPhilippineEmployeeTreatmentOptions(
        input,
        {
          netPayBeforeStatusTreatment: '4000.00',
        },
        explicit,
      ),
    ).toEqual(explicit);
  });

  it('uses premium multipliers from the frozen company payroll config snapshot', () => {
    const input = createInput({
      config: {
        companyPayrollSetupVersionId: 'setup-version-custom',

        version: 99,

        standardWorkMinutesPerDay: 480,

        configSnapshot: {
          statutory: {
            premium: {
              regularWorkRules: {
                'WORKDAY|REGULAR': {
                  multiplier: '1.7500',

                  semantics: 'TOTAL',
                },
              },

              overtimeRules: {
                REGULAR: {
                  multiplier: '1.5000',

                  semantics: 'TOTAL',
                },
              },

              nightDifferentialRate: '0.2500',
            },
          },
        },
      },
    });

    const options = buildPhilippineCorePayrollOptions(input);

    expect(
      options.premium?.regularWorkRules?.['WORKDAY|REGULAR'],
    ).toEqual({
      multiplier: '1.7500',

      semantics: 'TOTAL',
    });

    expect(
      options.premium?.overtimeRules?.['REGULAR'],
    ).toEqual({
      multiplier: '1.5000',

      semantics: 'TOTAL',
    });

    expect(
      options.premium?.regularWorkRules?.['WORKDAY|REGULAR'],
    ).not.toEqual(
      PHILIPPINE_DAILY_PREMIUM_OPTIONS
        .regularWorkRules?.['WORKDAY|REGULAR'],
    );

    expect(
      options.premium?.overtimeRules?.['REGULAR'],
    ).not.toEqual(
      PHILIPPINE_DAILY_PREMIUM_OPTIONS
        .overtimeRules?.['REGULAR'],
    );

    /*
     * The Golden snapshot carries nightDifferentialRate, but the
     * generic flat ND rule must remain intentionally unset until
     * DTR data can classify ND overlap correctly.
     */
    expect(options.premium?.nightDifferentialRule).toBeUndefined();
  });

  it('rejects a frozen config snapshot without premium rules', () => {
    const input = createInput({
      config: {
        companyPayrollSetupVersionId: 'setup-version-missing-premium',

        version: 100,

        standardWorkMinutesPerDay: 480,

        configSnapshot: {
          statutory: {},
        },
      },
    });

    expect(() =>
      buildPhilippineCorePayrollOptions(input),
    ).toThrow(
      /Philippine premium-pay configuration must be present as an object/,
    );
  });

});
