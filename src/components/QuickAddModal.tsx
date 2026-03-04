"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface QuickAddModalProps {
  open: boolean;
  defaultProject?: string | null;
  onClose: () => void;
  onCreated?: () => void;
}

const PRIORITIES = [
  { value: "urgent", label: "🔴 Urgent" },
  { value: "high", label: "🟠 High" },
  { value: "medium", label: "🟡 Medium" },
  { value: "low", label: "⚪ Low" },
];

export default function QuickAddModal({ open, defaultProject, onClose, onCreated }: QuickAddModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [project, setProject] = useState(defaultProject || "");
  const [projects, setProjects] = useState<{ name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Fetch projects for dropdown
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data))
      .catch(() => {});
  }, []);

  // Focus title when opened
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setProject(defaultProject || "");
      setError(null);
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open, defaultProject]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError("Title is required");
      titleRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          project: project || null,
          status: "backlog",
          created_by: "pieter",
        }),
      });
      if (!res.ok) throw new Error("Failed to create issue");
      onClose();
      onCreated?.();
    } catch (e) {
      setError("Failed to create issue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [title, description, priority, project, onClose, onCreated]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-gray-900 shadow-2xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-100">Quick Add Issue</h2>
            <p className="text-xs text-gray-500 mt-0.5">Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-gray-300 font-mono text-[10px]">Enter</kbd> to submit · <kbd className="px-1 py-0.5 rounded bg-white/10 text-gray-300 font-mono text-[10px]">Esc</kbd> to close</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 transition text-lg"
          >
            ×
          </button>
        </div>

        {/* Title */}
        <div>
          <input
            ref={titleRef}
            type="text"
            placeholder="Issue title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:bg-white/8 text-sm transition"
          />
        </div>

        {/* Description */}
        <div>
          <textarea
            placeholder="Description (optional)…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:bg-white/8 text-sm transition resize-none"
          />
        </div>

        {/* Priority + Project row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-sm focus:outline-none focus:border-purple-500/50 transition"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value} className="bg-gray-900">
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Project</label>
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-sm focus:outline-none focus:border-purple-500/50 transition"
            >
              <option value="" className="bg-gray-900">None</option>
              {projects.map((p) => (
                <option key={p.name} value={p.name} className="bg-gray-900">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 px-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-200 bg-white/5 hover:bg-white/10 border border-white/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-purple-900/30"
          >
            {submitting ? "Creating…" : "Create Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}
