import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  LayoutDashboard, Clapperboard, Target, Film, History, Bell,
  SlidersHorizontal, LifeBuoy, Menu, X, Cpu, Sun, Moon, Radio,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import { usageApi, agentsApiCalls, studioApiCalls, modelsApi } from "../api";
import { T, mono, sans } from "./shared/ui";
import { isOnboardingDismissed } from "./onboarding/OnboardingWizard";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

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
  // After
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

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return m;
}

function activeSectionId(pathname) {
  const sorted = [...TOP_NAV].sort((a, b) => b.path.length - a.path.length);
  const match = sorted.find((n) => pathname === n.path || pathname.startsWith(n.path + "/"));
  return match?.id || "dashboard";
}

export default function AppShell({ onLoginRequest }) {
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);
  const { isLoggedIn, logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = user?.role === "admin";
  const location = useLocation();
  const navigate = useNavigate();

  // On-air / cost meter -- ambient status visible from every page.
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
    if (next.id === activeSection.id) return;
    setNavOpen(false);
    navigate(next.path);
  }

  return (
    <div key={theme} style={{
      background: T.ink, color: T.paper, font: `400 14px/1.5 ${sans}`,
      height: "100vh", display: "flex", flexDirection: isMobile ? "column" : "row",
    }}>
      <style>{`
        .led-pulse{animation:led 1.4s ease-in-out infinite}
        @keyframes led{0%,100%{opacity:1}50%{opacity:.45}}
        @media (prefers-reduced-motion: reduce){.led-pulse{animation:none}}
        select:focus,input:focus,button:focus-visible{outline:2px solid ${T.amber};outline-offset:1px}
      `}</style>

      {isMobile ? (
        <nav style={{ width: 180, background: T.panel, borderRight: `1px solid ${T.line}`, padding: 16, display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ font: `800 13px/1 ${mono}`, letterSpacing: "0.04em", color: T.paper }}>
              STUDIO<span style={{ color: T.amber }}>{'//'}</span>APP
            </div>
            <button onClick={() => setNavOpen((o) => !o)} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.paper, padding: 4 }}>
              {navOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
          {navOpen && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginTop: 10 }}>
              {TOP_NAV.map((s) => (
                <button key={s.id} onClick={() => goToSection(s)} style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "10px 11px", borderRadius: T.radiusMd,
                  border: `1px solid ${s.id === activeSection.id ? T.line2 : T.line}`, cursor: "pointer",
                  background: s.id === activeSection.id ? T.raised : "transparent",
                  color: s.id === activeSection.id ? T.paper : T.muted,
                  font: `600 12px/1 ${sans}`, minHeight: 38, justifyContent: "flex-start",
                }}>
                  <s.icon size={14} /> {s.label}
                </button>
              ))}
              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${T.line}`, paddingTop: 8, marginTop: 2 }}>
                <button
                  onClick={toggleTheme}
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: `1px solid ${T.line}`, color: T.muted, padding: "6px 8px", borderRadius: 4, cursor: "pointer" }}
                >
                  {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
                </button>
                {isLoggedIn
                  ? <button onClick={logout} style={{ background: "none", border: `1px solid ${T.line}`, color: T.faint, padding: "6px 10px", borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: mono }}>LOGOUT</button>
                  : <button onClick={onLoginRequest} style={{ background: T.violet, border: "none", color: T.ink, padding: "6px 10px", borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: mono, fontWeight: 700 }}>SIGN IN</button>}
              </div>
            </div>
          )}
          {subItems.length > 0 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 10, paddingBottom: 2 }}>
              {subItems.map((s) => (
                <button key={s.path} onClick={() => navigate(s.path)} style={{
                  flexShrink: 0, padding: "7px 10px", borderRadius: T.radiusMd, whiteSpace: "nowrap",
                  border: `1px solid ${s.path === activeSubPath ? T.line2 : T.line}`, cursor: "pointer",
                  background: s.path === activeSubPath ? T.raised : "transparent",
                  color: s.path === activeSubPath ? T.paper : T.muted, font: `600 11px/1 ${sans}`,
                }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </nav>
      ) : (
        <nav style={{ width: 180, background: T.panel, borderRight: `1px solid ${T.line}`, padding: 16, display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          <div style={{ font: `800 13px/1 ${mono}`, letterSpacing: "0.04em", color: T.paper, padding: "4px 8px 16px" }}>
            STUDIO<span style={{ color: T.amber }}>{'//'}</span>APP
          </div>
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
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
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

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: T.panel, flexShrink: 0, boxShadow: T.shadowGlow }}>
          <div style={{ font: `700 14px/1 ${sans}`, letterSpacing: "-0.01em" }}>{activeSection.label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Radio size={14} color={onAir ? T.amber : T.faint} className={onAir ? "led-pulse" : ""} />
              <span style={{ font: `700 10px/1 ${mono}`, letterSpacing: ".12em", color: onAir ? T.amber : T.faint }}>
                {onAir ? "ON AIR" : "IDLE"}
              </span>
            </div>
            <div style={{ width: 1, height: 22, background: T.line2 }} />
            <div style={{ font: `600 11px/1 ${mono}`, color: T.muted }}>
              <span style={{ color: T.amber }}>${usageData?.total_cost_usd?.toFixed(2) ?? "0.00"}</span> {freeOnly ? "free models" : "paid allowed"}
            </div>
          </div>
        </header>
        {!isMobile && subItems.length > 0 && (
          <div style={{ display: "flex", gap: 6, padding: "14px 24px 0", borderBottom: `1px solid ${T.line}`, flexWrap: "wrap" }}>
            {subItems.map((s) => (
              <button key={s.path} onClick={() => navigate(s.path)} style={{
                padding: "8px 12px", borderRadius: `${T.radiusMd} ${T.radiusMd} 0 0`, cursor: "pointer",
                border: "none", borderBottom: `2px solid ${s.path === activeSubPath ? T.violet : "transparent"}`,
                background: "transparent",
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
