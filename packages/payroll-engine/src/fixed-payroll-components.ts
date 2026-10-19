import {
  formatMoney,
  parseMoney,
} from './fixed-decimal.ts';

import {
  validatePayrollCalculationInput,
  type PayrollCalculationInput,
  type PayrollComputedLineItem,
} from './payroll-calculation.ts';

export interface FixedPayrollComponentsResult {
  allowancesTotal: string;

  taxableAllowancesTotal: string;

  fixedDeductionsTotal: string;

  earningAdjustmentsTotal: string;

  deductionAdjustmentsTotal: string;

  additionalEarningsTotal: string;

  otherDeductionsTotal: string;

  lineItems: readonly PayrollComputedLineItem[];
}

export function calculateFixedPayrollComponents(
  input: PayrollCalculationInput,
): FixedPayrollComponentsResult {
  validatePayrollCalculationInput(input);

  let allowancesTotal = 0n;

  let taxableAllowancesTotal = 0n;

  let fixedDeductionsTotal = 0n;

  let earningAdjustmentsTotal = 0n;

  let deductionAdjustmentsTotal = 0n;

  const lineItems: PayrollComputedLineItem[] = [];

  for (const item of input.recurringItems) {
    const amount = parseMoney(item.amount);

    if (item.kind === 'ALLOWANCE') {
      allowancesTotal += amount;

      if (item.taxable) {
        taxableAllowancesTotal += amount;
      }

      lineItems.push({
        category: 'EARNING',

        code: item.code,

        description: item.description,

        quantity: null,

        rate: null,

        amount: formatMoney(amount),

        taxable: item.taxable,

        metadata: {
          source: 'RECURRING_PAYROLL_ITEM',
          recurringItemKind: item.kind,
          pagIbigFundSalaryTreatment:
            item.pagIbigFundSalaryTreatment ?? null,
        },
      });

      continue;
    }

    fixedDeductionsTotal += amount;

    lineItems.push({
      category: 'DEDUCTION',

      code: item.code,

      description: item.description,

      quantity: null,

      rate: null,

      amount: formatMoney(amount),

      taxable: item.taxable,

      metadata: {
        source: 'RECURRING_PAYROLL_ITEM',
        recurringItemKind: item.kind,
        pagIbigFundSalaryTreatment:
          item.pagIbigFundSalaryTreatment ?? null,
      },
    });
  }

  for (const adjustment of input.adjustments) {
    const amount = parseMoney(adjustment.amount);

    if (adjustment.type === 'EARNING') {
      earningAdjustmentsTotal += amount;
    } else {
      deductionAdjustmentsTotal += amount;
    }

    lineItems.push({
      category: 'ADJUSTMENT',

      code: adjustment.code,

      description: adjustment.description,

      quantity: null,

      rate: null,

      amount: formatMoney(amount),

      taxable: adjustment.taxable,

      metadata: {
        source: 'PAYROLL_ADJUSTMENT',
        adjustmentType: adjustment.type,
        pagIbigFundSalaryTreatment:
          adjustment.pagIbigFundSalaryTreatment ?? null,
        reason: adjustment.reason,
      },
    });
  }

  return {
    allowancesTotal:
      formatMoney(allowancesTotal),

    taxableAllowancesTotal:
      formatMoney(taxableAllowancesTotal),

    fixedDeductionsTotal:
      formatMoney(fixedDeductionsTotal),

    earningAdjustmentsTotal:
      formatMoney(earningAdjustmentsTotal),

    deductionAdjustmentsTotal:
      formatMoney(deductionAdjustmentsTotal),

    additionalEarningsTotal:
      formatMoney(
        allowancesTotal +
          earningAdjustmentsTotal,
      ),

    otherDeductionsTotal:
      formatMoney(
        fixedDeductionsTotal +
          deductionAdjustmentsTotal,
      ),

    lineItems,
  };
}
