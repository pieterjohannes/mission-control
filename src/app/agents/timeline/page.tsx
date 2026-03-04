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

const AGENT_META: Record<string, { emoji: string; color: string; label: string; badgeClass: string }> = {
  kai:    { emoji: "🚀", color: "purple", label: "Kai",    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  alma:   { emoji: "💜", color: "pink",   label: "Alma",   badgeClass: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
  tina:   { emoji: "🏠", color: "emerald",label: "Tina",   badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  vicky:  { emoji: "📖", color: "amber",  label: "Vicky",  badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  stella: { emoji: "⭐", color: "yellow", label: "Stella", badgeClass: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  hunter: { emoji: "🎯", color: "red",    label: "Hunter", badgeClass: "bg-red-500/20 text-red-300 border-red-500/30" },
  pieter: { emoji: "👤", color: "blue",   label: "Pieter", badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  system: { emoji: "⚙️", color: "gray",   label: "System", badgeClass: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
};

const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  create_issue:         { icon: "✨", color: "text-green-400" },
  spawn:                { icon: "🌱", color: "text-green-400" },
  spawn_subagent:       { icon: "🌱", color: "text-green-400" },
  spawned_subagent:     { icon: "🌱", color: "text-green-400" },
  subagent_spawned:     { icon: "🌱", color: "text-green-400" },
  proposed_issue:       { icon: "💡", color: "text-yellow-400" },
  proposed:             { icon: "💡", color: "text-yellow-400" },
  proposed_improvement: { icon: "💡", color: "text-yellow-400" },
  completed:            { icon: "✅", color: "text-emerald-400" },
  complete:             { icon: "✅", color: "text-emerald-400" },
  issue_completed:      { icon: "✅", color: "text-emerald-400" },
  closed_issue:         { icon: "🔒", color: "text-gray-400" },
  task_completed:       { icon: "✅", color: "text-emerald-400" },
  status_change:        { icon: "🔄", color: "text-blue-400" },
  assignee_change:      { icon: "👤", color: "text-blue-400" },
  assign:               { icon: "👤", color: "text-blue-400" },
  assigned:             { icon: "👤", color: "text-blue-400" },
  pickup:               { icon: "🫴", color: "text-indigo-400" },
  picked_up:            { icon: "🫴", color: "text-indigo-400" },
  resume:               { icon: "▶️",  color: "text-indigo-400" },
  cron_run:             { icon: "⏰", color: "text-gray-400" },
  heartbeat:            { icon: "💓", color: "text-pink-400" },
  nightly_review:       { icon: "🌙", color: "text-purple-400" },
  agent_loop:           { icon: "🔁", color: "text-gray-400" },
  notification_sent:    { icon: "📨", color: "text-cyan-400" },
  webhook_notify:       { icon: "🔔", color: "text-cyan-400" },
  note:                 { icon: "📝", color: "text-gray-300" },
  fix:                  { icon: "🔧", color: "text-orange-400" },
  fts_fix:              { icon: "🔧", color: "text-orange-400" },
  bulk_priority:        { icon: "⚡", color: "text-yellow-400" },
  issue_created:        { icon: "✨", color: "text-green-400" },
  subtasks:             { icon: "📋", color: "text-gray-300" },
  subtasks_added:       { icon: "📋", color: "text-gray-300" },
  subtask_breakdown:    { icon: "📋", color: "text-gray-300" },
  working:              { icon: "⚙️", color: "text-blue-400" },
  idle:                 { icon: "😴", color: "text-gray-500" },
  comment:              { icon: "💬", color: "text-cyan-300" },
};

const ALL_AGENTS = ["kai", "alma", "tina", "vicky", "stella", "hunter", "pieter", "system"];
const PAGE_SIZE = 50;

function getActionIcon(action: string) {
  return ACTION_ICONS[action] ?? { icon: "⚙️", color: "text-gray-500" };
}

function actionLabel(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
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

function formatAbsoluteTime(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes("Z") ? "" : "Z"));
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AgentTimelinePage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [agentFilter, setAgentFilter] = useState("all");
  const [live, setLive] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const prevIdsRef = useRef<Set<number>>(new Set());
  const { subscribe, connected } = useEvents();

  const fetchData = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
      if (agentFilter !== "all") params.set("agent", agentFilter);
      const res = await fetch(`/api/activity?${params}`);
      const data = await res.json();
      const logs: ActivityEntry[] = data.logs ?? data;
      setTotal(data.total ?? logs.length);

      if (off === 0) {
        const currentIds = new Set(logs.map((l) => l.id));
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
    } catch { /* silent */ }
    setLoading(false);
  }, [agentFilter]);

  useEffect(() => {
    setOffset(0);
    fetchData(0);
  }, [fetchData]);

  useEffect(() => {
    if (!live) return;
    return subscribe("activity_logged", () => fetchData(0));
  }, [live, subscribe, fetchData]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start md:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold gradient-text">🤖 Agent Timeline</h1>
          <p className="text-gray-500 mt-1">Chronological feed of every agent action</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Live toggle */}
          <button
            onClick={() => setLive(!live)}
            className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${
              live
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-gray-700/50 text-gray-400 border border-gray-600/30"
            }`}
          >
            {live ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-gray-500"></span>
            )}
            {live ? (connected ? "Live" : "Connecting…") : "Paused"}
          </button>
        </div>
      </div>

      {/* Agent filter pills + dropdown */}
      <div className="glass p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mr-1">Filter:</span>
          <button
            onClick={() => setAgentFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              agentFilter === "all"
                ? "bg-white/15 text-white border-white/20"
                : "bg-white/5 text-gray-400 border-white/10 hover:text-gray-200"
            }`}
          >
            All agents
          </button>
          {ALL_AGENTS.map(agent => {
            const meta = AGENT_META[agent];
            return (
              <button
                key={agent}
                onClick={() => setAgentFilter(agentFilter === agent ? "all" : agent)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  agentFilter === agent
                    ? meta.badgeClass + " border"
                    : "bg-white/5 text-gray-400 border-white/10 hover:text-gray-200"
                }`}
              >
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {loading && entries.length === 0 ? (
          <div className="glass p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="glass p-8 text-center text-gray-500 text-sm">No activity found.</div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[22px] top-0 bottom-0 w-px bg-white/5 hidden md:block" />

            <div className="space-y-1">
              {entries.map((entry) => {
                const meta = AGENT_META[entry.agent] ?? { emoji: "🤖", label: entry.agent, badgeClass: "bg-gray-500/20 text-gray-300 border-gray-500/30" };
                const { icon, color } = getActionIcon(entry.action);
                const isNew = newIds.has(entry.id);
                return (
                  <div
                    key={entry.id}
                    className={`flex gap-3 md:gap-4 p-3 rounded-xl border transition-all duration-300 ${
                      isNew
                        ? "border-purple-500/40 bg-purple-500/5 scale-[1.01]"
                        : "border-transparent hover:border-white/10 hover:bg-white/[0.02]"
                    }`}
                  >
                    {/* Timeline dot (md+) */}
                    <div className="hidden md:flex items-start pt-1 w-[30px] shrink-0 justify-center">
                      <span className={`text-base z-10 ${color}`}>{icon}</span>
                    </div>

                    {/* Agent badge */}
                    <div className="shrink-0 pt-0.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.badgeClass}`}>
                        <span>{meta.emoji}</span>
                        <span>{meta.label}</span>
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="md:hidden text-sm">{icon}</span>
                        <span className="text-sm font-medium text-gray-200">{actionLabel(entry.action)}</span>
                        {entry.issue_id && (
                          <Link
                            href={`/?issue=${entry.issue_id}`}
                            className="text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-purple-300 hover:text-purple-200 hover:border-purple-500/30 transition font-mono"
                          >
                            {entry.issue_id}
                          </Link>
                        )}
                      </div>
                      {entry.detail && (
                        <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">{entry.detail}</p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="shrink-0 text-right">
                      <span className="text-xs text-gray-500" title={formatAbsoluteTime(entry.created_at)}>
                        {relativeTime(entry.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Load more */}
        {entries.length < total && (
          <div className="text-center pt-2">
            <button
              onClick={() => { const off = offset + PAGE_SIZE; setOffset(off); fetchData(off); }}
              className="px-6 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-gray-200 hover:bg-white/8 transition"
            >
              Load more ({total - entries.length} remaining)
            </button>
          </div>
        )}
      </div>

      {/* Footer stats */}
      {!loading && entries.length > 0 && (
        <p className="text-center text-xs text-gray-600">
          Showing {entries.length} of {total} entries
          {agentFilter !== "all" && ` · filtered by ${AGENT_META[agentFilter]?.label ?? agentFilter}`}
        </p>
      )}
    </div>
  );
}
