"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, StudentResponse, ParentInfo, Subject, Section } from "@/lib/api";

interface StudentForm {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  course: string;
  year_level: number;
  section_id: string;
}

interface ParentForm {
  name: string;
  phone_number: string;
  relationship_to_student: string;
}

interface PortalForm {
  password: string;
}

interface AddStudentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface EditStudentModalProps {
  student: StudentResponse;
  onClose: () => void;
  onSuccess: () => void;
}

const inputStyle = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

function Badge({ enrolled }: { enrolled: boolean }) {
  return enrolled ? (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
      Enrolled
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
      Not Enrolled
    </span>
  );
}

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function EditStudentModal({ student, onClose, onSuccess }: EditStudentModalProps) {
  const [tab, setTab] = useState<"student" | "parent" | "credentials" | "subjects">("student");

  // Student fields
  const [studentForm, setStudentForm] = useState({
    first_name: student.first_name,
    last_name: student.last_name,
    email: student.email,
    course: student.course,
    year_level: student.year_level,
    section_id: student.section_id ?? "",
  });
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState("");
  const [studentSuccess, setStudentSuccess] = useState("");

  // Parent fields
  const [parents, setParents] = useState<ParentInfo[]>([]);
  const [parentForm, setParentForm] = useState<ParentForm>({
    name: "", phone_number: "+63", relationship_to_student: "Parent",
  });
  const [parentLoading, setParentLoading] = useState(false);
  const [parentFetching, setParentFetching] = useState(true);
  const [parentError, setParentError] = useState("");
  const [parentSuccess, setParentSuccess] = useState("");
  const [deletingParentId, setDeletingParentId] = useState<string | null>(null);
  const [confirmDeleteParentId, setConfirmDeleteParentId] = useState<string | null>(null);

  // Credentials fields
  const [portalAccount, setPortalAccount] = useState<{ has_account: boolean; id?: string } | null>(null);
  const [credFetching, setCredFetching] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [credLoading, setCredLoading] = useState(false);
  const [credFetchError, setCredFetchError] = useState("");
  const [credError, setCredError] = useState("");
  const [credSuccess, setCredSuccess] = useState("");

  // Subjects
  const [assignedSubjects, setAssignedSubjects] = useState<Subject[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [subjectAssignId, setSubjectAssignId] = useState("");
  const [subjectAssignLoading, setSubjectAssignLoading] = useState(false);
  const [subjectError, setSubjectError] = useState("");

  // Sections (for Student Info tab)
  const [sections, setSections] = useState<Section[]>([]);

  // Direct fetch helper - bypasses the webpack-cached api module
  const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    const isJson = typeof init.body === "string";
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(isJson ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error((err as { detail?: string }).detail || "Request failed");
    }
    return res.json() as Promise<T>;
  }

  useEffect(() => {
    loadParents();
    loadPortalAccount();
    loadSubjectsData();
    api.getSections().then(setSections).catch(() => {});
  }, []);

  async function loadSubjectsData() {
    try {
      const [assigned, all] = await Promise.all([
        api.getStudentSubjects(student.id),
        api.getSubjects(),
      ]);
      setAssignedSubjects(assigned);
      setAllSubjects(all);
      const unassigned = all.filter((s) => !assigned.find((a) => a.id === s.id));
      setSubjectAssignId(unassigned[0]?.id ?? "");
    } catch {}
  }

  async function handleAssignSubject() {
    if (!subjectAssignId) return;
    setSubjectAssignLoading(true);
    setSubjectError("");
    try {
      await api.assignStudentToSubject(subjectAssignId, student.id);
      await loadSubjectsData();
    } catch (err) {
      setSubjectError(err instanceof Error ? err.message : "Failed to assign subject.");
    } finally {
      setSubjectAssignLoading(false);
    }
  }

  async function handleUnassignSubject(subjectId: string) {
    try {
      await api.unassignStudentFromSubject(subjectId, student.id);
      await loadSubjectsData();
    } catch {}
  }

  async function loadPortalAccount() {
    setCredFetching(true);
    setCredFetchError("");
    try {
      const data = await adminFetch<{ has_account: boolean; id?: string }>(
        `/api/students/${student.student_id}/portal-account`
      );
      setPortalAccount(data);
    } catch (e) {
      setCredFetchError(e instanceof Error ? e.message : "Failed to load account status.");
    } finally {
      setCredFetching(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCredLoading(true);
    setCredError("");
    setCredSuccess("");
    try {
      await adminFetch(`/api/students/${student.student_id}/portal-account`, {
        method: "PUT",
        body: JSON.stringify({ password: newPassword }),
      });
      setNewPassword("");
      setCredSuccess("Password updated successfully.");
    } catch (err) {
      setCredError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setCredLoading(false);
    }
  }

  async function handleCreatePortalAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCredLoading(true);
    setCredError("");
    setCredSuccess("");
    try {
      await adminFetch(`/api/students/${student.student_id}/portal-account`, {
        method: "POST",
        body: JSON.stringify({ password: createPassword }),
      });
      setCreatePassword("");
      setCredSuccess("Portal account created.");
      await loadPortalAccount();
    } catch (err) {
      setCredError(err instanceof Error ? err.message : "Failed to create portal account");
    } finally {
      setCredLoading(false);
    }
  }

  async function loadParents() {
    setParentFetching(true);
    try {
      const data = await adminFetch<ParentInfo[]>(
        `/api/students/${student.student_id}/parents`
      );
      setParents(data);
      if (data.length > 0) {
        const p = data[0];
        setParentForm({ name: p.name, phone_number: p.phone_number, relationship_to_student: p.relationship_to_student });
      }
    } catch (e) {
      setParentError(e instanceof Error ? e.message : "Failed to load parent data.");
    } finally {
      setParentFetching(false);
    }
  }

  async function handleStudentSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStudentLoading(true);
    setStudentError("");
    setStudentSuccess("");
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const res = await fetch(`${API_URL}/api/students/${student.student_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...studentForm,
          year_level: Number(studentForm.year_level),
          section_id: studentForm.section_id || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error((err as { detail?: string }).detail || "Update failed");
      }
      setStudentSuccess("Edit Saved");
      onSuccess();
    } catch (err) {
      setStudentError(err instanceof Error ? err.message : "Failed to update student");
    } finally {
      setStudentLoading(false);
    }
  }

  async function handleDeleteParent(parentId: string) {
    setConfirmDeleteParentId(null);
    setDeletingParentId(parentId);
    setParentError("");
    setParentSuccess("");
    try {
      await adminFetch(`/api/students/${student.student_id}/parents/${parentId}`, { method: "DELETE" });
      await loadParents();
      setParentSuccess("Parent contact deleted.");
      onSuccess();
    } catch (err) {
      setParentError(err instanceof Error ? err.message : "Failed to delete parent.");
    } finally {
      setDeletingParentId(null);
    }
  }

  async function handleParentSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setParentLoading(true);
    setParentError("");
    setParentSuccess("");
    try {
      if (parents.length > 0) {
        await adminFetch(`/api/students/${student.student_id}/parents/${parents[0].id}`, {
          method: "PUT",
          body: JSON.stringify(parentForm),
        });
        setParentSuccess("Edit Saved");
      } else {
        await adminFetch(`/api/students/${student.student_id}/parents`, {
          method: "POST",
          body: JSON.stringify(parentForm),
        });
        await loadParents();
        setParentSuccess("Saved");
      }
      onSuccess();
    } catch (err) {
      setParentError(err instanceof Error ? err.message : "Failed to update parent");
    } finally {
      setParentLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Edit Student</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {student.first_name} {student.last_name} · {student.student_id}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "var(--bg-surface)" }}>
          {(["student", "parent", "credentials", "subjects"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: tab === t ? "var(--bg-card)" : "transparent",
                color: tab === t ? "var(--text-primary)" : "var(--text-secondary)",
                border: tab === t ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              {t === "student" ? "Student Info" : t === "parent" ? "Parent / Guardian" : t === "credentials" ? "Credentials" : "Subjects"}
            </button>
          ))}
        </div>

        {/* Student Info Tab */}
        {tab === "student" && (
          <form onSubmit={handleStudentSave} className="space-y-3">
            {studentError && (
              <div className="px-3 py-2 rounded-lg text-sm"
                style={{ background: "#7f1d1d30", border: "1px solid #ef4444", color: "#fca5a5" }}>
                {studentError}
              </div>
            )}
            {studentSuccess && (
              <div className="px-3 py-2 rounded-lg text-sm"
                style={{ background: "#14532d30", border: "1px solid #22c55e", color: "#86efac" }}>
                {studentSuccess}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>First Name</label>
                <input type="text" required value={studentForm.first_name}
                  onChange={(e) => setStudentForm({ ...studentForm, first_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Last Name</label>
                <input type="text" required value={studentForm.last_name}
                  onChange={(e) => setStudentForm({ ...studentForm, last_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Email</label>
              <input type="email" required value={studentForm.email}
                onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Course</label>
                <input type="text" required value={studentForm.course}
                  onChange={(e) => setStudentForm({ ...studentForm, course: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Year Level</label>
                <select value={studentForm.year_level}
                  onChange={(e) => setStudentForm({ ...studentForm, year_level: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                  {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Section</label>
              <select value={studentForm.section_id}
                onChange={(e) => setStudentForm({ ...studentForm, section_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="">No section</option>
                {sections.map((sec) => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                Close
              </button>
              <button type="submit" disabled={studentLoading}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--accent)" }}>
                {studentLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}

        {/* Credentials Tab */}
        {tab === "credentials" && (
          <div className="space-y-4">
            {credFetching && (
              <p className="text-sm text-center py-4" style={{ color: "var(--text-secondary)" }}>Loading...</p>
            )}
            {!credFetching && (
              <>
                {/* Load error - shown when portalAccount fetch failed */}
                {credFetchError && (
                  <div className="px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#7f1d1d30", border: "1px solid #ef4444", color: "#fca5a5" }}>
                    {credFetchError}
                    <button onClick={loadPortalAccount} className="ml-2 underline text-xs">Retry</button>
                  </div>
                )}

                {/* Action feedback */}
                {credError && (
                  <div className="px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#7f1d1d30", border: "1px solid #ef4444", color: "#fca5a5" }}>
                    {credError}
                  </div>
                )}
                {credSuccess && (
                  <div className="px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#14532d30", border: "1px solid #22c55e", color: "#86efac" }}>
                    {credSuccess}
                  </div>
                )}

                {/* Only render forms once portalAccount is loaded (not null) */}
                {portalAccount !== null && portalAccount.has_account && (
                  <>
                    <div className="px-4 py-3 rounded-lg flex items-center justify-between"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                      <div>
                        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Portal Account</p>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
                          {student.student_id}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                          Student logs in with their Student ID + password
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Active
                      </span>
                    </div>

                    <form onSubmit={handlePasswordReset} className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                          New Password
                        </label>
                        <input
                          type="password" placeholder="••••••••" required minLength={6}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}
                        />
                        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Minimum 6 characters</p>
                      </div>
                      <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose}
                          className="flex-1 py-2 rounded-lg text-sm font-medium"
                          style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                          Close
                        </button>
                        <button type="submit" disabled={credLoading}
                          className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                          style={{ background: "var(--accent)" }}>
                          {credLoading ? "Resetting..." : "Reset Password"}
                        </button>
                      </div>
                    </form>
                  </>
                )}

                {portalAccount !== null && !portalAccount.has_account && (
                  <form onSubmit={handleCreatePortalAccount} className="space-y-3">
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      No portal account yet. Set a password so the student can log in with their Student ID.
                    </p>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Password</label>
                      <input type="password" placeholder="••••••••" required minLength={6}
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                        Student logs in with Student ID · {student.student_id}
                      </p>
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={onClose}
                        className="flex-1 py-2 rounded-lg text-sm font-medium"
                        style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                        Close
                      </button>
                      <button type="submit" disabled={credLoading}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                        style={{ background: "var(--accent)" }}>
                        {credLoading ? "Creating..." : "Create Account"}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        )}

        {/* Subjects Tab */}
        {tab === "subjects" && (
          <div className="space-y-3">
            {subjectError && (
              <div className="px-3 py-2 rounded-lg text-sm"
                style={{ background: "#7f1d1d30", border: "1px solid #ef4444", color: "#fca5a5" }}>
                {subjectError}
              </div>
            )}

            {/* Assign new subject */}
            <div className="flex gap-2">
              <select
                value={subjectAssignId}
                onChange={(e) => setSubjectAssignId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                disabled={allSubjects.filter((s) => !assignedSubjects.find((a) => a.id === s.id)).length === 0}
              >
                {allSubjects.filter((s) => !assignedSubjects.find((a) => a.id === s.id)).length === 0 ? (
                  <option value="">All subjects assigned</option>
                ) : (
                  allSubjects
                    .filter((s) => !assignedSubjects.find((a) => a.id === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.subject_code} - {s.name}</option>
                    ))
                )}
              </select>
              <button
                onClick={handleAssignSubject}
                disabled={subjectAssignLoading || !subjectAssignId}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex-shrink-0"
                style={{
                  background: !subjectAssignId ? "#1DB95450" : "var(--accent)",
                  cursor: !subjectAssignId ? "not-allowed" : "pointer",
                }}
              >
                {subjectAssignLoading ? "..." : "Assign"}
              </button>
            </div>

            {/* Assigned subjects list */}
            {assignedSubjects.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "var(--text-secondary)" }}>
                No subjects assigned. Attendance will use the global time threshold.
              </p>
            ) : (
              <ul className="space-y-1">
                {assignedSubjects.map((s) => {
                  const sched = s.schedules
                    .sort((a, b) => a.day_of_week - b.day_of_week)
                    .map((sc) => `${DAY_SHORT[sc.day_of_week]} ${sc.start_time}`)
                    .join(", ") || "No schedule";
                  return (
                    <li key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                      style={{ background: "var(--bg-surface)" }}>
                      <div>
                        <span className="text-xs font-semibold font-mono" style={{ color: "var(--accent)" }}>{s.subject_code}</span>
                        <span className="text-sm font-medium ml-2" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{sched}</p>
                      </div>
                      <button
                        onClick={() => handleUnassignSubject(s.id)}
                        className="text-xs px-2 py-1 rounded-md ml-3 flex-shrink-0"
                        style={{ color: "#ef4444", background: "#7f1d1d20" }}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Parent Tab */}
        {tab === "parent" && (
          <div className="space-y-3">
            {parentFetching && (
              <p className="text-sm text-center py-4" style={{ color: "var(--text-secondary)" }}>Loading...</p>
            )}
            {!parentFetching && (
              <>
                {/* Existing parent contacts */}
                {parents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Current Contact{parents.length > 1 ? "s" : ""}</p>
                    {parents.map((p) => (
                      <div key={p.id} className="px-4 py-3 rounded-lg flex items-center justify-between"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {p.phone_number} · {p.relationship_to_student}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteParentId(p.id)}
                          disabled={deletingParentId === p.id}
                          className="ml-3 px-2 py-1 rounded-md text-xs font-medium flex-shrink-0 transition-colors"
                          style={{ color: "#f87171", background: "#7f1d1d30", border: "1px solid #ef444440" }}
                        >
                          {deletingParentId === p.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {parentError && (
                  <div className="px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#7f1d1d30", border: "1px solid #ef4444", color: "#fca5a5" }}>
                    {parentError}
                    <button onClick={() => { setParentError(""); loadParents(); }} className="ml-2 underline text-xs">Retry</button>
                  </div>
                )}
                {parentSuccess && (
                  <div className="px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#14532d30", border: "1px solid #22c55e", color: "#86efac" }}>
                    {parentSuccess}
                  </div>
                )}

                <form onSubmit={handleParentSave} className="space-y-3">
                  {parents.length === 0 && (
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      No parent contact yet. Fill in the form below to add one.
                    </p>
                  )}
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      {parents.length > 0 ? "Edit Name" : "Parent / Guardian Name"}
                    </label>
                    <input type="text" required value={parentForm.name} placeholder="Maria Dela Cruz"
                      onChange={(e) => setParentForm({ ...parentForm, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Phone Number</label>
                    <input type="text" required value={parentForm.phone_number} placeholder="+639XXXXXXXXX"
                      onChange={(e) => setParentForm({ ...parentForm, phone_number: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Format: +639XXXXXXXXX</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Relationship</label>
                    <select value={parentForm.relationship_to_student}
                      onChange={(e) => setParentForm({ ...parentForm, relationship_to_student: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                      {["Parent", "Guardian", "Sibling", "Relative"].map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onClose}
                      className="flex-1 py-2 rounded-lg text-sm font-medium"
                      style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                      Close
                    </button>
                    <button type="submit" disabled={parentLoading}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                      style={{ background: "var(--accent)" }}>
                      {parentLoading ? "Saving..." : parents.length > 0 ? "Save Changes" : "Add Parent"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}
      {/* Inline delete confirmation popup */}
      {confirmDeleteParentId && (() => {
        const target = parents.find((p) => p.id === confirmDeleteParentId);
        return (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}>
            <div className="mx-6 w-full max-w-xs rounded-xl p-5 space-y-3"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Delete parent contact?
              </p>
              {target && (
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{target.name}</span>
                  {" "}({target.phone_number}) will be permanently removed.
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setConfirmDeleteParentId(null)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteParent(confirmDeleteParentId)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "#dc2626" }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      </div>
    </div>
  );
}

function AddStudentModal({ onClose, onSuccess }: AddStudentModalProps) {
  const [step, setStep] = useState(1);
  const [studentData, setStudentData] = useState<StudentForm>({
    student_id: "", first_name: "", last_name: "",
    email: "", course: "", year_level: 1, section_id: "",
  });
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    api.getSections().then(setSections).catch(() => {});
  }, []);
  const [parentData, setParentData] = useState<ParentForm>({
    name: "", phone_number: "+63", relationship_to_student: "Parent",
  });
  const [portalData, setPortalData] = useState<PortalForm>({ password: "" });
  const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleStudentSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const student = await api.createStudent({
        ...studentData,
        year_level: Number(studentData.year_level),
        section_id: studentData.section_id || null,
        section_name: null,
      });
      setCreatedStudentId(student.student_id);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create student");
    } finally {
      setLoading(false);
    }
  }

  async function handleParentSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!createdStudentId) return;
    setLoading(true);
    setError("");
    try {
      await api.addParent(createdStudentId, parentData);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add parent");
    } finally {
      setLoading(false);
    }
  }

  async function handlePortalSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!createdStudentId) return;
    setLoading(true);
    setError("");
    try {
      await api.createPortalAccount(createdStudentId, portalData);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create portal account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-6">
          {(["Student Info", "Parent Contact", "Portal Account"] as const).map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: step > i + 1 ? "#22c55e" : step === i + 1 ? "#1DB954" : "rgba(255,255,255,0.1)",
                    color: step >= i + 1 ? "#fff" : "rgba(255,255,255,0.4)",
                  }}
                >{step > i + 1 ? "✓" : i + 1}</div>
                <span className={`text-xs ${step === i + 1 ? "text-white" : "text-white/40"}`}>{label}</span>
              </div>
              {i < 2 && <div className="w-6 h-px bg-white/20" />}
            </div>
          ))}
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white">✕</button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg text-sm"
            style={{ background: "#7f1d1d30", border: "1px solid #ef4444", color: "#fca5a5" }}>
            {error}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleStudentSubmit} className="space-y-3">
            <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Register New Student</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Student ID</label>
                <input type="text" placeholder="2024-00001" required
                  value={studentData.student_id}
                  onChange={(e) => setStudentData({ ...studentData, student_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Email</label>
                <input type="email" placeholder="student@university.edu" required
                  value={studentData.email}
                  onChange={(e) => setStudentData({ ...studentData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>First Name</label>
                <input type="text" placeholder="Juan" required
                  value={studentData.first_name}
                  onChange={(e) => setStudentData({ ...studentData, first_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Last Name</label>
                <input type="text" placeholder="Dela Cruz" required
                  value={studentData.last_name}
                  onChange={(e) => setStudentData({ ...studentData, last_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Course</label>
                <input type="text" placeholder="BS Computer Science" required
                  value={studentData.course}
                  onChange={(e) => setStudentData({ ...studentData, course: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Year Level</label>
                <select value={studentData.year_level}
                  onChange={(e) => setStudentData({ ...studentData, year_level: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                  {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Section</label>
                <select value={studentData.section_id}
                  onChange={(e) => setStudentData({ ...studentData, section_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                  <option value="">No section</option>
                  {sections.map((sec) => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--accent)" }}>
                {loading ? "Creating..." : "Next →"}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleParentSubmit} className="space-y-3">
            <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Add Parent Contact</h3>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Parent/Guardian Name</label>
              <input type="text" placeholder="Maria Dela Cruz" required
                value={parentData.name}
                onChange={(e) => setParentData({ ...parentData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Phone Number (E.164)</label>
              <input type="text" placeholder="+639XXXXXXXXX" required
                value={parentData.phone_number}
                onChange={(e) => setParentData({ ...parentData, phone_number: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Format: +639XXXXXXXXX</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Relationship</label>
              <select value={parentData.relationship_to_student}
                onChange={(e) => setParentData({ ...parentData, relationship_to_student: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                {["Parent", "Guardian", "Sibling", "Relative"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { onSuccess(); onClose(); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                Skip
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--accent)" }}>
                {loading ? "Adding..." : "Next →"}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handlePortalSubmit} className="space-y-3">
            <h3 className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Create Portal Account</h3>
            <p className="text-xs -mt-2 mb-1" style={{ color: "var(--text-secondary)" }}>
              Student logs in with their Student ID · {createdStudentId}
            </p>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Password</label>
              <input type="password" placeholder="••••••••" required
                value={portalData.password}
                onChange={(e) => setPortalData({ ...portalData, password: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { onSuccess(); onClose(); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                Skip
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--accent)" }}>
                {loading ? "Creating..." : "Finish"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentResponse | null>(null);
  const [search, setSearch] = useState("");
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<StudentResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    const isJson = typeof init.body === "string";
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(isJson ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error((err as { detail?: string }).detail || "Request failed");
    }
    return res.json() as Promise<T>;
  }

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    setLoading(true);
    try {
      const data = await api.getStudents();
      setStudents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteStudent() {
    if (!confirmDeleteStudent) return;
    setDeleting(true);
    try {
      await adminFetch(`/api/students/${confirmDeleteStudent.student_id}`, { method: "DELETE" });
      setConfirmDeleteStudent(null);
      await loadStudents();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = students.filter((s) =>
    `${s.first_name} ${s.last_name} ${s.student_id}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Students</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {students.length} registered student{students.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          + Add Student
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or student ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 rounded-lg text-sm"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <th className="px-6 py-3 text-left font-medium">Student ID</th>
              <th className="px-6 py-3 text-left font-medium">Name</th>
              <th className="px-6 py-3 text-left font-medium">Email</th>
              <th className="px-6 py-3 text-left font-medium">Course</th>
              <th className="px-6 py-3 text-left font-medium">Year</th>
              <th className="px-6 py-3 text-left font-medium">Section</th>
              <th className="px-6 py-3 text-left font-medium">Face Status</th>
              <th className="px-6 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center" style={{ color: "var(--text-secondary)" }}>
                  Loading students...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center" style={{ color: "var(--text-secondary)" }}>
                  {search ? "No students match your search." : "No students registered yet."}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#ffffff08")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="px-6 py-3 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{s.student_id}</td>
                  <td className="px-6 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                    {s.first_name} {s.last_name}
                  </td>
                  <td className="px-6 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{s.email}</td>
                  <td className="px-6 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{s.course}</td>
                  <td className="px-6 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>Year {s.year_level}</td>
                  <td className="px-6 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {s.section_name ?? <span style={{ color: "var(--border)" }}>-</span>}
                  </td>
                  <td className="px-6 py-3"><Badge enrolled={s.has_face_enrolled} /></td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditStudent(s)}
                        className="text-xs px-3 py-1.5 rounded-md transition-all"
                        style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => router.push(`/enroll?id=${s.student_id}`)}
                        className="text-xs px-3 py-1.5 rounded-md transition-all"
                        style={{
                          background: s.has_face_enrolled ? "var(--bg-surface)" : "#1DB95420",
                          color: s.has_face_enrolled ? "var(--text-secondary)" : "var(--accent)",
                          border: `1px solid ${s.has_face_enrolled ? "var(--border)" : "#1DB95440"}`,
                        }}
                      >
                        {s.has_face_enrolled ? "Re-enroll" : "Enroll Face"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteStudent(s)}
                        className="text-xs px-3 py-1.5 rounded-md transition-all"
                        style={{ background: "#7f1d1d30", color: "#fca5a5", border: "1px solid #ef444440" }}
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

      {showAdd && (
        <AddStudentModal onClose={() => setShowAdd(false)} onSuccess={loadStudents} />
      )}
      {editStudent && (
        <EditStudentModal
          student={editStudent}
          onClose={() => setEditStudent(null)}
          onSuccess={loadStudents}
        />
      )}

      {confirmDeleteStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm mx-4 rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#7f1d1d40", border: "1px solid #ef444440" }}>
                <svg className="w-5 h-5" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Delete Student</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>This action cannot be undone.</p>
              </div>
            </div>
            <div className="rounded-lg px-4 py-3 mb-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {confirmDeleteStudent.first_name} {confirmDeleteStudent.last_name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {confirmDeleteStudent.student_id} · {confirmDeleteStudent.course}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteStudent(null)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStudent}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ background: "#ef4444", color: "#fff", opacity: deleting ? 0.6 : 1 }}
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
