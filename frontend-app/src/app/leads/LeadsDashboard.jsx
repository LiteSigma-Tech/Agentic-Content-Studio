import { useState, useId } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion, LayoutGroup } from "motion/react";
import { 
  Target, 
  UserPlus, 
  ShieldAlert, 
  Activity, 
  Check, 
  ChevronRight,
  X,
  Play,
  RotateCcw,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Search,
  HelpCircle,
  FileCheck2
} from "lucide-react";
import { leadsApiCalls, agentsApiCalls } from "../../api";
import { 
  Panel, 
  Pill, 
  Btn, 
  Stat, 
  Eyebrow, 
  EmptyState, 
  PageHeader, 
  ErrorBanner, 
  errorGuidance, 
  T, 
  mono, 
  sans 
} from "../shared/ui";

/* ── Inline Conversational Approval Card Component ── */
function ConversationalApprovalCard({ approval, onApprove, onReject, approving, rejecting }) {
  const [note, setNote] = useState("");
  const [showNoteField, setShowNoteField] = useState(false);
  const reduceMotion = useReducedMotion();

  const transitionSpring = reduceMotion 
    ? { duration: 0 } 
    : { type: "spring", stiffness: 380, damping: 30 };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={transitionSpring}
      role="region"
      aria-label={`Approval request for ${approval.to}`}
      style={{ 
        background: T.panel2, 
        border: `1px solid ${T.line2}`, 
        borderRadius: T.radiusMd, 
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: T.shadowGlow
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ font: `600 12px/1.2 ${sans}`, color: T.paper }}>{approval.to}</span>
        <Pill status="pending" label={approval.status} />
      </div>
      <div style={{ font: `700 12px/1.3 ${sans}`, color: T.paper }}>{approval.subject}</div>
      <div style={{ font: `400 11px/1.4 ${sans}`, color: T.muted }}>{approval.body}</div>
      
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4, alignItems: "center" }}>
        <Btn 
          kind="ok" 
          icon={Check} 
          onClick={() => onApprove(note)} 
          disabled={approving || rejecting}
        >
          {approving ? "Sending…" : "Approve & send"}
        </Btn>
        <Btn 
          kind="danger" 
          icon={X} 
          onClick={() => onReject(note)} 
          disabled={approving || rejecting}
        >
          {rejecting ? "Rejecting…" : "Reject"}
        </Btn>
        <button
          type="button"
          onClick={() => setShowNoteField(!showNoteField)}
          aria-expanded={showNoteField}
          style={{
            background: "none",
            border: "none",
            color: T.faint,
            cursor: "pointer",
            font: `500 10px/1 ${mono}`,
            textDecoration: "underline",
            padding: 4
          }}
        >
          {showNoteField ? "Hide feedback" : "Add feedback note"}
        </button>
      </div>

      <AnimatePresence>
        {showNoteField && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitionSpring}
            style={{ overflow: "hidden" }}
          >
            <textarea
              placeholder="Type any rejection feedback, adjustments, or manual override notes here..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginTop: 6,
                padding: "8px 10px",
                borderRadius: T.radiusMd,
                background: T.ink,
                color: T.paper,
                border: `1px solid ${T.line2}`,
                font: `400 11px/1.4 ${sans}`,
                resize: "vertical"
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function LeadsDashboard() {
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  
  // Tabs & Filters
  const [sourceCount, setSourceCount] = useState(20);
  const [actionError, setActionError] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "qualified" | "blocked" | "outreach-ready"
  const [expandedLeadId, setExpandedLeadId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showGuide, setShowGuide] = useState(true);

  // Search input accessibility ID
  const searchInputId = useId();

  // Animations configuration
  const springTransition = reduceMotion 
    ? { duration: 0 } 
    : { type: "spring", stiffness: 350, damping: 28 };

  const fadeVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
  };

  // 1. Core Queries
  const { data: leadsData, isLoading: leadsLoading, error: leadsError } = useQuery({
    queryKey: ["leads"],
    queryFn: () => leadsApiCalls.list({ limit: 100 }),
    staleTime: 15_000,
  });

  const { data: runsData } = useQuery({
    queryKey: ["agent-runs"],
    queryFn: () => agentsApiCalls.listRuns({ limit: 50 }),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // 2. Action Mutations
  const sourceMutation = useMutation({
    mutationFn: (count) => leadsApiCalls.source(count),
    onSuccess: () => {
      qc.invalidateQueries(["leads"]);
      setActionError(null);
    },
    onError: (err) => setActionError(errorGuidance(err, "Lead sourcing failed.")),
  });

  const qualifyMutation = useMutation({
    mutationFn: () => leadsApiCalls.qualify(),
    onSuccess: () => {
      qc.invalidateQueries(["leads"]);
      setActionError(null);
    },
    onError: (err) => setActionError(errorGuidance(err, "Lead qualification failed.")),
  });

  const complianceMutation = useMutation({
    mutationFn: () => leadsApiCalls.compliance(),
    onSuccess: () => {
      qc.invalidateQueries(["leads"]);
      setActionError(null);
    },
    onError: (err) => setActionError(errorGuidance(err, "Compliance check failed.")),
  });

  const proposeMutation = useMutation({
    mutationFn: (leadId) => leadsApiCalls.propose(leadId),
    onSuccess: () => {
      qc.invalidateQueries(["leads"]);
      qc.invalidateQueries(["agent-runs"]);
    },
    onError: (err) => setActionError(errorGuidance(err, "Outreach proposal failed.")),
  });

  const approveMutation = useMutation({
    mutationFn: ({ runId, note }) => agentsApiCalls.approve(runId, note),
    onSuccess: () => {
      qc.invalidateQueries(["agent-runs"]);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ runId, note }) => agentsApiCalls.reject(runId, note),
    onSuccess: () => {
      qc.invalidateQueries(["agent-runs"]);
    },
  });

  // 3. Lead Mapping & Filtering
  const leads = (leadsData?.items || []).map((item) => ({
    id: item.id,
    name: item.name,
    company: item.company,
    region: item.region,
    score: item.score,
    status: item.status,
    email: item.email || "",
    note: item.reasons?.join(" · ") || item.email || "No details provided.",
    reasons: item.reasons || []
  }));

  const qualifiedCount = leads.filter((l) => l.status === "qualified").length;
  const blockedCount = leads.filter((l) => l.status === "blocked").length;
  const contactableCount = leads.filter(
    (l) => l.status === "qualified" || (l.status !== "blocked" && l.status !== "disqualified")
  ).length;

  const eligibleOutreachLeads = leads.filter((l) => ["qualified", "compliant", "ready"].includes(l.status));

  // Filter lists based on tab selection & search queries
  const filteredLeads = leads.filter((l) => {
    const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          l.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.region.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (activeTab === "qualified") return l.status === "qualified";
    if (activeTab === "blocked") return l.status === "blocked";
    if (activeTab === "outreach-ready") return ["qualified", "compliant", "ready"].includes(l.status);
    return true; // "all"
  });

  const approvals = (runsData?.items || [])
    .filter((r) => r.status === "awaiting_approval" && r.pending?.tool === "send_email")
    .map((r) => ({
      id: r.id,
      to: r.pending?.args?.to || "",
      subject: r.pending?.args?.subject || "(no subject)",
      body: r.pending?.args?.body || "",
      status: "pending",
    }));

  const pendingApprovalCount = approvals.length;

  // Visual percentages for charts
  const qualPct = leads.length > 0 ? Math.round((qualifiedCount / leads.length) * 100) : 0;
  const contPct = qualifiedCount > 0 ? Math.round((contactableCount / qualifiedCount) * 100) : 0;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
      style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1150, margin: "0 auto" }}
    >
      {/* Visual styles and global animation setups */}
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

        @keyframes pulse-ring-glow {
          0% { box-shadow: 0 0 0 0 rgba(232, 163, 61, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(232, 163, 61, 0); }
          100% { box-shadow: 0 0 0 0 rgba(232, 163, 61, 0); }
        }

        .pulse-attention-badge {
          animation: pulse-ring-glow 2.2s infinite ease-in-out;
          border-radius: 999px;
        }

        .hover-row-spring {
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease;
        }
        .hover-row-spring:hover {
          background-color: var(--theme-hover, rgba(255, 255, 255, 0.025)) !important;
          transform: translateX(4px);
        }

        .interactive-tab-btn {
          position: relative;
          background: transparent;
          border: none;
          cursor: pointer;
          font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 8px 12px;
          border-radius: 6px;
          color: ${T.faint};
          transition: color 0.2s ease;
        }
        .interactive-tab-btn:hover {
          color: ${T.paper};
        }
        .interactive-tab-btn.active {
          color: ${T.amber};
        }
      `}</style>

      <PageHeader 
        title="Outreach & Lead Control Room" 
        description="Unified lead acquisition and compliance engine: source candidates, execute scoring modules, and approve generated outreach inline." 
      />

      {/* Global Error Banners */}
      {actionError && <ErrorBanner error={actionError} />}
      {leadsError && <ErrorBanner error={errorGuidance(leadsError, "Could not load candidates list.")} />}

      {/* Interactive Consumer Onboarding Guide */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={springTransition}
            style={{ overflow: "hidden" }}
          >
            <Panel style={{ padding: "16px 20px", borderLeft: `4px solid ${T.violet}`, background: `${T.violet}0A` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Sparkles size={16} color={T.violet} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <h3 style={{ font: `700 14px/1.2 ${sans}`, color: T.paper, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      Quick Guided Tour: The Lead Lifecycle
                    </h3>
                    <p style={{ font: `400 12px/1.4 ${sans}`, color: T.muted, margin: "6px 0 12px 0", maxWidth: 780 }}>
                      New to the platform? Your leads move smoothly through three stages of verification before reaching their destination:
                    </p>
                    
                    {/* Visual lifecycle list */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                      <div style={{ background: `${T.ink}44`, padding: 10, borderRadius: T.radiusMd, border: `1px solid ${T.line2}` }}>
                        <div style={{ font: `700 11px/1 ${mono}`, color: T.amber }}>1. Batch Sourcing</div>
                        <div style={{ font: `400 11px/1.3 ${sans}`, color: T.faint, marginTop: 4 }}>
                          Pull down high-quality candidate metadata directly from connected directories.
                        </div>
                      </div>
                      <div style={{ background: `${T.ink}44`, padding: 10, borderRadius: T.radiusMd, border: `1px solid ${T.line2}` }}>
                        <div style={{ font: `700 11px/1 ${mono}`, color: T.teal }}>2. Scoring & Clean Sweep</div>
                        <div style={{ font: `400 11px/1.3 ${sans}`, color: T.faint, marginTop: 4 }}>
                          Evaluate ICP scores and sweep lists against country suppression/GDPR opt-in parameters.
                        </div>
                      </div>
                      <div style={{ background: `${T.ink}44`, padding: 10, borderRadius: T.radiusMd, border: `1px solid ${T.line2}` }}>
                        <div style={{ font: `700 11px/1 ${mono}`, color: T.violet }}>3. Human Verification</div>
                        <div style={{ font: `400 11px/1.3 ${sans}`, color: T.faint, marginTop: 4 }}>
                          Preview tailored email drafts, attach revision suggestions, and authorize deliveries in real-time.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Dismiss guide panel"
                  style={{ background: "none", border: "none", cursor: "pointer", color: T.faint, padding: 4 }}
                >
                  <X size={16} />
                </button>
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Dynamic Funnel Command Ribbon */}
      <Panel style={{ padding: "16px 20px", background: T.panel2 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          
          {/* Section 1: Sourcing */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label htmlFor="sourcing-batch-count" style={{ font: `600 10px/1 ${mono}`, letterSpacing: "0.15em", textTransform: "uppercase", color: T.faint }}>
              Sourcing Batch Size
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="sourcing-batch-count"
                type="number"
                min={1}
                max={200}
                value={sourceCount}
                onChange={(e) => setSourceCount(Math.max(1, Number(e.target.value) || 1))}
                disabled={sourceMutation.isPending}
                style={{
                  width: 70,
                  padding: "8px 10px",
                  borderRadius: T.radiusMd,
                  background: T.ink,
                  color: T.paper,
                  border: `1px solid ${T.line2}`,
                  font: `500 12px/1 ${mono}`
                }}
              />
              <Btn 
                kind="primary" 
                icon={UserPlus} 
                onClick={() => sourceMutation.mutate(sourceCount)} 
                disabled={sourceMutation.isPending}
              >
                {sourceMutation.isPending ? "Sourcing…" : "Source leads"}
              </Btn>
            </div>
          </div>

          <div style={{ width: 1, height: 40, background: T.line }} />

          {/* Section 2: Quick-Action Pipelines */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ font: `600 10px/1 ${mono}`, letterSpacing: "0.15em", textTransform: "uppercase", color: T.faint }}>
                Scoring Engine
              </span>
              <Btn 
                kind="ghost" 
                icon={Activity} 
                onClick={() => qualifyMutation.mutate()} 
                disabled={qualifyMutation.isPending}
                style={{ border: `1px solid ${T.line}` }}
              >
                {qualifyMutation.isPending ? "Scoring…" : "Run Qualification"}
              </Btn>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ font: `600 10px/1 ${mono}`, letterSpacing: "0.15em", textTransform: "uppercase", color: T.faint }}>
                Compliance Engine
              </span>
              <Btn 
                kind="ghost" 
                icon={ShieldAlert} 
                onClick={() => complianceMutation.mutate()} 
                disabled={complianceMutation.isPending}
                style={{ border: `1px solid ${T.line}` }}
              >
                {complianceMutation.isPending ? "Sweeping…" : "Run Compliance Check"}
              </Btn>
            </div>
          </div>

          <div style={{ width: 1, height: 40, background: T.line }} />

          {/* Section 3: Animated Funnel Visualizer */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "right" }}>
              <span style={{ font: `500 11px/1.2 ${sans}`, color: T.faint }}>
                Qualified rate: <span style={{ color: T.teal, fontFamily: mono, fontWeight: "700" }}>{qualPct}%</span>
              </span>
              <span style={{ font: `500 11px/1.2 ${sans}`, color: T.faint }}>
                Safe sends: <span style={{ color: T.amber, fontFamily: mono, fontWeight: "700" }}>{contPct}%</span>
              </span>
            </div>
            <svg viewBox="0 0 160 50" aria-label="Visual representation of active lead pipeline metrics" style={{ width: 120, height: 40 }}>
              <polygon points="0,4 50,10 50,40 0,46" fill={`${T.violet}22`} stroke={T.violet} strokeWidth="1" />
              <polygon points="54,11 104,15 104,35 54,39" fill={`${T.teal}22`} stroke={T.teal} strokeWidth="1" />
              <polygon points="108,16 158,19 158,31 108,34" fill={`${T.amber}22`} stroke={T.amber} strokeWidth="1" />
              
              <text x="25" y="28" fill={T.paper} fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily={sans}>{leads.length}</text>
              <text x="79" y="28" fill={T.paper} fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily={sans}>{qualifiedCount}</text>
              <text x="133" y="27" fill={T.paper} fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily={sans}>{contactableCount}</text>
            </svg>
          </div>

        </div>
        
        {/* Animated execution progress bars */}
        {(sourceMutation.isPending || qualifyMutation.isPending || complianceMutation.isPending) && (
          <div style={{ marginTop: 14, background: T.ink, height: 4, borderRadius: 2, overflow: "hidden", position: "relative" }}>
            <motion.div 
              initial={{ left: "-100%" }}
              animate={{ left: "100%" }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
              style={{ position: "absolute", top: 0, bottom: 0, width: "30%", background: T.amber }}
            />
          </div>
        )}
      </Panel>

      {/* 2. Double Column Workspace Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 0.95fr)", gap: 16, alignItems: "start" }}>
        
        {/* LEFT COLUMN: Main Directory */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          
          <Panel style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <Eyebrow>funnel candidate directory</Eyebrow>
                <div style={{ font: `400 11px/1.4 ${sans}`, color: T.faint, marginTop: 4 }}>
                  Browse candidates, monitor safety profiles, and check matching criteria.
                </div>
              </div>
              <span style={{ font: `500 10px/1 ${mono}`, color: T.faint }}>ICP: Renewable Energy</span>
            </div>

            {/* Custom Interactive Tab Selectors */}
            <div style={{ display: "flex", gap: 6, borderBottom: `1px solid ${T.line2}`, paddingBottom: 8, marginBottom: 12 }}>
              <LayoutGroup id="leads-tab-system">
                {[
                  { id: "all", label: `All (${leads.length})` },
                  { id: "qualified", label: `Qualified (${qualifiedCount})` },
                  { id: "blocked", label: `Blocked (${blockedCount})` },
                  { id: "outreach-ready", label: `Ready (${eligibleOutreachLeads.length})` }
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`interactive-tab-btn ${isActive ? "active" : ""}`}
                    >
                      {tab.label}
                      {isActive && (
                        <motion.span 
                          layoutId="active-tab-indicator"
                          style={{
                            position: "absolute",
                            bottom: -9,
                            left: 0,
                            right: 0,
                            height: 2,
                            background: T.amber,
                            borderRadius: 1
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </LayoutGroup>
            </div>

            {/* Accessible Search Input */}
            <div style={{ position: "relative", marginBottom: 12 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.faint, display: "flex", alignItems: "center" }}>
                <Search size={14} />
              </span>
              <input
                id={searchInputId}
                type="search"
                placeholder="Search candidates by name, company, or region..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: T.ink,
                  border: `1px solid ${T.line}`,
                  borderRadius: T.radiusMd,
                  padding: "8px 12px 8px 30px",
                  color: T.paper,
                  font: `400 12px/1 ${sans}`,
                  outline: "none"
                }}
              />
            </div>

            {/* Candidate Directory Feed */}
            {leadsLoading && <div style={{ font: `400 12px/1.4 ${sans}`, color: T.faint, padding: "24px 0", textAlign: "center" }}>Loading candidate database…</div>}

            {!leadsLoading && filteredLeads.length === 0 && (
              <EmptyState 
                title="No candidates match" 
                body="Adjust filters, alter search keys, or click Source at the top of the dashboard to generate a new directory batch." 
              />
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <LayoutGroup id="leads-list-layout">
                {filteredLeads.map((l) => {
                  const isExpanded = expandedLeadId === l.id;
                  const highScoring = l.score >= 50;

                  return (
                    <motion.div
                      layout
                      key={l.id}
                      style={{ 
                        borderTop: `1px solid ${T.line}`, 
                        overflow: "hidden" 
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedLeadId(isExpanded ? null : l.id)}
                        aria-expanded={isExpanded}
                        className="hover-row-spring"
                        style={{
                          width: "100%",
                          textAlign: "left",
                          background: "transparent",
                          border: "none",
                          padding: "10px 4px",
                          cursor: "pointer",
                          display: "grid",
                          gridTemplateColumns: "1.2fr 45px auto",
                          gap: 12,
                          alignItems: "center"
                        }}
                      >
                        <div style={{ overflow: "hidden" }}>
                          <div style={{ font: `600 12px/1.2 ${sans}`, color: T.paper, textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}>
                            {l.name}
                            <span style={{ color: T.faint, fontWeight: 400 }}> · {l.company}</span>
                          </div>
                          <div 
                            style={{ 
                              font: `400 10px/1.3 ${sans}`, 
                              color: l.status === "blocked" ? T.clay : T.faint, 
                              marginTop: 2,
                              textOverflow: "ellipsis", 
                              whiteSpace: "nowrap", 
                              overflow: "hidden" 
                            }}
                          >
                            {l.note}
                          </div>
                        </div>

                        <div style={{ font: `700 12px/1 ${mono}`, color: highScoring ? T.teal : T.faint, textAlign: "center" }}>
                          {l.score}
                        </div>

                        <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 6 }}>
                          <Pill 
                            status={l.status === "qualified" ? "ok" : l.status === "blocked" ? "blocked" : "pending"} 
                            label={l.status} 
                          />
                          {isExpanded ? <ChevronUp size={12} color={T.faint} /> : <ChevronDown size={12} color={T.faint} />}
                        </div>
                      </button>

                      {/* Expanding Accordion Drawer */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={springTransition}
                            style={{ overflow: "hidden", background: `${T.panel2}40` }}
                          >
                            <div style={{ padding: "10px 14px", borderTop: `1px dashed ${T.line2}`, display: "flex", flexDirection: "column", gap: 8 }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <div>
                                  <Eyebrow>Candidate Contact</Eyebrow>
                                  <div style={{ font: `500 11px/1.4 ${mono}`, color: T.paper, marginTop: 4 }}>{l.email || "Missing Email"}</div>
                                  <div style={{ font: `400 10px/1.3 ${sans}`, color: T.faint }}>Region: {l.region || "Unassigned"}</div>
                                </div>
                                <div>
                                  <Eyebrow>Validation details</Eyebrow>
                                  <div style={{ font: `400 10px/1.3 ${sans}`, color: T.muted, marginTop: 4 }}>
                                    {l.reasons.length > 0 ? (
                                      <ul style={{ margin: 0, paddingLeft: 12 }}>
                                        {l.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                      </ul>
                                    ) : (
                                      "Compliance sweep pending."
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </motion.div>
                  );
                })}
              </LayoutGroup>
            </div>

            {/* Quick summary band at bottom of leads directory */}
            {!leadsLoading && leads.length > 0 && (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${T.line2}` }}>
                <Stat label="qualified" value={String(qualifiedCount)} color={T.teal} />
                <Stat label="blocked" value={String(blockedCount)} color={T.clay} sub="suppressions" />
                <Stat label="contactable" value={String(contactableCount)} color={T.amber} />
              </div>
            )}
          </Panel>

        </div>

        {/* RIGHT COLUMN: Outreach Workbench & approval flow */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          
          {/* Section 1: Outreach proposals */}
          <Panel style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Eyebrow color={T.amber}>Outreach Proposal Queue</Eyebrow>
              <div className={eligibleOutreachLeads.length > 0 ? "pulse-attention-badge" : ""}>
                <Pill status={eligibleOutreachLeads.length > 0 ? "pending" : "ok"} label={`${eligibleOutreachLeads.length} ready`} />
              </div>
            </div>

            <div style={{ font: `400 11px/1.4 ${sans}`, color: T.faint, marginBottom: 12 }}>
              Draft outreach email variants tailored for ICP-qualified leads. Proposals are instantly routed to the generation engines.
            </div>

            {eligibleOutreachLeads.length === 0 ? (
              <EmptyState 
                title="Queue Clear" 
                body="No candidates currently require email proposals. Sourced and qualified candidates will queue here automatically." 
              />
            ) : (
              <div className="clean-scrollbar-wrapper" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 310, overflowY: "auto", paddingRight: 4 }}>
                <AnimatePresence initial={false}>
                  {eligibleOutreachLeads.map((lead) => (
                    <motion.div
                      key={lead.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0, overflow: "hidden" }}
                      transition={springTransition}
                      style={{ 
                        padding: 10, 
                        background: `${T.line}12`, 
                        borderRadius: T.radiusMd, 
                        border: `1px solid ${T.line2}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div>
                        <div style={{ font: `700 12px/1.2 ${sans}`, color: T.paper }}>{lead.name || lead.company}</div>
                        <div style={{ font: `500 9px/1 ${mono}`, color: T.faint, marginTop: 4 }}>
                          {lead.company} {lead.region ? `· ${lead.region}` : ""} · Score {lead.score}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => proposeMutation.mutate(lead.id)}
                        disabled={proposeMutation.isPending && proposeMutation.variables === lead.id}
                        aria-label={`Propose outreach email draft for candidate ${lead.name || lead.company}`}
                        style={{
                          background: `${T.violet}18`,
                          border: `1px solid ${T.violet}33`,
                          color: T.violet,
                          padding: "6px 10px",
                          borderRadius: T.radiusMd,
                          cursor: "pointer",
                          font: `600 10px/1 ${mono}`,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          transition: "all 0.15s ease"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = T.violet;
                          e.currentTarget.style.color = "#fff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = `${T.violet}18`;
                          e.currentTarget.style.color = T.violet;
                        }}
                      >
                        {proposeMutation.isPending && proposeMutation.variables === lead.id ? "Proposing…" : "Propose"}
                        <ChevronRight size={10} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </Panel>

          {/* Section 2: Conversational approvals */}
          <Panel 
            style={{ padding: 18, borderLeft: pendingApprovalCount > 0 ? `4px solid ${T.clay}` : `4px solid ${T.teal}` }}
            className={pendingApprovalCount > 0 ? "pulse-attention-clay" : ""}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Eyebrow color={pendingApprovalCount > 0 ? T.clay : T.teal}>Outreach Approval Inbox</Eyebrow>
              <Pill status={pendingApprovalCount > 0 ? "blocked" : "ok"} label={`${pendingApprovalCount} pending`} />
            </div>

            <div style={{ font: `400 11px/1.4 ${sans}`, color: T.faint, marginBottom: 12 }}>
              Authorize drafted variants before they are dispatched. Rejections with feedback will trigger adjustments under-the-hood.
            </div>

            {pendingApprovalCount === 0 ? (
              <EmptyState 
                title="Approvals Clear" 
                body="No generated outreach emails are awaiting human validation." 
              />
            ) : (
              <div className="clean-scrollbar-wrapper" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
                <AnimatePresence initial={false}>
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
                </AnimatePresence>
              </div>
            )}
          </Panel>

        </div>

      </div>
    </motion.div>
  );
}