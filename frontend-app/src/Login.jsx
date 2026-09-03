import { useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { T, mono, sans, Panel, Btn, Eyebrow } from './app/shared/ui'
import { Clapperboard, Eye, EyeOff, AlertCircle, ArrowRight, Loader2, Mail, Lock, Sparkles } from 'lucide-react'

export default function Login({ onSuccess }) {
  const { login } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = useCallback(
    async (e) => {
      e.preventDefault()
      setLoading(true)
      setError('')
      try {
        // NOTE: AuthContext currently only exposes `login`. If a separate
        // signup endpoint exists, swap this in for mode === 'signup'.
        const me = await login(email, password)
        onSuccess?.(me)
      } catch (err) {
        setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
      } finally {
        setLoading(false)
      }
    },
    [email, password, login, onSuccess]
  )

  const switchMode = useCallback((next) => {
    setMode(next)
    setError('')
  }, [])

  const canSubmit = email.includes('@') && password.length >= 1 && !loading

  const inputWrap = { position: 'relative', display: 'flex', alignItems: 'center' }
  const inputIcon = { position: 'absolute', left: 12, color: T.muted, pointerEvents: 'none' }
  const fieldInput = (hasRightIcon) => ({
    width: '100%',
    padding: `8px 12px 8px 40px`,
    paddingRight: hasRightIcon ? 40 : 12,
    background: T.panel2,
    border: `1px solid ${T.line}`,
    borderRadius: 4,
    color: T.paper,
    fontSize: 14,
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: sans,
  })

  return (
    <div style={{ background: T.ink, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: sans }}>
      <Panel animate style={{ padding: 32, width: 380, maxWidth: '92vw' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <span style={{ display: 'inline-grid', placeItems: 'center', width: 28, height: 28, border: `1.5px solid ${T.violet}`, borderRadius: 6, color: T.violet, background: `${T.violet}1A` }}>
            <Clapperboard size={16} aria-hidden="true" />
          </span>
          <span style={{ font: `700 15px/1 ${sans}`, color: T.paper, letterSpacing: '-0.01em' }}>Agentic Content Studio</span>
        </div>

        {/* Mode toggle */}
        <div role="tablist" aria-label="Authentication mode" style={{ display: 'flex', gap: 4, marginBottom: 20, padding: 4, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 8 }}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            onClick={() => switchMode('signin')}
            style={{
              flex: 1, minHeight: 34, padding: '8px 12px', border: 'none', borderRadius: 6,
              font: `600 11px/1 ${sans}`, cursor: 'pointer',
              background: mode === 'signin' ? T.raised : 'transparent',
              color: mode === 'signin' ? T.paper : T.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <ArrowRight size={13} /> Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => switchMode('signup')}
            style={{
              flex: 1, minHeight: 34, padding: '8px 12px', border: 'none', borderRadius: 6,
              font: `600 11px/1 ${sans}`, cursor: 'pointer',
              background: mode === 'signup' ? T.raised : 'transparent',
              color: mode === 'signup' ? T.paper : T.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Sparkles size={13} /> Sign up
          </button>
        </div>

        {/* Title (subtitle removed per review) */}
        <h1 style={{ font: `700 18px/1.2 ${sans}`, color: T.paper, margin: '0 0 20px 0' }}>
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </h1>

        <form onSubmit={submit} noValidate>
          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <Eyebrow style={{ marginBottom: 6 }}>Email</Eyebrow>
            <div style={inputWrap}>
              <Mail size={16} style={inputIcon} aria-hidden="true" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                placeholder="you@studio.com"
                style={fieldInput(false)}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <Eyebrow style={{ marginBottom: 6 }}>Password</Eyebrow>
            <div style={inputWrap}>
              <Lock size={16} style={inputIcon} aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                placeholder={mode === 'signin' ? 'Enter password' : 'Choose a password'}
                style={fieldInput(true)}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 10, background: 'none', border: 'none', color: T.muted, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 4 }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" aria-live="assertive" style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.clay, fontSize: 12, marginBottom: 16, padding: '8px 12px', background: `${T.clay}1A`, borderRadius: 4 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <Btn
            type="submit"
            kind="primary"
            disabled={!canSubmit}
            style={{ width: '100%',border: `1px solid ${T.violet}`, boxShadow: `0 2px 10px ${T.violet}33`,}}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                {mode === 'signin' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              <>
                {mode === 'signin' ? 'Sign in' : 'Sign up'}
                <ArrowRight size={16} />
              </>
            )}
          </Btn>
        </form>

        {/* "First time?" note box removed per review */}
      </Panel>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}