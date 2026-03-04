"use client";
import { useEffect, useState } from "react";

interface ProjectPulseData {
  id: number;
  name: string;
  status: string;
  domain: string | null;
  url: string | null;
  open_issues: number;
  done_issues: number;
  last_activity: string | null;
  last_issue_update: string | null;
  revenue_monthly: number;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  launched: { label: "Live", color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/30" },
  active: { label: "Active", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
  building: { label: "Building", color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30" },
  idea: { label: "Idea", color: "text-gray-400", bg: "bg-gray-500/20 border-gray-500/30" },
  parked: { label: "Parked", color: "text-gray-500", bg: "bg-gray-500/10 border-gray-500/20" },
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr + (dateStr.includes("Z") ? "" : "Z"));
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function healthColor(days: number | null): string {
  if (days === null) return "text-gray-600";
  if (days <= 3) return "text-emerald-400";
  if (days <= 7) return "text-yellow-400";
  if (days <= 14) return "text-orange-400";
  return "text-red-400";
}

function healthEmoji(days: number | null): string {
  if (days === null) return "⚪";
  if (days <= 3) return "🟢";
  if (days <= 7) return "🟡";
  if (days <= 14) return "🟠";
  return "🔴";
}

export default function ProjectPulse() {
  const [projects, setProjects] = useState<ProjectPulseData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/charts?chart=project-pulse")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="h-[200px] animate-pulse bg-white/5 rounded-xl" />;
  }

  return (
    <div className="space-y-2">
      {projects.map((p) => {
        const lastTouch = p.last_activity || p.last_issue_update || p.updated_at;
        const days = daysSince(lastTouch);
        const cfg = statusConfig[p.status] || statusConfig.idea;

        return (
          <div
            key={p.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 transition-colors"
          >
            {/* Health indicator */}
            <span className="text-lg shrink-0" title={days !== null ? `${days}d since last activity` : "No activity"}>
              {healthEmoji(days)}
            </span>

            {/* Project name + domain */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{p.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                  {cfg.label}
                </span>
                {p.revenue_monthly > 0 && (
                  <span className="text-[10px] text-emerald-400">
                    €{p.revenue_monthly}/mo
                  </span>
                )}
              </div>
              {p.domain && (
                <span className="text-xs text-gray-500">{p.domain}</span>
              )}
            </div>

            {/* Issues */}
            <div className="flex items-center gap-3 shrink-0">
              {p.open_issues > 0 && (
                <span className="text-xs text-gray-400" title="Open issues">
                  📋 {p.open_issues}
                </span>
              )}
              {p.done_issues > 0 && (
                <span className="text-xs text-gray-600" title="Done issues">
                  ✅ {p.done_issues}
                </span>
              )}
            </div>

            {/* Last activity */}
            <div className={`text-xs shrink-0 w-16 text-right ${healthColor(days)}`}>
              {days !== null ? (days === 0 ? "today" : `${days}d ago`) : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
