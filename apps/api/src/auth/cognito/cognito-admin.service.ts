import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';

import type {
  CreateCognitoAccountInput,
  CreatedCognitoAccount,
} from './cognito-account.interface';
import { generateTemporaryPassword } from './temporary-password.util';

@Injectable()
export class CognitoAdminService {
  private readonly logger = new Logger(CognitoAdminService.name);

  private readonly client: CognitoIdentityProviderClient;

  private readonly userPoolId: string | undefined;

  constructor(private readonly config: ConfigService) {
    const region = this.config.getOrThrow<string>('AWS_REGION');

    this.userPoolId = this.config.get<string>('COGNITO_USER_POOL_ID');

    this.client = new CognitoIdentityProviderClient({
      region,
    });
  }

  isConfigured(): boolean {
    return Boolean(this.userPoolId);
  }

  async createAccount(
    input: CreateCognitoAccountInput,
  ): Promise<CreatedCognitoAccount> {
    const userPoolId = this.requireUserPoolId();

    const temporaryPassword = generateTemporaryPassword();

    const userAttributes = [
      {
        Name: 'email',
        Value: input.email,
      },
      {
        Name: 'given_name',
        Value: input.firstName,
      },
      {
        Name: 'family_name',
        Value: input.lastName,
      },
    ];

    if (input.mobile) {
      userAttributes.push({
        Name: 'phone_number',
        Value: input.mobile,
      });
    }

    try {
      const result = await this.client.send(
        new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: input.username,
          TemporaryPassword: temporaryPassword,
          DesiredDeliveryMediums: ['EMAIL'],
          UserAttributes: userAttributes,
        }),
      );

      const user = result.User;

      if (!user?.Username) {
        throw new BadGatewayException(
          'Cognito did not return the created username.',
        );
      }

      const sub = user.Attributes?.find(
        (attribute) => attribute.Name === 'sub',
      )?.Value;

      if (!sub) {
        throw new BadGatewayException(
          'Cognito did not return the created user identifier.',
        );
      }

      return {
        sub,
        username: user.Username,
        status: user.UserStatus,
      };
    } catch (error: unknown) {
      if (this.hasAwsErrorName(error, 'UsernameExistsException')) {
        throw new ConflictException('Username already exists.');
      }

      if (this.hasAwsErrorName(error, 'AliasExistsException')) {
        throw new ConflictException(
          'Email or phone number is already associated with another account.',
        );
      }

      if (
        error instanceof ConflictException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }

      this.logger.error(
        'Cognito account creation failed.',
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error),
      );

      throw new BadGatewayException('Unable to create authentication account.');
    }
  }

  async deleteAccount(username: string): Promise<void> {
    const userPoolId = this.requireUserPoolId();

    try {
      await this.client.send(
        new AdminDeleteUserCommand({
          UserPoolId: userPoolId,
          Username: username,
        }),
      );
    } catch (error: unknown) {
      if (this.hasAwsErrorName(error, 'UserNotFoundException')) {
        return;
      }

      this.logger.error(
        'Cognito account deletion failed.',
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error),
      );

      throw new BadGatewayException('Unable to delete authentication account.');
    }
  }

  private requireUserPoolId(): string {
    if (!this.userPoolId) {
      throw new ServiceUnavailableException(
        'Cognito user management is not configured.',
      );
    }

    return this.userPoolId;
  }

  private hasAwsErrorName(error: unknown, expectedName: string): boolean {
    return error instanceof Error && error.name === expectedName;
  }
}
