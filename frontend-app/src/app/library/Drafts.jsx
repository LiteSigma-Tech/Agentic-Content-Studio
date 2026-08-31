import { useQuery } from "@tanstack/react-query";
import { studioApiCalls } from "../../api";
import { Panel, EmptyState, PageHeader, ErrorBanner, errorGuidance, T, sans } from "../shared/ui";
import { EpisodeRow, deriveStatus, useTrackProject } from "./AllEpisodes";

// "Drafts" = not yet done — pending, running, awaiting review, or failed.
// This used to be a byte-for-byte copy of Published.jsx (same "done" filter,
// same title), so in-progress episodes had nowhere to show up in the
// Library section at all. Fixed to show the complement of Published's
// filter, and to surface the Track action (jump to Studio + follow along)
// on whichever rows are actually trackable, same as AllEpisodes.jsx.
export default function Drafts() {
  const trackProject = useTrackProject();
  const { data, isLoading, error } = useQuery({
    queryKey: ["library-all-projects"],
    queryFn: () => studioApiCalls.listProjects(50, 0),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const projects = (data?.items || []).filter((p) => !deriveStatus(p).isDone);

  return (
    <div>
      <PageHeader title="Drafts" description="Episodes still in production — pending, running, awaiting review, or failed." />
      {error && <div style={{ marginBottom: 14 }}><ErrorBanner error={errorGuidance(error, "Could not load episodes.")} /></div>}
      {isLoading && <div aria-live="polite" style={{ font: `400 12px/1.4 ${sans}`, color: T.faint }}>Loading…</div>}
      {!isLoading && projects.length === 0 && !error && (
        <EmptyState title="No drafts in progress" body="New episodes appear here the moment they start running, until they finish rendering." />
      )}

      {projects.length > 0 && (
        <Panel style={{ padding: 16 }} role="list" aria-label="List of draft episodes">
          {projects.map((p) => (
            <EpisodeRow key={p.id} p={p} onTrack={trackProject} />
          ))}
        </Panel>
      )}
    </div>
  );
}