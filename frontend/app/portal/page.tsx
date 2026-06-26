"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AttendanceData, AttendanceSummary, AttendanceRecord, StudentResponse, ParentInfo, Subject } from "@/lib/api";
import { useTheme } from "../context/ThemeContext";

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
    <div className="w-full rounded-full h-2 mt-2" style={{ background: "var(--bg-surface)" }}>
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
  const { theme, toggle } = useTheme();
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());

  const [profile, setProfile] = useState<StudentResponse | null>(null);
  const [myParents, setMyParents] = useState<ParentInfo[]>([]);
  const [mySubjects, setMySubjects] = useState<Subject[]>([]);

  const [msgOpen, setMsgOpen] = useState(false);
  const [msgBody, setMsgBody] = useState("");
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [msgSuccess, setMsgSuccess] = useState(false);

  const [calTooltip, setCalTooltip] = useState<{
    code: string; name: string; teacher: string; room?: string;
    start_time: string; end_time?: string; day: number;
    x: number; y: number; onRight: boolean;
  } | null>(null);
  const tooltipHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleHideTooltip() {
    tooltipHideTimer.current = setTimeout(() => setCalTooltip(null), 120);
  }
  function cancelHideTooltip() {
    if (tooltipHideTimer.current) clearTimeout(tooltipHideTimer.current);
  }
  function showTooltip(e: React.MouseEvent<HTMLDivElement>, entry: {
    code: string; name: string; teacher: string; room?: string;
    start_time: string; end_time?: string; day: number;
  }) {
    cancelHideTooltip();
    const rect = e.currentTarget.getBoundingClientRect();
    const onRight = rect.right + 220 > window.innerWidth;
    setCalTooltip({
      ...entry,
      x: onRight ? rect.left - 212 : rect.right + 8,
      y: Math.min(rect.top, window.innerHeight - 180),
      onRight,
    });
  }

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
    const [profileResult, parentsResult, subjectsResult] = await Promise.allSettled([
      studentFetch<StudentResponse>("/api/students/me"),
      studentFetch<ParentInfo[]>("/api/students/me/parents"),
      studentFetch<Subject[]>("/api/subjects/my"),
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
    if (subjectsResult.status === "fulfilled") {
      setMySubjects(subjectsResult.value);
    } else {
      console.error("subjects fetch failed", subjectsResult.reason);
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
    <div
      className="min-h-screen relative"
      style={{
        backgroundColor: "var(--bg-dark)",
        backgroundImage: "url('/image/ama_facade.png')",
        backgroundSize: "60% auto",
        backgroundPosition: "right 0px bottom -150px",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to right, var(--overlay-start-dense) 50%, var(--overlay-end-dense) 100%)", zIndex: 0 }}
      />
      <div className="relative" style={{ zIndex: 1 }}>
      <header
        className="px-4 md:px-6 py-4 flex items-center gap-3"
        style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}
      >
        <img src="/logo/logo-1x1.png"       alt="AttendEase" className="logo-dark  w-8 h-8 rounded-lg object-contain"
        /><img src="/logo/logo-1x1-black.png" alt=""            className="logo-light w-8 h-8 rounded-lg object-contain" aria-hidden
        />
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>AttendEase</span>
        <span className="mx-1" style={{ color: "var(--text-secondary)" }}>·</span>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>My Attendance</span>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={toggle}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            {theme === "dark" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <button
            onClick={handleLogout}
            className="text-sm transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">

        {/* Profile Card */}
        <div
          className="rounded-2xl shadow-sm mb-6 overflow-hidden"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="px-6 py-5">
            {profile ? (
              <>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                  {profile.first_name} {profile.last_name}
                </h2>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {profile.student_id} · {profile.course} · Year {profile.year_level}
                </p>
                {profile.section_name && (
                  <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    Section: <span style={{ color: "var(--text-primary)" }}>{profile.section_name}</span>
                  </p>
                )}
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{profile.email}</p>
              </>
            ) : (
              <div className="space-y-1.5">
                <div className="h-4 w-40 rounded animate-pulse" style={{ background: "var(--bg-surface)" }} />
                <div className="h-3 w-56 rounded animate-pulse" style={{ background: "var(--bg-surface)" }} />
              </div>
            )}
          </div>

          {/* Parent / Guardian section */}
          <div className="px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-secondary)" }}>
              Parent / Guardian
            </p>
            {myParents.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No parent contact on record. Contact your school admin to have one added.</p>
            ) : (
              <ul className="space-y-3">
                {myParents.map((p) => (
                  <li key={p.id} className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {p.phone_number} · {p.relationship_to_student}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>

        {/* Weekly Timetable - Google Calendar style */}
        {(() => {
          const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
          const HOUR_H = 64;

          function parseMin(t: string): number {
            const [h, m] = t.split(":").map(Number);
            return h * 60 + (m || 0);
          }

          function fmtHour(h: number): string {
            const suffix = h >= 12 ? "PM" : "AM";
            const display = h % 12 === 0 ? 12 : h % 12;
            return `${display}${suffix}`;
          }

          const allEntries = mySubjects.flatMap((subj) =>
            subj.schedules.map((sch) => ({ ...sch, subj }))
          );
          const activeDays = [...new Set(allEntries.map((e) => e.day_of_week))].sort((a, b) => a - b);

          const allStarts = allEntries.map((e) => parseMin(e.start_time));
          const allEnds = allEntries.map((e) =>
            e.end_time ? parseMin(e.end_time) : parseMin(e.start_time) + 60
          );
          const START_HOUR = allEntries.length ? Math.floor(Math.min(...allStarts) / 60) : 7;
          const END_HOUR = allEntries.length ? Math.ceil(Math.max(...allEnds) / 60) : 18;
          const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
          const gridHeight = (END_HOUR - START_HOUR) * HOUR_H;

          return (
            <div
              className="rounded-2xl shadow-sm mb-6 overflow-hidden"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>My Schedule</h3>
              </div>

              {allEntries.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                  No subjects assigned yet.
                </div>
              ) : (
                /* Single scroll container — handles both x (wide weeks) and y (tall day) */
                <div className="cal-scroll" style={{ overflow: "auto", maxHeight: 580 }}>
                <style>{`
                  .cal-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
                  .cal-scroll::-webkit-scrollbar-track { background: transparent; }
                  .cal-scroll::-webkit-scrollbar-thumb { background: #1DB95450; border-radius: 99px; }
                  .cal-scroll::-webkit-scrollbar-thumb:hover { background: #1DB954AA; }
                  .cal-scroll::-webkit-scrollbar-corner { background: transparent; }
                `}</style>
                  {/* min-width keeps columns from collapsing on narrow viewports */}
                  <div style={{ minWidth: 52 + activeDays.length * 130 }}>

                    {/* Sticky day-name header — scrolls with grid horizontally, sticks vertically */}
                    <div
                      className="flex"
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 10,
                        background: "var(--bg-surface)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ width: 52, flexShrink: 0 }} />
                      {activeDays.map((d) => (
                        <div
                          key={d}
                          className="text-center text-xs font-semibold uppercase tracking-wide py-2"
                          style={{
                            flex: 1,
                            minWidth: 130,
                            color: "var(--text-primary)",
                            borderLeft: "1px solid var(--border)",
                          }}
                        >
                          {DAYS_FULL[d]}
                        </div>
                      ))}
                    </div>

                    {/* Grid body */}
                    <div className="flex" style={{ height: gridHeight }}>

                      {/* Time gutter */}
                      <div style={{ width: 52, flexShrink: 0, position: "relative" }}>
                        {hours.map((h) => (
                          <div
                            key={h}
                            style={{
                              position: "absolute",
                              top: (h - START_HOUR) * HOUR_H + 3,
                              right: 6,
                              fontSize: 10,
                              fontFamily: "monospace",
                              color: "var(--text-secondary)",
                              userSelect: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {fmtHour(h)}
                          </div>
                        ))}
                      </div>

                      {/* Day columns */}
                      {activeDays.map((d) => {
                        const dayEntries = allEntries.filter((e) => e.day_of_week === d);
                        return (
                          <div
                            key={d}
                            style={{
                              flex: 1,
                              minWidth: 130,
                              position: "relative",
                              borderLeft: "1px solid var(--border)",
                            }}
                          >
                            {/* Hour + half-hour lines */}
                            {hours.map((h) => (
                              <div key={h}>
                                <div style={{
                                  position: "absolute",
                                  top: (h - START_HOUR) * HOUR_H,
                                  left: 0, right: 0,
                                  borderTop: "1px solid var(--border)",
                                }} />
                                <div style={{
                                  position: "absolute",
                                  top: (h - START_HOUR) * HOUR_H + HOUR_H / 2,
                                  left: 0, right: 0,
                                  borderTop: "1px dashed var(--border)",
                                  opacity: 0.4,
                                }} />
                              </div>
                            ))}
                            {/* Bottom border */}
                            <div style={{
                              position: "absolute",
                              top: gridHeight,
                              left: 0, right: 0,
                              borderTop: "1px solid var(--border)",
                            }} />

                            {/* Subject blocks */}
                            {dayEntries.map((e) => {
                              const startMin = parseMin(e.start_time);
                              const durMin = e.end_time
                                ? parseMin(e.end_time) - startMin
                                : 60;
                              const topPx = ((startMin - START_HOUR * 60) / 60) * HOUR_H;
                              const heightPx = Math.max((durMin / 60) * HOUR_H, 30);
                              const isActive = calTooltip?.code === e.subj.subject_code &&
                                calTooltip?.day === e.day_of_week &&
                                calTooltip?.start_time === e.start_time;
                              return (
                                <div
                                  key={e.subj.id + e.start_time}
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    if (isActive) { setCalTooltip(null); return; }
                                    showTooltip(ev, {
                                      code: e.subj.subject_code, name: e.subj.name,
                                      teacher: e.subj.teacher, room: e.room,
                                      start_time: e.start_time, end_time: e.end_time,
                                      day: e.day_of_week,
                                    });
                                  }}
                                  onMouseEnter={(ev) => showTooltip(ev, {
                                    code: e.subj.subject_code, name: e.subj.name,
                                    teacher: e.subj.teacher, room: e.room,
                                    start_time: e.start_time, end_time: e.end_time,
                                    day: e.day_of_week,
                                  })}
                                  onMouseLeave={scheduleHideTooltip}
                                  style={{
                                    position: "absolute",
                                    top: topPx + 2,
                                    height: heightPx - 4,
                                    left: 4,
                                    right: 4,
                                    background: isActive ? "#1DB95435" : "#1DB95420",
                                    border: "1px solid #1DB95450",
                                    borderLeft: "3px solid var(--accent)",
                                    borderRadius: 6,
                                    padding: "4px 8px",
                                    overflow: "hidden",
                                    boxSizing: "border-box",
                                    cursor: "pointer",
                                    transition: "background 0.15s",
                                  }}
                                >
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", lineHeight: 1.2 }}>
                                    {e.subj.subject_code}
                                  </div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, marginTop: 1 }}>
                                    {e.subj.name}
                                  </div>
                                  {heightPx > 50 && (
                                    <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.3 }}>
                                      {e.subj.teacher}{e.room ? ` · ${e.room}` : ""}
                                    </div>
                                  )}
                                  {heightPx > 64 && (
                                    <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-secondary)", marginTop: 1, opacity: 0.75 }}>
                                      {e.start_time}{e.end_time ? `–${e.end_time}` : ""}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={fetchAttendance}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: "var(--text-secondary)" }}>
            Loading your attendance...
          </div>
        ) : (
          <>
            {summary && (
              <div
                className="rounded-2xl p-6 shadow-sm mb-6"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>Attendance Rate</h2>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
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
                <p className="text-xs mt-1.5" style={{
                  color: summary.attendance_rate >= 90 ? "var(--status-present-text)"
                       : summary.attendance_rate >= 75 ? "var(--status-late-text)"
                       : "var(--status-absent-text)"
                }}>
                  {summary.attendance_rate >= 90 ? "Excellent attendance"
                   : summary.attendance_rate >= 75 ? "Good attendance"
                   : "At risk — below 75% threshold"}
                </p>
                <div className="grid grid-cols-3 gap-2 md:gap-4 mt-6">
                  {([
                    { label: "Present", value: summary.present, color: "text-emerald-600" },
                    { label: "Late", value: summary.late, color: "text-amber-600" },
                    { label: "Absent", value: summary.absent, color: "text-red-500" },
                  ] as const).map((s) => (
                    <div
                      key={s.label}
                      className="text-center p-3 rounded-xl"
                      style={{ background: "var(--bg-surface)" }}
                    >
                      <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              className="rounded-2xl shadow-sm overflow-hidden"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div
                className="px-6 py-4 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Attendance Records</h3>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {records.length} record{records.length !== 1 ? "s" : ""}
                </span>
              </div>
              {records.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                  No attendance records found for this period.
                </div>
              ) : (
                <ul>
                  {records.map((r) => (
                    <li
                      key={r.id}
                      className="px-6 py-4 flex items-center justify-between"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-3">
                        <StatusDot status={r.status} />
                        <div>
                          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{r.date}</div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Time in: {r.time_in}</div>
                        </div>
                      </div>
                      <span className="text-xs font-medium capitalize" style={{ color: "var(--text-secondary)" }}>{r.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>

      {/* Calendar tooltip */}
      {calTooltip && (
        <>
          <div
            onMouseEnter={cancelHideTooltip}
            onMouseLeave={scheduleHideTooltip}
            style={{
              position: "fixed",
              top: calTooltip.y,
              left: calTooltip.x,
              zIndex: 50,
              width: 204,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              padding: "12px 14px",
              pointerEvents: "auto",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.04em", marginBottom: 4 }}>
              {calTooltip.code}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3, marginBottom: 6 }}>
              {calTooltip.name}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)", flexShrink: 0 }}>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{calTooltip.teacher}</span>
              </div>
              {calTooltip.room && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)", flexShrink: 0 }}>
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{calTooltip.room}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)", flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)" }}>
                  {calTooltip.start_time}{calTooltip.end_time ? ` – ${calTooltip.end_time}` : ""}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Floating Contact Admin button */}
      <button
        onClick={() => setMsgOpen(true)}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 flex items-center gap-2 px-4 py-3 rounded-full text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
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
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Contact Admin</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Send a support message</p>
              </div>
              <button
                onClick={handleMsgClose}
                className="text-lg leading-none transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >✕</button>
            </div>
            <div className="px-5 py-4">
              {msgSuccess ? (
                <div className="py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Message sent!</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>The admin will get back to you.</p>
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
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:border-green-400 transition-colors resize-none"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleMsgClose}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
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
    </div>
  );
}
