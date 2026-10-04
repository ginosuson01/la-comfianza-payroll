import { BadRequestException } from '@nestjs/common';

import {
  summarizeAttendance,
  type PayrollCalculationInput,
} from '@payroll/payroll-engine';

import { PayrollStatutoryConfigService } from './payroll-statutory-config.service';

describe('PayrollStatutoryConfigService', () => {
  const service = new PayrollStatutoryConfigService();

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

      attendance: summarizeAttendance([]),

      recurringItems: [],

      adjustments: [],

      contributionConfig: null,

      taxConfig: null,

      config: {
        companyPayrollSetupVersionId: 'setup-version-1',

        version: 1,

        standardWorkMinutesPerDay: 480,

        configSnapshot: {},
      },

      ...overrides,
    };
  }

  it('resolves explicit employee applicability with company statutory rules', () => {
    const result = service.resolve(
      createInput({
        contributionConfig: {
          SSS: {
            treatment: 'APPLY',

            basisAmount: '10000.00',
          },

          PHILHEALTH: {
            treatment: 'NOT_APPLICABLE',

            reason: 'Synthetic test exemption.',
          },

          PAGIBIG: {
            treatment: 'APPLY',

            basisAmount: '10000.00',
          },
        },

        taxConfig: {
          treatment: 'APPLY',

          taxableCompensation: '9000.00',
        },

        config: {
          companyPayrollSetupVersionId: 'setup-version-1',

          version: 1,

          standardWorkMinutesPerDay: 480,

          configSnapshot: {
            statutory: {
              contributions: {
                SSS: {
                  rule: {
                    method: 'FIXED_AMOUNT',

                    employeeAmount: '500.00',

                    employerAmount: '1000.00',
                  },
                },

                PAGIBIG: {
                  rule: {
                    method: 'PERCENTAGE_OF_BASIS',

                    employeeRate: '0.0100',

                    employerRate: '0.0100',
                  },
                },
              },

              tax: {
                rule: {
                  method: 'FIXED_AMOUNT',

                  amount: '250.00',
                },
              },
            },
          },
        },
      }),
    );

    expect(result.ready).toBe(true);

    expect(result.issues).toEqual([]);

    expect(result.options.contributions).toEqual([
      {
        treatment: 'APPLY',

        code: 'SSS',

        description: 'SSS Contribution',

        basisAmount: '10000.00',

        rule: {
          method: 'FIXED_AMOUNT',

          employeeAmount: '500.00',

          employerAmount: '1000.00',
        },
      },

      {
        treatment: 'NOT_APPLICABLE',

        code: 'PHILHEALTH',

        description: 'PhilHealth Contribution',

        reason: 'Synthetic test exemption.',
      },

      {
        treatment: 'APPLY',

        code: 'PAGIBIG',

        description: 'Pag-IBIG Contribution',

        basisAmount: '10000.00',

        rule: {
          method: 'PERCENTAGE_OF_BASIS',

          employeeRate: '0.0100',

          employerRate: '0.0100',
        },
      },
    ]);

    expect(result.options.tax).toEqual({
      treatment: 'APPLY',

      taxableCompensation: '9000.00',

      rule: {
        method: 'FIXED_AMOUNT',

        amount: '250.00',
      },
    });
  });

  it('allows explicit NOT_APPLICABLE treatment without company statutory rules', () => {
    const result = service.resolve(
      createInput({
        contributionConfig: {
          SSS: {
            treatment: 'NOT_APPLICABLE',

            reason: 'Synthetic exemption.',
          },

          PHILHEALTH: {
            treatment: 'NOT_APPLICABLE',

            reason: 'Synthetic exemption.',
          },

          PAGIBIG: {
            treatment: 'NOT_APPLICABLE',

            reason: 'Synthetic exemption.',
          },
        },

        taxConfig: {
          treatment: 'NOT_APPLICABLE',

          reason: 'Synthetic exemption.',
        },
      }),
    );

    expect(result.ready).toBe(true);

    expect(result.options.contributions).toHaveLength(3);

    expect(result.options.tax).toEqual({
      treatment: 'NOT_APPLICABLE',

      reason: 'Synthetic exemption.',
    });
  });

  it('reports missing employee statutory treatment instead of assuming zero', () => {
    const result = service.resolve(createInput());

    expect(result.ready).toBe(false);

    expect(
      result.issues.filter(
        (issue) => issue.code === 'MISSING_EMPLOYEE_CONTRIBUTION_TREATMENT',
      ),
    ).toHaveLength(3);

    expect(
      result.issues.some(
        (issue) => issue.code === 'MISSING_EMPLOYEE_TAX_TREATMENT',
      ),
    ).toBe(true);
  });

  it('reports APPLY contribution without company rule as unresolved', () => {
    const result = service.resolve(
      createInput({
        contributionConfig: {
          SSS: {
            treatment: 'APPLY',

            basisAmount: '10000.00',
          },

          PHILHEALTH: {
            treatment: 'NOT_APPLICABLE',

            reason: 'Synthetic exemption.',
          },

          PAGIBIG: {
            treatment: 'NOT_APPLICABLE',

            reason: 'Synthetic exemption.',
          },
        },

        taxConfig: {
          treatment: 'NOT_APPLICABLE',

          reason: 'Synthetic exemption.',
        },
      }),
    );

    expect(result.ready).toBe(false);

    expect(
      result.issues.some(
        (issue) =>
          issue.code === 'MISSING_COMPANY_CONTRIBUTION_RULE' &&
          issue.metadata?.['contributionCode'] === 'SSS',
      ),
    ).toBe(true);
  });

  it('reports APPLY tax without a company tax rule as unresolved', () => {
    const result = service.resolve(
      createInput({
        contributionConfig: {
          SSS: {
            treatment: 'NOT_APPLICABLE',

            reason: 'Synthetic exemption.',
          },

          PHILHEALTH: {
            treatment: 'NOT_APPLICABLE',

            reason: 'Synthetic exemption.',
          },

          PAGIBIG: {
            treatment: 'NOT_APPLICABLE',

            reason: 'Synthetic exemption.',
          },
        },

        taxConfig: {
          treatment: 'APPLY',

          taxableCompensation: '10000.00',
        },
      }),
    );

    expect(result.ready).toBe(false);

    expect(
      result.issues.some((issue) => issue.code === 'MISSING_COMPANY_TAX_RULE'),
    ).toBe(true);
  });

  it('rejects an unsupported contribution calculation method', () => {
    expect(() =>
      service.resolve(
        createInput({
          contributionConfig: {
            SSS: {
              treatment: 'APPLY',

              basisAmount: '10000.00',
            },

            PHILHEALTH: {
              treatment: 'NOT_APPLICABLE',

              reason: 'Synthetic exemption.',
            },

            PAGIBIG: {
              treatment: 'NOT_APPLICABLE',

              reason: 'Synthetic exemption.',
            },
          },

          taxConfig: {
            treatment: 'NOT_APPLICABLE',

            reason: 'Synthetic exemption.',
          },

          config: {
            companyPayrollSetupVersionId: 'setup-version-1',

            version: 1,

            standardWorkMinutesPerDay: 480,

            configSnapshot: {
              statutory: {
                contributions: {
                  SSS: {
                    rule: {
                      method: 'UNKNOWN_METHOD',
                    },
                  },
                },
              },
            },
          },
        }),
      ),
    ).toThrow(BadRequestException);
  });
});
