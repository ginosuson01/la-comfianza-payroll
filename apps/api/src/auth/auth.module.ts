import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthController } from './auth.controller';
import { CognitoAdminService } from './cognito/cognito-admin.service';
import { CognitoTokenVerifierService } from './cognito/cognito-token-verifier.service';
import { CognitoUserAuthService } from './cognito/cognito-user-auth.service';
import { DatabaseIdentityService } from './database-identity.service';
import { CognitoAuthGuard } from './guards/cognito-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { SignupService } from './signup/signup.service';

@Module({
  controllers: [AuthController],

  providers: [
    CognitoAdminService,
    CognitoTokenVerifierService,
    CognitoUserAuthService,
    DatabaseIdentityService,
    SignupService,

    {
      provide: APP_GUARD,
      useClass: CognitoAuthGuard,
    },

    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],

  exports: [
    CognitoAdminService,
    CognitoTokenVerifierService,
    DatabaseIdentityService,
  ],
})
export class AuthModule {}
