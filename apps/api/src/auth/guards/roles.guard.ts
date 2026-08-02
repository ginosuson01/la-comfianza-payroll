import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { RoleCode } from '@payroll/database';
import { Reflector } from '@nestjs/core';

import { REQUIRED_ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from './cognito-auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const identity = request.auth;

    if (!identity) {
      throw new UnauthorizedException('Authenticated identity is required.');
    }

    const hasRequiredRole = requiredRoles.some((requiredRole) =>
      identity.user.roles.includes(requiredRole),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        'You do not have permission to perform this operation.',
      );
    }

    return true;
  }
}
