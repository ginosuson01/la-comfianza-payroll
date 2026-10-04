import {
  resolvePhilippineMinimumWageClassification,
  resolvePhilippineMinimumWageClassificationAtDate,
  type ResolvePhilippineMinimumWageClassificationInput,
} from './philippine-minimum-wage-policy';

function createInput(
  overrides: Partial<ResolvePhilippineMinimumWageClassificationInput> = {},
): ResolvePhilippineMinimumWageClassificationInput {
  return {
    payBasis: 'DAILY',

    baseRate: '600.0000',

    cutoffStartDate: '2026-09-16',

    cutoffEndDate: '2026-09-30',

    configSnapshot: {
      statutory: {
        minimumWage: {
          regionCode: 'IVA',

          wageOrderCode: 'SYNTHETIC-WAGE-ORDER',

          areaClassification: 'Synthetic area classification',

          sector: 'Synthetic sector',

          dailyRate: '600.00',

          rateEffectiveFrom: '2026-01-01',
        },
      },
    },

    ...overrides,
  };
}

describe('Philippine minimum-wage classification policy', () => {
  it('classifies an equal daily rate as MWE using exact fixed-decimal comparison', () => {
    const result = resolvePhilippineMinimumWageClassification(
      createInput({
        baseRate: '600.0000',
      }),
    );

    expect(result.classification).toBe('MWE');

    expect(result.minimumWage?.dailyRate).toBe('600.0000');

    expect(result.reason).toBeNull();
  });

  it('classifies a daily rate above the statutory minimum as NON_MWE', () => {
    const result = resolvePhilippineMinimumWageClassification(
      createInput({
        baseRate: '650.0000',
      }),
    );

    expect(result.classification).toBe('NON_MWE');

    expect(result.reason).toBeNull();
  });

  it('classifies a daily rate below the configured statutory wage as MWE', () => {
    const result = resolvePhilippineMinimumWageClassification(
      createInput({
        baseRate: '599.9900',
      }),
    );

    expect(result.classification).toBe('MWE');

    expect(result.reason).toBeNull();
  });

  it('classifies from the Phase 1 minimum-wage core without optional reference fields', () => {
    const result = resolvePhilippineMinimumWageClassification(
      createInput({
        baseRate: '500.0000',

        configSnapshot: {
          statutory: {
            minimumWage: {
              dailyRate: '600.00',
              rateEffectiveFrom: '2026-01-01',
            },
          },
        },
      }),
    );

    expect(result.classification).toBe('MWE');

    expect(result.minimumWage).toEqual({
      dailyRate: '600.0000',
      rateEffectiveFrom: '2026-01-01',
    });

    expect(result.reason).toBeNull();
  });

  it('keeps MONTHLY compensation unresolved until an approved daily-equivalence rule exists', () => {
    const result = resolvePhilippineMinimumWageClassification(
      createInput({
        payBasis: 'MONTHLY',

        baseRate: '30000.0000',
      }),
    );

    expect(result.classification).toBe('UNRESOLVED');

    expect(result.reason).toMatch(/monthly-to-daily/i);
  });

  it('keeps classification unresolved when minimum-wage configuration is missing', () => {
    const result = resolvePhilippineMinimumWageClassification(
      createInput({
        configSnapshot: {},
      }),
    );

    expect(result.classification).toBe('UNRESOLVED');

    expect(result.minimumWage).toBeNull();

    expect(result.reason).toMatch(/not configured/i);
  });

  it('keeps classification unresolved when the configured wage rate begins inside the cutoff', () => {
    const result = resolvePhilippineMinimumWageClassification(
      createInput({
        configSnapshot: {
          statutory: {
            minimumWage: {
              regionCode: 'IVA',

              wageOrderCode: 'SYNTHETIC-WAGE-ORDER',

              areaClassification: 'Synthetic area classification',

              sector: 'Synthetic sector',

              dailyRate: '600.00',

              rateEffectiveFrom: '2026-09-20',
            },
          },
        },
      }),
    );

    expect(result.classification).toBe('UNRESOLVED');

    expect(result.reason).toMatch(
      /does not cover the complete payroll cutoff/i,
    );
  });

  it('classifies an equal daily rate as MWE on an as-of date', () => {
    const input = createInput();

    const result = resolvePhilippineMinimumWageClassificationAtDate({
      payBasis: input.payBasis,
      baseRate: '600.0000',
      asOfDate: '2026-09-23',
      configSnapshot: input.configSnapshot,
    });

    expect(result.classification).toBe('MWE');
    expect(result.minimumWage?.dailyRate).toBe('600.0000');
    expect(result.reason).toBeNull();
  });

  it('classifies a lower daily rate as MWE on an as-of date', () => {
    const input = createInput();

    const result = resolvePhilippineMinimumWageClassificationAtDate({
      payBasis: input.payBasis,
      baseRate: '500.0000',
      asOfDate: '2026-09-23',
      configSnapshot: input.configSnapshot,
    });

    expect(result.classification).toBe('MWE');
    expect(result.reason).toBeNull();
  });

  it('classifies a higher daily rate as NON_MWE on an as-of date', () => {
    const input = createInput();

    const result = resolvePhilippineMinimumWageClassificationAtDate({
      payBasis: input.payBasis,
      baseRate: '650.0000',
      asOfDate: '2026-09-23',
      configSnapshot: input.configSnapshot,
    });

    expect(result.classification).toBe('NON_MWE');
    expect(result.reason).toBeNull();
  });

  it('keeps classification unresolved before the wage rate effective date', () => {
    const input = createInput({
      configSnapshot: {
        statutory: {
          minimumWage: {
            regionCode: 'IVA',
            wageOrderCode: 'SYNTHETIC-WAGE-ORDER',
            areaClassification: 'Synthetic area classification',
            sector: 'Synthetic sector',
            dailyRate: '600.00',
            rateEffectiveFrom: '2026-10-01',
          },
        },
      },
    });

    const result = resolvePhilippineMinimumWageClassificationAtDate({
      payBasis: input.payBasis,
      baseRate: input.baseRate,
      asOfDate: '2026-09-23',
      configSnapshot: input.configSnapshot,
    });

    expect(result.classification).toBe('UNRESOLVED');
    expect(result.reason).toMatch(/not yet effective/i);
  });

  it('keeps an incomplete legacy minimum-wage snapshot unresolved', () => {
    const result = resolvePhilippineMinimumWageClassification(
      createInput({
        configSnapshot: {
          statutory: {
            minimumWage: {
              regionCode: 'IVA',

              dailyRate: '600.00',
            },
          },
        },
      }),
    );

    expect(result.classification).toBe('UNRESOLVED');

    expect(result.minimumWage).toBeNull();
  });
});
