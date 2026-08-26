import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Film, Play, X } from "lucide-react";
import { T, mono, sans, Panel, Eyebrow, Pill, Btn, EmptyState } from "../shared/ui";
import { studioApiCalls } from "../../api";

/**
 * RecentRuns — Dashboard section's "Recent Runs" sub-tab.
 * This is PlatformConsole.jsx's ProjectsGallery, renamed and relocated
 * to match AppShell's dashboard/RecentRuns.jsx import — logic unchanged.
 * Same assumed shared/ui exports as Overview.jsx — see the note there.
 */
export default function RecentRuns({ onNavigate }) {
  const [playing, setPlaying] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["all-projects"],
    queryFn: () => studioApiCalls.listProjects(20, 0),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const projects = data?.items || [];

  return (
    <Panel style={{ padding: 18 }}>
      <Eyebrow>
        <Film size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;episode library · {projects.length} project
        {projects.length !== 1 ? "s" : ""}
      </Eyebrow>

      {isLoading && <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint, marginTop: 10 }}>Loading…</div>}
      {!isLoading && projects.length === 0 && (
        <EmptyState
          title="No episodes in the library yet"
          body="Run the Studio pipeline once and completed projects will appear here with status, cost, and playback."
          action="Start from Studio → New Episode; failed runs remain resumable."
        />
      )}

      {playing && (
        <div style={{ marginTop: 14, background: T.ink, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.line2}`, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${T.line2}` }}>
            <div style={{ font: `600 12px/1 ${sans}`, color: T.paper }}>{playing.title}</div>
            <button
              onClick={() => setPlaying(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}
            >
              <X size={16} />
            </button>
          </div>
          <video
            controls
            autoPlay
            style={{ width: "100%", maxHeight: 360, background: "#000" }}
            src={studioApiCalls.videoUrl(playing.id)}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      <div style={{ marginTop: 12, display: "grid", gap: 1 }}>
        {projects.map((p) => {
          const isDone = p.final_av_uri || p.final_uri || p.status === "done";
          const hasFail = p.stages?.some((s) => s.status === "failed");
          const isRunning = p.stages?.some((s) => s.status === "running");
          const isAwaiting = p.stages?.some((s) => s.status === "awaiting_review");
          const stageDone = p.stages?.filter((s) => s.status === "done").length ?? 0;
          const stageTotal = p.stages?.length ?? 11;
          const pillStatus = isDone ? "done" : hasFail ? "blocked" : isRunning ? "running" : isAwaiting ? "awaiting_review" : "pending";
          const pillLabel = isDone ? "done" : hasFail ? "failed" : isRunning ? "running" : isAwaiting ? "review" : "pending";
          return (
            <div
              key={p.id}
              style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10, alignItems: "center", padding: "9px 0", borderTop: `1px solid ${T.line}` }}
            >
              <div>
                <div style={{ font: `600 13px/1.2 ${sans}`, color: T.paper }}>{p.title || p.id}</div>
                <div style={{ font: `500 10px/1 ${mono}`, color: T.faint, marginTop: 2 }}>
                  {p.genre} · ${(p.total_cost_usd || 0).toFixed(3)} · {stageDone}/{stageTotal} stages
                  {p.review_mode && <span style={{ color: T.hitl }}> · review mode</span>}
                </div>
              </div>
              <Pill status={pillStatus} label={pillLabel} />
              {isDone ? <Btn kind="ok" icon={Play} onClick={() => setPlaying(p)}>Watch</Btn> : <span />}
              <span style={{ font: `500 10px/1 ${mono}`, color: T.faint, fontSize: 9 }}>{p.id.slice(0, 8)}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
