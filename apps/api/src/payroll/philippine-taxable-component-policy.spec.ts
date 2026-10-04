import type { PayrollComputedLineItem } from '@payroll/payroll-engine';

import { resolvePhilippineComponentTaxTreatment } from './philippine-taxable-component-policy';

function earning(
  code: string,
  source: string,
  options: {
    taxable?: boolean | null;
    metadata?: Readonly<Record<string, unknown>>;
  } = {},
): PayrollComputedLineItem {
  return {
    category: 'EARNING',
    code,
    description: code,
    quantity: null,
    rate: null,
    amount: '100.00',
    taxable: options.taxable ?? null,
    metadata: {
      source,
      ...(options.metadata ?? {}),
    },
  };
}

describe('Philippine taxable-component policy', () => {
  it('exempts MWE basic statutory wage', () => {
    expect(
      resolvePhilippineComponentTaxTreatment(
        'MWE',
        earning('BASIC_PAY', 'ATTENDANCE_REGULAR_MINUTES'),
      ).treatment,
    ).toBe('EXEMPT');
  });

  it('taxes NON_MWE basic pay', () => {
    expect(
      resolvePhilippineComponentTaxTreatment(
        'NON_MWE',
        earning('BASIC_PAY', 'ATTENDANCE_REGULAR_MINUTES'),
      ).treatment,
    ).toBe('TAXABLE');
  });

  it('exempts MWE holiday premium', () => {
    expect(
      resolvePhilippineComponentTaxTreatment(
        'MWE',
        earning('PREMIUM_WORKDAY_REGULAR', 'ATTENDANCE_REGULAR_PREMIUM', {
          metadata: {
            holidayType: 'REGULAR',
            restDay: false,
          },
        }),
      ).treatment,
    ).toBe('EXEMPT');
  });

  it('exempts MWE special non-working holiday premium', () => {
    expect(
      resolvePhilippineComponentTaxTreatment(
        'MWE',
        earning(
          'PREMIUM_WORKDAY_SPECIAL_NON_WORKING',
          'ATTENDANCE_REGULAR_PREMIUM',
          {
            metadata: {
              holidayType: 'SPECIAL_NON_WORKING',
              restDay: false,
            },
          },
        ),
      ).treatment,
    ).toBe('EXEMPT');
  });

  it('taxes MWE rest-day-only premium', () => {
    expect(
      resolvePhilippineComponentTaxTreatment(
        'MWE',
        earning('PREMIUM_REST_DAY_NO_HOLIDAY', 'ATTENDANCE_REGULAR_PREMIUM', {
          metadata: {
            holidayType: null,
            restDay: true,
          },
        }),
      ).treatment,
    ).toBe('TAXABLE');
  });

  it('exempts MWE overtime pay', () => {
    expect(
      resolvePhilippineComponentTaxTreatment(
        'MWE',
        earning('OVERTIME_REST_DAY', 'ATTENDANCE_OVERTIME'),
      ).treatment,
    ).toBe('EXEMPT');
  });

  it('exempts MWE night differential', () => {
    expect(
      resolvePhilippineComponentTaxTreatment(
        'MWE',
        earning('NIGHT_DIFFERENTIAL', 'ATTENDANCE_NIGHT_DIFFERENTIAL'),
      ).treatment,
    ).toBe('EXEMPT');
  });

  it('uses explicit recurring-allowance taxability', () => {
    expect(
      resolvePhilippineComponentTaxTreatment(
        'MWE',
        earning('ALLOWANCE', 'RECURRING_PAYROLL_ITEM', {
          taxable: true,
        }),
      ).treatment,
    ).toBe('TAXABLE');

    expect(
      resolvePhilippineComponentTaxTreatment(
        'MWE',
        earning('ALLOWANCE', 'RECURRING_PAYROLL_ITEM', {
          taxable: false,
        }),
      ).treatment,
    ).toBe('EXEMPT');
  });

  it('keeps MWE paid-leave tax treatment unresolved', () => {
    const result = resolvePhilippineComponentTaxTreatment(
      'MWE',
      earning('PAID_LEAVE_VL', 'ATTENDANCE_LEAVE'),
    );

    expect(result.treatment).toBe('UNRESOLVED');

    expect(result.reason).toMatch(/paid-leave/i);
  });

  it('keeps null earning-adjustment taxability unresolved', () => {
    const item: PayrollComputedLineItem = {
      category: 'ADJUSTMENT',
      code: 'ADJ',
      description: 'Adjustment',
      quantity: null,
      rate: null,
      amount: '100.00',
      taxable: null,
      metadata: {
        source: 'PAYROLL_ADJUSTMENT',
        adjustmentType: 'EARNING',
      },
    };

    expect(
      resolvePhilippineComponentTaxTreatment('NON_MWE', item).treatment,
    ).toBe('UNRESOLVED');
  });
});
