import React, { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Clapperboard } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import ErrorBoundary from "./ErrorBoundary";
import AppShell from "./app/AppShell";

import Login from "./Login";
import PlatformConsole from "./PlatformConsole";
import LandingPage from "./landing/LandingPage";

import About from './pages/About'
import Changelog from './pages/Changelog'
import Contact from './pages/Contact'
import Faq from './pages/Faq'
import HowItWorks from './pages/HowItWorks'
import Pricing from './pages/Pricing'
import Privacy from './pages/Privacy'
import Showcase from './pages/Showcase'
import Terms from './pages/Terms'
import Trust from './pages/Trust'
import OutOfTokens from "./app/OutOfTokens";
import OnboardingWizard, { isOnboardingDismissed } from "./app/onboarding/OnboardingWizard";

// Dashboard
import Overview from "./app/dashboard/Overview";

// Studio
import StudioCommandCenter from "./app/studio/StudioCommandCenter";

// Models
import ModelsPage from "./app/models";

// Leads
import LeadsDashboard from "./app/leads/LeadsDashboard";

// Library
import AllEpisodes from "./app/library/AllEpisodes";
import Drafts from "./app/library/Drafts";
import Published from "./app/library/Published";

// Activity Log
import ActivityApprovals from "./app/activity-log/Approvals";
import ComplianceEvents from "./app/activity-log/ComplianceEvents";
import SystemEvents from "./app/activity-log/SystemEvents";

// Notifications
import Notifications from "./app/notifications/Notifications";

// Settings
import TeamRoles from "./app/settings/TeamRoles";
import BillingUsage from "./app/settings/BillingUsage";
import ApiKeysIntegrations from "./app/settings/ApiKeysIntegrations";
import Profile from "./app/settings/Profile";
import Preferences from "./app/settings/Preferences";
import Admin from "./app/settings/Admin";

// Help
import HelpSupport from "./app/help/HelpSupport";

function RequireAuth({ children }) {
  const { isLoggedIn, loading } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();

  if (loading) {
    const logoSrc = theme === 'dark' ? '/studio_logo_darkmode.webp' : '/studio_logo_lightmode.webp';
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: theme === "dark" ? "#06070a" : "#f8f9fa",
        }}
      >
        <img
          src={logoSrc}
          alt="Studio"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const fallback = e.currentTarget.nextElementSibling;
            if (fallback) fallback.style.display = "flex";
          }}
          style={{ height: 32, width: "auto", display: "block" }}
        />
        <div style={{ display: "none", alignItems: "center", gap: 8 }}>
          <Clapperboard size={24} color="#8b5cf6" />
          <span
            style={{
              fontWeight: 800,
              fontSize: 18,
              color: theme === "dark" ? "#f5f0e8" : "#1a1c23",
              letterSpacing: "-0.02em",
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            STUDIO
          </span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function RedirectIfLoggedIn({ children }) {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return null;
  if (isLoggedIn) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  if (!isAdmin) return <Navigate to="/settings" replace />;
  return <>{children}</>;
}

function ScrollToHash() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    try {
      const id = hash.replace(/^#/, "");
      const el = document.getElementById(id) || (hash.length > 1 ? document.querySelector(hash) : null);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } catch {
      // Ignore invalid selector
    }
  }, [hash]);
  return null;
}

export default function App() {
  const navigate = useNavigate();
  const openLogin = () => navigate("/login");

  return (
    <ErrorBoundary>
      <ScrollToHash />
      <Routes>
        <Route
          path="/login"
          element={<RedirectIfLoggedIn><Login onSuccess={(user) => navigate(isOnboardingDismissed(user?.id) ? "/dashboard" : "/welcome")} /></RedirectIfLoggedIn>}
        />
        <Route path="/" element={<LandingPage onLoginRequest={openLogin} />} />
        <Route
          path="/welcome"
          element={
            <RequireAuth>
              <OnboardingWizard />
            </RequireAuth>
          }
        />
        <Route
          path="/console"
          element={
            <RequireAuth>
              <PlatformConsole onLoginRequest={openLogin} />
            </RequireAuth>
          }
        />

        {/* Marketing pages */}
        <Route path="/pricing" element={<Pricing onLoginRequest={openLogin} />} />
        <Route path="/privacy" element={<Privacy onLoginRequest={openLogin} />} />
        <Route path="/terms" element={<Terms onLoginRequest={openLogin} />} />
        <Route path="/trust" element={<Trust onLoginRequest={openLogin} />} />
        <Route path="/showcase" element={<Showcase onLoginRequest={openLogin} />} />
        <Route path="/how-it-works" element={<HowItWorks onLoginRequest={openLogin} />} />
        <Route path="/contact" element={<Contact onLoginRequest={openLogin} />} />
        <Route path="/faq" element={<Faq onLoginRequest={openLogin} />} />
        <Route path="/changelog" element={<Changelog onLoginRequest={openLogin} />} />
        <Route path="/about" element={<About onLoginRequest={openLogin} />} />

        {/* App shell layout with nested routes — auth required */}
        <Route
          element={
            <RequireAuth>
              <AppShell onLoginRequest={openLogin} />
            </RequireAuth>
          }
        >
          {/* Dashboard */}
          <Route path="/dashboard" element={<Overview onNavigate={navigate} />} />

          {/* Studio */}
          <Route path="/studio" element={<StudioCommandCenter />} />

          {/* Models */}
          <Route path="/models" element={<ModelsPage />} />

          {/* Leads */}
          <Route path="/leads" element={<LeadsDashboard />} />

          {/* Library */}
          <Route path="/library" element={<AllEpisodes />} />
          <Route path="/library/drafts" element={<Drafts />} />
          <Route path="/library/published" element={<Published />} />

          {/* Activity Log */}
          <Route path="/activity-log" element={<ActivityApprovals />} />
          <Route path="/activity-log/compliance" element={<ComplianceEvents />} />
          <Route path="/activity-log/system" element={<SystemEvents />} />

          {/* Notifications */}
          <Route path="/notifications" element={<Notifications />} />

          {/* Settings */}
          <Route path="/settings" element={<TeamRoles />} />
          <Route path="/settings/billing" element={<BillingUsage />} />
          <Route path="/settings/api-keys" element={<ApiKeysIntegrations />} />
          <Route path="/settings/profile" element={<Profile />} />
          <Route path="/settings/preferences" element={<Preferences />} />
          <Route
            path="/settings/admin"
            element={
              <RequireAdmin>
                <Admin />
              </RequireAdmin>
            }
          />

          {/* Help */}
          <Route path="/help" element={<HelpSupport onNavigate={navigate} />} />
        </Route>

        <Route path="/out-of-tokens" element={<OutOfTokens onNavigate={navigate} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
