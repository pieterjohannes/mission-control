"use client";
import { useEffect, useState, useCallback } from "react";
import type { WorkloadResponse, AgentWorkload, UnassignedIssue } from "@/app/api/agents/workload/route";

const agentEmoji: Record<string, string> = {
  kai: "🤖", pieter: "👤", alma: "💜", marco: "📊", bea: "🎨",
  rex: "🦖", viktor: "🛡️", dev: "💻", luna: "🌙", max: "⚡",
};

const agentColors: Record<string, string> = {
  kai: "from-purple-500/20 to-purple-500/5 border-purple-500/30",
  pieter: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
  alma: "from-pink-500/20 to-pink-500/5 border-pink-500/30",
  marco: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
  bea: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
  rex: "from-orange-500/20 to-orange-500/5 border-orange-500/30",
  viktor: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
  dev: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/30",
  luna: "from-violet-500/20 to-violet-500/5 border-violet-500/30",
  max: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30",
};

const priorityColors: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10",
  high: "text-orange-400 bg-orange-400/10",
  medium: "text-yellow-400 bg-yellow-400/10",
  low: "text-gray-400 bg-gray-400/10",
};

function SlotBar({ filled, max }: { filled: number; max: number }) {
  return (
    <div className="flex gap-1 mt-2">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full transition-all ${
            i < filled
              ? "bg-purple-500"
              : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentWorkload }) {
  const emoji = agentEmoji[agent.agent] || "🤖";
  const colors = agentColors[agent.agent] || "from-gray-500/20 to-gray-500/5 border-gray-500/30";
  const utilPct = Math.round(agent.utilization * 100);

  return (
    <div className={`bg-gradient-to-br ${colors} border rounded-2xl p-4`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <span className="font-semibold capitalize text-white">{agent.agent}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          agent.available > 0 ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"
        }`}>
          {agent.available > 0 ? `${agent.available} free` : "full"}
        </span>
      </div>

      <p className="text-xs text-gray-400 mb-2">
        {agent.inProgress}/{agent.maxSlots} slots · {utilPct}% utilized
      </p>

      <SlotBar filled={agent.inProgress} max={agent.maxSlots} />

      {agent.specializations.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {agent.specializations.slice(0, 4).map(s => (
            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function UnassignedIssueRow({
  issue,
  onAssign,
  assigning,
}: {
  issue: UnassignedIssue;
  onAssign: (issueId: string, agent: string) => Promise<void>;
  assigning: string | null;
}) {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = async () => {
    if (!issue.suggestedAgent) return;
    setAccepted(true);
    await onAssign(issue.id, issue.suggestedAgent);
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      accepted ? "opacity-40 border-white/5" : "border-white/10 hover:border-white/20 bg-white/2"
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${
            priorityColors[issue.priority] || priorityColors.medium
          }`}>
            {issue.priority}
          </span>
          <span className="text-xs text-gray-500 font-mono">{issue.id}</span>
        </div>
        <p className="text-sm text-white truncate">{issue.title}</p>
        {issue.project && (
          <p className="text-xs text-gray-500 mt-0.5">{issue.project}</p>
        )}
      </div>

      {issue.suggestedAgent ? (
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-gray-500">suggested</p>
            <p className="text-sm font-medium text-white capitalize flex items-center gap-1">
              {agentEmoji[issue.suggestedAgent] || "🤖"} {issue.suggestedAgent}
            </p>
          </div>
          <button
            onClick={handleAccept}
            disabled={accepted || assigning === issue.id}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {accepted ? "✓" : assigning === issue.id ? "…" : "Assign"}
          </button>
        </div>
      ) : (
        <span className="text-xs text-gray-600 shrink-0">No agents available</span>
      )}
    </div>
  );
}

export default function WorkloadView() {
  const [data, setData] = useState<WorkloadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    fetch("/api/agents/workload")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAssign = async (issueId: string, agent: string) => {
    setAssigning(issueId);
    try {
      await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee: agent }),
      });
      // Refresh after short delay
      setTimeout(fetchData, 500);
    } finally {
      setAssigning(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <p className="text-gray-500 text-sm">Failed to load workload data.</p>;

  const unassigned = data.unassignedIssues.filter(i => i.suggestedAgent !== null || true);

  return (
    <div className="space-y-6">
      {/* Agent capacity grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Agent Capacity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.agents.map(agent => (
            <AgentCard key={agent.agent} agent={agent} />
          ))}
        </div>
      </div>

      {/* Unassigned issues with suggestions */}
      {unassigned.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Unassigned Issues
            <span className="ml-2 text-xs font-normal normal-case text-gray-600">
              — auto-suggestions based on capacity & specialization
            </span>
          </h2>
          <div className="space-y-2">
            {unassigned.map(issue => (
              <UnassignedIssueRow
                key={issue.id}
                issue={issue}
                onAssign={handleAssign}
                assigning={assigning}
              />
            ))}
          </div>
        </div>
      )}

      {unassigned.length === 0 && (
        <p className="text-sm text-gray-500 italic">No unassigned issues — all clear! 🎉</p>
      )}
    </div>
  );
}
