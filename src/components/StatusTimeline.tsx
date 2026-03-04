"use client";
import { useEffect, useState } from "react";

interface StatusEntry {
  id: number;
  issue_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  changed_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  backlog: "text-gray-400 bg-gray-500/15 border-gray-500/30",
  next: "text-blue-400 bg-blue-500/15 border-blue-500/30",
  in_progress: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30",
  review: "text-purple-400 bg-purple-500/15 border-purple-500/30",
  done: "text-teal-400 bg-teal-500/15 border-teal-500/30",
  blocked: "text-red-400 bg-red-500/15 border-red-500/30",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "text-gray-400 bg-white/5 border-white/10";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr.includes("Z") ? dateStr : dateStr + "Z");
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const AGENT_AVATARS: Record<string, string> = {
  kai: "🤖", pieter: "👤", alma: "💜", marco: "📊", bea: "🎨",
  rex: "🦖", viktor: "🛡️", dev: "💻", luna: "🌙", max: "⚡",
};

export default function StatusTimeline({ issueId }: { issueId: string }) {
  const [history, setHistory] = useState<StatusEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/issues/${issueId}/status-history`)
      .then(r => r.json())
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [issueId]);

  if (loading) return <p className="text-xs text-gray-600 italic">Loading history...</p>;
  if (history.length === 0) return <p className="text-xs text-gray-600 italic">No status changes recorded yet</p>;

  return (
    <div className="space-y-2">
      {history.map((entry, i) => (
        <div key={entry.id} className="flex items-start gap-2 group">
          {/* Timeline line */}
          <div className="flex flex-col items-center pt-1 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-purple-500/60 ring-1 ring-purple-500/30" />
            {i < history.length - 1 && <div className="w-px h-full bg-white/5 flex-1 mt-1" style={{ minHeight: "16px" }} />}
          </div>
          {/* Content */}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm">{AGENT_AVATARS[entry.changed_by] ?? "👤"}</span>
              <span className="text-xs text-gray-400">{entry.changed_by}</span>
              {entry.old_status ? (
                <>
                  <StatusBadge status={entry.old_status} />
                  <span className="text-gray-600 text-xs">→</span>
                </>
              ) : (
                <span className="text-gray-600 text-xs">created as</span>
              )}
              <StatusBadge status={entry.new_status} />
            </div>
            <p
              className="text-[10px] text-gray-600 mt-0.5"
              title={new Date(entry.changed_at.includes("Z") ? entry.changed_at : entry.changed_at + "Z").toLocaleString()}
            >
              {relativeTime(entry.changed_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
