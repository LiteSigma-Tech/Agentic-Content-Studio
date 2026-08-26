import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import {
  Clapperboard,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Loader2,
  Mail,
  Lock,
  Sparkles,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   Login — Agentic Content Studio
   Restyled onto the landing page's dark theme design system:
   monochrome bg/fg/accent CSS custom properties (App.css / :root),
   the shared .auth-shell / .auth-card / .field-input / .btn / etc.
   components (App.css), and the same display/body/mono font stack
   and brand mark as landing/Layout.jsx's nav — instead of the
   separate warm-charcoal/amber console token set (app/shared/ui),
   which is the authenticated-console theme, not this page's.

   Interaction states (hover, focus, disabled) are handled in CSS
   via App.css's existing :hover/:focus-visible/:disabled rules on
   .btn and .field-input, rather than JS-tracked hover/focus state,
   matching how landing.css drives its own interactivity.

   Reacts to [data-theme] automatically via CSS vars — no theme
   logic needed here (see ThemeContext.jsx, mounted at app root).
   ═══════════════════════════════════════════════════════════════ */

export default function Login({ onSuccess }) {
  const PROTOTYPE_NO_AUTH = true
  // PROTOTYPE ONLY — bypasses real login. Set to false / remove before any real deployment.

  const { login } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const errorRef = useRef(null)

  // Shake error into view
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [error])

  const submit = useCallback(
    async (e) => {
      e.preventDefault()
      setLoading(true)
      setError('')

      if (PROTOTYPE_NO_AUTH) {
        await login(email, password)
        onSuccess?.()
        setLoading(false)
        return
      }

      try {
        await login(email, password)
        onSuccess?.()
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

  const isEmailValid = email.length > 0 && email.includes('@')
  const isPasswordValid = password.length >= 1
  const canSubmit = isEmailValid && isPasswordValid && !loading

  return (
    <div className="auth-shell login-page">
      <style>{`
        @keyframes login-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @keyframes login-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes login-slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes login-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-animate-in, .login-mode-animate { animation: none; }
        }

        /* Ambient background — same spotlight + grid language as the
           landing hero (.landing-hero__spotlight / .hero-frame__grid),
           recolored off var(--accent) so it tracks theme/palette. */
        .login-page { position: relative; overflow: hidden; padding: 24px; }
        .login-page__spotlight {
          position: absolute; top: 8%; left: 50%; transform: translateX(-50%);
          width: 600px; height: 400px; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%);
        }
        .login-page__grid {
          position: absolute; inset: 0; pointer-events: none; z-index: 0; opacity: 0.5;
          background-image:
            linear-gradient(color-mix(in srgb, var(--accent) 6%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--accent) 6%, transparent) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .login-page__card { position: relative; z-index: 1; overflow: hidden; }
        .login-page__card-glow {
          position: absolute; top: 0; left: 0; right: 0; height: 2px; opacity: 0.6;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
        }

        .login-page__brand {
          display: inline-flex; align-items: center; gap: 10px; margin-bottom: var(--space-xl);
          font-family: var(--font-display); font-size: 15px; font-weight: 760; letter-spacing: -0.01em;
          color: var(--fg);
        }
        .login-page__brand-mark {
          display: inline-grid; place-items: center; width: 28px; height: 28px;
          border: 1.5px solid var(--accent); border-radius: 6px; color: var(--accent);
          position: relative; overflow: hidden; flex-shrink: 0;
        }
        .login-page__brand-mark::after { content: ''; position: absolute; inset: 0; background: var(--accent); opacity: 0.1; }

        .login-page__mode-toggle {
          display: flex; gap: 4px; margin-bottom: var(--space-lg);
          padding: 4px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-md);
        }
        .login-page__mode-toggle .btn {
          min-height: 34px; padding: 8px 12px; border: none; border-radius: calc(var(--radius-md) - 2px);
          font-size: 11px; background: transparent; color: var(--muted);
        }
        .login-page__mode-toggle .btn.is-active { background: var(--surface-3); color: var(--fg); }
        .login-page__mode-toggle .btn:hover { transform: none; }

        .login-page__input-wrap { position: relative; display: flex; align-items: center; }
        .login-page__input-icon { position: absolute; left: 12px; color: var(--muted); pointer-events: none; z-index: 1; }
        .login-page__input-wrap .field-input { padding-left: 40px; }
        .login-page__input-wrap .field-input.has-icon-right { padding-right: 40px; }
        .login-page__pw-toggle {
          position: absolute; right: 10px; display: grid; place-items: center;
          background: none; border: none; color: var(--muted); cursor: pointer;
          padding: 4px; border-radius: 6px; transition: color 200ms ease;
        }
        .login-page__pw-toggle:hover, .login-page__pw-toggle.is-active { color: var(--accent); }

        .login-page__error { display: flex; align-items: center; gap: 8px; animation: login-shake 400ms ease; }

        .login-page__submit { width: 100%; margin-top: 4px; gap: 8px; }
        .login-page__spin { animation: login-spin 1s linear infinite; }

        .login-page__hint-title { display: flex; align-items: center; gap: 6px; }
        .login-page__hint-body { margin-top: 6px; }

        .login-animate-in { animation: login-fade-in 400ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .login-mode-animate { animation: login-slide-up 300ms cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>

      <div className="login-page__spotlight" />
      <div className="login-page__grid" />

      <div className="auth-card surface-card login-page__card login-animate-in">
        <div className="login-page__card-glow" />

        {/* Brand — matches landing/Layout.jsx's nav brand */}
        <div className="login-page__brand">
          <span className="login-page__brand-mark">
            <Clapperboard size={16} aria-hidden="true" />
          </span>
          <span>Agentic Content Studio</span>
        </div>

        {/* Mode toggle */}
        <div className="login-page__mode-toggle" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`btn btn--secondary ${mode === 'signin' ? 'is-active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            <ArrowRight size={13} />
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`btn btn--secondary ${mode === 'signup' ? 'is-active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            <Sparkles size={13} />
            Sign up
          </button>
        </div>

        {/* Title */}
        <div key={mode} className="login-mode-animate">
          <h1 className="form-title">{mode === 'signin' ? 'Welcome back' : 'Create account'}</h1>
          <p className="form-subtitle">
            {mode === 'signin' ? 'Sign in to your studio' : 'Prototype account setup'}
          </p>
        </div>

        <form onSubmit={submit} noValidate>
          {/* Email */}
          <div className="field">
            <label className="field-label" htmlFor="login-email">
              Email
            </label>
            <div className="login-page__input-wrap">
              <Mail size={16} className="login-page__input-icon" aria-hidden="true" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                placeholder="you@studio.com"
                className={`field-input ${error && !isEmailValid ? 'has-error' : ''}`}
              />
            </div>
          </div>

          {/* Password */}
          <div className="field">
            <label className="field-label" htmlFor="login-password">
              Password
            </label>
            <div className="login-page__input-wrap">
              <Lock size={16} className="login-page__input-icon" aria-hidden="true" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                placeholder={mode === 'signin' ? 'Enter password' : 'Choose a password'}
                className={`field-input has-icon-right ${error && !isPasswordValid ? 'has-error' : ''}`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((s) => !s)}
                className={`login-page__pw-toggle ${showPassword ? 'is-active' : ''}`}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div ref={errorRef} className="alert-error login-page__error" role="alert" aria-live="assertive">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={loading}
            className="btn btn--primary login-page__submit"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="login-page__spin" />
                {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
              </>
            ) : (
              <>
                {mode === 'signin' ? 'Sign in' : 'Sign up'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Hint */}
        <div className="note-box">
          <div className="note-box__label login-page__hint-title">
            <AlertCircle size={12} />
            First time?
          </div>
          <div className="note-box__text login-page__hint-body">
            POST /admin/tenants on the platform service to create a tenant + admin credentials.
          </div>
        </div>
      </div>
    </div>
  )
}