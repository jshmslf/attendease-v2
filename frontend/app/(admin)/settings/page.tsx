"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getSettings().then((s) => {
      setSchoolName(s.school_name);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolName.trim()) return;
    setSaving(true);
    setSuccess(false);
    setError("");
    try {
      const updated = await api.updateSettings({ school_name: schoolName.trim() });
      setSchoolName(updated.school_name);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 w-full max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Configure application-wide settings.
        </p>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>General</h2>
        </div>

        <form onSubmit={handleSave} className="px-6 py-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-secondary)" }}>
              School Name
            </label>
            {loading ? (
              <div className="h-10 w-full rounded-lg animate-pulse" style={{ background: "var(--bg-surface)" }} />
            ) : (
              <input
                type="text"
                value={schoolName}
                onChange={(e) => { setSchoolName(e.target.value); setSuccess(false); setError(""); }}
                placeholder="e.g. Jose Juan University"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            )}
            <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)" }}>
              Appears in SMS notifications sent to parents.
            </p>
          </div>

          {error && (
            <div className="px-4 py-2.5 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="px-4 py-2.5 rounded-lg text-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              Settings saved successfully.
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving || loading || !schoolName.trim()}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity"
              style={{
                background: (saving || loading || !schoolName.trim()) ? "#1DB95480" : "#1DB954",
                cursor: (saving || loading || !schoolName.trim()) ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      <div
        className="rounded-2xl overflow-hidden mt-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>SMS Preview</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-secondary)" }}>
            Sample message
          </p>
          <div
            className="rounded-xl px-4 py-3 text-sm font-mono"
            style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          >
            Hello Ms/Mr Juan Cruz! Maria Santos has been marked present at 08:30 AM today! - {schoolName || "…"}
          </div>
        </div>
      </div>
    </div>
  );
}
