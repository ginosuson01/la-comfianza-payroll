import { SetMetadata } from '@nestjs/common';
import type { RoleCode } from '@payroll/database';

export const REQUIRED_ROLES_KEY = 'requiredRoles';

export const Roles = (...roles: RoleCode[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);
