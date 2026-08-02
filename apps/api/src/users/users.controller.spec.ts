import { Reflector } from '@nestjs/core';
import { RoleCode } from '@payroll/database';

import { REQUIRED_ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UsersController } from './users.controller';

describe('UsersController authorization', () => {
  it('requires the Payroll Manager role', () => {
    const reflector = new Reflector();

    const requiredRoles = reflector.get<RoleCode[]>(
      REQUIRED_ROLES_KEY,
      UsersController,
    );

    expect(requiredRoles).toEqual([RoleCode.PAYROLL_MANAGER]);
  });
});
