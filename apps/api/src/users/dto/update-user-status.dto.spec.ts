import { validate } from 'class-validator';
import { UserStatus } from '@payroll/database';

import { UpdateUserStatusDto } from './update-user-status.dto';

describe('UpdateUserStatusDto', () => {
  it('accepts ACTIVE', async () => {
    const dto = new UpdateUserStatusDto();

    dto.status = UserStatus.ACTIVE;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts DISABLED', async () => {
    const dto = new UpdateUserStatusDto();

    dto.status = UserStatus.DISABLED;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects PENDING_ASSIGNMENT', async () => {
    const dto = new UpdateUserStatusDto();

    dto.status = UserStatus.PENDING_ASSIGNMENT;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an invalid status', async () => {
    const dto = new UpdateUserStatusDto();

    dto.status = 'INVALID_STATUS' as UserStatus;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
