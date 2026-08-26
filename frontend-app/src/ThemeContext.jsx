import { createContext, useContext, useState, useEffect } from 'react'

/* ═══════════════════════════════════════════════════════════════
   ThemeContext.jsx — app-wide dark/light theme
   Previously this state lived inside landing/Layout.jsx's local
   usePreferredTheme() hook and was only ever applied to the
   .landing-page div, so Login, AppShell, and all app/ pages never
   saw it. Moved here so the theme is ambient for the whole app, per
   "Move [data-theme] from .landing-page scope to app root".

   Behavior preserved from the old hook on purpose (no regression):
   - Initializes from the OS color-scheme preference, not a stored
     user choice — there was no localStorage persistence before and
     this task didn't ask for one.
   - Keeps following OS preference changes live via matchMedia,
     even after a manual toggle — same as before.
   ═══════════════════════════════════════════════════════════════ */

const ThemeContext = createContext(null)

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event) => {
      const next = event.matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next) // sync -- see toggleTheme below for why
      setTheme(next)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Applied at root (<html>), outside any single page's render tree,
  // so it persists across route changes without flashing back to a
  // default — this is what makes App.css's `:root[data-theme="light"]`
  // block (and therefore Login/AppShell/app/ pages) respond to theme.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      // Apply the attribute synchronously here, not in the useEffect above.
      // T (in ui.jsx) is a Proxy that reads this attribute live during
      // render; an effect only runs after the render it was scheduled
      // from commits, so components would otherwise render once with the
      // stale attribute and need a second, unrelated re-render to catch
      // up. Setting it here closes that gap -- and since Layout.jsx and
      // AppShell.jsx both call this same toggleTheme, both stay in sync
      // by construction, not by any separate wiring.
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)