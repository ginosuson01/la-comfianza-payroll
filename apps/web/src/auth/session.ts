import type {
  AuthenticationTokens,
} from '../api/auth'

const SESSION_STORAGE_KEY =
  'la-comfianza-payroll.auth'

export function saveAuthenticationTokens(
  tokens: AuthenticationTokens,
): void {
  window.sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify(tokens),
  )
}

export function loadAuthenticationTokens():
  AuthenticationTokens | null {
  const stored =
    window.sessionStorage.getItem(
      SESSION_STORAGE_KEY,
    )

  if (!stored) {
    return null
  }

  try {
    const value =
      JSON.parse(stored) as Partial<AuthenticationTokens>

    if (
      typeof value.accessToken !==
        'string' ||
      !value.accessToken.trim()
    ) {
      clearAuthenticationTokens()

      return null
    }

    return {
      accessToken:
        value.accessToken,

      ...(typeof value.idToken ===
      'string'
        ? {
            idToken:
              value.idToken,
          }
        : {}),

      ...(typeof value.refreshToken ===
      'string'
        ? {
            refreshToken:
              value.refreshToken,
          }
        : {}),

      ...(typeof value.expiresIn ===
      'number'
        ? {
            expiresIn:
              value.expiresIn,
          }
        : {}),

      ...(typeof value.tokenType ===
      'string'
        ? {
            tokenType:
              value.tokenType,
          }
        : {}),
    }
  } catch {
    clearAuthenticationTokens()

    return null
  }
}

export function clearAuthenticationTokens(): void {
  window.sessionStorage.removeItem(
    SESSION_STORAGE_KEY,
  )
}
