import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RootAccountPolicyService } from './root-account-policy.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuditModule, AuthModule],

  controllers: [UsersController],

  providers: [RootAccountPolicyService, UsersService],

  exports: [UsersService],
})
export class UsersModule {}
