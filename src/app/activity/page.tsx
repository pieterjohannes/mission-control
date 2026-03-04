"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useEvents } from "@/lib/useEvents";

interface ActivityEntry {
  id: number;
  agent: string;
  action: string;
  detail: string | null;
  issue_id: string | null;
  created_at: string;
}

interface AgentStatus {
  agent: string;
  last_active: string;
}

const AGENT_META: Record<string, { emoji: string; color: string }> = {
  kai:    { emoji: "🚀", color: "purple" },
  alma:   { emoji: "💜", color: "pink" },
  tina:   { emoji: "🏠", color: "emerald" },
  vicky:  { emoji: "📖", color: "amber" },
  stella: { emoji: "⭐", color: "yellow" },
  hunter: { emoji: "🎯", color: "red" },
  pieter: { emoji: "👤", color: "blue" },
  system: { emoji: "⚙️", color: "gray" },
};

// Icons per action type
const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  // creation / spawn
  create_issue:       { icon: "✨", color: "text-green-400" },
  spawn:              { icon: "🌱", color: "text-green-400" },
  spawn_subagent:     { icon: "🌱", color: "text-green-400" },
  spawned_subagent:   { icon: "🌱", color: "text-green-400" },
  subagent_spawned:   { icon: "🌱", color: "text-green-400" },
  proposed_issue:     { icon: "💡", color: "text-yellow-400" },
  proposed:           { icon: "💡", color: "text-yellow-400" },
  proposed_improvement: { icon: "💡", color: "text-yellow-400" },
  // completion
  completed:          { icon: "✅", color: "text-emerald-400" },
  complete:           { icon: "✅", color: "text-emerald-400" },
  issue_completed:    { icon: "✅", color: "text-emerald-400" },
  closed_issue:       { icon: "🔒", color: "text-gray-400" },
  task_completed:     { icon: "✅", color: "text-emerald-400" },
  // status / assignment
  status_change:      { icon: "🔄", color: "text-blue-400" },
  assignee_change:    { icon: "👤", color: "text-blue-400" },
  assign:             { icon: "👤", color: "text-blue-400" },
  assigned:           { icon: "👤", color: "text-blue-400" },
  pickup:             { icon: "🫴", color: "text-indigo-400" },
  picked_up:          { icon: "🫴", color: "text-indigo-400" },
  resume:             { icon: "▶️", color: "text-indigo-400" },
  // cron / system
  cron_run:           { icon: "⏰", color: "text-gray-400" },
  heartbeat:          { icon: "💓", color: "text-pink-400" },
  nightly_review:     { icon: "🌙", color: "text-purple-400" },
  agent_loop:         { icon: "🔁", color: "text-gray-400" },
  // communication
  notification_sent:  { icon: "📨", color: "text-cyan-400" },
  webhook_notify:     { icon: "🔔", color: "text-cyan-400" },
  note:               { icon: "📝", color: "text-gray-300" },
  // fixes / bulk
  fix:                { icon: "🔧", color: "text-orange-400" },
  fts_fix:            { icon: "🔧", color: "text-orange-400" },
  bulk_priority:      { icon: "⚡", color: "text-yellow-400" },
  issue_created:      { icon: "✨", color: "text-green-400" },
  subtasks:           { icon: "📋", color: "text-gray-300" },
  subtasks_added:     { icon: "📋", color: "text-gray-300" },
  subtask_breakdown:  { icon: "📋", color: "text-gray-300" },
};

const ALL_AGENTS = ["kai", "alma", "tina", "vicky", "stella", "hunter", "pieter"];

function getActionIcon(action: string) {
  return ACTION_ICONS[action] ?? { icon: "⚙️", color: "text-gray-500" };
}

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

function isActive(lastActive: string | undefined): boolean {
  if (!lastActive) return false;
  const then = new Date(lastActive + (lastActive.includes("Z") ? "" : "Z")).getTime();
  return Date.now() - then < 5 * 60 * 1000;
}

function actionLabel(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const PAGE_SIZE = 50;

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [agentFilter, setAgentFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [live, setLive] = useState(true);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const prevIdsRef = useRef<Set<number>>(new Set());
  const { subscribe, connected } = useEvents();

  const fetchData = useCallback(async (off = 0) => {
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
      if (agentFilter !== "all") params.set("agent", agentFilter);
      if (projectFilter !== "all") params.set("project", projectFilter);
      const res = await fetch(`/api/activity?${params}`);
      const data = await res.json();
      const logs = data.logs as ActivityEntry[];
      setAgentStatuses(data.agents || []);
      setProjects(data.projects || []);
      setTotal(data.total ?? logs.length);

      if (off === 0) {
        // Detect new entries for animation
        const currentIds = new Set(logs.map((l: ActivityEntry) => l.id));
        const fresh = new Set<number>();
        for (const id of currentIds) {
          if (!prevIdsRef.current.has(id)) fresh.add(id);
        }
        prevIdsRef.current = currentIds;
        if (fresh.size > 0 && fresh.size < logs.length) {
          setNewIds(fresh);
          setTimeout(() => setNewIds(new Set()), 600);
        }
        setEntries(logs);
      } else {
        setEntries(prev => [...prev, ...logs]);
      }
    } catch {}
  }, [agentFilter, projectFilter]);

  useEffect(() => {
    setOffset(0);
    fetchData(0);
  }, [fetchData]);

  // SSE live updates
  useEffect(() => {
    if (!live) return;
    return subscribe("activity_logged", () => {
      fetchData(0);
    });
  }, [live, subscribe, fetchData]);

  const loadMore = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchData(newOffset);
  };

  const statusMap = Object.fromEntries(agentStatuses.map(a => [a.agent, a.last_active]));

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold gradient-text">📋 Activity Feed</h1>
          <p className="text-gray-500 mt-1">Chronological timeline of agent actions &amp; issue changes</p>
        </div>
        <button
          onClick={() => setLive(!live)}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            live
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-gray-700/50 text-gray-400 border border-gray-600/30"
          }`}
        >
          {live && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
          )}
          {!live && <span className="h-2.5 w-2.5 rounded-full bg-gray-500"></span>}
          {live ? (connected ? "Live (SSE)" : "Connecting...") : "Paused"}
        </button>
      </div>

      {/* Filters row */}
      <div className="glass p-4 space-y-3">
        {/* Agent filter */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Agent</p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setAgentFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                agentFilter === "all" ? "bg-white/10 ring-1 ring-white/20 text-white" : "text-gray-400 hover:bg-white/5"
              }`}
            >
              All
            </button>
            {ALL_AGENTS.map(agent => {
              const meta = AGENT_META[agent] || AGENT_META.system;
              const active = isActive(statusMap[agent]);
              return (
                <div key={agent} className="flex items-center gap-1">
                  <button
                    onClick={() => setAgentFilter(agentFilter === agent ? "all" : agent)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                      agentFilter === agent
                        ? "bg-white/10 ring-1 ring-white/20"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <span className="text-base">{meta.emoji}</span>
                    <span className="text-gray-300 capitalize">{agent}</span>
                    <span className={`h-2 w-2 rounded-full ${active ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-gray-600"}`}></span>
                  </button>
                  <Link
                    href={`/activity/agent/${agent}`}
                    className="text-[10px] text-gray-600 hover:text-gray-400 px-1 transition-colors"
                    title={`${agent} profile`}
                  >
                    ↗
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Project filter */}
        {projects.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Project</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setProjectFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  projectFilter === "all" ? "bg-white/10 ring-1 ring-white/20 text-white" : "text-gray-400 hover:bg-white/5"
                }`}
              >
                All Projects
              </button>
              {projects.map(proj => (
                <button
                  key={proj}
                  onClick={() => setProjectFilter(projectFilter === proj ? "all" : proj)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    projectFilter === proj
                      ? "bg-indigo-500/20 ring-1 ring-indigo-500/40 text-indigo-300"
                      : "text-gray-400 hover:bg-white/5"
                  }`}
                >
                  {proj}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active filter summary */}
        {(agentFilter !== "all" || projectFilter !== "all") && (
          <div className="flex items-center gap-2 pt-1 border-t border-white/5">
            <span className="text-xs text-gray-500">Filtering:</span>
            {agentFilter !== "all" && (
              <span className="text-xs bg-white/5 px-2 py-0.5 rounded text-gray-300">
                agent: {agentFilter}
              </span>
            )}
            {projectFilter !== "all" && (
              <span className="text-xs bg-indigo-500/10 px-2 py-0.5 rounded text-indigo-300">
                project: {projectFilter}
              </span>
            )}
            <button
              onClick={() => { setAgentFilter("all"); setProjectFilter("all"); }}
              className="text-xs text-gray-600 hover:text-gray-300 ml-auto"
            >
              Clear all ✕
            </button>
          </div>
        )}
      </div>

      {/* Count */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>Showing {entries.length} of {total} entries</span>
      </div>

      {/* Timeline feed */}
      <div className="relative">
        {/* Vertical line */}
        {entries.length > 0 && (
          <div className="absolute left-[22px] top-2 bottom-2 w-px bg-white/5 pointer-events-none" />
        )}

        <div className="space-y-1.5">
          {entries.map(entry => {
            const agentMeta = AGENT_META[entry.agent] || AGENT_META.system;
            const actionIcon = getActionIcon(entry.action);
            const isNew = newIds.has(entry.id);
            return (
              <div
                key={entry.id}
                className={`relative flex items-start gap-3 group ${
                  isNew ? "animate-slide-down" : ""
                }`}
              >
                {/* Timeline node — action icon */}
                <div className={`relative z-10 flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-gray-900 border border-white/5 group-hover:border-white/10 transition-all ${isNew ? "border-green-500/50" : ""}`}>
                  <span className={`text-base ${actionIcon.color}`}>{actionIcon.icon}</span>
                </div>

                {/* Card */}
                <div className={`flex-1 glass p-3.5 hover:bg-white/[0.03] transition-all mb-1 ${
                  isNew ? "border-l-2 border-green-500/50" : ""
                }`}>
                  <div className="flex items-start gap-2 justify-between">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-base">{agentMeta.emoji}</span>
                      <span className="text-sm font-medium text-white capitalize">{entry.agent}</span>
                      <span className="text-sm text-gray-400">{actionLabel(entry.action)}</span>
                      {entry.issue_id && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-500 font-mono shrink-0">
                          {entry.issue_id}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 shrink-0 whitespace-nowrap ml-2">
                      {relativeTime(entry.created_at)}
                    </div>
                  </div>
                  {entry.detail && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{entry.detail}</p>
                  )}
                </div>
              </div>
            );
          })}

          {entries.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <p className="text-4xl mb-3">📭</p>
              <p>No activity found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Load more */}
      {entries.length < total && (
        <div className="flex justify-center pb-8">
          <button
            onClick={loadMore}
            className="px-6 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm transition-all border border-white/5"
          >
            Load more ({total - entries.length} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
