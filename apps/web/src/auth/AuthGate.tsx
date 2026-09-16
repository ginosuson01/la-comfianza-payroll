import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from 'react'

import {
  ApiError,
} from '../api/client'
import {
  completeNewPassword,
  getCurrentIdentity,
  login,
  logout as logoutRequest,
  type ApplicationUserIdentity,
  type AuthFlowResponse,
  type AuthenticationChallengeResponse,
  type AuthenticationTokens,
} from '../api/auth'
import {
  clearAuthenticationTokens,
  loadAuthenticationTokens,
  saveAuthenticationTokens,
} from './session'
import {
  AuthContext,
} from './auth-context'

import './AuthGate.css'

interface AuthGateProps {
  children: ReactNode
}

type AuthState =
  | {
      status: 'LOADING'
    }
  | {
      status: 'SIGNED_OUT'
    }
  | {
      status: 'CHALLENGE'
      challenge: AuthenticationChallengeResponse
    }
  | {
      status: 'AUTHENTICATED'
      tokens: AuthenticationTokens
      user: ApplicationUserIdentity
    }

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected authentication error occurred.'
}

export function AuthGate({
  children,
}: AuthGateProps) {
  const [authState, setAuthState] =
    useState<AuthState>({
      status: 'LOADING',
    })

  const [username, setUsername] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [newPassword, setNewPassword] =
    useState('')

  const [
    confirmNewPassword,
    setConfirmNewPassword,
  ] = useState('')

  const [busy, setBusy] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const storedTokens =
        loadAuthenticationTokens()

      if (!storedTokens) {
        if (!cancelled) {
          setAuthState({
            status: 'SIGNED_OUT',
          })
        }

        return
      }

      try {
        const currentIdentity =
          await getCurrentIdentity(
            storedTokens.accessToken,
          )

        if (cancelled) {
          return
        }

        setAuthState({
          status: 'AUTHENTICATED',
          tokens: storedTokens,
          user:
            currentIdentity.identity.user,
        })
      } catch {
        clearAuthenticationTokens()

        if (!cancelled) {
          setAuthState({
            status: 'SIGNED_OUT',
          })
        }
      }
    }

    void restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  async function finishAuthentication(
    tokens: AuthenticationTokens,
  ): Promise<void> {
    saveAuthenticationTokens(
      tokens,
    )

    try {
      const currentIdentity =
        await getCurrentIdentity(
          tokens.accessToken,
        )

      setAuthState({
        status: 'AUTHENTICATED',
        tokens,
        user:
          currentIdentity.identity.user,
      })
    } catch (authenticationError) {
      clearAuthenticationTokens()

      throw authenticationError
    }
  }

  async function processAuthResponse(
    response: AuthFlowResponse,
  ): Promise<void> {
    if (
      response.status ===
      'AUTHENTICATED'
    ) {
      await finishAuthentication(
        response.tokens,
      )

      return
    }

    if (
      response.challengeName !==
      'NEW_PASSWORD_REQUIRED'
    ) {
      throw new Error(
        `Authentication challenge ${response.challengeName} is not supported by this Phase 1 login screen.`,
      )
    }

    setAuthState({
      status: 'CHALLENGE',
      challenge: response,
    })
  }

  async function handleLogin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !username.trim() ||
      !password
    ) {
      setError(
        'Username and password are required.',
      )

      return
    }

    setBusy(true)
    setError(null)

    try {
      const response =
        await login(
          username.trim(),
          password,
        )

      await processAuthResponse(
        response,
      )

      setPassword('')
    } catch (loginError) {
      setError(
        getErrorMessage(
          loginError,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleNewPassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      authState.status !==
      'CHALLENGE'
    ) {
      return
    }

    if (!newPassword) {
      setError(
        'New password is required.',
      )

      return
    }

    if (
      newPassword !==
      confirmNewPassword
    ) {
      setError(
        'New password and confirmation do not match.',
      )

      return
    }

    setBusy(true)
    setError(null)

    try {
      const response =
        await completeNewPassword(
          authState.challenge.username,
          newPassword,
          authState.challenge.session,
        )

      await processAuthResponse(
        response,
      )

      setNewPassword('')
      setConfirmNewPassword('')
    } catch (challengeError) {
      setError(
        getErrorMessage(
          challengeError,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    if (
      authState.status !==
      'AUTHENTICATED'
    ) {
      return
    }

    const refreshToken =
      authState.tokens.refreshToken

    clearAuthenticationTokens()

    setAuthState({
      status: 'SIGNED_OUT',
    })

    setPassword('')
    setError(null)

    if (!refreshToken) {
      return
    }

    try {
      await logoutRequest(
        refreshToken,
      )
    } catch {
      /*
       * Local session is already cleared.
       * A remote logout failure must not keep
       * the browser authenticated.
       */
    }
  }

  if (
    authState.status ===
    'LOADING'
  ) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-loading-card">
          <div className="auth-brand-mark">
            LC
          </div>

          <h1>La Comfianza Payroll</h1>

          <p>
            Restoring your secure session…
          </p>
        </section>
      </main>
    )
  }

  if (
    authState.status ===
    'SIGNED_OUT'
  ) {
    return (
      <main className="auth-page">
        <div className="auth-layout">
          <section className="auth-intro">
            <div className="auth-brand">
              <div className="auth-brand-mark">
                LC
              </div>

              <div>
                <strong>
                  La Comfianza
                </strong>

                <span>
                  Payroll System
                </span>
              </div>
            </div>

            <div className="auth-intro-copy">
              <p className="auth-eyebrow">
                Phase 1
              </p>

              <h1>
                Multi-Company Payroll Management
              </h1>

              <p>
                Secure access for authorized
                payroll personnel.
              </p>
            </div>
          </section>

          <section className="auth-card">
            <p className="auth-eyebrow">
              Payroll Manager
            </p>

            <h2>Sign in</h2>

            <p className="auth-muted">
              Use your assigned payroll system
              username and password.
            </p>

            <form
              className="auth-form"
              onSubmit={
                handleLogin
              }
            >
              <label>
                <span>Username</span>

                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  disabled={busy}
                  onChange={(event) =>
                    setUsername(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>Password</span>

                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  disabled={busy}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                />
              </label>

              {error && (
                <div
                  className="auth-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="auth-primary-button"
                disabled={busy}
              >
                {busy
                  ? 'Signing in…'
                  : 'Sign in'}
              </button>
            </form>

            <p className="auth-security-note">
              Authentication is handled through
              the configured AWS Cognito user
              pool.
            </p>
          </section>
        </div>
      </main>
    )
  }

  if (
    authState.status ===
    'CHALLENGE'
  ) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-password-card">
          <div className="auth-brand-mark">
            LC
          </div>

          <p className="auth-eyebrow">
            First Login
          </p>

          <h1>
            Set your new password
          </h1>

          <p className="auth-muted">
            The temporary password was accepted.
            Create your permanent password to
            continue.
          </p>

          <form
            className="auth-form"
            onSubmit={
              handleNewPassword
            }
          >
            <label>
              <span>Username</span>

              <input
                value={
                  authState
                    .challenge
                    .username
                }
                disabled
              />
            </label>

            <label>
              <span>
                New Password
              </span>

              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                disabled={busy}
                onChange={(event) =>
                  setNewPassword(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Confirm New Password
              </span>

              <input
                type="password"
                autoComplete="new-password"
                value={
                  confirmNewPassword
                }
                disabled={busy}
                onChange={(event) =>
                  setConfirmNewPassword(
                    event.target.value,
                  )
                }
              />
            </label>

            {error && (
              <div
                className="auth-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="auth-primary-button"
              disabled={busy}
            >
              {busy
                ? 'Updating…'
                : 'Set Password & Continue'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <AuthContext.Provider
      value={{
        accessToken:
          authState.tokens.accessToken,

        user:
          authState.user,

        logout:
          handleLogout,
      }}
    >
      <div className="authenticated-app">
        {children}

        <div className="auth-session-control">
          <div>
            <span>
              Signed in as
            </span>

            <strong>
              {
                authState.user
                  .username
              }
            </strong>
          </div>

          <button
            type="button"
            onClick={() => {
              void handleLogout()
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </AuthContext.Provider>
  )
}
