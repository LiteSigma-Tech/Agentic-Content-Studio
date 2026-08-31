import { useState } from 'react'
import { useAuth } from './AuthContext'
import { T, mono, sans } from './app/shared/ui'


export default function Login({ onSuccess }) {

  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const me = await login(email, password)
      onSuccess?.(me)
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const inp = { width: '100%', padding: '8px 12px', background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 4, color: T.paper, fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: sans }

  return (
    <div style={{ background: T.ink, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: sans }}>
      <div style={{ background: T.panel, padding: 32, borderRadius: 8, width: 360, maxWidth: '92vw', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.amber }} />
          <span style={{ color: T.amber, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', fontFamily: mono }}>AGENTIC PLATFORM</span>
        </div>
        <div style={{ color: T.paper, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Sign in</div>
        <div style={{ color: T.muted, fontSize: 12, marginBottom: 24 }}>Operator console access</div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: T.muted, fontSize: 11, fontFamily: mono, letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>EMAIL</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: T.muted, fontSize: 11, fontFamily: mono, letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>PASSWORD</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inp} />
          </div>
          {error && <div style={{ color: T.clay, fontSize: 12, marginBottom: 16, padding: '8px 12px', background: 'rgba(210,105,75,0.1)', borderRadius: 4 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px 0', background: T.amber, color: T.ink, border: 'none', borderRadius: 4, fontWeight: 700, fontSize: 13, fontFamily: mono, letterSpacing: '0.04em', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>
        </form>
        <div style={{ marginTop: 20, padding: '12px', background: T.panel2, borderRadius: 4, border: `1px solid ${T.line}` }}>
          <div style={{ color: T.muted, fontSize: 11, fontFamily: mono }}>FIRST TIME?</div>
          <div style={{ color: T.faint, fontSize: 11, marginTop: 4 }}>POST /admin/tenants on the platform service to create a tenant + admin credentials.</div>
        </div>
      </div>
    </div>
  )
}
