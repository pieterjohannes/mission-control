"use client";
import { useEffect, useState, useCallback } from "react";

interface Issue {
  id: string;
  title: string;
  description: string;
  status: string;
  project: string;
  assignee: string;
  priority: string;
  labels: string;
  created_by: string;
  updated_at: string;
  effort_size: string | null;
}

interface Comment {
  id: string;
  issue_id: string;
  author: string;
  body: string;
  created_at: string;
}

const priorityColors: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
};

const agentEmoji: Record<string, string> = {
  kai: "🤖", pieter: "👤", alma: "💜", marco: "📊", bea: "🎨",
  rex: "🦖", viktor: "🛡️", dev: "💻", luna: "🌙", max: "⚡",
};

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr + (dateStr.includes("Z") ? "" : "Z"));
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function IssueCard({ issue, onAction }: { issue: Issue; onAction: () => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actioning, setActioning] = useState<"approve" | "reject" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    const res = await fetch(`/api/issues/${issue.id}/comments`);
    const data = await res.json();
    setComments(Array.isArray(data) ? data : []);
    setLoadingComments(false);
  }, [issue.id]);

  useEffect(() => {
    if (expanded) loadComments();
  }, [expanded, loadComments]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleApprove = async () => {
    setActioning("approve");
    await fetch(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", changed_by: "pieter" }),
    });
    showToast("✅ Approved — moved to Done");
    setTimeout(() => onAction(), 800);
    setActioning(null);
  };

  const handleReject = async () => {
    setActioning("reject");
    await fetch(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress", changed_by: "pieter" }),
    });
    showToast("🔄 Rejected — moved back to In Progress");
    setTimeout(() => onAction(), 800);
    setActioning(null);
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    await fetch(`/api/issues/${issue.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "pieter", body: commentText.trim() }),
    });
    setCommentText("");
    await loadComments();
    setSubmitting(false);
  };

  const labels = (() => {
    try { return JSON.parse(issue.labels || "[]") as string[]; } catch { return []; }
  })();

  return (
    <div className="glass rounded-2xl border border-white/10 overflow-hidden transition-all duration-200 hover:border-purple-500/20">
      {toast && (
        <div className="px-4 py-2 bg-purple-500/20 border-b border-purple-500/20 text-sm text-purple-300 text-center animate-fade-in">
          {toast}
        </div>
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono text-gray-500">{issue.id}</span>
              {issue.priority && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${priorityColors[issue.priority] || "text-gray-400"}`}>
                  {issue.priority}
                </span>
              )}
              {issue.effort_size && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border font-bold bg-sky-500/10 text-sky-400 border-sky-500/30">
                  {issue.effort_size}
                </span>
              )}
              {labels.map((l: string) => (
                <span key={l} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                  {l}
                </span>
              ))}
            </div>
            <h3 className="text-base font-semibold text-white leading-snug">{issue.title}</h3>
            {issue.project && (
              <p className="text-xs text-gray-500 mt-0.5">
                🚀 {issue.project}
                {issue.assignee && (
                  <> · {agentEmoji[issue.assignee] || "👤"} {issue.assignee}</>
                )}
                {issue.updated_at && (
                  <> · {relativeTime(issue.updated_at)}</>
                )}
              </p>
            )}
            {issue.description && (
              <p className="text-sm text-gray-400 mt-2 line-clamp-2">{issue.description}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleApprove}
            disabled={actioning !== null}
            className="flex-1 py-2 px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 hover:border-emerald-500/40 text-emerald-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {actioning === "approve" ? (
              <span className="w-4 h-4 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
            ) : "✅"}
            Approve
          </button>
          <button
            onClick={handleReject}
            disabled={actioning !== null}
            className="flex-1 py-2 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 hover:border-amber-500/40 text-amber-400 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {actioning === "reject" ? (
              <span className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
            ) : "🔄"}
            Reject
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-gray-200 text-sm transition-all"
          >
            {expanded ? "▲" : "💬"}
          </button>
        </div>
      </div>

      {/* Comment section */}
      {expanded && (
        <div className="border-t border-white/5 p-5 space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Comments</h4>

          {loadingComments ? (
            <div className="text-sm text-gray-500 text-center py-2">Loading…</div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-2">No comments yet.</p>
          ) : (
            <div className="space-y-3">
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <span className="text-lg leading-none mt-0.5">{agentEmoji[c.author] || "👤"}</span>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-gray-300">{c.author}</span>
                      <span className="text-[10px] text-gray-600">{relativeTime(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment input */}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleComment()}
              placeholder="Leave feedback… (Enter to send)"
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/40 transition-all"
            />
            <button
              onClick={handleComment}
              disabled={submitting || !commentText.trim()}
              className="px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/25 text-purple-300 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewQueuePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/issues?status=review&limit=100");
    const data = await res.json();
    setIssues(Array.isArray(data) ? data : Array.isArray(data.issues) ? data.issues : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">🔍 Review Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? "Loading…" : `${issues.length} issue${issues.length !== 1 ? "s" : ""} awaiting review`}
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-gray-200 text-sm transition-all"
        >
          ↺ Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="glass rounded-2xl border border-white/10 p-12 text-center">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading review queue…</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-12 text-center space-y-2">
          <div className="text-4xl">🎉</div>
          <p className="text-lg font-semibold text-gray-300">All clear!</p>
          <p className="text-sm text-gray-500">No issues are currently in review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {issues.map(issue => (
            <IssueCard key={issue.id} issue={issue} onAction={load} />
          ))}
        </div>
      )}
    </div>
  );
}
