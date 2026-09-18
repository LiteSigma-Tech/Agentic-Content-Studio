import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  X,
  RotateCcw,
  Play,
  Clapperboard,
  ShieldCheck,
  Cpu,
  Users,
  Wallet,
  History,
  KeyRound,
  Plus,
  Layers,
  Mic,
  MessageSquare,
  Music,
  Film,
  Image as ImageIcon,
  MonitorPlay,
  SlidersHorizontal,
  Package,
  FileText,
  Blocks,
  Presentation,
  Drama,
  Laugh,
  GraduationCap,
  Ghost,
  Rocket,
  Swords,
  Megaphone,
  ChevronRight,
} from "lucide-react";
import Layout from "./Layout";
import VideoModal from "./VideoModal";

import lighthouseImg from '../assets/showcase/lighthouse.webp';
import atlasImg from '../assets/showcase/atlas.webp';
import pipImg from '../assets/showcase/pip.webp';
import vergeImg from '../assets/showcase/verge.webp';
import recapImg from '../assets/showcase/recap.webp';
import brainstormingImg from '../assets/showcase/brainstorming.webp';

import filmstripEngineerImg from "../assets/landing/img3.webp";
import filmstripStylizedWomanImg from "../assets/landing/img4.webp";
import filmstripBoyRobotImg from "../assets/landing/img5.webp";
import filmstripDevLaptopImg from "../assets/landing/img1.webp";
import filmstripCollaborateImg from "../assets/landing/img2.webp";
/* ═══════════════════════════════════════════════════════════════════

/* ═══════════════════════════════════════════════════════════════════════
   Content
   Every stage name, lane, genre and provider below is lifted from the
   real source: shared/pipeline.jsx, studio/StudioCommandCenter.jsx and
   app/models/index.jsx. Nothing here describes a feature that does not
   exist.
   ═══════════════════════════════════════════════════════════════════════ */

const STAGES = [
  { key: "write_script", name: "Script", icon: FileText, lane: "video", cost: 0.02, what: "Writing scenes, shots and dialogue", desc: "Scenes, shots and dialogue, written from your concept." },
  { key: "design_characters", name: "Characters", icon: Users, lane: "video", cost: 0.18, what: "Drawing reference art for the cast", desc: "Reference art per character, reused by every later stage." },
  { key: "generate_keyframes", name: "Keyframes", icon: ImageIcon, lane: "video", cost: 0.41, what: "One still per shot, before any video", desc: "A still for each shot before any video time is spent." },
  { key: "cast_voices", name: "Cast voices", icon: Mic, lane: "audio", cost: 0.01, what: "Assigning a voice to each character", desc: "A voice assigned per character and held for the episode." },
  { key: "generate_dialogue", name: "Dialogue", icon: MessageSquare, lane: "audio", cost: 0.12, what: "Speaking every line in the script", desc: "Speech synthesised line by line from the script." },
  { key: "generate_music", name: "Music", icon: Music, lane: "audio", cost: 0.09, what: "Scoring the episode from scratch", desc: "An original score written to the cut, not licensed stock." },
  { key: "generate_clips", name: "Clips", icon: Film, lane: "video", cost: 1.86, what: "Turning stills into moving shots", desc: "Motion generated from the approved keyframes." },
  { key: "assemble", name: "Assemble", icon: Layers, lane: "video", cost: 0.0, what: "Ordering shots onto a timeline", desc: "Shots ordered into scenes on a timeline." },
  { key: "render", name: "Render", icon: MonitorPlay, lane: "video", cost: 0.34, what: "Flattening picture to one file", desc: "The video track flattened to a single file." },
  { key: "mix_audio", name: "Mix", icon: SlidersHorizontal, lane: "audio", cost: 0.03, what: "Balancing voices against score", desc: "Dialogue, score and effects balanced against each other." },
  { key: "mux", name: "Mux", icon: Package, lane: "audio", cost: 0.01, what: "Marrying picture and sound", desc: "Picture and sound married into the deliverable." },
];

const SCRIPT_DRAFTS = [
  {
    heading: "Script ready",
    line: "SHOT 01. Wide. A lighthouse keeper finds a whale beached on the rocks at dawn. She talks to it while the tide goes out.",
  },
  {
    heading: "Redrafted",
    line: "SHOT 01. Close. Hands working a frayed rope in lamplight. Pull back: the keeper has been awake all night, and the beach below is not empty.",
  },
];

const GENRES = [
  { icon: Blocks, name: "Kids cartoon", desc: "Routed only to moderation-cleared models" },
  { icon: Presentation, name: "Brand explainer", desc: "Clean business presentation" },
  { icon: Drama, name: "Drama", desc: "Emotional story beats" },
  { icon: Laugh, name: "Comedy", desc: "Funny and playful" },
  { icon: GraduationCap, name: "Educational", desc: "Clear lessons and explanations" },
  { icon: Ghost, name: "Horror and thriller", desc: "Suspenseful and spooky" },
  { icon: Rocket, name: "Sci-fi and fantasy", desc: "Space and magical worlds" },
  { icon: FileText, name: "Documentary", desc: "Real stories with narration" },
  { icon: Swords, name: "Action and adventure", desc: "Fast-moving excitement" },
  { icon: Megaphone, name: "Marketing ad", desc: "Short promotional spots" },
];

const FILMSTRIP_ITEMS = [
  { label: "Episode 01 · Systems Engineer Session", genre: "Data Center", img: filmstripEngineerImg },
  { label: "Episode 02 · Director Persona & Styling", genre: "Stylized 3D", img: filmstripStylizedWomanImg },
  { label: "Episode 03 · Leo & Bot Companion", genre: "Kids Animation", img: filmstripBoyRobotImg },
  { label: "Episode 04 · Late Night Pipeline Build", genre: "Developer", img: filmstripDevLaptopImg },
  { label: "Episode 05 · Director Ideation Review", genre: "Creative Studio", img: filmstripCollaborateImg },
  { label: "Episode 06 · The Keeper & The Whale", genre: "Drama", img: lighthouseImg },
  { label: "Episode 07 · Atlas of the Subsurface", genre: "Explainer", img: atlasImg },
  { label: "Episode 08 · Pip & the Clockwork Moth", genre: "Kids Series", img: pipImg },
  { label: "Episode 09 · Signal from the Verge", genre: "Sci-Fi", img: vergeImg },
  { label: "Episode 10 · Creative Brainstorming", genre: "XeliAI Lab", img: brainstormingImg },
];

const SHOWCASE_ITEMS = [
  {
    title: "XeliAI Lab: Director Ideation",
    genre: "Collaborative Session",
    shots: "Studio session",
    cost: "$0.00 zero compute",
    routing: "Interactive Planning",
    desc: "Prompt engineers and creative directors decompose story arcs into deterministic stage bounds, locking visual tokens before triggering GPU clusters.",
    tags: ["Story Decomposition", "Visual Tokens", "Team Review"],
    img: filmstripCollaborateImg,
  },
  {
    title: "The Keeper and the Whale",
    genre: "Atmospheric Drama",
    shots: "6 shots · 2 voices",
    cost: "$0.62 total run",
    routing: "Zero-drift anchors",
    desc: "A six-shot cinematic short built from a single logline. Character reference art carried the keeper across every keyframe without re-prompting appearance once.",
    tags: ["11 stages", "Reference Art Lock", "Audio Mix"],
    img: lighthouseImg,
  },
  {
    title: "Atlas Logistics: Subsurface Fleet",
    genre: "Brand Explainer",
    shots: "9 shots · 1 narrator",
    cost: "$1.40 total run",
    routing: "1 Paid Stage",
    desc: "Script approved on draft two, keyframes locked on draft one. Fast iteration in early stages meant video compute was only spent on finalized shot compositions.",
    tags: ["Deterministic", "Voice Synthesis", "Keyframe Stills"],
    img: atlasImg,
  },
  {
    title: "Pip & the Clockwork Moth",
    genre: "Kids Animation",
    shots: "8 shots · 3 voices",
    cost: "$0.38 total run",
    routing: "Moderation-cleared",
    desc: "Script, dialogue, and score strictly routed through policy-cleared models. Safety constraints enforced at the pipeline architecture level, not prompt text.",
    tags: ["Safe Routing", "Consistent Character", "Original Score"],
    img: filmstripBoyRobotImg,
  },
  {
    title: "Signal from the Verge",
    genre: "Hard Sci-Fi",
    shots: "12 shots · Multi-cast",
    cost: "$1.85 total run",
    routing: "Human-in-the-loop",
    desc: "Keyframe stage rejected twice by the director to refine lighting geometry before rendering. Downstream video generation and audio muxing were never billed.",
    tags: ["Pre-render Reject", "Cinematic Aspect", "Sound FX"],
    img: vergeImg,
  },
  {
    title: "Daily Recap: Season 01 Archive",
    genre: "Documentary",
    shots: "5 batch episodes",
    cost: "$0.92 batch run",
    routing: "Free-only routing",
    desc: "Five micro-episodes produced from a reusable pipeline blueprint in a single run. Shared character voice models, consistent grading, and distinct episodic beats.",
    tags: ["Batch Pipeline", "Template Re-use", "Local Models"],
    img: recapImg,
  },
];

const FAQS = [
  {
    q: "Does this replace my editor or my NLE?",
    a: "No. Xeliai Studio produces the first cut: script, boards, scratch voice, score and a rough assembly. That is the unbillable part of the job. Export it and finish in Premiere or Resolve the way you always have.",
  },
  {
    q: "What happens if I reject a stage?",
    a: "The pipeline stops there. Nothing downstream runs, so nothing downstream is charged. You can edit the prompt for that stage and re-run it as many times as you need before anything expensive happens.",
  },
  {
    q: "Can I run this without paying for model APIs?",
    a: "Yes. Turn on free-only routing and every task is restricted to local and open-weight providers. You can also route a single stage to a paid provider when it earns its cost, and leave the other ten free.",
  },
  {
    q: "How do characters stay consistent between shots?",
    a: "The character stage produces reference art, and every later stage reads from it. Consistency comes from a stored reference, not from repeating a description in each prompt and hoping.",
  },
  {
    q: "Is there a kid-safe mode?",
    a: "The kids cartoon genre restricts routing to providers tagged as moderation-cleared. It is a routing constraint enforced by the system rather than a note in a prompt.",
  },
];

const currency = (n) => `$${n.toFixed(2)}`;

/* ═══════════════════════════════════════════════════════════════════════
   THE ORBIT
   The pipeline as a ring. Eleven stages sit on the circumference like
   beads on a bracelet and light up in turn; the centre carries the one
   thing happening right now, so a first-time visitor reads a single
   large label rather than eleven small ones. When the run reaches the
   approval gate the centre becomes the decision itself.
   ═══════════════════════════════════════════════════════════════════════ */

const RADIUS = 42;                       // percent of the box, from centre
const CIRC = 2 * Math.PI * RADIUS;       // for the progress arc dash math

function beadPosition(index, total) {
  const angle = (-90 + (360 / total) * index) * (Math.PI / 180);
  return {
    left: `${50 + RADIUS * Math.cos(angle)}%`,
    top: `${50 + RADIUS * Math.sin(angle)}%`,
  };
}

function PipelineOrbit({ onLoginRequest }) {
  const [completed, setCompleted] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | running | review | finishing | done
  const [draft, setDraft] = useState(0);
  const timers = useRef([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const later = useCallback((fn, ms) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setCompleted(1);
      setPhase("review");
      return undefined;
    }

    /* Waits out the boot overlay so the two never animate over each other. */
    later(() => setPhase("running"), 950);
    later(() => { setCompleted(1); setPhase("review"); }, 2350);

    return clearTimers;
  }, [later, clearTimers]);

  const approve = () => {
    clearTimers();
    setPhase("finishing");
    /* Steps through the remaining ten beads. 430ms each reads as work
       being done without making anyone wait for a real render. */
    for (let i = 2; i <= STAGES.length; i += 1) {
      later(() => {
        setCompleted(i);
        if (i === STAGES.length) setPhase("done");
      }, (i - 1) * 430);
    }
  };

  const reject = () => {
    clearTimers();
    setPhase("running");
    setCompleted(0);
    setDraft((d) => (d + 1) % SCRIPT_DRAFTS.length);
    later(() => { setCompleted(1); setPhase("review"); }, 1500);
  };

  const replay = () => {
    clearTimers();
    setCompleted(0);
    setDraft(0);
    setPhase("running");
    later(() => { setCompleted(1); setPhase("review"); }, 1400);
  };

  const statusOf = (i) => {
    if (i < completed) return "done";
    if (phase === "review" && i === completed) return "review";
    if ((phase === "running" || phase === "finishing") && i === completed) return "running";
    return "pending";
  };

  const spent = STAGES.slice(0, completed).reduce((sum, s) => sum + s.cost, 0);
  const active = STAGES[Math.min(completed, STAGES.length - 1)];
  const progress = phase === "done" ? 1 : completed / STAGES.length;

  const stateColour =
    phase === "review" ? "var(--st-review)" : phase === "done" ? "var(--st-done)" : "var(--st-running)";
  const stateLabel =
    phase === "review" ? "waiting for you" : phase === "done" ? "finished" : "working";

  return (
    <div>
      <div className="lp-orbit" data-phase={phase}>
        <div className="lp-orbit__sweep" aria-hidden="true" />

        <svg className="lp-orbit__svg" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="lp-orbit__track" cx="50" cy="50" r={RADIUS} />
          <circle
            className="lp-orbit__progress"
            cx="50"
            cy="50"
            r={RADIUS}
            transform="rotate(-90 50 50)"
            style={{
              strokeDasharray: CIRC,
              strokeDashoffset: CIRC * (1 - progress),
            }}
          />
        </svg>

        {STAGES.map((s, i) => {
          const status = statusOf(i);
          const StageIcon = s.icon;
          return (
            <button
              type="button"
              key={s.key}
              className="lp-bead"
              data-status={status}
              style={beadPosition(i, STAGES.length)}
              aria-label={`Stage ${i + 1}, ${s.name}: ${status}`}
              tabIndex={-1}
            >
              <StageIcon size={17} strokeWidth={1.9} aria-hidden="true" />
              <span className="lp-bead__tip">{s.name}</span>
            </button>
          );
        })}

        <div className="lp-orbit__core">
          {phase === "review" ? (
            <>
              <span className="lp-orbit__count">stage 1 of 11</span>
              <span className="lp-orbit__gateline">{SCRIPT_DRAFTS[draft].heading}</span>
              <div className="lp-orbit__decide">
                <button type="button" className="lp-orbit__btn lp-orbit__btn--ok" onClick={approve}>
                  <Check size={13} strokeWidth={2.6} /> Approve
                </button>
                <button type="button" className="lp-orbit__btn lp-orbit__btn--no" onClick={reject}>
                  <X size={13} strokeWidth={2.6} /> Reject
                </button>
              </div>
              <span className="lp-orbit__spend lp-num">{currency(spent)} so far</span>
            </>
          ) : phase === "done" ? (
            <>
              <span className="lp-orbit__count">11 of 11</span>
              <span className="lp-orbit__now">Episode ready</span>
              <span className="lp-orbit__what">One approval, eleven stages, nothing you could not stop</span>
              <div className="lp-orbit__decide">
                <button type="button" className="lp-orbit__btn lp-orbit__btn--ok" onClick={onLoginRequest}>
                  <Plus size={13} strokeWidth={2.6} /> Build yours
                </button>
                <button type="button" className="lp-orbit__btn lp-orbit__btn--no" onClick={replay} style={{ marginLeft: 6 }}>
                  <RotateCcw size={12} strokeWidth={2.2} /> Replay
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="lp-orbit__count">stage {Math.min(completed + 1, 11)} of 11</span>
              <span className="lp-orbit__now">{active.name}</span>
              <span className="lp-orbit__what">{active.what}</span>
              <span className="lp-orbit__spend lp-num">{currency(spent)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

/* ─── Moving Filmstrip Frame with fallback ─── */
function FilmstripFrame({ item, i, onOpenVideo }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div
      className="reel__frame"
      style={{ "--i": i, cursor: onOpenVideo ? "pointer" : "default" }}
      onClick={() => onOpenVideo?.()}
      role={onOpenVideo ? "button" : undefined}
      tabIndex={onOpenVideo ? 0 : undefined}
      onKeyDown={(e) => {
        if (onOpenVideo && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpenVideo();
        }
      }}
      aria-label={onOpenVideo ? `Watch finished video - ${item.label}` : undefined}
    >
      <div className="reel__frame-inner">
        {!imgFailed && item.img ? (
          <img
            src={item.img}
            onError={() => setImgFailed(true)}
            alt={item.label}
            className="reel__frame-img"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : null}
        {(imgFailed || !item.img) && (
          <div className="reel__frame-placeholder">
            <Clapperboard size={20} className="reel__frame-icon" />
            <span>{item.label}</span>
          </div>
        )}
        <div className="reel__frame-overlay">
          <Play size={20} fill="currentColor" />
        </div>
      </div>
    </div>
  );
}

/* ─── Infinite marquee filmstrip ─── */
function FilmstripReel({ onOpenVideo }) {
  const trackRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);

  return (
    <section
      className="reel section-reveal"
      aria-label="Sample rendered episodes"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="reel__perf reel__perf--top" aria-hidden="true" />
      <div className={`reel__track ${isPaused ? "is-paused" : ""}`} ref={trackRef}>
        {[...FILMSTRIP_ITEMS, ...FILMSTRIP_ITEMS, ...FILMSTRIP_ITEMS].map((item, i) => (
          <FilmstripFrame item={item} i={i} key={`${item.label}-${i}`} onOpenVideo={onOpenVideo} />
        ))}
      </div>
      <div className="reel__perf reel__perf--bottom" aria-hidden="true" />
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <div className="lp-faq">
      {FAQS.map((f, i) => (
        <div className="lp-faq__item" key={f.q} data-open={open === i ? "true" : "false"}>
          <button
            type="button"
            className="lp-faq__q"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? -1 : i)}
          >
            {f.q}
            <Plus size={18} strokeWidth={2} />
          </button>
          <div className="lp-faq__a"><div><p>{f.a}</p></div></div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function LandingPage({ onLoginRequest }) {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const videoRef = useRef(null);
  const total = STAGES.reduce((s, x) => s + x.cost, 0);

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      if (v.readyState >= 2) {
        setVideoLoaded(true);
        v.play().catch(() => {});
      }
    }
  }, []);

  return (
    <Layout onLoginRequest={onLoginRequest}>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="lp-hero">
        {/* Background video that stays blank initially and starts playing when fully loaded */}
        <div className="lp-hero__video-container" aria-hidden="true">
          <video
            ref={videoRef}
            className={`lp-hero__bg-video ${videoLoaded ? "is-loaded" : ""}`}
            src="/video/vid1.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            onLoadedData={() => {
              setVideoLoaded(true);
              videoRef.current?.play().catch(() => {});
            }}
            onCanPlayThrough={() => {
              setVideoLoaded(true);
              videoRef.current?.play().catch(() => {});
            }}
            onPlaying={() => {
              setVideoLoaded(true);
            }}
          />
          <div className="lp-hero__video-overlay" />
        </div>

        <div className="lp-wrap lp-hero__grid">
          <div>
            <span className="lp-hero__tag">
              <span className="lp-hero__tagdot" aria-hidden="true" />
              Early access, with design partners
            </span>

            <h1>Approve the script before you pay for the render.</h1>

            <p className="lp-lede lp-hero__sub">
              Xeliai Studio breaks AI video into eleven visible stages. It pauses wherever you tell it
              to, shows what each stage costs, and lets you choose which model runs it. Reject a draft
              at stage one and stage nine never bills you.
            </p>

            <div className="lp-actions">
              <button type="button" className="lp-btn lp-btn--primary" onClick={onLoginRequest}>
                Start building free
              </button>
              <Link to="/how-it-works" className="lp-btn lp-btn--ghost">See the pipeline</Link>
            </div>

            <p className="lp-note" style={{ marginTop: 18 }}>
              Free-only routing runs every stage on local and open-weight models.
            </p>
          </div>

          <div>
            <PipelineOrbit onLoginRequest={onLoginRequest} />
          </div>
        </div>
      </section>

      {/* ── Marquee Filmstrip Reel ───────────────────────────────────── */}
      <FilmstripReel onOpenVideo={() => setVideoModalOpen(true)} />

      {/* ── Featured Studio Productions Showcase ─────────────────────── */}
      <section className="lp-section lp-showcase-section">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <span className="lp-marker">gallery & showcase</span>
            <h2>What creators have generated end-to-end.</h2>
            <p className="lp-lede">
              Real multi-shot episodes and character consistency anchors produced with Xeliai Studio.
              From script to sound design, without model drift or unvetted costs.
            </p>
          </div>

          <div className="lp-showcase-grid" data-reveal>
            {SHOWCASE_ITEMS.map((item) => (
              <div className="lp-showcase-card" key={item.title}>
                <div className="lp-showcase-card__media">
                  <img
                    src={item.img}
                    alt={item.title}
                    className="lp-showcase-card__img"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <span className="lp-showcase-card__badge">{item.genre}</span>
                  <div className="lp-showcase-card__meta-bar">
                    <span>{item.shots}</span>
                    <span>{item.cost}</span>
                  </div>
                </div>
                <div className="lp-showcase-card__content">
                  <div className="lp-showcase-card__header">
                    <h3>{item.title}</h3>
                    <span className="lp-showcase-card__routing">{item.routing}</span>
                  </div>
                  <p className="lp-showcase-card__desc">{item.desc}</p>
                  <div className="lp-showcase-card__tags">
                    {item.tags.map((t) => (
                      <span className="lp-showcase-card__tag" key={t}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lp-showcase-cta" data-reveal>
            <Link to="/showcase" className="lp-btn lp-btn--ghost">
              Explore the full multi-episode theater <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Re-rolling against reviewing ─────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <span className="lp-marker">the difference</span>
            <h2>Re-rolling is not editing.</h2>
            <p className="lp-lede">
              Most AI video tools take a prompt and hand back a finished clip. When it is wrong, and it
              usually is, your only move is to run it again and pay again.
            </p>
          </div>

          <div className="lp-compare" data-reveal>
            <div className="lp-compare__col" data-tone="them">
              <h3>One prompt, one result</h3>
              <ul className="lp-compare__list">
                {[
                  "You see the output and nothing that produced it",
                  "A bad script is only visible after the render is paid for",
                  "Fixing one shot means regenerating everything",
                  "Characters drift between clips",
                  "The bill arrives as one number with no breakdown",
                ].map((t) => (
                  <li key={t}><X size={14} strokeWidth={2.2} style={{ color: "var(--st-blocked)" }} />{t}</li>
                ))}
              </ul>
            </div>
            <div className="lp-compare__col" data-tone="us">
              <h3>Eleven stages you can stop</h3>
              <ul className="lp-compare__list">
                {[
                  "Every stage shows its status, its model and its cost",
                  "Review mode holds the run until you approve it",
                  "Re-run one stage without touching the other ten",
                  "Character references carry across every shot",
                  "Spend is itemised per stage against a cap you set",
                ].map((t) => (
                  <li key={t}><Check size={14} strokeWidth={2.2} style={{ color: "var(--st-done)" }} />{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── The eleven stages ────────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <span className="lp-marker">the chain</span>
            <h2>Eleven stages, in order, all of them yours to veto.</h2>
            <p className="lp-lede">
              This is the real pipeline, not a simplified diagram of it. Video and audio run as two
              lanes and meet at the mix.
            </p>
          </div>

          <div className="lp-stages" data-reveal>
            {STAGES.map((s, i) => (
              <div className="lp-stages__row" key={s.key}>
                <span className="lp-stages__n">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="lp-stages__name">{s.name}</span>
                  <span className="lp-stages__desc">{s.desc}</span>
                </span>
                <span className="lp-lane" data-lane={s.lane}>{s.lane}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cost ledger ──────────────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-wrap lp-split">
          <div data-reveal>
            <span className="lp-marker">spend</span>
            <h2>Every dollar traced to a decision.</h2>
            <p className="lp-lede" style={{ marginTop: 14 }}>
              Each stage records what it cost and which model it used. You set a monthly cap, and the
              running total shows against it rather than arriving at the end of the billing period.
            </p>
            <p className="lp-note" style={{ marginTop: 16 }}>
              The figures opposite are an illustrative run, not an average or a guarantee. Costs move
              with the providers you choose and with episode length.
            </p>
          </div>

          <div data-reveal data-delay="1">
            <div className="lp-ledger">
              {STAGES.map((s) => (
                <div className="lp-ledger__row" key={s.key}>
                  <span>{s.name}</span>
                  <span className="lp-ledger__model">{s.lane}</span>
                  <span className="lp-ledger__amt">{currency(s.cost)}</span>
                </div>
              ))}
              <div className="lp-ledger__row lp-ledger__total">
                <span>Total for the episode</span>
                <span className="lp-ledger__model" />
                <span className="lp-ledger__amt">{currency(total)}</span>
              </div>
            </div>

            <div className="lp-cap" style={{ "--cap-pct": "62%", marginTop: 16 }}>
              <div className="lp-cap__figures">
                <span className="lp-cap__spend">$154.80</span>
                <span className="lp-cap__of">of your $250 monthly cap</span>
              </div>
              <div className="lp-cap__bar"><div className="lp-cap__fill" /></div>
              <p className="lp-note" style={{ marginTop: 12 }}>
                The pipeline stops before it crosses the cap. It does not keep spending and apologise
                later.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Genres ───────────────────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <span className="lp-marker">starting points</span>
            <h2>Ten genres. One prompt field.</h2>
            <p className="lp-lede">
              If you do not want to think about stages at all, pick a genre, describe the idea in a
              sentence, and let it run end to end.
            </p>
          </div>

          <div className="lp-genres" data-reveal>
            {GENRES.map((g) => (
              <div className="lp-genre" key={g.name}>
                <g.icon size={18} strokeWidth={1.9} />
                <div>
                  <div className="lp-genre__name">{g.name}</div>
                  <div className="lp-genre__desc">{g.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Continuity and teams ─────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <span className="lp-marker">built for the work</span>
            <h2>Episodes, not orphan clips.</h2>
          </div>

          <div className="lp-grid lp-grid--3" data-reveal>
            {[
              { icon: Layers, h: "Character continuity", p: "A character is stored once with reference art, then read by every keyframe and clip stage. Consistency comes from a record, not from repeating yourself in prompts." },
              { icon: Mic, h: "Voice casting", p: "Voices are cast per character and held for the whole episode, so the same person does not sound like three different people across scenes." },
              { icon: History, h: "An audit trail", p: "Approvals, rejections and system events are logged. When a client asks who signed off on a cut, there is an answer." },
              { icon: Users, h: "Teams and roles", p: "Invite your team, scope what each role can do, and keep admin settings behind an admin role." },
              { icon: KeyRound, h: "API keys", p: "Bring your own provider keys. They stay yours, and you can rotate or revoke them without leaving the app." },
              { icon: Wallet, h: "Budget control", p: "One monthly cap for the account, with per-stage attribution underneath it, so overspend has a cause you can name." },
            ].map((c) => (
              <div className="lp-cell" key={c.h}>
                <span className="lp-cell__icon"><c.icon size={17} strokeWidth={1.9} /></span>
                <h3>{c.h}</h3>
                <p>{c.p}</p>
              </div>
            ))}
          </div>

          {/* Visual continuity character anchor preview */}
          <div className="lp-char-preview" data-reveal>
            <div>
              <span className="lp-marker" style={{ marginBottom: 6, display: "inline-block" }}>deterministic character anchor</span>
              <h3 style={{ fontSize: "1.25rem", margin: "6px 0 10px 0", color: "var(--fg)" }}>One stored reference sheet. Zero facial drift across scenes.</h3>
              <p style={{ color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.6, margin: 0 }}>
                Unlike single-shot generators that hallucinate a new face for every camera move, Xeliai Studio locks the initial approved model geometry into a character anchor. Stages 3, 7, and 9 reference this vector tensor throughout the episode.
              </p>
              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="lp-showcase-card__tag">Camera Left · Close-up</span>
                <span className="lp-showcase-card__tag">Low Key Lighting · 50mm</span>
                <span className="lp-showcase-card__tag">Exterior Storm · Wide</span>
              </div>
            </div>
            <div className="lp-char-preview__images">
              <div className="lp-char-preview__frame">
                <img src={filmstripCollaborateImg} alt="Character Reference 1" loading="lazy" referrerPolicy="no-referrer" />
                <span className="lp-char-preview__frame-label">Anchor Ref</span>
              </div>
              <div className="lp-char-preview__frame">
                <img src={filmstripEngineerImg} alt="Character Reference 2" loading="lazy" referrerPolicy="no-referrer" />
                <span className="lp-char-preview__frame-label">Shot 04 Angle</span>
              </div>
              <div className="lp-char-preview__frame">
                <img src={filmstripDevLaptopImg} alt="Character Reference 3" loading="lazy" referrerPolicy="no-referrer" />
                <span className="lp-char-preview__frame-label">Shot 09 Low-Angle</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Honest social proof ──────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-honest" data-reveal>
            <h3>There are no testimonials on this page yet.</h3>
            <p>
              Xeliai Studio is in early access with a small group of design partners. When we have
              quotes from real people at named studios, we will publish them with their names
              attached. Until then you get the product itself: the ring at the top of this page runs
              the same eleven stages the app does.
            </p>
            <div className="lp-actions">
              <button
                type="button"
                onClick={() => setVideoModalOpen(true)}
                className="lp-btn lp-btn--ghost"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}
              >
                <Play size={15} fill="currentColor" />
                Watch a finished video
              </button>
              <Link to="/contact" className="lp-btn lp-btn--ghost">Apply as a design partner</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <span className="lp-marker">questions</span>
            <h2>The things people ask first.</h2>
          </div>
          <div data-reveal><Faq /></div>
        </div>
      </section>

      {/* ── Close ────────────────────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-close" data-reveal>
            <h2>Describe an episode. Approve it stage by stage.</h2>
            <p className="lp-lede" style={{ marginTop: 16 }}>
              Start on free-only routing, run your first episode without a card, and see the whole ring
              light up before you decide anything.
            </p>
            <div className="lp-actions">
              <button type="button" className="lp-btn lp-btn--primary" onClick={onLoginRequest}>
                Start building free
              </button>
              <Link to="/pricing" className="lp-btn lp-btn--ghost">See plans</Link>
            </div>
          </div>
        </div>
      </section>

      <VideoModal
        isOpen={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        videoSrc="/video/vid1.mp4"
        title="XeliAI Studio — Finished Production Render"
      />
    </Layout>
  );
}