import { Injectable } from '@nestjs/common';

import {
  formatMoney,
  parseMoney,
  type EmployeePayrollTreatmentOptions,
  type PayrollCalculationInput,
} from '@payroll/payroll-engine';

import {
  PayrollCalculationService,
  type PayrollEmployeeCalculationResult,
} from './payroll-calculation.service';

import { PhilippineGovernmentContributionOrchestrationService } from './philippine-government-contribution-orchestration.service';

import { buildPhilippineWithholdingTaxResolver } from './philippine-withholding-tax-policy';

import {
  PayrollCutoffInputService,
  type PayrollCutoffCollectionSnapshot,
  type PayrollCutoffReadinessIssue,
} from './payroll-cutoff-input.service';

export type PayrollCutoffCalculationIssueCode =
  'EMPLOYEE_CALCULATION_INCOMPLETE' | 'EMPLOYEE_CALCULATION_FAILED';

export interface PayrollCutoffCalculationIssue {
  code: PayrollCutoffCalculationIssueCode;

  employeeId: string;

  employeeNumber: string;

  message: string;
}

export interface PayrollCutoffCalculationTotals {
  totalGross: string;

  totalNetBeforeStatusTreatment: string;

  totalPayable: string;

  cashPayoutTotal: string;

  atmPayoutTotal: string;

  heldAmountTotal: string;
}

export type EmployeeTreatmentOptionsByEmployeeId = Readonly<
  Record<string, EmployeePayrollTreatmentOptions | undefined>
>;

export interface PayrollCutoffCalculationPreflight {
  companyId: string;

  payrollCutoffId: string;

  cutoff: PayrollCutoffCollectionSnapshot;

  ready: boolean;

  eligibleEmployeeCount: number;

  calculatedEmployeeCount: number;

  inputIssues: readonly PayrollCutoffReadinessIssue[];

  calculationIssues: readonly PayrollCutoffCalculationIssue[];

  companyPayrollSetupVersionId: string | null;

  configSnapshot: PayrollCalculationInput['config']['configSnapshot'] | null;

  employees: readonly PayrollEmployeeCalculationResult[];

  totals: PayrollCutoffCalculationTotals | null;
}

@Injectable()
export class PayrollCutoffCalculationService {
  constructor(
    private readonly cutoffInput: PayrollCutoffInputService,

    private readonly calculation: PayrollCalculationService,

    private readonly philippineContributions: PhilippineGovernmentContributionOrchestrationService,
  ) {}

  async calculateCutoffPreflight(
    companyId: string,
    payrollCutoffId: string,
    treatmentOptionsByEmployeeId: EmployeeTreatmentOptionsByEmployeeId = {},
  ): Promise<PayrollCutoffCalculationPreflight> {
    const collected = await this.cutoffInput.collectCutoffInputs(
      companyId,
      payrollCutoffId,
    );

    /*
     * Never calculate a partial cutoff when the input
     * collection itself is incomplete.
     *
     * Examples:
     * - missing DTR
     * - invalid DTR state
     * - overlapping employment
     * - configuration-version mismatch
     */
    if (!collected.ready) {
      return {
        companyId,

        payrollCutoffId,

        cutoff: collected.cutoff,

        ready: false,

        eligibleEmployeeCount: collected.eligibleEmployeeCount,

        calculatedEmployeeCount: 0,

        inputIssues: collected.issues,

        calculationIssues: [],

        companyPayrollSetupVersionId: null,

        configSnapshot: null,

        employees: [],

        totals: null,
      };
    }

    const employees: PayrollEmployeeCalculationResult[] = [];

    const calculationIssues: PayrollCutoffCalculationIssue[] = [];

    for (const assembly of collected.employees) {
      try {
        const contributionResolution =
          await this.philippineContributions.resolveSecondCutoff(assembly);

        const unsupportedFirstCutoff =
          !contributionResolution.ready &&
          contributionResolution.issues.some(
            (issue) => issue.code === 'UNSUPPORTED_CUTOFF_POSITION',
          );

        /*
         * SECOND cutoff:
         *
         * Philippine government contributions must be fully
         * resolved before statutory payroll continues.
         *
         * FIRST cutoff:
         *
         * C3 currently falls back to the existing generic path.
         * FIRST-cutoff PhilHealth/Pag-IBIG orchestration will
         * replace this fallback in its dedicated implementation.
         */
        if (!contributionResolution.ready && !unsupportedFirstCutoff) {
          calculationIssues.push({
            code: 'EMPLOYEE_CALCULATION_INCOMPLETE',

            employeeId: assembly.input.employeeId,

            employeeNumber: assembly.input.employeeNumber,

            message:
              contributionResolution.issues[0]?.message ??
              'Philippine government contribution resolution is incomplete.',
          });

          continue;
        }

        const treatmentOptions =
          treatmentOptionsByEmployeeId[assembly.input.employeeId] ?? {};

        let result: PayrollEmployeeCalculationResult;

        if (contributionResolution.ready) {
          const withholding = buildPhilippineWithholdingTaxResolver({
            payBasis: assembly.input.payBasis,

            baseRate: assembly.input.baseRate,

            cutoffStartDate: assembly.cutoff.startDate,

            cutoffEndDate: assembly.cutoff.endDate,

            configSnapshot: assembly.input.config.configSnapshot,

            corePayroll: contributionResolution.corePayroll,
          });

          if (!withholding.ready || !withholding.taxResolver) {
            calculationIssues.push({
              code: 'EMPLOYEE_CALCULATION_INCOMPLETE',

              employeeId: assembly.input.employeeId,

              employeeNumber: assembly.input.employeeNumber,

              message:
                withholding.issues[0]?.message ??
                'Philippine withholding tax resolution is incomplete.',
            });

            continue;
          }

          result = this.calculation.calculateEmployeeWithContributionOverride(
            assembly,

            contributionResolution.contributions,

            treatmentOptions,

            withholding.taxResolver,
          );
        } else {
          /*
           * FIRST-cutoff Philippine contribution orchestration
           * is not wired yet, so preserve the existing generic
           * statutory path.
           */
          result = this.calculation.calculateEmployee(
            assembly,

            treatmentOptions,
          );
        }

        employees.push(result);

        if (!result.ready) {
          calculationIssues.push({
            code: 'EMPLOYEE_CALCULATION_INCOMPLETE',

            employeeId: assembly.input.employeeId,

            employeeNumber: assembly.input.employeeNumber,

            message: this.getCalculationIssueMessage(result),
          });
        }
      } catch (error: unknown) {
        calculationIssues.push({
          code: 'EMPLOYEE_CALCULATION_FAILED',

          employeeId: assembly.input.employeeId,

          employeeNumber: assembly.input.employeeNumber,

          message: `Payroll calculation failed for employee ${assembly.input.employeeNumber}: ${this.getErrorMessage(
            error,
          )}`,
        });
      }
    }

    const ready =
      calculationIssues.length === 0 &&
      employees.length === collected.eligibleEmployeeCount &&
      employees.every((employee) => employee.ready);

    const firstAssembly = collected.employees[0];

    return {
      companyId,

      payrollCutoffId,

      cutoff: collected.cutoff,

      ready,

      eligibleEmployeeCount: collected.eligibleEmployeeCount,

      calculatedEmployeeCount: employees.length,

      inputIssues: collected.issues,

      calculationIssues,

      companyPayrollSetupVersionId:
        firstAssembly?.input.config.companyPayrollSetupVersionId ?? null,

      configSnapshot: firstAssembly?.input.config.configSnapshot ?? null,

      employees,

      totals: ready ? this.calculateTotals(employees) : null,
    };
  }

  private calculateTotals(
    employees: readonly PayrollEmployeeCalculationResult[],
  ): PayrollCutoffCalculationTotals {
    let totalGross = 0n;

    let totalNetBeforeStatusTreatment = 0n;

    let totalPayable = 0n;

    let cashPayoutTotal = 0n;

    let atmPayoutTotal = 0n;

    let heldAmountTotal = 0n;

    for (const employee of employees) {
      const grossPay = employee.calculation?.corePayroll.grossPay;

      const netBeforeTreatment =
        employee.calculation?.netPayBeforeStatusTreatment;

      const payableAmount = employee.treatment?.payableAmount;

      const cashPayout = employee.treatment?.cashPayout;

      const atmPayout = employee.treatment?.atmPayout;

      const heldAmount = employee.treatment?.heldAmount;

      if (
        grossPay === null ||
        grossPay === undefined ||
        netBeforeTreatment === null ||
        netBeforeTreatment === undefined ||
        payableAmount === null ||
        payableAmount === undefined ||
        cashPayout === null ||
        cashPayout === undefined ||
        atmPayout === null ||
        atmPayout === undefined ||
        heldAmount === null ||
        heldAmount === undefined
      ) {
        throw new Error(
          `Payroll-ready employee ${employee.employeeNumber} is missing a required calculated total.`,
        );
      }

      totalGross += parseMoney(grossPay);

      totalNetBeforeStatusTreatment += parseMoney(netBeforeTreatment);

      totalPayable += parseMoney(payableAmount);

      cashPayoutTotal += parseMoney(cashPayout);

      atmPayoutTotal += parseMoney(atmPayout);

      heldAmountTotal += parseMoney(heldAmount);
    }

    return {
      totalGross: formatMoney(totalGross),

      totalNetBeforeStatusTreatment: formatMoney(totalNetBeforeStatusTreatment),

      totalPayable: formatMoney(totalPayable),

      cashPayoutTotal: formatMoney(cashPayoutTotal),

      atmPayoutTotal: formatMoney(atmPayoutTotal),

      heldAmountTotal: formatMoney(heldAmountTotal),
    };
  }

  private getCalculationIssueMessage(
    result: PayrollEmployeeCalculationResult,
  ): string {
    const treatmentIssue = result.treatment?.issues[0];

    if (treatmentIssue) {
      return treatmentIssue.message;
    }

    const statutoryIssue = result.calculation?.issues[0];

    if (statutoryIssue) {
      return statutoryIssue.message;
    }

    const configIssue = result.statutoryConfig.issues[0];

    if (configIssue) {
      return configIssue.message;
    }

    return `Payroll calculation is incomplete for employee ${result.employeeNumber}.`;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown payroll calculation error.';
  }
}
