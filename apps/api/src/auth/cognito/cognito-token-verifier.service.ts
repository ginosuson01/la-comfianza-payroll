import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoJwtVerifier,
  CognitoJwtVerifierSingleUserPool,
} from 'aws-jwt-verify/cognito-verifier';

import { AuthenticatedIdentity } from '../interfaces/authenticated-identity.interface';

@Injectable()
export class CognitoTokenVerifierService {
  private readonly verifier:
    | CognitoJwtVerifierSingleUserPool<{
        userPoolId: string;
        tokenUse: 'access';
        clientId: string;
      }>
    | undefined;

  constructor(private readonly config: ConfigService) {
    const userPoolId = this.config.get<string>('COGNITO_USER_POOL_ID');

    const clientId = this.config.get<string>('COGNITO_CLIENT_ID');

    if (userPoolId && clientId) {
      this.verifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: 'access',
        clientId,
      });
    }
  }

  async verify(accessToken: string): Promise<AuthenticatedIdentity> {
    if (!this.verifier) {
      throw new ServiceUnavailableException(
        'Authentication provider is not configured.',
      );
    }

    const payload = await this.verifier.verify(accessToken);

    return {
      sub: payload.sub,
      username: payload.username,
      clientId: payload.client_id,
    };
  }
}
