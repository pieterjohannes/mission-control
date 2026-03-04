"use client";

import { useEffect, useState, useCallback } from "react";

interface Template {
  id: string;
  name: string;
  description: string | null;
  project: string | null;
  priority: string;
  labels: string; // JSON
  default_subtasks: string; // JSON
  created_by: string;
  created_at: string;
}

interface TemplatesModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const PRIORITIES = [
  { value: "urgent", label: "🔴 Urgent" },
  { value: "high", label: "🟠 High" },
  { value: "medium", label: "🟡 Medium" },
  { value: "low", label: "⚪ Low" },
];

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400",
  high: "bg-orange-500/20 text-orange-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low: "bg-gray-500/20 text-gray-400",
};

export default function TemplatesModal({ open, onClose, onCreated }: TemplatesModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"list" | "create">("list");
  const [using, setUsing] = useState<Template | null>(null);

  // Create template form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [priority, setPriority] = useState("medium");
  const [subtasks, setSubtasks] = useState("");
  const [projects, setProjects] = useState<{ name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Use template form
  const [issueTitle, setIssueTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      setView("list");
      setUsing(null);
      fetch("/api/projects").then(r => r.json()).then(setProjects).catch(() => {});
    }
  }, [open, fetchTemplates]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleCreateTemplate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const subtaskList = subtasks
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => ({ title: s }));
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          project: project || null,
          priority,
          default_subtasks: subtaskList,
          created_by: "pieter",
        }),
      });
      setName(""); setDescription(""); setProject(""); setPriority("medium"); setSubtasks("");
      setView("list");
      fetchTemplates();
    } catch {}
    setSaving(false);
  };

  const handleUseTemplate = async (tpl: Template) => {
    setUsing(tpl);
    setIssueTitle(tpl.name);
  };

  const handleCreateIssue = async () => {
    if (!using) return;
    setCreating(true);
    try {
      await fetch(`/api/templates/${using.id}/create-issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: issueTitle.trim() || using.name,
          created_by: "pieter",
        }),
      });
      onClose();
      onCreated?.();
    } catch {}
    setCreating(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-gray-900 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <div>
              <h2 className="text-lg font-bold text-gray-100">Issue Templates</h2>
              <p className="text-xs text-gray-500 mt-0.5">Reusable templates for recurring work</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === "list" && (
              <button
                onClick={() => setView("create")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition"
              >
                + New Template
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 transition text-lg"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* Use template sub-view */}
          {using && (
            <div className="space-y-4">
              <button onClick={() => setUsing(null)} className="text-xs text-gray-500 hover:text-gray-300 transition">← Back to templates</button>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-200">{using.name}</p>
                {using.description && <p className="text-xs text-gray-400">{using.description}</p>}
                {(() => {
                  const subs = JSON.parse(using.default_subtasks || "[]") as { title: string }[];
                  if (!subs.length) return null;
                  return (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-500">Subtasks ({subs.length}):</p>
                      {subs.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                          <span className="w-3 h-3 rounded border border-white/20 shrink-0" />
                          {s.title}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Issue title</label>
                <input
                  type="text"
                  value={issueTitle}
                  onChange={e => setIssueTitle(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 text-sm transition"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setUsing(null)} className="flex-1 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-200 bg-white/5 hover:bg-white/10 border border-white/5 transition">
                  Cancel
                </button>
                <button
                  onClick={handleCreateIssue}
                  disabled={creating}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition shadow-lg shadow-purple-900/30"
                >
                  {creating ? "Creating…" : "Create Issue"}
                </button>
              </div>
            </div>
          )}

          {/* Create template view */}
          {!using && view === "create" && (
            <div className="space-y-4">
              <button onClick={() => setView("list")} className="text-xs text-gray-500 hover:text-gray-300 transition">← Back to templates</button>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Template name *</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Review"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 text-sm transition"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description</label>
                <textarea
                  placeholder="What is this template for?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 text-sm transition resize-none"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-sm focus:outline-none focus:border-purple-500/50 transition"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value} className="bg-gray-900">{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Project</label>
                  <select
                    value={project}
                    onChange={e => setProject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-sm focus:outline-none focus:border-purple-500/50 transition"
                  >
                    <option value="" className="bg-gray-900">None</option>
                    {projects.map(p => (
                      <option key={p.name} value={p.name} className="bg-gray-900">{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Default subtasks (one per line)</label>
                <textarea
                  placeholder={"Review last week\nPlan this week\nUpdate MEMORY.md"}
                  value={subtasks}
                  onChange={e => setSubtasks(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 text-sm transition resize-none font-mono"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setView("list")} className="flex-1 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-200 bg-white/5 hover:bg-white/10 border border-white/5 transition">
                  Cancel
                </button>
                <button
                  onClick={handleCreateTemplate}
                  disabled={saving || !name.trim()}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition shadow-lg shadow-purple-900/30"
                >
                  {saving ? "Saving…" : "Save Template"}
                </button>
              </div>
            </div>
          )}

          {/* Template list view */}
          {!using && view === "list" && (
            <div className="space-y-3">
              {loading && (
                <div className="text-center py-8 text-gray-500 text-sm">Loading templates…</div>
              )}
              {!loading && templates.length === 0 && (
                <div className="text-center py-12 space-y-3">
                  <div className="text-4xl">📋</div>
                  <p className="text-gray-400 text-sm">No templates yet</p>
                  <p className="text-gray-600 text-xs">Create a template to speed up recurring issue creation.</p>
                  <button
                    onClick={() => setView("create")}
                    className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition"
                  >
                    Create your first template
                  </button>
                </div>
              )}
              {templates.map(tpl => {
                const subs = JSON.parse(tpl.default_subtasks || "[]") as { title: string }[];
                const labels = JSON.parse(tpl.labels || "[]") as string[];
                return (
                  <div key={tpl.id} className="rounded-xl bg-white/5 border border-white/10 p-4 hover:border-purple-500/30 transition group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-200">{tpl.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[tpl.priority] || PRIORITY_BADGE.medium}`}>
                            {tpl.priority}
                          </span>
                          {tpl.project && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
                              {tpl.project}
                            </span>
                          )}
                          {labels.map(l => (
                            <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400">{l}</span>
                          ))}
                        </div>
                        {tpl.description && (
                          <p className="text-xs text-gray-500 mt-1 truncate">{tpl.description}</p>
                        )}
                        {subs.length > 0 && (
                          <p className="text-xs text-gray-600 mt-1">{subs.length} subtask{subs.length !== 1 ? "s" : ""}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleUseTemplate(tpl)}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600/80 hover:bg-purple-500 text-white transition opacity-0 group-hover:opacity-100"
                      >
                        Use template →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
