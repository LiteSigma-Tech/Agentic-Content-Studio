import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Clapperboard,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  ArrowUpRight,
  ShieldCheck,
  History,
  Info,
  HelpCircle,
  Brain,
  Mail,
  Globe,
  Activity,
  Sparkles,
} from "lucide-react";
import { useTheme } from "../ThemeContext";

/* The logo files the app shell already uses. If either is missing the
   Clapperboard mark takes over, so the header never shows a broken
   image on a fresh deploy. */
export function BrandMark() {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  const src = theme === "dark" ? "/studio_logo_darkmode.webp" : "/studio_logo_lightmode.webp";

  if (failed) {
    return (
      <>
        <Clapperboard size={20} strokeWidth={2} />
        <span>Xeliai Studio</span>
      </>
    );
  }
  return <img src={src} alt="Xeliai Studio" onError={() => setFailed(true)} />;
}

function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      className="lp-switch"
      data-on={isLight ? "true" : "false"}
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      onClick={toggleTheme}
    >
      <span className="lp-switch__rail" aria-hidden="true">
        <Moon size={12} strokeWidth={2.2} />
        <Sun size={12} strokeWidth={2.2} />
      </span>
      <span className="lp-switch__knob" aria-hidden="true">
        {isLight ? <Sun size={12} strokeWidth={2.4} /> : <Moon size={12} strokeWidth={2.4} />}
      </span>
    </button>
  );
}

const COMPANY_DROPDOWN = {
  label: "Company",
  items: [
    {
      to: "/about",
      label: "About Xeliai",
      desc: "Our founding thesis, architecture & 11-stage verification",
      icon: Info,
    },
    {
      to: "/trust",
      label: "Trust & Governance",
      desc: "Zero model training, data tenancy & KMS key encryption",
      icon: ShieldCheck,
    },
    {
      to: "/changelog",
      label: "Changelog",
      desc: "Release history, spend caps & model routing updates",
      icon: History,
    },
    {
      to: "/contact",
      label: "Contact Team",
      desc: "Direct architecture, security & technical support desks",
      icon: Mail,
    },
  ],
companyLinks: [
    {
      href: "https://xeliai.com",
      label: "Xeliai",
      desc: "Parent ecosystem & enterprise autonomous intelligence",
      icon: Globe,
      external: true,
    },
    {
      href: "https://trivia.xeliai.com/",
      label: "XeliAI Trivia",
      desc: "AI study & exam prep: adaptive revision, smart quizzes & gamified practice",
      icon: Brain,
      external: true,
      badge: "Adaptive AI",
    },
  ],
};

const RESOURCES_DROPDOWN = {
  label: "Resources",
  items: [
    {
      to: "/faq",
      label: "FAQ",
      desc: "Pipeline mechanics, BYOK security & deterministic recovery",
      icon: HelpCircle,
    },
    {
      to: "/how-it-works",
      label: "Pipeline Architecture",
      desc: "Interactive two-lane audio/video execution topology",
      icon: Sparkles,
    },
    {
      to: "/privacy",
      label: "Privacy Policy",
      desc: "Strict content non-retention & data residency standards",
      icon: ShieldCheck,
    },
    {
      to: "/terms",
      label: "Terms of Service",
      desc: "Complete output ownership & spend cap safety rules",
      icon: Info,
    },
  ],
};

export default function SiteNav({ onLoginRequest, immersive = false }) {
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const { pathname } = useLocation();
  const burgerRef = useRef(null);
  const navRef = useRef(null);

  /* Scroll detection */
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        setStuck(window.scrollY > 8);
        frame = 0;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  /* Close menus on route change */
  useEffect(() => {
    setOpen(false);
    setActiveDropdown(null);
  }, [pathname]);

  /* Click outside to close dropdowns */
  useEffect(() => {
    const onDocClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  /* Lock the page behind the mobile drawer, close on Escape */
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      burgerRef.current?.focus();
    };
  }, [open]);

  const toggleDropdown = (name) => {
    setActiveDropdown((current) => (current === name ? null : name));
  };

  return (
    <>
      <header
        className="lp-nav"
        data-stuck={stuck ? "true" : "false"}
        data-immersive={immersive ? "true" : "false"}
        ref={navRef}
      >
        <div className="lp-wrap lp-nav__inner">
          <Link to="/" className="lp-nav__brand" aria-label="Xeliai Studio home">
            <BrandMark />
          </Link>

          <nav className="lp-nav__links" aria-label="Main">
            <Link
              to="/how-it-works"
              className="lp-nav__link"
              aria-current={pathname === "/how-it-works" ? "page" : undefined}
            >
              How it works
            </Link>

            <Link
              to="/showcase"
              className="lp-nav__link"
              aria-current={pathname === "/showcase" ? "page" : undefined}
            >
              Showcase
            </Link>

            <Link
              to="/pricing"
              className="lp-nav__link"
              aria-current={pathname === "/pricing" ? "page" : undefined}
            >
              Pricing
            </Link>

            {/* Company Dropdown */}
            <div className="lp-nav__dropdown">
              <button
                type="button"
                className="lp-nav__link lp-nav__dropdown-toggle"
                aria-expanded={activeDropdown === "company"}
                aria-haspopup="true"
                onClick={() => toggleDropdown("company")}
                data-active={
                  ["/about", "/trust", "/changelog"].includes(pathname)
                    ? "true"
                    : "false"
                }
              >
                <span>Company</span>
                <ChevronDown
                  size={14}
                  className={`lp-nav__chevron ${
                    activeDropdown === "company" ? "is-open" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              {activeDropdown === "company" && (
                <div
                  className="lp-nav__dropdown-menu"
                  role="menu"
                  aria-label="Company links"
                >
                  <div className="lp-nav__dropdown-group">
                    <span className="lp-nav__dropdown-header">Overview</span>
                    {COMPANY_DROPDOWN.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className="lp-nav__dropdown-item"
                          role="menuitem"
                          onClick={() => setActiveDropdown(null)}
                        >
                          <span className="lp-nav__dropdown-icon">
                            <Icon size={16} aria-hidden="true" />
                          </span>
                          <div className="lp-nav__dropdown-text">
                            <span className="lp-nav__dropdown-title">
                              {item.label}
                            </span>
                            <span className="lp-nav__dropdown-desc">
                              {item.desc}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="lp-nav__dropdown-divider" />

                  <div className="lp-nav__dropdown-group">
                    <span className="lp-nav__dropdown-header">
                      Xeliai Ecosystem
                    </span>
                    {COMPANY_DROPDOWN.companyLinks.map((item) => {
                      const Icon = item.icon;
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="lp-nav__dropdown-item"
                          role="menuitem"
                        >
                          <span className="lp-nav__dropdown-icon">
                            <Icon size={16} aria-hidden="true" />
                          </span>
                          <div className="lp-nav__dropdown-text">
                            <span className="lp-nav__dropdown-title">
                              {item.label}
                              <ArrowUpRight
                                size={12}
                                style={{ marginLeft: 4, opacity: 0.7 }}
                                aria-hidden="true"
                              />
                            </span>
                            <span className="lp-nav__dropdown-desc">
                              {item.desc}
                            </span>
                          </div>
                          {item.badge && (
                            <span className="lp-nav__dropdown-badge">
                              <span className="lp-nav__dropdown-dot" />
                              {item.badge}
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Resources Dropdown */}
            <div className="lp-nav__dropdown">
              <button
                type="button"
                className="lp-nav__link lp-nav__dropdown-toggle"
                aria-expanded={activeDropdown === "resources"}
                aria-haspopup="true"
                onClick={() => toggleDropdown("resources")}
                data-active={
                  ["/faq", "/privacy", "/terms"].includes(pathname)
                    ? "true"
                    : "false"
                }
              >
                <span>Resources</span>
                <ChevronDown
                  size={14}
                  className={`lp-nav__chevron ${
                    activeDropdown === "resources" ? "is-open" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              {activeDropdown === "resources" && (
                <div
                  className="lp-nav__dropdown-menu"
                  role="menu"
                  aria-label="Resources links"
                >
                  <div className="lp-nav__dropdown-group">
                    <span className="lp-nav__dropdown-header">Documentation &amp; FAQ</span>
                    {RESOURCES_DROPDOWN.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className="lp-nav__dropdown-item"
                          role="menuitem"
                          onClick={() => setActiveDropdown(null)}
                        >
                          <span className="lp-nav__dropdown-icon">
                            <Icon size={16} aria-hidden="true" />
                          </span>
                          <div className="lp-nav__dropdown-text">
                            <span className="lp-nav__dropdown-title">
                              {item.label}
                            </span>
                            <span className="lp-nav__dropdown-desc">
                              {item.desc}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Direct Contact Link in Navbar */}
            <Link
              to="/contact"
              className="lp-nav__link"
              aria-current={pathname === "/contact" ? "page" : undefined}
            >
              Contact
            </Link>
          </nav>

          <div className="lp-nav__right">
            <ThemeSwitch />
            <button
              type="button"
              className="lp-btn lp-btn--primary lp-btn--sm lp-nav__cta"
              onClick={onLoginRequest}
            >
              Start building
            </button>
            <button
              type="button"
              ref={burgerRef}
              className="lp-nav__burger"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {open && (
        <div className="lp-drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="lp-wrap lp-drawer__top">
            <Link to="/" className="lp-nav__brand" aria-label="Xeliai Studio home" onClick={() => setOpen(false)}>
              <BrandMark />
            </Link>
            <button
              type="button"
              className="lp-nav__burger"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="lp-wrap lp-drawer__links">
            <div className="lp-drawer__section">
              <span className="lp-drawer__heading">Platform</span>
              <Link to="/how-it-works" className="lp-drawer__link" onClick={() => setOpen(false)}>
                How it works
              </Link>
              <Link to="/showcase" className="lp-drawer__link" onClick={() => setOpen(false)}>
                Showcase
              </Link>
              <Link to="/pricing" className="lp-drawer__link" onClick={() => setOpen(false)}>
                Pricing
              </Link>
            </div>

            <div className="lp-drawer__section">
              <span className="lp-drawer__heading">Company</span>
              <Link to="/about" className="lp-drawer__link" onClick={() => setOpen(false)}>
                About Xeliai
              </Link>
              <Link to="/trust" className="lp-drawer__link" onClick={() => setOpen(false)}>
                Trust &amp; Governance
              </Link>
              <Link to="/changelog" className="lp-drawer__link" onClick={() => setOpen(false)}>
                Changelog
              </Link>
              <Link to="/contact" className="lp-drawer__link" onClick={() => setOpen(false)}>
                Contact Team
              </Link>
            </div>

            <div className="lp-drawer__section">
              <span className="lp-drawer__heading">Resources &amp; Ecosystem</span>
              <Link to="/faq" className="lp-drawer__link" onClick={() => setOpen(false)}>
                FAQ
              </Link>
              <a
                href="https://xeliai.com"
                target="_blank"
                rel="noopener noreferrer"
                className="lp-drawer__link lp-drawer__link--external"
              >
                Xeliai Cloud <ArrowUpRight size={14} aria-hidden="true" />
              </a>
              <a
                href="https://status.xeliai.com"
                target="_blank"
                rel="noopener noreferrer"
                className="lp-drawer__link lp-drawer__link--external"
              >
                System Status <Activity size={14} style={{ color: "var(--st-done)" }} aria-hidden="true" />
              </a>
            </div>

            <div className="lp-drawer__foot">
              <button
                type="button"
                className="lp-btn lp-btn--primary lp-btn--block"
                onClick={() => {
                  setOpen(false);
                  onLoginRequest?.();
                }}
              >
                Start building
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}