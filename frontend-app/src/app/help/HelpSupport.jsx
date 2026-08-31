import React, { useState } from "react";
import { ExternalLink, BookOpen, MessageSquare, LifeBuoy, FileText, Sparkles, CheckCircle2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Panel, Btn, PageHeader, Eyebrow, Pill, T, sans, mono } from "../shared/ui";

const DOCS_LINKS = [
  {
    label: "Platform Changelog",
    description: "Inspect recently shipped features, stage runners, and gateway updates.",
    href: "/changelog",
    icon: FileText,
  },
  {
    label: "Frequently Asked Questions",
    description: "Common architecture questions, model limits, and RBAC hierarchy.",
    href: "/faq",
    icon: BookOpen,
  },
  {
    label: "Direct Team Contact",
    description: "Reach platform engineers for SLA requests or custom model integrations.",
    href: "/contact",
    icon: MessageSquare,
  },
  {
    label: "System Trust & Security",
    description: "Compliance posture, tenant cryptographic isolation, and zero data-retention policies.",
    href: "/trust",
    icon: LifeBuoy,
  },
];

const FAQS = [
  {
    q: "How do tenant API keys differ from provider keys?",
    a: "Tenant API keys authenticate external server-to-server requests to the Studio Platform Console. Provider keys (Gemini, Claude, OpenAI) are managed centrally in Gateway routing config to eliminate key sprawl across developers.",
  },
  {
    q: "Why is role editing read-only in Team & Roles?",
    a: "In the current backend architecture, identity resolution returns a verified single role string. Multi-user directory administration and arbitrary permission bundles will unlock in the Gateway V2 release.",
  },
  {
    q: "How do I ensure my runs use free-only model routing?",
    a: "Open the Models page and toggle 'Free-Only Routing' to true. All synthesis jobs will route exclusively to Google Gemini 2.5 Flash without drawing from your monthly spend cap.",
  },
];

export default function HelpSupport({ onNavigate }) {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (idx) => {
    setOpenFaq((prev) => (prev === idx ? null : idx));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: "grid", gap: 20, maxWidth: 900 }}
    >
      <PageHeader
        title="Help, Documentation & Support"
        description="Access guides, developer resources, system health status, and direct communication channels."
      />

      {/* System Status Banner */}
      <Panel style={{ padding: 18, background: `${T.teal}0D`, border: `1px solid ${T.teal}44` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={18} color={T.teal} />
            <div>
              <div style={{ font: `700 13px/1.3 ${sans}`, color: T.paper }}>
                All Systems Operational
              </div>
              <div style={{ font: `400 11px/1.4 ${sans}`, color: T.muted, marginTop: 2 }}>
                Gateway (8001), Studio (8002), Leads (8003), Agents (8004), Platform (8005)
              </div>
            </div>
          </div>
          <Pill status="ok" label="Cluster Healthy" />
        </div>
      </Panel>

      {/* Resource Cards */}
      <div>
        <Eyebrow color={T.faint}>Documentation & Quick Navigation</Eyebrow>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
            marginTop: 10,
          }}
        >
          {DOCS_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Panel
                key={link.href}
                style={{
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: T.panel2,
                      border: `1px solid ${T.line2}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: T.amber,
                      marginBottom: 12,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <div style={{ font: `700 14px/1.3 ${sans}`, color: T.paper }}>
                    {link.label}
                  </div>
                  <div style={{ font: `400 12px/1.5 ${sans}`, color: T.muted, marginTop: 4 }}>
                    {link.description}
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <Btn
                    kind="ghost"
                    size="sm"
                    icon={ExternalLink}
                    onClick={() => onNavigate?.(link.href)}
                    style={{ width: "100%" }}
                  >
                    Open Resource
                  </Btn>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>

      {/* Embedded FAQ Accordion */}
      <div>
        <Eyebrow color={T.faint}>Frequently Asked Questions</Eyebrow>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <Panel key={faq.q} style={{ padding: 14 }}>
                <div
                  onClick={() => toggleFaq(idx)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    gap: 12,
                  }}
                >
                  <div style={{ font: `600 13px/1.3 ${sans}`, color: T.paper }}>
                    {faq.q}
                  </div>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ color: T.muted, flexShrink: 0 }}
                  >
                    <ChevronDown size={16} />
                  </motion.div>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        style={{
                          font: `400 12px/1.6 ${sans}`,
                          color: T.muted,
                          marginTop: 10,
                          paddingTop: 10,
                          borderTop: `1px solid ${T.line2}`,
                        }}
                      >
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Panel>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
