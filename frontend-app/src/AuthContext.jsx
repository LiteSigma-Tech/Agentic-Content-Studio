import { createContext, useContext, useState, useEffect } from 'react'
import { auth } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const PROTOTYPE_NO_AUTH = true
  // PROTOTYPE ONLY — bypasses real login. Set to false / remove before any real deployment.
  const prototypeUser = {
    id: 'prototype-admin',
    name: 'Prototype Admin',
    role: 'admin',
    tenant: 'Prototype Tenant',
  }

  const [user, setUser] = useState(PROTOTYPE_NO_AUTH ? prototypeUser : null)
  const [loading, setLoading] = useState(PROTOTYPE_NO_AUTH ? false : true)

  useEffect(() => {
    if (PROTOTYPE_NO_AUTH) {
      setUser(prototypeUser)
      setLoading(false)
      return
    }

    if (auth.isLoggedIn()) {
      auth.whoami()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('refresh_token')
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    if (PROTOTYPE_NO_AUTH) {
      setUser(prototypeUser)
      return prototypeUser
    }

    await auth.login(email, password)
    const me = await auth.whoami()
    setUser(me)
    return me
  }

  const logout = async () => {
    if (PROTOTYPE_NO_AUTH) {
      setUser(null)
      return
    }

    await auth.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
