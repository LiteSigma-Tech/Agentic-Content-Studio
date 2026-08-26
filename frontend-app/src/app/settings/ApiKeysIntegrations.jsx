import React from "react";
import { Key, Webhook, ArrowRight, ShieldCheck, Cpu, HardDrive, MessageSquare, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Panel, Eyebrow, PageHeader, PlaceholderNotice, Btn, Pill, T, sans, mono } from "../shared/ui";

const INTEGRATION_PREVIEWS = [
  {
    id: "tenant-keys",
    title: "Tenant Admin Keys",
    description: "Minted once during tenant creation. Used for server-to-server API invocation.",
    icon: Key,
    status: "ok",
    statusLabel: "Admin Managed",
    location: "Admin Settings (/settings/admin)",
    path: "/settings/admin",
  },
  {
    id: "webhooks",
    title: "Event Egress Webhooks",
    description: "Receive signed JSON payloads when runs finish, fail, or need human review.",
    icon: Webhook,
    status: "ok",
    statusLabel: "Configurable",
    location: "Admin Settings (/settings/admin)",
    path: "/settings/admin",
  },
  {
    id: "model-providers",
    title: "LLM & Voice Providers",
    description: "Configure Google Gemini, Anthropic Claude, OpenAI, and ElevenLabs routing.",
    icon: Cpu,
    status: "info",
    statusLabel: "Routing Hub",
    location: "Models Page (/models)",
    path: "/models",
  },
  {
    id: "slack-discord",
    title: "Slack & Discord Bots",
    description: "Stream pipeline execution logs and review buttons directly into team channels.",
    icon: MessageSquare,
    status: "pending",
    statusLabel: "Future Gateway",
    location: "Awaiting Gateway V2 contract",
  },
  {
    id: "storage-buckets",
    title: "S3 / GCS Cloud Storage",
    description: "Automatic video export sync to custom private S3 or Google Cloud Storage buckets.",
    icon: HardDrive,
    status: "pending",
    statusLabel: "Future Gateway",
    location: "Awaiting Gateway V2 contract",
  },
];

export default function ApiKeysIntegrations() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: "grid", gap: 20, maxWidth: 960 }}
    >
      <PageHeader
        title="API Keys & Integrations"
        description="Overview of access tokens, model integrations, and outbound event dispatchers."
      />

      <PlaceholderNotice title="Architecture Context">
        No generic per-user key management endpoint is confirmed in the current API surface. Tenant API keys are minted strictly once at creation and live under <strong style={{ color: T.paper }}>Admin (/settings/admin)</strong>, while model credentials are managed through the Gateway config.
      </PlaceholderNotice>

      {/* Primary where-it-lives callout */}
      <Panel style={{ padding: 20, background: `${T.amber}0A`, border: `1px solid ${T.amber}44` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <Eyebrow color={T.amber}>
              <ShieldCheck size={13} /> Tenant Key & Webhook Hub
            </Eyebrow>
            <div style={{ font: `700 15px/1.3 ${sans}`, color: T.paper, marginTop: 4 }}>
              Looking for your Tenant API Keys or Webhooks?
            </div>
            <div style={{ font: `400 12px/1.55 ${sans}`, color: T.muted, marginTop: 4, maxWidth: 600 }}>
              Tenant keys and webhook listeners are orchestrated in the Admin module to ensure strict segregation of cryptographic credentials across organizations.
            </div>
          </div>
          <Btn kind="primary" icon={ArrowRight} onClick={() => navigate("/settings/admin")}>
            Open Admin Hub
          </Btn>
        </div>
      </Panel>

      {/* Integration Registry Grid */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Eyebrow color={T.faint}>Integration Surface Directory</Eyebrow>
          <span style={{ font: `500 11px/1 ${mono}`, color: T.faint }}>
            5 surfaces documented
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {INTEGRATION_PREVIEWS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Panel
                  style={{
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    height: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div
                        style={{
                          padding: 8,
                          borderRadius: 7,
                          background: T.panel2,
                          border: `1px solid ${T.line2}`,
                          color: T.amber,
                          display: "inline-flex",
                        }}
                      >
                        <Icon size={16} />
                      </div>
                      <Pill status={item.status} label={item.statusLabel} />
                    </div>

                    <div style={{ font: `700 14px/1.3 ${sans}`, color: T.paper, marginTop: 12 }}>
                      {item.title}
                    </div>
                    <div style={{ font: `400 12px/1.5 ${sans}`, color: T.muted, marginTop: 6 }}>
                      {item.description}
                    </div>
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line2}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ font: `500 10px/1 ${mono}`, color: T.faint }}>
                      {item.location}
                    </span>
                    {item.path && (
                      <button
                        onClick={() => navigate(item.path)}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: T.amber,
                          font: `600 11px/1 ${mono}`,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: 0,
                        }}
                      >
                        Visit <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                </Panel>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
