import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { EnsureEmployeeLeaveEntitlementCycleDto } from './ensure-employee-leave-entitlement-cycle.dto';

describe('EnsureEmployeeLeaveEntitlementCycleDto', () => {
  it('accepts and trims a valid date', async () => {
    const dto = plainToInstance(EnsureEmployeeLeaveEntitlementCycleDto, {
      asOfDate: ' 2027-01-01 ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.asOfDate).toBe('2027-01-01');
  });

  it('rejects an invalid calendar date', async () => {
    const dto = plainToInstance(EnsureEmployeeLeaveEntitlementCycleDto, {
      asOfDate: '2027-02-31',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a datetime instead of date-only format', async () => {
    const dto = plainToInstance(EnsureEmployeeLeaveEntitlementCycleDto, {
      asOfDate: '2027-01-01T00:00:00Z',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
