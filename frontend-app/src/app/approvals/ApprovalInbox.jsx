import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApiCalls } from "../../api";
import ConversationalApprovalCard from "../studio/components/ConversationalApprovalCard";
import { Panel, Pill, EmptyState, Eyebrow, ErrorBanner, errorGuidance, T, mono, sans } from "../shared/ui";
import { ShieldCheck } from "lucide-react";

// Approval inbox for agent-run outreach emails awaiting HITL approval.
// Backed by agentsApiCalls (not leadsApiCalls) — these are already-drafted
// sends that need human sign-off before execution.

export default function ApprovalInbox() {
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ["agent-runs"],
    queryFn: () => agentsApiCalls.listRuns({ limit: 50 }),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ runId, note }) => agentsApiCalls.approve(runId, note),
    onSuccess: () => qc.invalidateQueries(["agent-runs"]),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ runId, note }) => agentsApiCalls.reject(runId, note),
    onSuccess: () => qc.invalidateQueries(["agent-runs"]),
  });

  const runs = data?.items || [];
  const approvals = runs
    .filter((r) => r.status === "awaiting_approval" && r.pending?.tool === "send_email")
    .map((r) => ({
      id: r.id,
      to: r.pending?.args?.to || "",
      subject: r.pending?.args?.subject || "(no subject)",
      body: r.pending?.args?.body || "",
      status: "pending",
    }));

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <Panel style={{ padding: 18, alignSelf: "start" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Eyebrow color={T.clay}>
          <ShieldCheck size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;approval inbox
        </Eyebrow>
        <Pill
          status={pendingCount ? "blocked" : "ok"}
          label={pendingCount ? `${pendingCount} need you` : "clear"}
        />
      </div>
      <div style={{ font: `400 11px/1.5 ${sans}`, color: T.faint, margin: "8px 0 14px" }}>
        Every send pauses here. The send tool re-checks suppression at execution — approving a
        contact who unsubscribed still won't send.
      </div>

      {isLoading && (
        <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint }}>Loading…</div>
      )}

      {!isLoading && error && (
        <ErrorBanner error={errorGuidance(error, "Could not load approvals.")} />
      )}

      {!isLoading && !error && approvals.length === 0 && (
        <EmptyState
          title="Inbox clear"
          body="No outreach drafts are awaiting approval right now."
        />
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {approvals.map((a) => (
          <ConversationalApprovalCard
            key={a.id}
            approval={a}
            onApprove={(note) => approveMutation.mutate({ runId: a.id, note })}
            onReject={(note) => rejectMutation.mutate({ runId: a.id, note })}
            approving={approveMutation.isPending}
            rejecting={rejectMutation.isPending}
          />
        ))}
      </div>
    </Panel>
  );
}