import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Clapperboard, Target, SlidersHorizontal, Radio,
  Check, X, ChevronRight, Film, Music, Image as ImageIcon, Cpu,
  ShieldCheck, AlertTriangle, Lock, Play, RotateCcw, Mic,
} from "lucide-react";

/* ── design tokens ─────────────────────────────────────────────────────── */
const T = {
  ink: "#14110E", panel: "#211C17", panel2: "#2A231B", raised: "#322920",
  line: "#3C3227", line2: "#4A3E30",
  paper: "#ECE4D6", muted: "#A6987F", faint: "#7D715E",
  amber: "#E8A33D", teal: "#62B69E", clay: "#D2694B", violet: "#9C8BD0",
};
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const sans = "Inter, system-ui, -apple-system, Segoe UI, sans-serif";

/* status -> color */
const SC = { running: T.amber, done: T.teal, pending: T.faint,
  blocked: T.clay, ok: T.teal };

/* ── tiny atoms ────────────────────────────────────────────────────────── */
function Eyebrow({ children, color = T.faint }) {
  return <div style={{ font: `600 10px/1.4 ${mono}`, letterSpacing: "0.18em",
    textTransform: "uppercase", color }}>{children}</div>;
}
function Lamp({ on, color = T.amber, size = 9 }) {
  return <span style={{ display: "inline-block", width: size, height: size,
    borderRadius: 99, background: on ? color : T.line2,
    boxShadow: on ? `0 0 0 2px ${color}22, 0 0 10px ${color}` : "none",
    transition: "all .3s" }} className={on ? "led-pulse" : ""} />;
}
function Panel({ children, style }) {
  return <div style={{ background: T.panel, border: `1px solid ${T.line}`,
    borderRadius: 10, ...style }}>{children}</div>;
}
function Pill({ status, label }) {
  const c = SC[status] || T.muted;
  return <span style={{ font: `600 10px/1 ${mono}`, letterSpacing: ".08em",
    textTransform: "uppercase", color: c, background: `${c}1A`,
    border: `1px solid ${c}40`, padding: "4px 7px", borderRadius: 5,
    display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
    <Lamp on color={c} size={6} />{label || status}</span>;
}
function Btn({ children, onClick, kind = "ghost", disabled, icon: Ic }) {
  const styles = {
    primary: { background: T.amber, color: T.ink, border: `1px solid ${T.amber}` },
    ok: { background: `${T.teal}22`, color: T.teal, border: `1px solid ${T.teal}55` },
    danger: { background: `${T.clay}1A`, color: T.clay, border: `1px solid ${T.clay}55` },
    ghost: { background: "transparent", color: T.paper, border: `1px solid ${T.line2}` },
  }[kind];
  return <button onClick={onClick} disabled={disabled} style={{
    font: `600 12px/1 ${sans}`, padding: "9px 13px", borderRadius: 7,
    display: "inline-flex", alignItems: "center", gap: 7, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1, ...styles }}>
    {Ic && <Ic size={14} />}{children}</button>;
}

/* ── signature: the signal chain ──────────────────────────────────────── */
const STAGES = [
  ["Script", "video"], ["Characters", "video"], ["Keyframes", "video"],
  ["Clips", "video"], ["Assemble", "video"], ["Render", "video"],
  ["Cast voices", "audio"], ["Dialogue", "audio"], ["Music", "audio"],
  ["Mix", "audio"], ["Mux", "audio"],
];
function SignalChain({ idx, running }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 0, minWidth: 720, padding: "6px 2px" }}>
        {STAGES.map(([label, lane], i) => {
          const status = i < idx ? "done" : (i === idx && running ? "running" : i === idx && !running && idx === STAGES.length ? "done" : "pending");
          const c = SC[status];
          const first = i === 0 || STAGES[i - 1][1] !== lane;
          return (
            <React.Fragment key={label}>
              {first && i !== 0 && <div style={{ width: 1, alignSelf: "stretch",
                background: T.line2, margin: "0 10px" }} />}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, minWidth: 58 }}>
                {first && <div style={{ position: "absolute", marginTop: -22 }}>
                  <Eyebrow color={lane === "video" ? T.muted : T.violet}>{lane}</Eyebrow></div>}
                <div style={{ width: 38, height: 38, borderRadius: 8,
                  background: status === "pending" ? T.panel2 : `${c}1A`,
                  border: `1px solid ${status === "pending" ? T.line2 : c}`,
                  display: "grid", placeItems: "center" }}>
                  <Lamp on={status !== "pending"} color={c} size={9} />
                </div>
                <div style={{ font: `500 9px/1.2 ${mono}`, color: status === "pending" ? T.faint : T.paper,
                  textAlign: "center", maxWidth: 56 }}>{label}</div>
              </div>
              {i < STAGES.length - 1 && STAGES[i + 1][1] === lane &&
                <div style={{ height: 1, width: 14, background: i < idx ? T.teal : T.line2, marginBottom: 22 }} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ── mock data (mirrors the real API shapes) ──────────────────────────── */
const GENRES = ["drama", "romance", "comedy", "kids_cartoon"];
const LEADS = [
  { name: "Dana Reyes", company: "SolarBright", region: "US", score: 90, status: "qualified", note: "VP Marketing · legitimate interest" },
  { name: "Marcus Lee", company: "Helios Co", region: "US", score: 90, status: "qualified", note: "Head of Growth · opt-in" },
  { name: "Liam Walsh", company: "EireWind", region: "IE", score: 85, status: "qualified", note: "CMO · opt-in (EU)" },
  { name: "Sofia Klein", company: "GrünPower", region: "DE", score: 85, status: "blocked", note: "DE requires explicit opt-in" },
  { name: "Tom Becker", company: "WattWorks", region: "US", score: 55, status: "blocked", note: "no lawful basis (unknown consent)" },
  { name: "Ava Stone", company: "SunPeak", region: "US", score: 75, status: "blocked", note: "invalid or missing email" },
  { name: "Priya Nair", company: "DentalPlus", region: "US", score: 15, status: "disqualified", note: "off-ICP (healthcare)" },
];
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
  ["llm", "script_writing", []], ["llm", "agent_reasoning", ["function_calling"]],
  ["llm", "kids_content", ["moderation_ok"]], ["image", "default", []],
  ["video", "default", []], ["tts", "default", []], ["music", "default", []],
];

/* ── screens ──────────────────────────────────────────────────────────── */
function Stat({ label, value, color = T.paper, sub }) {
  return <div style={{ flex: 1 }}>
    <Eyebrow>{label}</Eyebrow>
    <div style={{ font: `700 26px/1.1 ${sans}`, letterSpacing: "-0.02em", color, marginTop: 6 }}>{value}</div>
    {sub && <div style={{ font: `500 11px/1.3 ${mono}`, color: T.faint, marginTop: 3 }}>{sub}</div>}
  </div>;
}

function Dashboard({ go, studioIdx, studioRunning, pending }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div><Eyebrow color={T.amber}>active run · studio</Eyebrow>
            <div style={{ font: `700 16px/1.2 ${sans}`, color: T.paper, marginTop: 5 }}>
              "Pip Learns To Share" · kids_cartoon</div></div>
          <Pill status={studioRunning ? "running" : (studioIdx >= STAGES.length ? "done" : "pending")}
            label={studioRunning ? "rendering" : (studioIdx >= STAGES.length ? "complete" : "idle")} />
        </div>
        <SignalChain idx={studioIdx} running={studioRunning} />
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <Panel style={{ padding: 18, display: "flex", gap: 12 }}>
          <Stat label="lead funnel" value="7" sub="sourced" />
          <Stat label="qualified" value="6" color={T.teal} sub="≥ threshold" />
          <Stat label="contactable" value="3" color={T.amber} sub="post-compliance" />
        </Panel>
        <Panel style={{ padding: 18 }} >
          <Eyebrow>needs you</Eyebrow>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <div style={{ font: `700 26px/1 ${sans}`, color: pending ? T.clay : T.teal }}>{pending}</div>
            <div style={{ font: `500 12px/1 ${mono}`, color: T.muted }}>outreach approvals</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <Btn kind={pending ? "danger" : "ghost"} icon={ShieldCheck} onClick={() => go("leads")}>
              Open approval inbox</Btn></div>
        </Panel>
        <Panel style={{ padding: 18, display: "flex", gap: 12 }}>
          <Stat label="run cost" value="$0.00" color={T.teal} sub="free models" />
          <Stat label="models" value="9" sub="6 free · routable" />
        </Panel>
      </div>
    </div>
  );
}

function Studio({ genre, setGenre, idx, running, run, reset }) {
  const kids = genre === "kids_cartoon";
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel style={{ padding: 18 }}>
        <Eyebrow color={T.amber}>new episode</Eyebrow>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px" }}>
            <label style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>Concept</label>
            <input defaultValue="A shy turtle learns to share with forest friends"
              style={{ width: "100%", marginTop: 6, background: T.ink, color: T.paper,
                border: `1px solid ${T.line2}`, borderRadius: 7, padding: "10px 12px",
                font: `400 13px/1 ${sans}` }} />
          </div>
          <div>
            <label style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>Genre</label>
            <select value={genre} onChange={(e) => setGenre(e.target.value)}
              style={{ display: "block", marginTop: 6, background: T.ink, color: T.paper,
                border: `1px solid ${T.line2}`, borderRadius: 7, padding: "10px 12px",
                font: `500 13px/1 ${mono}` }}>
              {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <Btn kind="primary" icon={running ? RotateCcw : Play}
            onClick={running ? undefined : run} disabled={running}>
            {running ? "Running…" : "Run pipeline"}</Btn>
          <Btn icon={RotateCcw} onClick={reset}>Reset</Btn>
        </div>
        {kids && <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8,
          font: `500 11px/1.4 ${mono}`, color: T.violet }}>
          <Lock size={12} /> Kids content routes script, dialogue & music through the
          moderation-gated path — only models flagged <b>moderation_ok</b> can run.</div>}
      </Panel>

      <Panel style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <Eyebrow>pipeline · 11 stages · durable + resumable</Eyebrow>
          <span style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>
            {idx >= STAGES.length ? "11/11" : `${Math.min(idx + (running ? 1 : 0), STAGES.length)}/11`}</span>
        </div>
        <SignalChain idx={idx} running={running} />
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel style={{ padding: 18 }}>
          <Eyebrow><Film size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;shot list</Eyebrow>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {(idx >= 1 ? ["Friendly introduction", "A small fun problem", "Kind friends help out",
              "Happy solution", "Warm goodbye lesson"] : []).map((s, i) =>
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                font: `500 12px/1.3 ${sans}`, color: T.paper }}>
                <span style={{ font: `600 10px/1 ${mono}`, color: T.faint }}>S{i + 1}</span>
                {s}<span style={{ marginLeft: "auto", font: `500 10px/1 ${mono}`, color: T.muted }}>4.0s</span>
              </div>)}
            {idx < 1 && <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint }}>
              Run the pipeline to generate the script and shot list.</div>}
          </div>
        </Panel>
        <Panel style={{ padding: 18 }}>
          <Eyebrow><Mic size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;voice casting</Eyebrow>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {(idx >= 7 ? [["Pip", "vo_playful_m"], ["Bo", "vo_bright_f"]] : []).map(([n, v]) =>
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ font: `600 12px/1 ${sans}`, color: T.paper, width: 40 }}>{n}</div>
                <div style={{ font: `500 11px/1 ${mono}`, color: T.violet }}>{v}</div>
                <Lamp on color={T.teal} size={7} />
              </div>)}
            {idx < 7 && <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint }}>
              Voices are cast once the audio stages begin, then reused across shots.</div>}
          </div>
          {idx >= STAGES.length && <div style={{ marginTop: 14, padding: "10px 12px",
            background: `${T.teal}14`, border: `1px solid ${T.teal}44`, borderRadius: 7,
            font: `500 11px/1.4 ${mono}`, color: T.teal }}>
            ▸ final_av.mp4 — video + ducked, synced audio</div>}
        </Panel>
      </div>
    </div>
  );
}

function Leads({ approvals, decide }) {
  const pending = approvals.filter((a) => a.status === "pending");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
      <div style={{ display: "grid", gap: 16 }}>
        <Panel style={{ padding: 18 }}>
          <Eyebrow><Target size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;leads · ICP: renewable energy</Eyebrow>
          <div style={{ marginTop: 12, display: "grid", gap: 1 }}>
            {LEADS.map((l) => (
              <div key={l.name} style={{ display: "grid", gridTemplateColumns: "1.2fr auto auto",
                gap: 10, alignItems: "center", padding: "9px 0", borderTop: `1px solid ${T.line}` }}>
                <div>
                  <div style={{ font: `600 13px/1.2 ${sans}`, color: T.paper }}>{l.name}
                    <span style={{ color: T.faint, fontWeight: 400 }}> · {l.company}</span></div>
                  <div style={{ font: `400 11px/1.3 ${sans}`,
                    color: l.status === "blocked" ? T.clay : T.faint, marginTop: 2 }}>{l.note}</div>
                </div>
                <div style={{ font: `700 14px/1 ${mono}`,
                  color: l.score >= 50 ? T.teal : T.faint }}>{l.score}</div>
                <Pill status={l.status === "qualified" ? "ok" : l.status === "blocked" ? "blocked" : "pending"}
                  label={l.status} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 16 }}>
            <Stat label="qualified" value="6" color={T.teal} />
            <Stat label="blocked by compliance" value="3" color={T.clay} sub="opt-in · consent · email" />
            <Stat label="contactable" value="3" color={T.amber} />
          </div>
        </Panel>
      </div>

      <Panel style={{ padding: 18, alignSelf: "start" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow color={T.clay}><ShieldCheck size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;approval inbox</Eyebrow>
          <Pill status={pending.length ? "blocked" : "ok"}
            label={pending.length ? `${pending.length} need you` : "clear"} />
        </div>
        <div style={{ font: `400 11px/1.5 ${sans}`, color: T.faint, margin: "8px 0 14px" }}>
          Every send pauses here. The send tool re-checks suppression at execution — approving a
          contact who unsubscribed still won't send.</div>
        <div style={{ display: "grid", gap: 10 }}>
          {approvals.map((a) => (
            <div key={a.id} style={{ background: T.panel2, border: `1px solid ${T.line2}`,
              borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ font: `600 12px/1 ${sans}`, color: T.paper }}>{a.to}</div>
                <Pill status={a.status === "pending" ? "running" : a.status === "sent" ? "done" : "blocked"}
                  label={a.status === "pending" ? "awaiting approval" : a.status} />
              </div>
              <div style={{ font: `600 12px/1.3 ${sans}`, color: T.paper, marginTop: 8 }}>{a.subject}</div>
              <div style={{ font: `400 11px/1.5 ${sans}`, color: T.muted, marginTop: 4 }}>{a.body}</div>
              {a.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Btn kind="ok" icon={Check} onClick={() => decide(a.id, "sent")}>Approve & send</Btn>
                  <Btn kind="danger" icon={X} onClick={() => decide(a.id, "rejected")}>Reject</Btn>
                </div>)}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Models({ routing, setRouting, freeOnly, setFreeOnly }) {
  const byMod = (m) => PROVIDERS.filter((p) => p.mod === m);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Panel style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow><SlidersHorizontal size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;routing · per task</Eyebrow>
          <button onClick={() => setFreeOnly(!freeOnly)} style={{ display: "flex", gap: 8, alignItems: "center",
            background: "transparent", border: "none", cursor: "pointer" }}>
            <span style={{ font: `600 10px/1 ${mono}`, letterSpacing: ".1em", textTransform: "uppercase",
              color: freeOnly ? T.teal : T.faint }}>free only</span>
            <span style={{ width: 34, height: 18, borderRadius: 99, padding: 2,
              background: freeOnly ? `${T.teal}55` : T.line2, transition: "all .2s",
              display: "flex", justifyContent: freeOnly ? "flex-end" : "flex-start" }}>
              <span style={{ width: 14, height: 14, borderRadius: 99,
                background: freeOnly ? T.teal : T.muted }} /></span>
          </button>
        </div>
        <div style={{ marginTop: 14, display: "grid", gap: 1 }}>
          {TASKS.map(([mod, task, req]) => {
            const opts = byMod(mod).filter((p) => p.free || !freeOnly)
              .filter((p) => req.every((r) => p.caps.includes(r)));
            const key = `${mod}.${task}`;
            const cur = routing[key] || opts[0]?.id;
            return (
              <div key={key} style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr",
                gap: 10, alignItems: "center", padding: "9px 0", borderTop: `1px solid ${T.line}` }}>
                <div>
                  <div style={{ font: `600 12px/1.2 ${mono}`, color: T.paper }}>{task}</div>
                  <div style={{ font: `500 10px/1 ${mono}`, color: T.faint, marginTop: 3 }}>
                    {mod}{req.length ? ` · needs ${req.join(", ")}` : ""}</div>
                </div>
                <select value={cur} onChange={(e) => setRouting({ ...routing, [key]: e.target.value })}
                  style={{ background: T.ink, color: T.paper, border: `1px solid ${T.line2}`,
                    borderRadius: 6, padding: "8px 10px", font: `500 11px/1 ${mono}`, width: "100%" }}>
                  {opts.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
                </select>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, padding: "10px 12px", background: T.ink,
          border: `1px solid ${T.line2}`, borderRadius: 7, font: `500 10px/1.5 ${mono}`, color: T.muted }}>
          policy: max_cost_per_job_usd = <b style={{ color: freeOnly ? T.teal : T.amber }}>
          {freeOnly ? "0.00 (free-only)" : "1.00 (paid fallback allowed)"}</b> · change applies to the next job
        </div>
      </Panel>

      <Panel style={{ padding: 18 }}>
        <Eyebrow><Cpu size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;provider catalogue</Eyebrow>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {PROVIDERS.map((p) => {
            const dim = freeOnly && !p.free;
            return (
              <div key={p.id} style={{ padding: "10px 12px", borderRadius: 8,
                background: T.panel2, border: `1px solid ${T.line}`, opacity: dim ? 0.4 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ font: `600 12px/1 ${mono}`, color: T.paper,
                    textDecoration: dim ? "line-through" : "none" }}>{p.id}</div>
                  <span style={{ font: `600 9px/1 ${mono}`, letterSpacing: ".08em", textTransform: "uppercase",
                    color: p.free ? T.teal : T.amber, background: `${p.free ? T.teal : T.amber}1A`,
                    border: `1px solid ${(p.free ? T.teal : T.amber)}44`, padding: "3px 6px", borderRadius: 4 }}>
                    {p.free ? "free" : "paid"}</span>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                  {p.caps.map((c) => <span key={c} style={{ font: `500 9px/1 ${mono}`,
                    color: T.muted, border: `1px solid ${T.line2}`, padding: "3px 6px", borderRadius: 4 }}>{c}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ── shell ────────────────────────────────────────────────────────────── */
const NAV = [["dashboard", LayoutDashboard, "Dashboard"], ["studio", Clapperboard, "Studio"],
  ["leads", Target, "Leads"], ["models", SlidersHorizontal, "Models"]];

export default function PlatformConsole() {
  const [view, setView] = useState("dashboard");
  const [genre, setGenre] = useState("kids_cartoon");
  const [idx, setIdx] = useState(STAGES.length);   // start "complete"
  const [running, setRunning] = useState(false);
  const [routing, setRouting] = useState({});
  const [freeOnly, setFreeOnly] = useState(true);
  const [approvals, setApprovals] = useState([
    { id: 1, to: "dana@solarbright.com", subject: "Quick question, Dana",
      body: "Hi Dana, I came across SolarBright and thought our work might be relevant. Open to a quick chat? Reply STOP and I won't follow up.", status: "pending" },
    { id: 2, to: "marcus@helios.co", subject: "Quick question, Marcus",
      body: "Hi Marcus, saw what Helios Co is building — worth a short call? Reply STOP to opt out.", status: "pending" },
    { id: 3, to: "liam@eirewind.ie", subject: "Quick question, Liam",
      body: "Hi Liam, EireWind caught my eye. Open to connecting? Reply STOP to opt out.", status: "sent" },
  ]);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);
  function run() {
    setRunning(true); setIdx(0);
    timer.current = setInterval(() => {
      setIdx((i) => {
        if (i >= STAGES.length - 1) { clearInterval(timer.current); setRunning(false); return STAGES.length; }
        return i + 1;
      });
    }, 650);
  }
  function reset() { clearInterval(timer.current); setRunning(false); setIdx(0); }
  const decide = (id, status) => setApprovals((a) => a.map((x) => x.id === id ? { ...x, status } : x));
  const pending = approvals.filter((a) => a.status === "pending").length;
  const onair = running || pending > 0;

  return (
    <div style={{ background: T.ink, color: T.paper, font: `400 14px/1.5 ${sans}`,
      minHeight: 640, display: "flex", borderRadius: 12, overflow: "hidden",
      border: `1px solid ${T.line}` }}>
      <style>{`
        .led-pulse{animation:led 1.4s ease-in-out infinite}
        @keyframes led{0%,100%{opacity:1}50%{opacity:.45}}
        @media (prefers-reduced-motion: reduce){.led-pulse{animation:none}}
        select:focus,input:focus,button:focus-visible{outline:2px solid ${T.amber};outline-offset:1px}
        ::selection{background:${T.amber}44}
      `}</style>

      {/* left rail */}
      <nav style={{ width: 180, background: T.panel, borderRight: `1px solid ${T.line}`,
        padding: 16, display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        <div style={{ font: `800 13px/1 ${mono}`, letterSpacing: "0.04em", color: T.paper,
          padding: "4px 8px 16px" }}>STUDIO<span style={{ color: T.amber }}>//</span>OPS</div>
        {NAV.map(([k, Ic, label]) => (
          <button key={k} onClick={() => setView(k)} style={{ display: "flex", alignItems: "center", gap: 10,
            padding: "10px 10px", borderRadius: 7, border: "none", cursor: "pointer", textAlign: "left",
            background: view === k ? T.raised : "transparent",
            color: view === k ? T.paper : T.muted,
            font: `600 12px/1 ${sans}`, position: "relative" }}>
            {view === k && <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 2,
              borderRadius: 9, background: T.amber }} />}
            <Ic size={15} /> {label}
            {k === "leads" && pending > 0 && <span style={{ marginLeft: "auto", font: `700 9px/1 ${mono}`,
              color: T.ink, background: T.clay, borderRadius: 99, padding: "2px 6px" }}>{pending}</span>}
          </button>
        ))}
        <div style={{ marginTop: "auto", padding: "8px", font: `500 9px/1.5 ${mono}`, color: T.faint }}>
          gateway · agents · video · audio · leads</div>
      </nav>

      {/* main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${T.line}`, display: "flex",
          alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: T.panel }}>
          <div style={{ font: `700 14px/1 ${sans}`, letterSpacing: "-0.01em", textTransform: "capitalize" }}>
            {view}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Radio size={14} color={onair ? T.amber : T.faint} className={onair ? "led-pulse" : ""} />
              <span style={{ font: `700 10px/1 ${mono}`, letterSpacing: ".12em",
                color: onair ? T.amber : T.faint }}>{onair ? "ON AIR" : "IDLE"}</span>
            </div>
            <div style={{ width: 1, height: 22, background: T.line2 }} />
            <div style={{ font: `600 11px/1 ${mono}`, color: T.muted }}>
              <span style={{ color: T.teal }}>$0.00</span> · {freeOnly ? "free models" : "paid allowed"}</div>
          </div>
        </header>
        <main style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {view === "dashboard" && <Dashboard go={setView} studioIdx={idx} studioRunning={running} pending={pending} />}
          {view === "studio" && <Studio genre={genre} setGenre={setGenre} idx={idx} running={running} run={run} reset={reset} />}
          {view === "leads" && <Leads approvals={approvals} decide={decide} />}
          {view === "models" && <Models routing={routing} setRouting={setRouting} freeOnly={freeOnly} setFreeOnly={setFreeOnly} />}
        </main>
      </div>
    </div>
  );
}
