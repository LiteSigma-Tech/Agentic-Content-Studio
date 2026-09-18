import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import Layout from "../landing/Layout";


import filmstripCollaborateImg from "../assets/landing/img2.webp";

import lighthouseImg from '../assets/showcase/lighthouse.webp';
import atlasImg from '../assets/showcase/atlas.webp';
import pipImg from '../assets/showcase/pip.webp';
import vergeImg from '../assets/showcase/verge.webp';
import recapImg from '../assets/showcase/recap.webp';
import brainstormingImg from '../assets/showcase/brainstorming.webp';
/* ═══════════════════════════════════════════════════════════════════════
   Media
   Each entry points at a clip and high-res image/poster.
   A slide with no clip falls back to its image/poster, and
   a slide with neither renders a deliberate placeholder rather than a
   broken image, so a deploy without assets still looks intentional.
   ═══════════════════════════════════════════════════════════════════════ */

const PIECES = [
  {
    id: "director-ideation",
    tag: "Interactive Planning",
    title: "XeliAI Lab: Director Ideation",
    desc: "Prompt engineers and creative directors decompose story arcs into deterministic stage bounds, locking visual tokens before triggering GPU clusters.",
    meta: ["XeliAI Lab", "Interactive Planning", "Story Decomposition", "Visual Tokens", "Zero-drift Anchors"],
    video: "/showcase/brainstorming.mp4",
    image: filmstripCollaborateImg,
    poster: "/showcase/brainstorming.webp",
  },
  {
    id: "lighthouse",
    tag: "Drama",
    title: "The Keeper and the Whale",
    desc: "A six-shot short built from a single sentence. Character reference art carried the keeper across every shot without re-prompting her appearance once.",
    meta: ["11 stages", "6 shots", "2 voices", "free-only routing"],
    video: "/showcase/lighthouse.mp4",
    image: lighthouseImg,
    poster: "/showcase/lighthouse.webp",
  },
  {
    id: "atlas",
    tag: "Brand explainer",
    title: "Atlas Logistics, ninety seconds",
    desc: "Script approved on the second draft, keyframes approved on the first. Clips were the only stage routed to a paid provider.",
    meta: ["11 stages", "9 shots", "1 narrator", "1 paid stage"],
    video: "/showcase/atlas.mp4",
    image: atlasImg,
    poster: "/showcase/atlas.webp",
  },
  {
    id: "orbit-kids",
    tag: "Kids cartoon",
    title: "Pip and the Paper Moon",
    desc: "Script, dialogue and score generated only by providers tagged moderation-cleared. The routing rule is enforced by the policy engine, not by a line in a prompt.",
    meta: ["moderation-cleared", "8 shots", "3 voices", "free-only routing"],
    video: "/showcase/pip.mp4",
    image: pipImg,
    poster: "/showcase/pip.webp",
  },
  {
    id: "verge",
    tag: "Sci-fi",
    title: "Signal from the Verge",
    desc: "Rejected at the keyframe stage three times before approval. Every rejection cost nothing, because clips and render had not run yet.",
    meta: ["3 rejections", "12 shots", "original score", "1 paid stage"],
    video: "/showcase/verge.mp4",
    image: vergeImg,
    poster: "/showcase/verge.webp",
  },
  {
    id: "recap",
    tag: "Documentary",
    title: "Daily Recap, batch of five",
    desc: "Five micro-episodes produced from one template in a single sitting. Same voice cast, same score, different scripts.",
    meta: ["5 episodes", "batch run", "1 voice", "free-only routing"],
    video: "/showcase/recap.mp4",
    image: recapImg,
    poster: "/showcase/recap.webp",
  },
];

/* One slide. Media is layered underneath a neutral scrim, with no
   controls and no pointer events, so the piece reads as a window rather
   than a player. */
function Piece({ piece, index, total, registerRef, isFirst }) {
  const [videoFailed, setVideoFailed] = useState(!piece.video);
  const [posterFailed, setPosterFailed] = useState(false);

  const mediaImg = piece.image || piece.poster;
  const showVideo = !videoFailed;
  const showPoster = videoFailed && !posterFailed && Boolean(mediaImg);
  const showFallback = (videoFailed && !mediaImg) || (videoFailed && posterFailed);

  return (
    <section
      className="showcase__slide"
      ref={(node) => registerRef(index, node)}
      data-index={index}
      aria-label={`${piece.title}, piece ${index + 1} of ${total}`}
    >
      <div className="showcase__media" aria-hidden="true">
        {showVideo && (
          <video
            src={piece.video}
            poster={mediaImg || undefined}
            autoPlay
            muted
            loop
            playsInline
            preload={isFirst ? "auto" : "metadata"}
            disablePictureInPicture
            controlsList="nodownload noplaybackrate noremoteplayback"
            tabIndex={-1}
            onError={() => setVideoFailed(true)}
          />
        )}
        {showPoster && (
          <img
            src={mediaImg}
            alt={piece.title}
            loading={isFirst ? "eager" : "lazy"}
            onError={() => setPosterFailed(true)}
          />
        )}
        {showFallback && (
          <div className="showcase__fallback">
            <span>{piece.id}</span>
          </div>
        )}
      </div>

      <div className="showcase__scrim" aria-hidden="true" />

      <div className="showcase__caption">
        <span className="showcase__index">
          {String(index + 1).padStart(2, "0")} of {String(total).padStart(2, "0")}
        </span>
        <span className="showcase__tag">{piece.tag}</span>
        <h2 className="showcase__title">{piece.title}</h2>
        <p className="showcase__desc">{piece.desc}</p>
        <div className="showcase__meta">
          {piece.meta.map((m) => <span key={m}>{m}</span>)}
        </div>
      </div>

      {isFirst && (
        <div className="showcase__cue" aria-hidden="true">
          <span>scroll</span>
          <ChevronDown size={14} strokeWidth={2} />
        </div>
      )}
    </section>
  );
}

export default function Showcase({ onLoginRequest }) {
  const [active, setActive] = useState(0);
  const reelRef = useRef(null);
  const slideRefs = useRef([]);

  const registerRef = useCallback((index, node) => {
    slideRefs.current[index] = node;
  }, []);

  /* A single observer on the reel decides which piece is in view. It
     drives the caption entrance and the position rail, and it is the
     only scroll work this page does: no scroll handler, no rAF loop. */
  useEffect(() => {
    const nodes = slideRefs.current.filter(Boolean);
    if (!nodes.length) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      nodes.forEach((n) => n.classList.add("is-active"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const i = Number(entry.target.dataset.index);
          if (entry.isIntersecting) {
            entry.target.classList.add("is-active");
            setActive(i);
          } else {
            entry.target.classList.remove("is-active");
          }
        });
      },
      { root: reelRef.current, threshold: 0.55 }
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  const goTo = useCallback((index) => {
    slideRefs.current[index]?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  /* Arrow and Home keys move between pieces, so the gallery is usable
     without a trackpad. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goTo(Math.min(active + 1, PIECES.length));
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goTo(Math.max(active - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo]);

  return (
    <Layout onLoginRequest={onLoginRequest} immersive>
      <div className="showcase">
        <nav className="showcase__rail" aria-label="Pieces">
          {PIECES.map((p, i) => (
            <button
              type="button"
              key={p.id}
              className="showcase__dot"
              aria-current={active === i ? "true" : undefined}
              aria-label={`Go to ${p.title}`}
              onClick={() => goTo(i)}
            >
              <i aria-hidden="true" />
              <span>{p.tag}</span>
            </button>
          ))}
        </nav>

        <div className="showcase__reel" ref={reelRef}>
          {PIECES.map((p, i) => (
            <Piece
              key={p.id}
              piece={p}
              index={i}
              total={PIECES.length}
              registerRef={registerRef}
              isFirst={i === 0}
            />
          ))}

          <section className="showcase__outro">
            <div>
              <h2>Every one of these stopped for approval.</h2>
              <p>
                None of them was a single prompt. Each ran through eleven stages, paused where the
                director asked it to, and recorded what every stage cost.
              </p>
              <div className="lp-actions">
                <button type="button" className="lp-btn lp-btn--primary" onClick={onLoginRequest}>
                  Start building free
                </button>
                <Link to="/how-it-works" className="lp-btn lp-btn--ghost">See how it works</Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}