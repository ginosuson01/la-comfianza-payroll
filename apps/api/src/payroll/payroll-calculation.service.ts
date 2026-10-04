import { Injectable } from '@nestjs/common';

import {
  calculateCorePayroll,
  calculateEmployeePayrollTreatment,
  calculateStatutoryPayroll,
  type CorePayrollCalculationResult,
  type EmployeePayrollTreatmentOptions,
  type EmployeePayrollTreatmentResult,
  type GovernmentContributionResolution,
  type PayrollCalculationInput,
  type StatutoryPayrollCalculationResult,
  type StatutoryPayrollTaxResolver,
} from '@payroll/payroll-engine';

import {
  buildPhilippineCorePayrollOptions,
  buildPhilippineEmployeeTreatmentOptions,
} from './philippine-payroll-policy';

import type { PayrollEmployeeInputAssembly } from './payroll-input.service';

import {
  PayrollStatutoryConfigService,
  type PayrollStatutoryConfigResolution,
} from './payroll-statutory-config.service';

export interface PayrollEmployeeCalculationResult {
  companyId: string;

  payrollCutoffId: string;

  dtrId: string;

  employeeId: string;

  employmentRecordId: string;

  employeeNumber: string;

  employeeName: string;

  positionSnapshot: string | null;

  departmentSnapshot: string | null;

  payrollStatus: PayrollCalculationInput['payrollStatus'];

  payoutMethod: PayrollCalculationInput['payoutMethod'];

  payoutAccountLast4: string | null;

  payBasis: PayrollCalculationInput['payBasis'];

  baseRate: string;

  compensationSource: PayrollEmployeeInputAssembly['compensationSource'];

  ready: boolean;

  statutoryConfig: PayrollStatutoryConfigResolution;

  calculation: StatutoryPayrollCalculationResult | null;

  treatment: EmployeePayrollTreatmentResult | null;
}

@Injectable()
export class PayrollCalculationService {
  constructor(
    private readonly statutoryConfig: PayrollStatutoryConfigService,
  ) {}

  calculateEmployeeCore(
    assembly: PayrollEmployeeInputAssembly,
  ): CorePayrollCalculationResult {
    return calculateCorePayroll(
      assembly.input,
      buildPhilippineCorePayrollOptions(assembly.input),
    );
  }

  /*
   * Legacy/generic statutory path.
   *
   * Existing callers and tests continue to use the employee /
   * company contribution JSON configuration.
   */
  calculateEmployee(
    assembly: PayrollEmployeeInputAssembly,

    treatmentOptions: EmployeePayrollTreatmentOptions = {},
  ): PayrollEmployeeCalculationResult {
    const statutoryConfig = this.statutoryConfig.resolve(assembly.input);

    return this.calculateWithResolvedStatutoryConfig(
      assembly,
      statutoryConfig,
      treatmentOptions,
    );
  }

  /*
   * Philippine statutory path.
   *
   * Government contributions have already been resolved by
   * PhilippineGovernmentContributionOrchestrationService.
   *
   * The statutory config service still resolves and validates
   * withholding tax.
   */
  calculateEmployeeWithContributionOverride(
    assembly: PayrollEmployeeInputAssembly,

    contributions: readonly GovernmentContributionResolution[],

    treatmentOptions: EmployeePayrollTreatmentOptions = {},

    taxResolver?: StatutoryPayrollTaxResolver,
  ): PayrollEmployeeCalculationResult {
    const statutoryConfig =
      this.statutoryConfig.resolveWithContributionOverride(
        assembly.input,
        contributions,
        taxResolver,
      );

    return this.calculateWithResolvedStatutoryConfig(
      assembly,
      statutoryConfig,
      treatmentOptions,
    );
  }

  private calculateWithResolvedStatutoryConfig(
    assembly: PayrollEmployeeInputAssembly,

    statutoryConfig: PayrollStatutoryConfigResolution,

    treatmentOptions: EmployeePayrollTreatmentOptions,
  ): PayrollEmployeeCalculationResult {
    const snapshots = {
      companyId: assembly.companyId,

      payrollCutoffId: assembly.payrollCutoffId,

      dtrId: assembly.dtrId,

      employeeId: assembly.input.employeeId,

      employmentRecordId: assembly.input.employmentRecordId,

      employeeNumber: assembly.input.employeeNumber,

      employeeName: assembly.input.employeeName,

      positionSnapshot: assembly.positionSnapshot,

      departmentSnapshot: assembly.departmentSnapshot,

      payrollStatus: assembly.input.payrollStatus,

      payoutMethod: assembly.input.payoutMethod,

      payoutAccountLast4: assembly.input.payoutAccountLast4,

      payBasis: assembly.input.payBasis,

      baseRate: assembly.input.baseRate,

      compensationSource: assembly.compensationSource,
    };

    if (!statutoryConfig.ready) {
      return {
        ...snapshots,

        ready: false,

        statutoryConfig,

        calculation: null,

        treatment: null,
      };
    }

    const calculation = calculateStatutoryPayroll(assembly.input, {
      core: buildPhilippineCorePayrollOptions(assembly.input),

      contributions: statutoryConfig.options.contributions,

      ...(statutoryConfig.options.tax
        ? {
            tax: statutoryConfig.options.tax,
          }
        : {}),

      ...(statutoryConfig.options.taxResolver
        ? {
            taxResolver: statutoryConfig.options.taxResolver,
          }
        : {}),
    });

    const resolvedTreatmentOptions = buildPhilippineEmployeeTreatmentOptions(
      assembly.input,
      calculation,
      treatmentOptions,
    );

    const treatment = calculateEmployeePayrollTreatment(
      assembly.input,
      calculation,
      resolvedTreatmentOptions,
    );

    return {
      ...snapshots,

      ready: treatment.status === 'COMPLETE',

      statutoryConfig,

      calculation,

      treatment,
    };
  }
}
