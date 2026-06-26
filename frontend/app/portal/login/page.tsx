"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
interface LoginForm {
  student_id: string;
  password: string;
}

export default function PortalLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginForm>({ student_id: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await api.studentLogin(form);
      localStorage.setItem("student_token", data.access_token);
      router.push("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect Student ID or password. Check your ID format (e.g. 2024-00001).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative"
      style={{
        backgroundColor: "var(--bg-dark)",
        backgroundImage: "url('/image/ama_facade.png')",
        backgroundSize: "60% auto",
        backgroundPosition: "right 0px bottom -150px",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to right, var(--overlay-start) 45%, var(--overlay-end) 100%)" }}
      />
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <img src="/logo/logo-with-text.png"       alt="AttendEase" className="logo-dark  h-14 object-contain mb-2 mx-auto" />
          <img src="/logo/logo-with-text-black.png" alt=""            className="logo-light h-14 object-contain mb-2 mx-auto" aria-hidden />
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Student Portal</p>
        </div>

        <div className="rounded-2xl p-8 shadow-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--text-primary)" }}>Sign in to continue</h2>

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
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 pr-10 rounded-lg text-sm outline-none transition-colors"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-secondary)" }}
                  tabIndex={-1}
                  aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
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
