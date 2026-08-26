import { useQuery } from "@tanstack/react-query";
import { agentsApiCalls } from "../../api";
import { Panel, Pill, EmptyState, PageHeader, PlaceholderNotice, ErrorBanner, errorGuidance, T, mono } from "../shared/ui";

// Real data, best available: there is no dedicated system/audit event log
// endpoint confirmed in api.js. agentsApiCalls.listRuns() is the closest
// real, general-purpose feed of "things the system did" (every agent run,
// any capability), so it's used here as a general system events view.
// It is NOT a true system log (no infra/auth/webhook-delivery events, etc.)
// — flagging that gap rather than inventing a broader log endpoint.
export default function SystemEvents() {
  const { data, error } = useQuery({
    queryKey: ["activity-system-events"],
    queryFn: () => agentsApiCalls.listRuns({ limit: 100 }),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
  const runs = data?.items || [];

  return (
    <div>
      <PageHeader title="System Events" description="Every agent run across the system, most recent first." />
      <PlaceholderNotice>
        This reuses the agent runs feed as the closest real "system events" data available — it's
        not a full infrastructure/audit log (auth events, webhook deliveries, etc. aren't included
        because no such endpoint is confirmed).
      </PlaceholderNotice>
      {error && <div style={{ marginBottom: 14 }}><ErrorBanner error={errorGuidance(error, "Could not load system events.")} /></div>}

      {runs.length === 0 ? (
        <EmptyState title="No events yet" body="Agent runs will show up here as they happen." />
      ) : (
        <Panel style={{ padding: 0, overflow: "hidden" }}>
          {runs.map((run, i) => (
            <div key={run.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
            }}>
              <span style={{ font: `500 12px/1.4 ${mono}`, color: T.paper }}>
                {run.type || run.pending?.tool || "run"} · {run.id}
              </span>
              <Pill status={run.status} label={run.status} />
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}
