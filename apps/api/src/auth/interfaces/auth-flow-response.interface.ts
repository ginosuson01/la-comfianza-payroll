export interface AuthenticationTokens {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

export interface AuthenticatedResponse {
  status: 'AUTHENTICATED';
  tokens: AuthenticationTokens;
}

export interface AuthenticationChallengeResponse {
  status: 'CHALLENGE';
  challengeName: string;
  username: string;
  session: string;
  requiredAttributes: string[];
}

export type AuthFlowResponse =
  AuthenticatedResponse | AuthenticationChallengeResponse;
