"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";

interface ActivityEntry {
  id: number;
  agent: string;
  action: string;
  detail: string | null;
  issue_id: string | null;
  created_at: string;
}

const AGENT_META: Record<string, { emoji: string; color: string; label: string }> = {
  kai:    { emoji: "🚀", color: "purple", label: "Kai — Orchestrator" },
  alma:   { emoji: "💜", color: "pink", label: "Alma — Life Partner" },
  tina:   { emoji: "🏠", color: "emerald", label: "Tina — Home" },
  vicky:  { emoji: "📖", color: "amber", label: "Vicky — Stories" },
  stella: { emoji: "⭐", color: "yellow", label: "Stella — Career" },
  hunter: { emoji: "🎯", color: "red", label: "Hunter — Sales" },
  pieter: { emoji: "👤", color: "blue", label: "Pieter — Human" },
  system: { emoji: "⚙️", color: "gray", label: "System" },
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + (dateStr.includes("Z") ? "" : "Z")).getTime();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AgentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [stats, setStats] = useState<{ total: number; today: number; week: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const meta = AGENT_META[agentId] ?? { emoji: "🤖", color: "gray", label: agentId };

  useEffect(() => {
    Promise.all([
      fetch(`/api/activity?agent=${agentId}&limit=50`).then(r => r.json()).then(d => d.logs ?? d),
      fetch(`/api/agents/${agentId}/heatmap`).then(r => r.json()),
    ]).then(([activity, heatmap]) => {
      setEntries(Array.isArray(activity) ? activity : []);
      // Compute stats from heatmap data
      const dates = heatmap.dates ?? [];
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const total = dates.reduce((s: number, d: any) => s + d.count, 0);
      const todayCount = dates.find((d: any) => d.date === today)?.count ?? 0;
      const weekCount = dates.filter((d: any) => d.date >= weekAgo).reduce((s: number, d: any) => s + d.count, 0);
      setStats({ total, today: todayCount, week: weekCount });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [agentId]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{meta.emoji}</span>
          <div>
            <h1 className="text-2xl font-bold gradient-text capitalize">{agentId}</h1>
            <p className="text-gray-500 text-sm">{meta.label}</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="glass p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.today}</p>
            <p className="text-xs text-gray-500 mt-1">Today</p>
          </div>
          <div className="glass p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.week}</p>
            <p className="text-xs text-gray-500 mt-1">This week</p>
          </div>
          <div className="glass p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-1">Last 90 days</p>
          </div>
        </div>
      )}

      {/* Heatmap */}
      <ActivityHeatmap agentId={agentId} />

      {/* Recent activity */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Recent Activity</h2>
        <div className="space-y-1.5">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass p-3.5 animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-3/4" />
              </div>
            ))
          ) : entries.length === 0 ? (
            <div className="text-center py-10 text-gray-600">
              <p className="text-3xl mb-2">📭</p>
              <p>No activity yet</p>
            </div>
          ) : (
            entries.map(entry => (
              <div key={entry.id} className="glass p-3.5 flex items-start gap-3 hover:bg-white/[0.03] transition-all">
                <div className="text-xl shrink-0 mt-0.5">{meta.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-300">
                      {entry.action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                    {entry.issue_id && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-500 font-mono">
                        {entry.issue_id}
                      </span>
                    )}
                  </div>
                  {entry.detail && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{entry.detail}</p>
                  )}
                </div>
                <div className="text-xs text-gray-600 shrink-0 whitespace-nowrap">
                  {relativeTime(entry.created_at)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
