const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(type = "admin") {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(type === "admin" ? "admin_token" : "student_token");
}

async function apiFetch(path, options = {}, tokenType = "admin") {
  const token = tokenType ? getToken(tokenType) : null;
  const headers = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }

  return res.json();
}

export const api = {
  // Auth
  adminLogin: (data) =>
    apiFetch("/api/auth/admin/login", { method: "POST", body: JSON.stringify(data) }, null),
  studentLogin: (data) =>
    apiFetch("/api/auth/student/login", { method: "POST", body: JSON.stringify(data) }, null),

  // Students
  getStudents: () => apiFetch("/api/students/"),
  getStudent: (id) => apiFetch(`/api/students/${id}`),
  createStudent: (data) =>
    apiFetch("/api/students/", { method: "POST", body: JSON.stringify(data) }),
  addParent: (studentId, data) =>
    apiFetch(`/api/students/${studentId}/parents`, { method: "POST", body: JSON.stringify(data) }),
  createPortalAccount: (studentId, data) =>
    apiFetch(`/api/students/${studentId}/portal-account`, { method: "POST", body: JSON.stringify(data) }),
  getStudentPhotos: (studentId) => apiFetch(`/api/students/${studentId}/photos`),
  trainModel: () => apiFetch("/api/students/train", { method: "POST" }),

  // Face Enrollment (multipart)
  enrollFace: (studentId, formData) => {
    const token = getToken("admin");
    return fetch(`${API_URL}/api/students/${studentId}/enroll-face`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || "Enrollment failed");
      }
      return res.json();
    });
  },

  // Attendance
  getTodayAttendance: () => apiFetch("/api/attendance/today"),
  overrideAttendance: (data) =>
    apiFetch("/api/attendance/override", { method: "POST", body: JSON.stringify(data) }),
  getMyAttendance: (params = {}) =>
    apiFetch(`/api/attendance/student/me?${new URLSearchParams(params)}`, {}, "student"),

  // Notifications
  getNotifications: (limit = 50) =>
    apiFetch(`/api/notifications/?limit=${limit}`),
};
