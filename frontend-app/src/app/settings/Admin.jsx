import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Webhook, RotateCcw, X, ShieldAlert, Plus, Building2, Key, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { adminApi, webhooksApi } from "../../api";
import {
  Panel, Eyebrow, EmptyState, ErrorBanner, errorGuidance,
  Btn, CopyBtn, T, PageHeader, PlaceholderNotice, sans, mono,
} from "../shared/ui";

export default function Admin() {
  const qc = useQueryClient();

  const { data: tenantsData, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: adminApi.listTenants,
    staleTime: 15_000,
  });

  const { data: hooksData, refetch: refetchHooks } = useQuery({
    queryKey: ["webhooks"],
    queryFn: webhooksApi.list,
    staleTime: 15_000,
  });

  const [form, setForm] = useState({ name: "", email: "", password: "", plan: "free" });
  const [newKey, setNewKey] = useState(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const [keyRecoveryOpen, setKeyRecoveryOpen] = useState(false);

  const [hookForm, setHookForm] = useState({ url: "", events: "run.done,run.failed", secret: "" });
  const [hookErr, setHookErr] = useState("");
  const [addingHook, setAddingHook] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setErr("");
    setCreating(true);
    try {
      const res = await adminApi.createTenant(form.name, form.email, form.password, form.plan);
      setNewKey(res);
      setForm({ name: "", email: "", password: "", plan: "free" });
      qc.invalidateQueries({ queryKey: ["tenants"] });
    } catch (ex) {
      setErr(errorGuidance(ex, "Tenant creation failed."));
    } finally {
      setCreating(false);
    }
  }

  async function handleAddHook(e) {
    e.preventDefault();
    setHookErr("");
    setAddingHook(true);
    const events = hookForm.events.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      await webhooksApi.register(hookForm.url, events, hookForm.secret);
      setHookForm({ url: "", events: "run.done,run.failed", secret: "" });
      refetchHooks();
    } catch (ex) {
      setHookErr(errorGuidance(ex, "Webhook registration failed."));
    } finally {
      setAddingHook(false);
    }
  }

  async function removeHook(id) {
    await webhooksApi.remove(id);
    refetchHooks();
  }

  const tenants = tenantsData?.tenants || [];
  const hooks = hooksData?.webhooks || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: "grid", gap: 20, maxWidth: 1100 }}
    >
      <PageHeader
        title="Admin Console"
        description="Tenant orchestration, access keys issuance, and egress webhooks delivery configuration."
        badge={
          <span
            style={{
              font: `600 10px/1 ${mono}`,
              color: T.amber,
              background: `${T.amber}1A`,
              border: `1px solid ${T.amber}44`,
              padding: "3px 8px",
              borderRadius: 4,
              textTransform: "uppercase",
            }}
          >
            Superadmin Access
          </span>
        }
      />

      {/* Tenant List Panel */}
      <Panel style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Eyebrow color={T.amber}>
            <Users size={12} style={{ verticalAlign: "-1px" }} />
            <span>Registered Tenants · {tenants.length} total</span>
          </Eyebrow>
          <span style={{ font: `500 11px/1 ${mono}`, color: T.faint }}>
            Scoped to current cluster
          </span>
        </div>

        {isLoading && (
          <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint, padding: "16px 0" }}>
            Loading tenant directory…
          </div>
        )}

        {!isLoading && tenants.length === 0 && (
          <EmptyState
            title="No tenants configured"
            body="Create the first tenant below to mint admin credentials and the one-time API key."
            action="Plaintext keys are displayed strictly once upon creation."
            icon={Building2}
          />
        )}

        {tenants.length > 0 && (
          <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
            {tenants.map((t, idx) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr auto auto auto",
                  gap: 14,
                  alignItems: "center",
                  padding: "12px 14px",
                  background: T.panel2,
                  border: `1px solid ${T.line2}`,
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ font: `600 13px/1.2 ${sans}`, color: T.paper }}>{t.name}</div>
                  <div style={{ font: `500 10px/1 ${mono}`, color: T.faint, marginTop: 4 }}>
                    {t.id}
                  </div>
                </div>
                <div style={{ font: `400 12px/1 ${sans}`, color: T.muted, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.email}
                </div>
                <span
                  style={{
                    font: `600 9px/1 ${mono}`,
                    color: t.plan === "free" ? T.teal : T.amber,
                    background: `${t.plan === "free" ? T.teal : T.amber}1A`,
                    border: `1px solid ${t.plan === "free" ? T.teal : T.amber}44`,
                    padding: "3px 8px",
                    borderRadius: 4,
                    textTransform: "uppercase",
                  }}
                >
                  {t.plan} plan
                </span>
                <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>
                  ${t.cost_cap_usd} cap
                </div>
                <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>
                  {t.job_cap} jobs
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Panel>

      {/* New API Key Reveal-Once Display */}
      <AnimatePresence>
        {newKey && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <Panel style={{ padding: 20, border: `1px solid ${T.teal}77`, background: `${T.teal}0D` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <CheckCircle2 size={16} color={T.teal} />
                <Eyebrow color={T.teal}>tenant created · save credentials</Eyebrow>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ font: `500 12px/1.4 ${mono}`, color: T.muted }}>
                  Tenant ID: <span style={{ color: T.paper, fontWeight: 700 }}>{newKey.tenant_id}</span>
                </div>
                <div
                  style={{
                    background: T.ink,
                    border: `1px solid ${T.teal}44`,
                    borderRadius: 8,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ font: `600 12px/1 ${mono}`, color: T.amber, wordBreak: "break-all" }}>
                    {newKey.api_key}
                  </div>
                  <CopyBtn text={newKey.api_key} label="Copy Key" />
                </div>
                <div style={{ font: `400 11px/1.5 ${mono}`, color: T.clay }}>
                  ⚠ {newKey.note}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Btn kind="ghost" size="sm" onClick={() => setNewKey(null)}>
                    I have safely stored this key
                  </Btn>
                </div>
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Key Recovery & Security Advisory Panel */}
      <Panel style={{ padding: 20, border: `1px solid ${T.clay}44` }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 700 }}>
            <Eyebrow color={T.clay}>
              <Key size={12} /> API Key Recovery & Rotation
            </Eyebrow>
            <div style={{ font: `400 12px/1.55 ${sans}`, color: T.muted, marginTop: 6 }}>
              Existing plaintext API keys cannot be viewed again once dismissed from the UI. A safe rotation flow requires a dedicated backend revocation endpoint to invalidate stale keys and return the new token once.
            </div>
          </div>
          <Btn
            kind="danger"
            icon={RotateCcw}
            onClick={() => setKeyRecoveryOpen((v) => !v)}
          >
            {keyRecoveryOpen ? "Hide Advisory" : "Regenerate Key"}
          </Btn>
        </div>

        <AnimatePresence>
          {keyRecoveryOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div
                style={{
                  marginTop: 14,
                  padding: "12px 14px",
                  background: `${T.clay}12`,
                  border: `1px solid ${T.clay}44`,
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldAlert size={15} color={T.clay} />
                  <div style={{ font: `600 12px/1.4 ${mono}`, color: T.clay }}>
                    Backend Gap: No regenerate endpoint is exposed in the current API surface.
                  </div>
                </div>
                <div style={{ font: `400 12px/1.5 ${sans}`, color: T.muted, marginTop: 6 }}>
                  This UI adheres strictly to cryptographic zero-trust principles: it avoids fabricating mock keys locally. Once the rotation endpoint is available in the platform gateway, the rotation action will safely mint replacement credentials.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Panel>

      {/* Grid: Create Tenant & Webhooks */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 20,
        }}
      >
        {/* Create Tenant Form */}
        <Panel style={{ padding: 20 }}>
          <Eyebrow color={T.paper}>
            <Plus size={12} /> Create Tenant
          </Eyebrow>
          <div style={{ font: `400 12px/1.4 ${sans}`, color: T.muted, marginTop: 4 }}>
            Mint a tenant profile, initial admin account, and secret key.
          </div>

          <form onSubmit={handleCreate} style={{ marginTop: 16, display: "grid", gap: 12 }}>
            {[
              ["Organization Name", "name", "text", "Acme Labs"],
              ["Admin Email", "email", "email", "admin@acmelabs.com"],
              ["Initial Admin Password", "password", "password", "••••••••"],
            ].map(([label, key, type, ph]) => (
              <div key={key}>
                <label style={{ font: `600 10px/1 ${mono}`, color: T.muted, textTransform: "uppercase" }}>
                  {label}
                </label>
                <input
                  type={type}
                  placeholder={ph}
                  required
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    background: T.ink,
                    color: T.paper,
                    border: `1px solid ${T.line2}`,
                    borderRadius: 7,
                    padding: "9px 12px",
                    font: `400 13px/1 ${sans}`,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ))}

            <div>
              <label style={{ font: `600 10px/1 ${mono}`, color: T.muted, textTransform: "uppercase" }}>
                Plan Tier
              </label>
              <select
                value={form.plan}
                onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 6,
                  background: T.ink,
                  color: T.paper,
                  border: `1px solid ${T.line2}`,
                  borderRadius: 7,
                  padding: "9px 12px",
                  font: `500 12px/1 ${mono}`,
                }}
              >
                <option value="free">free ($50 cap / 100 jobs)</option>
                <option value="paid">paid ($500 cap / 1500 jobs)</option>
              </select>
            </div>

            {err && <ErrorBanner error={err} />}

            <Btn kind="primary" disabled={creating} type="submit" style={{ marginTop: 4 }}>
              {creating ? "Creating Tenant…" : "Create Tenant & Mint Key"}
            </Btn>
          </form>
        </Panel>

        {/* Webhook Management Panel */}
        <Panel style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Eyebrow color={T.violet}>
              <Webhook size={12} style={{ verticalAlign: "-1px" }} /> Webhooks & Egress
            </Eyebrow>
            <span style={{ font: `600 10px/1 ${mono}`, color: T.faint }}>
              {hooks.length} Active
            </span>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {hooks.length === 0 && (
              <EmptyState
                title="No webhooks registered"
                body="Register an endpoint to receive signed run.done, run.failed, and approval events."
                action="Requires a public HTTPS destination."
                icon={Webhook}
              />
            )}

            {hooks.map((h) => (
              <div
                key={h.id}
                style={{
                  background: T.panel2,
                  border: `1px solid ${T.line2}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      font: `500 12px/1.4 ${mono}`,
                      color: T.paper,
                      wordBreak: "break-all",
                    }}
                  >
                    {h.url}
                  </div>
                  <button
                    onClick={() => removeHook(h.id)}
                    title="Remove webhook"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: T.clay,
                      padding: 2,
                      flexShrink: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                  {h.events.map((ev) => (
                    <span
                      key={ev}
                      style={{
                        font: `600 9px/1 ${mono}`,
                        color: T.violet,
                        background: `${T.violet}1A`,
                        border: `1px solid ${T.violet}44`,
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {ev}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddHook} style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <Eyebrow color={T.faint}>Register New Endpoint</Eyebrow>
            {[
              ["Destination URL", "url", "https://api.yourdomain.com/webhooks/studio"],
              ["Subscribed Events (comma-separated)", "events", "run.done, run.failed"],
              ["HMAC Secret (optional)", "secret", "Optional signature secret"],
            ].map(([label, key, ph]) => (
              <div key={key}>
                <label style={{ font: `600 10px/1 ${mono}`, color: T.muted, textTransform: "uppercase" }}>
                  {label}
                </label>
                <input
                  placeholder={ph}
                  required={key === "url"}
                  value={hookForm[key]}
                  onChange={(e) => setHookForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 5,
                    background: T.ink,
                    color: T.paper,
                    border: `1px solid ${T.line2}`,
                    borderRadius: 7,
                    padding: "8px 10px",
                    font: `400 12px/1 ${sans}`,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ))}

            {hookErr && <ErrorBanner error={hookErr} />}

            <Btn kind="ghost" disabled={addingHook} type="submit" style={{ marginTop: 2 }}>
              {addingHook ? "Registering…" : "Register Webhook"}
            </Btn>
          </form>
        </Panel>
      </div>
    </motion.div>
  );
}
