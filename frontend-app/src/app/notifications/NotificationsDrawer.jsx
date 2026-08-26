import React from "react";
import { X, Bell, CheckCircle2, AlertTriangle, Info, Clock, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Panel, Eyebrow, Pill, Btn, T, sans, mono } from "../shared/ui";

export default function NotificationsDrawer({ isOpen, onClose, notifications = [] }) {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(2px)",
              zIndex: 998,
            }}
          />

          {/* Slide-Over Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "100%",
              maxWidth: 400,
              background: T.panel,
              borderLeft: `1px solid ${T.line}`,
              boxShadow: T.shadow,
              zIndex: 999,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: `1px solid ${T.line}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={16} color={T.amber} />
                <div style={{ font: `700 15px/1 ${sans}`, color: T.paper }}>
                  Quick Notifications
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: T.muted,
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content List */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "grid", gap: 10 }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 16px", color: T.faint }}>
                  <Bell size={28} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                  <div style={{ font: `600 13px/1.3 ${sans}`, color: T.paper }}>No unread alerts</div>
                  <div style={{ font: `400 12px/1.5 ${sans}`, marginTop: 4 }}>
                    System health is optimal. Pipeline run notifications will show here.
                  </div>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: "12px 14px",
                      background: T.panel2,
                      border: `1px solid ${n.unread ? `${T.amber}55` : T.line2}`,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ font: `600 12px/1.3 ${sans}`, color: T.paper }}>
                        {n.title}
                      </div>
                      <span style={{ font: `500 10px/1 ${mono}`, color: T.faint }}>
                        {n.time}
                      </span>
                    </div>
                    <div style={{ font: `400 11px/1.4 ${sans}`, color: T.muted, marginTop: 4 }}>
                      {n.message}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "14px 20px",
                borderTop: `1px solid ${T.line}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: T.panel2,
              }}
            >
              <span style={{ font: `500 11px/1 ${mono}`, color: T.faint }}>
                Quick Access Panel
              </span>
              <button
                onClick={() => {
                  onClose();
                  navigate("/notifications");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: T.amber,
                  font: `600 11px/1 ${mono}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Open Full Hub <ExternalLink size={12} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
