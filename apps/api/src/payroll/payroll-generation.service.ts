import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import {
  PayrollCutoffStatus,
  PayrollLineCategory,
  PayrollRunStatus,
  type Prisma,
} from '@payroll/database';

import type {
  PayrollComputedLineItem,
  PayrollEngineLineCategory,
} from '@payroll/payroll-engine';

import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';

import {
  PayrollCutoffCalculationService,
  type EmployeeTreatmentOptionsByEmployeeId,
  type PayrollCutoffCalculationPreflight,
} from './payroll-cutoff-calculation.service';

export interface GenerateInitialPayrollInput {
  companyId: string;

  payrollCutoffId: string;

  actorUserId: string;

  treatmentOptionsByEmployeeId?: EmployeeTreatmentOptionsByEmployeeId;
}

export interface RegeneratePayrollInput {
  companyId: string;

  payrollCutoffId: string;

  actorUserId: string;

  treatmentOptionsByEmployeeId?: EmployeeTreatmentOptionsByEmployeeId;
}

export interface GeneratedPayrollRunResult {
  id: string;

  companyId: string;

  payrollCutoffId: string;

  version: number;

  status: PayrollRunStatus;

  employeeCount: number;

  totalGross: string;

  totalNet: string;

  cashPayoutTotal: string;

  atmPayoutTotal: string;

  activeHoldTotal: string;

  clientPayableGross: null;
}

type ReadyPayrollCutoffCalculationPreflight =
  PayrollCutoffCalculationPreflight & {
    ready: true;

    companyPayrollSetupVersionId: string;

    configSnapshot: NonNullable<
      PayrollCutoffCalculationPreflight['configSnapshot']
    >;

    totals: NonNullable<PayrollCutoffCalculationPreflight['totals']>;
  };

interface LockedPayrollCutoffState {
  id: string;

  status: PayrollCutoffStatus;
}

interface PersistedPayrollRun {
  id: string;

  companyId: string;

  payrollCutoffId: string;

  version: number;

  status: PayrollRunStatus;
}

@Injectable()
export class PayrollGenerationService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly auditLog: AuditLogService,

    private readonly cutoffCalculation: PayrollCutoffCalculationService,
  ) {}

  async generateInitialPayroll(
    input: GenerateInitialPayrollInput,
  ): Promise<GeneratedPayrollRunResult> {
    const preflight = await this.cutoffCalculation.calculateCutoffPreflight(
      input.companyId,
      input.payrollCutoffId,
      input.treatmentOptionsByEmployeeId ?? {},
    );

    this.assertPreflightReady(preflight);

    const lockedAt = new Date();

    return this.prisma.$transaction(async (transaction) => {
      await this.lockCutoffForGeneration(
        transaction,
        input.companyId,
        input.payrollCutoffId,
        PayrollCutoffStatus.OPEN,
      );

      /*
       * Recalculate while the cutoff row lock is held.
       *
       * Payroll adjustments use the same cutoff row lock before
       * mutation, so no adjustment can commit between this
       * authoritative preflight and the cutoff LOCKED transition.
       */
      const lockedPreflight =
        await this.cutoffCalculation.calculateCutoffPreflight(
          input.companyId,
          input.payrollCutoffId,
          input.treatmentOptionsByEmployeeId ?? {},
        );

      this.assertPreflightReady(lockedPreflight);

      /*
       * Step 20.5 initial generation accepts only a cutoff
       * that has never entered payroll history.
       */
      const existingRun = await transaction.payrollRun.findFirst({
        where: {
          payrollCutoffId: input.payrollCutoffId,
        },

        select: {
          id: true,
          version: true,
          status: true,
        },
      });

      if (existingRun) {
        throw new ConflictException(
          `Payroll cutoff already has payroll run version ${existingRun.version}. Regeneration must use the regeneration flow.`,
        );
      }

      /*
       * Compare-and-set OPEN -> LOCKED.
       */
      const cutoffLock = await transaction.payrollCutoff.updateMany({
        where: {
          id: input.payrollCutoffId,

          companyId: input.companyId,

          status: PayrollCutoffStatus.OPEN,
        },

        data: {
          status: PayrollCutoffStatus.LOCKED,

          lockedAt,
        },
      });

      if (cutoffLock.count !== 1) {
        throw new ConflictException(
          'Payroll cutoff is no longer OPEN and cannot be generated as an initial payroll run.',
        );
      }

      const payrollRun = await this.persistPayrollRun(
        transaction,
        lockedPreflight,
        input.actorUserId,
        1,
      );

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId: input.actorUserId,

        companyId: input.companyId,

        action: 'PAYROLL_GENERATED',

        module: 'PAYROLL',

        entityType: 'PAYROLL_RUN',

        entityId: payrollRun.id,

        reference: `${lockedPreflight.cutoff.startDate} to ${lockedPreflight.cutoff.endDate}`,

        details:
          `Generated and locked payroll run version 1 for cutoff ` +
          `${lockedPreflight.cutoff.startDate} to ${lockedPreflight.cutoff.endDate}.`,

        metadata: {
          payrollCutoffId: input.payrollCutoffId,

          version: 1,

          employeeCount: lockedPreflight.employees.length,

          totalGross: lockedPreflight.totals.totalGross,

          totalNet: lockedPreflight.totals.totalNetBeforeStatusTreatment,

          cashPayoutTotal: lockedPreflight.totals.cashPayoutTotal,

          atmPayoutTotal: lockedPreflight.totals.atmPayoutTotal,

          activeHoldTotal: lockedPreflight.totals.heldAmountTotal,

          clientPayableGrossResolved: false,

          cutoffStatus: PayrollCutoffStatus.LOCKED,

          lockedAt: lockedAt.toISOString(),
        },
      });

      return this.buildGeneratedResult(payrollRun, lockedPreflight);
    });
  }

  async regeneratePayroll(
    input: RegeneratePayrollInput,
  ): Promise<GeneratedPayrollRunResult> {
    const preflight = await this.cutoffCalculation.calculateCutoffPreflight(
      input.companyId,
      input.payrollCutoffId,
      input.treatmentOptionsByEmployeeId ?? {},
    );

    this.assertPreflightReady(preflight);

    /*
     * Regeneration is valid only after explicit reopening.
     *
     * The transaction below repeats this protection using
     * compare-and-set so this preflight state check is not
     * relied upon for concurrency correctness.
     */
    if (preflight.cutoff.status !== PayrollCutoffStatus.REOPENED) {
      throw new ConflictException(
        'Payroll cutoff must be REOPENED before payroll can be regenerated.',
      );
    }

    const lockedAt = new Date();

    return this.prisma.$transaction(async (transaction) => {
      await this.lockCutoffForGeneration(
        transaction,
        input.companyId,
        input.payrollCutoffId,
        PayrollCutoffStatus.REOPENED,
      );

      /*
       * Recalculate while the REOPENED cutoff row lock is held.
       *
       * This guarantees that any payroll adjustment committed
       * before this lock is included, while later adjustment
       * mutations must wait and will see LOCKED after commit.
       */
      const lockedPreflight =
        await this.cutoffCalculation.calculateCutoffPreflight(
          input.companyId,
          input.payrollCutoffId,
          input.treatmentOptionsByEmployeeId ?? {},
        );

      this.assertPreflightReady(lockedPreflight);

      if (lockedPreflight.cutoff.status !== PayrollCutoffStatus.REOPENED) {
        throw new ConflictException(
          'Payroll cutoff must remain REOPENED during payroll regeneration.',
        );
      }

      /*
       * The run that was current before reopening must have
       * been moved by Step 20.6A to
       * REOPENED_PENDING_REGENERATION.
       */
      const previousRun = await transaction.payrollRun.findFirst({
        where: {
          payrollCutoffId: input.payrollCutoffId,

          status: PayrollRunStatus.REOPENED_PENDING_REGENERATION,
        },

        orderBy: {
          version: 'desc',
        },

        select: {
          id: true,
          version: true,
          status: true,
        },
      });

      if (!previousRun) {
        throw new ConflictException(
          'Payroll cutoff does not have a payroll run pending regeneration.',
        );
      }

      const nextVersion = previousRun.version + 1;

      /*
       * Compare-and-set REOPENED -> LOCKED.
       *
       * This prevents two concurrent regeneration requests
       * from both creating a new payroll version.
       */
      const cutoffLock = await transaction.payrollCutoff.updateMany({
        where: {
          id: input.payrollCutoffId,

          companyId: input.companyId,

          status: PayrollCutoffStatus.REOPENED,
        },

        data: {
          status: PayrollCutoffStatus.LOCKED,

          lockedAt,
        },
      });

      if (cutoffLock.count !== 1) {
        throw new ConflictException(
          'Payroll cutoff is no longer REOPENED and cannot be regenerated.',
        );
      }

      /*
       * Preserve the prior run permanently, but it is no
       * longer the current locked version once regeneration
       * succeeds.
       */
      const previousRunUpdate = await transaction.payrollRun.updateMany({
        where: {
          id: previousRun.id,

          status: PayrollRunStatus.REOPENED_PENDING_REGENERATION,
        },

        data: {
          status: PayrollRunStatus.SUPERSEDED,
        },
      });

      if (previousRunUpdate.count !== 1) {
        throw new ConflictException(
          'Previous payroll run changed while regeneration was being processed.',
        );
      }

      /*
       * Create a completely new frozen payroll version.
       *
       * If anything below fails, the transaction rolls back
       * the cutoff lock and SUPERSEDED transition as well.
       */
      const payrollRun = await this.persistPayrollRun(
        transaction,
        lockedPreflight,
        input.actorUserId,
        nextVersion,
      );

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId: input.actorUserId,

        companyId: input.companyId,

        action: 'PAYROLL_REGENERATED',

        module: 'PAYROLL',

        entityType: 'PAYROLL_RUN',

        entityId: payrollRun.id,

        reference: `${lockedPreflight.cutoff.startDate} to ${lockedPreflight.cutoff.endDate}`,

        details:
          `Regenerated payroll run version ${nextVersion} for cutoff ` +
          `${lockedPreflight.cutoff.startDate} to ${lockedPreflight.cutoff.endDate}. ` +
          `Payroll run version ${previousRun.version} was superseded.`,

        metadata: {
          payrollCutoffId: input.payrollCutoffId,

          previousPayrollRunId: previousRun.id,

          previousVersion: previousRun.version,

          previousRunStatus: PayrollRunStatus.SUPERSEDED,

          newPayrollRunId: payrollRun.id,

          newVersion: nextVersion,

          newRunStatus: PayrollRunStatus.CURRENT_LOCKED,

          employeeCount: lockedPreflight.employees.length,

          totalGross: lockedPreflight.totals.totalGross,

          totalNet: lockedPreflight.totals.totalNetBeforeStatusTreatment,

          cashPayoutTotal: lockedPreflight.totals.cashPayoutTotal,

          atmPayoutTotal: lockedPreflight.totals.atmPayoutTotal,

          activeHoldTotal: lockedPreflight.totals.heldAmountTotal,

          clientPayableGrossResolved: false,

          cutoffStatus: PayrollCutoffStatus.LOCKED,

          lockedAt: lockedAt.toISOString(),
        },
      });

      return this.buildGeneratedResult(payrollRun, lockedPreflight);
    });
  }

  private async persistPayrollRun(
    transaction: Prisma.TransactionClient,
    preflight: ReadyPayrollCutoffCalculationPreflight,
    actorUserId: string,
    version: number,
  ): Promise<PersistedPayrollRun> {
    const payrollRun = await transaction.payrollRun.create({
      data: {
        companyId: preflight.companyId,

        payrollCutoffId: preflight.payrollCutoffId,

        companyPayrollSetupVersionId: preflight.companyPayrollSetupVersionId,

        version,

        status: PayrollRunStatus.CURRENT_LOCKED,

        generatedByUserId: actorUserId,

        configSnapshot:
          preflight.configSnapshot as unknown as Prisma.InputJsonValue,

        companySnapshot: preflight.company as unknown as Prisma.InputJsonValue,

        totalGross: preflight.totals.totalGross,

        totalNet: preflight.totals.totalNetBeforeStatusTreatment,

        clientPayableGross: null,

        cashPayoutTotal: preflight.totals.cashPayoutTotal,

        atmPayoutTotal: preflight.totals.atmPayoutTotal,

        activeHoldTotal: preflight.totals.heldAmountTotal,
      },

      select: {
        id: true,

        companyId: true,

        payrollCutoffId: true,

        version: true,

        status: true,
      },
    });

    for (const employee of preflight.employees) {
      const calculation = employee.calculation;

      const treatment = employee.treatment;

      if (
        !employee.ready ||
        !calculation ||
        calculation.status !== 'COMPLETE' ||
        !treatment ||
        treatment.status !== 'COMPLETE'
      ) {
        throw new Error(
          `Payroll-ready preflight contains incomplete employee ${employee.employeeNumber}.`,
        );
      }

      const core = calculation.corePayroll;

      const basicPay = this.requireMoney(
        core.basicPay,
        employee.employeeNumber,
        'basic pay',
      );

      const premiumPayTotal = this.requireMoney(
        core.premiumPayTotal,
        employee.employeeNumber,
        'premium pay total',
      );

      const grossPay = this.requireMoney(
        core.grossPay,
        employee.employeeNumber,
        'gross pay',
      );

      const otherDeductionsTotal = this.requireMoney(
        core.otherDeductionsTotal,
        employee.employeeNumber,
        'other deductions total',
      );

      const governmentContributionsTotal = this.requireMoney(
        calculation.governmentContributionsTotal,
        employee.employeeNumber,
        'government contributions total',
      );

      const taxTotal = this.requireMoney(
        calculation.taxTotal,
        employee.employeeNumber,
        'tax total',
      );

      const totalDeductions = this.requireMoney(
        calculation.totalDeductions,
        employee.employeeNumber,
        'total deductions',
      );

      const netPay = this.requireMoney(
        calculation.netPayBeforeStatusTreatment,
        employee.employeeNumber,
        'net pay',
      );

      const cashPayout = this.requireMoney(
        treatment.cashPayout,
        employee.employeeNumber,
        'cash payout',
      );

      const atmPayout = this.requireMoney(
        treatment.atmPayout,
        employee.employeeNumber,
        'ATM payout',
      );

      const heldAmount = this.requireMoney(
        treatment.heldAmount,
        employee.employeeNumber,
        'held amount',
      );

      const taxableCompensation = calculation.taxableCompensation ?? '0.00';

      const withholdingTax = calculation.withholdingTax ?? '0.00';

      const employeeResult = await transaction.payrollRunEmployee.create({
        data: {
          payrollRunId: payrollRun.id,

          employeeId: employee.employeeId,

          employmentRecordId: employee.employmentRecordId,

          employeeNumberSnapshot: employee.employeeNumber,

          employeeNameSnapshot: employee.employeeName,

          positionSnapshot: employee.positionSnapshot,

          departmentSnapshot: employee.departmentSnapshot,

          payrollStatusSnapshot: employee.payrollStatus,

          payoutMethodSnapshot: employee.payoutMethod,

          payoutAccountLast4Snapshot: employee.payoutAccountLast4,

          payBasisSnapshot: employee.payBasis,

          baseRateSnapshot: employee.baseRate,

          compensationSourceSnapshot: employee.compensationSource,

          basicPay,

          allowancesTotal: core.allowancesTotal,

          premiumPayTotal,

          grossPay,

          governmentContributionsTotal,

          taxTotal,

          otherDeductionsTotal,

          totalDeductions,

          /*
           * Net pay remains the calculated amount before
           * ACTIVE/HOLD/RESIGNED disposition.
           */
          netPay,

          cashPayout,

          atmPayout,

          heldAmount,

          clientPayableGross: null,

          taxableCompensation,

          withholdingTax,

          thirteenthMonthPay: treatment.thirteenthMonthPay ?? '0.00',

          lastPayAmount: treatment.lastPayAmount ?? '0.00',

          isLastPay: treatment.isLastPay ?? false,
        },

        select: {
          id: true,
        },
      });

      if (treatment.lineItems.length > 0) {
        await transaction.payrollLineItem.createMany({
          data: treatment.lineItems.map((lineItem, index) => ({
            payrollRunEmployeeId: employeeResult.id,

            category: this.toDatabaseLineCategory(lineItem.category),

            code: lineItem.code,

            description: lineItem.description,

            quantity: lineItem.quantity,

            rate: lineItem.rate,

            amount: lineItem.amount,

            sequence: index + 1,

            ...this.lineItemMetadata(lineItem),
          })),
        });
      }
    }

    return payrollRun;
  }

  private buildGeneratedResult(
    payrollRun: PersistedPayrollRun,
    preflight: ReadyPayrollCutoffCalculationPreflight,
  ): GeneratedPayrollRunResult {
    return {
      id: payrollRun.id,

      companyId: payrollRun.companyId,

      payrollCutoffId: payrollRun.payrollCutoffId,

      version: payrollRun.version,

      status: payrollRun.status,

      employeeCount: preflight.employees.length,

      totalGross: preflight.totals.totalGross,

      totalNet: preflight.totals.totalNetBeforeStatusTreatment,

      cashPayoutTotal: preflight.totals.cashPayoutTotal,

      atmPayoutTotal: preflight.totals.atmPayoutTotal,

      activeHoldTotal: preflight.totals.heldAmountTotal,

      clientPayableGross: null,
    };
  }

  private async lockCutoffForGeneration(
    transaction: Prisma.TransactionClient,
    companyId: string,
    payrollCutoffId: string,
    expectedStatus: PayrollCutoffStatus,
  ): Promise<void> {
    const rows = await transaction.$queryRaw<LockedPayrollCutoffState[]>`
      SELECT
        "id",
        "status"
      FROM "payroll_cutoffs"
      WHERE "id" = CAST(${payrollCutoffId} AS uuid)
        AND "companyId" = CAST(${companyId} AS uuid)
      FOR UPDATE
    `;

    const cutoff = rows[0];

    if (!cutoff || cutoff.status !== expectedStatus) {
      throw new ConflictException(
        `Payroll cutoff is no longer ${expectedStatus}.`,
      );
    }
  }

  private assertPreflightReady(
    preflight: PayrollCutoffCalculationPreflight,
  ): asserts preflight is ReadyPayrollCutoffCalculationPreflight {
    if (
      !preflight.ready ||
      !preflight.companyPayrollSetupVersionId ||
      !preflight.configSnapshot ||
      !preflight.totals
    ) {
      throw new BadRequestException(
        'Payroll cutoff is not ready for generation.',
      );
    }
  }

  private requireMoney(
    value: string | null,
    employeeNumber: string,
    fieldName: string,
  ): string {
    if (value === null) {
      throw new Error(
        `Payroll-ready employee ${employeeNumber} is missing ${fieldName}.`,
      );
    }

    return value;
  }

  private toDatabaseLineCategory(
    category: PayrollEngineLineCategory,
  ): PayrollLineCategory {
    switch (category) {
      case 'EARNING':
        return PayrollLineCategory.EARNING;

      case 'DEDUCTION':
        return PayrollLineCategory.DEDUCTION;

      case 'CONTRIBUTION':
        return PayrollLineCategory.CONTRIBUTION;

      case 'TAX':
        return PayrollLineCategory.TAX;

      case 'ADJUSTMENT':
        return PayrollLineCategory.ADJUSTMENT;

      case 'INFORMATION':
        return PayrollLineCategory.INFORMATION;
    }
  }

  private lineItemMetadata(lineItem: PayrollComputedLineItem): {
    metadata?: Prisma.InputJsonValue;
  } {
    const metadata: Record<string, unknown> = {
      ...(lineItem.metadata ?? {}),
    };

    if (lineItem.taxable !== null) {
      metadata.taxable = lineItem.taxable;
    }

    if (Object.keys(metadata).length === 0) {
      return {};
    }

    return {
      metadata: metadata as Prisma.InputJsonValue,
    };
  }
}
