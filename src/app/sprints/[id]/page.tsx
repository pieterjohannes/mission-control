"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface Issue {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string | null;
  project: string | null;
  effort_size: string | null;
}

const EFFORT_COLORS: Record<string, string> = {
  XS: "bg-sky-500/20 text-sky-400 border border-sky-500/30",
  S:  "bg-teal-500/20 text-teal-400 border border-teal-500/30",
  M:  "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  L:  "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  XL: "bg-red-500/20 text-red-400 border border-red-500/30",
};

interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  project: string | null;
  issues: Issue[];
  issue_count: number;
  done_count: number;
}

const COLUMNS = [
  { id: "backlog",     label: "Backlog",      emoji: "📋" },
  { id: "next",        label: "Next",         emoji: "⏭️" },
  { id: "in_progress", label: "In Progress",  emoji: "🔄" },
  { id: "review",      label: "Review",       emoji: "🔍" },
  { id: "done",        label: "Done",         emoji: "✅" },
];

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-400",
  high:   "bg-orange-400",
  medium: "bg-yellow-400",
  low:    "bg-gray-400",
};

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{done}/{total} done</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SprintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [addingIssue, setAddingIssue] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    const res = await fetch(`/api/sprints/${id}`);
    if (res.ok) setSprint(await res.json());
  }

  async function loadAll() {
    const res = await fetch("/api/issues");
    if (res.ok) setAllIssues(await res.json());
  }

  useEffect(() => {
    load();
    loadAll();
  }, [id]);

  async function assignIssue(issue_id: string) {
    await fetch(`/api/sprints/${id}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issue_id }),
    });
    load();
    loadAll();
  }

  async function removeIssue(issue_id: string) {
    await fetch(`/api/sprints/${id}/issues`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issue_id }),
    });
    load();
    loadAll();
  }

  if (!sprint) return <div className="p-6 text-gray-400">Loading…</div>;

  const sprintIssueIds = new Set(sprint.issues.map(i => i.id));
  const available = allIssues.filter(i =>
    !sprintIssueIds.has(i.id) &&
    (i.title.toLowerCase().includes(search.toLowerCase()) || i.id.includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/sprints" className="text-xs text-gray-500 hover:text-gray-300 mb-2 block">← All sprints</Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{sprint.name}</h1>
            {sprint.goal && <p className="text-gray-400 mt-1 text-sm">{sprint.goal}</p>}
            {(sprint.start_date || sprint.end_date) && (
              <p className="text-xs text-gray-500 mt-1">
                {sprint.start_date ? new Date(sprint.start_date).toLocaleDateString() : "?"} → {sprint.end_date ? new Date(sprint.end_date).toLocaleDateString() : "?"}
              </p>
            )}
          </div>
          <div className="min-w-64">
            <ProgressBar done={sprint.done_count} total={sprint.issue_count} />
          </div>
        </div>
      </div>

      {/* Board columns */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {COLUMNS.map(col => {
          const colIssues = sprint.issues.filter(i => i.status === col.id);
          return (
            <div key={col.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-sm">{col.emoji}</span>
                <span className="text-xs font-semibold text-gray-300">{col.label}</span>
                <span className="ml-auto text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded-full">{colIssues.length}</span>
              </div>
              <div className="space-y-2">
                {colIssues.map(issue => (
                  <div key={issue.id} className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 hover:border-gray-600 transition-colors group">
                    <div className="flex items-start gap-1.5">
                      <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[issue.priority] || "bg-gray-400"}`} />
                      <Link href={`/kanban?issue=${issue.id}`} className="text-xs text-white hover:text-blue-300 leading-snug transition-colors">
                        {issue.title}
                      </Link>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {issue.assignee && (
                        <span className="text-xs text-gray-500">{issue.assignee}</span>
                      )}
                      {issue.effort_size && EFFORT_COLORS[issue.effort_size] && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${EFFORT_COLORS[issue.effort_size]}`}>
                          {issue.effort_size}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeIssue(issue.id)}
                      className="mt-1.5 text-xs text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      Remove from sprint
                    </button>
                  </div>
                ))}
                {colIssues.length === 0 && (
                  <div className="text-xs text-gray-600 text-center py-4">Empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add issues */}
      <div className="border-t border-gray-800 pt-4">
        <button
          onClick={() => setAddingIssue(!addingIssue)}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          {addingIssue ? "▲ Hide" : "▼ Add issues to sprint"}
        </button>

        {addingIssue && (
          <div className="mt-3">
            <input
              placeholder="Search issues…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-md px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-3"
            />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
              {available.slice(0, 50).map(issue => (
                <button
                  key={issue.id}
                  onClick={() => assignIssue(issue.id)}
                  className="text-left p-2 bg-gray-800 border border-gray-700 hover:border-blue-500 rounded-lg text-xs text-white transition-colors"
                >
                  <div className="flex items-start gap-1.5">
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[issue.priority] || "bg-gray-400"}`} />
                    <span className="line-clamp-2 leading-snug">{issue.title}</span>
                  </div>
                  {issue.project && <div className="text-gray-500 mt-1">{issue.project}</div>}
                </button>
              ))}
              {available.length === 0 && (
                <div className="col-span-4 text-gray-500 text-xs py-2">No unassigned issues found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
