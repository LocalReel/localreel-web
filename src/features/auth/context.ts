import { createContext, useContext } from 'react'

import type { User } from '../../data/types'

export type SessionUser = User

export interface AuthValue {
  user: User
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthGate')
  return value
}

export function useIsAdmin(): boolean {
  return useAuth().user.role === 'admin'
}
