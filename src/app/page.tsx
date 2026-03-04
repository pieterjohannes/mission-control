"use client";
import { useEffect, useState, lazy, Suspense } from "react";

const DomainHealth = lazy(() => import("@/components/DomainHealth"));
const ActivityTimeline = lazy(() => import("@/components/charts/ActivityTimeline"));
const ActivityHeatmap = lazy(() => import("@/components/charts/ActivityHeatmap"));
const IssueThroughput = lazy(() => import("@/components/charts/IssueThroughput"));
const AgentActivity = lazy(() => import("@/components/charts/AgentActivity"));
const ProjectPulse = lazy(() => import("@/components/ProjectPulse"));
const AgentActivityPanel = lazy(() => import("@/components/AgentActivityPanel"));
const AgentHealthDashboard = lazy(() => import("@/components/AgentHealthDashboard"));
const LeaderboardWidget = lazy(() => import("@/components/LeaderboardWidget"));

interface DashboardStats {
  total: number;
  inProgress: number;
  doneThisWeek: number;
  activeAgents: number;
  recentActivity: Array<{
    agent: string;
    action: string;
    detail: string;
    issue_id: string;
    created_at: string;
  }>;
}

interface StatusCount {
  status: string;
  count: number;
}

interface ProjectStatus {
  project: string;
  status: string;
  count: number;
}

const agentEmoji: Record<string, string> = {
  kai: "🤖", pieter: "👤", alma: "💜", marco: "📊", bea: "🎨",
  rex: "🦖", viktor: "🛡️", dev: "💻", luna: "🌙", max: "⚡",
};

const statusColors: Record<string, string> = {
  backlog: "#6b7280",
  next: "#3b82f6",
  in_progress: "#f59e0b",
  review: "#8b5cf6",
  done: "#22c55e",
};

const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  next: "Next",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

const projectColors = ["#8b5cf6", "#3b82f6", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#6366f1"];

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

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [issuesByStatus, setIssuesByStatus] = useState<StatusCount[]>([]);
  const [issuesByProject, setIssuesByProject] = useState<ProjectStatus[]>([]);

  useEffect(() => {
    fetch("/api/charts?chart=dashboard-stats").then(r => r.json()).then(setStats);
    fetch("/api/charts?chart=issues-by-status").then(r => r.json()).then(setIssuesByStatus);
    fetch("/api/charts?chart=issues-by-project").then(r => r.json()).then(setIssuesByProject);
  }, []);

  if (!stats) return <div className="animate-pulse text-gray-500 p-8">Loading...</div>;

  const cards = [
    { label: "Total Issues", value: stats.total, emoji: "📋", color: "from-purple-500/20 to-purple-500/5" },
    { label: "In Progress", value: stats.inProgress, emoji: "🔄", color: "from-amber-500/20 to-amber-500/5" },
    { label: "Done This Week", value: stats.doneThisWeek, emoji: "✅", color: "from-emerald-500/20 to-emerald-500/5" },
    { label: "Active Agents (24h)", value: stats.activeAgents, emoji: "🤖", color: "from-blue-500/20 to-blue-500/5" },
  ];

  const maxStatusCount = Math.max(1, ...issuesByStatus.map(s => s.count));

  // Group issues by project
  const projectMap = new Map<string, { total: number; statuses: Record<string, number> }>();
  for (const row of issuesByProject) {
    const entry = projectMap.get(row.project) || { total: 0, statuses: {} };
    entry.total += row.count;
    entry.statuses[row.status] = row.count;
    projectMap.set(row.project, entry);
  }
  const projects = [...projectMap.entries()].sort((a, b) => b[1].total - a[1].total);
  const maxProjectCount = Math.max(1, ...projects.map(([, v]) => v.total));

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 animate-fade-in overflow-hidden">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold gradient-text">🏠 Dashboard</h1>
        <p className="text-gray-500 mt-1">Mission Control overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className={`glass glass-hover p-5 transition-all duration-300 bg-gradient-to-br ${card.color}`}>
            <div className="text-2xl mb-2">{card.emoji}</div>
            <div className="text-2xl md:text-3xl font-bold text-white">{card.value}</div>
            <div className="text-sm text-gray-400 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-4 md:p-6 overflow-hidden">
          <h2 className="text-lg font-semibold text-white mb-4">📈 Activity Over Time</h2>
          <Suspense fallback={<div className="h-[220px] animate-pulse bg-white/5 rounded-xl" />}>
            <ActivityTimeline />
          </Suspense>
        </div>
        <div className="glass p-4 md:p-6 overflow-hidden">
          <h2 className="text-lg font-semibold text-white mb-4">📊 Issue Throughput</h2>
          <Suspense fallback={<div className="h-[220px] animate-pulse bg-white/5 rounded-xl" />}>
            <IssueThroughput />
          </Suspense>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-4 md:p-6 overflow-hidden">
          <h2 className="text-lg font-semibold text-white mb-4">🗓️ Activity Heatmap</h2>
          <Suspense fallback={<div className="h-[180px] animate-pulse bg-white/5 rounded-xl" />}>
            <ActivityHeatmap />
          </Suspense>
        </div>
        <div className="glass p-4 md:p-6 overflow-hidden">
          <h2 className="text-lg font-semibold text-white mb-4">🤖 Agent Activity</h2>
          <Suspense fallback={<div className="h-[180px] animate-pulse bg-white/5 rounded-xl" />}>
            <AgentActivity />
          </Suspense>
        </div>
      </div>

      {/* Issues by Status + Issues by Project */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-4 md:p-6">
          <h2 className="text-lg font-semibold text-white mb-4">📊 Issues by Status</h2>
          <div className="space-y-3">
            {issuesByStatus.map((s) => (
              <div key={s.status} className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-20 text-right">{statusLabels[s.status] || s.status}</span>
                <div className="flex-1 h-7 bg-white/5 rounded-md overflow-hidden relative">
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${(s.count / maxStatusCount) * 100}%`,
                      backgroundColor: statusColors[s.status] || "#6b7280",
                    }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white font-medium">
                    {s.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-4 md:p-6">
          <h2 className="text-lg font-semibold text-white mb-4">📁 Issues by Project</h2>
          <div className="space-y-3">
            {projects.map(([project, data], i) => {
              const barWidth = (data.total / maxProjectCount) * 100;
              // Build stacked segments
              const segments: { status: string; width: number }[] = [];
              for (const [status, count] of Object.entries(data.statuses)) {
                segments.push({ status, width: (count / data.total) * barWidth });
              }
              return (
                <div key={project} className="flex items-center gap-3">
                  <span className="text-xs md:text-sm text-gray-400 w-20 md:w-28 text-right truncate shrink-0" title={project}>{project}</span>
                  <div className="flex-1 h-7 bg-white/5 rounded-md overflow-hidden flex relative">
                    {segments.map((seg, j) => (
                      <div
                        key={j}
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${seg.width}%`,
                          backgroundColor: statusColors[seg.status] || projectColors[i % projectColors.length],
                        }}
                        title={`${statusLabels[seg.status] || seg.status}`}
                      />
                    ))}
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white font-medium">
                      {data.total}
                    </span>
                  </div>
                </div>
              );
            })}
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-white/5">
              {Object.entries(statusColors).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  {statusLabels[status] || status}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Project Pulse */}
      <div className="glass p-4 md:p-6">
        <h2 className="text-lg font-semibold text-white mb-4">💓 Project Pulse</h2>
        <p className="text-xs text-gray-500 mb-4">Health by last activity — 🟢 &le;3d &nbsp; 🟡 &le;7d &nbsp; 🟠 &le;14d &nbsp; 🔴 &gt;14d</p>
        <Suspense fallback={<div className="h-[200px] animate-pulse bg-white/5 rounded-xl" />}>
          <ProjectPulse />
        </Suspense>
      </div>

      {/* Agent Leaderboard */}
      <div className="glass p-4 md:p-6">
        <h2 className="text-lg font-semibold text-white mb-4">🏆 Agent Leaderboard</h2>
        <p className="text-xs text-gray-500 mb-4">Who shipped the most this week?</p>
        <Suspense fallback={<div className="h-32 animate-pulse bg-white/5 rounded-xl" />}>
          <LeaderboardWidget />
        </Suspense>
      </div>

      {/* Agent Health Dashboard */}
      <div className="glass p-4 md:p-6">
        <h2 className="text-lg font-semibold text-white mb-4">🤖 Agent Health</h2>
        <Suspense fallback={<div className="h-[200px] animate-pulse bg-white/5 rounded-xl" />}>
          <AgentHealthDashboard />
        </Suspense>
      </div>

      {/* Agent Activity Dashboard */}
      <div className="glass p-4 md:p-6">
        <h2 className="text-lg font-semibold text-white mb-4">🤖 Agent Activity</h2>
        <Suspense fallback={<div className="h-[200px] animate-pulse bg-white/5 rounded-xl" />}>
          <AgentActivityPanel />
        </Suspense>
      </div>

      {/* Domain Health */}
      <div className="glass p-4 md:p-6">
        <h2 className="text-lg font-semibold text-white mb-4">🌐 Domain Health</h2>
        <Suspense fallback={<div className="h-[200px] animate-pulse bg-white/5 rounded-xl" />}>
          <DomainHealth />
        </Suspense>
      </div>

      {/* Recent Activity Feed */}
      <div className="glass p-4 md:p-6">
        <h2 className="text-lg font-semibold text-white mb-4">📋 Recent Activity</h2>
        <div className="space-y-2">
          {stats.recentActivity.map((log, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 transition-colors">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-base shrink-0">
                {agentEmoji[log.agent] || "🔵"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white capitalize">{log.agent}</span>
                  <span className="text-sm text-gray-400">{log.action.replace(/_/g, " ")}</span>
                  {log.issue_id && (
                    <span className="text-xs text-purple-400 font-mono">{log.issue_id}</span>
                  )}
                </div>
                {log.detail && (
                  <div className="text-xs text-gray-500 truncate mt-0.5">{log.detail}</div>
                )}
              </div>
              <span className="text-xs text-gray-600 shrink-0">{relativeTime(log.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
