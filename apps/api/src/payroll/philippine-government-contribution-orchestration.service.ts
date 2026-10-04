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

import { resolveSssMonthlyCompensationCompleteness } from './philippine-statutory-basis-policy';

export type PhilippineContributionOrchestrationIssueCode =
  | 'CORE_PAYROLL_INCOMPLETE'
  | 'UNSUPPORTED_CUTOFF_POSITION'
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

  async resolveSecondCutoff(
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

    /*
     * C3B2 deliberately implements only the SECOND-cutoff
     * path because:
     *
     * - SSS is collected on SECOND;
     * - PhilHealth and Pag-IBIG are DEFERRED here;
     * - their FIRST-cutoff basis orchestration is a separate
     *   implementation step.
     */
    if (period.position !== 'SECOND') {
      return {
        ready: false,

        cutoffPosition: period.position,

        corePayroll,

        monthlyBasis: null,

        contributions: [],

        issues: [
          {
            code: 'UNSUPPORTED_CUTOFF_POSITION',

            message:
              'This orchestration path currently resolves only the SECOND semi-monthly cutoff.',
          },
        ],
      };
    }

    const statutoryMonth = await this.monthlyBasis.resolve({
      companyId: assembly.companyId,

      employeeId: assembly.input.employeeId,

      payrollCutoffId: assembly.payrollCutoffId,

      monthReferenceDate: period.cutoff.endDate,

      current: {
        basicPay: corePayroll.basicPay,

        grossPay: corePayroll.grossPay,
      },

      ...(opening
        ? {
            opening,
          }
        : {}),
    });

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
}
