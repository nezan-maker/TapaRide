import React, { createContext, useContext, useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, ApiError } from './api'

export type Role = 'CLIENT' | 'DRIVER' | 'MANAGER' | 'OWNER' | 'ORGANIZATION';

export interface UserProfile {
  id: string
  email: string
  phone: string
  role: Role
  isVerified: boolean
  phoneVerifiedAt: string | null
}

interface AuthContextType {
  user: UserProfile | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  loginOAuth: (provider: 'google' | 'apple', idToken: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshUser = async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const data = await api.get('/api/users/me')
      setUser(data.user || data)
    } catch (err) {
      console.error('Failed to fetch user profile:', err)
      // Token might be invalid, clear it
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()

    const handleExternalLogout = () => {
      setUser(null)
      setError(null)
    }

    window.addEventListener('auth-logout', handleExternalLogout)
    return () => {
      window.removeEventListener('auth-logout', handleExternalLogout)
    }
  }, [])

  const login = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.post('/api/auth/login', { email, password })
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      setUser(data.user)
    } catch (err) {
      const errMsg = err instanceof ApiError ? err.message : 'Login failed'
      setError(errMsg)
      throw err;
    } finally {
      setLoading(false)
    }
  }

  const loginOAuth = async (provider: 'google' | 'apple', idToken: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.post(`/api/auth/${provider}`, { idToken })
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      setUser(data.user)
    } catch (err) {
      const errMsg = err instanceof ApiError ? err.message : 'Social login failed'
      setError(errMsg)
      throw err;
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await api.post('/api/auth/logout')
    } catch (err) {
      console.error('Logout request failed:', err)
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setUser(null)
      setError(null)
      setLoading(false)
    }
  }

  const clearError = () => setError(null)

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        loginOAuth,
        logout,
        refreshUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: Role[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-100 border-t-flame-600" />
          <span className="text-sm font-medium text-ink-500">Verifying session...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
