import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import NumberFlow from "@number-flow/react";
import {
  Film,
  CheckSquare,
  Mic,
  Plus,
  Info,
  Check,
  X,
  Play,
  RotateCcw,
  ShieldCheck,
  Lock,
  ChevronRight,
  AlertTriangle,
  Trash2,
  Sparkles,
  Zap
} from "lucide-react";
import { studioApiCalls } from "../../api";
import {
  Panel,
  Eyebrow,
  Pill,
  Btn,
  EmptyState,
  ErrorBanner,
  errorGuidance,
  Lamp,
  T,
  mono,
  sans,
  useBreakpoint,
  Modal,
} from "../shared/ui";
import { STAGES, SignalChain, StageReviewBanner } from "../shared/pipeline";
import { ACTIVE_PROJECT_KEY } from "../library/AllEpisodes";
import { useTheme } from "../../ThemeContext";

// Expanded genre selection for consumers
const GENRES = [
  "kids_cartoon",
  "brand_explainer",
  "drama",
  "comedy",
  "educational_explainer",
  "horror_thriller",
  "sci_fi_fantasy",
  "documentary",
  "action_adventure",
  "marketing_ad"
];

// Rich details mapping for visual selector grid
const GENRE_DETAILS = {
  kids_cartoon: { label: "Kids Cartoon", desc: "Kid-safe cartoon animation" },
  brand_explainer: { label: "Brand Explainer", desc: "Clean business presentation" },
  drama: { label: "Drama", desc: "Emotional movie story" },
  comedy: { label: "Comedy", desc: "Funny and playful story" },
  educational_explainer: { label: "Educational", desc: "Clear lessons and explanations" },
  horror_thriller: { label: "Horror / Thriller", desc: "Suspenseful and spooky" },
  sci_fi_fantasy: { label: "Sci-Fi & Fantasy", desc: "Space and magical worlds" },
  documentary: { label: "Documentary", desc: "Real-world stories with narration" },
  action_adventure: { label: "Action & Adventure", desc: "Fast-moving excitement" },
  marketing_ad: { label: "Marketing Ad", desc: "Catchy video promo" }
};

// Prompt templates to help consumers get started instantly
const PROMPT_INSPIRATIONS = [
  "An astronaut finding a giant floating cookie in space",
  "A tiny friendly dragon learning how to blow bubbles",
  "Two detective squirrels chasing a missing golden acorn",
  "A neon cyberpunk city run completely by robot street chefs"
];

// Mapping structure for consumer friendly phases [2]
const PHASES = [
  {
    id: "writing_visuals",
    name: "Story & Artwork",
    description: "Writing the script and drawing the scenes",
    stages: ["generate_script", "generate_scenes", "storyboard", "generate_keyframes", "generate_clips"]
  },
  {
    id: "dialogue_audio",
    name: "Voices & Music",
    description: "Choosing voice actors and adding soundtrack",
    stages: ["cast_voices", "generate_audio", "synthesize_speech", "generate_music"]
  },
  {
    id: "assembly_render",
    name: "Video Creation",
    description: "Putting video, voices, and music together",
    stages: ["assemble_video", "render_video", "mix_audio", "mux_video"]
  }
];

export default function StudioCommandCenter() {
  // Subscribes this component to theme changes directly
  useTheme();

  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const bp = useBreakpoint();
  const navigate = useNavigate();
  const inspectorRef = useRef(null);
  const createFormRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Which project to inspect on load, in priority order: ?project=, then localStorage, then auto select first project
  const [selectedId, setSelectedId] = useState(
    () => searchParams.get("project") || localStorage.getItem(ACTIVE_PROJECT_KEY) || ""
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [concept, setConcept] = useState("");
  const [genre, setGenre] = useState("kids_cartoon");
  const [reviewMode, setReviewMode] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [resumingId, setResumingId] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);

  // Progressive Disclosure toggle
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);

  // Interactive manual reload state
  const [isSpinning, setIsSpinning] = useState(false);

  // Centralized scrolling helper with timing buffer to allow React layout updates to commit [2]
  const scrollToInspector = (delay = 80) => {
    setTimeout(() => {
      inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, delay);
  };

  // Toggle Creator Wizard and scroll to align input at top of view on smaller viewports
  const handleToggleCreateForm = () => {
    setShowCreateForm((prev) => {
      const nextState = !prev;
      if (nextState) {
        setTimeout(() => {
          createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      }
      return nextState;
    });
  };

  // Top level projects list
  const { data: projectsData, error: listError } = useQuery({
    queryKey: ["studio-command-center-projects"],
    queryFn: () => studioApiCalls.listProjects(50, 0),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const projects = projectsData?.items || [];

  // Auto select the first project on initial load if none is selected
  useEffect(() => {
    if (!selectedId && projects.length > 0) {
      setSelectedId(projects[0].id);
    }
  }, [projects, selectedId]);

  // Keep localStorage in sync with whatever project is currently selected
  useEffect(() => {
    if (selectedId) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, selectedId);
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  }, [selectedId]);

  // Once the incoming ?project= id has been consumed into state, drop it from searchParams
  useEffect(() => {
    if (searchParams.get("project")) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selected project detail fetch
  const { data: project, error: detailError, isFetching } = useQuery({
    queryKey: ["studio-command-center-project", selectedId],
    queryFn: () => studioApiCalls.getProject(selectedId),
    enabled: !!selectedId,
    refetchInterval: (query) => {
      const data = query?.state?.data;
      if (!data) return false;
      const stages = data.stages || [];
      const isDone = data.final_av_uri || data.final_uri || data.status === "done";
      const hasFail = stages.some((s) => s.status === "failed");
      const isAwaiting = stages.some((s) => s.status === "awaiting_review" || data.awaiting_review_stage);
      
      const settled = isDone || hasFail || isAwaiting;
      return settled ? 15_000 : 2000;
    }
  });

  // Derived properties from active project
  const projectStages = project?.stages || [];
  const doneCount = projectStages.filter((s) => s.status === "done").length;
  const failedStage = projectStages.find((s) => s.status === "failed");
  const awaitingStageName = project?.awaiting_review_stage || projectStages.find((s) => s.status === "awaiting_review")?.name;
  const isProjectRunning = projectStages.some((s) => s.status === "running") || project?.status === "running";

  // Auto escalation: Force expand advanced details if there is a failure or active manual intervention [2]
  useEffect(() => {
    if (project) {
      const hasFail = projectStages.some((s) => s.status === "failed");
      const isAwaiting = projectStages.some((s) => s.status === "awaiting_review" || project?.awaiting_review_stage);
      if (hasFail || isAwaiting) {
        setShowAdvancedDetails(true);
      }
    }
  }, [project, projectStages]);

  // Action mutations
  const approve = useMutation({
    mutationFn: ({ id, stage, note }) => studioApiCalls.approveStage(id, stage, note),
    onSuccess: () => {
      qc.invalidateQueries(["studio-command-center-projects"]);
      if (selectedId) qc.invalidateQueries(["studio-command-center-project", selectedId]);
    },
  });

  const reject = useMutation({
    mutationFn: ({ id, stage, promptOverride, note }) => studioApiCalls.rejectStage(id, stage, promptOverride, note),
    onSuccess: () => {
      qc.invalidateQueries(["studio-command-center-projects"]);
      if (selectedId) qc.invalidateQueries(["studio-command-center-project", selectedId]);
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id) => {
      if (studioApiCalls.deleteProject) {
        return await studioApiCalls.deleteProject(id);
      }
      const response = await fetch(`/v1/projects/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete project from database");
      return true;
    },
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries(["studio-command-center-projects"]);
      if (selectedId === deletedId) {
        setSelectedId("");
      }
    },
    onError: (err) => {
      setActionError(errorGuidance(err, "Could not delete episode."));
    }
  });

  // Derived lists
  const awaiting = projects
    .map((p) => ({ project: p, stage: p.stages?.find((s) => s.status === "awaiting_review") }))
    .filter((row) => row.stage);

  const activeProjects = [...projects]
    .filter((p) => !(p.final_av_uri || p.final_uri || p.status === "done"))
    .sort((a, b) => {
      const aDate = a.updated_at || a.created_at || "";
      const bDate = b.updated_at || b.created_at || "";
      return String(bDate).localeCompare(String(aDate));
    })
    .slice(0, 5);

  const scenes = project?.episode?.scenes || [];
  const hasRealShots = scenes.some((s) => (s.shots || []).length > 0);
  const isProjectDone = project?.final_av_uri || project?.final_uri || project?.status === "done";

  let cast = [];
  if (project?.voice_cast) {
    cast = Array.isArray(project.voice_cast)
      ? project.voice_cast.map((c) => [c.character || c.name, c.voice || c.voice_id])
      : Object.entries(project.voice_cast);
  }

  // Map state to individual consumer phases
  const getPhaseStatus = (phaseStages) => {
    if (!projectStages || projectStages.length === 0) return "pending";
    const targetStages = projectStages.filter(s => phaseStages.includes(s.name));
    if (targetStages.length === 0) return "pending";

    if (targetStages.some(s => s.status === "failed")) return "blocked";
    if (targetStages.some(s => s.status === "awaiting_review")) return "awaiting_review";
    if (targetStages.some(s => s.status === "running")) return "running";
    
    const allDone = targetStages.every(s => s.status === "done");
    if (allDone) return "done";
    if (targetStages.some(s => s.status === "done")) return "running";

    return "pending";
  };

  // Create an episode
  async function handleCreate() {
    setCreateError(null);
    setCreating(true);
    try {
      const { id } = await studioApiCalls.createProject(concept, genre, reviewMode);
      await studioApiCalls.runProject(id, { background: true });
      setConcept("");
      setShowCreateForm(false);
      setSelectedId(id);
      scrollToInspector(120); // slightly longer timing delay for new templates to render [2]
      qc.invalidateQueries(["studio-command-center-projects"]);
    } catch (e) {
      setCreateError(errorGuidance(e, "Episode did not start."));
    } finally {
      setCreating(false);
    }
  }

  // Resume pipeline action
  async function handleResume(id) {
    setActionError(null);
    setResumingId(id);
    setSelectedId(id); // auto select the project we are resuming
    try {
      await studioApiCalls.runProject(id, { background: true });
      qc.invalidateQueries(["studio-command-center-projects"]);
      qc.invalidateQueries(["studio-command-center-project", id]);
      scrollToInspector(80);
    } catch (e) {
      setActionError(errorGuidance(e, "Pipeline did not resume."));
    } finally {
      setResumingId(null);
    }
  }

  // Manual refresh logic mapping directly to React Query invalidation
  const handleManualRefresh = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    qc.invalidateQueries({ queryKey: ["studio-command-center-projects"] });
    if (selectedId) {
      qc.invalidateQueries({ queryKey: ["studio-command-center-project", selectedId] });
    }
    setTimeout(() => {
      setIsSpinning(false);
    }, 800);
  };

  const fade = reduceMotion ? { duration: 0 } : { duration: 0.2 };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fade}
      style={{ maxWidth: 1150, margin: "0 auto" }}
    >
      {/* Scrollbar & Attention Pulse Animation rules */}
      <style>{`
        .clean_scrollbar_wrapper,
        .clean_scrollbar_wrapper * {
          scrollbar-width: none !important; /* Firefox */
          -ms-overflow-style: none !important;  /* IE/Edge */
        }
        .clean_scrollbar_wrapper::-webkit-scrollbar,
        .clean_scrollbar_wrapper *::-webkit-scrollbar {
          display: none !important; /* Chrome/Safari/Opera */
        }

        /* Ambient glowing focus ring animation for items needing action */
        @keyframes attention_glow {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes review_glow {
          0% { box-shadow: 0 0 0 0 rgba(124, 134, 224, 0.45); }
          70% { box-shadow: 0 0 0 6px rgba(124, 134, 224, 0); }
          100% { box-shadow: 0 0 0 0 rgba(124, 134, 224, 0); }
        }
        
        .pulse_attention {
          animation: attention_glow 2.2s infinite ease;
          border-radius: 999px;
          display: inline_block;
        }
        .pulse_review {
          animation: review_glow 2.2s infinite ease;
          border-radius: 999px;
          display: inline_block;
        }

        /* Background processing rotation styling */
        @keyframes spin_slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin_slow {
          animation: spin_slow 8s linear infinite;
        }

        /* Satisfying, fast manual click rotation styling */
        @keyframes spin_manual {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin_active {
          animation: spin_manual 0.8s ease;
        }
        
        /* Subtle interactive scale transitions */
        .workspace_row {
          transition: background-color 0.2s ease, transform 0.15s ease;
        }
        .workspace_row:hover {
          background-color: var(--theme-hover, rgba(255, 255, 255, 0.025)) !important;
        }
      `}</style>

      {/* Modern Integrated Operations Header */}
      <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ font: `700 22px/1.1 ${sans}`, color: T.paper, margin: 0, letterSpacing: "-0.01em" }}>
                Production Command Center
              </h1>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: `${T.teal}12`,
                border: `1px solid ${T.teal}25`,
                padding: "3px 8px",
                borderRadius: 99,
                font: `600 10px/1 ${mono}`,
                color: T.teal,
                textTransform: "uppercase",
                letterSpacing: "0.05em"
              }}>
                <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: 99, background: T.teal }} />
                Live console
              </div>
            </div>
            <p style={{ font: `400 12px/1.5 ${sans}`, color: T.muted, margin: "6px 0 0 0", maxWidth: 580 }}>
              Monitor media generation across all stages: review paused pipelines, visually track progress, and play generated outputs.
            </p>
          </div>

          <Btn kind="primary" icon={Plus} onClick={handleToggleCreateForm}>
            New episode
          </Btn>
        </div>

        {/* Quick Metrics & System Health Strip */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12
        }}>
          {/* Total Episodes Card */}
          <div style={{
            background: T.panel,
            border: `1px solid ${T.line}`,
            borderRadius: T.radiusMd,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div>
              <Eyebrow color={T.faint}>Total episodes</Eyebrow>
              <div style={{ font: `700 22px/1 ${mono}`, color: T.paper, marginTop: 4 }}>
                <NumberFlow value={projects.length} />
              </div>
            </div>
            <div style={{
              background: `${T.line}40`,
              width: 32,
              height: 32,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: T.muted
            }}>
              <Film size={16} />
            </div>
          </div>

          {/* Pending Review Card */}
          <div style={{
            background: T.panel,
            border: `1px solid ${awaiting.length > 0 ? `${T.hitl}44` : T.line}`,
            borderRadius: T.radiusMd,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: awaiting.length > 0 ? `0 0 12px ${T.hitl}0A` : "none",
            transition: "border-color 0.2s ease"
          }}>
            <div>
              <Eyebrow color={awaiting.length > 0 ? T.hitl : T.faint}>Pending review</Eyebrow>
              <div style={{ font: `700 22px/1 ${mono}`, color: awaiting.length > 0 ? T.hitl : T.paper, marginTop: 4 }}>
                <NumberFlow value={awaiting.length} />
              </div>
            </div>
            <div style={{
              background: awaiting.length > 0 ? `${T.hitl}1A` : `${T.line}40`,
              width: 32,
              height: 32,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: awaiting.length > 0 ? T.hitl : T.muted,
              transition: "all 0.2s ease"
            }}>
              <CheckSquare size={16} />
            </div>
          </div>

          {/* Interactive System Status Card */}
          <div style={{
            background: T.panel,
            border: `1px solid ${T.line}`,
            borderRadius: T.radiusMd,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div>
              <Eyebrow color={T.teal}>System Status</Eyebrow>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <Lamp on={isFetching || isProjectRunning} color={T.teal} size={8} />
                <span style={{ font: `600 13px/1 ${sans}`, color: T.paper }}>
                  {isProjectRunning ? "Pipeline Active" : "Auto refreshing"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isSpinning || isFetching}
              aria-label="Refresh pipeline status"
              style={{
                background: `${T.line}40`,
                width: 32,
                height: 32,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: T.muted,
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = T.teal;
                e.currentTarget.style.background = `${T.teal}12`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = T.muted;
                e.currentTarget.style.background = `${T.line}40`;
              }}
            >
              <RotateCcw 
                size={16} 
                className={isSpinning ? "spin_active" : (isFetching || isProjectRunning ? "spin_slow" : "")} 
              />
            </button>
          </div>
        </div>
      </div>

      {/* Creation form container styled as an isolated consumer Creator Wizard */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            ref={createFormRef}
            initial={reduceMotion ? false : { opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={fade}
            style={{ overflow: "hidden" }}
          >
            <Panel style={{ padding: 24, marginBottom: 20, border: `1px solid ${T.line2}`, background: T.panel }}>
              
              {/* Header Wordmark */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <Sparkles size={16} color={T.amber} />
                <div style={{ font: `700 14px/1 ${sans}`, color: T.paper }}>Configure and Launch Episode</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                
                {/* Step 1: Prompt Input & Clickable Starters */}
                <div>
                  <label style={{ display: "block", font: `600 11px/1 ${mono}`, color: T.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    1. Write Your Concept
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder='e.g. "Pip and Bo explore an enchanted forest"'
                      value={concept}
                      onChange={(e) => setConcept(e.target.value)}
                      disabled={creating}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: T.radiusMd,
                        background: T.ink,
                        border: `1px solid ${T.line2}`,
                        color: T.paper,
                        font: `400 13px/1.5 ${sans}`,
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                  
                  {/* Quick Starter Inspiration tag chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {PROMPT_INSPIRATIONS.map((insp) => (
                      <button
                        key={insp}
                        type="button"
                        disabled={creating}
                        onClick={() => setConcept(insp)}
                        style={{
                          background: "transparent",
                          border: `1px solid ${T.line}88`,
                          borderRadius: 99,
                          padding: "5px 10px",
                          font: `500 10px/1.3 ${sans}`,
                          color: T.faint,
                          cursor: creating ? "not-allowed" : "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!creating) {
                            e.currentTarget.style.borderColor = T.muted;
                            e.currentTarget.style.color = T.paper;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!creating) {
                            e.currentTarget.style.borderColor = `${T.line}88`;
                            e.currentTarget.style.color = T.faint;
                          }
                        }}
                      >
                        {insp}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Scrollable Genre Picker Carousel */}
                <div>
                  <label style={{ display: "block", font: `600 11px/1 ${mono}`, color: T.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    2. Select Video Genre
                  </label>
                  <div 
                    style={{ 
                      display: "flex", 
                      gap: 8, 
                      overflowX: "auto", 
                      padding: "4px 6px 10px 6px",
                      margin: "-4px -6px 0 -6px",
                      scrollbarWidth: "none",
                      scrollPadding: "6px"
                    }} 
                    className="clean_scrollbar_wrapper"
                  >
                    {GENRES.map((g) => {
                      const active = genre === g;
                      const details = GENRE_DETAILS[g] || { label: g, desc: "Pipeline format rendering" };
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGenre(g)}
                          disabled={creating}
                          title={details.desc}
                          style={{
                            flex: "0 0 auto",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 16px",
                            borderRadius: T.radiusMd,
                            background: active ? `${T.violet}22` : `${T.ink}40`,
                            border: `1px solid ${active ? T.violet : T.line2}`,
                            boxShadow: active ? `0 0 0 1px ${T.violet}` : "none",
                            color: active ? T.paper : T.muted,
                            cursor: creating ? "not-allowed" : "pointer",
                            font: `600 11px/1 ${mono}`,
                            transition: "all 0.15s ease",
                            outline: "none"
                          }}
                        >
                          <span>{details.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3: Launch Config Options & Action Trigger */}
                <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  
                  {/* Parameter Switches and Safety Context Alerts */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ font: `500 11px/1 ${mono}`, color: T.faint, textTransform: "uppercase" }}>Review Mode</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={reviewMode}
                          aria-label="Toggle Review Mode"
                          onClick={() => setReviewMode((r) => !r)}
                          disabled={creating}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            cursor: creating ? "not-allowed" : "pointer",
                          }}
                        >
                          <span
                            style={{
                              width: 36,
                              height: 20,
                              borderRadius: 99,
                              padding: 2,
                              background: reviewMode ? "rgba(16, 185, 129, 0.2)" : "rgba(167, 139, 250, 0.2)",
                              border: `1.5px solid ${reviewMode ? "#10b981" : "#a78bfa"}`,
                              boxSizing: "border-box",
                              transition: "all .2s ease",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: reviewMode ? "flex-end" : "flex-start",
                            }}
                          >
                            <span 
                              style={{ 
                                width: 14, 
                                height: 14, 
                                borderRadius: 99, 
                                background: reviewMode ? "#10b981" : "#a78bfa",
                                boxShadow: reviewMode ? "0 0 6px rgba(16, 185, 129, 0.6)" : "0 0 6px rgba(167, 139, 250, 0.4)",
                                transition: "all .2s ease" 
                              }} 
                            />
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Dynamic Context warnings and labels based on selected parameters */}
                    <div style={{ minHeight: 18 }}>
                      {genre === "kids_cartoon" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, font: `500 11px/1.4 ${mono}`, color: T.violet }}>
                          <Lock size={12} /> Kids content routes script, dialogue &amp; music through moderation gated models.
                        </div>
                      ) : reviewMode ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, font: `500 11px/1.4 ${mono}`, color: "#10b981" }}>
                          <ShieldCheck size={12} /> Pipeline will pause after each stage for your manual review.
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, font: `500 11px/1.4 ${mono}`, color: T.faint }}>
                          <Zap size={11} /> Fully autonomous synthesis is active. Your media player compiles automatically.
                        </div>
                      )}
                    </div>
                  </div>

                  <Btn kind="ok" onClick={handleCreate} disabled={creating || !concept.trim()}>
                    {creating ? "Launching Synthesis..." : "Generate Episode"}
                  </Btn>
                </div>

              </div>

              {createError && <div style={{ marginTop: 14 }}><ErrorBanner error={createError} /></div>}
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      {actionError && <div style={{ marginBottom: 16 }}><ErrorBanner error={actionError} /></div>}
      {listError && (
        <div style={{ marginBottom: 16 }}>
          <ErrorBanner error={errorGuidance(listError, "Could not load projects.")} />
        </div>
      )}

      {/* Human Review Queue banner */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckSquare color={T.hitl} size={16} />
            <h3 style={{ font: `700 15px/1 ${sans}`, color: T.paper, margin: 0 }}>Needs your review</h3>
            {awaiting.length > 0 && (
              <span style={{ font: `500 11px/1 ${mono}`, color: T.hitl, background: `${T.hitl}22`, padding: "3px 8px", borderRadius: T.radiusMd }}>
                <NumberFlow value={awaiting.length} /> pending
              </span>
            )}
          </div>
          {awaiting.length > 4 && (
            <Btn size="sm" kind="ghost" onClick={() => navigate("/activity-log")}>
              See all {awaiting.length}
              <ChevronRight size={13} />
            </Btn>
          )}
        </div>

        {awaiting.length === 0 ? (
          <EmptyState title="Nothing waiting on review" body="All active pipelines are running smoothly." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
            {awaiting.slice(0, 4).map(({ project: p, stage }) => (
              <motion.div key={p.id} layout transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 25 }}>
                <Panel style={{ padding: 14, borderLeft: `3px solid ${T.hitl}`, height: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: `700 13px/1.3 ${sans}`, color: T.paper, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.title || p.id}
                      </div>
                      <div style={{ font: `500 10px/1.4 ${mono}`, color: T.faint, marginTop: 4 }}>
                        stopped at: <span style={{ color: T.hitl, fontWeight: 700 }}>{stage.name.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <Pill status="awaiting_review" label="Review" />
                  </div>
                  <div style={{ marginTop: "auto", display: "flex", gap: 6 }}>
                    <button
                      title="Approve & continue"
                      aria-label="Approve & continue"
                      onClick={() => {
                        setSelectedId(p.id);
                        approve.mutate({ id: p.id, stage: stage.name });
                        scrollToInspector(80);
                      }}
                      disabled={approve.isPending}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                        background: `${T.teal}1A`, color: T.teal, border: `1px solid ${T.teal}55`,
                        borderRadius: 6, padding: "7px 0", cursor: approve.isPending ? "not-allowed" : "pointer",
                        opacity: approve.isPending ? 0.6 : 1,
                      }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      title="Reject"
                      aria-label="Reject"
                      onClick={() => {
                        setSelectedId(p.id);
                        reject.mutate({ id: p.id, stage: stage.name });
                        scrollToInspector(80);
                      }}
                      disabled={reject.isPending}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                        background: `${T.clay}1A`, color: T.clay, border: `1px solid ${T.clay}55`,
                        borderRadius: 6, padding: "7px 0", cursor: reject.isPending ? "not-allowed" : "pointer",
                        opacity: reject.isPending ? 0.6 : 1,
                      }}
                    >
                      <X size={14} />
                    </button>
                    <button
                      title="Inspect pipeline"
                      aria-label="Inspect pipeline"
                      onClick={() => {
                        setSelectedId(p.id);
                        scrollToInspector(80);
                      }}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                        background: "transparent", color: T.muted, border: `1px solid ${T.line2}`,
                        borderRadius: 6, padding: "7px 0", cursor: "pointer",
                      }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </Panel>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Episode Inspector (Signal Chain + Output View) */}
      <section ref={inspectorRef} style={{ borderTop: `1px solid ${T.line}`, paddingTop: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div>
            <Eyebrow color={T.amber}>Episode inspector</Eyebrow>
            <div style={{ font: `700 15px/1 ${sans}`, color: T.paper, marginTop: 2 }}>Visual signal chain &amp; production inspector</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ font: `500 12px/1 ${sans}`, color: T.faint }}>Selected:</span>
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                scrollToInspector(80);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: T.radiusMd,
                background: T.panel2,
                color: T.paper,
                border: `1px solid ${T.line}`,
                font: `500 12px/1 ${sans}`
              }}
            >
              <option value="">Select an episode…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title || p.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>
        </div>

        {!selectedId ? (
          <EmptyState title="No episode selected" body="Select an episode above to inspect its active signal chain and final media outputs." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {detailError && <ErrorBanner error={errorGuidance(detailError, "Could not load episode details.")} />}

            {/* Stage Interventions inside Inspector */}
            {failedStage && (
              <Panel style={{ padding: 14, border: `1px solid ${T.clay}55` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertTriangle color={T.clay} size={14} />
                      <Eyebrow color={T.clay}>Stage Failed: {failedStage.name.replace(/_/g, " ")}</Eyebrow>
                    </div>
                    {failedStage.error && (
                      <div style={{ font: `400 11px/1.4 ${mono}`, color: T.faint, marginTop: 4, maxWidth: 650 }}>
                        {String(failedStage.error)}
                      </div>
                    )}
                  </div>
                  <Btn kind="ok" icon={Play} onClick={() => handleResume(project.id)} disabled={resumingId === project.id}>
                    {resumingId === project.id ? "Resuming…" : "Resume Pipeline"}
                  </Btn>
                </div>
              </Panel>
            )}

            {awaitingStageName && project && (
              <StageReviewBanner
                project={project}
                stageName={awaitingStageName}
                onApprove={(stage, note) => approve.mutate({ id: project.id, stage, note })}
                onReject={(stage, promptOverride, note) => reject.mutate({ id: project.id, stage, promptOverride, note })}
                disabled={approve.isPending || reject.isPending}
              />
            )}

            {/* Two Column Workspace Layout */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: bp === "desktop" ? "minmax(0, 1.35fr) minmax(0, 1fr)" : "1fr", 
              gap: 16, 
              alignItems: "stretch" 
            }}>
              
              {/* Row 1, Column 1: Progressive visual tracker */}
              <Panel style={{ padding: 18, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                      <Eyebrow color={T.amber}>Production Progress</Eyebrow>
                      <div style={{ font: `600 13px/1.3 ${sans}`, color: T.paper, marginTop: 2 }}>Production Stages</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedDetails(prev => !prev)}
                      style={{
                        background: "transparent",
                        border: `1px solid ${T.line2}`,
                        borderRadius: T.radiusMd,
                        padding: "4px 8px",
                        color: T.muted,
                        font: `500 10px/1 ${mono}`,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all .15s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = T.muted;
                        e.currentTarget.style.color = T.paper;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = T.line2;
                        e.currentTarget.style.color = T.muted;
                      }}
                    >
                      {showAdvancedDetails ? "Hide Detailed Steps" : "Show Detailed Steps"}
                    </button>
                  </div>

                  {/* 3 High Level Consumer Friendly Cards */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: showAdvancedDetails ? 20 : 0 }}>
                    {PHASES.map((phase) => {
                      const phaseStatus = getPhaseStatus(phase.stages);
                      
                      // Map state to human descriptions
                      const statusLabels = {
                        done: "Complete",
                        running: "In Progress",
                        blocked: "Needs Attention",
                        awaiting_review: "Ready for Review",
                        pending: "Waiting"
                      };

                      return (
                        <div
                          key={phase.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 14px",
                            background: phaseStatus === "running" ? `${T.amber}05` : phaseStatus === "blocked" ? `${T.clay}05` : `${T.line}0F`,
                            borderRadius: T.radiusMd,
                            border: `1px solid ${
                              phaseStatus === "running" ? `${T.amber}33` : 
                              phaseStatus === "blocked" ? `${T.clay}33` : 
                              phaseStatus === "awaiting_review" ? `${T.hitl}33` : 
                              T.line2
                            }`,
                            transition: "all 0.2s ease"
                          }}
                        >
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            {/* Visual LED Lamp */}
                            <Lamp 
                              on={phaseStatus === "running" || phaseStatus === "blocked" || phaseStatus === "awaiting_review"} 
                              color={
                                phaseStatus === "done" ? T.teal : 
                                phaseStatus === "blocked" ? T.clay : 
                                phaseStatus === "awaiting_review" ? T.hitl : 
                                T.amber
                              } 
                              size={10} 
                            />
                            <div>
                              <div style={{ font: `600 13px/1.2 ${sans}`, color: T.paper }}>
                                {phase.name}
                              </div>
                              <div style={{ font: `400 11px/1.3 ${sans}`, color: T.faint, marginTop: 2 }}>
                                {phase.description}
                              </div>
                            </div>
                          </div>
                          
                          <Pill 
                            status={phaseStatus} 
                            label={statusLabels[phaseStatus] || phaseStatus} 
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Detailed Signal Chain Node Map (Advanced Mode) */}
                  <AnimatePresence initial={false}>
                    {showAdvancedDetails && (
                      <motion.div
                        initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={fade}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 16, marginTop: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <Eyebrow color={T.muted}>Step-by-Step Progress</Eyebrow>
                            <span style={{ font: `500 10px/1 ${mono}`, color: T.faint }}>
                              {doneCount}/{projectStages.length || STAGES.length} steps complete
                            </span>
                          </div>
                          {isFetching && !project ? (
                            <div style={{ font: `500 12px/1 ${mono}`, color: T.faint, padding: "10px 0", textAlign: "center" }}>Loading steps…</div>
                          ) : (
                            <div className="clean_scrollbar_wrapper" style={{ paddingBottom: 4 }}>
                              <SignalChain project={project} idx={doneCount} running={isProjectRunning} />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Panel>

              {/* Row 1, Column 2: Voice Casting Details (hidden on smaller screens if no cast) */}
              {(bp === "desktop" || cast.length > 0) && (
                <Panel style={{ padding: 18, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Mic color={T.violet} size={15} />
                      <h4 style={{ font: `700 14px/1 ${sans}`, color: T.paper, margin: 0 }}>Voice Casting</h4>
                    </div>

                    {isFetching && !project ? (
                      <div style={{ font: `500 11px/1 ${mono}`, color: T.faint }}>Loading voices…</div>
                    ) : cast.length === 0 ? (
                      <EmptyState title="No cast yet" body="Character voices will appear once voices are chosen." />
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {cast.map(([character, voice]) => (
                          <div
                            key={character}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "10px 14px",
                              background: `${T.line}18`,
                              borderRadius: T.radiusMd,
                              border: `1px solid ${T.line2}`
                            }}
                          >
                            <span style={{ font: `600 12px/1 ${sans}`, color: T.paper }}>{character}</span>
                            <span style={{
                              font: `500 10px/1 ${mono}`,
                              color: T.violet,
                              background: `${T.violet}12`,
                              padding: "3px 8px",
                              borderRadius: T.radiusMd,
                              border: `1px solid ${T.violet}22`
                            }}>
                              {voice}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    marginTop: 14,
                    paddingTop: 10,
                    borderTop: `1px solid ${T.line}`,
                    font: `500 10px/1 ${mono}`, 
                    color: T.faint 
                  }}>
                    <span>{cast.length} Character Voice{cast.length === 1 ? "" : "s"}</span>
                    <span style={{ color: T.teal }}>Voice Audio</span>
                  </div>
                </Panel>
              )}

              {/* Row 2, Column 1: Final Video Output Container */}
              {bp !== "desktop" ? (
                /* Compact trigger on smaller screens to preserve vertical space */
                <Panel style={{ padding: 16, boxSizing: "border-box" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div style={{ 
                        width: 38, 
                        height: 38, 
                        borderRadius: 8, 
                        background: isProjectDone ? `${T.teal}18` : isProjectRunning ? `${T.amber}18` : `${T.line}22`,
                        border: `1px solid ${isProjectDone ? `${T.teal}33` : isProjectRunning ? `${T.amber}33` : T.line2}`,
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        flexShrink: 0
                      }}>
                        {isProjectDone ? <Play color={T.teal} size={18} /> : <Film color={isProjectRunning ? T.amber : T.muted} size={18} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ font: `700 14px/1.2 ${sans}`, color: T.paper }}>
                          Final Video Output
                        </div>
                        <div style={{ font: `400 11px/1.3 ${sans}`, color: isProjectDone ? T.teal : T.faint, marginTop: 2, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {isProjectDone 
                            ? "Video is ready to play" 
                            : isProjectRunning 
                              ? "Creating your video…" 
                              : failedStage 
                                ? "Production paused" 
                                : awaitingStageName 
                                  ? "Ready for your review" 
                                  : "No video created yet"}
                        </div>
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {isProjectDone ? (
                        <Btn size="sm" kind="primary" onClick={() => setShowVideoModal(true)}>
                          <Play size={13} style={{ marginRight: 6 }} /> Watch Video
                        </Btn>
                      ) : (
                        <Btn size="sm" onClick={() => setShowVideoModal(true)}>
                          View Status
                        </Btn>
                      )}
                    </div>
                  </div>
                </Panel>
              ) : (
                /* Full inline player on desktop */
                <Panel style={{ padding: 18, height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Film color={T.teal} size={15} />
                    <h4 style={{ font: `700 14px/1 ${sans}`, color: T.paper, margin: 0 }}>Final Video Output</h4>
                  </div>

                  <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    {isProjectDone ? (
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", borderRadius: T.radiusMd, overflow: "hidden", minHeight: 320 }}>
                        <video
                          controls
                          style={{ width: "100%", height: "100%", maxHeight: 380, borderRadius: T.radiusMd, background: "#000", objectFit: "contain" }}
                          src={studioApiCalls.videoUrl ? studioApiCalls.videoUrl(project.id) : project.final_av_uri || project.final_uri}
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    ) : (
                      <div style={{
                        flex: 1, minHeight: 320, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 12,
                        background: `${T.ink}88`, borderRadius: T.radiusMd, border: `2px dashed ${T.line2}`,
                        padding: 24, textAlign: "center"
                      }}>
                        {isProjectRunning ? (
                          <>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <Lamp on color={T.teal} size={10} />
                              <span style={{ font: `600 13px/1 ${sans}`, color: T.teal }}>In Progress</span>
                            </div>
                            <div style={{ font: `700 15px/1 ${sans}`, color: T.paper }}>Creating Your Video…</div>
                            <div style={{ font: `400 12px/1.5 ${sans}`, color: T.faint, maxWidth: 320 }}>
                              We are creating the pictures, voices, and music for your episode. It will appear here as soon as it is finished!
                            </div>
                          </>
                        ) : failedStage ? (
                          <>
                            <div style={{ font: `600 13px/1 ${sans}`, color: T.clay }}>Production Paused</div>
                            <div style={{ font: `700 15px/1 ${sans}`, color: T.paper }}>Something Needs Attention</div>
                            <div style={{ font: `400 12px/1.5 ${sans}`, color: T.faint, maxWidth: 320 }}>
                              We ran into an issue during the <span style={{ color: T.clay, fontFamily: mono }}>{failedStage.name.replace(/_/g, " ")}</span> step. Please review above to continue.
                            </div>
                          </>
                        ) : awaitingStageName ? (
                          <>
                            <div style={{ font: `600 13px/1 ${sans}`, color: T.hitl }}>Review Needed</div>
                            <div style={{ font: `700 15px/1 ${sans}`, color: T.paper }}>Your Approval Needed</div>
                            <div style={{ font: `400 12px/1.5 ${sans}`, color: T.faint, maxWidth: 320 }}>
                              The video is paused at <span style={{ color: T.hitl, fontFamily: mono }}>{awaitingStageName.replace(/_/g, " ")}</span>. Please review and approve this step above to continue.
                            </div>
                          </>
                        ) : (
                          <>
                            <Film color={T.faint} size={24} />
                            <div style={{ font: `700 14px/1 ${sans}`, color: T.faint }}>No Video Yet</div>
                            <div style={{ font: `400 12px/1.5 ${sans}`, color: T.faint, maxWidth: 320 }}>
                              Create a new episode or choose a project to watch the video here.
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </Panel>
              )}

              {/* Row 2, Column 2: Shot Breakdowns (hidden on smaller screens if no shots) */}
              {(bp === "desktop" || hasRealShots) && (
                <Panel style={{ padding: 18, height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Film color={T.amber} size={15} />
                    <h4 style={{ font: `700 14px/1 ${sans}`, color: T.paper, margin: 0 }}>Shot Breakdown</h4>
                  </div>

                  {isFetching && !project ? (
                    <div style={{ font: `500 11px/1 ${mono}`, color: T.faint }}>Loading shots…</div>
                  ) : !hasRealShots ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <EmptyState title="No shots yet" body="Shots will appear here once the script is generated." />
                    </div>
                  ) : (
                    <div style={{ flex: 1, minHeight: 320, maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 4 }}>
                      {scenes.map((scene, sceneIdx) => (
                        <div key={sceneIdx} style={{ borderBottom: sceneIdx < scenes.length - 1 ? `1px solid ${T.line2}` : "none", paddingBottom: 12 }}>
                          <Eyebrow color={T.amber} style={{ marginBottom: 6 }}>Scene {sceneIdx + 1}</Eyebrow>
                          <div style={{ display: "grid", gap: 8 }}>
                            {(scene.shots || []).map((shot, shotIdx) => (
                              <div
                                key={shotIdx}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "30px 1fr auto",
                                  gap: 8,
                                  alignItems: "center",
                                  background: `${T.line}12`,
                                  padding: "8px 10px",
                                  borderRadius: T.radiusMd
                                }}
                              >
                                <span style={{ font: `700 10px/1 ${mono}`, color: T.amber }}>S{shotIdx + 1}</span>
                                <div style={{ overflow: "hidden" }}>
                                  <div style={{ font: `600 11px/1.2 ${sans}`, color: T.paper, textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}>
                                    {shot.description || shot.title || `Shot ${shotIdx + 1}`}
                                  </div>
                                  {(shot.dialogue || shot.line) && (
                                    <div style={{ font: `400 10px/1.2 ${sans}`, color: T.faint, fontStyle: "italic", marginTop: 1, textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}>
                                      "{Array.isArray(shot.dialogue)
                                        ? shot.dialogue.map(d => d.text || '').join(' / ')
                                        : shot.dialogue || shot.line}"
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <Pill status={shot.keyframe_uri ? "done" : "pending"} label="KF" />
                                  <Pill status={shot.clip_uri ? "done" : "pending"} label="CLIP" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              )}

            </div>
          </div>
        )}
      </section>

      {/* Active & Recent Work List Panel */}
      <section>
        <Panel style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <Eyebrow><Film size={11} style={{ verticalAlign: "-1px" }} /> &nbsp;active &amp; recent work</Eyebrow>
              <div style={{ font: `400 11px/1.4 ${sans}`, color: T.faint, marginTop: 4 }}>
                Unfinished production files run here. Fully rendered media outputs are stored in your central Library.
              </div>
            </div>
            <span style={{ font: `500 10px/1 ${mono}`, color: T.faint }}>
              {activeProjects.length} active pipelines
            </span>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              title="Nothing is in production yet"
              body="Use the 'New Episode' tool at the top to generate your first asset flow."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <AnimatePresence initial={false}>
                {projects.slice(0, 10).map((p) => {
                  const isDone = p.final_av_uri || p.final_uri || p.status === "done";
                  const hasFail = p.stages?.some((s) => s.status === "failed");
                  const isRunning = p.stages?.some((s) => s.status === "running") || p.status === "running";
                  const isAwaiting = p.stages?.some((s) => s.status === "awaiting_review") || p.awaiting_review_stage;

                  const pillStatus = isDone ? "done" : hasFail ? "blocked" : isRunning ? "running" : isAwaiting ? "awaiting_review" : "pending";
                  const pillLabel = isDone ? "done" : hasFail ? "failed" : isRunning ? "running" : isAwaiting ? "review" : "pending";

                  const isInspected = selectedId === p.id;

                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, height: 0, overflow: "hidden" }}
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                      onClick={() => {
                        setSelectedId(p.id);
                        scrollToInspector(80);
                      }}
                      className="workspace_row"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 12px",
                        borderTop: `1px solid ${T.line}`,
                        background: isInspected ? `${T.violet}08` : "transparent",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        {/* Status Icon wrapping with conditional pulses */}
                        <div className={hasFail ? "pulse_attention" : isAwaiting ? "pulse_review" : ""}>
                          <Pill status={pillStatus} label={pillLabel} />
                        </div>
                        
                        {/* ID & context title */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ font: `500 11px/1 ${mono}`, color: T.paper }}>
                            {p.id.slice(0, 8)}
                          </span>
                          <span style={{ font: `400 11px/1 ${sans}`, color: T.faint }}>
                            ({p.title || "Untitled Episode"})
                          </span>
                        </div>
                      </div>

                      {/* Action buttons list */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {/* Quick Resume/Retry button for failed runs */}
                        {hasFail && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Avoid triggering row selection conflict
                              handleResume(p.id);
                            }}
                            disabled={resumingId === p.id}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 6,
                              color: T.teal || "#10b981",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "transform 0.15s ease, opacity 0.15s ease",
                              opacity: resumingId === p.id ? 0.5 : 1
                            }}
                            title="Resume/Retry Pipeline"
                            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.15)")}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}

                        {/* Trash action icon */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Avoid triggering inspector selection
                            setDeleteTargetId(p.id);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 6,
                            color: T.faint,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
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
                          title="Delete Episode"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </Panel>
      </section>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {deleteTargetId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(5, 6, 12, 0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: 16,
              backdropFilter: "blur(4px)"
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

      {/* Final Video Output Modal (especially for mobile/smaller screens) */}
      <Modal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Film color={T.teal} size={16} />
            <span>Final Video Output</span>
          </div>
        }
        maxWidth={680}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {isProjectDone ? (
            <div style={{ background: "#000", borderRadius: T.radiusMd, overflow: "hidden", minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <video
                controls
                autoPlay
                style={{ width: "100%", maxHeight: "65vh", borderRadius: T.radiusMd, background: "#000", objectFit: "contain" }}
                src={studioApiCalls.videoUrl ? studioApiCalls.videoUrl(project.id) : project?.final_av_uri || project?.final_uri}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          ) : (
            <div style={{
              minHeight: 220, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
              background: `${T.ink}88`, borderRadius: T.radiusMd, border: `2px dashed ${T.line2}`,
              padding: 24, textAlign: "center"
            }}>
              {isProjectRunning ? (
                <>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Lamp on color={T.teal} size={10} />
                    <span style={{ font: `600 13px/1 ${sans}`, color: T.teal }}>In Progress</span>
                  </div>
                  <div style={{ font: `700 16px/1.2 ${sans}`, color: T.paper }}>Creating Your Video…</div>
                  <div style={{ font: `400 13px/1.5 ${sans}`, color: T.muted, maxWidth: 360 }}>
                    We are currently creating the artwork, voices, and music for your episode. It will appear here as soon as it is finished!
                  </div>
                </>
              ) : failedStage ? (
                <>
                  <div style={{ font: `600 13px/1 ${sans}`, color: T.clay }}>Production Paused</div>
                  <div style={{ font: `700 16px/1.2 ${sans}`, color: T.paper }}>Something Needs Attention</div>
                  <div style={{ font: `400 13px/1.5 ${sans}`, color: T.muted, maxWidth: 360 }}>
                    We ran into an issue during the <span style={{ color: T.clay, fontFamily: mono }}>{failedStage.name.replace(/_/g, " ")}</span> step. Please review above to continue.
                  </div>
                </>
              ) : awaitingStageName ? (
                <>
                  <div style={{ font: `600 13px/1 ${sans}`, color: T.hitl }}>Review Needed</div>
                  <div style={{ font: `700 16px/1.2 ${sans}`, color: T.paper }}>Your Approval Needed</div>
                  <div style={{ font: `400 13px/1.5 ${sans}`, color: T.muted, maxWidth: 360 }}>
                    The video is paused at <span style={{ color: T.hitl, fontFamily: mono }}>{awaitingStageName.replace(/_/g, " ")}</span>. Please review and approve this step above to continue.
                  </div>
                </>
              ) : (
                <>
                  <Film color={T.faint} size={28} />
                  <div style={{ font: `700 15px/1 ${sans}`, color: T.paper }}>No Video Yet</div>
                  <div style={{ font: `400 13px/1.5 ${sans}`, color: T.muted, maxWidth: 360 }}>
                    Create a new episode or choose a project to watch the video here.
                  </div>
                </>
              )}
            </div>
          )}
          
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn size="sm" onClick={() => setShowVideoModal(false)}>Close</Btn>
          </div>
        </div>
      </Modal>
      
    </motion.div>
  );
}