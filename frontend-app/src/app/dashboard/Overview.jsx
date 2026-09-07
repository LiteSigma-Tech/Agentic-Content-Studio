import { useState } from "react";
import PropTypes from "prop-types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useTheme } from "../../ThemeContext";
import { 
  Film, 
  X, 
  RotateCcw, 
  Trash2, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight, 
  Clapperboard, 
  Play,
  CheckCircle2,
  Clock,
  BookOpen
} from "lucide-react";
import { 
  T, 
  mono, 
  sans, 
  Panel, 
  Eyebrow, 
  Pill, 
  Btn, 
  EmptyState, 
  ErrorBanner,
  errorGuidance,
  GENERIC_STAGES,
  useBreakpoint // Listen to breakpoint changes
} from "../shared/ui";
import { studioApiCalls, leadsApiCalls, usageApi, agentsApiCalls } from "../../api";

function ApprovalItemCard({ approval, onApprove, onReject, approving, rejecting }) {
  useTheme();
  const [note, setNote] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const bp = useBreakpoint();

  return (
    <div
      style={{
        padding: "12px 14px",
        background: T.panel2,
        borderRadius: T.radiusMd,
        border: `1px solid ${T.line}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ font: `600 13px/1.3 ${sans}`, color: T.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {approval.to ? `Outreach: ${approval.to}` : approval.agent_name || `Approval #${approval.id.slice(0, 8)}`}
          </div>
          <div style={{ font: `400 11px/1.4 ${sans}`, color: T.muted, marginTop: 2 }}>
            {approval.subject || approval.reason || "Review authorization required."}
          </div>
        </div>
        <Pill status="awaiting_review" label="REVIEW" />
      </div>

      {approval.body && (
        <div>
          <div
            style={{
              padding: "6px 8px",
              background: T.ink,
              borderRadius: 4,
              border: `1px solid ${T.line2}`,
              font: `400 11px/1.4 ${mono}`,
              color: T.faint,
              maxHeight: showDetails ? "none" : 48,
              overflow: "hidden",
            }}
          >
            {approval.body}
          </div>
          {approval.body.length > 80 && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{
                background: "none",
                border: "none",
                color: T.violet,
                fontSize: 10,
                fontFamily: mono,
                cursor: "pointer",
                padding: "2px 0 0",
              }}
            >
              {showDetails ? "Collapse ↑" : "Show full text ↓"}
            </button>
          )}
        </div>
      )}

      {/* Dynamic inline-or-stacked layout based on breakpoint */}
      <div style={{ 
        display: "flex", 
        flexDirection: bp === "mobile" ? "column" : "row", 
        gap: 6, 
        alignItems: bp === "mobile" ? "stretch" : "center", 
        marginTop: 4 
      }}>
        <input
          type="text"
          placeholder="Optional feedback..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{
            flex: 1,
            background: T.ink,
            border: `1px solid ${T.line}`,
            borderRadius: 4,
            padding: "6px 8px",
            color: T.paper,
            fontSize: 11,
            fontFamily: sans,
          }}
        />
        <div style={{ 
          display: "flex", 
          gap: 6, 
          justifyContent: bp === "mobile" ? "stretch" : "flex-end" 
        }}>
          <Btn
            size="sm"
            kind="ok"
            disabled={approving || rejecting}
            onClick={() => onApprove(note)}
            style={{ flex: bp === "mobile" ? 1 : "initial" }}
          >
            {approving ? "..." : "Approve"}
          </Btn>
          <Btn
            size="sm"
            kind="danger"
            disabled={approving || rejecting}
            onClick={() => onReject(note)}
            style={{ flex: bp === "mobile" ? 1 : "initial" }}
          >
            {rejecting ? "..." : "Reject"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

ApprovalItemCard.propTypes = {
  approval: PropTypes.shape({
    id: PropTypes.string.isRequired,
    agent_name: PropTypes.string,
    to: PropTypes.string,
    subject: PropTypes.string,
    reason: PropTypes.string,
    body: PropTypes.string,
  }).isRequired,
  onApprove: PropTypes.func.isRequired,
  onReject: PropTypes.func.isRequired,
  approving: PropTypes.bool,
  rejecting: PropTypes.bool,
};

export default function Overview({ onNavigate }) {
  useTheme();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const bp = useBreakpoint();

  const [playing, setPlaying] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [resumingId, setResumingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Queries
  const { data: leadsData } = useQuery({
    queryKey: ["leads"],
    queryFn: () => leadsApiCalls.list({ limit: 100 }),
    staleTime: 15_000,
  });

  const { data: usageData } = useQuery({
    queryKey: ["usage"],
    queryFn: usageApi.get,
    staleTime: 30_000,
  });

  const { data: runsData, isLoading: runsLoading, error: runsError } = useQuery({
    queryKey: ["agent-runs"],
    queryFn: () => agentsApiCalls.listRuns({ limit: 50 }),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ["all-projects"],
    queryFn: () => studioApiCalls.listProjects(20, 0),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // Action Mutations
  const approveMutation = useMutation({
    mutationFn: ({ runId, note }) => agentsApiCalls.approve(runId, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-runs"] });
      qc.invalidateQueries({ queryKey: ["usage"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ runId, note }) => agentsApiCalls.reject(runId, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-runs"] }),
  });

  const deleteProject = useMutation({
    mutationFn: async (id) => {
      if (studioApiCalls.deleteProject) {
        return await studioApiCalls.deleteProject(id);
      }
      const response = await fetch(`/v1/projects/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete project");
      return true;
    },
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: ["all-projects"] });
      if (playing?.id === deletedId) setPlaying(null);
    },
  });

  async function handleResume(id) {
    setActionError(null);
    setResumingId(id);
    try {
      await studioApiCalls.runProject(id, { background: true });
      qc.invalidateQueries({ queryKey: ["all-projects"] });
    } catch (e) {
      setActionError(errorGuidance(e, "Pipeline did not resume."));
    } finally {
      setResumingId(null);
    }
  }

  // Data processing
  const projects = projectsData?.items || [];
  const activeProject = projects[0] || null;
  const stagesDone = activeProject?.stages?.filter((s) => s.status === "done").length ?? 0;
  const currentStageName = activeProject?.stages?.find((s) => s.status === "running")?.name 
    || activeProject?.stages?.find((s) => s.status === "awaiting_review")?.name 
    || (stagesDone >= GENERIC_STAGES.length ? "Completed" : "Idle");
  const isRunning = activeProject?.stages?.some((s) => s.status === "running") ?? false;

  const leads = leadsData?.items || [];
  const sourcedCount = leads.length;
  const qualifiedCount = leads.filter((l) => l.status === "qualified").length;

  const runs = runsData?.items || [];
  const approvals = runs
    .filter((r) => r.status === "awaiting_approval")
    .map((r) => ({
      id: r.id,
      agent_name: r.agent_name || "Lead Outreach Checkpoint",
      to: r.pending?.args?.to || "",
      subject: r.pending?.args?.subject || r.reason || "(Verification checkpoint)",
      body: r.pending?.args?.body || r.pending?.args?.prompt || "",
      status: "pending",
    }));
  const pendingCount = approvals.length;

  const cost = usageData?.total_cost_usd || 0.0;
  const budgetLimit = usageData?.spend_cap_usd || 50.0;
  const spendPct = Math.min(100, Math.round((cost / budgetLimit) * 100));

  // Mobile optimization limits to prevent endless scrolling
  const maxEpisodes = bp === "mobile" ? 2 : 5;
  const maxApprovals = bp === "mobile" ? 1 : 5;

  const containerGap = bp === "mobile" ? 10 : 16;
  const paddingSize = bp === "mobile" ? "12px 14px" : "16px 18px";

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: "flex", flexDirection: "column", gap: containerGap, maxWidth: 1200 }}
    >
      {/* ── 1. KPI Zone: Compact vs. Bulky Grid ── */}
      {bp === "mobile" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          
          {/* Space-Efficient "How It Works" Banner */}
          <div style={{
            background: `${T.violet}0A`,
            border: `1px dashed ${T.violet}40`,
            borderRadius: T.radiusMd,
            padding: "10px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12
          }}>
            <span style={{ font: `500 12px/1.3 ${sans}`, color: T.paper, display: "flex", alignItems: "center", gap: 6 }}>
              <BookOpen size={13} style={{ color: T.violet }} /> Learn Xeliai pipeline steps.
            </span>
            <button
              onClick={() => onNavigate?.("/help")} // Navigates cleanly to structural help guides
              style={{
                background: "none",
                border: "none",
                color: T.violet,
                font: `700 11px/1 ${sans}`,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                cursor: "pointer",
                padding: 0
              }}
            >
              How It Works →
            </button>
          </div>

          {/* Micro Status Metric Bar (Condenses 4 major panels down to a single compact line) */}
          <Panel style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ font: `600 10px/1 ${sans}`, color: T.faint, textTransform: "uppercase" }}>Pipeline:</span>
              <Pill 
                status={isRunning ? "running" : stagesDone >= GENERIC_STAGES.length ? "done" : "idle"}
                label={isRunning ? "active" : "idle"} 
              />
            </div>
            <div style={{ width: 1, height: 12, background: T.line }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ font: `600 10px/1 ${sans}`, color: T.faint, textTransform: "uppercase" }}>Spend:</span>
              <span style={{ font: `700 11px/1 ${mono}`, color: T.teal }}>${cost.toFixed(2)}</span>
            </div>
            <div style={{ width: 1, height: 12, background: T.line }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ font: `600 10px/1 ${sans}`, color: T.faint, textTransform: "uppercase" }}>Review:</span>
              <span style={{ 
                font: `700 11px/1 ${mono}`, 
                color: pendingCount > 0 ? T.clay : T.muted 
              }}>
                {pendingCount}
              </span>
            </div>
          </Panel>
        </div>
      ) : (
        /* Bulky Desktop / Tablet KPI View */
        <div style={{
          display: "grid",
          gridTemplateColumns: bp === "tablet" ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: 12,
        }}>
          {/* Active Production */}
          <Panel style={{ padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Eyebrow color={isRunning ? T.teal : T.faint}>Active Pipeline</Eyebrow>
              <Pill 
                status={isRunning ? "running" : stagesDone >= GENERIC_STAGES.length ? "done" : "idle"}
                label={isRunning ? "running" : activeProject ? "ready" : "idle"} 
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ font: `700 15px/1.2 ${sans}`, color: T.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeProject ? (activeProject.title || activeProject.id.slice(0, 8)) : "No active pipeline"}
              </div>
              <div style={{ font: `400 11px/1.4 ${sans}`, color: T.muted, marginTop: 3 }}>
                {activeProject ? `Stage: ${currentStageName} (${stagesDone}/${GENERIC_STAGES.length})` : "Start a run in Studio"}
              </div>
            </div>
          </Panel>

          {/* Approval Queue */}
          <Panel style={{ padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Eyebrow color={pendingCount > 0 ? T.clay : T.faint}>Review Queue</Eyebrow>
              <Pill status={pendingCount > 0 ? "blocked" : "ok"} label={pendingCount > 0 ? "Action Required" : "Clear"} />
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ font: `700 20px/1 ${sans}`, color: T.paper }}>
                {pendingCount} <span style={{ font: `400 12px/1 ${sans}`, color: T.muted }}>pending</span>
              </div>
              <div style={{ font: `400 11px/1.4 ${sans}`, color: T.muted, marginTop: 4 }}>
                {pendingCount > 0 ? "Outreach & stages awaiting review" : "Autonomous flow unimpeded"}
              </div>
            </div>
          </Panel>

          {/* Operational Spend */}
          <Panel style={{ padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Eyebrow color={T.teal}>Operational Spend</Eyebrow>
              <span style={{ font: `600 11px/1 ${mono}`, color: T.muted }}>{spendPct}% cap</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ font: `700 20px/1 ${sans}`, color: T.paper }}>
                ${cost.toFixed(2)} <span style={{ font: `400 11px/1 ${mono}`, color: T.faint }}>/ ${budgetLimit.toFixed(0)}</span>
              </div>
              <div style={{ width: "100%", height: 4, background: T.line, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                <div style={{ width: `${spendPct}%`, height: "100%", background: T.teal, borderRadius: 2 }} />
              </div>
            </div>
          </Panel>

          {/* Lead Intelligence */}
          <Panel style={{ padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Eyebrow color={T.violet}>Lead Intelligence</Eyebrow>
              <button
                onClick={() => onNavigate?.("/leads")}
                style={{ background: "none", border: "none", color: T.violet, fontSize: 11, fontFamily: mono, cursor: "pointer", padding: 0 }}
              >
                View →
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ font: `700 20px/1 ${sans}`, color: T.paper }}>
                {qualifiedCount} <span style={{ font: `400 12px/1 ${sans}`, color: T.muted }}>qualified</span>
              </div>
              <div style={{ font: `400 11px/1.4 ${sans}`, color: T.muted, marginTop: 4 }}>
                {sourcedCount} total sourced contacts
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ── 2. Active Status Zone: Current Production & Approval Queue (Equal Height & Clean Alignment) ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: bp === "desktop" ? "minmax(0, 1.35fr) minmax(0, 1fr)" : "1fr",
        gap: containerGap,
        alignItems: "stretch",
      }}>
        {/* Active Production Card */}
        <Panel style={{ 
          padding: paddingSize,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Eyebrow color={isRunning ? T.teal : T.faint}>Current Production</Eyebrow>
              <Btn size="sm" kind="ghost" icon={ArrowRight} onClick={() => onNavigate?.("/studio")}>
                Studio {bp !== "mobile" && "Command Center"}
              </Btn>
            </div>

            {activeProject ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
                    <div style={{ font: `600 14px/1.2 ${sans}`, color: T.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {activeProject.title || activeProject.id}
                    </div>
                    <div style={{ font: `400 11px/1.4 ${sans}`, color: T.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Genre: <span style={{ color: T.faint, fontFamily: mono }}>{activeProject.genre || "standard"}</span>
                    </div>
                  </div>
                  <Pill
                    status={isRunning ? "running" : stagesDone >= GENERIC_STAGES.length ? "done" : "pending"}
                    label={isRunning ? `Stage ${stagesDone + 1}/11` : stagesDone >= GENERIC_STAGES.length ? "Done" : "Ready"}
                  />
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", font: `500 10px/1 ${mono}`, color: T.faint, marginBottom: 4 }}>
                    <span>Progress</span>
                    <span>{Math.round((stagesDone / GENERIC_STAGES.length) * 100)}%</span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: T.line, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${(stagesDone / GENERIC_STAGES.length) * 100}%`, height: "100%", background: isRunning ? T.amber : T.teal, transition: "width 0.3s" }} />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: "14px 0", display: "flex", flexDirection: bp === "mobile" ? "column" : "row", gap: 12, alignItems: bp === "mobile" ? "stretch" : "center", justifyContent: "space-between" }}>
                <div style={{ font: `400 12px/1.4 ${sans}`, color: T.muted }}>
                  No episode is currently in the production pipeline.
                </div>
                <Btn size="sm" kind="primary" icon={Clapperboard} onClick={() => onNavigate?.("/studio")} style={{ width: bp === "mobile" ? "100%" : "auto" }}>
                  Create Episode
                </Btn>
              </div>
            )}
          </div>

          {/* Bottom metadata footer to guarantee equal height parity */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginTop: 14,
            paddingTop: 8,
            borderTop: `1px solid ${T.line}`,
            font: `400 11px/1.4 ${sans}`, 
            color: T.muted 
          }}>
            <span>
              {activeProject ? (
                <>Stage: <strong style={{ color: T.paper, fontWeight: 600 }}>{currentStageName}</strong> ({stagesDone}/{GENERIC_STAGES.length})</>
              ) : (
                "11 pipeline stages available"
              )}
            </span>
            <button
              onClick={() => onNavigate?.("/studio")}
              style={{
                background: "none",
                border: "none",
                color: T.violet,
                font: `600 11px/1 ${mono}`,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {isRunning ? "Monitor Run →" : "Open Studio →"}
            </button>
          </div>
        </Panel>

        {/* Approval Queue Card */}
        <Panel style={{ 
          padding: paddingSize, 
          borderLeft: pendingCount > 0 ? `3px solid ${T.clay}` : `3px solid ${T.line}`,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Eyebrow color={pendingCount > 0 ? T.clay : T.faint}>
                <ShieldCheck size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;Approval Queue
              </Eyebrow>
              <Pill status={pendingCount ? "blocked" : "ok"} label={pendingCount ? `${pendingCount} pending` : "clear"} />
            </div>

            {runsLoading && <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint }}>Checking approvals...</div>}
            
            {!runsLoading && runsError && <ErrorBanner error={errorGuidance(runsError, "Could not load approvals.")} />}

            {!runsLoading && !runsError && approvals.length === 0 && (
              <EmptyState
                icon={CheckCircle2}
                title="All Clear"
                body="No items are awaiting human review. Autonomous pipelines are proceeding uninterrupted."
              />
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {approvals.slice(0, maxApprovals).map((a) => (
                <ApprovalItemCard
                  key={a.id}
                  approval={a}
                  onApprove={(note) => approveMutation.mutate({ runId: a.id, note })}
                  onReject={(note) => rejectMutation.mutate({ runId: a.id, note })}
                  approving={approveMutation.isPending}
                  rejecting={rejectMutation.isPending}
                />
              ))}

              {/* Dynamic inline notification for supplementary pending decisions */}
              {approvals.length > maxApprovals && (
                <div style={{ 
                  textAlign: "center", 
                  padding: "8px 0 2px", 
                  borderTop: `1px solid ${T.line}`,
                  marginTop: 4
                }}>
                  <button
                    onClick={() => onNavigate?.("/activity-log")}
                    style={{
                      background: "none",
                      border: "none",
                      color: T.violet,
                      font: `600 11px/1.2 ${mono}`,
                      cursor: "pointer",
                      letterSpacing: "0.02em"
                    }}
                  >
                    + {approvals.length - maxApprovals} more pending reviews. View All →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom metadata footer to guarantee equal height parity */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginTop: 14,
            paddingTop: 8,
            borderTop: `1px solid ${T.line}`,
            font: `400 11px/1.4 ${sans}`, 
            color: T.muted 
          }}>
            <span>
              {pendingCount > 0 
                ? `${pendingCount} item${pendingCount === 1 ? "" : "s"} require verification` 
                : "Autonomous flow unimpeded"}
            </span>
            <button
              onClick={() => onNavigate?.("/activity-log")}
              style={{
                background: "none",
                border: "none",
                color: T.violet,
                font: `600 11px/1 ${mono}`,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Activity Log →
            </button>
          </div>
        </Panel>
      </div>

      {/* ── 3. Recent Episodes: Full Width Clean Aligned Section ── */}
      <Panel style={{ padding: paddingSize }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Eyebrow color={T.faint}>
            <Film size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;Recent Episodes ({projects.length})
          </Eyebrow>
          {projects.length > 0 && (
            <button
              onClick={() => onNavigate?.("/library")}
              style={{ background: "none", border: "none", color: T.violet, fontSize: 11, fontFamily: mono, cursor: "pointer" }}
            >
              All Episodes →
            </button>
          )}
        </div>

        {actionError && <div style={{ marginBottom: 10 }}><ErrorBanner error={actionError} /></div>}

        {/* Video preview player if playing */}
        <AnimatePresence>
          {playing && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginBottom: 12, background: T.ink, borderRadius: 6, overflow: "hidden", border: `1px solid ${T.line}` }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: `1px solid ${T.line}` }}>
                <span style={{ font: `600 11px/1 ${sans}`, color: T.paper }}>{playing.title || playing.id.slice(0, 8)}</span>
                <button onClick={() => setPlaying(null)} style={{ background: "none", border: "none", color: T.faint, cursor: "pointer" }}><X size={13} /></button>
              </div>
              <video controls autoPlay style={{ width: "100%", maxHeight: 220, background: "#000" }} src={studioApiCalls.videoUrl(playing.id)}>
                Your browser does not support video.
              </video>
            </motion.div>
          )}
        </AnimatePresence>

        {projectsLoading ? (
          <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint, padding: "10px 0" }}>Loading episodes...</div>
        ) : projects.length === 0 ? (
          <EmptyState title="No episodes created yet" body="Episodes generated in Studio will appear here." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {projects.slice(0, maxEpisodes).map((p) => {
              const isDone = p.final_av_uri || p.final_uri || p.status === "done";
              const hasFail = p.stages?.some((s) => s.status === "failed");
              const isRun = p.stages?.some((s) => s.status === "running") || p.status === "running";

              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 4px",
                    borderBottom: `1px solid ${T.line}`,
                    gap: 8
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    <Pill
                      status={isDone ? "done" : hasFail ? "blocked" : isRun ? "running" : "pending"}
                      label={isDone ? "done" : hasFail ? "failed" : isRun ? "running" : "draft"}
                    />
                    <span style={{ font: `500 12px/1 ${sans}`, color: T.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.title || p.id.slice(0, 8)}
                    </span>
                    {p.genre && (
                      <span style={{ 
                        font: `500 10px/1 ${mono}`, 
                        color: T.faint,
                        background: T.panel2,
                        padding: "2px 6px",
                        borderRadius: 4,
                        border: `1px solid ${T.line2}`
                      }}>
                        {p.genre}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {isDone && (
                      <button
                        onClick={() => setPlaying(p)}
                        title="Play Video"
                        style={{ background: "none", border: "none", cursor: "pointer", color: T.teal, padding: 4, display: "flex" }}
                      >
                        <Play size={13} />
                      </button>
                    )}
                    {hasFail && (
                      <button
                        onClick={() => handleResume(p.id)}
                        disabled={resumingId === p.id}
                        title="Retry Pipeline"
                        style={{ background: "none", border: "none", cursor: "pointer", color: T.amber, padding: 4, display: "flex" }}
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTargetId(p.id)}
                      title="Delete Episode"
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.faint, padding: 4, display: "flex" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteTargetId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000, padding: 16,
            }}
          >
            <Panel style={{ maxWidth: 380, width: "100%", padding: 20, background: T.panel2, border: `1px solid ${T.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AlertTriangle color={T.danger} size={18} />
                <span style={{ font: `700 15px/1.2 ${sans}`, color: T.paper }}>Delete Episode</span>
              </div>
              <p style={{ font: `400 12px/1.5 ${sans}`, color: T.muted, margin: "0 0 16px" }}>
                Are you sure you want to remove this episode from your library?
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Btn size="sm" onClick={() => setDeleteTargetId(null)}>Cancel</Btn>
                <Btn size="sm" kind="danger" onClick={() => { deleteProject.mutate(deleteTargetId); setDeleteTargetId(null); }}>Delete</Btn>
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

Overview.propTypes = {
  onNavigate: PropTypes.func,
};