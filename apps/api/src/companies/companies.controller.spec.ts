import { Reflector } from '@nestjs/core';
import { RoleCode } from '@payroll/database';

import { REQUIRED_ROLES_KEY } from '../auth/decorators/roles.decorator';
import { CompaniesController } from './companies.controller';

describe('CompaniesController authorization', () => {
  it('requires the Payroll Manager role', () => {
    const reflector = new Reflector();

    const requiredRoles = reflector.get<RoleCode[]>(
      REQUIRED_ROLES_KEY,
      CompaniesController,
    );

    expect(requiredRoles).toEqual([RoleCode.PAYROLL_MANAGER]);
  });
});
