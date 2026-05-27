export interface StudentResponse {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  course: string;
  year_level: number;
  section_id: string | null;
  section_name: string | null;
  has_face_enrolled: boolean;
  is_active: boolean;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  date: string;
  time_in: string;
  status: string;
  confidence_score: number | null;
}

export interface AttendanceSummary {
  total_school_days: number;
  present: number;
  late: number;
  absent: number;
  attendance_rate: number;
}

export interface AttendanceData {
  summary: AttendanceSummary;
  records: AttendanceRecord[];
}

export interface NotificationLog {
  id: string;
  student_name: string;
  student_id: string;
  parent_name: string;
  phone_number: string;
  message: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

export interface TrainResult {
  message: string;
  failed: string[];
}

export interface PhotosResult {
  student_id: string;
  photos: string[];
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface StudentUpdateData {
  first_name?: string;
  last_name?: string;
  email?: string;
  course?: string;
  year_level?: number;
  section_id?: string | null;
}

export interface ParentInfo {
  id: string;
  name: string;
  phone_number: string;
  relationship_to_student: string;
}

export interface StudentMessage {
  id: string;
  student_id: string;
  student_name: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface SubjectSchedule {
  id: string;
  day_of_week: number; // 0=Monday, 6=Sunday
  start_time: string;  // "HH:MM"
  end_time?: string;   // "HH:MM"
  room?: string;
}

export interface Subject {
  id: string;
  subject_code: string;
  name: string;
  teacher: string;
  schedules: SubjectSchedule[];
  student_count?: number;
}

export interface Section {
  id: string;
  name: string;
  created_at: string;
}

export interface AppSettings {
  school_name: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(type: "admin" | "student" = "admin"): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(type === "admin" ? "admin_token" : "student_token");
}

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  tokenType: "admin" | "student" | null = "admin"
): Promise<T> {
  const token = tokenType ? getToken(tokenType) : null;
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail || "Request failed");
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  adminLogin: (data: { username: string; password: string }) =>
    apiFetch<AuthToken>("/api/auth/admin/login", { method: "POST", body: JSON.stringify(data) }, null),
  studentLogin: (data: { student_id: string; password: string }) =>
    apiFetch<AuthToken>("/api/auth/student/login", { method: "POST", body: JSON.stringify(data) }, null),

  // Students
  getStudents: () => apiFetch<StudentResponse[]>("/api/students/"),
  getStudent: (id: string) => apiFetch<StudentResponse>(`/api/students/${id}`),
  createStudent: (data: Omit<StudentResponse, "id" | "has_face_enrolled" | "is_active">) =>
    apiFetch<StudentResponse>("/api/students/", { method: "POST", body: JSON.stringify(data) }),
  updateStudent: (studentId: string, data: StudentUpdateData) =>
    apiFetch<StudentResponse>(`/api/students/${studentId}`, { method: "PUT", body: JSON.stringify(data) }),
  addParent: (studentId: string, data: { name: string; phone_number: string; relationship_to_student: string }) =>
    apiFetch<{ message: string }>(`/api/students/${studentId}/parents`, { method: "POST", body: JSON.stringify(data) }),
  createPortalAccount: (studentId: string, data: { password: string }) =>
    apiFetch<{ message: string }>(`/api/students/${studentId}/portal-account`, { method: "POST", body: JSON.stringify(data) }),
  getStudentPhotos: (studentId: string) =>
    apiFetch<PhotosResult>(`/api/students/${studentId}/photos`),
  getStudentParents: (studentId: string) =>
    apiFetch<ParentInfo[]>(`/api/students/${studentId}/parents`),
  updateParent: (studentId: string, parentId: string, data: Partial<Omit<ParentInfo, "id">>) =>
    apiFetch<ParentInfo>(`/api/students/${studentId}/parents/${parentId}`, { method: "PUT", body: JSON.stringify(data) }),
  trainModel: () =>
    apiFetch<TrainResult>("/api/students/train", { method: "POST" }),
  getMyProfile: () =>
    apiFetch<StudentResponse>("/api/students/me", {}, "student"),
  getMyParents: () =>
    apiFetch<ParentInfo[]>("/api/students/me/parents", {}, "student"),
  updateMyProfile: (data: { first_name?: string; last_name?: string; email?: string }) =>
    apiFetch<StudentResponse>("/api/students/me", { method: "PUT", body: JSON.stringify(data) }, "student"),
  getPortalAccount: (studentId: string) =>
    apiFetch<{ has_account: boolean; id?: string }>(`/api/students/${studentId}/portal-account`),
  updatePortalPassword: (studentId: string, password: string) =>
    apiFetch<{ message: string }>(`/api/students/${studentId}/portal-account`, { method: "PUT", body: JSON.stringify({ password }) }),

  // Face Enrollment (multipart - no JSON Content-Type)
  enrollFace: (studentId: string, formData: FormData): Promise<{ message: string; photo_path: string }> => {
    const token = getToken("admin");
    return fetch(`${API_URL}/api/students/${studentId}/enroll-face`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error((err as { detail?: string }).detail || "Enrollment failed");
      }
      return res.json() as Promise<{ message: string; photo_path: string }>;
    });
  },

  // Attendance
  getTodayAttendance: () => apiFetch<AttendanceRecord[]>("/api/attendance/today"),
  getAttendanceByDate: (date: string) =>
    apiFetch<AttendanceRecord[]>(`/api/attendance/by-date?date=${date}`),
  overrideAttendance: (data: { student_id: string; date: string; status: string; notes: string; time_in?: string }) =>
    apiFetch<{ message: string }>("/api/attendance/override", { method: "POST", body: JSON.stringify(data) }),
  getMyAttendance: (params: Record<string, string | number> = {}) =>
    apiFetch<AttendanceData>(`/api/attendance/student/me?${new URLSearchParams(params as Record<string, string>)}`, {}, "student"),

  // Notifications
  getNotifications: (limit = 50) =>
    apiFetch<NotificationLog[]>(`/api/notifications/?limit=${limit}`),
  clearNotifications: () =>
    apiFetch<{ deleted: number }>("/api/notifications/", { method: "DELETE" }),

  // Messages
  sendMessage: (body: string) =>
    apiFetch<StudentMessage>("/api/messages/", { method: "POST", body: JSON.stringify({ body }) }, "student"),
  getMessages: () =>
    apiFetch<StudentMessage[]>("/api/messages/"),
  getUnreadMessageCount: () =>
    apiFetch<{ count: number }>("/api/messages/unread-count"),
  markMessageRead: (id: string) =>
    apiFetch<{ message: string }>(`/api/messages/${id}/read`, { method: "PUT" }),

  // Subjects
  getSubjects: () =>
    apiFetch<Subject[]>("/api/subjects/"),
  getSubject: (id: string) =>
    apiFetch<Subject>(`/api/subjects/${id}`),
  createSubject: (data: { subject_code: string; name: string; teacher: string; schedules: { day_of_week: number; start_time: string; end_time?: string; room?: string }[] }) =>
    apiFetch<Subject>("/api/subjects/", { method: "POST", body: JSON.stringify(data) }),
  updateSubject: (id: string, data: { subject_code: string; name: string; teacher: string; schedules: { day_of_week: number; start_time: string; end_time?: string; room?: string }[] }) =>
    apiFetch<Subject>(`/api/subjects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSubject: (id: string) =>
    apiFetch<void>(`/api/subjects/${id}`, { method: "DELETE" }),
  getSubjectStudents: (id: string) =>
    apiFetch<StudentResponse[]>(`/api/subjects/${id}/students`),
  assignStudentToSubject: (subjectId: string, studentId: string) =>
    apiFetch<{ message: string }>(`/api/subjects/${subjectId}/students`, { method: "POST", body: JSON.stringify({ student_id: studentId }) }),
  unassignStudentFromSubject: (subjectId: string, studentId: string) =>
    apiFetch<void>(`/api/subjects/${subjectId}/students/${studentId}`, { method: "DELETE" }),
  getStudentSubjects: (studentId: string) =>
    apiFetch<Subject[]>(`/api/subjects/by-student/${studentId}`),
  getMySubjects: () =>
    apiFetch<Subject[]>("/api/subjects/my", {}, "student"),

  // Sections
  getSections: () =>
    apiFetch<Section[]>("/api/sections/"),
  createSection: (name: string) =>
    apiFetch<Section>("/api/sections/", { method: "POST", body: JSON.stringify({ name }) }),
  updateSection: (id: string, name: string) =>
    apiFetch<Section>(`/api/sections/${id}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteSection: (id: string) =>
    apiFetch<void>(`/api/sections/${id}`, { method: "DELETE" }),

  // Settings
  getSettings: () => apiFetch<AppSettings>("/api/settings/"),
  updateSettings: (data: Partial<AppSettings>) =>
    apiFetch<AppSettings>("/api/settings/", { method: "PUT", body: JSON.stringify(data) }),
};
