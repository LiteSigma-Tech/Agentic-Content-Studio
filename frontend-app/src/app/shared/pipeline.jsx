import React, { useState } from "react";
import PropTypes from "prop-types";
import { Check, X, RotateCcw } from "lucide-react";
import { T, mono, sans, SC, Eyebrow, Lamp, Panel, Btn } from "./ui";
import { studioApiCalls } from "../../api";

// Ported verbatim from PlatformConsole.jsx — the 11-stage pipeline, in
// order, tagged by lane. This is the single source of truth for stage
// order/labels/lanes; studio/ and audio/ pages both import from here
// instead of each hand-maintaining their own copy.
export const STAGES = [
  ["Script", "video", "write_script"], ["Characters", "video", "design_characters"],
  ["Keyframes", "video", "generate_keyframes"], ["Cast voices", "audio", "cast_voices"],
  ["Dialogue", "audio", "generate_dialogue"], ["Music", "audio", "generate_music"],
  ["Clips", "video", "generate_clips"], ["Assemble", "video", "assemble"],
  ["Render", "video", "render"], ["Mix", "audio", "mix_audio"], ["Mux", "audio", "mux"],
];

// Stages where a prompt override makes sense (AI-generated content)
export const PROMPT_OVERRIDE_STAGES = new Set([
  "write_script", "design_characters", "generate_keyframes",
  "generate_clips", "generate_music",
]);

export const GENERIC_STAGES = [
   "ingest", "research", "script", "voiceover", "visuals",
   "music", "edit", "render", "review", "export", "publish",
 ];

// Shared prop-type shapes for the `project` object passed to SignalChain
// and StageReviewBanner. Kept loose (most fields optional) since callers
// pass partially-loaded projects while a fetch is still in flight.
const stagePropType = PropTypes.shape({
  name: PropTypes.string,
  status: PropTypes.oneOf(["pending", "running", "done", "failed", "awaiting_review"]),
  cost_usd: PropTypes.number,
  model_used: PropTypes.string,
});

const shotPropType = PropTypes.shape({
  keyframe_uri: PropTypes.string,
  clip_uri: PropTypes.string,
});

const scenePropType = PropTypes.shape({
  shots: PropTypes.arrayOf(shotPropType),
});

const characterPropType = PropTypes.shape({
  name: PropTypes.string,
  reference_uri: PropTypes.string,
});

const projectPropType = PropTypes.shape({
  stages: PropTypes.arrayOf(stagePropType),
  episode: PropTypes.shape({
    logline: PropTypes.string,
    scenes: PropTypes.arrayOf(scenePropType),
  }),
  characters: PropTypes.arrayOf(characterPropType),
  voice_cast: PropTypes.objectOf(PropTypes.string),
});

/**
 * SignalChain — same visual as PlatformConsole.jsx's, with one addition:
 * an optional `lane` filter ("video" | "audio") so the Studio and Audio
 * pages can each show only their half of the 11-stage chain, per the
 * Product Brief's "Studio: video/audio tabs" request, without needing two
 * separate stage lists to maintain.
 */
export function SignalChain({ project, idx = 0, running = false, lane }) {
  const stageStatuses = {};
  (project?.stages || []).forEach((s) => { stageStatuses[s.name] = s.status; });
  const failedIdx = (() => {
    const failed = (project?.stages || []).find((s) => s.status === "failed");
    if (!failed) return undefined;
    return STAGES.findIndex(([, , k]) => k === failed.name);
  })();

  const visible = lane ? STAGES.filter(([, l]) => l === lane) : STAGES;

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 0, minWidth: lane ? 340 : 720, padding: "24px 2px 6px"}}>
        {visible.map(([label, laneName, key], vi) => {
          const i = STAGES.findIndex(([, , k]) => k === key);
          const liveStatus = stageStatuses[key];
          const isFailed = failedIdx !== undefined && i === failedIdx;
          let status;
          if (liveStatus === "awaiting_review") status = "awaiting_review";
          else if (isFailed) status = "blocked";
          else if (liveStatus === "done") status = "done";
          else if (liveStatus === "running") status = "running";
          else status = i < idx ? "done" : (i === idx && running ? "running" : "pending");
          const c = SC[status];
          const first = vi === 0 || visible[vi - 1][1] !== laneName;
          return (
            <React.Fragment key={label}>
              {first && vi !== 0 && <div style={{ width: 1, alignSelf: "stretch", background: T.line2, margin: "0 10px" }} />}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, minWidth: 58, position: "relative", }}>
                {first && !lane && (
  <div style={{ position: "absolute", top: -20, left: 0, whiteSpace: "nowrap" }}>
    <Eyebrow color={laneName === "video" ? T.muted : T.violet}>{laneName}</Eyebrow>
  </div>
)}
                <div style={{
                  width: 38, height: 38, borderRadius: 8,
                  background: status === "pending" ? T.panel2 : `${c}1A`,
                  border: `1px solid ${status === "pending" ? T.line2 : c}`,
                  display: "grid", placeItems: "center", position: "relative",
                }}>
                  <Lamp on={status !== "pending"} color={c} size={9} className={status === "awaiting_review" ? "led-pulse" : ""} />
                  {status === "awaiting_review" && (
                    <span style={{ position: "absolute", top: -5, right: -5, width: 10, height: 10, borderRadius: 99, background: T.violet, border: `2px solid ${T.ink}` }} />
                  )}
                </div>
                <div style={{ font: `500 9px/1.2 ${mono}`, color: status === "pending" ? T.faint : T.paper, textAlign: "center", maxWidth: 56 }}>{label}</div>
              </div>
              {vi < visible.length - 1 && visible[vi + 1][1] === laneName && (
                <div style={{ height: 1, width: 14, background: i < idx ? T.teal : T.line2, marginBottom: 22 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

SignalChain.propTypes = {
  project: projectPropType,
  idx: PropTypes.number,
  running: PropTypes.bool,
  lane: PropTypes.oneOf(["video", "audio"]),
};

/** PromptBox — ported verbatim from PlatformConsole.jsx. A collapsible
 *  "prompt sent to model" inspector, used inside StageReviewBanner's
 *  per-stage summaries so reviewers can see exactly what was sent to
 *  the generation model for that character/shot/track without cluttering
 *  the default view. */
export function PromptBox({ label = "prompt sent to model", text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen((o) => !o)} style={{
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

/** StageReviewBanner — ported from PlatformConsole.jsx's current version.
 *  Works for any stage in STAGES (video or audio lane) since it looks the
 *  stage up by name rather than assuming a lane. The per-stage summary
 *  below renders the actual media the stage produced (character/keyframe
 *  images, dialogue/music audio, clip/render/mux video) via
 *  studioApiCalls.mediaUrl, plus a PromptBox for stages that have a
 *  recorded prompt, instead of just a text count. */
export function StageReviewBanner({ project, stageName, onApprove, onReject, disabled }) {
  const [showOverride, setShowOverride] = useState(false);
  const [note, setNote] = useState("");
  const [override, setOverride] = useState("");

  const stageLabel = STAGES.find(([, , k]) => k === stageName)?.[0] ?? stageName.replace(/_/g, " ");
  const stageRecord = project?.stages?.find((s) => s.name === stageName);
  const canOverride = PROMPT_OVERRIDE_STAGES.has(stageName);

  const summary = (() => {
    if (!project) return null;
    const allShots = (project.episode?.scenes || []).flatMap((sc) => sc.shots || []);

    if (stageName === "write_script") {
      const ep = project.episode;
      if (!ep) return null;
      const charNames = (project.characters || []).map((c) => c.name).join(", ");
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
            {chars.map((ch) => (
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
      const keyed = allShots.filter((s) => s.keyframe_uri);
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
      const withAudio = allShots.filter((s) => s.dialogue_audio_uri);
      return withAudio.length === 0
        ? <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>{allShots.length} shot(s) · no audio yet</div>
        : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ font: `500 11px/1 ${mono}`, color: T.muted }}>{withAudio.length}/{allShots.length} shots with dialogue</div>
            {withAudio.slice(0, 3).map((s, i) => (
              <div key={s.id} style={{ display: "grid", gap: 4 }}>
                <div style={{ font: `400 11px/1.4 ${sans}`, color: T.faint }}>
                  {(s.dialogue || []).map((l) => `${l.character}: ${l.text}`).join(" / ").slice(0, 100) || `Shot ${i + 1}`}
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
      const clipped = allShots.filter((s) => s.clip_uri);
      const realClips = clipped.filter((s) => !s.clip_uri.endsWith(".json"));
      return (
        <div style={{ display: "grid", gap: 12 }}>
          {realClips.length > 0
            ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                {realClips.slice(0, 4).map((s) => (
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: summary ? 14 : 0 }}>
        <div>
          <div>
            <Eyebrow color={T.violet}>This stage needs your review before continuing</Eyebrow>
            <div style={{ font: `600 12px/1.2 ${sans}`, color: T.paper, marginTop: 5 }}>
              {stageLabel}
            </div>
          </div>
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
          {canOverride ? (
            <Btn kind="danger" icon={X} onClick={() => setShowOverride((o) => !o)} disabled={disabled}>
              Reject & refine
            </Btn>
          ) : (
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
              onChange={(e) => setOverride(e.target.value)}
              placeholder='e.g. "Make the characters more expressive and add more visual detail to each shot description"'
              rows={3}
              style={{
                display: "block", width: "100%", marginTop: 6, background: T.ink, color: T.paper,
                border: `1px solid ${T.line2}`, borderRadius: 7, padding: "10px 12px",
                font: `400 12px/1.5 ${sans}`, boxSizing: "border-box", resize: "vertical",
              }}
            />
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

StageReviewBanner.propTypes = {
  project: projectPropType,
  stageName: PropTypes.string.isRequired,
  onApprove: PropTypes.func.isRequired,
  onReject: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};