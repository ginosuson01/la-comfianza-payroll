import type { GoldenPayrollTemplateConfig } from './golden-payroll-template.types';

const progressiveRule = {
  method: 'PROGRESSIVE_TABLE' as const,

  brackets: [
    {
      minInclusive: '0.00',
      maxExclusive: null,
      baseTax: '0.00',
      rateOnExcess: '0.0000',
    },
  ],
};

export function createValidGoldenPayrollTemplateConfig(): GoldenPayrollTemplateConfig {
  return {
    schemaVersion: 1,

    jurisdiction: 'PH',

    statutory: {
      sss: {
        effectiveFrom: '2025-01-01',

        minimumMsc: '5000.00',
        maximumMsc: '35000.00',

        mscStep: '500.00',
        mscMidpoint: '250.00',

        regularSocialSecurityMaximumMsc: '20000.00',

        employeeRate: '0.0500',
        employerRate: '0.1000',

        mandatoryProvidentFund: {
          startsAboveMsc: '20000.00',

          employeeRate: '0.0500',
          employerRate: '0.1000',
        },

        employeesCompensation: {
          thresholdMsc: '14500.00',

          atOrBelowThresholdAmount: '10.00',
          aboveThresholdAmount: '30.00',
        },
      },

      philHealth: {
        effectiveFrom: '2025-01-01',

        salaryFloor: '10000.00',
        salaryCeiling: '100000.00',

        premiumRate: '0.0500',

        employeeShareRate: '0.5000',
        employerShareRate: '0.5000',

        oddCentavoRecipient: 'EMPLOYER',
      },

      pagIbig: {
        effectiveFrom: '2024-02-01',

        maximumFundSalary: '10000.00',

        employeeRateThreshold: '1500.00',

        lowerEmployeeRate: '0.0100',
        upperEmployeeRate: '0.0200',

        employerRate: '0.0200',
      },

      tax: {
        withholding: {
          effectiveFrom: '2023-01-01',

          rules: {
            DAILY: progressiveRule,
            WEEKLY: progressiveRule,
            SEMI_MONTHLY: progressiveRule,
            MONTHLY: progressiveRule,
          },
        },

        annualIncomeTax: {
          effectiveFrom: '2023-01-01',

          rule: progressiveRule,
        },

        thirteenthMonthOtherBenefits: {
          effectiveFrom: '2018-01-01',

          taxExemptCeiling: '90000.00',
        },

        deMinimis: {
          effectiveFrom: '2025-01-01',

          benefits: [
            {
              code: 'TEST_DE_MINIMIS',

              description: 'Test de minimis benefit',

              limit: {
                type: 'AMOUNT_PER_YEAR',

                amount: '1000.00',
              },
            },
          ],
        },
      },

      minimumWageReferences: [
        {
          regionCode: 'NCR',

          wageOrderCode: 'TEST-WO',

          areaClassification: 'Test Area',

          sector: 'Test Sector',

          dailyRate: '645.00',

          rateEffectiveFrom: '2025-01-01',
        },
      ],

      premium: {
        regularWorkRules: {
          'REST_DAY|NO_HOLIDAY': {
            multiplier: '1.3000',

            semantics: 'TOTAL',
          },
        },

        overtimeRules: {
          REGULAR: {
            multiplier: '1.2500',

            semantics: 'TOTAL',
          },
        },

        nightDifferentialRate: '0.1000',
      },
    },
  };
}
