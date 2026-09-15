import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PayBasis } from '@payroll/database';

import { SetCompensationDto } from './set-compensation.dto';

describe('SetCompensationDto', () => {
  it('accepts valid daily compensation', async () => {
    const dto = plainToInstance(SetCompensationDto, {
      payBasis: PayBasis.DAILY,
      rate: 750,
      effectiveFrom: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts valid monthly compensation', async () => {
    const dto = plainToInstance(SetCompensationDto, {
      payBasis: PayBasis.MONTHLY,
      rate: 25000,
      effectiveFrom: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid pay basis', async () => {
    const dto = plainToInstance(SetCompensationDto, {
      payBasis: 'HOURLY',
      rate: 750,
      effectiveFrom: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-positive rate', async () => {
    const dto = plainToInstance(SetCompensationDto, {
      payBasis: PayBasis.DAILY,
      rate: 0,
      effectiveFrom: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects more than four decimal places', async () => {
    const dto = plainToInstance(SetCompensationDto, {
      payBasis: PayBasis.DAILY,
      rate: 750.12345,
      effectiveFrom: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid effective date', async () => {
    const dto = plainToInstance(SetCompensationDto, {
      payBasis: PayBasis.DAILY,
      rate: 750,
      effectiveFrom: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
