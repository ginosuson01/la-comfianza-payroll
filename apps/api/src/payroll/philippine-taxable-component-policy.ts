import type { PayrollComputedLineItem } from '@payroll/payroll-engine';

import type { PhilippineMinimumWageClassification } from './philippine-minimum-wage-policy';

export type PhilippineComponentTaxTreatment =
  'TAXABLE' | 'EXEMPT' | 'IGNORE' | 'UNRESOLVED';

export interface PhilippineComponentTaxResolution {
  treatment: PhilippineComponentTaxTreatment;

  reason: string | null;
}

export function resolvePhilippineComponentTaxTreatment(
  classification: Exclude<PhilippineMinimumWageClassification, 'UNRESOLVED'>,
  lineItem: PayrollComputedLineItem,
): PhilippineComponentTaxResolution {
  /*
   * Only earning-side components contribute positively
   * to taxable compensation.
   */
  if (lineItem.category !== 'EARNING' && lineItem.category !== 'ADJUSTMENT') {
    return resolved('IGNORE');
  }

  if (lineItem.category === 'ADJUSTMENT') {
    const adjustmentType = lineItem.metadata?.['adjustmentType'];

    if (adjustmentType !== 'EARNING') {
      return resolved('IGNORE');
    }

    if (lineItem.taxable === true) {
      return resolved('TAXABLE');
    }

    if (lineItem.taxable === false) {
      return resolved('EXEMPT');
    }

    return unresolved(
      `Taxability is unresolved for earning adjustment ${lineItem.code}.`,
    );
  }

  const source = lineItem.metadata?.['source'];

  const sourceLabel = typeof source === 'string' ? source : 'UNKNOWN';

  /*
   * Recurring allowances already carry explicit
   * employee/company-configured taxability.
   */
  if (source === 'RECURRING_PAYROLL_ITEM') {
    if (lineItem.taxable === true) {
      return resolved('TAXABLE');
    }

    if (lineItem.taxable === false) {
      return resolved('EXEMPT');
    }

    return unresolved(
      `Taxability is unresolved for recurring earning ${lineItem.code}.`,
    );
  }

  /*
   * NON_MWE core compensation is taxable unless an
   * explicit component-level exemption says otherwise.
   *
   * The currently implemented core earning sources below
   * do not yet model other statutory exemptions such as
   * de minimis benefits.
   */
  if (classification === 'NON_MWE') {
    switch (source) {
      case 'ATTENDANCE_REGULAR_MINUTES':
      case 'CONFIGURED_MONTHLY_CUTOFF_AMOUNT':
      case 'ATTENDANCE_LEAVE':
      case 'ATTENDANCE_REGULAR_PREMIUM':
      case 'ATTENDANCE_OVERTIME':
      case 'ATTENDANCE_NIGHT_DIFFERENTIAL':
        return resolved('TAXABLE');

      default:
        return unresolved(
          `Tax treatment is not defined for earning ${lineItem.code} from source ${sourceLabel}.`,
        );
    }
  }

  /*
   * MWE statutory minimum-wage basic compensation is
   * exempt.
   */
  if (lineItem.code === 'BASIC_PAY') {
    return resolved('EXEMPT');
  }

  /*
   * BIR expressly exempts MWE overtime pay regardless of
   * whether the overtime occurs on an ordinary day,
   * rest day, or holiday.
   */
  if (source === 'ATTENDANCE_OVERTIME') {
    return resolved('EXEMPT');
  }

  /*
   * BIR expressly exempts MWE night-shift differential.
   */
  if (source === 'ATTENDANCE_NIGHT_DIFFERENTIAL') {
    return resolved('EXEMPT');
  }

  if (source === 'ATTENDANCE_REGULAR_PREMIUM') {
    const holidayType = lineItem.metadata?.['holidayType'];

    /*
     * Holiday premium is exempt for an MWE.
     */
    if (holidayType === 'REGULAR' || holidayType === 'SPECIAL_NON_WORKING') {
      return resolved('EXEMPT');
    }

    /*
     * A rest-day-only premium is not one of the MWE
     * exemptions enumerated by BIR.
     *
     * SPECIAL_WORKING follows ordinary-day treatment;
     * when it coincides with a rest day, the additional
     * amount is a rest-day premium.
     */
    const restDay = lineItem.metadata?.['restDay'];

    if (
      restDay === true &&
      (holidayType === null ||
        holidayType === undefined ||
        holidayType === 'SPECIAL_WORKING')
    ) {
      return resolved('TAXABLE');
    }

    return unresolved(
      `MWE premium tax treatment is unresolved for ${lineItem.code}.`,
    );
  }

  /*
   * Paid leave taken by an MWE is deliberately not being
   * treated as statutory minimum wage, holiday pay,
   * overtime, night differential, or monetized unused
   * vacation leave without an explicit approved rule.
   */
  if (source === 'ATTENDANCE_LEAVE') {
    return unresolved(
      `MWE paid-leave tax treatment is unresolved for ${lineItem.code}.`,
    );
  }

  return unresolved(
    `MWE tax treatment is not defined for earning ${lineItem.code} from source ${sourceLabel}.`,
  );
}

function resolved(
  treatment: 'TAXABLE' | 'EXEMPT' | 'IGNORE',
): PhilippineComponentTaxResolution {
  return {
    treatment,

    reason: null,
  };
}

function unresolved(reason: string): PhilippineComponentTaxResolution {
  return {
    treatment: 'UNRESOLVED',

    reason,
  };
}
