"use client";

import { useState, useEffect } from "react";

interface Issue {
  id: string;
  title: string;
  status: string;
  project?: string | null;
}

interface DependencyDagProps {
  currentIssue: Issue;
  blockers: Issue[];
  blockedBy: Issue[];
  onNodeClick?: (issueId: string) => void;
}

function DependencyDag({ currentIssue, blockers, blockedBy, onNodeClick }: DependencyDagProps) {
  const nodeWidth = 160;
  const nodeHeight = 44;
  const hGap = 24;
  const vGap = 64;

  const totalNodes = Math.max(blockers.length, blockedBy.length, 1);
  const svgWidth = Math.max(nodeWidth + 40, totalNodes * (nodeWidth + hGap) + 40);
  const svgHeight = nodeHeight * 3 + vGap * 2 + 20;

  const centerX = svgWidth / 2;
  const centerY = nodeHeight / 2 + 10 + vGap;

  function nodeX(idx: number, total: number) {
    const totalW = total * nodeWidth + (total - 1) * hGap;
    return centerX - totalW / 2 + idx * (nodeWidth + hGap);
  }

  const statusColor = (status: string) => {
    if (status === "done") return { fill: "#064e3b", stroke: "#10b981", text: "#6ee7b7" };
    if (status === "in_progress") return { fill: "#451a03", stroke: "#f59e0b", text: "#fcd34d" };
    if (status === "review") return { fill: "#3b0764", stroke: "#a855f7", text: "#d8b4fe" };
    return { fill: "#111827", stroke: "#374151", text: "#9ca3af" };
  };

  const hasNodes = blockers.length > 0 || blockedBy.length > 0;
  if (!hasNodes) return null;

  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-gray-950/60 p-2">
      <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1 px-1">Dependency Graph</p>
      <svg width={svgWidth} height={svgHeight} className="block mx-auto">
        <defs>
          <marker id="arrow-red" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#f87171" />
          </marker>
          <marker id="arrow-orange" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#fb923c" />
          </marker>
        </defs>

        {/* Blocker nodes (top row) */}
        {blockers.map((issue, i) => {
          const x = nodeX(i, Math.max(blockers.length, 1));
          const y = 10;
          const c = statusColor(issue.status);
          const fromX = x + nodeWidth / 2;
          const fromY = y + nodeHeight;
          return (
            <g key={`blocker-${issue.id}`}>
              <line
                x1={fromX} y1={fromY}
                x2={centerX} y2={centerY - nodeHeight / 2 - 6}
                stroke="#f87171" strokeWidth="1.5" strokeDasharray="4,3"
                markerEnd="url(#arrow-red)"
              />
              <rect x={x} y={y} width={nodeWidth} height={nodeHeight}
                rx="8" fill={c.fill} stroke={c.stroke} strokeWidth="1.5"
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onNodeClick?.(issue.id)}
              />
              <text x={x + nodeWidth / 2} y={y + 14} textAnchor="middle"
                fill="#f87171" fontSize="9" fontFamily="monospace">
                {issue.id}
              </text>
              <text x={x + nodeWidth / 2} y={y + 29} textAnchor="middle"
                fill={c.text} fontSize="10" fontFamily="sans-serif">
                {issue.title.length > 18 ? issue.title.slice(0, 17) + "…" : issue.title}
              </text>
            </g>
          );
        })}

        {/* Center node (current issue) */}
        <rect
          x={centerX - nodeWidth / 2} y={centerY - nodeHeight / 2}
          width={nodeWidth} height={nodeHeight}
          rx="8" fill="#1e1b4b" stroke="#818cf8" strokeWidth="2"
        />
        <text x={centerX} y={centerY - 6} textAnchor="middle"
          fill="#a5b4fc" fontSize="9" fontFamily="monospace">
          {currentIssue.id}
        </text>
        <text x={centerX} y={centerY + 10} textAnchor="middle"
          fill="#e0e7ff" fontSize="10" fontFamily="sans-serif">
          {currentIssue.title.length > 18 ? currentIssue.title.slice(0, 17) + "…" : currentIssue.title}
        </text>
        <text x={centerX} y={centerY + 22} textAnchor="middle"
          fill="#6366f1" fontSize="8" fontFamily="sans-serif">
          ← current issue →
        </text>

        {/* Blocked-by nodes (bottom row) */}
        {blockedBy.map((issue, i) => {
          const x = nodeX(i, Math.max(blockedBy.length, 1));
          const y = centerY + nodeHeight / 2 + vGap;
          const c = statusColor(issue.status);
          const toX = x + nodeWidth / 2;
          const toY = y;
          return (
            <g key={`blocked-${issue.id}`}>
              <line
                x1={centerX} y1={centerY + nodeHeight / 2 + 6}
                x2={toX} y2={toY - 6}
                stroke="#fb923c" strokeWidth="1.5" strokeDasharray="4,3"
                markerEnd="url(#arrow-orange)"
              />
              <rect x={x} y={y} width={nodeWidth} height={nodeHeight}
                rx="8" fill={c.fill} stroke={c.stroke} strokeWidth="1.5"
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onNodeClick?.(issue.id)}
              />
              <text x={x + nodeWidth / 2} y={y + 14} textAnchor="middle"
                fill="#fb923c" fontSize="9" fontFamily="monospace">
                {issue.id}
              </text>
              <text x={x + nodeWidth / 2} y={y + 29} textAnchor="middle"
                fill={c.text} fontSize="10" fontFamily="sans-serif">
                {issue.title.length > 18 ? issue.title.slice(0, 17) + "…" : issue.title}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 mt-1 px-2 pb-1">
        <div className="flex items-center gap-1">
          <div className="w-4 h-px bg-red-400" style={{ borderTop: "1.5px dashed #f87171" }} />
          <span className="text-[9px] text-gray-600">blocks this</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-px" style={{ borderTop: "1.5px dashed #fb923c" }} />
          <span className="text-[9px] text-gray-600">this blocks</span>
        </div>
      </div>
    </div>
  );
}

interface DependencyPanelProps {
  issueId: string;
  issueTitle?: string;
  allIssues?: Issue[];
  onLinkClick?: (issueId: string) => void;
}

export default function DependencyPanel({ issueId, issueTitle = issueId, allIssues = [], onLinkClick }: DependencyPanelProps) {
  const [blockers, setBlockers] = useState<Issue[]>([]);
  const [blockedBy, setBlockedBy] = useState<Issue[]>([]);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState<"blocker" | "blocking" | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDag, setShowDag] = useState(true);

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

  const LinkRow = ({ issue, onRemove }: { issue: Issue; onRemove: () => void }) => (
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

  const currentIssue: Issue = { id: issueId, title: issueTitle, status: "in_progress" };
  const hasLinks = blockers.length > 0 || blockedBy.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-gray-500">⛓ Dependencies</label>
        {hasLinks && (
          <button
            onClick={() => setShowDag((v) => !v)}
            className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
          >
            {showDag ? "Hide graph" : "Show graph"}
          </button>
        )}
      </div>

      {/* SVG DAG */}
      {showDag && hasLinks && (
        <DependencyDag
          currentIssue={currentIssue}
          blockers={blockers}
          blockedBy={blockedBy}
          onNodeClick={onLinkClick}
        />
      )}

      {/* Blocked by (blockers) */}
      <div className="mb-3 mt-3">
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
            onClick={() => { setShowPicker("blocker"); setSearch(""); }}
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
            onClick={() => { setShowPicker("blocking"); setSearch(""); }}
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
            <button onClick={() => setShowPicker(null)} className="text-gray-600 hover:text-gray-300 text-xs">
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
                onClick={() => showPicker === "blocker" ? addBlocker(i.id) : addBlocking(i.id)}
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
