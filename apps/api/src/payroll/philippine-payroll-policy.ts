import {
  PHILIPPINE_DAILY_PREMIUM_OPTIONS,
  formatMoney,
  parseMoney,
  type CorePayrollCalculationOptions,
  type EmployeePayrollTreatmentOptions,
  type PayrollCalculationInput,
  type StatutoryPayrollCalculationResult,
} from '@payroll/payroll-engine';

/*
 * ============================================================
 * LA COMFIANZA / MT PHILIPPINE PAYROLL POLICY ADAPTER
 * ============================================================
 *
 * The payroll-engine remains generic and refuses to invent
 * company rules.
 *
 * This adapter supplies the client-approved Philippine rules
 * to the generic engine.
 */

const ACTIVE_HOLD_REASON =
  'One payroll cutoff is held in full while exit clearance is pending.';

export function buildPhilippineCorePayrollOptions(
  input: PayrollCalculationInput,
): CorePayrollCalculationOptions {
  /*
   * In the approved La Comfianza / MT workflow:
   *
   * - paid VL/SL is entered as Leave in the DTR;
   * - leave availability is already checked by the DTR /
   *   leave-balance workflow;
   * - unpaid leave is recorded as absence instead.
   *
   * Therefore every actual tracked Leave Type present in the
   * payroll-ready DTR is financially treated as PAID.
   */
  const leaveTreatmentByLeaveTypeId: Record<string, 'PAID'> = {};

  for (const leave of input.attendance.leaveBreakdown) {
    leaveTreatmentByLeaveTypeId[leave.leaveTypeId] = 'PAID';
  }

  return {
    attendance: {
      leaveTreatmentByLeaveTypeId,
    },

    /*
     * Philippine statutory daily-rated rest-day, holiday,
     * and overtime multipliers.
     *
     * LOCAL / OTHER holidays are intentionally not guessed.
     * They remain unresolved until Holiday Management carries
     * an explicit payroll classification.
     *
     * Night Differential is also intentionally not supplied
     * through the current generic flat-ND rule because the
     * correct 10% must use the applicable underlying
     * regular/rest-day/holiday/OT rate.
     */
    premium: PHILIPPINE_DAILY_PREMIUM_OPTIONS,
  };
}

export function buildPhilippineEmployeeTreatmentOptions(
  input: Pick<PayrollCalculationInput, 'payrollStatus'>,

  statutory: Pick<
    StatutoryPayrollCalculationResult,
    'netPayBeforeStatusTreatment'
  >,

  explicitOptions: EmployeePayrollTreatmentOptions = {},
): EmployeePayrollTreatmentOptions {
  /*
   * ACTIVE employees use ordinary payout.
   *
   * RESIGNED employees still require the Final Pay workflow
   * because Final Pay must combine:
   *
   * - the held cutoff,
   * - prorated 13th month,
   * - approved charges,
   * - government contributions,
   * - withholding tax.
   *
   * B2/B3 will assemble those historical/final-pay inputs.
   */
  if (input.payrollStatus !== 'ACTIVE_HOLD') {
    return explicitOptions;
  }

  const calculatedNet = statutory.netPayBeforeStatusTreatment;

  /*
   * If statutory payroll is incomplete or negative, preserve
   * the generic engine safeguards. The treatment engine will
   * surface the appropriate incomplete/review issue.
   */
  if (calculatedNet === null) {
    return explicitOptions;
  }

  const netAmount = parseMoney(calculatedNet);

  if (netAmount < 0n) {
    return explicitOptions;
  }

  /*
   * Approved business rule:
   *
   * When an employee is ACTIVE_HOLD for resignation/clearance,
   * one complete cutoff is withheld from payout.
   *
   * payable = 0
   * held    = full calculated net
   *
   * Any caller-provided partial hold is deliberately overridden.
   */
  return {
    ...explicitOptions,

    activeHold: {
      payableAmount: '0.00',

      heldAmount: formatMoney(netAmount),

      reason: ACTIVE_HOLD_REASON,
    },
  };
}
