import { BadRequestException } from '@nestjs/common';

import type { GoldenPayrollTemplateConfig } from './golden-payroll-template.types';

export function validateGoldenPayrollTemplateConfig(
  value: unknown,
): GoldenPayrollTemplateConfig {
  const config = requireObject(
    value,
    'Golden Payroll Template configuration',
  );

  if (config['schemaVersion'] !== 1) {
    throw new BadRequestException(
      'Golden Payroll Template schemaVersion must be 1.',
    );
  }

  if (config['jurisdiction'] !== 'PH') {
    throw new BadRequestException(
      'Golden Payroll Template jurisdiction must be PH.',
    );
  }

  const statutory = requireObject(
    config['statutory'],
    'Golden Payroll Template statutory configuration',
  );

  validateSss(statutory['sss']);
  validatePhilHealth(statutory['philHealth']);
  validatePagIbig(statutory['pagIbig']);
  validateTax(statutory['tax']);
  validateMinimumWageReferences(statutory['minimumWageReferences']);
  validatePremium(statutory['premium']);

  return value as GoldenPayrollTemplateConfig;
}

function validateSss(value: unknown): void {
  const config = requireObject(
    value,
    'Golden Payroll Template SSS configuration',
  );

  requireDateOnly(config['effectiveFrom'], 'SSS effectiveFrom');

  requireMoney(config['minimumMsc'], 'SSS minimumMsc');
  requireMoney(config['maximumMsc'], 'SSS maximumMsc');
  requireMoney(config['mscStep'], 'SSS mscStep');
  requireMoney(config['mscMidpoint'], 'SSS mscMidpoint');

  requireMoney(
    config['regularSocialSecurityMaximumMsc'],
    'SSS regularSocialSecurityMaximumMsc',
  );

  requireRate(config['employeeRate'], 'SSS employeeRate');
  requireRate(config['employerRate'], 'SSS employerRate');

  const mpf = requireObject(
    config['mandatoryProvidentFund'],
    'SSS mandatoryProvidentFund',
  );

  requireMoney(
    mpf['startsAboveMsc'],
    'SSS mandatoryProvidentFund startsAboveMsc',
  );

  requireRate(
    mpf['employeeRate'],
    'SSS mandatoryProvidentFund employeeRate',
  );

  requireRate(
    mpf['employerRate'],
    'SSS mandatoryProvidentFund employerRate',
  );

  const ec = requireObject(
    config['employeesCompensation'],
    'SSS employeesCompensation',
  );

  requireMoney(ec['thresholdMsc'], 'SSS EC thresholdMsc');

  requireMoney(
    ec['atOrBelowThresholdAmount'],
    'SSS EC atOrBelowThresholdAmount',
  );

  requireMoney(
    ec['aboveThresholdAmount'],
    'SSS EC aboveThresholdAmount',
  );
}

function validatePhilHealth(value: unknown): void {
  const config = requireObject(
    value,
    'Golden Payroll Template PhilHealth configuration',
  );

  requireDateOnly(
    config['effectiveFrom'],
    'PhilHealth effectiveFrom',
  );

  requireMoney(config['salaryFloor'], 'PhilHealth salaryFloor');
  requireMoney(config['salaryCeiling'], 'PhilHealth salaryCeiling');

  requireRate(config['premiumRate'], 'PhilHealth premiumRate');

  requireRate(
    config['employeeShareRate'],
    'PhilHealth employeeShareRate',
  );

  requireRate(
    config['employerShareRate'],
    'PhilHealth employerShareRate',
  );

  if (config['oddCentavoRecipient'] !== 'EMPLOYER') {
    throw new BadRequestException(
      'PhilHealth oddCentavoRecipient must be EMPLOYER.',
    );
  }
}

function validatePagIbig(value: unknown): void {
  const config = requireObject(
    value,
    'Golden Payroll Template Pag-IBIG configuration',
  );

  requireDateOnly(
    config['effectiveFrom'],
    'Pag-IBIG effectiveFrom',
  );

  requireMoney(
    config['maximumFundSalary'],
    'Pag-IBIG maximumFundSalary',
  );

  requireMoney(
    config['employeeRateThreshold'],
    'Pag-IBIG employeeRateThreshold',
  );

  requireRate(
    config['lowerEmployeeRate'],
    'Pag-IBIG lowerEmployeeRate',
  );

  requireRate(
    config['upperEmployeeRate'],
    'Pag-IBIG upperEmployeeRate',
  );

  requireRate(config['employerRate'], 'Pag-IBIG employerRate');
}

function validateTax(value: unknown): void {
  const tax = requireObject(
    value,
    'Golden Payroll Template tax configuration',
  );

  const withholding = requireObject(
    tax['withholding'],
    'Golden Payroll Template withholding-tax configuration',
  );

  requireDateOnly(
    withholding['effectiveFrom'],
    'Withholding tax effectiveFrom',
  );

  const rules = requireObject(
    withholding['rules'],
    'Withholding tax rules',
  );

  for (const period of [
    'DAILY',
    'WEEKLY',
    'SEMI_MONTHLY',
    'MONTHLY',
  ] as const) {
    validateProgressiveRule(
      rules[period],
      `Withholding tax ${period} rule`,
    );
  }

  const annual = requireObject(
    tax['annualIncomeTax'],
    'Golden Payroll Template annual-income-tax configuration',
  );

  requireDateOnly(
    annual['effectiveFrom'],
    'Annual income tax effectiveFrom',
  );

  validateProgressiveRule(
    annual['rule'],
    'Annual income tax rule',
  );

  const thirteenth = requireObject(
    tax['thirteenthMonthOtherBenefits'],
    'Golden Payroll Template 13th-month/other-benefits tax configuration',
  );

  requireDateOnly(
    thirteenth['effectiveFrom'],
    '13th-month/other-benefits effectiveFrom',
  );

  requireMoney(
    thirteenth['taxExemptCeiling'],
    '13th-month/other-benefits taxExemptCeiling',
  );

  const deMinimis = requireObject(
    tax['deMinimis'],
    'Golden Payroll Template de minimis configuration',
  );

  requireDateOnly(
    deMinimis['effectiveFrom'],
    'De minimis effectiveFrom',
  );

  if (!Array.isArray(deMinimis['benefits'])) {
    throw new BadRequestException(
      'De minimis benefits must be an array.',
    );
  }

  for (const [index, benefitValue] of deMinimis['benefits'].entries()) {
    const benefit = requireObject(
      benefitValue,
      `De minimis benefit ${index + 1}`,
    );

    requireNonBlankString(
      benefit['code'],
      `De minimis benefit ${index + 1} code`,
    );

    requireNonBlankString(
      benefit['description'],
      `De minimis benefit ${index + 1} description`,
    );

    validateDeMinimisLimit(
      benefit['limit'],
      `De minimis benefit ${index + 1} limit`,
    );
  }
}

function validateMinimumWageReferences(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new BadRequestException(
      'Golden Payroll Template minimumWageReferences must be an array.',
    );
  }

  for (const [index, referenceValue] of value.entries()) {
    const reference = requireObject(
      referenceValue,
      `Minimum wage reference ${index + 1}`,
    );

    requireNonBlankString(
      reference['regionCode'],
      `Minimum wage reference ${index + 1} regionCode`,
    );

    requireNonBlankString(
      reference['wageOrderCode'],
      `Minimum wage reference ${index + 1} wageOrderCode`,
    );

    requireNonBlankString(
      reference['areaClassification'],
      `Minimum wage reference ${index + 1} areaClassification`,
    );

    requireNonBlankString(
      reference['sector'],
      `Minimum wage reference ${index + 1} sector`,
    );

    requireMoney(
      reference['dailyRate'],
      `Minimum wage reference ${index + 1} dailyRate`,
    );

    requireDateOnly(
      reference['rateEffectiveFrom'],
      `Minimum wage reference ${index + 1} rateEffectiveFrom`,
    );
  }
}

function validatePremium(value: unknown): void {
  const premium = requireObject(
    value,
    'Golden Payroll Template premium configuration',
  );

  validateMultiplierMap(
    premium['regularWorkRules'],
    'Premium regularWorkRules',
  );

  validateMultiplierMap(
    premium['overtimeRules'],
    'Premium overtimeRules',
  );

  requireRate(
    premium['nightDifferentialRate'],
    'Premium nightDifferentialRate',
  );
}

function validateMultiplierMap(
  value: unknown,
  fieldName: string,
): void {
  const rules = requireObject(value, fieldName);

  for (const [key, ruleValue] of Object.entries(rules)) {
    const rule = requireObject(
      ruleValue,
      `${fieldName}.${key}`,
    );

    requireRate(
      rule['multiplier'],
      `${fieldName}.${key}.multiplier`,
    );

    if (
      rule['semantics'] !== 'TOTAL' &&
      rule['semantics'] !== 'ADDITIONAL'
    ) {
      throw new BadRequestException(
        `${fieldName}.${key}.semantics must be TOTAL or ADDITIONAL.`,
      );
    }
  }
}

function validateProgressiveRule(
  value: unknown,
  fieldName: string,
): void {
  const rule = requireObject(value, fieldName);

  if (rule['method'] !== 'PROGRESSIVE_TABLE') {
    throw new BadRequestException(
      `${fieldName}.method must be PROGRESSIVE_TABLE.`,
    );
  }

  if (!Array.isArray(rule['brackets']) || rule['brackets'].length === 0) {
    throw new BadRequestException(
      `${fieldName}.brackets must be a non-empty array.`,
    );
  }

  for (const [index, bracketValue] of rule['brackets'].entries()) {
    const bracket = requireObject(
      bracketValue,
      `${fieldName} bracket ${index + 1}`,
    );

    requireMoney(
      bracket['minInclusive'],
      `${fieldName} bracket ${index + 1} minInclusive`,
    );

    if (bracket['maxExclusive'] !== null) {
      requireMoney(
        bracket['maxExclusive'],
        `${fieldName} bracket ${index + 1} maxExclusive`,
      );
    }

    requireMoney(
      bracket['baseTax'],
      `${fieldName} bracket ${index + 1} baseTax`,
    );

    requireRate(
      bracket['rateOnExcess'],
      `${fieldName} bracket ${index + 1} rateOnExcess`,
    );
  }
}

function validateDeMinimisLimit(
  value: unknown,
  fieldName: string,
): void {
  const limit = requireObject(value, fieldName);

  switch (limit['type']) {
    case 'DAYS_PER_YEAR':
      if (
        !Number.isInteger(limit['days']) ||
        Number(limit['days']) <= 0
      ) {
        throw new BadRequestException(
          `${fieldName}.days must be a positive integer.`,
        );
      }
      return;

    case 'AMOUNT_PER_MONTH':
      requireMoney(limit['amount'], `${fieldName}.amount`);
      return;

    case 'AMOUNT_PER_YEAR':
      requireMoney(limit['amount'], `${fieldName}.amount`);
      return;

    case 'AMOUNT_PER_SEMESTER_OR_MONTH':
      requireMoney(
        limit['amountPerSemester'],
        `${fieldName}.amountPerSemester`,
      );
      requireMoney(
        limit['amountPerMonth'],
        `${fieldName}.amountPerMonth`,
      );
      return;

    case 'PERCENT_OF_REGIONAL_BASIC_MINIMUM_WAGE_PER_DAY':
      requireRate(limit['rate'], `${fieldName}.rate`);
      return;

    default:
      throw new BadRequestException(
        `${fieldName}.type is unsupported.`,
      );
  }
}

function requireObject(
  value: unknown,
  fieldName: string,
): Readonly<Record<string, unknown>> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new BadRequestException(
      `${fieldName} must be an object.`,
    );
  }

  return value as Readonly<Record<string, unknown>>;
}

function requireNonBlankString(
  value: unknown,
  fieldName: string,
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(
      `${fieldName} must be a non-blank string.`,
    );
  }

  return value;
}

function requireMoney(
  value: unknown,
  fieldName: string,
): string {
  const stringValue = requireNonBlankString(value, fieldName);

  if (
    !/^\d+(?:\.\d{1,2})?$/.test(stringValue) ||
    Number(stringValue) < 0
  ) {
    throw new BadRequestException(
      `${fieldName} must be a non-negative monetary decimal with at most 2 decimal places.`,
    );
  }

  return stringValue;
}

function requireRate(
  value: unknown,
  fieldName: string,
): string {
  const stringValue = requireNonBlankString(value, fieldName);

  if (
    !/^\d+(?:\.\d{1,4})?$/.test(stringValue) ||
    Number(stringValue) < 0
  ) {
    throw new BadRequestException(
      `${fieldName} must be a non-negative decimal rate with at most 4 decimal places.`,
    );
  }

  return stringValue;
}

function requireDateOnly(
  value: unknown,
  fieldName: string,
): string {
  const stringValue = requireNonBlankString(value, fieldName);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    throw new BadRequestException(
      `${fieldName} must use YYYY-MM-DD format.`,
    );
  }

  const parsed = new Date(`${stringValue}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== stringValue
  ) {
    throw new BadRequestException(
      `${fieldName} must be a valid calendar date.`,
    );
  }

  return stringValue;
}
