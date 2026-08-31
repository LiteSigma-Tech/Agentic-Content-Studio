import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { studioApiCalls } from "../../api";
import { Panel, Btn, EmptyState, PageHeader, ErrorBanner, errorGuidance, T, sans } from "../shared/ui";
import { EpisodeRow, deriveStatus } from "./AllEpisodes";

// "Published" = done / has a final render — same field checks
// (final_av_uri / final_uri / status "done") ProjectsGallery already uses,
// plus reuses studioApiCalls.videoUrl() for playback, exactly as
// PlatformConsole.jsx's ProjectsGallery does.
export default function Published() {
  const [playing, setPlaying] = useState(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["library-all-projects"],
    queryFn: () => studioApiCalls.listProjects(50, 0),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const projects = (data?.items || []).filter((p) => deriveStatus(p).isDone);

  return (
    <div>
      <PageHeader title="Published" description="Finished episodes with a completed render, ready to watch." />
      {error && <div style={{ marginBottom: 14 }}><ErrorBanner error={errorGuidance(error, "Could not load episodes.")} /></div>}
      {isLoading && <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint }}>Loading…</div>}
      {!isLoading && projects.length === 0 && !error && (
        <EmptyState title="Nothing published yet" body="Completed episodes with a final render will appear here." />
      )}

      {playing && (
        <div style={{ marginBottom: 14, background: T.ink, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.line2}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${T.line2}` }}>
            <div style={{ font: `600 12px/1 ${sans}`, color: T.paper }}>{playing.title}</div>
            <button onClick={() => setPlaying(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }}>
              <X size={16} />
            </button>
          </div>
          <video controls autoPlay style={{ width: "100%", maxHeight: 360, background: "#000" }} src={studioApiCalls.videoUrl(playing.id)}>
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      {projects.length > 0 && (
        <Panel style={{ padding: 16 }}>
          {projects.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}><EpisodeRow p={p} /></div>
              <Btn kind="ok" onClick={() => setPlaying(p)}>Watch</Btn>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}
