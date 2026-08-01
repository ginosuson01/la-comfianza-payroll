import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  GetTokensFromRefreshTokenCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  RevokeTokenCommand,
} from '@aws-sdk/client-cognito-identity-provider';

import type {
  AuthFlowResponse,
  AuthenticationTokens,
} from '../interfaces/auth-flow-response.interface';

interface CognitoAuthenticationResult {
  AccessToken?: string;
  IdToken?: string;
  RefreshToken?: string;
  ExpiresIn?: number;
  TokenType?: string;
}

interface CognitoAuthOutput {
  ChallengeName?: string;
  Session?: string;

  ChallengeParameters?: Record<string, string>;

  AuthenticationResult?: CognitoAuthenticationResult;
}

@Injectable()
export class CognitoUserAuthService {
  private readonly client: CognitoIdentityProviderClient;

  private readonly clientId: string | undefined;

  constructor(private readonly config: ConfigService) {
    const region = this.config.getOrThrow<string>('AWS_REGION');

    this.clientId = this.config.get<string>('COGNITO_CLIENT_ID');

    this.client = new CognitoIdentityProviderClient({
      region,
    });
  }

  async login(username: string, password: string): Promise<AuthFlowResponse> {
    const clientId = this.requireClientId();

    try {
      const result = await this.client.send(
        new InitiateAuthCommand({
          AuthFlow: 'USER_PASSWORD_AUTH',

          ClientId: clientId,

          AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
          },
        }),
      );

      return this.toAuthFlowResponse(result, username);
    } catch (error: unknown) {
      if (
        this.hasAwsErrorName(error, 'NotAuthorizedException') ||
        this.hasAwsErrorName(error, 'UserNotFoundException')
      ) {
        throw new UnauthorizedException('Invalid username or password.');
      }

      if (this.hasAwsErrorName(error, 'PasswordResetRequiredException')) {
        throw new ForbiddenException('Password reset is required.');
      }

      throw new BadGatewayException('Authentication provider login failed.');
    }
  }

  async completeNewPassword(
    username: string,
    newPassword: string,
    session: string,
  ): Promise<AuthFlowResponse> {
    const clientId = this.requireClientId();

    try {
      const result = await this.client.send(
        new RespondToAuthChallengeCommand({
          ClientId: clientId,

          ChallengeName: 'NEW_PASSWORD_REQUIRED',

          Session: session,

          ChallengeResponses: {
            USERNAME: username,

            NEW_PASSWORD: newPassword,
          },
        }),
      );

      return this.toAuthFlowResponse(result, username);
    } catch (error: unknown) {
      if (this.hasAwsErrorName(error, 'InvalidPasswordException')) {
        throw new BadRequestException(
          'New password does not meet the password policy.',
        );
      }

      if (this.hasAwsErrorName(error, 'NotAuthorizedException')) {
        throw new UnauthorizedException(
          'Password-change session is invalid or expired.',
        );
      }

      throw new BadGatewayException('Unable to complete password change.');
    }
  }

  async refresh(refreshToken: string): Promise<{
    status: 'AUTHENTICATED';
    tokens: AuthenticationTokens;
  }> {
    const clientId = this.requireClientId();

    try {
      const result = await this.client.send(
        new GetTokensFromRefreshTokenCommand({
          ClientId: clientId,

          RefreshToken: refreshToken,
        }),
      );

      const authenticationResult = result.AuthenticationResult;

      if (!authenticationResult?.AccessToken) {
        throw new BadGatewayException(
          'Authentication provider did not return an access token.',
        );
      }

      return {
        status: 'AUTHENTICATED',

        tokens: this.toAuthenticationTokens(authenticationResult, refreshToken),
      };
    } catch (error: unknown) {
      if (
        this.hasAwsErrorName(error, 'NotAuthorizedException') ||
        this.hasAwsErrorName(error, 'UserNotFoundException')
      ) {
        throw new UnauthorizedException('Refresh token is invalid or expired.');
      }

      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException(
        'Unable to refresh authentication session.',
      );
    }
  }

  async logout(refreshToken: string): Promise<{
    message: string;
  }> {
    const clientId = this.requireClientId();

    try {
      await this.client.send(
        new RevokeTokenCommand({
          ClientId: clientId,

          Token: refreshToken,
        }),
      );

      return {
        message: 'Signed out successfully.',
      };
    } catch (error: unknown) {
      if (
        this.hasAwsErrorName(error, 'InvalidParameterException') ||
        this.hasAwsErrorName(error, 'UnsupportedTokenTypeException')
      ) {
        throw new BadRequestException(
          'Unable to sign out with the supplied session.',
        );
      }

      throw new BadGatewayException('Unable to complete sign out.');
    }
  }

  async forgotPassword(username: string): Promise<{
    message: string;
  }> {
    const clientId = this.requireClientId();

    const genericResponse = {
      message:
        'If the account is eligible for password recovery, reset instructions will be sent.',
    };

    try {
      await this.client.send(
        new ForgotPasswordCommand({
          ClientId: clientId,

          Username: username,
        }),
      );

      return genericResponse;
    } catch (error: unknown) {
      if (this.hasAwsErrorName(error, 'UserNotFoundException')) {
        return genericResponse;
      }

      throw new BadGatewayException('Unable to start password recovery.');
    }
  }

  async resetPassword(
    username: string,
    confirmationCode: string,
    newPassword: string,
  ): Promise<{
    message: string;
  }> {
    const clientId = this.requireClientId();

    try {
      await this.client.send(
        new ConfirmForgotPasswordCommand({
          ClientId: clientId,

          Username: username,

          ConfirmationCode: confirmationCode,

          Password: newPassword,
        }),
      );

      return {
        message: 'Password reset completed successfully.',
      };
    } catch (error: unknown) {
      if (this.hasAwsErrorName(error, 'CodeMismatchException')) {
        throw new BadRequestException('Invalid confirmation code.');
      }

      if (this.hasAwsErrorName(error, 'ExpiredCodeException')) {
        throw new BadRequestException('Confirmation code has expired.');
      }

      if (this.hasAwsErrorName(error, 'InvalidPasswordException')) {
        throw new BadRequestException(
          'New password does not meet the password policy.',
        );
      }

      if (this.hasAwsErrorName(error, 'UserNotFoundException')) {
        throw new BadRequestException('Unable to reset password.');
      }

      throw new BadGatewayException('Unable to reset password.');
    }
  }

  private toAuthFlowResponse(
    result: CognitoAuthOutput,
    username: string,
  ): AuthFlowResponse {
    const authenticationResult = result.AuthenticationResult;

    if (authenticationResult?.AccessToken) {
      return {
        status: 'AUTHENTICATED',

        tokens: this.toAuthenticationTokens(authenticationResult),
      };
    }

    if (result.ChallengeName && result.Session) {
      return {
        status: 'CHALLENGE',

        challengeName: result.ChallengeName,

        username,

        session: result.Session,

        requiredAttributes: this.parseRequiredAttributes(
          result.ChallengeParameters?.requiredAttributes,
        ),
      };
    }

    throw new BadGatewayException(
      'Authentication provider returned an unexpected response.',
    );
  }

  private toAuthenticationTokens(
    result: CognitoAuthenticationResult,
    fallbackRefreshToken?: string,
  ): AuthenticationTokens {
    if (!result.AccessToken) {
      throw new BadGatewayException(
        'Authentication provider did not return an access token.',
      );
    }

    return {
      accessToken: result.AccessToken,

      idToken: result.IdToken,

      refreshToken: result.RefreshToken ?? fallbackRefreshToken,

      expiresIn: result.ExpiresIn,

      tokenType: result.TokenType,
    };
  }

  private parseRequiredAttributes(raw: string | undefined): string[] {
    if (!raw) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(
        (value): value is string => typeof value === 'string',
      );
    } catch {
      return [];
    }
  }

  private requireClientId(): string {
    if (!this.clientId) {
      throw new ServiceUnavailableException(
        'Cognito authentication is not configured.',
      );
    }

    return this.clientId;
  }

  private hasAwsErrorName(error: unknown, expectedName: string): boolean {
    return error instanceof Error && error.name === expectedName;
  }
}
