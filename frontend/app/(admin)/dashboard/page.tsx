"use client";

import { useState, useEffect, useRef } from "react";
import { api, AttendanceRecord } from "@/lib/api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

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
  status: string;
  notes: string;
}

interface OverrideModalProps {
  record: AttendanceRecord;
  onClose: () => void;
  onSuccess: () => void;
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

function OverrideModal({ record, onClose, onSuccess }: OverrideModalProps) {
  const [form, setForm] = useState<OverrideForm>({
    student_id: record.student_id ?? "",
    date: new Date().toISOString().split("T")[0],
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
      await api.overrideAttendance(form);
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
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, present: 0, late: 0, totalStudents: 0 });
  const [connected, setConnected] = useState(false);
  const [gatewayLive, setGatewayLive] = useState(false);
  const [gatewaySecondsAgo, setGatewaySecondsAgo] = useState<number | null>(null);
  const gatewayPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastUpdate, setLastUpdate] = useState<WsAttendanceUpdate | null>(null);
  const [overrideRecord, setOverrideRecord] = useState<AttendanceRecord | null>(null);
  const [clearing, setClearing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchTodayAttendance();
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

  async function fetchTodayAttendance() {
    try {
      const data = await api.getTodayAttendance();
      setRecords(data);
      computeStats(data);
    } catch (e) {
      console.error("Failed to fetch attendance:", e);
    }
  }

  async function fetchTotalStudents() {
    try {
      const students = await api.getStudents();
      setStats((prev) => ({ ...prev, totalStudents: students.length }));
    } catch (_) {}
  }

  async function handleClearAttendance() {
    const today = new Date().toISOString().split("T")[0];
    if (!window.confirm(`[DEV] Delete all attendance records for ${today}? This cannot be undone.`)) return;
    setClearing(true);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${BASE}/api/attendance/?date=${today}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Clear failed");
      const { deleted } = await res.json() as { deleted: number };
      alert(`Cleared ${deleted} record(s).`);
      await fetchTodayAttendance();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Clear failed");
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
      } catch (_) {}
    };
  }

  const statCards = [
    { label: "Enrolled Students", value: stats.totalStudents, color: "text-green-400" },
    { label: "Total Scanned Today", value: stats.total, color: "text-white" },
    { label: "Present", value: stats.present, color: "text-emerald-400" },
    { label: "Late", value: stats.late, color: "text-amber-400" },
  ];

  return (
    <div className="p-8 w-full">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Real-time attendance via gateway camera
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
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {lastUpdate && (
        <div className="mb-6 rounded-xl px-5 py-3 flex items-center gap-3 text-sm"
          style={{ background: "#22c55e15", border: "1px solid #22c55e30" }}>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-emerald-300">{lastUpdate.student_name}</span>
          <span style={{ color: "var(--text-secondary)" }}>just scanned in —</span>
          <StatusBadge status={lastUpdate.status} />
          <span className="ml-auto text-xs" style={{ color: "var(--text-secondary)" }}>
            {(lastUpdate.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>Today&apos;s Attendance</span>
          <div className="flex items-center gap-3">
            <button onClick={fetchTodayAttendance} className="text-xs transition-colors" style={{ color: "var(--text-secondary)" }}>
              Refresh
            </button>
            <button
              onClick={handleClearAttendance}
              disabled={clearing}
              className="text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
              style={{ background: "#7f1d1d30", border: "1px solid #ef444440", color: "#fca5a5" }}
            >
              {clearing ? "Clearing..." : "Clear (Dev)"}
            </button>
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
                  No attendance records yet today.
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

      {overrideRecord && (
        <OverrideModal
          record={overrideRecord}
          onClose={() => setOverrideRecord(null)}
          onSuccess={fetchTodayAttendance}
        />
      )}
    </div>
  );
}
