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
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8f7f4" }}>
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <img src="/logo/logo-with-text-black.png" alt="AttendEase" className="h-14 object-contain mb-2 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-800">Student Portal</h1>
          <p className="text-sm mt-1 text-slate-500">View your attendance records</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-6 text-slate-800">Sign in</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600">Student ID</label>
              <input
                type="text"
                value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                placeholder="2024-00001"
                required
                className="w-full px-4 py-2.5 rounded-lg text-sm border border-slate-200 bg-slate-50 text-slate-800 outline-none focus:border-green-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 rounded-lg text-sm border border-slate-200 bg-slate-50 text-slate-800 outline-none focus:border-green-400 transition-colors"
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

        <p className="text-center mt-6 text-sm text-slate-500">
          Admin?{" "}
          <Link href="/login" className="font-medium text-green-600 hover:text-green-700">
            Go to Admin Login
          </Link>
        </p>
      </div>
    </div>
  );
}
