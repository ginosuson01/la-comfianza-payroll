import { Injectable } from '@nestjs/common';

import type {
  CorePayrollCalculationResult,
  GovernmentContributionResolution,
} from '@payroll/payroll-engine';

import { PayrollCalculationService } from './payroll-calculation.service';

import {
  PayrollCutoffPeriodService,
  type SemiMonthlyCutoffPosition,
} from './payroll-cutoff-period.service';

import type { PayrollEmployeeInputAssembly } from './payroll-input.service';

import {
  PayrollMonthlyStatutoryBasisService,
  type PayrollMonthlyStatutoryBasis,
  type PayrollMonthlyStatutoryOpeningValues,
} from './payroll-monthly-statutory-basis.service';

import { buildPhilippineGovernmentContributionResolutions } from './philippine-government-contribution-policy';

import {
  resolvePagIbigFundSalaryComponents,
  resolvePhilHealthMonthlyBasicSalary,
  resolveSssMonthlyCompensationCompleteness,
} from './philippine-statutory-basis-policy';

export type PhilippineContributionOrchestrationIssueCode =
  | 'CORE_PAYROLL_INCOMPLETE'
  | 'PHILHEALTH_MONTHLY_BASIC_SALARY_INCOMPLETE'
  | 'PAGIBIG_MONTHLY_BASIS_INCOMPLETE'
  | 'SSS_MONTHLY_BASIS_INCOMPLETE';

export interface PhilippineContributionOrchestrationIssue {
  code: PhilippineContributionOrchestrationIssueCode;

  message: string;
}

export interface PhilippineContributionOrchestrationResult {
  ready: boolean;

  cutoffPosition: SemiMonthlyCutoffPosition;

  corePayroll: CorePayrollCalculationResult;

  monthlyBasis: PayrollMonthlyStatutoryBasis | null;

  contributions: readonly GovernmentContributionResolution[];

  issues: readonly PhilippineContributionOrchestrationIssue[];
}

@Injectable()
export class PhilippineGovernmentContributionOrchestrationService {
  constructor(
    private readonly calculation: PayrollCalculationService,

    private readonly cutoffPeriod: PayrollCutoffPeriodService,

    private readonly monthlyBasis: PayrollMonthlyStatutoryBasisService,
  ) {}

  async resolve(
    assembly: PayrollEmployeeInputAssembly,

    opening?: PayrollMonthlyStatutoryOpeningValues,
  ): Promise<PhilippineContributionOrchestrationResult> {
    const period = await this.cutoffPeriod.resolve(
      assembly.companyId,
      assembly.payrollCutoffId,
    );

    const corePayroll = this.calculation.calculateEmployeeCore(assembly);

    if (
      corePayroll.status !== 'COMPLETE' ||
      corePayroll.basicPay === null ||
      corePayroll.grossPay === null
    ) {
      return {
        ready: false,

        cutoffPosition: period.position,

        corePayroll,

        monthlyBasis: null,

        contributions: [],

        issues: [
          {
            code: 'CORE_PAYROLL_INCOMPLETE',

            message:
              'Core payroll must be complete before Philippine government contributions can be resolved.',
          },
        ],
      };
    }

    const currentPagIbig = resolvePagIbigFundSalaryComponents(
      corePayroll.lineItems,
    );

    const statutoryMonth = await this.monthlyBasis.resolve({
      companyId: assembly.companyId,

      employeeId: assembly.input.employeeId,

      payrollCutoffId: assembly.payrollCutoffId,

      monthReferenceDate: period.cutoff.endDate,

      current: {
        basicPay: corePayroll.basicPay,

        grossPay: corePayroll.grossPay,

        ...(currentPagIbig.ready && currentPagIbig.monthlyCompensation !== null
          ? {
              pagIbigMonthlyCompensation: currentPagIbig.monthlyCompensation,
            }
          : {
              pagIbigIssues: currentPagIbig.issues,
            }),
      },

      ...(opening
        ? {
            opening,
          }
        : {}),
    });

    if (period.position === 'FIRST') {
      let philHealthMonthlyBasicSalary: string;

      try {
        philHealthMonthlyBasicSalary = resolvePhilHealthMonthlyBasicSalary({
          payBasis: assembly.input.payBasis,

          baseRate: assembly.input.baseRate,

          ...(assembly.input.payBasis === 'DAILY'
            ? {
                dailyWorkerScheduleDaysPerWeek:
                  this.readPhilHealthDailyWorkerScheduleDaysPerWeek(
                    assembly.input.config.configSnapshot,
                  ),
              }
            : {}),
        });
      } catch (error: unknown) {
        return {
          ready: false,

          cutoffPosition: period.position,

          corePayroll,

          monthlyBasis: statutoryMonth,

          contributions: [],

          issues: [
            {
              code: 'PHILHEALTH_MONTHLY_BASIC_SALARY_INCOMPLETE',

              message:
                error instanceof Error
                  ? error.message
                  : 'PhilHealth monthly basic salary basis is incomplete.',
            },
          ],
        };
      }

      const pagIbigMonthlyCompensation =
        statutoryMonth.monthly.pagIbigMonthlyCompensation;

      if (pagIbigMonthlyCompensation === null) {
        return {
          ready: false,

          cutoffPosition: period.position,

          corePayroll,

          monthlyBasis: statutoryMonth,

          contributions: [],

          issues: [
            {
              code: 'PAGIBIG_MONTHLY_BASIS_INCOMPLETE',

              message:
                statutoryMonth.monthly.pagIbigIssues.length > 0
                  ? statutoryMonth.monthly.pagIbigIssues.join(' ')
                  : 'Pag-IBIG monthly compensation basis is incomplete.',
            },
          ],
        };
      }

      const contributions = buildPhilippineGovernmentContributionResolutions({
        cutoffPosition: period.position,

        basis: {
          philHealthMonthlyBasicSalary,

          pagIbigMonthlyCompensation,
        },

        configSnapshot: assembly.input.config.configSnapshot,
      });

      return {
        ready: true,

        cutoffPosition: period.position,

        corePayroll,

        monthlyBasis: statutoryMonth,

        contributions,

        issues: [],
      };
    }

    const sss = resolveSssMonthlyCompensationCompleteness({
      cutoffPosition: period.position,

      employmentStartDate: assembly.employmentStartDate,

      currentCutoffStartDate: period.cutoff.startDate,

      priorLockedRunCount: statutoryMonth.priorLockedRuns.length,

      openingGrossPayProvided: statutoryMonth.openingGrossPayProvided,

      monthlyActualRemuneration: statutoryMonth.monthly.grossPay,
    });

    if (!sss.ready || sss.monthlyCompensation === null) {
      return {
        ready: false,

        cutoffPosition: period.position,

        corePayroll,

        monthlyBasis: statutoryMonth,

        contributions: [],

        issues: [
          {
            code: 'SSS_MONTHLY_BASIS_INCOMPLETE',

            message:
              sss.issue ?? 'SSS monthly compensation basis is incomplete.',
          },
        ],
      };
    }

    const contributions = buildPhilippineGovernmentContributionResolutions({
      cutoffPosition: period.position,

      basis: {
        sssMonthlyCompensation: sss.monthlyCompensation,
      },

      configSnapshot: assembly.input.config.configSnapshot,
    });

    return {
      ready: true,

      cutoffPosition: period.position,

      corePayroll,

      monthlyBasis: statutoryMonth,

      contributions,

      issues: [],
    };
  }

  private readPhilHealthDailyWorkerScheduleDaysPerWeek(
    configSnapshot: Readonly<Record<string, unknown>>,
  ): 5 | 6 | undefined {
    const statutory = configSnapshot['statutory'];

    if (
      statutory === null ||
      Array.isArray(statutory) ||
      typeof statutory !== 'object'
    ) {
      return undefined;
    }

    const philHealth = (statutory as Readonly<Record<string, unknown>>)[
      'philHealth'
    ];

    if (
      philHealth === null ||
      Array.isArray(philHealth) ||
      typeof philHealth !== 'object'
    ) {
      return undefined;
    }

    const value = (philHealth as Readonly<Record<string, unknown>>)[
      'dailyWorkerScheduleDaysPerWeek'
    ];

    return value === 5 || value === 6 ? value : undefined;
  }
}
