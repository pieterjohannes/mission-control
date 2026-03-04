"use client";
import { useEffect, useState } from "react";

interface LeaderboardEntry {
  agent: string;
  issuesClosedThisWeek: number;
  avgHoursToClose: number | null;
  totalClosed: number;
  rank: number;
}

const agentEmoji: Record<string, string> = {
  kai: "🤖", pieter: "👤", alma: "💜", marco: "📊", bea: "🎨",
  rex: "🦖", viktor: "🛡️", dev: "💻", luna: "🌙", max: "⚡",
  system: "⚙️",
};

const rankMedal: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

function formatAvgTime(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export default function LeaderboardWidget() {
  const [data, setData] = useState<{ leaderboard: LeaderboardEntry[]; weekStart: string } | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard").then(r => r.json()).then(setData);
  }, []);

  if (!data) {
    return <div className="animate-pulse h-32 bg-white/5 rounded-xl" />;
  }

  const { leaderboard } = data;

  if (leaderboard.length === 0) {
    return (
      <div className="text-center text-gray-500 text-sm py-6">
        No completed issues this week yet. Ship something! 🚀
      </div>
    );
  }

  const maxClosed = Math.max(1, ...leaderboard.map(e => e.issuesClosedThisWeek));

  return (
    <div className="space-y-2">
      {/* Column headers */}
      <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 text-xs text-gray-500 px-1 mb-3">
        <span className="w-8" />
        <span>Agent</span>
        <span className="text-right w-20">This week</span>
        <span className="text-right w-20">Avg close</span>
      </div>

      {leaderboard.map((entry) => {
        const barPct = (entry.issuesClosedThisWeek / maxClosed) * 100;
        const medal = rankMedal[entry.rank];
        const emoji = agentEmoji[entry.agent] || "🔵";

        return (
          <div
            key={entry.agent}
            className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 items-center group hover:bg-white/5 rounded-xl px-1 py-2 transition-colors"
          >
            {/* Rank / medal */}
            <div className="w-8 text-center text-base">
              {medal || <span className="text-xs text-gray-600">#{entry.rank}</span>}
            </div>

            {/* Agent name + bar */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{emoji}</span>
                <span className="text-sm font-medium text-white capitalize">{entry.agent}</span>
                {entry.totalClosed > 0 && (
                  <span className="text-xs text-gray-600">({entry.totalClosed} total)</span>
                )}
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barPct}%`,
                    background: entry.rank === 1
                      ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                      : entry.rank === 2
                      ? "linear-gradient(90deg, #6b7280, #9ca3af)"
                      : entry.rank === 3
                      ? "linear-gradient(90deg, #92400e, #b45309)"
                      : "linear-gradient(90deg, #7c3aed, #8b5cf6)",
                  }}
                />
              </div>
            </div>

            {/* Issues this week */}
            <div className="w-20 text-right">
              <span className="text-sm font-bold text-white">{entry.issuesClosedThisWeek}</span>
              <span className="text-xs text-gray-500 ml-1">closed</span>
            </div>

            {/* Avg time to close */}
            <div className="w-20 text-right text-xs text-gray-400">
              {formatAvgTime(entry.avgHoursToClose)}
            </div>
          </div>
        );
      })}

      <div className="pt-2 border-t border-white/5 text-xs text-gray-600 text-right">
        Week from {new Date(data.weekStart).toLocaleDateString("en-DK", { weekday: "short", month: "short", day: "numeric" })}
      </div>
    </div>
  );
}
