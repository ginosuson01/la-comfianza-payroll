import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { RoleCode } from '@payroll/database';

import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { ResolvedAuthenticatedIdentity } from '../auth/interfaces/resolved-authenticated-identity.interface';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ReplaceUserCompaniesDto } from './dto/replace-user-companies.dto';
import { ReplaceUserRolesDto } from './dto/replace-user-roles.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';
import type { UserListResponse, UserView } from './users.service';

@Roles(RoleCode.PAYROLL_MANAGER)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listUsers(
    @Query()
    query: ListUsersQueryDto,
  ): Promise<UserListResponse> {
    return this.usersService.listUsers(query);
  }

  @Get(':userId')
  getUserById(
    @Param('userId')
    userId: string,
  ): Promise<UserView> {
    return this.usersService.getUserById(userId);
  }

  @Put(':userId/roles')
  replaceUserRoles(
    @Param('userId')
    userId: string,

    @Body()
    input: ReplaceUserRolesDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<UserView> {
    return this.usersService.replaceUserRoles(
      userId,
      input.roles,
      identity.user.id,
    );
  }

  @Put(':userId/companies')
  replaceUserCompanies(
    @Param('userId')
    userId: string,

    @Body()
    input: ReplaceUserCompaniesDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<UserView> {
    return this.usersService.replaceUserCompanies(
      userId,
      input.companyIds,
      identity.user.id,
    );
  }

  @Patch(':userId/status')
  updateUserStatus(
    @Param('userId')
    userId: string,

    @Body()
    input: UpdateUserStatusDto,

    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ): Promise<UserView> {
    return this.usersService.updateUserStatus(
      userId,
      input.status,
      identity.user.id,
    );
  }
}
