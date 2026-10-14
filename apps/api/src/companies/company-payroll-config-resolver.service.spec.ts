import { CompanyPayrollConfigResolverService } from './company-payroll-config-resolver.service';
import { createValidGoldenPayrollTemplateConfig } from './golden-payroll-template.test-fixture';

describe('CompanyPayrollConfigResolverService', () => {
  const service = new CompanyPayrollConfigResolverService();

  it('produces a self-contained company payroll config from Golden plus company settings', () => {
    const golden = createValidGoldenPayrollTemplateConfig();

    const result = service.resolve(golden, {
      attendance: {
        standardWorkMinutesPerDay: 480,
      },

      statutory: {
        philHealth: {
          dailyWorkerScheduleDaysPerWeek: 5,
        },

        minimumWage: {
          regionCode: 'IVA',
          wageOrderCode: 'IVA-22',
          areaClassification: 'Synthetic test area',
          sector: 'Synthetic test sector',
          dailyRate: '600.00',
          rateEffectiveFrom: '2026-01-01',
        },
      },
    }) as Record<string, any>;

    expect(result.schemaVersion).toBe(1);
    expect(result.jurisdiction).toBe('PH');

    expect(result.attendance).toEqual({
      standardWorkMinutesPerDay: 480,
    });

    expect(result.statutory.sss.maximumMsc).toBe('35000.00');

    expect(result.statutory.philHealth).toEqual(
      expect.objectContaining({
        salaryFloor: '10000.00',
        salaryCeiling: '100000.00',
        premiumRate: '0.0500',
        dailyWorkerScheduleDaysPerWeek: 5,
      }),
    );

    expect(result.statutory.pagIbig.maximumFundSalary).toBe('10000.00');

    expect(
      result.statutory.tax.withholding.rules.SEMI_MONTHLY.brackets,
    ).toHaveLength(1);

    expect(result.statutory.minimumWage).toEqual({
      regionCode: 'IVA',
      wageOrderCode: 'IVA-22',
      areaClassification: 'Synthetic test area',
      sector: 'Synthetic test sector',
      dailyRate: '600.00',
      rateEffectiveFrom: '2026-01-01',
    });

    expect(result.statutory.premium.nightDifferentialRate).toBe('0.1000');
  });

  it('preserves Golden PhilHealth rules when company schedule is added', () => {
    const golden = createValidGoldenPayrollTemplateConfig();

    const result = service.resolve(golden, {
      attendance: {
        standardWorkMinutesPerDay: 480,
      },

      statutory: {
        philHealth: {
          dailyWorkerScheduleDaysPerWeek: 6,
        },
      },
    }) as Record<string, any>;

    expect(result.statutory.philHealth).toEqual(
      expect.objectContaining({
        effectiveFrom: '2025-01-01',
        salaryFloor: '10000.00',
        salaryCeiling: '100000.00',
        premiumRate: '0.0500',
        employeeShareRate: '0.5000',
        employerShareRate: '0.5000',
        oddCentavoRecipient: 'EMPLOYER',
        dailyWorkerScheduleDaysPerWeek: 6,
      }),
    );
  });

  it('does not invent company minimum-wage data when none is configured', () => {
    const golden = createValidGoldenPayrollTemplateConfig();

    const result = service.resolve(golden, {
      attendance: {
        standardWorkMinutesPerDay: 480,
      },
    }) as Record<string, any>;

    expect(result.statutory.minimumWage).toBeUndefined();

    expect(result.statutory.minimumWageReferences).toEqual(
      golden.statutory.minimumWageReferences,
    );
  });

  it('returns a detached JSON snapshot rather than Golden object references', () => {
    const golden = createValidGoldenPayrollTemplateConfig();

    const result = service.resolve(golden, {
      attendance: {
        standardWorkMinutesPerDay: 480,
      },
    }) as Record<string, any>;

    result.statutory.sss.maximumMsc = '99999.00';

    expect(golden.statutory.sss.maximumMsc).toBe('35000.00');
  });
});
