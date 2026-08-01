import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@payroll/database';
import type { Request } from 'express';

import { CognitoTokenVerifierService } from '../cognito/cognito-token-verifier.service';
import { DatabaseIdentityService } from '../database-identity.service';
import { ALLOW_PENDING_ASSIGNMENT_KEY } from '../decorators/allow-pending-assignment.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { ResolvedAuthenticatedIdentity } from '../interfaces/resolved-authenticated-identity.interface';

export interface AuthenticatedRequest extends Request {
  auth?: ResolvedAuthenticatedIdentity;
}

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,

    private readonly tokenVerifier: CognitoTokenVerifierService,

    private readonly databaseIdentity: DatabaseIdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Bearer access token is required.');
    }

    let cognitoIdentity;

    try {
      cognitoIdentity = await this.tokenVerifier.verify(token);
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired access token.');
    }

    const resolvedIdentity =
      await this.databaseIdentity.resolve(cognitoIdentity);

    this.assertAccountStatus(context, resolvedIdentity);

    request.auth = resolvedIdentity;

    return true;
  }

  private assertAccountStatus(
    context: ExecutionContext,
    identity: ResolvedAuthenticatedIdentity,
  ): void {
    if (identity.user.status === UserStatus.ACTIVE) {
      return;
    }

    const allowPendingAssignment = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_ASSIGNMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      allowPendingAssignment &&
      identity.user.status === UserStatus.PENDING_ASSIGNMENT
    ) {
      return;
    }

    throw new ForbiddenException('Account is not active for this operation.');
  }

  private extractBearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return undefined;
    }

    return token;
  }
}
