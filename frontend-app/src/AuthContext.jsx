import { createContext, useContext, useState, useEffect } from 'react'
import { auth } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
    await auth.login(email, password)
    const me = await auth.whoami()
    setUser(me)
    return me
  }

  const logout = async () => {
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
