"use client";
import { useEffect, useState } from "react";

interface TimelineItem {
  id: string;
  type: "activity" | "comment" | "status_change";
  actor: string;
  action?: string;
  detail?: string | null;
  old_status?: string | null;
  new_status?: string;
  body?: string;
  created_at: string;
}

const AGENT_AVATARS: Record<string, string> = {
  kai: "🤖", pieter: "👤", alma: "💜", marco: "📊", bea: "🎨",
  rex: "🦖", viktor: "🛡️", dev: "💻", luna: "🌙", max: "⚡",
};

const STATUS_COLORS: Record<string, string> = {
  backlog: "text-gray-400 bg-gray-500/15 border-gray-500/30",
  next: "text-blue-400 bg-blue-500/15 border-blue-500/30",
  in_progress: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30",
  review: "text-purple-400 bg-purple-500/15 border-purple-500/30",
  done: "text-teal-400 bg-teal-500/15 border-teal-500/30",
  blocked: "text-red-400 bg-red-500/15 border-red-500/30",
};

const ACTION_ICONS: Record<string, string> = {
  status_change: "⟳",
  assignee_change: "👤",
  comment: "💬",
  assigned: "🎯",
  subagent_spawned: "🤖",
  created: "✨",
  updated: "✏️",
  default: "●",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "text-gray-400 bg-white/5 border-white/10";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {status.replace(/_/g, " ")}
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
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function TimelineItemRow({ item, isLast }: { item: TimelineItem; isLast: boolean }) {
  const avatar = AGENT_AVATARS[item.actor] ?? "👤";

  let icon = ACTION_ICONS.default;
  let dotColor = "bg-white/20";
  let content: React.ReactNode = null;

  if (item.type === "comment") {
    icon = ACTION_ICONS.comment;
    dotColor = "bg-blue-500/60";
    content = (
      <div className="bg-white/5 rounded-lg p-2 mt-1 text-xs text-gray-300 border border-white/5">
        {item.body}
      </div>
    );
  } else if (item.type === "status_change") {
    icon = ACTION_ICONS.status_change;
    dotColor = "bg-purple-500/60";
    content = (
      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
        {item.old_status ? (
          <>
            <StatusBadge status={item.old_status} />
            <span className="text-gray-600 text-xs">→</span>
          </>
        ) : (
          <span className="text-gray-600 text-[10px]">created as</span>
        )}
        <StatusBadge status={item.new_status!} />
      </div>
    );
  } else {
    // activity
    icon = ACTION_ICONS[item.action ?? ""] ?? ACTION_ICONS.default;
    if (item.action === "assignee_change") dotColor = "bg-teal-500/60";
    else if (item.action === "subagent_spawned") dotColor = "bg-orange-500/60";
    else if (item.action === "assigned") dotColor = "bg-green-500/60";
    content = item.detail ? (
      <p className="text-xs text-gray-400 mt-0.5">{item.detail}</p>
    ) : null;
  }

  return (
    <div className="flex items-start gap-2 group">
      {/* Dot + line */}
      <div className="flex flex-col items-center flex-shrink-0 mt-1">
        <div className={`w-2 h-2 rounded-full ring-1 ring-white/10 ${dotColor} text-[8px] flex items-center justify-center`} />
        {!isLast && <div className="w-px bg-white/5 flex-1 mt-1" style={{ minHeight: "16px" }} />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm leading-none">{avatar}</span>
          <span className="text-xs text-gray-300 font-medium">{item.actor}</span>
          <span className="text-[10px] text-gray-600">
            {item.type === "comment"
              ? "commented"
              : item.type === "status_change"
              ? "changed status"
              : (item.action ?? "").replace(/_/g, " ")}
          </span>
          <span className="text-[10px] text-gray-600 ml-auto">
            {relativeTime(item.created_at)}
          </span>
        </div>
        {content}
      </div>
    </div>
  );
}

export default function IssueActivityTimeline({ issueId }: { issueId: string }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/issues/${issueId}/activity`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [issueId]);

  if (loading) return <p className="text-xs text-gray-600 italic">Loading activity...</p>;
  if (items.length === 0) return <p className="text-xs text-gray-600 italic">No activity recorded yet</p>;

  return (
    <div className="space-y-0">
      {items.map((item, i) => (
        <TimelineItemRow key={item.id} item={item} isLast={i === items.length - 1} />
      ))}
    </div>
  );
}
