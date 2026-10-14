import { Injectable } from '@nestjs/common';
import type { Prisma } from '@payroll/database';

import type { GoldenPayrollTemplateConfig } from './golden-payroll-template.types';

export interface CompanyPayrollConfigOverlay {
  attendance: {
    standardWorkMinutesPerDay: number;
  };

  statutory?: {
    philHealth?: {
      dailyWorkerScheduleDaysPerWeek: number;
    };

    minimumWage?: {
      regionCode?: string;
      wageOrderCode?: string;
      areaClassification?: string;
      sector?: string;
      dailyRate: string;
      rateEffectiveFrom: string;
    };
  };
}

@Injectable()
export class CompanyPayrollConfigResolverService {
  resolve(
    goldenConfig: GoldenPayrollTemplateConfig,
    companyConfig: CompanyPayrollConfigOverlay,
  ): Prisma.InputJsonValue {
    const companyPhilHealth =
      companyConfig.statutory?.philHealth;

    const companyMinimumWage =
      companyConfig.statutory?.minimumWage;

    const resolvedConfig = {
      schemaVersion: goldenConfig.schemaVersion,
      jurisdiction: goldenConfig.jurisdiction,

      attendance: {
        ...companyConfig.attendance,
      },

      statutory: {
        sss: {
          ...goldenConfig.statutory.sss,
        },

        philHealth: {
          ...goldenConfig.statutory.philHealth,

          ...(companyPhilHealth
            ? {
                dailyWorkerScheduleDaysPerWeek:
                  companyPhilHealth.dailyWorkerScheduleDaysPerWeek,
              }
            : {}),
        },

        pagIbig: {
          ...goldenConfig.statutory.pagIbig,
        },

        tax: {
          withholding: {
            ...goldenConfig.statutory.tax.withholding,

            rules: {
              ...goldenConfig.statutory.tax.withholding.rules,
            },
          },

          annualIncomeTax: {
            ...goldenConfig.statutory.tax.annualIncomeTax,

            rule: {
              ...goldenConfig.statutory.tax.annualIncomeTax.rule,
            },
          },

          thirteenthMonthOtherBenefits: {
            ...goldenConfig.statutory.tax.thirteenthMonthOtherBenefits,
          },

          deMinimis: {
            ...goldenConfig.statutory.tax.deMinimis,

            benefits:
              goldenConfig.statutory.tax.deMinimis.benefits.map(
                (benefit) => ({
                  ...benefit,
                  limit: {
                    ...benefit.limit,
                  },
                }),
              ),
          },
        },

        minimumWageReferences:
          goldenConfig.statutory.minimumWageReferences.map(
            (reference) => ({
              ...reference,
            }),
          ),

        ...(companyMinimumWage
          ? {
              minimumWage: {
                ...companyMinimumWage,
              },
            }
          : {}),

        premium: {
          regularWorkRules: {
            ...goldenConfig.statutory.premium.regularWorkRules,
          },

          overtimeRules: {
            ...goldenConfig.statutory.premium.overtimeRules,
          },

          nightDifferentialRate:
            goldenConfig.statutory.premium.nightDifferentialRate,
        },
      },
    };

    /*
     * Golden config has already passed runtime validation and this
     * resolver constructs only JSON-safe primitives, arrays and
     * plain objects.
     *
     * Prisma InputJsonValue is structurally stricter than several
     * domain interfaces (for example PremiumMultiplierRule), even
     * though their runtime values are valid JSON. Serialize once at
     * the persistence boundary to normalize the resolved snapshot
     * and remove any optional undefined properties.
     */
    return JSON.parse(
      JSON.stringify(resolvedConfig),
    ) as Prisma.InputJsonValue;
  }
}
