import {
  apiRequest,
  publicApiRequest,
} from './client'

export interface AuthenticationTokens {
  accessToken: string
  idToken?: string
  refreshToken?: string
  expiresIn?: number
  tokenType?: string
}

export interface AuthenticatedResponse {
  status: 'AUTHENTICATED'
  tokens: AuthenticationTokens
}

export interface AuthenticationChallengeResponse {
  status: 'CHALLENGE'
  challengeName: string
  username: string
  session: string
  requiredAttributes: string[]
}

export type AuthFlowResponse =
  | AuthenticatedResponse
  | AuthenticationChallengeResponse

export interface ApplicationUserIdentity {
  id: string
  username: string
  email: string
  status: string
  roles: string[]
}

export interface CurrentIdentityResponse {
  authenticated: true

  identity: {
    user: ApplicationUserIdentity
  }
}

export function login(
  username: string,
  password: string,
): Promise<AuthFlowResponse> {
  return publicApiRequest<AuthFlowResponse>(
    '/auth/login',
    {
      method: 'POST',

      body: JSON.stringify({
        username,
        password,
      }),
    },
  )
}

export function completeNewPassword(
  username: string,
  newPassword: string,
  session: string,
): Promise<AuthFlowResponse> {
  return publicApiRequest<AuthFlowResponse>(
    '/auth/complete-new-password',
    {
      method: 'POST',

      body: JSON.stringify({
        username,
        newPassword,
        session,
      }),
    },
  )
}

export function getCurrentIdentity(
  accessToken: string,
): Promise<CurrentIdentityResponse> {
  return apiRequest<CurrentIdentityResponse>(
    '/auth/me',
    accessToken,
  )
}

export function logout(
  refreshToken: string,
): Promise<unknown> {
  return publicApiRequest<unknown>(
    '/auth/logout',
    {
      method: 'POST',

      body: JSON.stringify({
        refreshToken,
      }),
    },
  )
}
