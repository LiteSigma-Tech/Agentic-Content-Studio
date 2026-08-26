import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { 
  Film, 
  Play, 
  X, 
  RotateCcw, 
  Trash2, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight, 
  Video, 
  Sliders,
  TrendingUp
} from "lucide-react";
import { 
  T, 
  mono, 
  sans, 
  Panel, 
  Eyebrow, 
  Stat, 
  Pill, 
  Btn, 
  EmptyState, 
  GenericSignalChain, 
  GENERIC_STAGES 
} from "../shared/ui";
import { studioApiCalls, leadsApiCalls, usageApi, agentsApiCalls } from "../../api";
import ConversationalApprovalCard from "../studio/components/ConversationalApprovalCard";
import DashboardOnboarding from "../studio/components/DashboardOnboarding";

export default function Overview({ onNavigate }) {
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [resumingId, setResumingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  // 1. Data Fetch Queries
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

  // Fetching Projects for active run + recent runs library
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ["all-projects"],
    queryFn: () => studioApiCalls.listProjects(20, 0),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // 2. Action Mutations
  const approveMutation = useMutation({
    mutationFn: ({ runId, note }) => agentsApiCalls.approve(runId, note),
    onSuccess: () => {
      qc.invalidateQueries(["agent-runs"]);
      qc.invalidateQueries(["usage"]);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ runId, note }) => agentsApiCalls.reject(runId, note),
    onSuccess: () => qc.invalidateQueries(["agent-runs"]),
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
      qc.invalidateQueries(["all-projects"]);
      if (playing?.id === deletedId) setPlaying(null);
    }
  });

  // Resume pipeline action
  async function handleResume(id) {
    setActionError(null);
    setResumingId(id);
    try {
      await studioApiCalls.runProject(id, { background: true });
      qc.invalidateQueries(["all-projects"]);
    } catch (e) {
      setActionError(errorGuidance(e, "Pipeline did not resume."));
    } finally {
      setResumingId(null);
    }
  }

  // 3. Telemetry Processing & Data Calculations
  const projects = projectsData?.items || [];
  const activeProject = projects[0] || null;
  const stagesDone = activeProject?.stages?.filter((s) => s.status === "done").length ?? 0;
  const isRunning = activeProject?.stages?.some((s) => s.status === "running") ?? false;

  const leads = leadsData?.items || [];
  const sourced = leads.length;
  const qualified = leads.filter((l) => l.status === "qualified").length;
  const contactable = leads.filter(
    (l) => l.status === "qualified" || (l.status !== "blocked" && l.status !== "disqualified")
  ).length;

  // Calculate funnel conversions
  const qualPct = sourced > 0 ? Math.round((qualified / sourced) * 100) : 0;
  const contPct = qualified > 0 ? Math.round((contactable / qualified) * 100) : 0;

  const runs = runsData?.items || [];
  const approvals = runs
    .filter((r) => r.status === "awaiting_approval" && r.pending?.tool === "send_email")
    .map((r) => ({
      id: r.id,
      to: r.pending?.args?.to || "",
      subject: r.pending?.args?.subject || "(no subject)",
      body: r.pending?.args?.body || "",
      status: "pending",
    }));

  const pendingCount = approvals.length;

  // Cost radial parameters (Assume reference warning limit of $50.00)
  const cost = usageData?.total_cost_usd || 0.0;
  const budgetLimit = 50.0;
  const budgetUsagePercent = Math.min(100, Math.round((cost / budgetLimit) * 100));
  const radialCircumference = 2 * Math.PI * 16; // r=16 -> ~100.5
  const strokeOffset = radialCircumference - (radialCircumference * budgetUsagePercent) / 100;

  const fade = reduceMotion ? { duration: 0 } : { duration: 0.2 };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {/* Scrollbar & Attention Pulse Animation rules */}
      <style>{`
        .clean-scrollbar-wrapper,
        .clean-scrollbar-wrapper * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .clean-scrollbar-wrapper::-webkit-scrollbar,
        .clean-scrollbar-wrapper *::-webkit-scrollbar {
          display: none !important;
        }

        /* Ambient glowing focus ring animation for items needing action */
        @keyframes attention-glow {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes review-glow {
          0% { box-shadow: 0 0 0 0 rgba(124, 134, 224, 0.45); }
          70% { box-shadow: 0 0 0 6px rgba(124, 134, 224, 0); }
          100% { box-shadow: 0 0 0 0 rgba(124, 134, 224, 0); }
        }
        @keyframes active-pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .pulse-attention {
          animation: attention-glow 2.2s infinite ease-in-out;
          border-radius: 999px;
          display: inline-block;
        }
        .pulse-review {
          animation: review-glow 2.2s infinite ease-in-out;
          border-radius: 999px;
          display: inline-block;
        }
        .active-glow-teal {
          animation: active-pulse 2.2s infinite ease-in-out;
          border-radius: 999px;
          display: inline-block;
        }

        .dashboard-row-hover {
          transition: background-color 0.2s ease, transform 0.1s ease;
        }
        .dashboard-row-hover:hover {
          background-color: rgba(255, 255, 255, 0.02) !important;
        }
      `}</style>

      {/* Onboarding Overview Ribbon */}
      <DashboardOnboarding onCreate={() => onNavigate?.("/studio")} />

      {/* 1. Header Metrics & SVG Charts Ribbon */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 0.8fr", gap: 16 }}>
        
        {/* Funnel SVG polygon visualization */}
        <Panel style={{ padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Eyebrow color={T.violet}>Lead Conversion Funnel</Eyebrow>
            <span style={{ font: `500 10px/1 ${mono}`, color: T.faint }}>conversion flow</span>
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {/* SVG Visual Tapered Blocks */}
            <svg viewBox="0 0 240 60" style={{ width: "100%", maxWidth: 280, height: "auto" }}>
              {/* Sourced Step */}
              <polygon points="0,5 75,12 75,48 0,55" fill={`${T.violet}22`} stroke={T.violet} strokeWidth="1" />
              {/* Qualified Step */}
              <polygon points="80,13 155,18 155,42 80,47" fill={`${T.teal}22`} stroke={T.teal} strokeWidth="1" />
              {/* Contactable Step */}
              <polygon points="160,19 235,23 235,37 160,41" fill={`${T.amber}22`} stroke={T.amber} strokeWidth="1" />
              
              {/* Text overlays inside SVG blocks */}
              <text x="37" y="34" fill={T.paper} fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily={sans}>
                {sourced}
              </text>
              <text x="117" y="34" fill={T.paper} fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily={sans}>
                {qualified}
              </text>
              <text x="197" y="33" fill={T.paper} fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily={sans}>
                {contactable}
              </text>
            </svg>

            {/* Funnel Dropoff Legend */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ font: `500 11px/1.2 ${sans}`, color: T.paper }}>
                Sourced: <span style={{ fontFamily: mono, fontWeight: 700 }}>{sourced}</span>
              </div>
              <div style={{ font: `500 11px/1.2 ${sans}`, color: T.faint }}>
                Qualified: <span style={{ color: T.teal, fontFamily: mono, fontWeight: 700 }}>{qualPct}%</span> conversion
              </div>
              <div style={{ font: `500 11px/1.2 ${sans}`, color: T.faint }}>
                Contactable: <span style={{ color: T.amber, fontFamily: mono, fontWeight: 700 }}>{contPct}%</span> safety clear
              </div>
            </div>
          </div>
        </Panel>

        {/* Operational Cost Panel with Sparkline + Radial Gauge */}
        <Panel style={{ padding: 14, display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Eyebrow color={T.teal}>Operational Spend</Eyebrow>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ font: `700 24px/1 ${sans}`, color: T.paper }}>
                ${cost.toFixed(2)}
              </span>
              <span style={{ font: `500 10px/1 ${mono}`, color: T.faint }}>
                / ${budgetLimit.toFixed(0)} cap
              </span>
            </div>
            
            {/* SVG Sparkline Area Chart */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <TrendingUp size={12} color={T.teal} />
              <svg width="100" height="20" viewBox="0 0 100 20" style={{ opacity: 0.6 }}>
                <defs>
                  <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.teal} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={T.teal} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 0,18 Q 20,15 40,16 T 80,10 T 100,2" fill="none" stroke={T.teal} strokeWidth="1.5" />
                <path d="M 0,18 Q 20,15 40,16 T 80,10 T 100,2 L 100,20 L 0,20 Z" fill="url(#sparkline-grad)" />
              </svg>
            </div>
          </div>

          {/* SVG Radial Progress Ring */}
          <div style={{ position: "relative", width: 50, height: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="50" height="50" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="25" cy="25" r="16" fill="transparent" stroke={T.line} strokeWidth="3.5" />
              <circle 
                cx="25" 
                cy="25" 
                r="16" 
                fill="transparent" 
                stroke={T.teal} 
                strokeWidth="3.5" 
                strokeDasharray={radialCircumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.35s" }}
              />
            </svg>
            <div style={{ position: "absolute", font: `700 10px/1 ${mono}`, color: T.paper }}>
              {budgetUsagePercent}%
            </div>
          </div>
        </Panel>

        {/* Model Routing telemetry stat card */}
        <Panel style={{ padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <Eyebrow color={T.faint}>Active Routings</Eyebrow>
            <div style={{ font: `700 22px/1 ${sans}`, color: T.paper, marginTop: 6 }}>9 Live Models</div>
            <div style={{ font: `500 10px/1.4 ${mono}`, color: T.faint, marginTop: 4 }}>
              6 Free-tier • 3 Premium Configured
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button 
              onClick={() => onNavigate?.("/models")}
              style={{
                background: "none", border: "none", cursor: "pointer", color: T.violet,
                display: "flex", alignItems: "center", gap: 4, padding: "2px 6px",
                font: `600 10px/1 ${mono}`, textTransform: "uppercase", letterSpacing: "0.05em"
              }}
            >
              Configure &nbsp;<Sliders size={11} />
            </button>
          </div>
        </Panel>
      </div>

      {/* 2. Unified Master Split-Pane Grid Layout (Tabless) */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(0, 1.2fr)", gap: 16, alignItems: "start" }}>
        
        {/* LEFT COLUMN: Pipelines and Media Telemetry Workspace */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          
          {/* Active Studio Run Pipeline Card */}
          <Panel style={{ padding: 18, borderLeft: activeProject ? `4px solid ${T.teal}` : "none", boxShadow: isRunning ? `0 0 30px color-mix(in srgb, ${T.teal} 8%, transparent)` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <Eyebrow color={T.amber}>active run · studio</Eyebrow>
                <div style={{ font: `700 15px/1.2 ${sans}`, color: T.paper, marginTop: 5 }}>
                  {activeProject ? `${activeProject.title || activeProject.id} · ${activeProject.genre}` : "No active pipeline runs"}
                </div>
              </div>
              {activeProject && (
                <div className={isRunning ? "active-glow-teal" : ""}>
                  <Pill
                    status={isRunning ? "running" : stagesDone >= GENERIC_STAGES.length ? "done" : "pending"}
                    label={isRunning ? "rendering" : stagesDone >= GENERIC_STAGES.length ? "complete" : "idle"}
                  />
                </div>
              )}
            </div>

            {activeProject ? (
              <div className="clean-scrollbar-wrapper">
                <GenericSignalChain idx={stagesDone} running={isRunning} />
              </div>
            ) : (
              <EmptyState
                title="No active projects currently in pipeline"
                body="Launch an episode generation sequence within the Studio to monitor progress."
              />
            )}
          </Panel>

          {/* Quick Creator / Studio Redirection High-Impact CTA Panel */}
          <Panel style={{ 
            padding: 16, 
            background: `linear-gradient(135deg, ${T.panel2}, color-mix(in srgb, ${T.violet} 6%, ${T.panel2}))`,
            border: `1px dashed color-mix(in srgb, ${T.violet} 30%, ${T.line2})`,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12
          }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ background: `${T.violet}18`, padding: 10, borderRadius: T.radiusMd }}>
                <Video size={18} color={T.violet} />
              </div>
              <div>
                <div style={{ font: `700 13px/1.2 ${sans}`, color: T.paper }}>Ready to start a new media pipeline?</div>
                <div style={{ font: `400 11px/1.4 ${sans}`, color: T.faint, marginTop: 2 }}>
                  Provide an episode concept, select a genre, and route synthesis through the agent cluster.
                </div>
              </div>
            </div>
            <Btn kind="primary" icon={ArrowRight} onClick={() => onNavigate?.("/studio")}>
              Go to Studio
            </Btn>
          </Panel>

          {/* Episode Library / Recent Runs Module (Fully Consolidated) */}
          <Panel style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Eyebrow>
                <Film size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;episode library · {projects.length} project{projects.length !== 1 ? "s" : ""}
              </Eyebrow>
              <span style={{ font: `500 10px/1 ${mono}`, color: T.faint }}>operational assets</span>
            </div>

            {projectsLoading && <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint }}>Loading library…</div>}
            
            {!projectsLoading && projects.length === 0 && (
              <EmptyState
                title="No episodes in the library yet"
                body="Run the Studio pipeline once and completed projects will appear here with status, cost, and playback."
              />
            )}

            {actionError && <div style={{ marginBottom: 10 }}><ErrorBanner error={actionError} /></div>}

            {/* Inline play drawer inside split layout */}
            <AnimatePresence>
              {playing && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ marginBottom: 14, background: T.ink, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.line2}` }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${T.line2}` }}>
                    <div style={{ font: `600 12px/1 ${sans}`, color: T.paper }}>{playing.title || playing.id}</div>
                    <button
                      onClick={() => setPlaying(null)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.faint }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <video
                    controls
                    autoPlay
                    style={{ width: "100%", maxHeight: 300, background: "#000" }}
                    src={studioApiCalls.videoUrl(playing.id)}
                  >
                    Your browser does not support the video tag.
                  </video>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Minimal Project Rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <AnimatePresence initial={false}>
                {projects.slice(0, 8).map((p) => {
                  const isDone = p.final_av_uri || p.final_uri || p.status === "done";
                  const hasFail = p.stages?.some((s) => s.status === "failed");
                  const isRun = p.stages?.some((s) => s.status === "running") || p.status === "running";
                  const isAwaiting = p.stages?.some((s) => s.status === "awaiting_review") || p.awaiting_review_stage;

                  const pillStatus = isDone ? "done" : hasFail ? "blocked" : isRun ? "running" : isAwaiting ? "awaiting_review" : "pending";
                  const pillLabel = isDone ? "done" : hasFail ? "failed" : isRun ? "running" : isAwaiting ? "review" : "pending";

                  const isInspected = selectedId === p.id;

                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, height: 0, overflow: "hidden" }}
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      className="dashboard-row-hover"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 10px",
                        borderTop: `1px solid ${T.line}`,
                        background: isInspected ? `${T.violet}08` : "transparent",
                        cursor: "pointer"
                      }}
                      onClick={() => {
                        setSelectedId(p.id);
                        if (isDone) setPlaying(p);
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {/* Pulse wrapping status elements needing immediate action */}
                        <div className={hasFail ? "pulse-attention" : isAwaiting ? "pulse-review" : ""}>
                          <Pill status={pillStatus} label={pillLabel} />
                        </div>
                        
                        {/* Episode ID + contextual project name */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ font: `500 11px/1 ${mono}`, color: T.paper }}>
                            {p.id.slice(0, 8)}
                          </span>
                          <span style={{ font: `400 11px/1 ${sans}`, color: T.faint }}>
                            ({p.title || "Untitled Generation"})
                          </span>
                        </div>
                      </div>

                      {/* Micro actions inside list row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {hasFail && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResume(p.id);
                            }}
                            disabled={resumingId === p.id}
                            style={{
                              background: "none", border: "none", cursor: "pointer", padding: 4,
                              color: T.teal || "#10b981", display: "flex", alignItems: "center",
                              transition: "transform 0.15s ease", opacity: resumingId === p.id ? 0.5 : 1
                            }}
                            title="Retry Generation Run"
                            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.15)")}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTargetId(p.id);
                          }}
                          style={{
                            background: "none", border: "none", cursor: "pointer", padding: 4,
                            color: T.faint, display: "flex", alignItems: "center",
                            transition: "color 0.15s ease, transform 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = T.clay || "#ef4444";
                            e.currentTarget.style.transform = "scale(1.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = T.faint;
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                          title="Prune Draft Forever"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </Panel>
        </div>

        {/* RIGHT COLUMN: Permanent "Needs You" Action Center */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          
          <Panel style={{ padding: 18, borderLeft: pendingCount > 0 ? `4px solid ${T.clay}` : `4px solid ${T.teal}` }} className={pendingCount > 0 ? "attention-glow-clay" : ""}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Eyebrow color={pendingCount > 0 ? T.clay : T.teal}>
                <ShieldCheck size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;approval inbox
              </Eyebrow>
              <Pill
                status={pendingCount ? "blocked" : "ok"}
                label={pendingCount ? `${pendingCount} need you` : "clear"}
              />
            </div>
            
            <div style={{ font: `400 11px/1.5 ${sans}`, color: T.faint, margin: "8px 0 14px" }}>
              Every send pauses here. The send tool re-checks suppression at execution—approving an unsubscribed contact won't send.
            </div>

            {runsLoading && (
              <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint }}>Loading inbox…</div>
            )}

            {!runsLoading && runsError && (
              <ErrorBanner error={errorGuidance(runsError, "Could not load approvals.")} />
            )}

            {!runsLoading && !runsError && approvals.length === 0 && (
              <EmptyState
                title="Inbox Clear"
                body="No outreach drafts are awaiting approval right now. All pipelines cleared."
              />
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <AnimatePresence initial={false}>
                {approvals.map((a) => (
                  <motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, x: 20, height: 0, overflow: "hidden" }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  >
                    <ConversationalApprovalCard
                      approval={a}
                      onApprove={(note) => approveMutation.mutate({ runId: a.id, note })}
                      onReject={(note) => rejectMutation.mutate({ runId: a.id, note })}
                      approving={approveMutation.isPending}
                      rejecting={rejectMutation.isPending}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </Panel>

        </div>
      </div>

      {/* Global Deletion Confirmation Modal Overlay */}
      <AnimatePresence>
        {deleteTargetId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(5, 6, 12, 0.85)", display: "flex",
              alignItems: "center", justifyContent: "center", zIndex: 1000,
              padding: 16, backdropFilter: "blur(4px)"
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
            >
              <Panel style={{ maxWidth: 400, width: "100%", padding: 24, background: T.panel2, border: `1px solid ${T.line}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <AlertTriangle color={T.clay || "#ef4444"} size={20} />
                  <h3 style={{ font: `700 16px/1.3 ${sans}`, color: T.paper, margin: 0 }}>Confirm Deletion</h3>
                </div>
                
                <p style={{ font: `400 13px/1.5 ${sans}`, color: T.faint, margin: "0 0 20px 0" }}>
                  Are you sure you want to delete this episode forever? It will be removed from your console history permanently.
                </p>
                
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <Btn onClick={() => setDeleteTargetId(null)}>
                    Cancel
                  </Btn>
                  <Btn
                    kind="danger"
                    onClick={() => {
                      deleteProject.mutate(deleteTargetId);
                      setDeleteTargetId(null);
                    }}
                  >
                    Delete Forever
                  </Btn>
                </div>
              </Panel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}