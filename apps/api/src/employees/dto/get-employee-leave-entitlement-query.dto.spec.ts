import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { GetEmployeeLeaveEntitlementQueryDto } from './get-employee-leave-entitlement-query.dto';

describe('GetEmployeeLeaveEntitlementQueryDto', () => {
  it('accepts and trims YYYY-MM-DD asOfDate', async () => {
    const dto = plainToInstance(GetEmployeeLeaveEntitlementQueryDto, {
      asOfDate: ' 2026-09-28 ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.asOfDate).toBe('2026-09-28');
  });

  it('rejects a datetime instead of date-only format', async () => {
    const dto = plainToInstance(GetEmployeeLeaveEntitlementQueryDto, {
      asOfDate: '2026-09-28T08:00:00Z',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid calendar date', async () => {
    const dto = plainToInstance(GetEmployeeLeaveEntitlementQueryDto, {
      asOfDate: '2026-02-31',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
