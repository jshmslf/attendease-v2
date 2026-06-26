"use client";

import { useState, useEffect } from "react";
import { api, Section } from "@/lib/api";

const inputStyle = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

function SectionModal({
  section,
  onClose,
  onSaved,
}: {
  section: Section | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!section;
  const [name, setName] = useState(section?.name ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isEdit && section) {
        await api.updateSection(section.id, name.trim());
      } else {
        await api.createSection(name.trim());
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save section.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {isEdit ? "Edit Section" : "Add Section"}
          </h2>
          <button
            onClick={onClose}
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#7f1d1d30", border: "1px solid #ef4444", color: "#fca5a5" }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Section Name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="BSIT 1-A"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: loading ? "#1DB95480" : "var(--accent)", cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Section"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SectionsPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editSection, setEditSection] = useState<Section | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<Section | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadSections();
  }, []);

  async function loadSections() {
    setLoading(true);
    try {
      const list = await api.getSections();
      setSections(list);
    } catch {}
    finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.deleteSection(confirmDelete.id);
      setConfirmDelete(null);
      await loadSections();
    } catch {}
    finally { setDeleting(false); }
  }

  const filtered = sections.filter(
    (s) => search === "" || s.name.toLowerCase().includes(search.toLowerCase())
  );

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  }

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Sections</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {sections.length} section{sections.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { setEditSection(null); setModalOpen(true); }}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          + Add Section
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Search sections..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] text-sm">
          <thead>
            <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
              {["Name", "Created", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="text-center py-12 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Loading sections...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-12 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {search ? "No sections match your search." : "No sections yet. Add one to get started."}
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
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{formatDate(s.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditSection(s); setModalOpen(true); }}
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
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <SectionModal
          section={editSection}
          onClose={() => setModalOpen(false)}
          onSaved={async () => { setModalOpen(false); await loadSections(); }}
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
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Delete Section?</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  "<strong>{confirmDelete.name}</strong>" will be permanently deleted.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
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
