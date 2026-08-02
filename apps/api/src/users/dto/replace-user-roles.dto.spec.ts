import { validate } from 'class-validator';
import { RoleCode } from '@payroll/database';

import { ReplaceUserRolesDto } from './replace-user-roles.dto';

describe('ReplaceUserRolesDto', () => {
  it('accepts valid unique roles', async () => {
    const dto = new ReplaceUserRolesDto();

    dto.roles = [RoleCode.COMPANY_MANAGER];

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects an empty role list', async () => {
    const dto = new ReplaceUserRolesDto();

    dto.roles = [];

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects duplicate roles', async () => {
    const dto = new ReplaceUserRolesDto();

    dto.roles = [RoleCode.COMPANY_MANAGER, RoleCode.COMPANY_MANAGER];

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid role codes', async () => {
    const dto = new ReplaceUserRolesDto();

    dto.roles = ['INVALID_ROLE' as RoleCode];

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
