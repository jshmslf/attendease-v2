"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api, AttendanceRecord } from "@/lib/api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface WsAttendanceUpdate {
  type: string;
  student_id: string;
  student_name: string;
  confidence: number;
  status: string;
  already_marked: boolean;
}

interface Stats {
  total: number;
  present: number;
  late: number;
  totalStudents: number;
}

interface OverrideForm {
  student_id: string;
  date: string;
  time_in: string;
  status: string;
  notes: string;
}

interface OverrideModalProps {
  record: AttendanceRecord;
  onClose: () => void;
  onSuccess: () => void;
}

interface ClearConfirmModalProps {
  date: string;
  clearing: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}

const statusMap: Record<string, string> = {
  present: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  late: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  absent: "bg-red-500/20 text-red-300 border-red-500/30",
  already_marked: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusMap[status] ?? statusMap.absent}`}>
      {status?.replace("_", " ").toUpperCase()}
    </span>
  );
}

function ClearConfirmModal({ date, clearing, error, onConfirm, onClose }: ClearConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "#7f1d1d30" }}
          >
            <svg className="w-5 h-5" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.75L13.75 4a2 2 0 00-3.5 0L3.25 16.25A2 2 0 005.07 19z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
              Clear attendance records?
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              All records for <strong style={{ color: "var(--text-primary)" }}>{formatDateLabel(date)}</strong> will be permanently deleted.
            </p>
          </div>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg text-sm"
            style={{ background: "#7f1d1d30", border: "1px solid #ef4444", color: "#fca5a5" }}>
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={clearing}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "#ef4444", opacity: clearing ? 0.6 : 1, cursor: clearing ? "not-allowed" : "pointer" }}
          >
            {clearing ? "Clearing..." : "Clear Records"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OverrideModal({ record, onClose, onSuccess }: OverrideModalProps) {
  const [form, setForm] = useState<OverrideForm>({
    student_id: record.student_id ?? "",
    date: new Date().toISOString().split("T")[0],
    time_in: record.time_in ? record.time_in.substring(11, 16) : "",
    status: record.status ?? "present",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.overrideAttendance({ ...form, time_in: form.time_in || undefined });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Override failed");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Manual Override</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg text-sm"
            style={{ background: "#7f1d1d30", border: "1px solid #ef4444", color: "#fca5a5" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Student ID</label>
            <input type="text" value={form.student_id} required
              onChange={(e) => setForm({ ...form, student_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Date</label>
            <input type="date" value={form.date} required
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Time In</label>
            <input type="time" value={form.time_in}
              onChange={(e) => setForm({ ...form, time_in: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Status</label>
            <select value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Notes (optional)</label>
            <textarea value={form.notes} rows={2} placeholder="Reason for override..."
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={inputStyle} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "var(--accent)" }}>
              {loading ? "Saving..." : "Save Override"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, present: 0, late: 0, totalStudents: 0 });
  const [connected, setConnected] = useState(false);
  const [gatewayLive, setGatewayLive] = useState(false);
  const [gatewaySecondsAgo, setGatewaySecondsAgo] = useState<number | null>(null);
  const gatewayPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastUpdate, setLastUpdate] = useState<WsAttendanceUpdate | null>(null);
  const [overrideRecord, setOverrideRecord] = useState<AttendanceRecord | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isToday = selectedDate === todayIso();

  const fetchAttendanceForDate = useCallback(async (date: string) => {
    try {
      const data = await api.getAttendanceByDate(date);
      setRecords(data);
      computeStats(data);
    } catch (e) {
      console.error("Failed to fetch attendance:", e);
    }
  }, []);

  useEffect(() => {
    fetchAttendanceForDate(selectedDate);
  }, [selectedDate, fetchAttendanceForDate]);

  useEffect(() => {
    fetchTotalStudents();
    connectWebSocket();
    pollGatewayStatus();
    gatewayPollRef.current = setInterval(pollGatewayStatus, 3000);
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (gatewayPollRef.current) clearInterval(gatewayPollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pollGatewayStatus() {
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${BASE}/api/camera/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json() as { live: boolean; seconds_ago: number | null };
      setGatewayLive(data.live);
      setGatewaySecondsAgo(data.seconds_ago);
    } catch (_) {}
  }

  async function fetchTotalStudents() {
    try {
      const students = await api.getStudents();
      setStats((prev) => ({ ...prev, totalStudents: students.length }));
    } catch (_) {}
  }

  async function handleClearConfirmed() {
    setClearError("");
    setClearing(true);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${BASE}/api/attendance/?date=${selectedDate}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Clear failed");
      setShowClearConfirm(false);
      await fetchAttendanceForDate(selectedDate);
    } catch (e) {
      setClearError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setClearing(false);
    }
  }

  function computeStats(data: AttendanceRecord[]) {
    setStats((prev) => ({
      ...prev,
      total: data.length,
      present: data.filter((r) => r.status === "present").length,
      late: data.filter((r) => r.status === "late").length,
    }));
  }

  function connectWebSocket() {
    const ws = new WebSocket(`${WS_URL}/api/camera/ws/live`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      reconnectRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as WsAttendanceUpdate;
        if (data.type === "attendance_update" && !data.already_marked) {
          setLastUpdate(data);
          // only inject live record into table when viewing today
          setSelectedDate((cur) => {
            if (cur === todayIso()) {
              setRecords((prev) => {
                const newRecord: AttendanceRecord = {
                  id: crypto.randomUUID(),
                  student_id: data.student_id,
                  student_name: data.student_name,
                  time_in: new Date().toISOString(),
                  date: new Date().toISOString().split("T")[0],
                  status: data.status,
                  confidence_score: data.confidence,
                };
                const updated = [newRecord, ...prev];
                computeStats(updated);
                return updated;
              });
            }
            return cur;
          });
        }
      } catch (_) {}
    };
  }

  const statCards = [
    { label: "Enrolled Students", value: stats.totalStudents, color: "text-green-400" },
    { label: isToday ? "Total Scanned Today" : "Total Scanned", value: stats.total, color: "" },
    { label: "Present", value: stats.present, color: "text-emerald-400" },
    { label: "Late", value: stats.late, color: "text-amber-400" },
  ];

  return (
    <div className="p-8 w-full">
      <div className="mb-8 flex items-center justify-between">
        <div>
          {/* Date navigation */}
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
              style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              ‹
            </button>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {formatDateLabel(selectedDate)}
            </h1>
            <button
              onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
              disabled={isToday}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
              style={{
                background: "var(--bg-surface)",
                color: isToday ? "var(--border)" : "var(--text-secondary)",
                border: "1px solid var(--border)",
                cursor: isToday ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => { if (!isToday) e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { if (!isToday) e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              ›
            </button>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayIso())}
                className="ml-1 text-xs px-2 py-1 rounded-md"
                style={{ color: "var(--accent)", background: "#1DB95415" }}
              >
                Today
              </button>
            )}
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {isToday ? "Real-time attendance via gateway camera" : "Historical attendance records"}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
            <span style={{ color: "var(--text-secondary)" }}>{connected ? "Dashboard live" : "Reconnecting..."}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${gatewayLive ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span style={{ color: gatewayLive ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {gatewayLive
                ? `Gateway online${gatewaySecondsAgo !== null ? ` · ${gatewaySecondsAgo}s ago` : ""}`
                : "Gateway offline"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className={`text-3xl font-bold ${s.color}`} style={!s.color ? { color: "var(--text-primary)" } : undefined}>{s.value}</div>
            <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {lastUpdate && isToday && (
        <div className="mb-6 rounded-xl px-5 py-3 flex items-center gap-3 text-sm"
          style={{ background: "#22c55e15", border: "1px solid #22c55e30" }}>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-emerald-300">{lastUpdate.student_name}</span>
          <span style={{ color: "var(--text-secondary)" }}>just scanned in</span>
          <StatusBadge status={lastUpdate.status} />
          <span className="ml-auto text-xs" style={{ color: "var(--text-secondary)" }}>
            {(lastUpdate.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>
            {isToday ? "Today's Attendance" : `Attendance - ${formatDateLabel(selectedDate)}`}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchAttendanceForDate(selectedDate)}
              className="text-xs transition-colors"
              style={{ color: "var(--text-secondary)" }}
            >
              Refresh
            </button>
            {isToday && (
              <button
                onClick={() => { setClearError(""); setShowClearConfirm(true); }}
                className="text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
                style={{ background: "#7f1d1d30", border: "1px solid #ef444440", color: "#fca5a5" }}
              >
                Clear (Dev)
              </button>
            )}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <th className="px-6 py-3 text-left font-medium">Student ID</th>
              <th className="px-6 py-3 text-left font-medium">Name</th>
              <th className="px-6 py-3 text-left font-medium">Time In</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th className="px-6 py-3 text-left font-medium">Confidence</th>
              <th className="px-6 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center" style={{ color: "var(--text-secondary)" }}>
                  No attendance records for this date.
                </td>
              </tr>
            ) : (
              records.map((r, i) => (
                <tr key={r.id ?? i} className="transition-colors"
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#ffffff08")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="px-6 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{r.student_id}</td>
                  <td className="px-6 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{r.student_name}</td>
                  <td className="px-6 py-3" style={{ color: "var(--text-secondary)" }}>
                    {new Date(r.time_in).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-6 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-6 py-3" style={{ color: "var(--text-secondary)" }}>
                    {r.confidence_score != null ? `${(r.confidence_score * 100).toFixed(0)}%` : "Manual"}
                  </td>
                  <td className="px-6 py-3">
                    <button onClick={() => setOverrideRecord(r)}
                      className="text-xs px-2 py-1 rounded-md transition-all"
                      style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      Override
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showClearConfirm && (
        <ClearConfirmModal
          date={selectedDate}
          clearing={clearing}
          error={clearError}
          onConfirm={handleClearConfirmed}
          onClose={() => setShowClearConfirm(false)}
        />
      )}

      {overrideRecord && (
        <OverrideModal
          record={overrideRecord}
          onClose={() => setOverrideRecord(null)}
          onSuccess={() => fetchAttendanceForDate(selectedDate)}
        />
      )}
    </div>
  );
}
