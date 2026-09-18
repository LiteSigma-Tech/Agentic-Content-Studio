import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ExternalLink,
} from "lucide-react";

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function VideoModal({
  isOpen,
  onClose,
  videoSrc = "/video/hero-studio-loop.mp4",
  title = "XeliAI Studio — Finished Production Render",
}) {
  const [mounted, setMounted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(15.12);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      } else if (e.key === " " && e.target.tagName !== "BUTTON" && e.target.tagName !== "INPUT") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Auto-play attempt on mount
    const timer = setTimeout(() => {
      const v = videoRef.current;
      if (v) {
        v.currentTime = 0;
        v.muted = true;
        setIsMuted(true);
        v.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }, 60);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isOpen, onClose]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const handleRestart = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
    setIsPlaying(true);
  };

  const handleSeek = (e) => {
    const v = videoRef.current;
    if (!v) return;
    const targetTime = Number(e.target.value);
    v.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 2800);
  };

  if (!isOpen || !mounted) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const modalContent = (
    <div
      className="lp-video-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="lp-video-modal-dialog">
        {/* Modal Top Header */}
        <div className="lp-video-modal-header">
          <div className="lp-video-modal-title">
            <span className="lp-video-modal-badge">
              <Play size={10} fill="currentColor" style={{ marginRight: 4 }} />
              Deterministic 11-Stage Output
            </span>
            <span className="lp-video-modal-title-text">{title}</span>
          </div>
          <button
            type="button"
            className="lp-video-modal-close"
            onClick={onClose}
            aria-label="Close video player"
            autoFocus
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Player Box with Custom Dedicated Controls */}
        <div
          ref={containerRef}
          className="lp-video-modal-body"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
        >
          <video
            ref={videoRef}
            src={videoSrc}
            className="lp-video-modal-video"
            playsInline
            loop
            muted={isMuted}
            onClick={togglePlay}
            onTimeUpdate={() => {
              if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
              }
            }}
            onLoadedMetadata={() => {
              if (videoRef.current && videoRef.current.duration) {
                setDuration(videoRef.current.duration);
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {/* Big Center Play Indicator on Pause */}
          {!isPlaying && (
            <button
              type="button"
              className="lp-video-modal-bigplay"
              onClick={togglePlay}
              aria-label="Play video"
            >
              <Play size={32} fill="currentColor" />
            </button>
          )}

          {/* Interactive Player Controls Bar */}
          <div
            className={`lp-video-modal-controls ${showControls || !isPlaying ? "is-visible" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Scrubber Progress Bar */}
            <div className="lp-video-modal-scrubber-wrap">
              <div
                className="lp-video-modal-scrubber-fill"
                style={{ width: `${progressPercent}%` }}
              />
              <input
                type="range"
                className="lp-video-modal-scrubber"
                min="0"
                max={duration || 15}
                step="0.05"
                value={currentTime}
                onChange={handleSeek}
                aria-label="Seek timeline"
              />
            </div>

            {/* Buttons Row */}
            <div className="lp-video-modal-btnrow">
              <div className="lp-video-modal-btnrow-left">
                {/* Play / Pause */}
                <button
                  type="button"
                  className="lp-video-ctrl-btn"
                  onClick={togglePlay}
                  title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
                </button>

                {/* Restart */}
                <button
                  type="button"
                  className="lp-video-ctrl-btn"
                  onClick={handleRestart}
                  title="Restart video"
                  aria-label="Restart video"
                >
                  <RotateCcw size={15} />
                </button>

                {/* Audio Mute Toggle */}
                <button
                  type="button"
                  className="lp-video-ctrl-btn"
                  onClick={toggleMute}
                  title={isMuted ? "Unmute audio" : "Mute audio"}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                </button>

                {/* Timestamp */}
                <span className="lp-video-modal-timer">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="lp-video-modal-btnrow-right">
                {/* Fullscreen */}
                <button
                  type="button"
                  className="lp-video-ctrl-btn"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  aria-label="Toggle Fullscreen"
                >
                  {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="lp-video-modal-footer">
          <div className="lp-video-modal-meta">
            <span>1280x720 H.264 • 25 FPS • Zero Drift Anchor</span>
          </div>
          <Link
            to="/showcase"
            onClick={onClose}
            className="lp-video-modal-link"
          >
            <span>Explore full multi-episode gallery</span>
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
