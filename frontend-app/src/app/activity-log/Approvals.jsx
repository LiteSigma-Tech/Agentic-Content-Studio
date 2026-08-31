import { useQuery } from "@tanstack/react-query";
import { agentsApiCalls } from "../../api";
import { Panel, Pill, EmptyState, PageHeader, ErrorBanner, errorGuidance, T, mono } from "../shared/ui";

// Real data, best available: there's no dedicated "approval history" log
// endpoint confirmed in api.js. This derives a history view from
// agentsApiCalls.listRuns(), client-side filtered to runs that have moved
// past the awaiting_approval state (approved/rejected/done/failed) — i.e.
// it shows the *result* of past approval decisions, not a full audit trail
// (who approved it, when, with what note). If a real audit-log endpoint
// exists or gets built, swap the queryFn here.
export default function Approvals() {
  const { data, error } = useQuery({
    queryKey: ["activity-approvals"],
    queryFn: () => agentsApiCalls.listRuns({ limit: 100 }),
    staleTime: 15_000,
  });

  const runs = (data?.items || []).filter((r) => r.status !== "awaiting_approval");

  return (
    <div>
      <PageHeader title="Approvals" description="Recent runs that went through an approval step, with their final outcome." />
      {error && <div style={{ marginBottom: 14 }}><ErrorBanner error={errorGuidance(error, "Could not load run history.")} /></div>}

      {runs.length === 0 ? (
        <EmptyState title="No approval history yet" body="Once runs move past an approval step, they'll show up here." />
      ) : (
        <Panel style={{ padding: 0, overflow: "hidden" }}>
          {runs.map((run, i) => (
            <div key={run.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
            }}>
              <span style={{ font: `500 12px/1.4 ${mono}`, color: T.paper }}>
                {run.pending?.tool || run.type || "run"} · {run.id}
              </span>
              <Pill status={run.status} label={run.status} />
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}
