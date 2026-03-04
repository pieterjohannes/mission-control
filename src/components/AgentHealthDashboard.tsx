"use client";
import { useEffect, useState } from "react";
import type { AgentHealth } from "@/app/api/agents/health/route";

const agentEmoji: Record<string, string> = {
  kai: "🤖", pieter: "👤", alma: "💜", marco: "📊", bea: "🎨",
  rex: "🦖", viktor: "🛡️", dev: "💻", luna: "🌙", max: "⚡",
};

const agentColors: Record<string, string> = {
  kai: "from-purple-500/20 to-purple-500/5 border-purple-500/20",
  pieter: "from-blue-500/20 to-blue-500/5 border-blue-500/20",
  alma: "from-pink-500/20 to-pink-500/5 border-pink-500/20",
  marco: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20",
  bea: "from-amber-500/20 to-amber-500/5 border-amber-500/20",
  rex: "from-orange-500/20 to-orange-500/5 border-orange-500/20",
  viktor: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/20",
  dev: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/20",
  luna: "from-violet-500/20 to-violet-500/5 border-violet-500/20",
  max: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/20",
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "never";
  const now = new Date();
  const date = new Date(dateStr + (dateStr.includes("Z") ? "" : "Z"));
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

function StatusDot({ status }: { status: AgentHealth["status"] }) {
  if (status === "active") {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
      </span>
    );
  }
  if (status === "idle") {
    return <span className="inline-flex rounded-full h-2.5 w-2.5 bg-yellow-400/80" />;
  }
  return <span className="inline-flex rounded-full h-2.5 w-2.5 bg-gray-600" />;
}

const statusLabel: Record<AgentHealth["status"], string> = {
  active: "Active",
  idle: "Idle",
  offline: "Offline",
};

const statusTextColor: Record<AgentHealth["status"], string> = {
  active: "text-emerald-400",
  idle: "text-yellow-400",
  offline: "text-gray-500",
};

export default function AgentHealthDashboard() {
  const [agents, setAgents] = useState<AgentHealth[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    fetch("/api/agents/health")
      .then((r) => r.json())
      .then((data) => {
        setAgents(data);
        setLastRefresh(new Date());
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-36 animate-pulse bg-white/5 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic py-4 text-center">
        No agent activity recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const colorClass = agentColors[agent.agent] || "from-white/10 to-white/5 border-white/10";
          return (
            <div
              key={agent.agent}
              className={`bg-gradient-to-br ${colorClass} border rounded-2xl p-4 space-y-3 transition-all duration-200 hover:scale-[1.01]`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{agentEmoji[agent.agent] || "🔵"}</span>
                  <span className="font-semibold text-white capitalize">{agent.agent}</span>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-medium ${statusTextColor[agent.status]}`}>
                  <StatusDot status={agent.status} />
                  {statusLabel[agent.status]}
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-0.5">Last Seen</div>
                  <div className="text-white font-medium">{relativeTime(agent.lastSeen)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-0.5">Tasks</div>
                  <div className="text-white font-medium">{agent.taskCount.toLocaleString()}</div>
                </div>
                {agent.lastPulse && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-0.5">Last Pulse</div>
                    <div className="text-white font-medium">{relativeTime(agent.lastPulse)}</div>
                  </div>
                )}
              </div>

              {/* Recent actions */}
              {agent.recentActions.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-1.5">Recent Actions</div>
                  <ul className="space-y-1">
                    {agent.recentActions.map((action, i) => (
                      <li key={i} className="text-[11px] text-gray-400 truncate flex items-start gap-1">
                        <span className="text-gray-700 mt-px shrink-0">›</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-gray-700 text-right">
        Auto-refreshes every 30s · last: {relativeTime(lastRefresh.toISOString())}
      </div>
    </div>
  );
}
