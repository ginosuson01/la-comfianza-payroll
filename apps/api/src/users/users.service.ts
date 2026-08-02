import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RoleCode, UserStatus } from '@payroll/database';
import type { Prisma } from '@payroll/database';

import { AuditLogService } from '../audit/audit-log.service';
import { CognitoAdminService } from '../auth/cognito/cognito-admin.service';
import { PrismaService } from '../database/prisma.service';
import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import { RootAccountPolicyService } from './root-account-policy.service';
import {
  USER_MANAGEMENT_AUDIT_MODULE,
  USER_MANAGEMENT_ENTITY_TYPE,
  UserManagementAuditAction,
} from './user-management-audit.constants';

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  mobile: string | null;
  jobTitle: string | null;
  status: UserStatus;
}

export interface CompanySummary {
  id: string;
  name: string;
}

export interface UserView extends UserRecord {
  fullName: string;
  roles: RoleCode[];
  companies: CompanySummary[];
}

export interface UserListResponse {
  items: UserView[];

  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,

    private readonly cognitoAdmin: CognitoAdminService,

    private readonly auditLog: AuditLogService,

    private readonly rootAccountPolicy: RootAccountPolicyService,
  ) {}

  async listUsers(query: ListUsersQueryDto): Promise<UserListResponse> {
    const page = query.page;
    const pageSize = query.pageSize;
    const search = query.search?.trim();

    const where: Prisma.UserWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (search) {
      where.OR = [
        {
          username: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({
        where,
      }),

      this.prisma.user.findMany({
        where,

        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          mobile: true,
          jobTitle: true,
          status: true,
        },

        orderBy: {
          username: 'asc',
        },

        skip: (page - 1) * pageSize,

        take: pageSize,
      }),
    ]);

    const items = await this.enrichUsers(users);

    return {
      items,

      pagination: {
        page,
        pageSize,
        total,

        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getUserById(userId: string): Promise<UserView> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        mobile: true,
        jobTitle: true,
        status: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User was not found.');
    }

    const enriched = await this.enrichUsers([user]);

    return enriched[0];
  }

  async replaceUserRoles(
    userId: string,
    requestedRoles: RoleCode[],
    actorUserId: string,
  ): Promise<UserView> {
    const uniqueRoleCodes = [...new Set(requestedRoles)];

    if (uniqueRoleCodes.length === 0) {
      throw new BadRequestException('At least one role must be assigned.');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        username: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User was not found.');
    }

    this.rootAccountPolicy.assertRoleReplacementAllowed(
      user.username,
      uniqueRoleCodes,
    );

    const roles = await this.prisma.role.findMany({
      where: {
        code: {
          in: uniqueRoleCodes,
        },
      },

      select: {
        id: true,
        code: true,
      },
    });

    if (roles.length !== uniqueRoleCodes.length) {
      throw new InternalServerErrorException(
        'One or more configured roles are unavailable.',
      );
    }

    const currentUser = await this.getUserById(userId);

    const previousRoles = [...currentUser.roles].sort();

    const nextRoles = [...uniqueRoleCodes].sort();

    if (this.haveSameStringValues(previousRoles, nextRoles)) {
      return currentUser;
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.userRole.deleteMany({
        where: {
          userId,
        },
      });

      await transaction.userRole.createMany({
        data: roles.map((role) => ({
          userId,
          roleId: role.id,
        })),
      });

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,

        action: UserManagementAuditAction.ROLES_REPLACED,

        module: USER_MANAGEMENT_AUDIT_MODULE,

        entityType: USER_MANAGEMENT_ENTITY_TYPE,

        entityId: userId,

        reference: user.username,

        details: `Updated roles for user ${user.username}.`,

        metadata: {
          previousRoles,
          newRoles: nextRoles,
        },
      });
    });

    return this.getUserById(userId);
  }

  async replaceUserCompanies(
    userId: string,
    requestedCompanyIds: string[],
    actorUserId: string,
  ): Promise<UserView> {
    const companyIds = [...new Set(requestedCompanyIds)].sort();

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        username: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User was not found.');
    }

    this.rootAccountPolicy.assertCompanyReplacementAllowed(
      user.username,
      companyIds,
    );

    const currentUser = await this.getUserById(userId);

    const previousCompanyIds = currentUser.companies
      .map((company) => company.id)
      .sort();

    if (this.haveSameStringValues(previousCompanyIds, companyIds)) {
      return currentUser;
    }

    const companies =
      companyIds.length === 0
        ? []
        : await this.prisma.company.findMany({
            where: {
              id: {
                in: companyIds,
              },
            },

            select: {
              id: true,
              name: true,
            },
          });

    if (companies.length !== companyIds.length) {
      const existingCompanyIds = new Set(
        companies.map((company) => company.id),
      );

      const missingCompanyIds = companyIds.filter(
        (companyId) => !existingCompanyIds.has(companyId),
      );

      throw new BadRequestException({
        message: 'One or more companies were not found.',

        missingCompanyIds,
      });
    }

    const previousCompanies = currentUser.companies.map((company) => ({
      id: company.id,
      name: company.name,
    }));

    const newCompanies = companies
      .map((company) => ({
        id: company.id,
        name: company.name,
      }))
      .sort((first, second) => first.name.localeCompare(second.name));

    await this.prisma.$transaction(async (transaction) => {
      await transaction.userCompanyAccess.deleteMany({
        where: {
          userId,
        },
      });

      if (companyIds.length > 0) {
        await transaction.userCompanyAccess.createMany({
          data: companyIds.map((companyId) => ({
            userId,
            companyId,
          })),
        });
      }

      await this.auditLog.recordSuccessInTransaction(transaction, {
        actorUserId,

        action: UserManagementAuditAction.COMPANY_ACCESS_REPLACED,

        module: USER_MANAGEMENT_AUDIT_MODULE,

        entityType: USER_MANAGEMENT_ENTITY_TYPE,

        entityId: userId,

        reference: user.username,

        details: `Updated company access for user ${user.username}.`,

        metadata: {
          previousCompanies,
          newCompanies,
        },
      });
    });

    return this.getUserById(userId);
  }

  async updateUserStatus(
    userId: string,
    requestedStatus: UserStatus,
    actorUserId: string,
  ): Promise<UserView> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        username: true,
        status: true,
        cognitoSubject: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User was not found.');
    }

    this.rootAccountPolicy.assertStatusUpdateAllowed(
      user.username,
      requestedStatus,
    );

    if (user.status === requestedStatus) {
      return this.getUserById(userId);
    }

    if (requestedStatus === UserStatus.ACTIVE) {
      await this.assertUserCanBeActivated(userId);
    }

    const previousStatus = user.status;

    await this.prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        status: requestedStatus,
      },
    });

    try {
      await this.synchronizeCognitoStatus(
        user.username,
        user.cognitoSubject,
        requestedStatus,
      );

      await this.auditLog.recordSuccess({
        actorUserId,

        action: UserManagementAuditAction.STATUS_CHANGED,

        module: USER_MANAGEMENT_AUDIT_MODULE,

        entityType: USER_MANAGEMENT_ENTITY_TYPE,

        entityId: userId,

        reference: user.username,

        details: `Changed user ${user.username} status from ${previousStatus} to ${requestedStatus}.`,

        metadata: {
          previousStatus,

          newStatus: requestedStatus,
        },
      });
    } catch (error: unknown) {
      await this.restorePreviousStatus(userId, previousStatus);

      await this.restorePreviousCognitoStatus(
        user.username,
        user.cognitoSubject,
        previousStatus,
      );

      throw error;
    }

    return this.getUserById(userId);
  }

  private async assertUserCanBeActivated(userId: string): Promise<void> {
    const assignments = await this.prisma.userRole.findMany({
      where: {
        userId,
      },

      select: {
        roleId: true,
      },
    });

    if (assignments.length === 0) {
      throw new BadRequestException(
        'At least one role must be assigned before activating the user.',
      );
    }

    const roleIds = assignments.map((assignment) => assignment.roleId);

    const assignedRoles = await this.prisma.role.findMany({
      where: {
        id: {
          in: roleIds,
        },
      },

      select: {
        code: true,
      },
    });

    const isPayrollManager = assignedRoles.some(
      (role) => role.code === RoleCode.PAYROLL_MANAGER,
    );

    if (isPayrollManager) {
      return;
    }

    const companyAccessCount = await this.prisma.userCompanyAccess.count({
      where: {
        userId,
      },
    });

    if (companyAccessCount === 0) {
      throw new BadRequestException(
        'At least one company must be assigned before activating a non-Payroll Manager user.',
      );
    }
  }

  private async synchronizeCognitoStatus(
    username: string,
    cognitoSubject: string | null,
    requestedStatus: UserStatus,
  ): Promise<void> {
    if (!this.cognitoAdmin.isConfigured() || !cognitoSubject) {
      return;
    }

    if (requestedStatus === UserStatus.DISABLED) {
      await this.cognitoAdmin.disableAccount(username);

      return;
    }

    await this.cognitoAdmin.enableAccount(username);
  }

  private async restorePreviousStatus(
    userId: string,
    previousStatus: UserStatus,
  ): Promise<void> {
    try {
      await this.prisma.user.update({
        where: {
          id: userId,
        },

        data: {
          status: previousStatus,
        },
      });
    } catch (rollbackError: unknown) {
      this.logger.error(
        `Failed to restore user status after update failure: ${userId}`,
        rollbackError instanceof Error
          ? rollbackError.message
          : String(rollbackError),
      );
    }
  }

  private async restorePreviousCognitoStatus(
    username: string,
    cognitoSubject: string | null,
    previousStatus: UserStatus,
  ): Promise<void> {
    try {
      await this.synchronizeCognitoStatus(
        username,
        cognitoSubject,
        previousStatus,
      );
    } catch (rollbackError: unknown) {
      this.logger.error(
        `Failed to restore Cognito status after user status update failure: ${username}`,
        rollbackError instanceof Error
          ? rollbackError.message
          : String(rollbackError),
      );
    }
  }

  private async enrichUsers(users: UserRecord[]): Promise<UserView[]> {
    if (users.length === 0) {
      return [];
    }

    const userIds = users.map((user) => user.id);

    const [roleAssignments, companyAssignments] = await Promise.all([
      this.prisma.userRole.findMany({
        where: {
          userId: {
            in: userIds,
          },
        },

        select: {
          userId: true,
          roleId: true,
        },
      }),

      this.prisma.userCompanyAccess.findMany({
        where: {
          userId: {
            in: userIds,
          },
        },

        select: {
          userId: true,
          companyId: true,
        },
      }),
    ]);

    const roleIds = [
      ...new Set(roleAssignments.map((assignment) => assignment.roleId)),
    ];

    const companyIds = [
      ...new Set(companyAssignments.map((assignment) => assignment.companyId)),
    ];

    const [roles, companies] = await Promise.all([
      roleIds.length === 0
        ? Promise.resolve([])
        : this.prisma.role.findMany({
            where: {
              id: {
                in: roleIds,
              },
            },

            select: {
              id: true,
              code: true,
            },
          }),

      companyIds.length === 0
        ? Promise.resolve([])
        : this.prisma.company.findMany({
            where: {
              id: {
                in: companyIds,
              },
            },

            select: {
              id: true,
              name: true,
            },
          }),
    ]);

    const roleCodeById = new Map(roles.map((role) => [role.id, role.code]));

    const companyById = new Map(
      companies.map((company) => [company.id, company]),
    );

    const rolesByUserId = new Map<string, RoleCode[]>();

    for (const assignment of roleAssignments) {
      const roleCode = roleCodeById.get(assignment.roleId);

      if (!roleCode) {
        continue;
      }

      const assignedRoles = rolesByUserId.get(assignment.userId) ?? [];

      assignedRoles.push(roleCode);

      rolesByUserId.set(assignment.userId, assignedRoles);
    }

    const companiesByUserId = new Map<string, CompanySummary[]>();

    for (const assignment of companyAssignments) {
      const company = companyById.get(assignment.companyId);

      if (!company) {
        continue;
      }

      const assignedCompanies = companiesByUserId.get(assignment.userId) ?? [];

      assignedCompanies.push(company);

      companiesByUserId.set(assignment.userId, assignedCompanies);
    }

    return users.map((user) => ({
      ...user,

      fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),

      roles: [...(rolesByUserId.get(user.id) ?? [])].sort(),

      companies: [...(companiesByUserId.get(user.id) ?? [])].sort(
        (first, second) => first.name.localeCompare(second.name),
      ),
    }));
  }

  private haveSameStringValues(first: string[], second: string[]): boolean {
    if (first.length !== second.length) {
      return false;
    }

    const sortedFirst = [...first].sort();

    const sortedSecond = [...second].sort();

    return sortedFirst.every((value, index) => value === sortedSecond[index]);
  }
}
