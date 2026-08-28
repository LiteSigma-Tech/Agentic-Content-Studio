import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Clapperboard, Target, SlidersHorizontal, Radio,
  Check, X, ChevronRight, Film, Music, Image as ImageIcon, Cpu,
  ShieldCheck, AlertTriangle, Lock, Play, RotateCcw, Mic, Users,
  Webhook, Copy, Menu,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { modelsApi, studioApiCalls, leadsApiCalls, agentsApiCalls, usageApi, adminApi, webhooksApi } from './api'
import { useAuth } from './AuthContext'

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
  blocked: T.clay, ok: T.teal, awaiting_review: T.violet };

/* ── mobile hook ───────────────────────────────────────────────────────── */
function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
}

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
  ["Script", "video", "write_script"], ["Characters", "video", "design_characters"],
  ["Keyframes", "video", "generate_keyframes"], ["Cast voices", "audio", "cast_voices"],
  ["Dialogue", "audio", "generate_dialogue"], ["Music", "audio", "generate_music"],
  ["Clips", "video", "generate_clips"], ["Assemble", "video", "assemble"],
  ["Render", "video", "render"], ["Mix", "audio", "mix_audio"], ["Mux", "audio", "mux"],
];

// Stages where a prompt override makes sense (AI-generated content)
const PROMPT_OVERRIDE_STAGES = new Set([
  "write_script", "design_characters", "generate_keyframes",
  "generate_clips", "generate_music",
]);

function SignalChain({ idx, running, failedIdx, stageStatuses = {} }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 0, minWidth: 720, padding: "6px 2px" }}>
        {STAGES.map(([label, lane, key], i) => {
          const liveStatus = stageStatuses[key];
          const isFailed = failedIdx !== undefined && i === failedIdx;
          let status;
          if (liveStatus === "awaiting_review") status = "awaiting_review";
          else if (isFailed) status = "blocked";
          else if (liveStatus === "done") status = "done";
          else if (liveStatus === "running") status = "running";
          else status = i < idx ? "done" : (i === idx && running ? "running" : "pending");
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
                  display: "grid", placeItems: "center",
                  position: "relative" }}>
                  <Lamp on={status !== "pending"} color={c} size={9}
                    className={status === "awaiting_review" ? "led-pulse" : ""} />
                  {status === "awaiting_review" && (
                    <span style={{ position: "absolute", top: -5, right: -5, width: 10, height: 10,
                      borderRadius: 99, background: T.violet, border: `2px solid ${T.ink}` }} />
                  )}
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

/* ── prompt inspector ──────────────────────────────────────────────────── */
function PromptBox({ label = "prompt sent to model", text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: "none", border: `1px solid ${T.line2}`, cursor: "pointer",
        font: `600 9px/1 ${mono}`, color: T.faint, letterSpacing: ".1em",
        textTransform: "uppercase", padding: "3px 8px", borderRadius: 4,
      }}>
        {open ? "▾" : "▸"} {label}
      </button>
      {open && (
        <pre style={{
          margin: "6px 0 0", padding: "10px 12px",
          background: T.ink, border: `1px solid ${T.line2}`, borderRadius: 6,
          font: `400 10px/1.6 ${mono}`, color: T.faint,
          whiteSpace: "pre-wrap", wordBreak: "break-word", overflowX: "auto",
        }}>{text}</pre>
      )}
    </div>
  );
}

/* ── stage review banner ───────────────────────────────────────────────── */
function StageReviewBanner({ project, stageName, onApprove, onReject, disabled }) {
  const [showOverride, setShowOverride] = useState(false);
  const [note, setNote] = useState("");
  const [override, setOverride] = useState("");

  const stageLabel = STAGES.find(([, , k]) => k === stageName)?.[0] ?? stageName.replace(/_/g, " ");
  const stageRecord = project?.stages?.find(s => s.name === stageName);
  const canOverride = PROMPT_OVERRIDE_STAGES.has(stageName);

  // Build a summary of what the stage produced (output + prompt inspector)
  const summary = (() => {
    if (!project) return null;
    const allShots = (project.episode?.scenes || []).flatMap(sc => sc.shots || []);

    if (stageName === "write_script") {
      const ep = project.episode;
      if (!ep) return null;
      const charNames = (project.characters || []).map(c => c.name).join(", ");
      return (
        <div style={{ display: "grid", gap: 6 }}>
          {ep.logline && <div style={{ font: `400 12px/1.5 ${sans}`, color: T.paper }}>{ep.logline}</div>}
          {charNames && <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>Characters: {charNames}</div>}
          <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>{allShots.length} shots across {(ep.scenes || []).length} scene(s)</div>
          <PromptBox text={project.script_prompt} />
        </div>
      );
    }

    if (stageName === "design_characters") {
      const chars = project.characters || [];
      return (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
            {chars.map(ch => (
              <div key={ch.name}>
                {ch.reference_uri
                  ? <img src={studioApiCalls.mediaUrl(ch.reference_uri)} alt={ch.name}
                         style={{ width: "100%", aspectRatio: "1", objectFit: "cover",
                                  borderRadius: 6, border: `1px solid ${T.line2}`, display: "block" }} />
                  : <div style={{ width: "100%", aspectRatio: "1", background: T.panel2, borderRadius: 6,
                                  display: "grid", placeItems: "center" }}>
                      <span style={{ font: `500 10px/1 ${mono}`, color: T.faint }}>no image</span>
                    </div>
                }
                <div style={{ font: `600 10px/1.3 ${sans}`, color: T.muted, marginTop: 5,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {ch.name}
                </div>
                <PromptBox label="image prompt" text={ch.image_prompt} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (stageName === "generate_keyframes") {
      const keyed = allShots.filter(s => s.keyframe_uri);
      return keyed.length === 0 ? null : (
        <div style={{ display: "grid", gap: 12 }}>
          {keyed.slice(0, 8).map((s, i) => (
            <div key={s.id} style={{ display: "grid", gap: 6 }}>
              <div style={{ position: "relative" }}>
                <img src={studioApiCalls.mediaUrl(s.keyframe_uri)} alt={`Shot ${i + 1}`}
                     style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover",
                              borderRadius: 6, border: `1px solid ${T.line2}`, display: "block" }} />
                <span style={{ position: "absolute", bottom: 4, left: 4,
                               font: `700 9px/1 ${mono}`, color: T.paper,
                               background: "rgba(0,0,0,0.65)", padding: "2px 5px", borderRadius: 3 }}>
                  S{i + 1}
                </span>
              </div>
              <PromptBox label={`shot ${i + 1} prompt`} text={s.keyframe_prompt} />
            </div>
          ))}
          {keyed.length > 8 && (
            <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>+{keyed.length - 8} more shots</div>
          )}
        </div>
      );
    }

    if (stageName === "cast_voices") {
      const cast = project.voice_cast || {};
      const entries = Object.entries(cast);
      return entries.length ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {entries.map(([char, voice]) => (
            <span key={char} style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>
              {char} <span style={{ color: T.violet }}>{voice}</span>
            </span>
          ))}
        </div>
      ) : null;
    }

    if (stageName === "generate_dialogue") {
      const withAudio = allShots.filter(s => s.dialogue_audio_uri);
      return withAudio.length === 0
        ? <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>{allShots.length} shot(s) · no audio yet</div>
        : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>{withAudio.length}/{allShots.length} shots with dialogue</div>
            {withAudio.slice(0, 3).map((s, i) => (
              <div key={s.id} style={{ display: "grid", gap: 4 }}>
                <div style={{ font: `400 11px/1.4 ${sans}`, color: T.faint }}>
                  {(s.dialogue || []).map(l => `${l.character}: ${l.text}`).join(" / ").slice(0, 100) || `Shot ${i + 1}`}
                </div>
                <audio controls src={studioApiCalls.mediaUrl(s.dialogue_audio_uri)} style={{ width: "100%" }} />
              </div>
            ))}
            {withAudio.length > 3 && <div style={{ font: `500 10px/1 ${mono}`, color: T.faint }}>+{withAudio.length - 3} more shots</div>}
          </div>
        );
    }

    if (stageName === "generate_music") {
      return (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>
            Music bed · {stageRecord?.model_used || "—"}
          </div>
          {project.music_uri && (
            <audio controls src={studioApiCalls.mediaUrl(project.music_uri)} style={{ width: "100%" }} />
          )}
          <PromptBox text={project.music_prompt} />
        </div>
      );
    }

    if (stageName === "generate_clips") {
      const clipped = allShots.filter(s => s.clip_uri);
      const realClips = clipped.filter(s => !s.clip_uri.endsWith(".json"));
      return (
        <div style={{ display: "grid", gap: 12 }}>
          {realClips.length > 0
            ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                {realClips.slice(0, 4).map(s => (
                  <video key={s.id} controls src={studioApiCalls.mediaUrl(s.clip_uri)}
                         style={{ width: "100%", borderRadius: 6, border: `1px solid ${T.line2}` }} />
                ))}
              </div>
            )
            : <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>
                {clipped.length} clip{clipped.length !== 1 ? "s" : ""} generated · mock renderer (no real video provider configured)
              </div>
          }
          {clipped[0]?.clip_prompt && <PromptBox label="clip prompt (shot 1)" text={clipped[0].clip_prompt} />}
        </div>
      );
    }

    if (stageName === "render") {
      return (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>Silent video rendered</div>
          {project.final_uri && (
            <video controls src={studioApiCalls.mediaUrl(project.final_uri)}
                   style={{ width: "100%", maxHeight: 280, borderRadius: 6,
                            border: `1px solid ${T.line2}` }} />
          )}
        </div>
      );
    }

    if (stageName === "mix_audio") {
      return (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>Dialogue + music mixed (ducked)</div>
          {project.master_audio_uri && (
            <audio controls src={studioApiCalls.mediaUrl(project.master_audio_uri)} style={{ width: "100%" }} />
          )}
        </div>
      );
    }

    if (stageName === "mux") {
      return (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>Final video with audio</div>
          {project.final_av_uri && (
            <video controls src={studioApiCalls.mediaUrl(project.final_av_uri)}
                   style={{ width: "100%", maxHeight: 280, borderRadius: 6,
                            border: `1px solid ${T.line2}` }} />
          )}
        </div>
      );
    }

    return <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>Stage complete</div>;
  })();

  function handleApprove() {
    onApprove(stageName, note);
    setNote(""); setOverride(""); setShowOverride(false);
  }
  function handleReject() {
    onReject(stageName, override, note);
    setNote(""); setOverride(""); setShowOverride(false);
  }

  return (
    <Panel style={{ padding: 16, border: `1px solid ${T.violet}55`, background: `${T.violet}08` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap", marginBottom: summary ? 14 : 0 }}>
        <div>
          <Eyebrow color={T.violet}>awaiting review · {stageLabel}</Eyebrow>
          {stageRecord?.cost_usd > 0 && (
            <div style={{ font: `500 10px/1 ${mono}`, color: T.faint, marginTop: 4 }}>
              ${stageRecord.cost_usd.toFixed(4)} · {stageRecord.model_used}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Btn kind="ok" icon={Check} onClick={handleApprove} disabled={disabled}>
            {disabled ? "Running…" : "Approve & continue"}
          </Btn>
          {canOverride && (
            <Btn kind="danger" icon={X} onClick={() => setShowOverride(o => !o)} disabled={disabled}>
              Reject & refine
            </Btn>
          )}
          {!canOverride && (
            <Btn kind="danger" icon={X} onClick={handleReject} disabled={disabled}>
              {disabled ? "Running…" : "Reject & redo"}
            </Btn>
          )}
        </div>
      </div>
      {summary && <div style={{ marginBottom: showOverride ? 14 : 0 }}>{summary}</div>}
      {showOverride && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <div>
            <label style={{ font: `500 10px/1 ${mono}`, color: T.muted }}>
              Revision instructions (appended to the prompt on retry)
            </label>
            <textarea
              value={override}
              onChange={e => setOverride(e.target.value)}
              placeholder={`e.g. "Make the characters more expressive and add more visual detail to each shot description"`}
              rows={3}
              style={{ display: "block", width: "100%", marginTop: 6, background: T.ink,
                color: T.paper, border: `1px solid ${T.line2}`, borderRadius: 7,
                padding: "10px 12px", font: `400 12px/1.5 ${sans}`,
                boxSizing: "border-box", resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn kind="danger" icon={RotateCcw} onClick={handleReject} disabled={disabled}>
              {disabled ? "Running…" : "Reject & re-run stage"}
            </Btn>
            <Btn onClick={() => setShowOverride(false)}>Cancel</Btn>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ── mock data (mirrors the real API shapes) ──────────────────────────── */
const GENRES = ["drama", "romance", "comedy", "kids_cartoon"];
const LEADS = [
  { id: "mock-1", name: "Dana Reyes", company: "SolarBright", region: "US", score: 90, status: "qualified", note: "VP Marketing · legitimate interest" },
  { id: "mock-2", name: "Marcus Lee", company: "Helios Co", region: "US", score: 90, status: "qualified", note: "Head of Growth · opt-in" },
  { id: "mock-3", name: "Liam Walsh", company: "EireWind", region: "IE", score: 85, status: "qualified", note: "CMO · opt-in (EU)" },
  { id: "mock-4", name: "Sofia Klein", company: "GrünPower", region: "DE", score: 85, status: "blocked", note: "DE requires explicit opt-in" },
  { id: "mock-5", name: "Tom Becker", company: "WattWorks", region: "US", score: 55, status: "blocked", note: "no lawful basis (unknown consent)" },
  { id: "mock-6", name: "Ava Stone", company: "SunPeak", region: "US", score: 75, status: "blocked", note: "invalid or missing email" },
  { id: "mock-7", name: "Priya Nair", company: "DentalPlus", region: "US", score: 15, status: "disqualified", note: "off-ICP (healthcare)" },
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

function Dashboard({ go, studioIdx, studioRunning, pending, usageData, livePending, leadsForStats, isMobile }) {
  const allLeads = leadsForStats && leadsForStats.length ? leadsForStats : LEADS;
  const sourced = allLeads.length;
  const qualified = allLeads.filter(l => l.status === 'qualified').length;
  const contactable = allLeads.filter(l => l.status === 'qualified' || (l.status !== 'blocked' && l.status !== 'disqualified')).length;

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

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
        <Panel style={{ padding: 18, display: "flex", gap: 12 }}>
          <Stat label="lead funnel" value={String(sourced)} sub="sourced" />
          <Stat label="qualified" value={String(qualified)} color={T.teal} sub="≥ threshold" />
          <Stat label="contactable" value={String(contactable)} color={T.amber} sub="post-compliance" />
        </Panel>
        <Panel style={{ padding: 18 }} >
          <Eyebrow>needs you</Eyebrow>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <div style={{ font: `700 26px/1 ${sans}`, color: (livePending ?? pending) ? T.clay : T.teal }}>{livePending ?? pending}</div>
            <div style={{ font: `500 12px/1 ${mono}`, color: T.muted }}>outreach approvals</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <Btn kind={(livePending ?? pending) ? "danger" : "ghost"} icon={ShieldCheck} onClick={() => go("leads")}>
              Open approval inbox</Btn></div>
        </Panel>
        <Panel style={{ padding: 18, display: "flex", gap: 12 }}>
          <Stat label="run cost" value={`$${usageData?.total_cost_usd?.toFixed(2) ?? '0.00'}`} color={T.teal} sub="free models" />
          <Stat label="models" value="9" sub="6 free · routable" />
        </Panel>
      </div>
    </div>
  );
}

function Studio({ genre, setGenre, idx, running, run, reset, resume, hasFailed, failedStage,
  concept, setConcept, reviewMode, setReviewMode, awaitingStageName, activeProject,
  onApproveStage, onRejectStage, onTrack, isMobile }) {
  const kids = genre === "kids_cartoon";

  // Build a map of stage key -> status from live project data
  const stageStatuses = {};
  (activeProject?.stages || []).forEach(s => { stageStatuses[s.name] = s.status; });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {hasFailed && failedStage && (
        <Panel style={{ padding: 14, border: `1px solid ${T.clay}55` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <Eyebrow color={T.clay}>stage failed — {failedStage.name.replace(/_/g, ' ')}</Eyebrow>
              {failedStage.error && (
                <div style={{ font: `400 11px/1.4 ${mono}`, color: T.muted, marginTop: 4, maxWidth: 500 }}>
                  {failedStage.error.slice(0, 200)}
                </div>
              )}
            </div>
            <Btn kind="ok" icon={Play} onClick={resume} disabled={running}>
              {running ? "Resuming…" : "Resume pipeline"}
            </Btn>
          </div>
        </Panel>
      )}

      {awaitingStageName && activeProject && (
        <StageReviewBanner
          project={activeProject}
          stageName={awaitingStageName}
          onApprove={onApproveStage}
          onReject={onRejectStage}
          disabled={running}
        />
      )}

      <Panel style={{ padding: 18 }}>
        <Eyebrow color={T.amber}>new episode</Eyebrow>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px" }}>
            <label style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>Concept</label>
            <input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              style={{ width: "100%", marginTop: 6, background: T.ink, color: T.paper,
                border: `1px solid ${T.line2}`, borderRadius: 7, padding: "10px 12px",
                font: `400 13px/1 ${sans}`, boxSizing: "border-box" }} />
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
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>Review mode</label>
            <button onClick={() => setReviewMode(r => !r)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent",
                border: "none", cursor: "pointer", padding: "10px 0" }}>
              <span style={{ width: 34, height: 18, borderRadius: 99, padding: 2,
                background: reviewMode ? `${T.violet}55` : T.line2, transition: "all .2s",
                display: "flex", justifyContent: reviewMode ? "flex-end" : "flex-start" }}>
                <span style={{ width: 14, height: 14, borderRadius: 99,
                  background: reviewMode ? T.violet : T.muted }} /></span>
              <span style={{ font: `600 10px/1 ${mono}`, color: reviewMode ? T.violet : T.faint,
                letterSpacing: ".1em", textTransform: "uppercase" }}>
                {reviewMode ? "on" : "off"}
              </span>
            </button>
          </div>
          <Btn kind="primary" icon={running ? RotateCcw : Play}
            onClick={running ? undefined : run} disabled={running || !!awaitingStageName}>
            {running ? "Running…" : "Run pipeline"}</Btn>
          <Btn icon={RotateCcw} onClick={reset}>Reset</Btn>
        </div>
        {reviewMode && !running && !awaitingStageName && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8,
            font: `500 11px/1.4 ${mono}`, color: T.violet }}>
            <ShieldCheck size={12} /> Pipeline will pause after each stage for your review before proceeding.
          </div>
        )}
        {kids && <div style={{ marginTop: reviewMode ? 6 : 12, display: "flex", alignItems: "center", gap: 8,
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
        <SignalChain idx={idx} running={running} stageStatuses={stageStatuses}
          failedIdx={failedStage ? STAGES.findIndex(([, , k]) => k === failedStage.name) : undefined} />
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
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
      <ProjectsGallery onTrack={onTrack} />
    </div>
  );
}

function ProjectsGallery({ onTrack }) {
  const [playing, setPlaying] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['all-projects'],
    queryFn: () => studioApiCalls.listProjects(20, 0),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const projects = data?.items || [];
  const done = projects.filter(p => p.status === 'done' || p.final_av_uri || p.final_uri);

  return (
    <Panel style={{ padding: 18 }}>
      <Eyebrow><Film size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;episode library · {projects.length} project{projects.length !== 1 ? 's' : ''}</Eyebrow>
      {isLoading && <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint, marginTop: 10 }}>Loading…</div>}
      {!isLoading && projects.length === 0 && (
        <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint, marginTop: 10 }}>No projects yet. Run a pipeline above.</div>
      )}
      {playing && (
        <div style={{ marginTop: 14, background: T.ink, borderRadius: 8, overflow: 'hidden',
          border: `1px solid ${T.line2}`, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', borderBottom: `1px solid ${T.line2}` }}>
            <div style={{ font: `600 12px/1 ${sans}`, color: T.paper }}>{playing.title}</div>
            <button onClick={() => setPlaying(null)} style={{ background: 'none', border: 'none',
              cursor: 'pointer', color: T.muted }}>
              <X size={16} />
            </button>
          </div>
          <video controls autoPlay style={{ width: '100%', maxHeight: 360, background: '#000' }}
            src={studioApiCalls.videoUrl(playing.id)}>
            Your browser does not support the video tag.
          </video>
        </div>
      )}
      <div style={{ marginTop: 12, display: 'grid', gap: 1 }}>
        {projects.map(p => {
          const isDone = p.final_av_uri || p.final_uri || p.status === 'done';
          const hasFail = p.stages?.some(s => s.status === 'failed');
          const isRunning = p.stages?.some(s => s.status === 'running');
          const isAwaiting = p.stages?.some(s => s.status === 'awaiting_review');
          const stageDone = p.stages?.filter(s => s.status === 'done').length ?? 0;
          const stageTotal = p.stages?.length ?? 11;
          const pillStatus = isDone ? 'done' : hasFail ? 'blocked' : isRunning ? 'running' : isAwaiting ? 'awaiting_review' : 'pending';
          const pillLabel = isDone ? 'done' : hasFail ? 'failed' : isRunning ? 'running' : isAwaiting ? 'review' : 'pending';
          return (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto',
              gap: 10, alignItems: 'center', padding: '9px 0',
              borderTop: `1px solid ${T.line}` }}>
              <div>
                <div style={{ font: `600 13px/1.2 ${sans}`, color: T.paper }}>
                  {p.title || p.id}
                </div>
                <div style={{ font: `500 10px/1 ${mono}`, color: T.faint, marginTop: 2 }}>
                  {p.genre} · ${(p.total_cost_usd || 0).toFixed(3)} · {stageDone}/{stageTotal} stages
                  {p.review_mode && <span style={{ color: T.violet }}> · review mode</span>}
                </div>
              </div>
              <Pill status={pillStatus} label={pillLabel} />
              {isDone && (
                <Btn kind="ok" icon={Play} onClick={() => setPlaying(p)}>Watch</Btn>
              )}
              {!isDone && (isRunning || isAwaiting || hasFail) && onTrack && (
                <Btn kind="ghost" icon={Radio} onClick={() => onTrack(p.id)}>Track</Btn>
              )}
              {!isDone && !isRunning && !isAwaiting && !hasFail && <span />}
              <span style={{ font: `500 10px/1 ${mono}`, color: T.faint, fontSize: 9 }}>
                {p.id.slice(0, 8)}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Leads({ approvals, decide, displayLeads, refetchLeads, isMobile }) {
  const pending = approvals.filter((a) => a.status === "pending");
  const leadsToShow = displayLeads && displayLeads.length ? displayLeads : LEADS;

  const qualified = leadsToShow.filter(l => l.status === 'qualified').length;
  const blocked = leadsToShow.filter(l => l.status === 'blocked').length;
  const contactable = leadsToShow.filter(l => l.status === 'qualified' || (l.status !== 'blocked' && l.status !== 'disqualified')).length;

  async function handleSource() {
    try { await leadsApiCalls.source(20); refetchLeads(); } catch (e) { /* ignore */ }
  }
  async function handleQualify() {
    try { await leadsApiCalls.qualify(); refetchLeads(); } catch (e) { /* ignore */ }
  }
  async function handleCompliance() {
    try { await leadsApiCalls.compliance(); refetchLeads(); } catch (e) { /* ignore */ }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr", gap: 16 }}>
      <div style={{ display: "grid", gap: 16 }}>
        <Panel style={{ padding: 18 }}>
          <Eyebrow><Target size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;leads · ICP: renewable energy</Eyebrow>
          <div style={{ marginTop: 12, display: "grid", gap: 1 }}>
            {leadsToShow.map((l) => (
              <div key={l.id || l.name} style={{ display: "grid", gridTemplateColumns: "1.2fr auto auto",
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
            <Stat label="qualified" value={String(qualified)} color={T.teal} />
            <Stat label="blocked by compliance" value={String(blocked)} color={T.clay} sub="opt-in · consent · email" />
            <Stat label="contactable" value={String(contactable)} color={T.amber} />
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn kind="ghost" onClick={handleSource}>Source leads</Btn>
            <Btn kind="ghost" onClick={handleQualify}>Qualify</Btn>
            <Btn kind="ghost" onClick={handleCompliance}>Compliance</Btn>
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

function Models({ routing, setRouting, freeOnly, setFreeOnly, providers = PROVIDERS, isMobile }) {
  const byMod = (m) => providers.filter((p) => p.mod === m);
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
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
          {providers.map((p) => {
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

/* ── Admin ─────────────────────────────────────────────────────────────── */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ background: "transparent", border: `1px solid ${T.line2}`, color: copied ? T.teal : T.muted,
        borderRadius: 5, padding: "4px 8px", cursor: "pointer", font: `600 10px/1 ${mono}`,
        display: "inline-flex", alignItems: "center", gap: 5 }}>
      <Copy size={11} />{copied ? "copied" : "copy"}</button>
  );
}

function Admin() {
  const qc = useQueryClient();
  const { data: tenantsData, isLoading } = useQuery({
    queryKey: ['tenants'], queryFn: adminApi.listTenants, staleTime: 15_000,
  });
  const { data: hooksData, refetch: refetchHooks } = useQuery({
    queryKey: ['webhooks'], queryFn: webhooksApi.list, staleTime: 15_000,
  });

  const [form, setForm] = useState({ name: "", email: "", password: "", plan: "free" });
  const [newKey, setNewKey] = useState(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  const [hookForm, setHookForm] = useState({ url: "", events: "run.done,run.failed", secret: "" });
  const [hookErr, setHookErr] = useState("");

  async function handleCreate(e) {
    e.preventDefault();
    setErr(""); setCreating(true);
    try {
      const res = await adminApi.createTenant(form.name, form.email, form.password, form.plan);
      setNewKey(res);
      setForm({ name: "", email: "", password: "", plan: "free" });
      qc.invalidateQueries(['tenants']);
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "creation failed");
    } finally { setCreating(false); }
  }

  async function handleAddHook(e) {
    e.preventDefault();
    setHookErr("");
    const events = hookForm.events.split(",").map(s => s.trim()).filter(Boolean);
    try {
      await webhooksApi.register(hookForm.url, events, hookForm.secret);
      setHookForm({ url: "", events: "run.done,run.failed", secret: "" });
      refetchHooks();
    } catch (ex) {
      setHookErr(ex?.response?.data?.detail || "registration failed");
    }
  }

  async function removeHook(id) {
    await webhooksApi.remove(id);
    refetchHooks();
  }

  const tenants = tenantsData?.tenants || [];
  const hooks = hooksData?.webhooks || [];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* tenant list */}
      <Panel style={{ padding: 18 }}>
        <Eyebrow color={T.amber}><Users size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;tenants · {tenants.length} total</Eyebrow>
        {isLoading && <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint, marginTop: 10 }}>Loading…</div>}
        {!isLoading && tenants.length === 0 && (
          <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint, marginTop: 10 }}>No tenants yet. Create one below.</div>
        )}
        {tenants.length > 0 && (
          <div style={{ marginTop: 12, display: "grid", gap: 1 }}>
            {tenants.map(t => (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto",
                gap: 12, alignItems: "center", padding: "9px 0", borderTop: `1px solid ${T.line}` }}>
                <div>
                  <div style={{ font: `600 13px/1.2 ${sans}`, color: T.paper }}>{t.name}</div>
                  <div style={{ font: `500 10px/1 ${mono}`, color: T.faint, marginTop: 2 }}>{t.id}</div>
                </div>
                <span style={{ font: `600 9px/1 ${mono}`, color: t.plan === "free" ? T.teal : T.amber,
                  background: `${t.plan === "free" ? T.teal : T.amber}1A`,
                  border: `1px solid ${(t.plan === "free" ? T.teal : T.amber)}44`,
                  padding: "3px 6px", borderRadius: 4, textTransform: "uppercase" }}>{t.plan}</span>
                <div style={{ font: `500 10px/1 ${mono}`, color: T.muted }}>
                  ${t.cost_cap_usd} cap</div>
                <div style={{ font: `500 10px/1 ${mono}`, color: T.muted }}>
                  {t.job_cap} jobs</div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* new API key display */}
      {newKey && (
        <Panel style={{ padding: 18, border: `1px solid ${T.teal}55` }}>
          <Eyebrow color={T.teal}>tenant created</Eyebrow>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <div style={{ font: `500 11px/1.4 ${mono}`, color: T.muted }}>
              Tenant ID: <span style={{ color: T.paper }}>{newKey.tenant_id}</span>
            </div>
            <div style={{ background: T.ink, border: `1px solid ${T.line2}`, borderRadius: 7,
              padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ font: `500 11px/1 ${mono}`, color: T.amber, wordBreak: "break-all" }}>{newKey.api_key}</div>
              <CopyBtn text={newKey.api_key} />
            </div>
            <div style={{ font: `400 10px/1.4 ${mono}`, color: T.clay }}>{newKey.note}</div>
            <Btn kind="ghost" onClick={() => setNewKey(null)}>Dismiss</Btn>
          </div>
        </Panel>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* create tenant form */}
        <Panel style={{ padding: 18 }}>
          <Eyebrow>create tenant</Eyebrow>
          <form onSubmit={handleCreate} style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {[["Org name", "name", "text", "Acme Corp"],
              ["Admin email", "email", "email", "admin@acme.com"],
              ["Password", "password", "password", "••••••••"]].map(([label, key, type, ph]) => (
              <div key={key}>
                <label style={{ font: `500 10px/1 ${mono}`, color: T.muted }}>{label}</label>
                <input type={type} placeholder={ph} required value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ display: "block", width: "100%", marginTop: 5, background: T.ink,
                    color: T.paper, border: `1px solid ${T.line2}`, borderRadius: 6,
                    padding: "9px 10px", font: `400 12px/1 ${sans}`, boxSizing: "border-box" }} />
              </div>
            ))}
            <div>
              <label style={{ font: `500 10px/1 ${mono}`, color: T.muted }}>Plan</label>
              <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                style={{ display: "block", width: "100%", marginTop: 5, background: T.ink, color: T.paper,
                  border: `1px solid ${T.line2}`, borderRadius: 6, padding: "9px 10px",
                  font: `500 12px/1 ${mono}` }}>
                <option value="free">free</option>
                <option value="paid">paid</option>
              </select>
            </div>
            {err && <div style={{ font: `500 11px/1 ${mono}`, color: T.clay }}>{err}</div>}
            <Btn kind="primary" disabled={creating}>{creating ? "Creating…" : "Create tenant"}</Btn>
          </form>
        </Panel>

        {/* webhook management */}
        <Panel style={{ padding: 18 }}>
          <Eyebrow><Webhook size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;webhooks</Eyebrow>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {hooks.length === 0 && <div style={{ font: `400 11px/1.4 ${sans}`, color: T.faint }}>No webhooks registered.</div>}
            {hooks.map(h => (
              <div key={h.id} style={{ background: T.panel2, border: `1px solid ${T.line2}`,
                borderRadius: 7, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ font: `500 11px/1.4 ${mono}`, color: T.paper, wordBreak: "break-all" }}>{h.url}</div>
                  <button onClick={() => removeHook(h.id)} style={{ background: "none",
                    border: "none", cursor: "pointer", color: T.clay, padding: "0 0 0 8px", flexShrink: 0 }}>
                    <X size={13} /></button>
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                  {h.events.map(ev => (
                    <span key={ev} style={{ font: `500 9px/1 ${mono}`, color: T.violet,
                      background: `${T.violet}1A`, border: `1px solid ${T.violet}44`,
                      padding: "2px 6px", borderRadius: 4 }}>{ev}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddHook} style={{ marginTop: 14, display: "grid", gap: 8 }}>
            <Eyebrow color={T.faint}>add webhook</Eyebrow>
            {[["URL", "url", "https://yourapp.com/webhook"],
              ["Events (comma-separated)", "events", "run.done,run.failed"],
              ["Secret (optional)", "secret", ""]].map(([label, key, ph]) => (
              <div key={key}>
                <label style={{ font: `500 10px/1 ${mono}`, color: T.muted }}>{label}</label>
                <input placeholder={ph} value={hookForm[key]}
                  onChange={e => setHookForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ display: "block", width: "100%", marginTop: 4, background: T.ink,
                    color: T.paper, border: `1px solid ${T.line2}`, borderRadius: 6,
                    padding: "8px 10px", font: `400 12px/1 ${sans}`, boxSizing: "border-box" }} />
              </div>
            ))}
            {hookErr && <div style={{ font: `500 11px/1 ${mono}`, color: T.clay }}>{hookErr}</div>}
            <Btn kind="ghost">Register webhook</Btn>
          </form>
        </Panel>
      </div>
    </div>
  );
}

/* ── shell ────────────────────────────────────────────────────────────── */
const NAV = [["dashboard", LayoutDashboard, "Dashboard"], ["studio", Clapperboard, "Studio"],
  ["leads", Target, "Leads"], ["models", SlidersHorizontal, "Models"]];

export default function PlatformConsole({ onLoginRequest }) {
  const isMobile = useIsMobile();
  const [view, setView] = useState("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [genre, setGenre] = useState("kids_cartoon");
  const [concept, setConcept] = useState("A shy turtle learns to share with forest friends");
  const [idx, setIdx] = useState(STAGES.length);   // start "complete"
  const [running, setRunning] = useState(false);
  const [studioProjectId, setStudioProjectId] = useState(
    () => localStorage.getItem('studio_active_project') || null
  );
  const [routing, setRouting] = useState({});
  const qc = useQueryClient();
  const { isLoggedIn, logout, user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [reviewMode, setReviewMode] = useState(false);
  const [reviewPending, setReviewPending] = useState(false);

  const { data: providersData } = useQuery({ queryKey: ['providers'], queryFn: modelsApi.getProviders, staleTime: 60_000 });
  const { data: routingConfig } = useQuery({ queryKey: ['routing-config'], queryFn: modelsApi.getConfig, staleTime: 30_000 });
  const { data: leadsData, refetch: refetchLeads } = useQuery({ queryKey: ['leads'], queryFn: () => leadsApiCalls.list({ limit: 100 }), staleTime: 15_000 });
  const { data: runsData } = useQuery({ queryKey: ['agent-runs'], queryFn: () => agentsApiCalls.listRuns({ limit: 50 }), staleTime: 10_000, refetchInterval: 15_000 });
  const { data: usageData } = useQuery({ queryKey: ['usage'], queryFn: usageApi.get, staleTime: 30_000 });

  // Studio project polling
  const { data: activeProject } = useQuery({
    queryKey: ['studio-project', studioProjectId],
    queryFn: () => studioApiCalls.getProject(studioProjectId),
    enabled: !!studioProjectId,
    refetchInterval: (running || reviewPending) ? 2000 : (studioProjectId ? 5000 : false),
  });

  // Sync stage index from live project data
  useEffect(() => {
    if (!activeProject) return;
    const stages = activeProject.stages || [];
    const done = stages.filter(s => s.status === 'done').length;
    setIdx(done);
    const anyFailed = stages.some(s => s.status === 'failed');
    const anyAwaiting = stages.some(s => s.status === 'awaiting_review');
    setReviewPending(anyAwaiting);
    const allDone = done >= STAGES.length;
    if (allDone || anyFailed || anyAwaiting) {
      setRunning(false);
    }
  }, [activeProject]);

  const approveMutation = useMutation({ mutationFn: ({ runId }) => agentsApiCalls.approve(runId), onSuccess: () => qc.invalidateQueries(['agent-runs']) });
  const rejectMutation  = useMutation({ mutationFn: ({ runId }) => agentsApiCalls.reject(runId),  onSuccess: () => qc.invalidateQueries(['agent-runs']) });

  const liveProviders = providersData?.providers?.length ? providersData.providers : PROVIDERS;

  // Map API lead items to display shape
  const mappedLiveLeads = leadsData?.items?.length
    ? leadsData.items.map(item => ({
        id: item.id,
        name: item.name,
        company: item.company,
        region: item.region,
        score: item.score,
        status: item.status,
        note: item.reasons?.join(' · ') || item.email || '',
      }))
    : null;

  const livePending = runsData?.items ? runsData.items.filter(r => r.status === 'awaiting_approval').length : null;
  const liveRuns = runsData?.items || [];

  const [freeOnly, setFreeOnly] = useState(true);
  const [approvals, setApprovals] = useState([
    { id: 1, to: "dana@solarbright.com", subject: "Quick question, Dana",
      body: "Hi Dana, I came across SolarBright and thought our work might be relevant. Open to a quick chat? Reply STOP and I won't follow up.", status: "pending" },
    { id: 2, to: "marcus@helios.co", subject: "Quick question, Marcus",
      body: "Hi Marcus, saw what Helios Co is building — worth a short call? Reply STOP to opt out.", status: "pending" },
    { id: 3, to: "liam@eirewind.ie", subject: "Quick question, Liam",
      body: "Hi Liam, EireWind caught my eye. Open to connecting? Reply STOP to opt out.", status: "sent" },
  ]);

  // Build live approvals from agent runs awaiting approval
  const liveApprovals = liveRuns
    .filter(r => r.status === 'awaiting_approval' && r.pending?.tool === 'send_email')
    .map(r => ({
      id: r.id,
      to: r.pending?.args?.to || '',
      subject: r.pending?.args?.subject || '(no subject)',
      body: r.pending?.args?.body || '',
      status: 'pending',
    }));

  // Use live approvals if available, else fall back to local state
  const displayApprovals = liveApprovals.length > 0 ? liveApprovals : approvals;

  const hasFailed = activeProject?.stages?.some(s => s.status === 'failed') ?? false;
  const failedStage = activeProject?.stages?.find(s => s.status === 'failed') ?? null;
  const awaitingStageName = activeProject?.awaiting_review_stage ?? null;

  async function run() {
    setRunning(true);
    setIdx(0);
    setReviewPending(false);
    try {
      const { id } = await studioApiCalls.createProject(concept, genre, reviewMode);
      localStorage.setItem('studio_active_project', id);
      setStudioProjectId(id);
      await studioApiCalls.runProject(id, { background: true });
    } catch (e) {
      setRunning(false);
    }
  }

  async function resume() {
    if (!studioProjectId) return;
    setRunning(true);
    try {
      await studioApiCalls.runProject(studioProjectId, { background: true });
    } catch (e) {
      setRunning(false);
    }
  }

  function reset() {
    setRunning(false);
    setReviewPending(false);
    setIdx(0);
    localStorage.removeItem('studio_active_project');
    setStudioProjectId(null);
  }

  function trackProject(id) {
    localStorage.setItem('studio_active_project', id);
    setStudioProjectId(id);
    setView('studio');
  }

  async function approveStage(stageName, note = '') {
    if (!studioProjectId) return;
    setRunning(true);
    setReviewPending(false);
    try {
      await studioApiCalls.approveStage(studioProjectId, stageName, note);
      qc.invalidateQueries(['studio-project', studioProjectId]);
    } catch (e) {
      setRunning(false);
    }
  }

  async function rejectStage(stageName, promptOverride = '', note = '') {
    if (!studioProjectId) return;
    setRunning(true);
    setReviewPending(false);
    try {
      await studioApiCalls.rejectStage(studioProjectId, stageName, promptOverride, note);
      qc.invalidateQueries(['studio-project', studioProjectId]);
    } catch (e) {
      setRunning(false);
    }
  }

  function decide(id, status) {
    // If id looks like a real run id (hex string / uuid), use mutations
    const isRealRunId = typeof id === 'string' && /^[0-9a-f-]{8,}$/i.test(id);
    if (isRealRunId) {
      if (status === 'sent') {
        approveMutation.mutate({ runId: id });
      } else {
        rejectMutation.mutate({ runId: id });
      }
    } else {
      setApprovals((a) => a.map((x) => x.id === id ? { ...x, status } : x));
    }
  }

  const localPending = approvals.filter((a) => a.status === "pending").length;
  const pending = livePending ?? localPending;
  const onair = running || pending > 0 || reviewPending;

  const allNavItems = [...NAV, ...(isAdmin ? [["admin", Users, "Admin"]] : [])];

  return (
    <div style={{ background: T.ink, color: T.paper, font: `400 14px/1.5 ${sans}`,
      minHeight: 640, display: "flex", flexDirection: isMobile ? "column" : "row",
      borderRadius: 12, overflow: "hidden", border: `1px solid ${T.line}` }}>
      <style>{`
        .led-pulse{animation:led 1.4s ease-in-out infinite}
        @keyframes led{0%,100%{opacity:1}50%{opacity:.45}}
        @media (prefers-reduced-motion: reduce){.led-pulse{animation:none}}
        select:focus,input:focus,button:focus-visible{outline:2px solid ${T.amber};outline-offset:1px}
        ::selection{background:${T.amber}44}
      `}</style>

      {/* sidebar / top bar */}
      {isMobile ? (
        <nav style={{ width: "100%", background: T.panel, borderBottom: `1px solid ${T.line}`,
          padding: "10px 16px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ font: `800 13px/1 ${mono}`, letterSpacing: "0.04em", color: T.paper }}>
              STUDIO<span style={{ color: T.amber }}>//</span>OPS</div>
            <button onClick={() => setNavOpen(o => !o)} style={{ background: "transparent",
              border: "none", cursor: "pointer", color: T.paper, padding: 4 }}>
              {navOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
          {navOpen && (
            <div style={{ display: "flex", gap: 4, marginTop: 10, overflowX: "auto", paddingBottom: 4 }}>
              {allNavItems.map(([k, Ic, label]) => (
                <button key={k} onClick={() => { setView(k); setNavOpen(false); }} style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "8px 12px",
                  borderRadius: 7, border: "none", cursor: "pointer", flexShrink: 0,
                  background: view === k ? T.raised : "transparent",
                  color: view === k ? T.paper : T.muted,
                  font: `600 12px/1 ${sans}` }}>
                  <Ic size={14} /> {label}
                  {k === "leads" && pending > 0 && <span style={{ font: `700 9px/1 ${mono}`,
                    color: T.ink, background: T.clay, borderRadius: 99, padding: "2px 6px" }}>{pending}</span>}
                </button>
              ))}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", padding: "0 4px" }}>
                {isLoggedIn
                  ? <button onClick={logout} style={{ background: 'none', border: `1px solid #3C3227`, color: '#7D715E', padding: '3px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 10, fontFamily: mono, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>LOGOUT</button>
                  : <button onClick={onLoginRequest} style={{ background: '#E8A33D', border: 'none', color: '#14110E', padding: '3px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 10, fontFamily: mono, letterSpacing: '0.04em', fontWeight: 700, whiteSpace: 'nowrap' }}>SIGN IN</button>
                }
              </div>
            </div>
          )}
        </nav>
      ) : (
        <nav style={{ width: 180, background: T.panel, borderRight: `1px solid ${T.line}`,
          padding: 16, display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          <div style={{ font: `800 13px/1 ${mono}`, letterSpacing: "0.04em", color: T.paper,
            padding: "4px 8px 16px" }}>STUDIO<span style={{ color: T.amber }}>//</span>OPS</div>
          {allNavItems.map(([k, Ic, label]) => (
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
          <div style={{ padding: "8px 8px 4px" }}>
            {isLoggedIn
              ? <button onClick={logout} style={{ background: 'none', border: `1px solid #3C3227`, color: '#7D715E', padding: '3px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 10, fontFamily: mono, letterSpacing: '0.04em' }}>LOGOUT</button>
              : <button onClick={onLoginRequest} style={{ background: '#E8A33D', border: 'none', color: '#14110E', padding: '3px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 10, fontFamily: mono, letterSpacing: '0.04em', fontWeight: 700 }}>SIGN IN</button>
            }
          </div>
        </nav>
      )}

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
              <span style={{ color: T.teal }}>${usageData?.total_cost_usd?.toFixed(2) ?? '0.00'}</span> · {freeOnly ? "free models" : "paid allowed"}</div>
          </div>
        </header>
        <main style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {view === "dashboard" && (
            <Dashboard
              go={setView}
              studioIdx={idx}
              studioRunning={running}
              pending={pending}
              usageData={usageData}
              livePending={livePending}
              leadsForStats={mappedLiveLeads}
              isMobile={isMobile}
            />
          )}
          {view === "studio" && (
            <Studio
              genre={genre}
              setGenre={setGenre}
              idx={idx}
              running={running}
              run={run}
              reset={reset}
              resume={resume}
              hasFailed={hasFailed}
              failedStage={failedStage}
              concept={concept}
              setConcept={setConcept}
              reviewMode={reviewMode}
              setReviewMode={setReviewMode}
              awaitingStageName={awaitingStageName}
              activeProject={activeProject}
              onApproveStage={approveStage}
              onRejectStage={rejectStage}
              onTrack={trackProject}
              isMobile={isMobile}
            />
          )}
          {view === "leads" && (
            <Leads
              approvals={displayApprovals}
              decide={decide}
              displayLeads={mappedLiveLeads}
              refetchLeads={refetchLeads}
              isMobile={isMobile}
            />
          )}
          {view === "models" && (
            <Models
              routing={routing}
              setRouting={setRouting}
              freeOnly={freeOnly}
              setFreeOnly={setFreeOnly}
              providers={liveProviders}
              isMobile={isMobile}
            />
          )}
          {view === "admin" && isAdmin && <Admin />}
        </main>
      </div>
    </div>
  );
}
