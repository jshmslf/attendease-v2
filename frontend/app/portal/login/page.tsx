"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useTheme } from "../../context/ThemeContext";

interface LoginForm {
  student_id: string;
  password: string;
}

export default function PortalLoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [form, setForm] = useState<LoginForm>({ student_id: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await api.studentLogin(form);
      localStorage.setItem("student_token", data.access_token);
      router.push("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid Student ID or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-dark)" }}>
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <img
            src={theme === "dark" ? "/logo/logo-with-text.png" : "/logo/logo-with-text-black.png"}
            alt="AttendEase"
            className="h-14 object-contain mb-2 mx-auto"
          />
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Student Portal</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>View your attendance records</p>
        </div>

        <div className="rounded-2xl p-8 shadow-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--text-primary)" }}>Sign in</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm"
              style={{ background: "#7f1d1d30", border: "1px solid #ef4444", color: "#fca5a5" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Student ID
              </label>
              <input
                type="text"
                value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                placeholder="2024-00001"
                required
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity"
              style={{ background: loading ? "#1DB95480" : "#1DB954", cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm" style={{ color: "var(--text-secondary)" }}>
          Admin?{" "}
          <Link href="/login" className="font-medium" style={{ color: "var(--accent)" }}>
            Go to Admin Login
          </Link>
        </p>
      </div>
    </div>
  );
}
