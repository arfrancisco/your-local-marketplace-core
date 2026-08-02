import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getCredentials, setCredentials, clearCredentials } from './api/client'

interface AuthState {
  authenticated: boolean
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

// There's no admin User record — this is a single shared operator
// credential (HTTP Basic), not a real account. Auth state is just a
// boolean, verified by round-tripping a cheap read against the admin API
// rather than trusting whatever's sitting in localStorage.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getCredentials()) {
      setLoading(false)
      return
    }
    api
      .listUsers({ page: 1 })
      .then(() => setAuthenticated(true))
      .catch(() => clearCredentials())
      .finally(() => setLoading(false))
  }, [])

  async function login(username: string, password: string) {
    setCredentials(username, password)
    try {
      await api.listUsers({ page: 1 })
      setAuthenticated(true)
    } catch (err) {
      clearCredentials()
      throw err
    }
  }

  function logout() {
    clearCredentials()
    setAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ authenticated, loading, login, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
