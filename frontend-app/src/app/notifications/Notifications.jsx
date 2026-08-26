import React, { useState } from "react";
import { Bell, CheckCircle2, AlertTriangle, Info, Clock, Check, Trash2, Filter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Panel, PageHeader, PlaceholderNotice, EmptyState, Pill, Btn, Eyebrow, T, sans, mono } from "../shared/ui";

const INITIAL_NOTIFICATIONS = [
  {
    id: "notif-1",
    category: "approvals",
    title: "Stage Gate Review Pending",
    body: "Episode #14 'Autonomous Video Creation Engine' is awaiting human-in-the-loop review on the 'review' stage.",
    time: "10m ago",
    status: "awaiting_review",
    unread: true,
  },
  {
    id: "notif-2",
    category: "runs",
    title: "Agent Run Completed",
    body: "Orchestration run #run_8819a finished rendering in 42s. Total compute spend: $1.42.",
    time: "1h ago",
    status: "done",
    unread: true,
  },
  {
    id: "notif-3",
    category: "security",
    title: "Webhook Payload Delivered",
    body: "Egress event 'run.done' was successfully received with HTTP 200 by https://hooks.slack.com/services/T01/...",
    time: "2h ago",
    status: "ok",
    unread: false,
  },
  {
    id: "notif-4",
    category: "system",
    title: "Spend Cap Threshold Advisory",
    body: "Tenant spend has reached $48.72 of the $250.00 monthly soft cap (19% consumed).",
    time: "1d ago",
    status: "warning",
    unread: false,
  },
];

export default function Notifications() {
  const [items, setItems] = useState(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState("all");

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "unread") return item.unread;
    return item.category === filter;
  });

  const markAllAsRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const clearAll = () => {
    setItems([]);
  };

  const toggleRead = (id) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: !n.unread } : n))
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: "grid", gap: 20, maxWidth: 900 }}
    >
      <PageHeader
        title="Notifications Hub"
        description="Full activity log and persistent notification feeds across pipelines, review gates, and system security."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Btn kind="ghost" size="sm" icon={Check} onClick={markAllAsRead} disabled={items.length === 0}>
              Mark All as Read
            </Btn>
            <Btn kind="ghost" size="sm" icon={Trash2} onClick={clearAll} disabled={items.length === 0}>
              Clear
            </Btn>
          </div>
        }
      />

      <PlaceholderNotice title="Architecture Discovery (Phase 2 & Phase 7)">
        This full page serves as the comprehensive <strong>"See All"</strong> notification hub, whereas the top-bar <strong>NotificationsDrawer</strong> serves as the quick-access flyout. In future versions, both surfaces subscribe to the unified SSE / WebSocket stream.
      </PlaceholderNotice>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { id: "all", label: `All (${items.length})` },
          { id: "unread", label: `Unread (${items.filter((i) => i.unread).length})` },
          { id: "approvals", label: "Approvals" },
          { id: "runs", label: "Pipeline Runs" },
          { id: "security", label: "Security & Webhooks" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 11,
              fontFamily: mono,
              fontWeight: 600,
              cursor: "pointer",
              border: `1px solid ${filter === tab.id ? T.amber : T.line2}`,
              background: filter === tab.id ? T.raised : "transparent",
              color: filter === tab.id ? T.amber : T.muted,
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div style={{ display: "grid", gap: 10 }}>
        {filteredItems.length === 0 ? (
          <EmptyState
            title="No notifications in this view"
            body="You are completely caught up. New system, pipeline, and approval notifications will appear here in real time."
            icon={Bell}
          />
        ) : (
          filteredItems.map((n, idx) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <Panel
                style={{
                  padding: 16,
                  border: `1px solid ${n.unread ? `${T.amber}55` : T.line}`,
                  background: n.unread ? `${T.amber}05` : T.panel,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
                    <div style={{ marginTop: 2 }}>
                      <Pill status={n.status} label={n.category} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ font: `700 14px/1.3 ${sans}`, color: T.paper }}>
                          {n.title}
                        </div>
                        {n.unread && (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 99,
                              background: T.amber,
                            }}
                          />
                        )}
                      </div>
                      <div style={{ font: `400 12px/1.5 ${sans}`, color: T.muted, marginTop: 4 }}>
                        {n.body}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                    <span style={{ font: `500 10px/1 ${mono}`, color: T.faint }}>
                      {n.time}
                    </span>
                    <button
                      onClick={() => toggleRead(n.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: T.muted,
                        fontSize: 10,
                        fontFamily: mono,
                        textDecoration: "underline",
                      }}
                    >
                      {n.unread ? "Mark read" : "Mark unread"}
                    </button>
                  </div>
                </div>
              </Panel>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
