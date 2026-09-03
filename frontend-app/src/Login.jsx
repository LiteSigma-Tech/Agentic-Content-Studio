import { useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { T, mono, sans, Panel, Btn, Eyebrow } from './app/shared/ui'
import { Clapperboard, Eye, EyeOff, AlertCircle, ArrowRight, Loader2, Mail, Lock, Sparkles } from 'lucide-react'

// Simple Inline SVG Icons for Social Providers
const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"/>
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12s.7 2.3 1.9 4.7l3.7-2.9z"/>
    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
  </svg>
)

const GitHubIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
)

export default function Login({ onSuccess }) {
  const { login, loginWithProvider } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [providerLoading, setProviderLoading] = useState(null)

  const submit = useCallback(
    async (e) => {
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
    },
    [email, password, login, onSuccess]
  )

  const handleOAuthLogin = async (provider) => {
    setProviderLoading(provider)
    setError('')
    try {
      if (loginWithProvider) {
        const me = await loginWithProvider(provider)
        onSuccess?.(me)
      } else {
        // Fallback / standard OAuth redirect path:
        window.location.href = `/api/auth/${provider}`
      }
    } catch (err) {
      setError(`Failed to sign in with ${provider}.`)
      setProviderLoading(null)
    }
  }

  const switchMode = useCallback((next) => {
    setMode(next)
    setError('')
  }, [])

  const canSubmit = email.includes('@') && password.length >= 1 && !loading && !providerLoading

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

  const socialBtnStyle = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justify: 'center',
    gap: 8,
    height: 36,
    padding: '0 12px',
    background: T.panel2,
    border: `1px solid ${T.line}`,
    borderRadius: 4,
    color: T.paper,
    font: `500 13px/1 ${sans}`,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  }

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

        {/* Title */}
        <h1 style={{ font: `700 18px/1.2 ${sans}`, color: T.paper, margin: '0 0 20px 0' }}>
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </h1>

        {/* Social Authentication */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            disabled={loading || !!providerLoading}
            onClick={() => handleOAuthLogin('google')}
            style={socialBtnStyle}
          >
            {providerLoading === 'google' ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <>
                <GoogleIcon /> Google
              </>
            )}
          </button>
          <button
            type="button"
            disabled={loading || !!providerLoading}
            onClick={() => handleOAuthLogin('github')}
            style={socialBtnStyle}
          >
            {providerLoading === 'github' ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <>
                <GitHubIcon /> GitHub
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: T.line }} />
          <span style={{ font: `500 11px/1 ${mono}`, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            or continue with
          </span>
          <div style={{ flex: 1, height: 1, background: T.line }} />
        </div>

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
                disabled={loading || !!providerLoading}
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
                disabled={loading || !!providerLoading}
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
            style={{ width: '100%', border: `1px solid ${T.violet}`, boxShadow: `0 2px 10px ${T.violet}33` }}
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
      </Panel>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}