import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedIdentity } from './interfaces/authenticated-identity.interface';
import type { ResolvedAuthenticatedIdentity } from './interfaces/resolved-authenticated-identity.interface';

@Injectable()
export class DatabaseIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    identity: AuthenticatedIdentity,
  ): Promise<ResolvedAuthenticatedIdentity> {
    const user = await this.prisma.user.findUnique({
      where: {
        cognitoSubject: identity.sub,
      },

      select: {
        id: true,
        username: true,
        email: true,
        status: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Authenticated account is not linked to an application user.',
      );
    }

    return {
      ...identity,
      user,
    };
  }
}
