import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AdjustEmployeeLeaveCreditDto } from './adjust-employee-leave-credit.dto';

describe('AdjustEmployeeLeaveCreditDto', () => {
  it('accepts and normalizes VL', async () => {
    const dto = plainToInstance(AdjustEmployeeLeaveCreditDto, {
      leaveCode: ' vl ',
      quantity: 5,
      effectiveDate: '2026-09-15',
      notes: ' Initial allocation ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.leaveCode).toBe('VL');
    expect(dto.notes).toBe('Initial allocation');
  });

  it('accepts SL with a negative adjustment', async () => {
    const dto = plainToInstance(AdjustEmployeeLeaveCreditDto, {
      leaveCode: 'SL',
      quantity: -1.5,
      effectiveDate: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects unsupported leave codes', async () => {
    const dto = plainToInstance(AdjustEmployeeLeaveCreditDto, {
      leaveCode: 'EL',
      quantity: 1,
      effectiveDate: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects quantity with more than four decimal places', async () => {
    const dto = plainToInstance(AdjustEmployeeLeaveCreditDto, {
      leaveCode: 'VL',
      quantity: 1.12345,
      effectiveDate: '2026-09-15',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid effective date', async () => {
    const dto = plainToInstance(AdjustEmployeeLeaveCreditDto, {
      leaveCode: 'VL',
      quantity: 1,
      effectiveDate: 'invalid-date',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
