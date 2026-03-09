"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface ActivityLogEntry {
  id: number;
  agent: string;
  action: string;
  detail: string | null;
  issue_id: string | null;
  issue_title: string | null;
  created_at: string;
}

const agentEmoji: Record<string, string> = {
  kai: "🤖", pieter: "👤", alma: "💜", marco: "📊", bea: "🎨",
  rex: "🦖", viktor: "🛡️", dev: "💻", luna: "🌙", max: "⚡",
  stella: "⭐", tina: "🏠", vicky: "📖", system: "⚙️",
};

const agentColors: Record<string, string> = {
  kai: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  pieter: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  alma: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  marco: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  bea: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  rex: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  viktor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  dev: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  luna: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  max: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  stella: "bg-yellow-500/20 text-yellow-200 border-yellow-500/30",
  tina: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  vicky: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  system: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const actionColors: Record<string, string> = {
  working: "text-emerald-400",
  completed: "text-blue-400",
  started: "text-amber-400",
  failed: "text-red-400",
  idle: "text-gray-500",
};

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr.includes("Z") ? dateStr : dateStr + "Z");
  const diffMs = now.getTime() - date.getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface Props {
  /** max entries to fetch */
  limit?: number;
  /** optional fixed height for scroll container */
  maxHeight?: string;
  /** show the filter dropdown */
  showFilter?: boolean;
}

export default function AgentActivityFeed({ limit = 50, maxHeight = "480px", showFilter = true }: Props) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [knownAgents, setKnownAgents] = useState<string[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchEntries = (agent: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (agent !== "all") params.set("agent", agent);
    fetch(`/api/activity-log?${params}`)
      .then((r) => r.json())
      .then((raw: ActivityLogEntry[] | { entries: ActivityLogEntry[] }) => {
        const data: ActivityLogEntry[] = Array.isArray(raw) ? raw : (raw as any).entries ?? [];
        setEntries(data);
        // Collect all distinct agents from the full (unfiltered) list when on "all"
        if (agent === "all") {
          const seen = new Set<string>(data.map((e) => e.agent));
          setKnownAgents((prev) => {
            const merged = new Set([...prev, ...seen]);
            return [...merged].sort();
          });
        }
        setLastRefresh(new Date());
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchEntries(agentFilter);
    const interval = setInterval(() => fetchEntries(agentFilter), 5_000);
    return () => clearInterval(interval);
  }, [agentFilter, limit]);

  return (
    <div className="space-y-3">
      {/* Header row with filter */}
      {showFilter && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Agent</span>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="text-xs bg-white/5 border border-white/10 text-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
          >
            <option value="all">All agents</option>
            {knownAgents.map((a) => (
              <option key={a} value={a}>
                {agentEmoji[a] || "🔵"} {a}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Feed list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse bg-white/5 rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-600 italic py-4 text-center">No activity yet.</p>
      ) : (
        <div
          className="space-y-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
          style={{ maxHeight }}
        >
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
            >
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-sm shrink-0 mt-0.5">
                {agentEmoji[entry.agent] || "🔵"}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Agent badge */}
                  <span
                    className={`text-[11px] font-semibold capitalize px-1.5 py-0.5 rounded border ${agentColors[entry.agent] || "bg-white/10 text-gray-300 border-white/10"}`}
                  >
                    {entry.agent}
                  </span>

                  {/* Action */}
                  <span className={`text-xs ${actionColors[entry.action] || "text-gray-400"}`}>
                    {entry.action.replace(/_/g, " ")}
                  </span>

                  {/* Issue badge */}
                  {entry.issue_id && (
                    <Link
                      href={`/issue/${entry.issue_id}`}
                      className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded hover:bg-purple-500/20 transition-colors"
                      title={entry.issue_title || entry.issue_id}
                    >
                      {entry.issue_id}
                    </Link>
                  )}
                </div>

                {/* Detail or issue title */}
                {(entry.detail || entry.issue_title) && (
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    {entry.detail || entry.issue_title}
                  </p>
                )}
              </div>

              {/* Timestamp */}
              <span className="text-[10px] text-gray-600 shrink-0 mt-1 whitespace-nowrap opacity-60 group-hover:opacity-100 transition-opacity">
                {relativeTime(entry.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-700 text-right">
        Live feed · refreshes every 5s · last: {relativeTime(lastRefresh.toISOString())}
      </p>
    </div>
  );
}
