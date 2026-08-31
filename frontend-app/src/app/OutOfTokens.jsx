import { AlertTriangle } from "lucide-react";
import { T, mono, sans } from "./shared/ui";

// TODO(behavior, not decided per project notes): whether reaching this
// screen should pause in-progress runs, or only block NEW actions while
// letting in-flight work finish, is still an open product decision. This
// file intentionally does not guess — it's the static screen only. Whoever
// wires up the trigger needs to also decide:
//   - what condition fires it (quota endpoint? 402 response interception?)
//   - whether it's a full-page interstitial (as built here) or a dismissible
//     banner layered over AppShell
//   - what happens to a run that's mid-flight when the account runs out
// None of that is implemented here — only the visual.
//
// Standalone by design: not part of AppShell's nav/registry, matching the
// task's instruction that this isn't a normal section.
export default function OutOfTokens({ onNavigate }) {
  return (
    <div style={{
      background: T.ink, color: T.paper, minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24, font: `400 14px/1.5 ${sans}`,
    }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{
          width: 48, height: 48, borderRadius: 99, background: `${T.amber}1A`, border: `1px solid ${T.amber}55`,
          display: "grid", placeItems: "center", margin: "0 auto 20px",
        }}>
          <AlertTriangle size={22} color={T.amber} />
        </div>
        <div style={{ font: `700 18px/1.3 ${sans}`, color: T.paper, marginBottom: 8 }}>
          You've used up this plan's usage allowance
        </div>
        <div style={{ font: `400 13px/1.6 ${sans}`, color: T.muted, marginBottom: 28 }}>
          Upgrade your plan to continue running new work. Existing work in progress may or may not be
          affected — check with your team before assuming either way.
        </div>
        <button
          onClick={() => onNavigate?.("/settings")}
          style={{
            font: `700 13px/1 ${sans}`, padding: "12px 20px", borderRadius: 8, cursor: "pointer",
            background: T.amber, color: T.ink, border: `1px solid ${T.amber}`,
          }}
        >
          Upgrade plan
        </button>
        <div style={{ font: `500 10px/1 ${mono}`, color: T.faint, marginTop: 18 }}>
          usage-limit-reached
        </div>
      </div>
    </div>
  );
}
