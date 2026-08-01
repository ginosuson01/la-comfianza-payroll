import { Body, Controller, Get, Post } from '@nestjs/common';

import { CognitoUserAuthService } from './cognito/cognito-user-auth.service';
import { AllowPendingAssignment } from './decorators/allow-pending-assignment.decorator';
import { CurrentAuth } from './decorators/current-auth.decorator';
import { Public } from './decorators/public.decorator';
import { CompleteNewPasswordDto } from './dto/complete-new-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { ResolvedAuthenticatedIdentity } from './interfaces/resolved-authenticated-identity.interface';
import { SignupDto } from './signup/dto/signup.dto';
import { SignupService } from './signup/signup.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly signupService: SignupService,

    private readonly cognitoAuth: CognitoUserAuthService,
  ) {}

  @Public()
  @Post('signup')
  signup(
    @Body()
    input: SignupDto,
  ) {
    return this.signupService.signup(input);
  }

  @Public()
  @Post('login')
  login(
    @Body()
    input: LoginDto,
  ) {
    return this.cognitoAuth.login(input.username, input.password);
  }

  @Public()
  @Post('complete-new-password')
  completeNewPassword(
    @Body()
    input: CompleteNewPasswordDto,
  ) {
    return this.cognitoAuth.completeNewPassword(
      input.username,
      input.newPassword,
      input.session,
    );
  }

  @Public()
  @Post('refresh')
  refresh(
    @Body()
    input: RefreshTokenDto,
  ) {
    return this.cognitoAuth.refresh(input.refreshToken);
  }

  @Public()
  @Post('logout')
  logout(
    @Body()
    input: RefreshTokenDto,
  ) {
    return this.cognitoAuth.logout(input.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(
    @Body()
    input: ForgotPasswordDto,
  ) {
    return this.cognitoAuth.forgotPassword(input.username);
  }

  @Public()
  @Post('reset-password')
  resetPassword(
    @Body()
    input: ResetPasswordDto,
  ) {
    return this.cognitoAuth.resetPassword(
      input.username,
      input.confirmationCode,
      input.newPassword,
    );
  }

  @AllowPendingAssignment()
  @Get('me')
  getCurrentIdentity(
    @CurrentAuth()
    identity: ResolvedAuthenticatedIdentity,
  ) {
    return {
      authenticated: true,
      identity,
    };
  }
}
