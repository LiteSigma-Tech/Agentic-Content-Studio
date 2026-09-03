import React, { useState, useEffect } from "react";
import { useTheme } from "../../ThemeContext";
import PropTypes from "prop-types";
import { AlertTriangle, Copy, Check, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const DARK_TOKENS = {
  ink: "#05060c",
  panel: "#0b0d17",
  panel2: "#121523",
  raised: "#1b1f30",
  line: "#2a2f45",
  line2: "#171a26",
  paper: "#f5f0e8",
  muted: "#8e95a5",
  faint: "#565c6e",
  amber: " #a78bfa",
  teal: "#62B69E",
  clay: "#D2694B",
  violet: "#a78bfa",
  hitl: "#818cf8",
  statusAmber: "#f59e0b",
  success: "#10b981",
  danger: "#ef4444",
  radiusMd: "8px",
  radiusLg: "14px",
  shadow: "0 24px 80px rgb(0 0 0 / 0.5)",
  shadowGlow: "0 0 40px rgb(255 255 255 / 0.06)",
};

export const LIGHT_TOKENS = {
  ink: "#f6f7fb",
  panel: "#ebedf5",
  panel2: "#dfe2ef",
  raised: "#cfd3e5",
  line: "#c3c8dc",
  line2: "#e6e8f2",
  paper: "#0d0b14",
  muted: "#2c263b",
  faint: "#3d354d",
  amber: "#a78bfa",
  teal: "#0E7A5A",
  clay: "#B23B1E",
  violet: "#8b5cf6",
  hitl: "#4f46e5",
  statusAmber: "#f59e0b",
  success: "#10b981",
  danger: "#ef4444",
  radiusMd: "8px",
  radiusLg: "14px",
  shadow: "0 24px 80px rgb(0 0 0 / 0.08)",
  shadowGlow: "0 0 40px rgb(0 0 0 / 0.04)",
};

export function currentTokens() {
  if (typeof document === "undefined") return DARK_TOKENS;
  return document.documentElement.getAttribute("data-theme") === "light"
    ? LIGHT_TOKENS
    : DARK_TOKENS;
}

export const T = new Proxy({}, {
  get(_target, prop) {
    return currentTokens()[prop];
  },
});

const STATUS_TOKEN = {
  running: "statusAmber",
  done: "success",
  pending: "faint",
  blocked: "danger",
  ok: "teal",
  awaiting_review: "hitl",
  error: "danger",
  info: "hitl",
  warning: "statusAmber",
};

export const SC = new Proxy({}, {
  get(_target, prop) {
    const key = STATUS_TOKEN[prop];
    return key ? currentTokens()[key] : undefined;
  },
});

export const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
export const sans = "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";

/* ═══════════════════════════════════════════════════════════════
   Responsive breakpoints
   Generic, app-agnostic viewport helper — no router/auth deps,
   safe for any component that needs mobile/tablet/desktop layout.
   mobile  : < 640
   tablet  : 640-1023
   desktop : >= 1024
   ═══════════════════════════════════════════════════════════════ */

export const BP_TABLET = 640;
export const BP_DESKTOP = 1024;

export function getBreakpoint(width) {
  if (width < BP_TABLET) return "mobile";
  if (width < BP_DESKTOP) return "tablet";
  return "desktop";
}

export function useBreakpoint() {
  const [bp, setBp] = useState(() =>
    typeof window === "undefined" ? "desktop" : getBreakpoint(window.innerWidth)
  );
  useEffect(() => {
    const onResize = () => setBp(getBreakpoint(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return bp;
}

export function Eyebrow({ children, color = T.faint, style }) {
  useTheme();
  return (
    <div
      style={{
        font: `600 10px/1.4 ${mono}`,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color,
        display: "flex",
        alignItems: "center",
        gap: 6,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

Eyebrow.propTypes = {
  children: PropTypes.node.isRequired,
  color: PropTypes.string,
  style: PropTypes.object,
};

export function Lamp({ on, color = T.amber, size = 9 }) {
  useTheme();
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: 99,
        background: on ? color : T.line2,
        boxShadow: on ? `0 0 0 2px ${color}22, 0 0 10px ${color}` : "none",
        transition: "all .3s ease",
      }}
      className={on ? "led-pulse" : ""}
    />
  );
}

Lamp.propTypes = {
  on: PropTypes.bool,
  color: PropTypes.string,
  size: PropTypes.number,
};

export function Panel({ children, style, className = "", animate = false, ...props }) {
  useTheme();
  const baseStyle = {
    background: T.panel,
    border: `1px solid ${T.line}`,
    borderRadius: 10,
    boxShadow: T.shadowGlow,
    transition: "background 0.2s ease, border-color 0.2s ease",
    ...style,
  };

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={baseStyle}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div style={baseStyle} className={className} {...props}>
      {children}
    </div>
  );
}

Panel.propTypes = {
  children: PropTypes.node,
  style: PropTypes.object,
  className: PropTypes.string,
  animate: PropTypes.bool,
};

export function EmptyState({ title, body, action, icon: Icon }) {
  useTheme();
  return (
    <div
      style={{
        marginTop: 10,
        padding: "16px 18px",
        background: T.panel2,
        border: `1px solid ${T.line}`,
        borderRadius: 8,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      {Icon && (
        <div
          style={{
            padding: 8,
            borderRadius: 6,
            background: `${T.faint}1A`,
            color: T.muted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ font: `600 13px/1.3 ${sans}`, color: T.paper }}>{title}</div>
        <div style={{ font: `400 12px/1.5 ${sans}`, color: T.faint, marginTop: 4 }}>{body}</div>
        {action && (
          <div style={{ font: `500 11px/1.4 ${mono}`, color: T.muted, marginTop: 8 }}>
            {action}
          </div>
        )}
      </div>
    </div>
  );
}

EmptyState.propTypes = {
  title: PropTypes.node.isRequired,
  body: PropTypes.node.isRequired,
  action: PropTypes.node,
  icon: PropTypes.elementType,
};

export function errorGuidance(error, fallback = "Action failed.") {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  const message = typeof detail === "string" ? detail : detail?.message || error?.message || fallback;
  const capability = detail?.capability || detail?.task || detail?.stage || detail?.provider_task;

  if (status === 403) {
    return {
      title: "Not allowed",
      body: "Your current role does not have permission for this action. Ask an admin for the matching RBAC permission.",
      detail: message,
    };
  }
  if (status === 409) {
    return {
      title: "No eligible provider",
      body: capability
        ? `No provider is eligible for ${capability}. Open Models and check free-only routing plus required capabilities.`
        : "The API did not return a specific task or capability. Open Models and check free-only routing plus required capabilities.",
      detail: message,
    };
  }
  if (status === 429) {
    return {
      title: "Rate limit reached",
      body: "This tenant has exhausted its request bucket. Wait a moment before retrying so the queue can recover.",
      detail: message,
    };
  }
  if (status === 402) {
    return {
      title: "Quota exceeded",
      body: "The tenant spend or job cap has been reached. Review usage and plan limits before running more work.",
      detail: message,
    };
  }
  if (status === 422) {
    return {
      title: "Check the form",
      body: "The backend rejected one or more fields. Review required values and try again.",
      detail: message,
    };
  }
  return {
    title: fallback,
    body: "The request did not complete. If this keeps happening, check the service status and try again.",
    detail: message,
  };
}

export function ErrorBanner({ error }) {
  useTheme();
  if (!error) return null;
  const err = typeof error === "string" ? { title: error, body: "" } : error;

  return (
    <Panel
      style={{
        padding: 12,
        border: `1px solid ${T.clay}55`,
        background: `${T.clay}0F`,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <AlertTriangle size={15} color={T.clay} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <Eyebrow color={T.clay}>{err.title || "Error"}</Eyebrow>
          {err.body && (
            <div style={{ font: `400 11px/1.45 ${sans}`, color: T.muted, marginTop: 4 }}>
              {err.body}
            </div>
          )}
          {err.detail && (
            <div style={{ font: `500 10px/1.45 ${mono}`, color: T.faint, marginTop: 6 }}>
              {err.detail}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

ErrorBanner.propTypes = {
  error: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({
      title: PropTypes.node,
      body: PropTypes.node,
      detail: PropTypes.node,
    }),
  ]),
};

export function Pill({ status, label }) {
  useTheme();
  const c = SC[status] || T.muted;
  return (
    <span
      style={{
        font: `600 10px/1 ${mono}`,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: c,
        background: `${c}1A`,
        border: `1px solid ${c}40`,
        padding: "4px 8px",
        borderRadius: 5,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      <Lamp on color={c} size={6} />
      {label || status}
    </span>
  );
}

Pill.propTypes = {
  status: PropTypes.string.isRequired,
  label: PropTypes.node,
};

export function Btn({
  children,
  onClick,
  kind = "ghost",
  disabled,
  icon: Ic,
  type = "button",
  style,
  size = "md",
}) {
  useTheme();
  const styles = {
    primary: {
      background: T.amber,
      color: T.ink,
      border: `1px solid ${T.amber}`,
      boxShadow: `0 2px 10px ${T.amber}33`,
    },
    ok: {
      background: `${T.teal}22`,
      color: T.teal,
      border: `1px solid ${T.teal}55`,
    },
    danger: {
      background: `${T.clay}1A`,
      color: T.clay,
      border: `1px solid ${T.clay}55`,
    },
    ghost: {
      background: "transparent",
      color: T.paper,
      border: `1px solid ${T.line2}`,
    },
    raised: {
      background: T.raised,
      color: T.paper,
      border: `1px solid ${T.line}`,
    },
  }[kind];

  const sizePadding = size === "sm" ? "6px 10px" : size === "lg" ? "12px 18px" : "9px 14px";
  const fontSize = size === "sm" ? "11px" : "12px";

  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        font: `600 ${fontSize}/1 ${sans}`,
        padding: sizePadding,
        borderRadius: 7,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.15s ease",
        ...styles,
        ...style,
      }}
    >
      {Ic && <Ic size={size === "sm" ? 12 : 14} />}
      {children}
    </motion.button>
  );
}

Btn.propTypes = {
  children: PropTypes.node,
  onClick: PropTypes.func,
  kind: PropTypes.oneOf(["primary", "ok", "danger", "ghost", "raised"]),
  disabled: PropTypes.bool,
  icon: PropTypes.elementType,
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  style: PropTypes.object,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
};

export function Stat({ label, value, color = T.paper, sub, change }) {
  useTheme();
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Eyebrow>{label}</Eyebrow>
        {change && (
          <span style={{ font: `600 10px/1 ${mono}`, color: T.teal }}>
            {change}
          </span>
        )}
      </div>
      <div
        style={{
          font: `700 24px/1.1 ${sans}`,
          letterSpacing: "-0.02em",
          color,
          marginTop: 6,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ font: `500 11px/1.3 ${mono}`, color: T.faint, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

Stat.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.node.isRequired,
  color: PropTypes.string,
  sub: PropTypes.node,
  change: PropTypes.string,
};

export function PageHeader({ title, description, badge, action }) {
  useTheme();
  return (
    <div
      style={{
        marginBottom: 20,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1
            style={{
              font: `700 20px/1.25 ${sans}`,
              letterSpacing: "-0.015em",
              color: T.paper,
              margin: 0,
            }}
          >
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <div
            style={{
              font: `400 13px/1.5 ${sans}`,
              color: T.muted,
              marginTop: 4,
              maxWidth: 680,
            }}
          >
            {description}
          </div>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

PageHeader.propTypes = {
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  badge: PropTypes.node,
  action: PropTypes.node,
};

export function CopyBtn({ text, label }) {
  useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleCopy}
      style={{
        background: copied ? `${T.teal}1A` : "transparent",
        border: `1px solid ${copied ? T.teal : T.line2}`,
        color: copied ? T.teal : T.muted,
        borderRadius: 5,
        padding: "4px 8px",
        cursor: "pointer",
        font: `600 10px/1 ${mono}`,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        transition: "all 0.15s ease",
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "copied" : label || "copy"}
    </motion.button>
  );
}

CopyBtn.propTypes = {
  text: PropTypes.string.isRequired,
  label: PropTypes.string,
};

export function PlaceholderNotice({ children, title = "Design Note & Context" }) {
  useTheme();
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginBottom: 16,
        padding: "10px 14px",
        borderRadius: 8,
        border: `1px dashed ${T.violet}66`,
        background: `${T.violet}0C`,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <Info size={15} color={T.violet} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ font: `400 12px/1.5 ${sans}`, color: T.muted }}>
        <span style={{ font: `600 11px/1.2 ${mono}`, color: T.violet, marginRight: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          [{title}]
        </span>
        {children}
      </div>
    </motion.div>
  );
}

PlaceholderNotice.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string,
};

export const GENERIC_STAGES = [
  "ingest",
  "research",
  "script",
  "voiceover",
  "visuals",
  "music",
  "edit",
  "render",
  "review",
  "export",
  "publish",
];

export function GenericSignalChain({ idx, running }) {
  useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10, flexWrap: "wrap" }}>
      {GENERIC_STAGES.map((label, i) => {
        const done = i < idx;
        const current = i === idx && running;
        const color = done ? T.teal : current ? T.amber : T.line2;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              title={label}
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: color,
                boxShadow: current ? `0 0 0 2px ${color}22, 0 0 10px ${color}` : "none",
                transition: "all .3s",
              }}
              className={current ? "led-pulse" : ""}
            />
            {i < GENERIC_STAGES.length - 1 && (
              <div
                style={{
                  width: 14,
                  height: 2,
                  background: done ? T.teal : T.line2,
                  transition: "background .3s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

GenericSignalChain.propTypes = {
  idx: PropTypes.number.isRequired,
  running: PropTypes.bool,
};