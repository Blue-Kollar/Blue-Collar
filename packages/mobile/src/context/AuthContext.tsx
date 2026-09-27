import React, { createContext, useContext, useState, useEffect } from 'react'
import { SecureStorage } from '../auth/SecureStorage'
import { BiometricAuth } from '../auth/BiometricAuth'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isLocked: boolean
  login: (token: string, user: User) => Promise<void>
  logout: () => Promise<void>
  unlock: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  async function checkAuthStatus() {
    const authenticated = await SecureStorage.isAuthenticated()
    
    if (authenticated) {
      const userData = await SecureStorage.getUser()
      setUser(userData)
      setIsAuthenticated(true)

      // Check if biometric unlock is enabled
      const biometricEnabled = await BiometricAuth.isEnabled()
      if (biometricEnabled) {
        setIsLocked(true)
      }
    }

    setIsLoading(false)
  }

  async function login(token: string, userData: User) {
    await SecureStorage.setToken(token)
    await SecureStorage.setUser(userData)
    setUser(userData)
    setIsAuthenticated(true)
  }

  async function logout() {
    await SecureStorage.clear()
    setUser(null)
    setIsAuthenticated(false)
    setIsLocked(false)
  }

  function unlock() {
    setIsLocked(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        isLocked,
        login,
        logout,
        unlock,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
