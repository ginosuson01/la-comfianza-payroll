import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecurringPayrollItemKind } from '@payroll/database';

import { CreateRecurringPayrollItemDto } from './create-recurring-payroll-item.dto';

describe('CreateRecurringPayrollItemDto', () => {
  it('accepts a valid allowance', async () => {
    const dto = plainToInstance(CreateRecurringPayrollItemDto, {
      kind: RecurringPayrollItemKind.ALLOWANCE,
      code: ' rice ',
      description: ' Rice Allowance ',
      amount: 1500,
      taxable: false,
      effectiveFrom: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.code).toBe('RICE');
    expect(dto.description).toBe('Rice Allowance');
  });

  it('accepts a valid fixed deduction', async () => {
    const dto = plainToInstance(CreateRecurringPayrollItemDto, {
      kind: RecurringPayrollItemKind.FIXED_DEDUCTION,
      code: 'MEDICAL',
      description: 'Medical Deduction',
      amount: 500,
      effectiveFrom: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid payroll item kind', async () => {
    const dto = plainToInstance(CreateRecurringPayrollItemDto, {
      kind: 'BONUS',
      code: 'BONUS',
      description: 'Bonus',
      amount: 1000,
      effectiveFrom: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-positive amount', async () => {
    const dto = plainToInstance(CreateRecurringPayrollItemDto, {
      kind: RecurringPayrollItemKind.ALLOWANCE,
      code: 'RICE',
      description: 'Rice Allowance',
      amount: 0,
      effectiveFrom: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects more than two decimal places', async () => {
    const dto = plainToInstance(CreateRecurringPayrollItemDto, {
      kind: RecurringPayrollItemKind.ALLOWANCE,
      code: 'RICE',
      description: 'Rice Allowance',
      amount: 1500.123,
      effectiveFrom: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid effective date', async () => {
    const dto = plainToInstance(CreateRecurringPayrollItemDto, {
      kind: RecurringPayrollItemKind.ALLOWANCE,
      code: 'RICE',
      description: 'Rice Allowance',
      amount: 1500,
      effectiveFrom: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
