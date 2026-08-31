import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Play, Radio, X } from "lucide-react";
import { studioApiCalls } from "../../api";
import { Panel, Pill, Btn, EmptyState, PageHeader, ErrorBanner, errorGuidance, T, mono, sans } from "../shared/ui";

// Key used to persist the actively-tracked Studio project across page
// reloads, matching PlatformConsole.jsx's `studio_active_project` key so
// StudioCommandCenter.jsx (app/studio/StudioCommandCenter.jsx) can pick it
// straight up.
export const ACTIVE_PROJECT_KEY = "studio_active_project";

export function deriveStatus(p) {
  const isDone = p.final_av_uri || p.final_uri || p.status === "done";
  const hasFail = p.stages?.some((s) => s.status === "failed");
  const isRunning = p.stages?.some((s) => s.status === "running");
  const isAwaiting = p.stages?.some((s) => s.status === "awaiting_review");
  return {
    isDone,
    hasFail,
    isRunning,
    isAwaiting,
    // Anything not done yet that is either actively moving or stuck on a
    // failure/review is "trackable" — jumping to Studio and watching it is
    // useful. A plain untouched "pending" project isn't, there's nothing
    // to watch yet.
    isTrackable: !isDone && (isRunning || isAwaiting || hasFail),
    pillStatus: isDone ? "done" : hasFail ? "blocked" : isRunning ? "running" : isAwaiting ? "awaiting_review" : "pending",
    pillLabel: isDone ? "done" : hasFail ? "failed" : isRunning ? "running" : isAwaiting ? "review" : "pending",
  };
}

// Persists the project as the active Studio project and jumps there —
// same two-step behavior as PlatformConsole.jsx's trackProject(), just
// expressed as a router navigation instead of an internal setView() call.
export function useTrackProject() {
  const navigate = useNavigate();
  return function trackProject(id) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    navigate(`/studio?project=${id}`);
  };
}

// Updated with semantic HTML (role="listitem") and screen-reader context.
// onWatch/onTrack are optional — pages that don't need row actions (or that
// render their own, like Published.jsx) can keep calling <EpisodeRow p={p} />
// exactly as before.
export function EpisodeRow({ p, onWatch, onTrack }) {
  const { pillStatus, pillLabel, isDone, isTrackable } = deriveStatus(p);
  const stageDone = p.stages?.filter((s) => s.status === "done").length ?? 0;
  const stageTotal = p.stages?.length ?? 11;
  const cost = (p.total_cost_usd || 0).toFixed(3);
  const hasAction = (isDone && onWatch) || (isTrackable && onTrack);

  return (
    <div 
      role="listitem"
      aria-label={`Episode: ${p.title || p.id}. Status: ${pillLabel}.`}
      style={{ 
        display: "grid", 
        gridTemplateColumns: hasAction ? "1fr auto auto" : "1fr auto", 
        gap: 10, 
        alignItems: "center", 
        padding: "10px 0", 
        borderTop: `1px solid ${T.line}` 
      }}
    >
      <div>
        <div style={{ font: `600 13px/1.2 ${sans}`, color: T.paper }}>{p.title || p.id}</div>
        {/* T.faint here inherits the WCAG AA darkening applied in ui.jsx */}
        <div style={{ font: `500 10px/1 ${mono}`, color: T.faint, marginTop: 4 }}>
          <span aria-hidden="true">{p.genre} · ${cost} · {stageDone}/{stageTotal} stages</span>
          {/* Visually hidden but available to screen readers for better articulation */}
          <span className="sr-only" style={{ display: "none" }}>
            Genre: {p.genre}. Cost: ${cost}. Progress: {stageDone} of {stageTotal} stages.
          </span>
        </div>
      </div>
      <Pill status={pillStatus} label={pillLabel} />
      {isDone && onWatch && (
        <Btn kind="ok" icon={Play} onClick={() => onWatch(p)} aria-label={`Watch episode ${p.title || p.id}`}>
          Watch
        </Btn>
      )}
      {isTrackable && onTrack && (
        <Btn kind="ghost" icon={Radio} onClick={() => onTrack(p.id)} aria-label={`Track episode ${p.title || p.id} in Studio`}>
          Track
        </Btn>
      )}
    </div>
  );
}

export default function AllEpisodes() {
  const [playing, setPlaying] = useState(null);
  const trackProject = useTrackProject();
  const { data, isLoading, error } = useQuery({
    queryKey: ["library-all-projects"],
    queryFn: () => studioApiCalls.listProjects(50, 0),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const projects = data?.items || [];

  return (
    <div>
      <PageHeader title="All Episodes" description="Every episode in the library, regardless of status." />
      {error && <div style={{ marginBottom: 14 }}><ErrorBanner error={errorGuidance(error, "Could not load episodes.")} /></div>}
      {isLoading && <div aria-live="polite" style={{ font: `400 12px/1.4 ${sans}`, color: T.faint }}>Loading…</div>}
      {!isLoading && projects.length === 0 && !error && (
        <EmptyState title="No episodes yet" body="Run the Studio pipeline once and completed episodes will appear here." />
      )}
      {playing && (
        <div
          role="dialog"
          aria-labelledby="video-player-title"
          style={{ marginBottom: 14, background: T.ink, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.line2}` }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${T.line2}` }}>
            <div id="video-player-title" style={{ font: `600 12px/1 ${sans}`, color: T.paper }}>
              {playing.title}
            </div>
            <button
              onClick={() => setPlaying(null)}
              aria-label="Close video player"
              style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}
            >
              <X size={16} />
            </button>
          </div>
          <video
            controls
            autoPlay
            aria-label={`Playing episode: ${playing.title}`}
            style={{ width: "100%", maxHeight: 360, background: "#000" }}
            src={studioApiCalls.videoUrl(playing.id)}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}
      {projects.length > 0 && (
        <Panel style={{ padding: 16 }} role="list" aria-label="List of all episodes">
          {projects.map((p) => (
            <EpisodeRow key={p.id} p={p} onWatch={setPlaying} onTrack={trackProject} />
          ))}
        </Panel>
      )}
    </div>
  );
}