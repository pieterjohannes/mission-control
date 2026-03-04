"use client";

import { useState, useEffect } from "react";

interface Issue {
  id: string;
  title: string;
  status: string;
  project?: string | null;
}

interface DependencySelectorProps {
  issueId: string;
  allIssues?: Issue[];
  onLinkClick?: (issueId: string) => void;
}

export default function DependencySelector({ issueId, allIssues = [], onLinkClick }: DependencySelectorProps) {
  const [blockers, setBlockers] = useState<Issue[]>([]);
  const [blockedBy, setBlockedBy] = useState<Issue[]>([]);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState<"blocker" | "blocking" | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/issues/${issueId}/dependencies`);
    const data = await res.json();
    setBlockers(data.blockers || []);
    setBlockedBy(data.blocked_by || []);
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  const linkedIds = new Set([
    ...blockers.map((i) => i.id),
    ...blockedBy.map((i) => i.id),
    issueId,
  ]);

  const filteredIssues = allIssues
    .filter(
      (i) =>
        !linkedIds.has(i.id) &&
        (search === "" ||
          i.title.toLowerCase().includes(search.toLowerCase()) ||
          i.id.toLowerCase().includes(search.toLowerCase()))
    )
    .slice(0, 8);

  const addBlocker = async (blockerId: string) => {
    setLoading(true);
    await fetch(`/api/issues/${issueId}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocker_id: blockerId }),
    });
    setLoading(false);
    setShowPicker(null);
    setSearch("");
    load();
  };

  const addBlocking = async (targetId: string) => {
    // This issue blocks targetId → add dependency where this issue is the blocker for targetId
    setLoading(true);
    await fetch(`/api/issues/${targetId}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocker_id: issueId }),
    });
    setLoading(false);
    setShowPicker(null);
    setSearch("");
    load();
  };

  const removeBlocker = async (blockerId: string) => {
    await fetch(`/api/issues/${issueId}/dependencies/${blockerId}`, { method: "DELETE" });
    load();
  };

  const removeBlocking = async (targetId: string) => {
    await fetch(`/api/issues/${targetId}/dependencies/${issueId}`, { method: "DELETE" });
    load();
  };

  const statusDot = (status: string) => {
    if (status === "done") return "text-emerald-400 bg-emerald-500/10";
    if (status === "in_progress") return "text-amber-400 bg-amber-500/10";
    return "text-gray-500 bg-white/5";
  };

  const LinkRow = ({
    issue,
    onRemove,
  }: {
    issue: Issue;
    onRemove: () => void;
  }) => (
    <div className="flex items-center gap-2 group/lr py-1">
      <button
        onClick={() => onLinkClick?.(issue.id)}
        className="text-[10px] font-mono text-purple-400 hover:text-purple-300 shrink-0 transition-colors"
        title="Open issue"
      >
        {issue.id}
      </button>
      <span className="text-xs text-gray-300 flex-1 truncate">{issue.title}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${statusDot(issue.status)}`}>
        {issue.status}
      </span>
      <button
        onClick={onRemove}
        className="text-gray-600 hover:text-red-400 opacity-0 group-hover/lr:opacity-100 text-xs transition-opacity"
        title="Remove dependency"
      >
        ✕
      </button>
    </div>
  );

  return (
    <div>
      <label className="text-xs text-gray-500 mb-2 block">⛓ Dependencies</label>

      {/* Blocked by (blockers) */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-red-400 font-medium">
            🚫 Blocked by
            {blockers.filter((i) => i.status !== "done").length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px]">
                {blockers.filter((i) => i.status !== "done").length} open
              </span>
            )}
          </span>
          <button
            onClick={() => {
              setShowPicker("blocker");
              setSearch("");
            }}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            + Add blocker
          </button>
        </div>
        {blockers.length === 0 ? (
          <p className="text-xs text-gray-600 italic">No blockers</p>
        ) : (
          <div className="space-y-0.5">
            {blockers.map((i) => (
              <LinkRow key={i.id} issue={i} onRemove={() => removeBlocker(i.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Blocking (issues this one blocks) */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-orange-400 font-medium">⏩ Blocking</span>
          <button
            onClick={() => {
              setShowPicker("blocking");
              setSearch("");
            }}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            + Add
          </button>
        </div>
        {blockedBy.length === 0 ? (
          <p className="text-xs text-gray-600 italic">Not blocking any issues</p>
        ) : (
          <div className="space-y-0.5">
            {blockedBy.map((i) => (
              <LinkRow key={i.id} issue={i} onRemove={() => removeBlocking(i.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Issue picker */}
      {showPicker && (
        <div className="mt-2 bg-white/5 border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">
              {showPicker === "blocker" ? "Select issue that blocks this" : "Select issue this blocks"}
            </span>
            <button
              onClick={() => setShowPicker(null)}
              className="text-gray-600 hover:text-gray-300 text-xs"
            >
              ✕
            </button>
          </div>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or ID..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-purple-500/50 focus:outline-none mb-2"
          />
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {filteredIssues.length === 0 && (
              <p className="text-xs text-gray-600 italic">No matching issues</p>
            )}
            {filteredIssues.map((i) => (
              <button
                key={i.id}
                disabled={loading}
                onClick={() =>
                  showPicker === "blocker" ? addBlocker(i.id) : addBlocking(i.id)
                }
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/8 transition-colors"
              >
                <span className="text-[10px] font-mono text-gray-500 shrink-0">{i.id}</span>
                <span className="text-xs text-gray-300 flex-1 truncate">{i.title}</span>
                <span className="text-[10px] text-gray-600 shrink-0">{i.project || ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
