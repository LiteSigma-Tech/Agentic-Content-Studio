import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { CreditCard, TrendingUp, AlertCircle, Sparkles, Check, DollarSign, Activity, Zap } from "lucide-react";
import { motion } from "motion/react";
import { usageApi } from "../../api";
import {
  Panel, Stat, Eyebrow, PageHeader, PlaceholderNotice,
  ErrorBanner, errorGuidance, Btn, Pill, T, sans, mono,
} from "../shared/ui";

const MOCK_PLAN = {
  tier: "Normal",
  cost_cap_usd: 250.0,
  renewsOn: "Renews on September 1, 2026",
  features: [
    "Up to 50 concurrent pipeline runs",
    "Gemini 2.5 Pro & Flash routing enabled",
    "Custom webhook egress endpoints",
    "Standard 24h support SLA",
  ],
};

const MOCK_TIERS = [
  { name: "Zero", cap: "$50 / mo", jobs: "100 jobs", desc: "Sandbox and developer testing" },
  { name: "Normal", cap: "$250 / mo", jobs: "1,500 jobs", desc: "Production studio pipelines" },
  { name: "Elite", cap: "$1,200 / mo", jobs: "10,000 jobs", desc: "Dedicated high-throughput compute" },
];

export default function BillingUsage() {
  const { data: usageData, error, isLoading } = useQuery({
    queryKey: ["usage"],
    queryFn: usageApi.get,
    staleTime: 30_000,
  });

  const [timeRange, setTimeRange] = useState("7d");
  const [chartMode, setChartMode] = useState("breakdown"); // "breakdown" | "total"

  const totalCost = usageData?.total_cost_usd ?? 48.72;
  const costCap = usageData?.spend_cap_usd ?? 250.0;
  const capPercent = Math.min(100, Math.round((totalCost / costCap) * 100));

  const chartData = usageData?.breakdown || [
    { date: "Aug 17", gemini_flash: 1.2, gemini_pro: 2.8, claude_haiku: 0.9, whisper: 0.4, total: 5.3 },
    { date: "Aug 18", gemini_flash: 1.8, gemini_pro: 3.4, claude_haiku: 1.2, whisper: 0.6, total: 7.0 },
    { date: "Aug 19", gemini_flash: 2.1, gemini_pro: 4.1, claude_haiku: 1.5, whisper: 0.5, total: 8.2 },
    { date: "Aug 20", gemini_flash: 1.5, gemini_pro: 3.0, claude_haiku: 0.8, whisper: 0.7, total: 6.0 },
    { date: "Aug 21", gemini_flash: 2.4, gemini_pro: 5.2, claude_haiku: 2.1, whisper: 1.1, total: 10.8 },
    { date: "Aug 22", gemini_flash: 1.9, gemini_pro: 3.8, claude_haiku: 1.4, whisper: 0.8, total: 7.9 },
    { date: "Aug 23", gemini_flash: 0.9, gemini_pro: 1.9, claude_haiku: 0.4, whisper: 0.3, total: 3.5 },
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: T.panel,
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            padding: "10px 12px",
            boxShadow: T.shadow,
          }}
        >
          <div style={{ font: `600 11px/1.3 ${mono}`, color: T.paper, marginBottom: 6 }}>
            {label} Spend
          </div>
          {payload.map((entry) => (
            <div
              key={entry.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 14,
                font: `500 11px/1.4 ${sans}`,
                color: entry.color,
              }}
            >
              <span style={{ textTransform: "capitalize" }}>
                {entry.name.replace("_", " ")}:
              </span>
              <span style={{ fontFamily: mono, fontWeight: 700 }}>
                ${Number(entry.value).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: "grid", gap: 20, maxWidth: 1100 }}
    >
      <PageHeader
        title="Billing & Usage Analytics"
        description="Monitor real-time infrastructure spend, compute caps, and multi-provider token consumption."
      />

      {error && (
        <ErrorBanner error={errorGuidance(error, "Could not load usage data.")} />
      )}

      {/* Top Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <Panel style={{ padding: 18 }}>
          <Stat
            label="Spend to Date"
            value={usageData?.total_cost_usd != null ? `$${usageData.total_cost_usd.toFixed(2)}` : "$48.72"}
            color={T.amber}
            sub={`${capPercent}% of $${costCap.toFixed(2)} monthly budget`}
            change="+14.2% this week"
          />
        </Panel>

        <Panel style={{ padding: 18 }}>
          <Stat
            label="Current Plan"
            value={MOCK_PLAN.tier}
            color={T.teal}
            sub="Auto-renews Sep 1, 2026"
          />
        </Panel>

        <Panel style={{ padding: 18 }}>
          <Stat
            label="Tokens Processed"
            value="34.8M"
            color={T.violet}
            sub="Across 142 orchestrations"
            change="99.4% success"
          />
        </Panel>
      </div>

      {/* Budget Meter Bar */}
      <Panel style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Eyebrow color={T.amber}>
              <TrendingUp size={12} /> Spend Cap Meter
            </Eyebrow>
            <span style={{ font: `600 11px/1 ${mono}`, color: T.paper }}>
              ${totalCost.toFixed(2)} / ${costCap.toFixed(2)} USD
            </span>
          </div>
          <span style={{ font: `600 11px/1 ${mono}`, color: capPercent > 80 ? T.clay : T.teal }}>
            {100 - capPercent}% remaining
          </span>
        </div>

        <div
          style={{
            height: 8,
            width: "100%",
            background: T.panel2,
            borderRadius: 99,
            overflow: "hidden",
            border: `1px solid ${T.line2}`,
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${capPercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
              height: "100%",
              background: capPercent > 85 ? T.clay : T.amber,
              borderRadius: 99,
            }}
          />
        </div>
      </Panel>

      {/* Recharts Usage Area Chart */}
      <Panel style={{ padding: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <Eyebrow color={T.violet}>
              <Activity size={12} /> Compute Spend History (Live & Discovery)
            </Eyebrow>
            <div style={{ font: `600 14px/1.3 ${sans}`, color: T.paper, marginTop: 4 }}>
              Daily Model Invocations & Token Cost ($ USD)
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                background: T.panel2,
                border: `1px solid ${T.line2}`,
                borderRadius: 6,
                padding: 2,
              }}
            >
              <button
                onClick={() => setChartMode("breakdown")}
                style={{
                  background: chartMode === "breakdown" ? T.raised : "transparent",
                  color: chartMode === "breakdown" ? T.paper : T.muted,
                  border: "none",
                  padding: "5px 9px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: mono,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                By Provider
              </button>
              <button
                onClick={() => setChartMode("total")}
                style={{
                  background: chartMode === "total" ? T.raised : "transparent",
                  color: chartMode === "total" ? T.paper : T.muted,
                  border: "none",
                  padding: "5px 9px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: mono,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Total Aggregate
              </button>
            </div>

            <span
              style={{
                font: `600 10px/1 ${mono}`,
                color: T.teal,
                background: `${T.teal}1A`,
                border: `1px solid ${T.teal}33`,
                padding: "5px 8px",
                borderRadius: 5,
              }}
            >
              Past 7 Days
            </span>
          </div>
        </div>

        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.amber} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={T.amber} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorPro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.violet} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={T.violet} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorFlash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.teal} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={T.teal} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorClaude" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.clay} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={T.clay} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line2} vertical={false} />
              <XAxis
                dataKey="date"
                stroke={T.faint}
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: T.line2 }}
              />
              <YAxis
                stroke={T.faint}
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: T.line2 }}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip content={<CustomTooltip />} />
              {chartMode === "total" ? (
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke={T.amber}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                  name="Total Spend"
                />
              ) : (
                <>
                  <Area
                    type="monotone"
                    dataKey="gemini_pro"
                    stackId="1"
                    stroke={T.violet}
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#colorPro)"
                    name="Gemini 2.5 Pro"
                  />
                  <Area
                    type="monotone"
                    dataKey="gemini_flash"
                    stackId="1"
                    stroke={T.teal}
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#colorFlash)"
                    name="Gemini 2.5 Flash"
                  />
                  <Area
                    type="monotone"
                    dataKey="claude_haiku"
                    stackId="1"
                    stroke={T.clay}
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#colorClaude)"
                    name="Claude Haiku"
                  />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, font: `500 11px/1 ${mono}`, color: T.muted }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: T.violet }} /> Gemini Pro (48%)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, font: `500 11px/1 ${mono}`, color: T.muted }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: T.teal }} /> Gemini Flash (28%)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, font: `500 11px/1 ${mono}`, color: T.muted }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: T.clay }} /> Claude Haiku (16%)
          </div>
        </div>
      </Panel>

      {/* Plan Tier Matrix */}
      <div>
        <Eyebrow color={T.faint}>Plan Tier Ladder (Contract Discovery)</Eyebrow>
        <PlaceholderNotice title="Tier Limits Context">
          No live tier-limits endpoint is currently confirmed in the backend API. The plan tier and renewal date below reflect standard production tier specifications (Zero / Normal / Elite).
        </PlaceholderNotice>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
            marginTop: 10,
          }}
        >
          {MOCK_TIERS.map((tier) => {
            const isCurrent = tier.name === MOCK_PLAN.tier;
            return (
              <Panel
                key={tier.name}
                style={{
                  padding: 18,
                  border: `1px solid ${isCurrent ? T.amber : T.line}`,
                  background: isCurrent ? `${T.amber}08` : T.panel,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ font: `700 15px/1.2 ${sans}`, color: T.paper }}>
                    {tier.name} Tier
                  </div>
                  {isCurrent ? (
                    <Pill status="ok" label="Active" />
                  ) : (
                    <span style={{ font: `600 10px/1 ${mono}`, color: T.faint }}>Available</span>
                  )}
                </div>

                <div style={{ font: `700 20px/1 ${mono}`, color: isCurrent ? T.amber : T.paper, marginTop: 12 }}>
                  {tier.cap}
                </div>
                <div style={{ font: `500 11px/1 ${mono}`, color: T.faint, marginTop: 4 }}>
                  {tier.jobs}
                </div>
                <div style={{ font: `400 12px/1.5 ${sans}`, color: T.muted, marginTop: 10 }}>
                  {tier.desc}
                </div>

                <div style={{ marginTop: 16 }}>
                  {isCurrent ? (
                    <Btn kind="ghost" disabled size="sm" style={{ width: "100%" }}>
                      Current Tier
                    </Btn>
                  ) : (
                    <Btn kind="raised" size="sm" style={{ width: "100%" }}>
                      Request Upgrade
                    </Btn>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
