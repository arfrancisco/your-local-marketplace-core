import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getToken, setToken, getStoredAdminAccount, setStoredAdminAccount } from './api/client'
import type { AdminAccount } from './api/types'

// Mirrors customer-web's auth.tsx shape: a real per-admin bearer token
// (AdminUser/AdminApiToken on the backend), not the old shared HTTP Basic
// operator credential. adminAccount carries the signed-in admin's identity
// (used for e.g. showing who's signed in, and disabling self-service
// actions on your own row) rather than a bare authenticated boolean.
interface AuthState {
  adminAccount: AdminAccount | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [adminAccount, setAdminAccount] = useState<AdminAccount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    // There's no GET /admin/me endpoint, so verify-on-load re-validates the
    // token with a cheap authenticated call and, if it still works, trusts
    // the admin identity cached alongside the token at login time.
    api
      .listAdminAccounts({ page: 1 })
      .then(() => setAdminAccount(getStoredAdminAccount()))
      .catch(() => {
        setToken(null)
        setStoredAdminAccount(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const res = await api.login(email, password)
    setToken(res.token)
    setStoredAdminAccount(res.admin_user)
    setAdminAccount(res.admin_user)
  }

  function logout() {
    // Best-effort server-side revocation; local sign-out proceeds regardless
    // (e.g. the token may already be expired/invalid).
    api.logout().catch(() => {})
    setToken(null)
    setStoredAdminAccount(null)
    setAdminAccount(null)
  }

  return (
    <AuthContext.Provider value={{ adminAccount, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
