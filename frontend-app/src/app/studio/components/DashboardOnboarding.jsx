/* DashoardOnboarding.jsx */
import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import { Btn, Panel, T, mono, sans } from "../../shared/ui";

const STORAGE_KEY = "agentic-dashboard-onboarding-seen";

export function isDashboardOnboardingDismissed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function DashboardOnboarding({ onCreate }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!isDashboardOnboardingDismissed());
  }, []);

  function complete() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }

    setVisible(false);
  }

  function handleCreate() {
    complete();
    onCreate?.();
  }

  if (!visible) return null;

  const areas = [
    {
      title: "Dashboard",
      body: "See your active work, production status, and what needs your attention.",
    },
    {
      title: "Studio",
      body: "Create an episode and move it through the production pipeline.",
    },
    {
      title: "Review Queue",
      body: "Handle the decisions that need human approval before production continues.",
    },
    {
      title: "Production",
      body: "Follow scripts, voices, visuals, and final episode output as the pipeline progresses.",
    },
  ];

  return (
    <Panel
      style={{
        padding: 18,
        border: `1px solid ${T.violet}44`,
        background: `${T.violet}0A`,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0, maxWidth: 900 }}>
          <div
            style={{
              font: `700 18px/1.2 ${sans}`,
              color: T.paper,
            }}
          >
            Welcome to Agentic Content Studio
          </div>

          <div
            style={{
              font: `400 12px/1.6 ${sans}`,
              color: T.muted,
              marginTop: 7,
              maxWidth: 760,
            }}
          >
            Turn an idea into a finished episode with an AI-assisted production
            workflow. Create, produce, review, and publish from one workspace.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 10,
              marginTop: 16,
            }}
          >
            {areas.map((area, index) => (
              <div
                key={area.title}
                style={{
                  display: "flex",
                  gap: 9,
                  padding: 11,
                  border: `1px solid ${T.line2}`,
                  borderRadius: 8,
                  background: T.panel2,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    flex: "0 0 auto",
                    borderRadius: 99,
                    display: "grid",
                    placeItems: "center",
                    background: index === 0 ? `${T.violet}22` : T.ink,
                    color: index === 0 ? T.violet : T.muted,
                    font: `600 10px/1 ${mono}`,
                  }}
                >
                  {index + 1}
                </div>

                <div>
                  <div
                    style={{
                      font: `600 11px/1.25 ${sans}`,
                      color: T.paper,
                    }}
                  >
                    {area.title}
                  </div>

                  <div
                    style={{
                      font: `400 10px/1.45 ${sans}`,
                      color: T.muted,
                      marginTop: 3,
                    }}
                  >
                    {area.body}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {onCreate && (
            <div
              style={{
                display: "flex",
                gap: 9,
                alignItems: "center",
                marginTop: 16,
                flexWrap: "wrap",
              }}
            >
              <Btn kind="primary" onClick={handleCreate}>
                Create your first episode
                <ArrowRight size={13} />
              </Btn>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  font: `500 10px/1 ${mono}`,
                  color: T.muted,
                }}
              >
                <CheckCircle2 size={12} />
                You can dismiss this introduction at any time
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Dismiss dashboard introduction"
          onClick={complete}
          style={{
            border: "none",
            background: "transparent",
            color: T.muted,
            cursor: "pointer",
            padding: 4,
            flex: "0 0 auto",
          }}
        >
          <X size={16} />
        </button>
      </div>
    </Panel>
  );
}

DashboardOnboarding.propTypes = {
  onCreate: PropTypes.func,
};