import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../landing/Layout";
import {
  Sparkles,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  FileText,
  Pencil,
  Camera,
  Image as ImageIcon,
  Film,
  Mic,
  Music,
  Volume2,
  Sliders,
  Palette,
  CheckCircle2,
  Lock,
  Zap,
  Layers,
} from "lucide-react";

export const STAGES = [
  {
    num: "01",
    key: "brief",
    name: "Parse Brief",
    track: "Visual",
    icon: FileText,
    desc: "Decomposes premise into structured beat sheet, scene metadata, and duration directives.",
    guarantee: "Deterministic schema validation · $0.00 spend cap",
    engine: "Claude 3.5 Sonnet / DeepSeek R1",
  },
  {
    num: "02",
    key: "script",
    name: "Write Script",
    track: "Visual",
    icon: Pencil,
    desc: "Drafts dialogue, action cues, and emotional beats with strict cadence constraints.",
    guarantee: "Human review gate · Approved before rendering",
    engine: "Reasoning LLM with strict formatting rules",
  },
  {
    num: "03",
    key: "prompts",
    name: "Scene Prompts",
    track: "Visual",
    icon: Camera,
    desc: "Synthesizes camera optics, lens focal lengths, and cinematic lighting parameters.",
    guarantee: "Repeatable optical anchors across shots",
    engine: "Structured prompt compiler",
  },
  {
    num: "04",
    key: "frames",
    name: "Keyframes & Continuity",
    track: "Visual",
    icon: ImageIcon,
    desc: "Locks character facial reference meshes and wardrobe consistency across all camera angles.",
    guarantee: "Zero facial or wardrobing drift",
    engine: "FLUX.1-dev / SDXL with IP-Adapter",
  },
  {
    num: "05",
    key: "video",
    name: "Motion Synthesis",
    track: "Visual",
    icon: Film,
    desc: "Renders temporal camera motion and character kinetics anchored to verified keyframes.",
    guarantee: "Isolated per-shot execution · No cascading rerun",
    engine: "Kling / RunPod Wan2.1 / Luma Ray",
  },
  {
    num: "06",
    key: "speech",
    name: "Voice Synthesis",
    track: "Audio",
    icon: Mic,
    desc: "Generates natural speech with accurate phonetic emotion, character timbre, and pause cadence.",
    guarantee: "Fixed voice actor seeds across series",
    engine: "ElevenLabs / OpenAI TTS / Chatter",
  },
  {
    num: "07",
    key: "score",
    name: "Adaptive Score",
    track: "Audio",
    icon: Music,
    desc: "Synthesizes musical cues tuned to narrative tension, scene mood, and climax points.",
    guarantee: "Original compositions with full license rights",
    engine: "Suno v4 / Udio / Producer AI",
  },
  {
    num: "08",
    key: "foley",
    name: "Foley & Sound FX",
    track: "Audio",
    icon: Volume2,
    desc: "Generates atmospheric room tone, footsteps, and diegetic sound effects synced to visuals.",
    guarantee: "Sub-frame audio alignment to motion cues",
    engine: "AudioLDM2 / ElevenLabs SFX",
  },
  {
    num: "09",
    key: "duck",
    name: "Audio Mix & Duck",
    track: "Audio",
    icon: Sliders,
    desc: "Automates multi-band dialogue ducking, dynamic EQ balance, and master loudness calibration.",
    guarantee: "LUFS standard broadcast compliance",
    engine: "Deterministic DSP & automated ducking",
  },
  {
    num: "10",
    key: "grade",
    name: "Color Grade",
    track: "Visual",
    icon: Palette,
    desc: "Normalizes chromatic gamuts, black levels, and cinematic LUT curves across all shots.",
    guarantee: "Unified color space across disparate providers",
    engine: "3D LUT transform & exposure matching",
  },
  {
    num: "11",
    key: "mux",
    name: "Final Mux & Verification",
    track: "Mux",
    icon: CheckCircle2,
    desc: "Multiplexes lossless audio and video streams with cryptographic SHA-256 asset signatures.",
    guarantee: "Deterministic release bundle ready for export",
    engine: "FFmpeg pipeline & SHA-256 verification",
  },
];

const VALUES = [
  {
    icon: Sparkles,
    title: "Autonomous Decomposition",
    body: "Creative briefs are broken down into structured shot lists, actor dialogue cues, and motion directives without manual micro-prompting across disconnected browser tabs.",
  },
  {
    icon: ShieldCheck,
    title: "Editorial Sovereignty",
    body: "Automation never usurps human intent. Critical transition gates halt in awaiting_review state, giving operators total veto and modification authority before final release.",
  },
  {
    icon: RefreshCw,
    title: "Localised Fault Isolation",
    body: "Splitting production into eleven stateful stages means a failure is localised to one stage and costs one stage to fix, rather than discarding the entire render.",
  },
];

const ARCHITECTURE_RULES = [
  {
    icon: Lock,
    title: "Zero Upstream Drift",
    body: "Character reference anchors and actor voice seeds are immutable across the pipeline. Changing a script line in shot 4 will never alter character aesthetics in shot 1.",
  },
  {
    icon: Zap,
    title: "Isolated Spend Guardrails",
    body: "Every stage verifies its operational cost cap before initiating inference. High-cost video generation cannot fire until low-cost scripts and keyframes are verified.",
  },
  {
    icon: Layers,
    title: "Dual-Lane Asynchronous Synthesis",
    body: "Audio tracks (dialogue, score, Foley) and visual tracks (prompts, keyframes, motion) synthesize concurrently, converging seamlessly at the final mastering mux.",
  },
];

export default function About({ onLoginRequest }) {
  const [activeIndex, setActiveIndex] = useState(3); // Start on Keyframes
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  useEffect(() => {
    if (!isAutoPlaying) return undefined;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % STAGES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const activeStage = STAGES[activeIndex];

  const handlePrev = () => {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev === 0 ? STAGES.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev + 1) % STAGES.length);
  };

  const visualStages = STAGES.filter((s) => s.track === "Visual");
  const audioStages = STAGES.filter((s) => s.track === "Audio");

  return (
    <Layout onLoginRequest={onLoginRequest}>
      {/* 1. Hero */}
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">About Xeliai</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">Our Thesis &amp; Architecture</span>
        </p>
        <h1>Eliminating friction between creative concept and rendered reality.</h1>
        <p className="page-hero__lead">
          We built Xeliai Studio because autonomous media pipelines must deliver predictable engineering guarantees rather than opaque slot-machine outputs.
        </p>
      </section>

      {/* 2. Interactive Orbit & Origin Section */}
      <section className="page-section section-reveal">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "clamp(32px, 5vw, 64px)",
            alignItems: "center",
          }}
        >
          <div>
            <p className="landing-kicker">
              <span className="landing-kicker__badge">Origin Story</span>
              <span className="landing-kicker__separator" aria-hidden="true" />
              <span className="landing-kicker__text">The Orchestration Problem</span>
            </p>
            <h2 style={{ margin: "8px 0 16px" }}>Generative media had a reliability problem.</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.65, marginBottom: 14 }}>
              Early AI video workflows were chaotic. Creators jumped between five different browser tabs, pasting scripts into voice tools, manually matching audio waveforms in video editors, and praying prompts would retain character continuity.
            </p>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.65, marginBottom: 14 }}>
              When an output had a defect on the tenth second, creators were forced to re-run the entire pipeline from scratch, burning credits and wasting hours.
            </p>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.65 }}>
              Xeliai Studio transforms media generation into a stateful, observable assembly line. Each stage verifies its own outputs, checks spend constraints, and yields to human review whenever needed.
            </p>
          </div>

          {/* Clean Interactive Orbit Visual */}
          <div className="about-orbit-wrapper">
            <div className="about-orbit" aria-label="11-Stage Verification Orbit">
              {/* SVG Ring with progress indicator */}
              <svg className="lp-orbit__svg" viewBox="0 0 100 100" aria-hidden="true">
                <circle className="lp-orbit__track" cx="50" cy="50" r="41" />
                <circle
                  className="lp-orbit__progress"
                  cx="50"
                  cy="50"
                  r="41"
                  strokeDasharray="257.6"
                  strokeDashoffset="0"
                />
              </svg>

              <div className="lp-orbit__sweep" aria-hidden="true" />

              {/* Central Inspector Core */}
              <div className="lp-orbit__core">
                <span className="lp-orbit__count">
                  STAGE {activeStage.num} OF 11 &middot; {activeStage.track.toUpperCase()}
                </span>
                <span className="lp-orbit__now">{activeStage.name}</span>
                <span className="lp-orbit__what">{activeStage.desc}</span>
                <span className="lp-orbit__spend">{activeStage.guarantee}</span>
              </div>

              {/* Circumference Stage Beads (Clean Number & Icon only, Tooltip on Hover) */}
              {STAGES.map((s, i) => {
                const angle = (i / STAGES.length) * Math.PI * 2 - Math.PI / 2;
                const r = 41; // radius %
                const x = 50 + r * Math.cos(angle);
                const y = 50 + r * Math.sin(angle);
                const isActive = i === activeIndex;
                const Icon = s.icon;

                return (
                  <button
                    key={s.key}
                    type="button"
                    className="about-bead"
                    data-active={isActive ? "true" : "false"}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveIndex(i);
                    }}
                    aria-label={`Stage ${s.num}: ${s.name}`}
                  >
                    <span className="about-bead__content">
                      <Icon size={12} strokeWidth={2.4} aria-hidden="true" />
                      <span className="about-bead__num">{s.num}</span>
                    </span>
                    <span className="about-bead__tip">
                      {s.num} &middot; {s.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Orbit Navigation Controls */}
            <div className="about-orbit__controls">
              <button
                type="button"
                className="about-btn"
                onClick={handlePrev}
                aria-label="Previous stage"
              >
                <ChevronLeft size={14} aria-hidden="true" />
                <span>Prev</span>
              </button>

              <button
                type="button"
                className="about-btn"
                data-active={isAutoPlaying ? "true" : "false"}
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                aria-label={isAutoPlaying ? "Pause auto tour" : "Play auto tour"}
              >
                {isAutoPlaying ? (
                  <>
                    <Pause size={14} aria-hidden="true" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play size={14} aria-hidden="true" />
                    <span>Auto tour</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="about-btn"
                onClick={handleNext}
                aria-label="Next stage"
              >
                <span>Next</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Dual-Lane Synchronized Stage Architecture Breakdown */}
        <div className="about-lanes-container">
          {/* Visual Track */}
          <div className="about-lane-card">
            <div className="about-lane-header">
              <span className="about-lane-title">
                <Film size={18} style={{ color: "var(--accent)" }} aria-hidden="true" />
                Visual Track Pipeline
              </span>
              <span className="about-lane-badge">6 stages</span>
            </div>
            <div className="about-stage-list">
              {visualStages.map((s) => {
                const isActive = STAGES.findIndex((item) => item.key === s.key) === activeIndex;
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    type="button"
                    className="about-stage-item"
                    data-active={isActive ? "true" : "false"}
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveIndex(STAGES.findIndex((item) => item.key === s.key));
                    }}
                  >
                    <span className="about-stage-item-num">{s.num}</span>
                    <div className="about-stage-item-body">
                      <span className="about-stage-item-title">{s.name}</span>
                      <span className="about-stage-item-desc">{s.desc}</span>
                      <span className="about-stage-item-meta">{s.engine}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio & Mux Track */}
          <div className="about-lane-card">
            <div className="about-lane-header">
              <span className="about-lane-title">
                <Volume2 size={18} style={{ color: "var(--st-done)" }} aria-hidden="true" />
                Audio Track &amp; Delivery Mux
              </span>
              <span className="about-lane-badge">5 stages</span>
            </div>
            <div className="about-stage-list">
              {[...audioStages, STAGES[10]].map((s) => {
                const isActive = STAGES.findIndex((item) => item.key === s.key) === activeIndex;
                return (
                  <button
                    key={s.key}
                    type="button"
                    className="about-stage-item"
                    data-active={isActive ? "true" : "false"}
                    onClick={() => {
                      setIsAutoPlaying(false);
                      setActiveIndex(STAGES.findIndex((item) => item.key === s.key));
                    }}
                  >
                    <span className="about-stage-item-num">{s.num}</span>
                    <div className="about-stage-item-body">
                      <span className="about-stage-item-title">{s.name}</span>
                      <span className="about-stage-item-desc">{s.desc}</span>
                      <span className="about-stage-item-meta">{s.engine}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Three Guiding Principles */}
      <section className="page-section section-reveal">
        <div style={{ marginBottom: 24 }}>
          <p className="landing-kicker">
            <span className="landing-kicker__badge">Guiding Principles</span>
            <span className="landing-kicker__separator" aria-hidden="true" />
            <span className="landing-kicker__text">System Design</span>
          </p>
          <h2 style={{ margin: "6px 0 10px" }}>The values shaping our system design.</h2>
          <p style={{ color: "var(--muted)", maxWidth: "56ch" }}>
            Every architectural trade-off prioritizes deterministic operator control over black-box prompt guessing.
          </p>
        </div>

        <div className="content-grid">
          {VALUES.map((v) => {
            const Icon = v.icon;
            return (
              <div className="content-card" key={v.title}>
                <div className="content-card__icon">
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                </div>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Non-Negotiable Engineering Rules */}
      <section className="page-section section-reveal">
        <div style={{ marginBottom: 24 }}>
          <p className="landing-kicker">
            <span className="landing-kicker__badge">Engineering Standards</span>
            <span className="landing-kicker__separator" aria-hidden="true" />
            <span className="landing-kicker__text">Zero Upstream Drift</span>
          </p>
          <h2 style={{ margin: "6px 0 10px" }}>Non-negotiable pipeline rules.</h2>
        </div>

        <div className="content-grid">
          {ARCHITECTURE_RULES.map((rule) => {
            const Icon = rule.icon;
            return (
              <div className="content-card" key={rule.title}>
                <div className="content-card__icon">
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                </div>
                <h3>{rule.title}</h3>
                <p>{rule.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Closing CTA */}
      <section className="landing-final page-section--mb section-reveal">
        <div className="landing-final__copy">
          <h2>Ready to experience deterministic media pipelines?</h2>
          <p>
            Test your first multi-stage run in offline evaluation mode or connect your enterprise provider keys.
          </p>
          <div className="landing-final__actions">
            <button
              type="button"
              className="landing-button landing-button--primary"
              onClick={onLoginRequest}
            >
              <span className="landing-button__text" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Launch Studio Console
                <ArrowRight size={15} aria-hidden="true" />
              </span>
            </button>
            <Link
              to="/contact"
              className="landing-button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                textDecoration: "none",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                padding: "10px 20px",
                borderRadius: "var(--radius)",
                fontWeight: 600,
                fontSize: "0.92rem",
              }}
            >
              Contact Engineering Desk
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
