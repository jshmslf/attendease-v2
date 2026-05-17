"use client";

import { useState, useEffect } from "react";
import { api, NotificationLog } from "@/lib/api";

const statusMap: Record<string, string> = {
  sent: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-300 border-red-500/30",
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusMap[status] ?? statusMap.pending}`}>
      {status?.toUpperCase()}
    </span>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadNotifications() {
    try {
      const data = await api.getNotifications(100);
      setNotifications(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="p-8 w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Parent Notifications</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Log of messages sent to parents when attendance is marked.{" "}
            <span className="italic">(SMS is simulated — messages are logged to the server console.)</span>
          </p>
        </div>
        <button
          onClick={loadNotifications}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          Refresh
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <th className="px-6 py-3 text-left font-medium">Student</th>
              <th className="px-6 py-3 text-left font-medium">Parent</th>
              <th className="px-6 py-3 text-left font-medium">Phone</th>
              <th className="px-6 py-3 text-left font-medium">Message</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th className="px-6 py-3 text-left font-medium">Sent At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center" style={{ color: "var(--text-secondary)" }}>
                  Loading notifications...
                </td>
              </tr>
            ) : notifications.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center" style={{ color: "var(--text-secondary)" }}>
                  No notifications yet. They appear here when attendance is marked.
                </td>
              </tr>
            ) : (
              notifications.map((n) => (
                <tr
                  key={n.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#ffffff08")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="px-6 py-3">
                    <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{n.student_name}</div>
                    <div className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{n.student_id}</div>
                  </td>
                  <td className="px-6 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{n.parent_name}</td>
                  <td className="px-6 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{n.phone_number}</td>
                  <td className="px-6 py-3 max-w-xs">
                    <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }} title={n.message}>
                      {n.message}
                    </p>
                  </td>
                  <td className="px-6 py-3"><StatusBadge status={n.status} /></td>
                  <td className="px-6 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {formatTime(n.sent_at ?? n.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        Auto-refreshes every 30 seconds. &quot;MOCK SMS&quot; entries appear in the backend server console.
      </p>
    </div>
  );
}
