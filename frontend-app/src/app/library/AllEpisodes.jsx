import { useQuery } from "@tanstack/react-query";
import { studioApiCalls } from "../../api";
import { Panel, Pill, EmptyState, PageHeader, ErrorBanner, errorGuidance, T, mono, sans } from "../shared/ui";

export function deriveStatus(p) {
  const isDone = p.final_av_uri || p.final_uri || p.status === "done";
  const hasFail = p.stages?.some((s) => s.status === "failed");
  const isRunning = p.stages?.some((s) => s.status === "running");
  const isAwaiting = p.stages?.some((s) => s.status === "awaiting_review");
  return {
    isDone,
    pillStatus: isDone ? "done" : hasFail ? "blocked" : isRunning ? "running" : isAwaiting ? "awaiting_review" : "pending",
    pillLabel: isDone ? "done" : hasFail ? "failed" : isRunning ? "running" : isAwaiting ? "review" : "pending",
  };
}

// Updated with semantic HTML (role="listitem") and screen-reader context
export function EpisodeRow({ p }) {
  const { pillStatus, pillLabel } = deriveStatus(p);
  const stageDone = p.stages?.filter((s) => s.status === "done").length ?? 0;
  const stageTotal = p.stages?.length ?? 11;
  const cost = (p.total_cost_usd || 0).toFixed(3);

  return (
    <div 
      role="listitem"
      aria-label={`Episode: ${p.title || p.id}. Status: ${pillLabel}.`}
      style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr auto", 
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
    </div>
  );
}

export default function AllEpisodes() {
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
      {projects.length > 0 && (
        <Panel style={{ padding: 16 }} role="list" aria-label="List of all episodes">
          {projects.map((p) => <EpisodeRow key={p.id} p={p} />)}
        </Panel>
      )}
    </div>
  );
}