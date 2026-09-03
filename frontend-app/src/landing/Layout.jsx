import { useEffect, useState, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { Clapperboard, ChevronUp, Menu, Moon, Sun, X } from 'lucide-react'
import { navLinks as defaultNavLinks, footerColumns as defaultFooterColumns } from './siteNav'
import { useTheme } from '../ThemeContext'
import './landing.css'

/* ═══════════════════════════════════════════════════════════════
   NavItem
   ═══════════════════════════════════════════════════════════════ */

function NavItem({ href, className, onClick, children }) {
  if (href.startsWith('/')) {
    return (
      <Link to={href} className={className} onClick={onClick}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Layout
   ═══════════════════════════════════════════════════════════════ */

export default function Layout({
  children,
  onLoginRequest,
  navLinks = defaultNavLinks,
  footerColumns = defaultFooterColumns,
  className = '',
}) {
  const { theme, toggleTheme } = useTheme()
  const { isLoggedIn } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
   const logoSrc = theme === 'dark' ? '/studio_logo_darkmode.webp' : '/studio_logo_lightmode.webp'
  const themeLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  const menuId = useMemo(() => 'landing-mobile-nav', [])

  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    closeMenu()
  }, [location.pathname])

  const scrollToTop = (event) => {
    event.preventDefault()
    if (typeof document !== 'undefined') {
      document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className={`landing-page ${className}`.trim()} data-theme={theme} data-surface='ink' data-palette='violet' data-text-preset='warm'>
      <nav className='landing-nav' aria-label='Marketing navigation'>
        <Link className='landing-brand' to='/'>
            <img src={logoSrc} alt='Agentic Content Studio' className='landing-brand__logo' />
          </Link>
        <button
          className='landing-nav__menu'
          type='button'
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label='Toggle navigation'
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className={`landing-nav__links ${menuOpen ? 'is-open' : ''}`} id={menuId}>
          {navLinks.map((item) => (
            <NavItem key={item.href} href={item.href} onClick={closeMenu}>
              {item.label}
            </NavItem>
          ))}
          <button
            className='landing-nav__theme'
            type='button'
            onClick={toggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {isLoggedIn
            ? <button className='landing-nav__signin' type='button' onClick={() => { closeMenu(); navigate('/dashboard') }}>Dashboard</button>
            : <button className='landing-nav__signin' type='button' onClick={() => { closeMenu(); onLoginRequest?.() }}>Sign in</button>
          }
        </div>
      </nav>

      <main id='top'>{children}</main>

      <footer className='landing-footer'>
        <div className='landing-footer__container'>
          <div className='landing-footer__brand-col'>
            <Link className='landing-brand' to='/'>
              <span className='landing-brand__mark' aria-hidden='true'>
                <Clapperboard size={18} aria-hidden='true' />
              </span>
              <span>Agentic Content Studio</span>
            </Link>
            <p className='landing-footer__tagline'>
              Empowering creation with intelligent agent workflows.
            </p>
          </div>

          <div className='landing-footer__grid'>
            {footerColumns.map((col) => (
              <div className='landing-footer__col' key={col.heading}>
                <span className='landing-footer__heading'>{col.heading}</span>
                <ul className='landing-footer__links'>
                  {col.links.map((item) => (
                    <li key={item.href}>
                      <NavItem href={item.href}>{item.label}</NavItem>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className='landing-footer__bottom'>
          <span>Agentic Content Studio &copy; 2026. All rights reserved.</span>
          <a href='#top' onClick={scrollToTop} className='landing-footer__back-to-top'>
            Back to top <ChevronUp size={14} aria-hidden='true' />
          </a>
        </div>
      </footer>
    </div>
  )
}