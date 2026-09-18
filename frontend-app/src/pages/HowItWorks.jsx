import React, { useState, useEffect, useRef } from "react";
import Layout from "../landing/Layout";
import {
  FileText,
  Sliders,
  Image as ImageIcon,
  Video,
  Mic,
  Music,
  Disc,
  Combine,
  Check,
  X,
  Layers,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Tv,
  FolderKanban,
  Cpu,
  Clock,
  Settings,
} from "lucide-react";

const PROCESS_STEPS = [
  {
    num: "01",
    title: "Script & Shotlist Ingestion",
    icon: FileText,
    body: "The pipeline decomposes prompt directives or outlines into structured scene schemas, shot lists, and actor dialogue cues via write_script.",
  },
  {
    num: "02",
    title: "Dual Lane Scheduling",
    icon: Layers,
    body: "Work splits into parallel worker pools. Visual keyframes and video prompts generate along the video lane while speech synthesis and score sync in the audio lane.",
  },
  {
    num: "03",
    title: "Operator Approval Gates",
    icon: ShieldCheck,
    body: "Critical transition boundaries pause execution in awaiting_review state. Operators inspect draft renders, inspect prompt payloads, or reject with revisions.",
  },
  {
    num: "04",
    title: "Muxing & Master Delivery",
    icon: Combine,
    body: "After all upstream checkpoints clear, FFMPEG workers mux video frames, ducked voice stems, and master tracks into the final distribution package.",
  },
];

const TOUR_STEPS = [
  {
    num: "1",
    title: "Studio",
    icon: Tv,
    body: "The primary execution console. Launch generation runs, observe stage transitions in real time, and trigger manual overrides.",
  },
  {
    num: "2",
    title: "Library",
    icon: FolderKanban,
    body: "Central repository of project drafts, rendered episodes, serialized scene state snapshots, and exported media masters.",
  },
  {
    num: "3",
    title: "Models",
    icon: Cpu,
    body: "Provider directory and routing constraints. Select fallback providers and inspect latency or cost benchmarks per model.",
  },
  {
    num: "4",
    title: "Activity Log",
    icon: Clock,
    body: "Full operational audit trail. Review stage execution durations, operator approval timestamps, and worker error logs.",
  },
  {
    num: "5",
    title: "Settings",
    icon: Settings,
    body: "Manage workspace access, configure provider API keys (BYOK), adjust monthly spending caps, and set default audio mux thresholds.",
  },
];

/* SVG Lane Diagram with Video Lane (top) and Audio Lane (bottom) converging on Mix node */
function LaneDiagram() {
  const containerRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Video lane path: (70, 60) -> (220, 60) -> (370, 60) -> (520, 60) -> (690, 110)
  const videoPathD = "M 70 60 L 220 60 L 370 60 L 520 60 L 690 110";
  // Audio lane path: (70, 60) branching to (220, 160) -> (370, 160) -> (520, 160) -> (690, 110)
  const audioPathD = "M 70 60 C 130 60, 150 160, 220 160 L 370 160 L 520 160 L 690 110";

  // Approximate path lengths for strokeDasharray
  const videoLength = 650;
  const audioLength = 670;

  const showActive = inView || reducedMotion;

  return (
    <div ref={containerRef} className="lane-diagram-container" style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox="0 0 800 220"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "auto", minWidth: 620, display: "block" }}
        aria-label="Two-lane architecture diagram: video and audio pipelines converging into shared mix node"
      >
        {/* Base connector lines */}
        <path d={videoPathD} fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 4" />
        <path d={audioPathD} fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 4" />

        {/* Animated flow overlays */}
        <path
          d={videoPathD}
          fill="none"
          stroke="var(--st-done)"
          strokeWidth="2.5"
          strokeDasharray={videoLength}
          strokeDashoffset={showActive ? 0 : videoLength}
          style={{
            transition: reducedMotion ? "none" : "stroke-dashoffset 1400ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        <path
          d={audioPathD}
          fill="none"
          stroke="var(--st-done)"
          strokeWidth="2.5"
          strokeDasharray={audioLength}
          strokeDashoffset={showActive ? 0 : audioLength}
          style={{
            transition: reducedMotion ? "none" : "stroke-dashoffset 1400ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />

        {/* Lane Headers */}
        <text x="18" y="32" fill="var(--faint)" fontFamily="var(--mono)" fontSize="10" fontWeight="600" letterSpacing="0.08em">
          VIDEO LANE
        </text>
        <text x="18" y="200" fill="var(--faint)" fontFamily="var(--mono)" fontSize="10" fontWeight="600" letterSpacing="0.08em">
          AUDIO LANE
        </text>

        {/* Shared Ingestion Node: write_script */}
        <g transform="translate(50, 40)">
          <rect width="40" height="40" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
          <FileText x="11" y="11" width="18" height="18" color="var(--accent)" strokeWidth="1.9" />
          <text x="20" y="54" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="9">
            write_script
          </text>
        </g>

        {/* Video Lane Node 1: generate_prompts */}
        <g transform="translate(200, 40)">
          <rect width="40" height="40" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
          <Sliders x="11" y="11" width="18" height="18" color="var(--accent)" strokeWidth="1.9" />
          <text x="20" y="54" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="9">
            gen_prompts
          </text>
        </g>

        {/* Video Lane Node 2: generate_keyframes */}
        <g transform="translate(350, 40)">
          <rect width="40" height="40" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
          <ImageIcon x="11" y="11" width="18" height="18" color="var(--accent)" strokeWidth="1.9" />
          <text x="20" y="54" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="9">
            gen_keyframes
          </text>
        </g>

        {/* Video Lane Node 3: render_video */}
        <g transform="translate(500, 40)">
          <rect width="40" height="40" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
          <Video x="11" y="11" width="18" height="18" color="var(--accent)" strokeWidth="1.9" />
          <text x="20" y="54" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="9">
            render_video
          </text>
        </g>

        {/* Audio Lane Node 1: synthesize_voice */}
        <g transform="translate(200, 140)">
          <rect width="40" height="40" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
          <Mic x="11" y="11" width="18" height="18" color="var(--accent)" strokeWidth="1.9" />
          <text x="20" y="54" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="9">
            synth_voice
          </text>
        </g>

        {/* Audio Lane Node 2: score_music */}
        <g transform="translate(350, 140)">
          <rect width="40" height="40" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
          <Music x="11" y="11" width="18" height="18" color="var(--accent)" strokeWidth="1.9" />
          <text x="20" y="54" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="9">
            score_music
          </text>
        </g>

        {/* Audio Lane Node 3: master_audio */}
        <g transform="translate(500, 140)">
          <rect width="40" height="40" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
          <Disc x="11" y="11" width="18" height="18" color="var(--accent)" strokeWidth="1.9" />
          <text x="20" y="54" textAnchor="middle" fill="var(--muted)" fontFamily="var(--mono)" fontSize="9">
            master_audio
          </text>
        </g>

        {/* Shared Convergence Node: mix_audio */}
        <g transform="translate(670, 90)">
          <rect width="40" height="40" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
          <Combine x="11" y="11" width="18" height="18" color="var(--accent)" strokeWidth="1.9" />
          <text x="20" y="54" textAnchor="middle" fill="var(--fg)" fontFamily="var(--mono)" fontSize="9" fontWeight="600">
            mix_audio
          </text>
        </g>
      </svg>
    </div>
  );
}

export default function HowItWorks({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      {/* 1. Hero Section */}
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">How It Works</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">System Architecture</span>
        </p>
        <h1>Eleven stages, two lanes, and a gate wherever you want one.</h1>
        <p className="page-hero__lead">
          The video lane orchestrates script composition, keyframe rendering, and shot synthesis in parallel with voice and soundtrack generation. Both tracks execute independently across distinct worker pools before converging at the final master mix.
        </p>
      </section>

      {/* 2. Process Grid */}
      <section className="page-section section-reveal">
        <div className="landing-process">
          {PROCESS_STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <article className="landing-process__step" key={s.num}>
                <span className="landing-process__num">{s.num}</span>
                <div className="landing-process__node">
                  <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                </div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. Lane Diagram (Animated SVG) */}
      <section className="page-section section-reveal">
        <div style={{ marginBottom: 20 }}>
          <p className="landing-kicker">
            <span className="landing-kicker__badge">Pipeline Topology</span>
            <span className="landing-kicker__separator" aria-hidden="true" />
            <span className="landing-kicker__text">Concurrent Execution</span>
          </p>
          <h2 style={{ margin: "6px 0 10px" }}>Independent tracks converging on the master mux.</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.94rem", lineHeight: 1.6, maxWidth: "68ch" }}>
            Audio stems and video frames do not wait on each other. Workers execute against their respective queues, allowing video reruns to re-use pre-rendered audio or vice versa.
          </p>
        </div>
        <div className="landing-workflow__demo">
          <LaneDiagram />
        </div>
      </section>

      {/* 4. Routing Demo (Static) */}
      <section className="page-section section-reveal">
        <div style={{ marginBottom: 20 }}>
          <p className="landing-kicker">
            <span className="landing-kicker__badge">Routing Matrix</span>
            <span className="landing-kicker__separator" aria-hidden="true" />
            <span className="landing-kicker__text">Stage State Transitions</span>
          </p>
          <h2 style={{ margin: "6px 0 10px" }}>Stateful checkpoints at every boundary.</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.94rem", lineHeight: 1.6, maxWidth: "68ch" }}>
            Each stage receives serialised inputs and writes versioned artifacts to storage. Upstream failures never corrupt prior completed tasks.
          </p>
        </div>
        <div className="landing-workflow__demo">
          <div className="unified-grid" style={{ height: "100%", alignItems: "center" }}>
            <div className="unified-node">
              <span>write_script</span>
            </div>
            <div className="unified-connector" aria-hidden="true" />
            <div className="unified-node">
              <span>gen_keyframes</span>
            </div>
            <div className="unified-connector" aria-hidden="true" />
            <div className="unified-node unified-node--active">
              <span>render_video</span>
            </div>
            <div className="unified-connector" aria-hidden="true" />
            <div className="unified-node">
              <span>mix_audio</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Review Mode Explainer */}
      <section className="page-section section-reveal">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32, alignItems: "center" }}>
          <div>
            <p className="landing-kicker">
              <span className="landing-kicker__badge">Human Intervention</span>
              <span className="landing-kicker__separator" aria-hidden="true" />
              <span className="landing-kicker__text">Review Gates</span>
            </p>
            <h2 style={{ margin: "8px 0 14px" }}>What awaiting_review means at the orchestration layer.</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.94rem", lineHeight: 1.65, marginBottom: 14 }}>
              When a stage finishes in a gated configuration, the task manager serialises current assets to persistent disk and places the job in awaiting_review status.
            </p>
            <p style={{ color: "var(--muted)", fontSize: "0.94rem", lineHeight: 1.65 }}>
              No worker processes stay spun up, and no compute or token billing occurs while the task pauses. You inspect the output in the console, edit prompts if required, and either resume downstream stages or reject back to a prior checkpoint.
            </p>
          </div>

          <div className="trust-visual__frame">
            <div className="trust-visual__header">
              <ShieldCheck size={16} strokeWidth={2} />
              <span>Checkpoint: Scene 03 Keyframes</span>
              <span className="trust-visual__status">awaiting_review</span>
            </div>
            <div className="trust-visual__body">
              <div className="trust-visual__row">
                <span className="trust-visual__label">Stage Key</span>
                <span className="trust-visual__value" style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>generate_keyframes</span>
              </div>
              <div className="trust-visual__row">
                <span className="trust-visual__label">Worker Cost</span>
                <span className="trust-visual__value" style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>$0.042 (retained)</span>
              </div>
              <div className="trust-visual__row">
                <span className="trust-visual__label">Downstream Gate</span>
                <span className="trust-visual__value trust-visual__value--ok">
                  <Check size={14} /> render_video paused
                </span>
              </div>
              <div className="trust-visual__actions">
                <button
                  type="button"
                  className="landing-button landing-button--secondary"
                  style={{ flex: 1, padding: "8px 16px", fontSize: "0.82rem" }}
                  tabIndex={-1}
                >
                  <X size={14} style={{ marginRight: 6 }} />
                  Reject &amp; Edit
                </button>
                <button
                  type="button"
                  className="landing-button landing-button--primary"
                  style={{ flex: 1, padding: "8px 16px", fontSize: "0.82rem" }}
                  tabIndex={-1}
                >
                  <Check size={14} style={{ marginRight: 6 }} />
                  Approve Stage
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. App Tour */}
      <section className="page-section section-reveal">
        <div style={{ marginBottom: 28 }}>
          <p className="landing-kicker">
            <span className="landing-kicker__badge">Interface Layout</span>
            <span className="landing-kicker__separator" aria-hidden="true" />
            <span className="landing-kicker__text">Guided Tour</span>
          </p>
          <h2 style={{ margin: "6px 0 10px" }}>The workspaces supporting the pipeline.</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.94rem", lineHeight: 1.6 }}>
            Every section of the application corresponds to a distinct phase of production and governance.
          </p>
        </div>

        <div className="app-tour">
          <div className="app-tour__rail" aria-hidden="true" />
          {TOUR_STEPS.map((step) => {
            const StepIcon = step.icon;
            return (
              <article className="app-tour__step" key={step.num}>
                <div className="app-tour__marker">
                  <span>{step.num}</span>
                </div>
                <div className="app-tour__icon" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <StepIcon size={16} strokeWidth={2} aria-hidden="true" />
                  <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{step.title}</h3>
                </div>
                <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                  {step.body}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* 7. Closing CTA */}
      <section className="landing-final page-section--mb section-reveal">
        <div className="landing-final__copy">
          <h2>Ready to inspect the pipeline in action?</h2>
          <p>
            Launch an evaluation run in offline mock mode without connecting third-party API credentials.
          </p>
          <div className="landing-final__actions">
            <button
              type="button"
              className="landing-button landing-button--primary"
              onClick={onLoginRequest}
            >
              <span className="landing-button__text" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Open Studio Console
                <ArrowRight size={15} aria-hidden="true" />
              </span>
            </button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
