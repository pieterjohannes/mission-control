"use client";
import { useEffect, useState } from "react";

interface ActiveAgent {
  issue_id: string;
  agent: string;
  last_pulse: string;
  action: string | null;
}

interface ActivityLogEntry {
  id: number;
  agent: string;
  action: string;
  detail: string | null;
  issue_id: string | null;
  created_at: string;
}

interface SparklinePoint {
  date: string;
  count: number;
}

interface AgentActivityData {
  activeAgents: ActiveAgent[];
  recentLogs: ActivityLogEntry[];
  sparkline: SparklinePoint[];
}

const agentEmoji: Record<string, string> = {
  kai: "🤖", pieter: "👤", alma: "💜", marco: "📊", bea: "🎨",
  rex: "🦖", viktor: "🛡️", dev: "💻", luna: "🌙", max: "⚡",
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
};

function relativeTime(dateStr: string): string {
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

function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-DK", { month: "short", day: "numeric" });
}

function Sparkline({ data }: { data: SparklinePoint[] }) {
  const maxVal = Math.max(1, ...data.map((d) => d.count));
  const width = 200;
  const height = 40;
  const padX = 4;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const n = data.length;

  if (n === 0) return null;

  const points = data.map((d, i) => {
    const x = padX + (i / (n - 1)) * innerW;
    const y = padY + innerH - (d.count / maxVal) * innerH;
    return { x, y, ...d };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaD =
    `${pathD} L ${points[n - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;

  return (
    <div className="flex items-end gap-2">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkGrad)" />
        <path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <title>{`${shortDate(p.date)}: ${p.count} runs`}</title>
            <circle cx={p.x} cy={p.y} r="2.5" fill="#8b5cf6" opacity={p.count > 0 ? 1 : 0.3} />
          </g>
        ))}
      </svg>
      <div className="text-right">
        <div className="text-lg font-bold text-white">{data.reduce((s, d) => s + d.count, 0)}</div>
        <div className="text-[10px] text-gray-500">7d runs</div>
      </div>
    </div>
  );
}

export default function AgentActivityPanel() {
  const [data, setData] = useState<AgentActivityData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = () => {
    fetch("/api/agents/activity")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLastRefresh(new Date());
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return <div className="h-[200px] animate-pulse bg-white/5 rounded-xl" />;
  }

  return (
    <div className="space-y-5">
      {/* Active agents */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Now</h3>
          <span className="text-[10px] text-gray-600">
            {data.activeAgents.length > 0
              ? `${data.activeAgents.length} agent${data.activeAgents.length !== 1 ? "s" : ""} online`
              : "no agents active"}
          </span>
        </div>
        {data.activeAgents.length === 0 ? (
          <div className="text-xs text-gray-600 italic py-2">No active agents in the last 2 minutes.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.activeAgents.map((a) => {
              const colorClass = agentColors[a.agent] || "bg-white/10 text-gray-300 border-white/10";
              return (
                <div
                  key={a.issue_id}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${colorClass}`}
                  title={`Issue: ${a.issue_id} · ${relativeTime(a.last_pulse)}`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  <span>{agentEmoji[a.agent] || "🔵"}</span>
                  <span className="font-medium capitalize">{a.agent}</span>
                  {a.action && (
                    <span className="text-[10px] opacity-60">{a.action}</span>
                  )}
                  <span className="font-mono text-[10px] opacity-50 ml-0.5">{a.issue_id}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sparkline */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Agent Runs (7d)</h3>
        </div>
        <Sparkline data={data.sparkline} />
      </div>

      {/* Recent activity log */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recent Log</h3>
        <div className="space-y-1">
          {data.recentLogs.length === 0 ? (
            <div className="text-xs text-gray-600 italic py-2">No activity yet.</div>
          ) : (
            data.recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-sm shrink-0 mt-0.5">
                  {agentEmoji[log.agent] || "🔵"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-white capitalize">{log.agent}</span>
                    <span className="text-xs text-gray-400">{log.action.replace(/_/g, " ")}</span>
                    {log.issue_id && (
                      <span className="text-[10px] text-purple-400 font-mono bg-purple-500/10 px-1 rounded">
                        {log.issue_id}
                      </span>
                    )}
                  </div>
                  {log.detail && (
                    <div className="text-[11px] text-gray-500 truncate mt-0.5">{log.detail}</div>
                  )}
                </div>
                <span className="text-[10px] text-gray-600 shrink-0 mt-0.5">{relativeTime(log.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-[10px] text-gray-700 text-right">
        Refreshes every 10s · last: {relativeTime(lastRefresh.toISOString())}
      </div>
    </div>
  );
}
