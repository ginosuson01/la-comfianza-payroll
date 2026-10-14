import { BadRequestException } from '@nestjs/common';

import { validateGoldenPayrollTemplateConfig } from './golden-payroll-template-config.validator';
import { createValidGoldenPayrollTemplateConfig } from './golden-payroll-template.test-fixture';

function validConfig() {
  return createValidGoldenPayrollTemplateConfig();
}

describe('validateGoldenPayrollTemplateConfig', () => {
  it('accepts the required Golden Payroll Template V1 structure', () => {
    const config = validConfig();

    expect(validateGoldenPayrollTemplateConfig(config)).toBe(config);
  });

  it('rejects an unsupported schema version', () => {
    const config = {
      ...validConfig(),
      schemaVersion: 2,
    };

    expect(() =>
      validateGoldenPayrollTemplateConfig(config),
    ).toThrow(
      new BadRequestException(
        'Golden Payroll Template schemaVersion must be 1.',
      ),
    );
  });

  it('rejects a non-PH jurisdiction', () => {
    const config = {
      ...validConfig(),
      jurisdiction: 'US',
    };

    expect(() =>
      validateGoldenPayrollTemplateConfig(config),
    ).toThrow(
      new BadRequestException(
        'Golden Payroll Template jurisdiction must be PH.',
      ),
    );
  });

  it('rejects a missing required statutory section', () => {
    const config = validConfig();

    delete (
      config.statutory as {
        premium?: unknown;
      }
    ).premium;

    expect(() =>
      validateGoldenPayrollTemplateConfig(config),
    ).toThrow(
      'Golden Payroll Template premium configuration must be an object.',
    );
  });

  it('rejects a non-array minimumWageReferences value', () => {
    const config = validConfig();

    (
      config.statutory as {
        minimumWageReferences: unknown;
      }
    ).minimumWageReferences = {};

    expect(() =>
      validateGoldenPayrollTemplateConfig(config),
    ).toThrow(
      'Golden Payroll Template minimumWageReferences must be an array.',
    );
  });
});
