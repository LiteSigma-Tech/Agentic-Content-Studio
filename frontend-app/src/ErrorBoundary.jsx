import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { T, sans, mono, Panel, Btn } from "./app/shared/ui";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: T.ink,
            color: T.paper,
            padding: 24,
            fontFamily: sans,
          }}
        >
          <Panel style={{ padding: 24, maxWidth: 500, border: `1px solid ${T.clay}55` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.clay }}>
              <AlertTriangle size={20} />
              <div style={{ font: `700 16px/1.3 ${sans}` }}>Console Render Issue</div>
            </div>
            <div style={{ font: `400 13px/1.5 ${sans}`, color: T.muted, marginTop: 10 }}>
              {this.state.error?.message || "An unexpected error occurred in this view."}
            </div>
            <div style={{ marginTop: 16 }}>
              <Btn
                kind="primary"
                icon={RotateCcw}
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                Reload Console
              </Btn>
            </div>
          </Panel>
        </div>
      );
    }
    return this.props.children;
  }
}
