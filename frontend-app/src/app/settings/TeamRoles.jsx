import React, { useState } from "react";
import { Shield, Check, X as XIcon, UserCheck, Sparkles, Layers, Info } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../../AuthContext";
import { Panel, Pill, Eyebrow, PageHeader, PlaceholderNotice, Btn, T, sans, mono } from "../shared/ui";

const ROLE_LADDER = [
  {
    role: "viewer",
    label: "Viewer",
    description: "Can view dashboards, pipeline runs, and library media. Cannot trigger runs or create content.",
    capabilities: [
      { name: "View Dashboards & Analytics", allowed: true },
      { name: "Inspect Episode Library & Outputs", allowed: true },
      { name: "Propose Lead Outreach", allowed: false },
      { name: "Execute Generation Pipelines", allowed: false },
      { name: "Approve / Reject Review Gates", allowed: false },
      { name: "Manage Webhooks & Tenants", allowed: false },
    ],
  },
  {
    role: "creator",
    label: "Creator",
    description: "Can create and run Studio episodes, generate scripts and audio, and propose outbound lead queues.",
    capabilities: [
      { name: "View Dashboards & Analytics", allowed: true },
      { name: "Inspect Episode Library & Outputs", allowed: true },
      { name: "Propose Lead Outreach", allowed: true },
      { name: "Execute Generation Pipelines", allowed: true },
      { name: "Approve / Reject Review Gates", allowed: false },
      { name: "Manage Webhooks & Tenants", allowed: false },
    ],
  },
  {
    role: "operator",
    label: "Operator",
    description: "Creator privileges plus human-in-the-loop (HITL) approval / rejection authority on gated pipeline stages.",
    capabilities: [
      { name: "View Dashboards & Analytics", allowed: true },
      { name: "Inspect Episode Library & Outputs", allowed: true },
      { name: "Propose Lead Outreach", allowed: true },
      { name: "Execute Generation Pipelines", allowed: true },
      { name: "Approve / Reject Review Gates", allowed: true },
      { name: "Manage Webhooks & Tenants", allowed: false },
    ],
  },
  {
    role: "admin",
    label: "Admin",
    description: "Full system authority — tenant management, API key rotation, webhook egress, and future member permissions.",
    capabilities: [
      { name: "View Dashboards & Analytics", allowed: true },
      { name: "Inspect Episode Library & Outputs", allowed: true },
      { name: "Propose Lead Outreach", allowed: true },
      { name: "Execute Generation Pipelines", allowed: true },
      { name: "Approve / Reject Review Gates", allowed: true },
      { name: "Manage Webhooks & Tenants", allowed: true },
    ],
  },
];

export default function TeamRoles() {
  const { user, switchRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState(user?.role || "admin");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: "grid", gap: 20, maxWidth: 960 }}
    >
      <PageHeader
        title="Team & RBAC Role Ladder"
        description="Hierarchy of account authorization tiers, permissions matrix, and role enforcement."
      />

      <PlaceholderNotice title="RBAC Architecture Limitation">
        RBAC in the current API is structured as a strict single-level hierarchical ladder: <strong style={{ color: T.paper }}>viewer &lt; creator &lt; operator &lt; admin</strong>. There is no multi-person team directory endpoint yet in the backend, so this view displays the verified ladder and your active role.
      </PlaceholderNotice>

      {/* Your Account Card with Prototype Role Switcher */}
      <Panel style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <Eyebrow color={T.amber}>
              <UserCheck size={13} /> Active Authenticated Account
            </Eyebrow>
            <div style={{ font: `700 16px/1.3 ${sans}`, color: T.paper, marginTop: 4 }}>
              {user?.name || "Alex Vance"}
            </div>
            <div style={{ font: `500 11px/1 ${mono}`, color: T.faint, marginTop: 4 }}>
              Tenant: {user?.tenant || "Acme Studio"} · User ID: {user?.id}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>Role:</span>
            <Pill
              status={user?.role === "admin" ? "warning" : "ok"}
              label={user?.role?.toUpperCase() || "ADMIN"}
            />
          </div>
        </div>

        {/* Interactive Role Switcher for Testing */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.line2}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ font: `600 10px/1 ${mono}`, color: T.faint, textTransform: "uppercase" }}>
            Test Role Switching (Prototype):
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {["viewer", "creator", "operator", "admin"].map((r) => (
              <button
                key={r}
                onClick={() => {
                  switchRole(r);
                  setSelectedRole(r);
                }}
                style={{
                  background: user?.role === r ? T.raised : "transparent",
                  border: `1px solid ${user?.role === r ? T.amber : T.line}`,
                  color: user?.role === r ? T.amber : T.muted,
                  padding: "4px 10px",
                  borderRadius: 5,
                  fontSize: 11,
                  fontFamily: mono,
                  fontWeight: 600,
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {/* Role Ladder Grid */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Eyebrow color={T.faint}>Tier Hierarchy & Capabilities</Eyebrow>
          <span style={{ font: `500 11px/1 ${mono}`, color: T.faint }}>
            Ladder level increases left to right
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {ROLE_LADDER.map((item, idx) => {
            const isUserRole = item.role === user?.role;
            return (
              <Panel
                key={item.role}
                style={{
                  padding: 16,
                  border: `1px solid ${isUserRole ? T.amber : T.line}`,
                  background: isUserRole ? `${T.amber}08` : T.panel,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ font: `700 14px/1.2 ${sans}`, color: T.paper }}>
                      {item.label}
                    </div>
                    {isUserRole ? (
                      <Pill status="ok" label="Your Role" />
                    ) : (
                      <span style={{ font: `600 10px/1 ${mono}`, color: T.faint }}>
                        Level {idx + 1}
                      </span>
                    )}
                  </div>

                  <div style={{ font: `400 11px/1.45 ${sans}`, color: T.muted, marginTop: 8 }}>
                    {item.description}
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                    {item.capabilities.map((cap) => (
                      <div
                        key={cap.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          font: `500 10px/1.3 ${sans}`,
                          color: cap.allowed ? T.paper : T.faint,
                        }}
                      >
                        {cap.allowed ? (
                          <Check size={11} color={T.teal} style={{ flexShrink: 0 }} />
                        ) : (
                          <XIcon size={11} color={T.clay} style={{ flexShrink: 0 }} />
                        )}
                        <span>{cap.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
