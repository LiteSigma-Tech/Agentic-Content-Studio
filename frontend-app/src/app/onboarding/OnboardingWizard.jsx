
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, GitBranch, Film, X } from "lucide-react";
import { T, mono, sans, Panel, Btn, Eyebrow } from "../shared/ui";
import { useAuth } from "../../AuthContext";

const STORAGE_KEY_PREFIX = "onboarding_dismissed:";

export function markOnboardingDismissed(userId) {
  if (!userId) return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + userId, "true");
  } catch {
    // localStorage unavailable (private mode, etc) -- non-fatal, the
    // wizard just becomes reachable-every-time via /welcome instead of
    // auto-redirect-once. Not worth surfacing an error for.
  }
}

export function isOnboardingDismissed(userId) {
  if (!userId) return false;
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + userId) === "true";
  } catch {
    return false;
  }
}

const STEPS = [
  {
    id: "intro",
    icon: Sparkles,
    eyebrow: "welcome",
    title: "Turn a concept into a finished episode",
    body: "This is a control room, not a form. You describe what you want, the pipeline drafts it, and you approve or adjust at the points that matter.",
  },
  {
    id: "pipeline",
    icon: GitBranch,
    eyebrow: "how it works",
    title: "11 stages, one signal chain",
    body: "Script, voice casting, shot list, and final mix all run in sequence with live status. Turn on review mode and the pipeline pauses after each stage so you can check the work before it continues -- or leave it off and let it run end to end.",
  },
  {
    id: "cta",
    icon: Film,
    eyebrow: "ready",
    title: "Start your first episode",
    body: "Head into Studio, describe a concept, and watch the signal chain light up stage by stage.",
  },
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;
  const StepIcon = step.icon;

  function handleSkip() {
    markOnboardingDismissed(user?.id);
    navigate("/dashboard");
  }

  function handleNext() {
    if (!isLast) {
      setStepIdx((i) => i + 1);
      return;
    }
    markOnboardingDismissed(user?.id);
    navigate("/studio");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: T.ink,
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        <Panel style={{ padding: 32, position: "relative" }}>
          <button
            onClick={handleSkip}
            aria-label="Skip onboarding"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: T.muted,
              padding: 6,
              display: "flex",
            }}
          >
            <X size={16} />
          </button>

          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: T.radiusMd || 8,
              background: `${T.violet}1A`,
              border: `1px solid ${T.violet}40`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <StepIcon size={20} color={T.violet} />
          </div>

          <Eyebrow color={T.violet}>{step.eyebrow}</Eyebrow>
          <div style={{ font: `700 22px/1.25 ${sans}`, color: T.paper, marginTop: 8 }}>
            {step.title}
          </div>
          <div style={{ font: `400 13px/1.6 ${sans}`, color: T.muted, marginTop: 12 }}>
            {step.body}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {STEPS.map((s, i) => (
                <span
                  key={s.id}
                  style={{
                    width: i === stepIdx ? 18 : 6,
                    height: 6,
                    borderRadius: 99,
                    background: i === stepIdx ? T.violet : T.line2,
                    transition: "all .2s",
                  }}
                />
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {!isLast && (
                <Btn kind="ghost" onClick={handleSkip}>
                  Skip
                </Btn>
              )}
              <Btn kind="primary" icon={ArrowRight} onClick={handleNext}>
                {isLast ? "Start" : "Next"}
              </Btn>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}