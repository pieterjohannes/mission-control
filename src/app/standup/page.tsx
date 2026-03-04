"use client";
import { useEffect, useState } from "react";

interface IssueRow {
  id: string;
  title: string;
  project: string | null;
  assignee: string | null;
  priority: string;
  labels: string;
  status: string;
  updated_at: string;
}

interface StandupSummary {
  date: string;
  completed: IssueRow[];
  inReview: IssueRow[];
  inProgress: IssueRow[];
  nextUp: IssueRow[];
  blockers: IssueRow[];
  generatedAt: string;
}

const priorityColors: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-500",
  low: "text-gray-500",
};

const priorityDot: Record<string, string> = {
  urgent: "●",
  high: "●",
  medium: "",
  low: "",
};

function IssueItem({ issue }: { issue: IssueRow }) {
  return (
    <li className="flex items-start gap-2 text-sm py-1">
      <a
        href={`/explorer?issue=${issue.id}`}
        className="font-mono text-xs text-gray-500 hover:text-purple-400 transition-colors shrink-0 mt-0.5"
      >
        {issue.id}
      </a>
      <span className="text-gray-200 flex-1 leading-snug">{issue.title}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {issue.project && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
            {issue.project}
          </span>
        )}
        {issue.assignee && (
          <span className="text-[10px] text-gray-500">@{issue.assignee}</span>
        )}
        {priorityDot[issue.priority] && (
          <span className={`text-xs ${priorityColors[issue.priority]}`}>{priorityDot[issue.priority]}</span>
        )}
      </div>
    </li>
  );
}

function Section({
  title,
  issues,
  emptyText,
  accent,
}: {
  title: string;
  issues: IssueRow[];
  emptyText: string;
  accent?: string;
}) {
  return (
    <div className={`rounded-2xl border bg-white/5 backdrop-blur-xl p-5 ${accent || "border-white/10"}`}>
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        {title}
        <span className="ml-2 text-xs font-normal text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full">
          {issues.length}
        </span>
      </h2>
      {issues.length === 0 ? (
        <p className="text-xs text-gray-600 italic">{emptyText}</p>
      ) : (
        <ul className="space-y-0.5 divide-y divide-white/5">
          {issues.map((issue) => (
            <IssueItem key={issue.id} issue={issue} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function StandupPage() {
  const [summary, setSummary] = useState<StandupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/standup")
      .then((r) => r.json())
      .then((data: StandupSummary) => {
        setSummary(data);
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    setSaving(true);
    setSaved(false);
    await fetch("/api/standup", { method: "POST" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500 text-sm animate-pulse">Loading standup…</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">📋 Daily Standup</h1>
          <p className="text-gray-400 text-sm mt-1">{summary.date}</p>
          <p className="text-gray-600 text-xs mt-0.5">
            Auto-generated from issues updated in the last 24h
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl text-sm border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            🔄 Refresh
          </button>
          <button
            onClick={handleGenerate}
            disabled={saving}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              saved
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saving ? "Saving…" : saved ? "✅ Saved!" : "💾 Save Standup"}
          </button>
        </div>
      </div>

      {/* Blockers banner */}
      {summary.blockers.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3">
          <span className="text-xl">🚧</span>
          <div>
            <p className="text-sm font-semibold text-red-400">
              {summary.blockers.length} blocker{summary.blockers.length > 1 ? "s" : ""} need attention
            </p>
            <p className="text-xs text-red-400/70 mt-0.5">
              {summary.blockers.map((b) => b.title).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Summary grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section
          title="✅ Completed (last 24h)"
          issues={summary.completed}
          emptyText="Nothing completed yet today"
          accent="border-emerald-500/20"
        />
        <Section
          title="🔍 In Review"
          issues={summary.inReview}
          emptyText="No items in review"
          accent="border-blue-500/20"
        />
        <Section
          title="🔨 In Progress"
          issues={summary.inProgress}
          emptyText="Nothing in progress"
          accent="border-yellow-500/20"
        />
        <Section
          title="📌 Next Up"
          issues={summary.nextUp}
          emptyText="No items queued"
          accent="border-purple-500/20"
        />
        {summary.blockers.length > 0 && (
          <div className="md:col-span-2">
            <Section
              title="🚧 Blockers"
              issues={summary.blockers}
              emptyText=""
              accent="border-red-500/30"
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 text-xs text-gray-600 text-center">
        Generated at {new Date(summary.generatedAt).toLocaleTimeString()} ·{" "}
        <a href="/explorer?issue=meta-standup" className="hover:text-gray-400 transition-colors">
          View standup log →
        </a>
      </div>
    </div>
  );
}
