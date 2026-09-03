import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Play, Radio, X, List, LayoutGrid } from "lucide-react";
import { studioApiCalls } from "../../api";
import { Panel, Pill, Btn, EmptyState, PageHeader, ErrorBanner, errorGuidance, T, mono, sans } from "../shared/ui";

// Key used to persist the actively-tracked Studio project across page
// reloads, matching PlatformConsole.jsx's `studio_active_project` key so
// StudioCommandCenter.jsx (app/studio/StudioCommandCenter.jsx) can pick it
// straight up.
export const ACTIVE_PROJECT_KEY = "studio_active_project";

// Shared across All Episodes / Drafts / Published so switching view mode
// on one Library page carries over to the others.
export const VIEW_MODE_KEY = "library_view_mode";

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

// List/grid preference, shared across all three Library pages via
// localStorage so the choice sticks when navigating between them.
export function useViewMode() {
  const [mode, setMode] = useState(() => {
    if (typeof window === "undefined") return "list";
    return localStorage.getItem(VIEW_MODE_KEY) === "grid" ? "grid" : "list";
  });
  const update = useCallback((next) => {
    setMode(next);
    if (typeof window !== "undefined") localStorage.setItem(VIEW_MODE_KEY, next);
  }, []);
  return [mode, update];
}

export function ViewToggle({ mode, onChange }) {
  const option = (value, Icon, label) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={mode === value}
      aria-label={label}
      title={label}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 32, height: 32, borderRadius: 6, border: "none", cursor: "pointer",
        background: mode === value ? T.raised : "transparent",
        color: mode === value ? T.paper : T.muted,
      }}
    >
      <Icon size={15} />
    </button>
  );
  return (
    <div
      role="group"
      aria-label="Switch between list and grid view"
      style={{ display: "flex", gap: 2, padding: 3, background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 8, flexShrink: 0 }}
    >
      {option("list", List, "List view")}
      {option("grid", LayoutGrid, "Grid view")}
    </div>
  );
}

// Genre → existing accent token, so grid placeholders use colors already
// in the palette instead of introducing new ones.
const GENRE_ACCENT_KEY = {
  kids_cartoon: "violet",
  brand_explainer: "teal",
  drama: "clay",
  comedy: "amber",
};
function genreAccent(genre) {
  return T[GENRE_ACCENT_KEY[genre]] || T.muted;
}

// Mounts a video only once its card has actually scrolled near the
// viewport, so a grid of many cards never fetches/decodes more than
// what's currently visible (plus a small lookahead margin).
function useInView(rootMargin = "200px") {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (inView || !ref.current || typeof IntersectionObserver === "undefined") {
      // No IntersectionObserver support (very old browser) — fail open
      // rather than never showing a preview.
      if (typeof IntersectionObserver === "undefined") setInView(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) setInView(true); },
      { rootMargin }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [inView, rootMargin]);
  return [ref, inView];
}

// Grid card: placeholder tile by default (no network request at all).
// Only finished episodes that have scrolled into view get a real <video>
// element, and even then it only ever plays (muted, looped) on hover —
// never autoplays on mount. Leaving the card pauses and resets it, so at
// most one video is ever actively decoding regardless of grid size.
export function EpisodeGridCard({ p, onWatch, onTrack }) {
  const { pillStatus, pillLabel, isDone, isTrackable } = deriveStatus(p);
  const stageDone = p.stages?.filter((s) => s.status === "done").length ?? 0;
  const stageTotal = p.stages?.length ?? 11;
  const cost = (p.total_cost_usd || 0).toFixed(3);
  const [cardRef, inView] = useInView();
  const videoRef = useRef(null);
  const accent = genreAccent(p.genre);

  const handleEnter = () => {
    if (isDone && videoRef.current) videoRef.current.play().catch(() => {});
  };
  const handleLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div ref={cardRef} role="listitem" aria-label={`Episode: ${p.title || p.id}. Status: ${pillLabel}.`}>
      <Panel style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          style={{
            position: "relative", aspectRatio: "16 / 9", background: `${accent}14`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {isDone && inView ? (
            <video
              ref={videoRef}
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={`Preview of ${p.title || p.id}`}
              src={studioApiCalls.videoUrl(p.id)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <>
              <Play size={20} color={accent} style={{ opacity: 0.7 }} aria-hidden="true" />
              <div style={{ font: `600 9px/1 ${mono}`, color: accent, marginTop: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {p.genre}
              </div>
            </>
          )}
          <div style={{ position: "absolute", top: 8, right: 8 }}>
            <Pill status={pillStatus} label={pillLabel} />
          </div>
        </div>
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <div>
            <div style={{ font: `600 13px/1.2 ${sans}`, color: T.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.title || p.id}
            </div>
            <div style={{ font: `500 10px/1 ${mono}`, color: T.faint, marginTop: 4 }}>
              {p.genre} · ${cost} · {stageDone}/{stageTotal} stages
            </div>
          </div>
          {isDone && onWatch && (
            <Btn kind="ok" icon={Play} onClick={() => onWatch(p)} style={{ marginTop: "auto" }} aria-label={`Watch episode ${p.title || p.id}`}>
              Watch
            </Btn>
          )}
          {isTrackable && onTrack && (
            <Btn kind="ghost" icon={Radio} onClick={() => onTrack(p.id)} style={{ marginTop: "auto" }} aria-label={`Track episode ${p.title || p.id} in Studio`}>
              Track
            </Btn>
          )}
        </div>
      </Panel>
    </div>
  );
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
  const [viewMode, setViewMode] = useViewMode();
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
      <PageHeader
        title="All Episodes"
        description="Every episode in the library, regardless of status."
        action={<ViewToggle mode={viewMode} onChange={setViewMode} />}
      />
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
      {projects.length > 0 && viewMode === "list" && (
        <Panel style={{ padding: 16 }} role="list" aria-label="List of all episodes">
          {projects.map((p) => (
            <EpisodeRow key={p.id} p={p} onWatch={setPlaying} onTrack={trackProject} />
          ))}
        </Panel>
      )}
      {projects.length > 0 && viewMode === "grid" && (
        <div
          role="list"
          aria-label="Grid of all episodes"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}
        >
          {projects.map((p) => (
            <EpisodeGridCard key={p.id} p={p} onWatch={setPlaying} onTrack={trackProject} />
          ))}
        </div>
      )}
    </div>
  );
}