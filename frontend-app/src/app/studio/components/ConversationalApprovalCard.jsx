import { useState } from "react";
import { Check, X, ShieldCheck } from "lucide-react";
import { Btn, Pill, T, mono, sans } from "../../shared/ui";

export default function ConversationalApprovalCard({
  approval,
  onApprove,
  onReject,
  approving,
  rejecting,
}) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");

  function handleApprove() {
    onApprove(note);
    setNote("");
    setShowNote(false);
  }

  function handleReject() {
    onReject(note);
    setNote("");
    setShowNote(false);
  }

  return (
    <div
      style={{
        background: T.panel2,
        border: `1px solid ${T.line2}`,
        borderRadius: 8,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ font: `600 12px/1 ${sans}`, color: T.paper }}>
          {approval.to}
        </div>
        <Pill status="awaiting_review" label="awaiting approval" />
      </div>

      <div style={{ font: `600 12px/1.3 ${sans}`, color: T.paper, marginTop: 8 }}>
        {approval.subject}
      </div>

      <div style={{ font: `400 11px/1.5 ${sans}`, color: T.muted, marginTop: 4 }}>
        {approval.body}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <Btn
          kind="ok"
          icon={Check}
          onClick={handleApprove}
          disabled={approving || rejecting}
        >
          {approving ? "Approving..." : "Approve & send"}
        </Btn>

        <Btn
          kind="danger"
          icon={X}
          onClick={handleReject}
          disabled={approving || rejecting}
        >
          {rejecting ? "Rejecting..." : "Reject"}
        </Btn>

        <Btn
          onClick={() => setShowNote((visible) => !visible)}
          disabled={approving || rejecting}
        >
          {showNote ? "Hide note" : "Add note"}
        </Btn>
      </div>

      {showNote && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <div>
            <label style={{ font: `500 10px/1 ${mono}`, color: T.muted }}>
              Approval note (optional)
            </label>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add an optional note for this approval decision"
              rows={3}
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                background: T.ink,
                color: T.paper,
                border: `1px solid ${T.line2}`,
                borderRadius: 7,
                padding: "10px 12px",
                font: `400 12px/1.5 ${sans}`,
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}