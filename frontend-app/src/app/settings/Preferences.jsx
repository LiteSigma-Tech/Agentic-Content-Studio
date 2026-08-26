import React, { useState } from "react";
import { Bell, Mail, Shield, Sparkles, Check, Laptop, Sliders } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Panel, PageHeader, PlaceholderNotice, Eyebrow, Btn, T, sans, mono } from "../shared/ui";

const DEFAULT_PREFS = {
  emailOnApprovalNeeded: true,
  emailOnRunFailed: true,
  emailOnEpisodePublished: false,
  desktopNotifications: true,
  weeklyDigest: false,
  soundAlerts: false,
  autoScrollLogs: true,
};

export default function Preferences() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [toast, setToast] = useState(null);

  function toggle(key, label) {
    const nextVal = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: nextVal }));
    setToast(`Updated: ${label} is now ${nextVal ? "enabled" : "disabled"}`);
    setTimeout(() => setToast(null), 2500);
  }

  const sections = [
    {
      title: "Email Notifications",
      icon: Mail,
      items: [
        { key: "emailOnApprovalNeeded", label: "Email when a stage needs human approval", desc: "Sent when pipeline pauses at a review or compliance gate" },
        { key: "emailOnRunFailed", label: "Email when an orchestration run fails", desc: "Includes failure stack trace and provider error details" },
        { key: "emailOnEpisodePublished", label: "Email when an episode finishes rendering", desc: "Contains export links and high-res video preview thumbnail" },
        { key: "weeklyDigest", label: "Weekly spend and compute summary", desc: "Aggregated report of token consumption and cost trends" },
      ],
    },
    {
      title: "Console & Session Preferences",
      icon: Sliders,
      items: [
        { key: "desktopNotifications", label: "Browser desktop push notifications", desc: "Receive instant browser banner alerts for active studio jobs" },
        { key: "soundAlerts", label: "Audio chime on run completion", desc: "Plays subtle cue when generation finishes" },
        { key: "autoScrollLogs", label: "Auto-scroll terminal logs during execution", desc: "Keeps the latest streaming log chunk in viewport view" },
      ],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: "grid", gap: 20, maxWidth: 840 }}
    >
      <PageHeader
        title="Preferences"
        description="Notification routing, alert thresholds, and console runtime behavior."
      />

      <PlaceholderNotice title="Client State Context">
        Not persisted across sessions. No preferences endpoint is confirmed in the API contract, so these toggles only live in the current React session state.
      </PlaceholderNotice>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: 99,
              background: T.panel,
              border: `1px solid ${T.teal}`,
              borderRadius: 8,
              padding: "10px 16px",
              boxShadow: T.shadow,
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: `500 12px/1 ${sans}`,
              color: T.paper,
            }}
          >
            <Check size={14} color={T.teal} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: "grid", gap: 16 }}>
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <Panel key={sec.title} style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Icon size={14} color={T.violet} />
                <Eyebrow color={T.violet}>{sec.title}</Eyebrow>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {sec.items.map((r) => {
                  const active = prefs[r.key];
                  return (
                    <div
                      key={r.key}
                      onClick={() => toggle(r.key, r.label)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        background: T.panel2,
                        border: `1px solid ${active ? `${T.amber}44` : T.line2}`,
                        borderRadius: 8,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ paddingRight: 16 }}>
                        <div style={{ font: `600 13px/1.3 ${sans}`, color: T.paper }}>
                          {r.label}
                        </div>
                        <div style={{ font: `400 11px/1.4 ${sans}`, color: T.muted, marginTop: 3 }}>
                          {r.desc}
                        </div>
                      </div>

                      {/* Custom Animated Toggle Switch */}
                      <div
                        style={{
                          width: 38,
                          height: 22,
                          borderRadius: 99,
                          background: active ? T.amber : T.line,
                          padding: 2,
                          display: "flex",
                          alignItems: "center",
                          transition: "background 0.2s ease",
                          flexShrink: 0,
                        }}
                      >
                        <motion.div
                          layout
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 99,
                            background: active ? T.ink : T.faint,
                            marginLeft: active ? 16 : 0,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          );
        })}
      </div>
    </motion.div>
  );
}
