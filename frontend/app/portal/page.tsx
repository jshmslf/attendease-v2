"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AttendanceData, AttendanceSummary, AttendanceRecord, StudentResponse, ParentInfo } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function studentFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("student_token") : null;
  const isJson = typeof init.body === "string";
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(isJson ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error((err as { detail?: string }).detail || "Request failed");
    }
    return res.json() as Promise<T>;
  });
}

const MONTHS = [
  "All", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function AttendanceBar({ rate }: { rate: number }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
      <div
        className={`h-2 rounded-full transition-all duration-700 ${
          rate >= 90 ? "bg-emerald-400" : rate >= 75 ? "bg-amber-400" : "bg-red-400"
        }`}
        style={{ width: `${rate}%` }}
      />
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    present: "bg-emerald-400",
    late: "bg-amber-400",
    absent: "bg-red-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[status] ?? "bg-slate-400"}`} />;
}

export default function PortalPage() {
  const router = useRouter();
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());

  const [profile, setProfile] = useState<StudentResponse | null>(null);
  const [myParents, setMyParents] = useState<ParentInfo[]>([]);

  const [msgOpen, setMsgOpen] = useState(false);
  const [msgBody, setMsgBody] = useState("");
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [msgSuccess, setMsgSuccess] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("student_token");
    if (!token) {
      router.replace("/portal/login");
      return;
    }
    fetchProfile();
    fetchAttendance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  async function fetchProfile() {
    const [profileResult, parentsResult] = await Promise.allSettled([
      studentFetch<StudentResponse>("/api/students/me"),
      studentFetch<ParentInfo[]>("/api/students/me/parents"),
    ]);
    if (profileResult.status === "fulfilled") {
      setProfile(profileResult.value);
    } else {
      console.error("profile fetch failed", profileResult.reason);
    }
    if (parentsResult.status === "fulfilled") {
      setMyParents(parentsResult.value);
    } else {
      console.error("parents fetch failed", parentsResult.reason);
    }
  }

  async function fetchAttendance() {
    setLoading(true);
    try {
      const params: Record<string, string> = { year: String(year) };
      if (month > 0) params.month = String(month);
      const qs = new URLSearchParams(params).toString();
      const res = await studentFetch<AttendanceData>(`/api/attendance/student/me?${qs}`);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!msgBody.trim()) return;
    setMsgLoading(true);
    setMsgError("");
    setMsgSuccess(false);
    try {
      await studentFetch("/api/messages/", {
        method: "POST",
        body: JSON.stringify({ body: msgBody.trim() }),
      });
      setMsgBody("");
      setMsgSuccess(true);
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setMsgLoading(false);
    }
  }

  function handleMsgClose() {
    setMsgOpen(false);
    setMsgBody("");
    setMsgError("");
    setMsgSuccess(false);
  }

  function handleLogout() {
    localStorage.removeItem("student_token");
    router.replace("/portal/login");
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const summary: AttendanceSummary | undefined = data?.summary;
  const records: AttendanceRecord[] = data?.records ?? [];

  return (
    <div className="min-h-screen" style={{ background: "#f8f7f4" }}>
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <img src="/logo/logo-1x1-black.png" alt="AttendEase" className="w-8 h-8 rounded-lg object-contain" />
        <span className="font-semibold text-slate-800">AttendEase</span>
        <span className="text-slate-300 mx-1">·</span>
        <span className="text-slate-500 text-sm">My Attendance</span>
        <div className="ml-auto">
          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">

        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 overflow-hidden">
          <div className="px-6 py-5">
            {profile ? (
              <>
                <h2 className="text-lg font-semibold text-slate-800">
                  {profile.first_name} {profile.last_name}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {profile.student_id} · {profile.course} · Year {profile.year_level}
                </p>
                <p className="text-sm text-slate-500 mt-0.5">{profile.email}</p>
              </>
            ) : (
              <div className="space-y-1.5">
                <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-56 bg-slate-100 rounded animate-pulse" />
              </div>
            )}
          </div>

          {/* Parent / Guardian section */}
          <div className="border-t border-slate-100 px-6 py-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Parent / Guardian</p>
            {myParents.length === 0 ? (
              <p className="text-sm text-slate-400">No parent contact on record.</p>
            ) : (
              <ul className="space-y-3">
                {myParents.map((p) => (
                  <li key={p.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{p.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {p.phone_number} · {p.relationship_to_student}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-700"
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm border border-slate-200 bg-white text-slate-700"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={fetchAttendance}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:text-slate-800 transition-colors"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm">Loading your attendance...</div>
        ) : (
          <>
            {summary && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-slate-800 text-lg">Attendance Rate</h2>
                    <p className="text-slate-400 text-sm">
                      {month === 0 ? `Year ${year}` : `${MONTHS[month]} ${year}`}
                    </p>
                  </div>
                  <span className={`text-3xl font-bold ${
                    summary.attendance_rate >= 90 ? "text-emerald-500"
                    : summary.attendance_rate >= 75 ? "text-amber-500"
                    : "text-red-500"
                  }`}>
                    {summary.attendance_rate}%
                  </span>
                </div>
                <AttendanceBar rate={summary.attendance_rate} />
                <div className="grid grid-cols-3 gap-4 mt-6">
                  {([
                    { label: "Present", value: summary.present, color: "text-emerald-600" },
                    { label: "Late", value: summary.late, color: "text-amber-600" },
                    { label: "Absent", value: summary.absent, color: "text-red-500" },
                  ] as const).map((s) => (
                    <div key={s.label} className="text-center p-3 bg-slate-50 rounded-xl">
                      <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-slate-400 text-xs mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Attendance Records</h3>
                <span className="text-xs text-slate-400">{records.length} record{records.length !== 1 ? "s" : ""}</span>
              </div>
              {records.length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-400 text-sm">
                  No attendance records found for this period.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {records.map((r) => (
                    <li key={r.id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusDot status={r.status} />
                        <div>
                          <div className="text-sm font-medium text-slate-700">{r.date}</div>
                          <div className="text-xs text-slate-400 mt-0.5">Time in: {r.time_in}</div>
                        </div>
                      </div>
                      <span className="text-xs font-medium capitalize text-slate-500">{r.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>

      {/* Floating Contact Admin button */}
      <button
        onClick={() => setMsgOpen(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-full text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{ background: "linear-gradient(135deg, #1DB954, #158a3e)", zIndex: 40 }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        Contact Admin
      </button>

      {/* Contact Admin modal */}
      {msgOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
          <div
            className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
            style={{ background: "#fff", border: "1px solid #e2e8f0" }}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Contact Admin</h3>
                <p className="text-xs text-slate-400 mt-0.5">Send a support message</p>
              </div>
              <button onClick={handleMsgClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
            </div>
            <div className="px-5 py-4">
              {msgSuccess ? (
                <div className="py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-700">Message sent!</p>
                  <p className="text-xs text-slate-400 mt-1">The admin will get back to you.</p>
                  <button
                    onClick={handleMsgClose}
                    className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ background: "#1DB954" }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="space-y-3">
                  {msgError && (
                    <div className="px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-600">
                      {msgError}
                    </div>
                  )}
                  <textarea
                    required
                    rows={4}
                    value={msgBody}
                    autoFocus
                    onChange={(e) => { setMsgBody(e.target.value); setMsgError(""); }}
                    placeholder="Describe your concern or question..."
                    className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-slate-50 text-slate-800 outline-none focus:border-green-400 transition-colors resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleMsgClose}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={msgLoading || !msgBody.trim()}
                      className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity"
                      style={{
                        background: (msgLoading || !msgBody.trim()) ? "#1DB95480" : "#1DB954",
                        cursor: (msgLoading || !msgBody.trim()) ? "not-allowed" : "pointer",
                      }}
                    >
                      {msgLoading ? "Sending..." : "Send"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
