import {
  createContext,
} from 'react'

import type {
  ApplicationUserIdentity,
} from '../api/auth'

export interface AuthContextValue {
  accessToken: string
  user: ApplicationUserIdentity

  logout: () => Promise<void>
}

export const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  )
