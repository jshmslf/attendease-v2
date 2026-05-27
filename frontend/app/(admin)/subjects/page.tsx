"use client";

import { useState, useEffect } from "react";
import { api, Subject, SubjectSchedule, StudentResponse } from "@/lib/api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const inputStyle = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

function formatSchedules(schedules: SubjectSchedule[]): string {
  if (!schedules.length) return "-";
  return schedules
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
    .map((s) => {
      const time = s.end_time ? `${s.start_time}-${s.end_time}` : s.start_time;
      const room = s.room ? ` (${s.room})` : "";
      return `${DAY_SHORT[s.day_of_week]} ${time}${room}`;
    })
    .join(", ");
}

// ── Schedule Row ─────────────────────────────────────────────────────────────

interface ScheduleRowDraft {
  key: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
}

function ScheduleBuilder({
  rows,
  onChange,
}: {
  rows: ScheduleRowDraft[];
  onChange: (rows: ScheduleRowDraft[]) => void;
}) {
  function addOneHour(time: string): string {
    const [h, m] = time.split(":").map(Number);
    const next = (h + 1) % 24;
    return `${String(next).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function addRow() {
    onChange([...rows, { key: Date.now(), day_of_week: 0, start_time: "08:00", end_time: "09:00", room: "" }]);
  }

  function removeRow(key: number) {
    onChange(rows.filter((r) => r.key !== key));
  }

  function updateRow(key: number, field: keyof Omit<ScheduleRowDraft, "key">, value: string | number) {
    onChange(rows.map((r) => {
      if (r.key !== key) return r;
      const updated = { ...r, [field]: value };
      if (field === "start_time" && typeof value === "string") {
        updated.end_time = addOneHour(value);
      }
      return updated;
    }));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Schedule
        </label>
        <button
          type="button"
          onClick={addRow}
          className="text-xs font-medium px-2 py-1 rounded-md transition-colors"
          style={{ color: "var(--accent)", background: "#1DB95415" }}
        >
          + Add Slot
        </button>
      </div>

      {rows.length === 0 && (
        <p className="text-xs py-2 text-center rounded-lg" style={{ color: "var(--text-secondary)", background: "var(--bg-surface)" }}>
          No schedule - attendance will use the global threshold.
        </p>
      )}

      {rows.map((row) => (
        <div key={row.key} className="space-y-1.5 p-3 rounded-lg" style={{ background: "var(--bg-surface)" }}>
          <div className="flex items-center gap-2">
            <select
              value={row.day_of_week}
              onChange={(e) => updateRow(row.key, "day_of_week", Number(e.target.value))}
              className="flex-1 px-3 py-2 rounded-lg text-sm"
              style={inputStyle}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors flex-shrink-0"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >✕</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Start</label>
              <input
                type="time"
                required
                value={row.start_time}
                onChange={(e) => updateRow(row.key, "start_time", e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>End</label>
              <input
                type="time"
                value={row.end_time}
                onChange={(e) => updateRow(row.key, "end_time", e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Room</label>
              <input
                type="text"
                value={row.room}
                onChange={(e) => updateRow(row.key, "room", e.target.value)}
                placeholder="e.g. Rm 201"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Subject Form Modal ────────────────────────────────────────────────────────

interface SubjectFormData {
  subject_code: string;
  name: string;
  teacher: string;
}

function SubjectModal({
  subject,
  onClose,
  onSaved,
}: {
  subject: Subject | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!subject;
  const [form, setForm] = useState<SubjectFormData>({
    subject_code: subject?.subject_code ?? "",
    name: subject?.name ?? "",
    teacher: subject?.teacher ?? "",
  });
  const [scheduleRows, setScheduleRows] = useState<ScheduleRowDraft[]>(
    subject?.schedules.map((s) => ({ key: Math.random(), day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time ?? "", room: s.room ?? "" })) ?? []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Subject Students tab (edit only)
  const [tab, setTab] = useState<"info" | "students">("info");
  const [assignedStudents, setAssignedStudents] = useState<StudentResponse[]>([]);
  const [allStudents, setAllStudents] = useState<StudentResponse[]>([]);
  const [assignId, setAssignId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");

  useEffect(() => {
    if (isEdit && subject) {
      loadStudents();
      api.getStudents().then(setAllStudents).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStudents() {
    if (!subject) return;
    try {
      const list = await api.getSubjectStudents(subject.id);
      setAssignedStudents(list);
      if (!assignId && allStudents.length > 0) {
        const unassigned = allStudents.filter((s) => !list.find((a) => a.id === s.id));
        setAssignId(unassigned[0]?.id ?? "");
      }
    } catch {}
  }

  useEffect(() => {
    if (allStudents.length && assignedStudents.length >= 0) {
      const unassigned = allStudents.filter((s) => !assignedStudents.find((a) => a.id === s.id));
      setAssignId(unassigned[0]?.id ?? "");
    }
  }, [allStudents, assignedStudents]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        subject_code: form.subject_code.trim(),
        name: form.name.trim(),
        teacher: form.teacher.trim(),
        schedules: scheduleRows.map((r) => ({
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time || undefined,
          room: r.room.trim() || undefined,
        })),
      };
      if (isEdit && subject) {
        await api.updateSubject(subject.id, payload);
      } else {
        await api.createSubject(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save subject.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign() {
    if (!subject || !assignId) return;
    setAssignLoading(true);
    setAssignError("");
    try {
      await api.assignStudentToSubject(subject.id, assignId);
      await loadStudents();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Failed to assign.");
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleUnassign(studentId: string) {
    if (!subject) return;
    try {
      await api.unassignStudentFromSubject(subject.id, studentId);
      await loadStudents();
    } catch {}
  }

  const unassignedStudents = allStudents.filter((s) => !assignedStudents.find((a) => a.id === s.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] flex flex-col"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {isEdit ? "Edit Subject" : "Add Subject"}
          </h2>
          <button
            onClick={onClose}
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >✕</button>
        </div>

        {/* Tabs (edit only) */}
        {isEdit && (
          <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "var(--bg-surface)" }}>
            {(["info", "students"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all capitalize"
                style={{
                  background: tab === t ? "var(--bg-card)" : "transparent",
                  color: tab === t ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                {t === "info" ? "Subject Info" : "Enrolled Students"}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {/* Info tab */}
          {tab === "info" && (
            <form onSubmit={handleSave} className="space-y-3" id="subject-form">
              {error && (
                <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#7f1d1d30", border: "1px solid #ef4444", color: "#fca5a5" }}>
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Subject Code</label>
                  <input
                    required
                    value={form.subject_code}
                    onChange={(e) => setForm({ ...form, subject_code: e.target.value })}
                    placeholder="CS101"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Teacher</label>
                  <input
                    required
                    value={form.teacher}
                    onChange={(e) => setForm({ ...form, teacher: e.target.value })}
                    placeholder="Prof. Santos"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Subject Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Introduction to Computing"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              <ScheduleBuilder rows={scheduleRows} onChange={setScheduleRows} />
            </form>
          )}

          {/* Students tab */}
          {tab === "students" && isEdit && (
            <div className="space-y-4">
              {assignError && (
                <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#7f1d1d30", border: "1px solid #ef4444", color: "#fca5a5" }}>
                  {assignError}
                </div>
              )}

              {/* Assign new student */}
              <div className="flex gap-2">
                <select
                  value={assignId}
                  onChange={(e) => setAssignId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                  disabled={unassignedStudents.length === 0}
                >
                  {unassignedStudents.length === 0 ? (
                    <option value="">All students assigned</option>
                  ) : (
                    unassignedStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} ({s.student_id})
                      </option>
                    ))
                  )}
                </select>
                <button
                  onClick={handleAssign}
                  disabled={assignLoading || !assignId || unassignedStudents.length === 0}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{
                    background: (!assignId || unassignedStudents.length === 0) ? "#1DB95450" : "var(--accent)",
                    cursor: (!assignId || unassignedStudents.length === 0) ? "not-allowed" : "pointer",
                  }}
                >
                  {assignLoading ? "..." : "Assign"}
                </button>
              </div>

              {/* Assigned students list */}
              {assignedStudents.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "var(--text-secondary)" }}>
                  No students assigned yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {assignedStudents.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                      style={{ background: "var(--bg-surface)" }}
                    >
                      <div>
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {s.first_name} {s.last_name}
                        </span>
                        <span className="text-xs ml-2" style={{ color: "var(--text-secondary)" }}>
                          {s.student_id}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnassign(s.id)}
                        className="text-xs px-2 py-1 rounded-md transition-colors"
                        style={{ color: "#ef4444", background: "#7f1d1d20" }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {tab === "info" && (
          <div className="flex gap-2 justify-end mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              Cancel
            </button>
            <button
              form="subject-form"
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: loading ? "#1DB95480" : "var(--accent)", cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Subject"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  async function loadSubjects() {
    setLoading(true);
    try {
      const list = await api.getSubjects();
      setSubjects(list);
    } catch {}
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.deleteSubject(confirmDelete.id);
      setConfirmDelete(null);
      await loadSubjects();
    } catch {}
    finally { setDeleting(false); }
  }

  const filtered = subjects.filter((s) =>
    search === "" ||
    s.subject_code.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.teacher.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Subjects</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {subjects.length} subject{subjects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { setEditSubject(null); setModalOpen(true); }}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          + Add Subject
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Search by code, name, or teacher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
              {["Code", "Name", "Teacher", "Schedule", "Students", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Loading subjects...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {search ? "No subjects match your search." : "No subjects yet. Add one to get started."}
                </td>
              </tr>
            ) : (
              filtered.map((s, idx) => (
                <tr
                  key={s.id}
                  style={{
                    background: idx % 2 === 0 ? "var(--bg-dark)" : "var(--bg-card)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold" style={{ color: "var(--accent)" }}>{s.subject_code}</span>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{s.teacher}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {formatSchedules(s.schedules)}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {s.student_count ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditSubject(s); setModalOpen(true); }}
                        className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                        style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(s)}
                        className="px-3 py-1 rounded-md text-xs font-medium"
                        style={{ background: "#7f1d1d20", color: "#ef4444" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <SubjectModal
          subject={editSubject}
          onClose={() => setModalOpen(false)}
          onSaved={async () => { setModalOpen(false); await loadSubjects(); }}
        />
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#7f1d1d30" }}>
                <svg className="w-5 h-5" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.75L13.75 4a2 2 0 00-3.5 0L3.25 16.25A2 2 0 005.07 19z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Delete Subject?</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  This will remove <strong>{confirmDelete.subject_code}</strong> and all its schedule slots. Student assignments will also be removed.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "#ef4444", opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
