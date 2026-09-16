import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@payroll/database';

import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedIdentity } from './interfaces/authenticated-identity.interface';
import type { ResolvedAuthenticatedIdentity } from './interfaces/resolved-authenticated-identity.interface';

const APPLICATION_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  status: true,
} satisfies Prisma.UserSelect;

const LINK_CANDIDATE_SELECT = {
  ...APPLICATION_USER_SELECT,
  cognitoSubject: true,
} satisfies Prisma.UserSelect;

type ApplicationUser = Prisma.UserGetPayload<{
  select: typeof APPLICATION_USER_SELECT;
}>;

@Injectable()
export class DatabaseIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    identity: AuthenticatedIdentity,
  ): Promise<ResolvedAuthenticatedIdentity> {
    const user = await this.resolveApplicationUser(identity);

    const assignments = await this.prisma.userRole.findMany({
      where: {
        userId: user.id,
      },

      select: {
        roleId: true,
      },
    });

    const roleIds = assignments.map((assignment) => assignment.roleId);

    const assignedRoles =
      roleIds.length === 0
        ? []
        : await this.prisma.role.findMany({
            where: {
              id: {
                in: roleIds,
              },
            },

            select: {
              code: true,
            },
          });

    return {
      ...identity,

      user: {
        ...user,

        roles: assignedRoles.map((role) => role.code),
      },
    };
  }

  private async resolveApplicationUser(
    identity: AuthenticatedIdentity,
  ): Promise<ApplicationUser> {
    const linkedUser = await this.prisma.user.findUnique({
      where: {
        cognitoSubject: identity.sub,
      },

      select: APPLICATION_USER_SELECT,
    });

    if (linkedUser) {
      return linkedUser;
    }

    const candidate = await this.prisma.user.findFirst({
      where: {
        username: identity.username,
      },

      select: LINK_CANDIDATE_SELECT,
    });

    if (!candidate) {
      throw new UnauthorizedException(
        'Authenticated account is not linked to an application user.',
      );
    }

    if (candidate.cognitoSubject && candidate.cognitoSubject !== identity.sub) {
      throw new UnauthorizedException(
        'Application user is linked to a different authentication identity.',
      );
    }

    if (!candidate.cognitoSubject) {
      try {
        const linkResult = await this.prisma.user.updateMany({
          where: {
            id: candidate.id,
            cognitoSubject: null,
          },

          data: {
            cognitoSubject: identity.sub,
          },
        });

        if (linkResult.count !== 1) {
          const concurrentlyLinkedUser = await this.prisma.user.findUnique({
            where: {
              cognitoSubject: identity.sub,
            },

            select: APPLICATION_USER_SELECT,
          });

          if (
            concurrentlyLinkedUser &&
            concurrentlyLinkedUser.id === candidate.id
          ) {
            return concurrentlyLinkedUser;
          }

          throw new UnauthorizedException(
            'Application user could not be linked to the authenticated identity.',
          );
        }
      } catch (error: unknown) {
        const linkedAfterConflict = await this.prisma.user.findUnique({
          where: {
            cognitoSubject: identity.sub,
          },

          select: APPLICATION_USER_SELECT,
        });

        if (linkedAfterConflict && linkedAfterConflict.id === candidate.id) {
          return linkedAfterConflict;
        }

        if (linkedAfterConflict) {
          throw new UnauthorizedException(
            'Authentication identity is already linked to another application user.',
          );
        }

        throw error;
      }
    }

    const linkedUserAfterUpdate = await this.prisma.user.findUnique({
      where: {
        cognitoSubject: identity.sub,
      },

      select: APPLICATION_USER_SELECT,
    });

    if (!linkedUserAfterUpdate || linkedUserAfterUpdate.id !== candidate.id) {
      throw new UnauthorizedException(
        'Application user could not be linked to the authenticated identity.',
      );
    }

    return linkedUserAfterUpdate;
  }
}
