import React from "react";
import { User, Shield, Building, Key, Fingerprint, Calendar, CheckCircle } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../../AuthContext";
import { Panel, Eyebrow, PageHeader, PlaceholderNotice, CopyBtn, Pill, T, sans, mono } from "../shared/ui";

export default function Profile() {
  const { user } = useAuth();

  const fields = [
    { label: "Full Name", value: user?.name, icon: User },
    { label: "Assigned RBAC Role", value: user?.role, icon: Shield, isRole: true },
    { label: "Active Tenant", value: user?.tenant, icon: Building },
    { label: "User Principal ID", value: user?.id, icon: Fingerprint, isCopyable: true },
    { label: "Account Status", value: "Verified Active", icon: CheckCircle, isStatus: true },
  ];

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "US";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: "grid", gap: 20, maxWidth: 680 }}
    >
      <PageHeader
        title="Profile & Identity"
        description="Your authenticated credentials, tenant membership, and role privileges."
      />

      <PlaceholderNotice title="Read-Only Auth Context">
        Read-only state. No update-profile endpoint is confirmed in the current API surface, so this reflects the verified identity returned by the token session handler.
      </PlaceholderNotice>

      {/* User Card */}
      <Panel style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 99,
              background: `linear-gradient(135deg, ${T.amber} 0%, ${T.violet} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: `700 18px/1 ${sans}`,
              color: T.ink,
              boxShadow: `0 0 20px ${T.amber}33`,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ font: `700 16px/1.2 ${sans}`, color: T.paper }}>
              {user?.name || "Anonymous User"}
            </div>
            <div style={{ font: `500 11px/1.4 ${mono}`, color: T.faint, marginTop: 4 }}>
              {user?.email || "admin@acme.studio"} · {user?.tenant || "Default Tenant"}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {fields.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  background: T.panel2,
                  border: `1px solid ${T.line2}`,
                  borderRadius: 7,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon size={14} color={T.muted} />
                  <span style={{ font: `600 11px/1 ${mono}`, color: T.muted }}>
                    {f.label}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {f.isRole ? (
                    <Pill status={user?.role === "admin" ? "warning" : "ok"} label={user?.role} />
                  ) : f.isStatus ? (
                    <span style={{ font: `600 11px/1 ${mono}`, color: T.teal }}>
                      ● Active
                    </span>
                  ) : (
                    <span style={{ font: `500 12px/1 ${mono}`, color: T.paper }}>
                      {f.value || "—"}
                    </span>
                  )}
                  {f.isCopyable && f.value && <CopyBtn text={f.value} />}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </motion.div>
  );
}
