import { useState, useEffect } from "react";
import { SlidersHorizontal, Cpu } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { T, mono, Eyebrow, Panel } from "../shared/ui";
import { modelsApi } from "../../api";



/* ── fallback/mock data (used until the API responds, mirrors real shapes) */
const PROVIDERS = [
  { id: "ollama/qwen2.5:32b", mod: "llm", free: true, caps: ["function_calling", "json", "moderation_ok"] },
  { id: "openrouter/qwen-2.5-72b:free", mod: "llm", free: true, caps: ["function_calling", "json", "long_context"] },
  { id: "groq/llama-3.3-70b", mod: "llm", free: true, caps: ["function_calling", "json"] },
  { id: "anthropic/claude (paid)", mod: "llm", free: false, caps: ["function_calling", "json", "vision"] },
  { id: "comfyui/flux-schnell", mod: "image", free: true, caps: ["moderation_ok"] },
  { id: "comfyui/ltx-video", mod: "video", free: true, caps: ["image_init", "moderation_ok"] },
  { id: "runway/gen3 (paid)", mod: "video", free: false, caps: ["image_init"] },
  { id: "comfyui/kokoro", mod: "tts", free: true, caps: ["multi_speaker", "moderation_ok"] },
  { id: "comfyui/musicgen", mod: "music", free: true, caps: ["moderation_ok"] },
];
const TASKS = [
  ["llm", "script_writing", []],
  ["llm", "agent_reasoning", ["function_calling"]],
  ["llm", "kids_content", ["moderation_ok"]],
  ["image", "default", []],
  ["video", "default", []],
  ["tts", "default", []],
  ["music", "default", []],
];

/* ── page ─────────────────────────────────────────────────────────────── */
export default function ModelsPage() {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  const [routing, setRouting] = useState({});
  const [freeOnly, setFreeOnly] = useState(true);

  const { data: providersData } = useQuery({
    queryKey: ["providers"],
    queryFn: modelsApi.getProviders,
    staleTime: 60_000,
  });
  // NOTE: mirrors PlatformConsole.jsx's original behavior — routingConfig is
  // fetched but routing/freeOnly are otherwise local-only state; nothing is
  // written back to the server here. If your api.js exposes a persistence
  // call (e.g. modelsApi.setConfig), wire it into updateRouting/updateFreeOnly
  // below with a useMutation, the same way other pages save changes.
  const { data: routingConfig } = useQuery({
    queryKey: ["routing-config"],
    queryFn: modelsApi.getConfig,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (routingConfig?.routing) setRouting((r) => ({ ...routingConfig.routing, ...r }));
    if (typeof routingConfig?.free_only === "boolean") setFreeOnly(routingConfig.free_only);
  }, [routingConfig]);

  function updateRouting(next) {
    setRouting(next);
  }
  function updateFreeOnly(next) {
    setFreeOnly(next);
  }

  const providers = providersData?.providers?.length ? providersData.providers : PROVIDERS;
  const byMod = (m) => providers.filter((p) => p.mod === m);

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
      <Panel style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow>
            <SlidersHorizontal size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;routing · per task
          </Eyebrow>
          <button
            onClick={() => updateFreeOnly(!freeOnly)}
            style={{ display: "flex", gap: 8, alignItems: "center", background: "transparent", border: "none", cursor: "pointer" }}
          >
            <span style={{ font: `600 10px/1 ${mono}`, letterSpacing: ".1em", textTransform: "uppercase", color: freeOnly ? T.teal : T.faint }}>
              free only
            </span>
            <span
              style={{
                width: 34, height: 18, borderRadius: 99, padding: 2,
                background: freeOnly ? `${T.teal}55` : T.line2, transition: "all .2s",
                display: "flex", justifyContent: freeOnly ? "flex-end" : "flex-start",
              }}
            >
              <span style={{ width: 14, height: 14, borderRadius: 99, background: freeOnly ? T.teal : T.muted }} />
            </span>
          </button>
        </div>
        <div style={{ marginTop: 14, display: "grid", gap: 1 }}>
          {TASKS.map(([mod, task, req]) => {
            const opts = byMod(mod)
              .filter((p) => p.free || !freeOnly)
              .filter((p) => req.every((r) => p.caps.includes(r)));
            const key = `${mod}.${task}`;
            const cur = routing[key] || opts[0]?.id;
            return (
              <div
                key={key}
                style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 10, alignItems: "center", padding: "9px 0", borderTop: `1px solid ${T.line}` }}
              >
                <div>
                  <div style={{ font: `600 12px/1.2 ${mono}`, color: T.paper }}>{task}</div>
                  <div style={{ font: `500 10px/1 ${mono}`, color: T.faint, marginTop: 3 }}>
                    {mod}
                    {req.length ? ` · needs ${req.join(", ")}` : ""}
                  </div>
                </div>
                <select
                  value={cur}
                  onChange={(e) => updateRouting({ ...routing, [key]: e.target.value })}
                  style={{ background: T.ink, color: T.paper, border: `1px solid ${T.line2}`, borderRadius: 6, padding: "8px 10px", font: `500 11px/1 ${mono}`, width: "100%" }}
                >
                  {opts.map((p) => (
                    <option key={p.id} value={p.id}>{p.id}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, padding: "10px 12px", background: T.ink, border: `1px solid ${T.line2}`, borderRadius: 7, font: `500 10px/1.5 ${mono}`, color: T.muted }}>
          policy: max_cost_per_job_usd ={" "}
          <b style={{ color: freeOnly ? T.teal : T.amber }}>
            {freeOnly ? "0.00 (free-only)" : "1.00 (paid fallback allowed)"}
          </b>{" "}
          · change applies to the next job
        </div>
      </Panel>

      <Panel style={{ padding: 18 }}>
        <Eyebrow>
          <Cpu size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;provider catalogue
        </Eyebrow>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {providers.map((p) => {
            const dim = freeOnly && !p.free;
            return (
              <div key={p.id} style={{ padding: "10px 12px", borderRadius: 8, background: T.panel2, border: `1px solid ${T.line}`, opacity: dim ? 0.4 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ font: `600 12px/1 ${mono}`, color: T.paper, textDecoration: dim ? "line-through" : "none" }}>{p.id}</div>
                  <span
                    style={{
                      font: `600 9px/1 ${mono}`, letterSpacing: ".08em", textTransform: "uppercase",
                      color: p.free ? T.teal : T.amber, background: `${p.free ? T.teal : T.amber}1A`,
                      border: `1px solid ${(p.free ? T.teal : T.amber)}44`, padding: "3px 6px", borderRadius: 4,
                    }}
                  >
                    {p.free ? "free" : "paid"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                  {p.caps.map((c) => (
                    <span key={c} style={{ font: `500 9px/1 ${mono}`, color: T.muted, border: `1px solid ${T.line2}`, padding: "3px 6px", borderRadius: 4 }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}