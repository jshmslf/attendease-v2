"use client";

import { useState, useEffect } from "react";
import { StudentMessage } from "@/lib/api";

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<StudentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    setLoading(true);
    setError("");
    try {
      const data = await adminFetch<StudentMessage[]>("/api/messages/");
      setMessages(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await adminFetch(`/api/messages/${id}/read`, { method: "PUT" });
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, is_read: true } : m));
    } catch (e) {
      console.error("mark read failed", e);
    }
  }

  const unreadCount = messages.filter((m) => !m.is_read).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Student Messages</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Support requests and messages from students
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
            {unreadCount} unread
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg text-sm"
          style={{ background: "#7f1d1d30", border: "1px solid #ef4444", color: "#fca5a5" }}>
          {error}
          <button onClick={loadMessages} className="ml-2 underline text-xs">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading messages...
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: "var(--text-secondary)" }}>
          No messages yet.
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="rounded-xl p-4"
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${msg.is_read ? "var(--border)" : "#1DB95450"}`,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {msg.student_name}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      · {msg.student_id}
                    </span>
                    {!msg.is_read && (
                      <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                    {msg.body}
                  </p>
                  <p className="text-xs mt-2" style={{ color: "var(--text-secondary)", opacity: 0.6 }}>
                    {formatDate(msg.created_at)}
                  </p>
                </div>
                {!msg.is_read && (
                  <button
                    onClick={() => handleMarkRead(msg.id)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
