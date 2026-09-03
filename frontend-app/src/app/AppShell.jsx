import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import {
  LayoutDashboard, Clapperboard, Target, Film, History, Bell,
  SlidersHorizontal, LifeBuoy, Menu, X, Cpu, Sun, Moon, Radio,
  LogIn, LogOut,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import { usageApi, agentsApiCalls, studioApiCalls, modelsApi } from "../api";
import { T, mono, sans, useBreakpoint } from "./shared/ui";
import { isOnboardingDismissed } from "./onboarding/OnboardingWizard";
import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";

const TOP_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { id: "studio", label: "Studio", icon: Clapperboard, path: "/studio" },
  { id: "leads", label: "Leads", icon: Target, path: "/leads" },
  { id: "models", label: "Models", icon: Cpu, path: "/models" },
  { id: "library", label: "Library", icon: Film, path: "/library" },
  { id: "activity-log", label: "Activity Log", icon: History, path: "/activity-log" },
  { id: "notifications", label: "Notifications", icon: Bell, path: "/notifications" },
  { id: "settings", label: "Settings", icon: SlidersHorizontal, path: "/settings" },
  { id: "help", label: "Help", icon: LifeBuoy, path: "/help" },
];

const SUB_NAV = {
  dashboard: [],
  studio: [],
  leads: [
    { label: "Overview", path: "/leads" }
  ],
  models: [
    { label: "Routing & Providers", path: "/models" },
  ],
  library: [
    { label: "All Episodes", path: "/library" },
    { label: "Drafts", path: "/library/drafts" },
    { label: "Published", path: "/library/published" },
  ],
  "activity-log": [
    { label: "Approvals", path: "/activity-log" },
    { label: "Compliance Events", path: "/activity-log/compliance" },
    { label: "System Events", path: "/activity-log/system" },
  ],
  notifications: [
    { label: "Notifications", path: "/notifications" },
  ],
  settings: [
    { label: "Team & Roles", path: "/settings" },
    { label: "Billing & Usage", path: "/settings/billing" },
    { label: "API Keys", path: "/settings/api-keys" },
    { label: "Profile", path: "/settings/profile" },
    { label: "Preferences", path: "/settings/preferences" },
    { label: "Admin", path: "/settings/admin" },
  ],
  help: [
    { label: "Help & Support", path: "/help" },
  ],
};

function activeSectionId(pathname) {
  const sorted = [...TOP_NAV].sort((a, b) => b.path.length - a.path.length);
  const match = sorted.find((n) => pathname === n.path || pathname.startsWith(n.path + "/"));
  return match?.id || "dashboard";
}

export default function AppShell({ onLoginRequest }) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const isTablet = breakpoint === "tablet";
  const isDesktop = breakpoint === "desktop";

  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeBtnRef = useRef(null);

  const { isLoggedIn, logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const logoSrc = theme === "dark" ? "/studio_logo_darkmode.webp" : "/studio_logo_lightmode.webp";
  const isAdmin = user?.role === "admin";
  const location = useLocation();
  const navigate = useNavigate();

  const { data: usageData } = useQuery({ queryKey: ["usage"], queryFn: usageApi.get, staleTime: 30000 });
  const { data: runsData } = useQuery({ queryKey: ["agent-runs"], queryFn: () => agentsApiCalls.listRuns({ limit: 50 }), staleTime: 10000, refetchInterval: 15000 });
  const { data: allProjectsData } = useQuery({ queryKey: ["all-projects"], queryFn: () => studioApiCalls.listProjects(1, 0), staleTime: 10000, refetchInterval: 15000 });
  const { data: routingConfig } = useQuery({ queryKey: ["routing-config"], queryFn: modelsApi.getConfig, staleTime: 30000 });

  // Phase 4 - zero-projects onboarding redirect gate. Fires only while
  // not yet dismissed; once markOnboardingDismissed() has been called
  // (Skip or Finish), this never auto-navigates again regardless of
  // project count -- re-entry after that point is manual only, via the
  // Help/Support link.
  useEffect(() => {
    if (!allProjectsData) return;
    const hasProjects = (allProjectsData.items?.length ?? 0) > 0;
    if (!hasProjects && !isOnboardingDismissed() && location.pathname !== "/welcome") {
      navigate("/welcome");
    }
  }, [allProjectsData, location.pathname, navigate]);

  // Close the drawer on route change.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Close the drawer if the viewport grows out of mobile.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (!(isMobile && drawerOpen)) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isMobile, drawerOpen]);

  // Escape closes the drawer; focus the close button on open.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    closeBtnRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const activeProject = allProjectsData?.items?.[0] || null;
  const isRunning = activeProject?.stages?.some((s) => s.status === "running") ?? false;
  const reviewPending = activeProject?.stages?.some((s) => s.status === "awaiting_review") ?? false;
  const pendingApprovals = runsData?.items ? runsData.items.filter((r) => r.status === "awaiting_approval").length : 0;
  const onAir = isRunning || pendingApprovals > 0 || reviewPending;
  const freeOnly = typeof routingConfig?.free_only === "boolean" ? routingConfig.free_only : true;

  const sectionId = activeSectionId(location.pathname);
  const activeSection = TOP_NAV.find((s) => s.id === sectionId) || TOP_NAV[0];
  const subItems = (SUB_NAV[sectionId] || []).filter(
    (s) => s.path !== "/settings/admin" || isAdmin
  );
  const activeSubPath = location.pathname;

  function goToSection(next) {
    setDrawerOpen(false);
    if (next.id === activeSection.id) return;
    navigate(next.path);
  }

  const themeLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <div style={{
      background: T.ink, color: T.paper, font: `400 14px/1.5 ${sans}`,
      height: "100vh", display: "flex", flexDirection: isMobile ? "column" : "row",
    }}>
      <style>{`
        .led-pulse{animation:led 1.4s ease-in-out infinite}
        @keyframes led{0%,100%{opacity:1}50%{opacity:.45}}
        @keyframes shell-fade-in{from{opacity:0}to{opacity:1}}
        @keyframes shell-slide-in{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        @media (prefers-reduced-motion: reduce){
          .led-pulse{animation:none}
          .shell-backdrop, .shell-drawer{animation:none !important}
        }
        select:focus,input:focus,button:focus-visible{outline:2px solid ${T.amber};outline-offset:1px}
      `}</style>

      {/* ── MOBILE: top app bar + off-canvas drawer ─────────────── */}
      {isMobile && (
        <>
          <header style={{
            height: 56, flexShrink: 0, display: "flex", alignItems: "center",
            justifyContent: "space-between", padding: "0 16px", background: T.panel,
            borderBottom: `1px solid ${T.line}`, position: "sticky", top: 0, zIndex: 20,
          }}>
            <Link to="/" aria-label="Go to homepage" style={{ display: "flex" }}>
              <img src={logoSrc} alt="Studio App" style={{ height: 22, width: "auto", display: "block" }} />
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Radio size={13} color={onAir ? T.amber : T.faint} className={onAir ? "led-pulse" : ""} aria-hidden="true" />
              <button
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
                aria-expanded={drawerOpen}
                aria-controls="shell-mobile-drawer"
                style={{ background: "transparent", border: "none", color: T.paper, cursor: "pointer", padding: 4, display: "flex" }}
              >
                <Menu size={22} />
              </button>
            </div>
          </header>

          {drawerOpen && (
            <>
              <div
                className="shell-backdrop"
                onClick={() => setDrawerOpen(false)}
                aria-hidden="true"
                style={{
                  position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
                  zIndex: 30, animation: "shell-fade-in .18s ease",
                }}
              />
              <nav
                id="shell-mobile-drawer"
                aria-label="Main navigation"
                className="shell-drawer"
                style={{
                  position: "fixed", top: 0, left: 0, bottom: 0, width: "82%", maxWidth: 300,
                  background: T.panel, borderRight: `1px solid ${T.line}`, zIndex: 31,
                  display: "flex", flexDirection: "column", padding: 16, overflowY: "auto",
                  animation: "shell-slide-in .2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <Link to="/" aria-label="Go to homepage" onClick={() => setDrawerOpen(false)} style={{ display: "flex" }}>
                    <img src={logoSrc} alt="Studio App" style={{ height: 22, width: "auto", display: "block" }} />
                  </Link>
                  <button
                    ref={closeBtnRef}
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close navigation"
                    style={{ background: "none", border: "none", color: T.paper, cursor: "pointer", padding: 4, display: "flex" }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {TOP_NAV.map((s) => (
                    <button key={s.id} onClick={() => goToSection(s)} style={{
                      display: "flex", alignItems: "center", gap: 11, padding: "12px 12px", borderRadius: T.radiusMd,
                      border: "none", cursor: "pointer", textAlign: "left",
                      background: s.id === activeSection.id ? T.raised : "transparent",
                      color: s.id === activeSection.id ? T.paper : T.muted,
                      font: `600 13px/1 ${sans}`, position: "relative",
                    }}>
                      {s.id === activeSection.id && <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 2, borderRadius: 9, background: T.violet }} />}
                      <s.icon size={16} /> {s.label}
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
                  <button
                    onClick={toggleTheme}
                    aria-label={themeLabel}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      background: "none", border: `1px solid ${T.line}`, color: T.muted,
                      padding: "10px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: mono,
                    }}
                  >
                    {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                    {theme === "dark" ? "LIGHT MODE" : "DARK MODE"}
                  </button>
                  {isLoggedIn
                    ? <button onClick={logout} style={{ background: "none", border: `1px solid ${T.line}`, color: T.faint, padding: "10px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: mono }}>LOGOUT</button>
                    : <button onClick={() => { setDrawerOpen(false); onLoginRequest?.(); }} style={{ background: T.violet, border: "none", color: T.ink, padding: "10px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: mono, fontWeight: 700 }}>SIGN IN</button>}
                </div>
              </nav>
            </>
          )}
        </>
      )}

      {/* ── TABLET: collapsed icon rail ──────────────────────────── */}
      {isTablet && (
        <nav aria-label="Main navigation" style={{
          width: 72, background: T.panel, borderRight: `1px solid ${T.line}`,
          padding: "16px 8px", display: "flex", flexDirection: "column",
          alignItems: "center", gap: 6, flexShrink: 0,
        }}>
          <Link to="/" aria-label="Go to homepage" style={{ display: "flex", marginBottom: 14 }}>
            <img src={logoSrc} alt="Studio App" style={{ height: 20, width: "auto" }} />
          </Link>
          {TOP_NAV.map((s) => (
            <button
              key={s.id}
              onClick={() => goToSection(s)}
              title={s.label}
              aria-label={s.label}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 44, height: 44, borderRadius: T.radiusMd, border: "none", cursor: "pointer",
                background: s.id === activeSection.id ? T.raised : "transparent",
                color: s.id === activeSection.id ? T.paper : T.muted, position: "relative",
              }}
            >
              {s.id === activeSection.id && <span style={{ position: "absolute", left: -8, top: 8, bottom: 8, width: 2, borderRadius: 9, background: T.violet }} />}
              <s.icon size={18} />
            </button>
          ))}
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <button
              onClick={toggleTheme}
              aria-label={themeLabel}
              title={themeLabel}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 40, height: 40, background: "none", border: `1px solid ${T.line}`,
                color: T.muted, borderRadius: 6, cursor: "pointer",
              }}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {isLoggedIn
              ? <button onClick={logout} aria-label="Logout" title="Logout" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, background: "none", border: `1px solid ${T.line}`, color: T.faint, borderRadius: 6, cursor: "pointer" }}><LogOut size={15} /></button>
              : <button onClick={onLoginRequest} aria-label="Sign in" title="Sign in" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, background: T.violet, border: "none", color: T.ink, borderRadius: 6, cursor: "pointer" }}><LogIn size={15} /></button>}
          </div>
        </nav>
      )}

      {/* ── DESKTOP: full labeled sidebar ────────────────────────── */}
      {isDesktop && (
        <nav aria-label="Main navigation" style={{ width: 180, background: T.panel, borderRight: `1px solid ${T.line}`, padding: 16, display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          <Link to="/" aria-label="Go to homepage" style={{ display: "flex", marginBottom: 16 }}>
            <img src={logoSrc} alt="Studio App" style={{ height: 22, width: "auto", display: "block" }} />
          </Link>
          {TOP_NAV.map((s) => (
            <button key={s.id} onClick={() => goToSection(s)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: T.radiusMd,
              border: "none", cursor: "pointer", textAlign: "left",
              background: s.id === activeSection.id ? T.raised : "transparent",
              color: s.id === activeSection.id ? T.paper : T.muted,
              font: `600 12px/1 ${sans}`, position: "relative",
            }}>
              {s.id === activeSection.id && <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 2, borderRadius: 9, background: T.violet }} />}
              <s.icon size={15} /> {s.label}
            </button>
          ))}
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={toggleTheme}
              aria-label={themeLabel}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                background: "none", border: `1px solid ${T.line}`, color: T.muted,
                padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                fontSize: 11, fontFamily: mono,
              }}
            >
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
              {theme === "dark" ? "LIGHT MODE" : "DARK MODE"}
            </button>
            {isLoggedIn
              ? <button onClick={logout} style={{ background: "none", border: `1px solid ${T.line}`, color: T.faint, padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: mono }}>LOGOUT</button>
              : <button onClick={onLoginRequest} style={{ background: T.violet, border: "none", color: T.ink, padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: mono, fontWeight: 700 }}>SIGN IN</button>}
          </div>
        </nav>
      )}

      {/* ── Content column ───────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: T.panel, flexShrink: 0, boxShadow: T.shadowGlow }}>
          <div style={{ font: `700 14px/1 ${sans}`, letterSpacing: "-0.01em" }}>{activeSection.label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 18 }}>
            {!isMobile && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Radio size={14} color={onAir ? T.amber : T.faint} className={onAir ? "led-pulse" : ""} />
                  <span style={{ font: `700 10px/1 ${mono}`, letterSpacing: ".12em", color: onAir ? T.amber : T.faint }}>
                    {onAir ? "ON AIR" : "IDLE"}
                  </span>
                </div>
                <div style={{ width: 1, height: 22, background: T.line2 }} />
              </>
            )}
            <div style={{ font: `600 11px/1 ${mono}`, color: T.muted }}>
              <span style={{ color: T.amber }}>${usageData?.total_cost_usd?.toFixed(2) ?? "0.00"}</span> {isMobile ? "" : freeOnly ? "free models" : "paid allowed"}
            </div>
          </div>
        </header>

        {subItems.length > 0 && (
          <div style={{
            display: "flex", gap: 6, padding: isMobile ? "10px 16px" : "14px 24px 0",
            borderBottom: `1px solid ${T.line}`, overflowX: "auto", WebkitOverflowScrolling: "touch",
          }}>
            {subItems.map((s) => (
              <button key={s.path} onClick={() => navigate(s.path)} style={{
                flexShrink: 0,
                padding: isMobile ? "8px 12px" : "8px 12px",
                borderRadius: isMobile ? T.radiusMd : `${T.radiusMd} ${T.radiusMd} 0 0`,
                cursor: "pointer", whiteSpace: "nowrap",
                border: isMobile ? `1px solid ${s.path === activeSubPath ? T.line2 : T.line}` : "none",
                borderBottom: isMobile ? undefined : `2px solid ${s.path === activeSubPath ? T.violet : "transparent"}`,
                background: isMobile ? (s.path === activeSubPath ? T.raised : "transparent") : "transparent",
                color: s.path === activeSubPath ? T.paper : T.muted, font: `600 12px/1 ${sans}`,
              }}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, padding: isMobile ? "16px" : "24px 28px 40px", overflow: "auto" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

AppShell.propTypes = {
  onLoginRequest: PropTypes.func.isRequired,
};