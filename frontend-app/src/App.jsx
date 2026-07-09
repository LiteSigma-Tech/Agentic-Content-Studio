import { useState } from 'react'
import { useAuth } from './AuthContext'
import Login from './Login'
import PlatformConsole from './PlatformConsole'

export default function App() {
  const { isLoggedIn, loading } = useAuth()
  const [showLogin, setShowLogin] = useState(false)

  if (loading) {
    return (
      <div style={{ background: '#14110E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A6987F', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
        LOADING...
      </div>
    )
  }

  if (showLogin) {
    return <Login onSuccess={() => setShowLogin(false)} />
  }

  return <PlatformConsole onLoginRequest={() => setShowLogin(true)} />
}
