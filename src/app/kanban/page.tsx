"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import QuickAddModal from "@/components/QuickAddModal";
import TemplatesModal from "@/components/TemplatesModal";
import LabelPicker, { LabelChip, Label } from "@/components/LabelPicker";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import KeyboardShortcutsLegend from "@/components/KeyboardShortcutsLegend";
import { MarkdownEditor, MarkdownRenderer } from "@/components/MarkdownEditor";
import DependencyPanel from "@/components/DependencyPanel";
import IssueActivityTimeline from "@/components/IssueActivityTimeline";
import AgingBadge from "@/components/AgingBadge";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

type GroupBy = "status" | "assignee" | "priority" | "label";

interface Issue {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string | null;
  project: string | null;
  labels: string;
  description: string | null;
  position: number;
  days_since_update?: number | null;
  effort_size?: string | null;
}

interface BoardColumn {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

const STATUS_COLUMNS: BoardColumn[] = [
  { id: "backlog", label: "Backlog", emoji: "📋", color: "from-gray-500/20 to-gray-600/10 border-gray-500/20" },
  { id: "next", label: "Next", emoji: "⏭️", color: "from-blue-500/20 to-blue-600/10 border-blue-500/20" },
  { id: "in_progress", label: "In Progress", emoji: "🔄", color: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/20" },
  { id: "review", label: "Review", emoji: "🔍", color: "from-purple-500/20 to-purple-600/10 border-purple-500/20" },
  { id: "done", label: "Done", emoji: "✅", color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/20" },
];

// Keep COLUMNS as alias for backward compat
const COLUMNS = STATUS_COLUMNS;

const EFFORT_CONFIG: Record<string, { label: string; color: string }> = {
  XS: { label: "XS", color: "bg-sky-500/20 text-sky-400 border border-sky-500/30" },
  S:  { label: "S",  color: "bg-teal-500/20 text-teal-400 border border-teal-500/30" },
  M:  { label: "M",  color: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" },
  L:  { label: "L",  color: "bg-orange-500/20 text-orange-400 border border-orange-500/30" },
  XL: { label: "XL", color: "bg-red-500/20 text-red-400 border border-red-500/30" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: "Urgent", color: "bg-red-500/20 text-red-300 border-red-500/30", dot: "bg-red-400" },
  high: { label: "High", color: "bg-orange-500/20 text-orange-300 border-orange-500/30", dot: "bg-orange-400" },
  medium: { label: "Med", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", dot: "bg-yellow-400" },
  low: { label: "Low", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", dot: "bg-gray-500" },
};

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getAssigneeEmoji(assignee: string | null): string {
  if (!assignee) return "👤";
  const map: Record<string, string> = {
    kai: "🤖", pieter: "👨‍💻", alma: "💜", dev: "⚡", luna: "🌙",
  };
  return map[assignee.toLowerCase()] || assignee.slice(0, 2).toUpperCase();
}

function IssueCard({
  issue,
  isDragging,
  allLabels,
  onClick,
  dimmed,
  isBlocked,
  isSelected,
  onToggleSelect,
  anySelected,
  isFocused,
}: {
  issue: Issue;
  isDragging?: boolean;
  allLabels: Label[];
  onClick?: (e?: React.MouseEvent) => void;
  dimmed?: boolean;
  isBlocked?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  anySelected?: boolean;
  isFocused?: boolean;
}) {
  const priority = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium;
  let labelIds: string[] = [];
  try { labelIds = JSON.parse(issue.labels || "[]"); } catch { labelIds = []; }
  const labels = allLabels.filter((l) => labelIds.includes(l.id));

  return (
    <div
      onClick={onClick}
      className={`
        group/card relative rounded-xl border bg-gray-900/80 backdrop-blur-sm p-3 space-y-2
        border-white/10 hover:border-white/20 transition-all
        ${isDragging ? "opacity-50 scale-95" : ""}
        ${dimmed ? "opacity-30" : ""}
        ${isSelected ? "ring-2 ring-purple-500/60 border-purple-500/40" : ""}
        ${isFocused ? "ring-2 ring-blue-400/70 border-blue-400/50 shadow-lg shadow-blue-500/10" : ""}
        cursor-pointer
      `}
    >
      {/* Checkbox */}
      <div
        className={`absolute top-2 left-2 z-10 transition-opacity ${anySelected || isSelected ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"}`}
        onClick={onToggleSelect}
      >
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-purple-500 border-purple-400" : "bg-gray-800 border-white/20 hover:border-purple-400"}`}>
          {isSelected && <span className="text-white text-[10px] leading-none">✓</span>}
        </div>
      </div>

      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm text-gray-200 font-medium leading-snug flex-1 ${anySelected || isSelected ? "pl-5" : "group-hover/card:pl-5 transition-all"}`}>{issue.title}</p>
        <div
          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${priority.color}`}
          title={`Priority: ${priority.label}`}
        >
          <span className={`w-2 h-2 rounded-full ${priority.dot}`} />
        </div>
      </div>

      {isBlocked && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-medium">
            🚫 Blocked
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {issue.project && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20 font-medium">
            {issue.project}
          </span>
        )}
        {labels.slice(0, 3).map((label) => (
          <span
            key={label.id}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium"
            style={{
              backgroundColor: label.color + "22",
              borderColor: label.color + "55",
              color: label.color,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
            {label.name}
          </span>
        ))}
        {labels.length > 3 && (
          <span className="text-[10px] text-gray-500">+{labels.length - 3}</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-600 font-mono">{issue.id}</span>
          <AgingBadge status={issue.status} daysSinceUpdate={issue.days_since_update} compact />
          {issue.effort_size && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-sky-500/15 text-sky-400 border border-sky-500/25">
              {issue.effort_size}
            </span>
          )}
        </div>
        <div
          className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs"
          title={issue.assignee || "Unassigned"}
        >
          {getAssigneeEmoji(issue.assignee)}
        </div>
      </div>
    </div>
  );
}

function SortableCard({ issue, allLabels, onOpenDetail, activeFilterLabel, blockedIds, isSelected, onToggleSelect, anySelected, isFocused }: {
  issue: Issue;
  allLabels: Label[];
  onOpenDetail: (issue: Issue) => void;
  activeFilterLabel: string | null;
  blockedIds: Set<string>;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  anySelected: boolean;
  isFocused?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { issue, type: "card" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  let labelIds: string[] = [];
  try { labelIds = JSON.parse(issue.labels || "[]"); } catch { labelIds = []; }
  const dimmed = activeFilterLabel !== null && !labelIds.includes(activeFilterLabel);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <IssueCard
        issue={issue}
        allLabels={allLabels}
        onClick={(e) => {
          // Don't open detail if clicking checkbox area
          if ((e?.target as HTMLElement)?.closest?.("[data-checkbox]")) return;
          onOpenDetail(issue);
        }}
        dimmed={dimmed}
        isBlocked={blockedIds.has(issue.id)}
        isSelected={isSelected}
        anySelected={anySelected}
        isFocused={isFocused}
        onToggleSelect={(e) => { e.stopPropagation(); onToggleSelect(issue.id); }}
      />
    </div>
  );
}

function Column({
  column,
  issues,
  allLabels,
  onOpenDetail,
  activeFilterLabel,
  blockedIds,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  anySelected,
  focusedIssueId,
}: {
  column: BoardColumn;
  issues: Issue[];
  allLabels: Label[];
  onOpenDetail: (issue: Issue) => void;
  activeFilterLabel: string | null;
  blockedIds: Set<string>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (columnIssueIds: string[], selected: boolean) => void;
  anySelected: boolean;
  focusedIssueId?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  const columnIds = issues.map(i => i.id);
  const allColumnSelected = columnIds.length > 0 && columnIds.every(id => selectedIds.has(id));
  const someColumnSelected = columnIds.some(id => selectedIds.has(id));

  return (
    <div
      className={`
        flex flex-col rounded-2xl border bg-gradient-to-b ${column.color}
        backdrop-blur-sm min-w-[280px] max-w-[280px] h-full
        transition-all duration-200
        ${isOver ? "ring-2 ring-purple-400/40 scale-[1.01]" : ""}
      `}
    >
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Select-all checkbox for column */}
          <div
            className={`transition-opacity ${anySelected ? "opacity-100" : "opacity-0 hover:opacity-100"} cursor-pointer`}
            onClick={() => onSelectAll(columnIds, !allColumnSelected)}
            title={allColumnSelected ? "Deselect all in column" : "Select all in column"}
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${allColumnSelected ? "bg-purple-500 border-purple-400" : someColumnSelected ? "bg-purple-500/40 border-purple-400/60" : "bg-gray-800 border-white/20 hover:border-purple-400"}`}>
              {allColumnSelected ? <span className="text-white text-[10px] leading-none">✓</span> : someColumnSelected ? <span className="text-white text-[10px] leading-none">−</span> : null}
            </div>
          </div>
          <span className="text-lg">{column.emoji}</span>
          <h3 className="font-semibold text-sm text-gray-200">{column.label}</h3>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono">
          {issues.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 p-3 space-y-2 overflow-y-auto min-h-[100px]"
      >
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <SortableCard
              key={issue.id}
              issue={issue}
              allLabels={allLabels}
              onOpenDetail={onOpenDetail}
              activeFilterLabel={activeFilterLabel}
              blockedIds={blockedIds}
              isSelected={selectedIds.has(issue.id)}
              onToggleSelect={onToggleSelect}
              anySelected={anySelected}
              isFocused={focusedIssueId === issue.id}
            />
          ))}
        </SortableContext>

        {issues.length === 0 && (
          <div className="h-20 rounded-lg border-2 border-dashed border-white/5 flex items-center justify-center">
            <span className="text-xs text-gray-600">Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Bulk action toolbar shown at bottom when items are selected
function BulkActionToolbar({
  selectedCount,
  onClear,
  onBulkAction,
  allLabels,
}: {
  selectedCount: number;
  onClear: () => void;
  onBulkAction: (action: string, value: string) => Promise<void>;
  allLabels: Label[];
}) {
  const [showMove, setShowMove] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const [loading, setLoading] = useState(false);

  const AGENTS = ["kai", "pieter", "alma", "dev", "luna"];

  const handle = async (action: string, value: string) => {
    setLoading(true);
    setShowMove(false);
    setShowAssign(false);
    setShowLabel(false);
    try {
      await onBulkAction(action, value);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-gray-900/95 backdrop-blur-md border border-white/15 shadow-2xl shadow-black/50">
      <span className="text-sm font-semibold text-purple-300">{selectedCount} selected</span>
      <div className="w-px h-5 bg-white/10" />

      {/* Move */}
      <div className="relative">
        <button
          disabled={loading}
          onClick={() => { setShowMove(!showMove); setShowAssign(false); setShowLabel(false); }}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:bg-blue-600/50 transition disabled:opacity-50"
        >
          📦 Move to…
        </button>
        {showMove && (
          <div className="absolute bottom-full mb-2 left-0 bg-gray-900 border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[160px]">
            {STATUS_COLUMNS.map(col => (
              <button key={col.id} onClick={() => handle("status", col.id)}
                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2">
                <span>{col.emoji}</span><span>{col.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Assign */}
      <div className="relative">
        <button
          disabled={loading}
          onClick={() => { setShowAssign(!showAssign); setShowMove(false); setShowLabel(false); }}
          className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/50 transition disabled:opacity-50"
        >
          👤 Assign to…
        </button>
        {showAssign && (
          <div className="absolute bottom-full mb-2 left-0 bg-gray-900 border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[140px]">
            {AGENTS.map(agent => (
              <button key={agent} onClick={() => handle("assignee", agent)}
                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2">
                <span>{getAssigneeEmoji(agent)}</span><span className="capitalize">{agent}</span>
              </button>
            ))}
            <button onClick={() => handle("assignee", "")}
              className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-white/10 border-t border-white/5">
              🚫 Unassign
            </button>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="relative">
        <button
          disabled={loading || allLabels.length === 0}
          onClick={() => { setShowLabel(!showLabel); setShowMove(false); setShowAssign(false); }}
          className="text-xs px-3 py-1.5 rounded-lg bg-amber-600/30 border border-amber-500/40 text-amber-300 hover:bg-amber-600/50 transition disabled:opacity-50"
        >
          🏷️ Add label…
        </button>
        {showLabel && (
          <div className="absolute bottom-full mb-2 left-0 bg-gray-900 border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[160px] max-h-48 overflow-y-auto">
            {allLabels.map(label => (
              <button key={label.id} onClick={() => handle("label", label.id)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                <span style={{ color: label.color }}>{label.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <span className="text-xs text-gray-500 animate-pulse">Applying…</span>}

      <div className="w-px h-5 bg-white/10" />
      <button
        onClick={onClear}
        className="text-xs text-gray-500 hover:text-gray-300 transition px-2 py-1 rounded-lg hover:bg-white/5"
      >
        ✕ Clear
      </button>
    </div>
  );
}

function IssueDetailModal({
  issue,
  allLabels,
  allIssues,
  onClose,
  onLabelsChanged,
  onDescriptionChanged,
  onOpenOtherIssue,
}: {
  issue: Issue;
  allLabels: Label[];
  allIssues: Issue[];
  onClose: () => void;
  onLabelsChanged: (issueId: string, labelIds: string[]) => void;
  onDescriptionChanged?: (issueId: string, description: string) => void;
  onOpenOtherIssue?: (issue: Issue) => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(issue.description || "");
  const [savingDesc, setSavingDesc] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [timeData, setTimeData] = useState<{ total_sec: number; by_agent: Record<string, number> } | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [effortSize, setEffortSize] = useState(issue.effort_size || "");
  const SUBSCRIBER = "pieter";

  const updateEffortSize = async (size: string) => {
    setEffortSize(size);
    await fetch(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ effort_size: size || null }),
    });
  };

  useEffect(() => {
    fetch(`/api/issues/${issue.id}/time-log`)
      .then(r => r.json())
      .then(d => setTimeData({ total_sec: d.total_sec, by_agent: d.by_agent }))
      .catch(() => {});
  }, [issue.id]);

  useEffect(() => {
    fetch(`/api/issues/${issue.id}/subscribe`)
      .then(r => r.json())
      .then((subs: { subscriber: string }[]) => {
        setSubscribed(Array.isArray(subs) && subs.some(s => s.subscriber === SUBSCRIBER));
      })
      .catch(() => {});
  }, [issue.id]);

  const toggleSubscription = async () => {
    setSubLoading(true);
    try {
      await fetch(`/api/issues/${issue.id}/subscribe`, {
        method: subscribed ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriber: SUBSCRIBER }),
      });
      setSubscribed(!subscribed);
    } finally {
      setSubLoading(false);
    }
  };

  let labelIds: string[] = [];
  try { labelIds = JSON.parse(issue.labels || "[]"); } catch { labelIds = []; }

  const priority = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const saveDescription = async () => {
    setSavingDesc(true);
    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descValue.trim() || null }),
      });
      onDescriptionChanged?.(issue.id, descValue.trim());
      setEditingDesc(false);
    } finally {
      setSavingDesc(false);
    }
  };

  const enrichDescription = async () => {
    setEnriching(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/enrich`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const newDesc = data.issue?.description || "";
        setDescValue(newDesc);
        onDescriptionChanged?.(issue.id, newDesc);
      }
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-[10px] text-gray-500 font-mono mb-1">{issue.id}</p>
            <h2 className="text-lg font-semibold text-gray-100">{issue.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSubscription}
              disabled={subLoading}
              title={subscribed ? "Unsubscribe from notifications" : "Subscribe to notifications"}
              className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                subscribed
                  ? "bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30"
                  : "bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10"
              } disabled:opacity-50`}
            >
              {subscribed ? "🔔 Watching" : "🔕 Watch"}
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 text-xl leading-none mt-1"
            >
              ×
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-xs px-2 py-1 rounded-lg border ${priority.color}`}>
            {priority.label}
          </span>
          {issue.project && (
            <span className="text-xs px-2 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/20">
              {issue.project}
            </span>
          )}
          {issue.assignee && (
            <span className="text-xs text-gray-400">
              {getAssigneeEmoji(issue.assignee)} {issue.assignee}
            </span>
          )}
          <span className="text-xs text-gray-500 capitalize">{issue.status.replace("_", " ")}</span>
          {issue.days_since_update != null && (
            <span className="text-xs text-gray-500">
              🕐 Last updated {issue.days_since_update}d ago
            </span>
          )}
          <AgingBadge status={issue.status} daysSinceUpdate={issue.days_since_update} />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Description</p>
            <div className="flex items-center gap-2">
              <button
                onClick={enrichDescription}
                disabled={enriching}
                title="AI-enrich this issue with context, acceptance criteria, and subtasks"
                className="text-xs px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 transition-colors disabled:opacity-50"
              >
                {enriching ? "✨ Enriching…" : "✨ Enrich"}
              </button>
              {!editingDesc && (
                <button
                  onClick={() => setEditingDesc(true)}
                  className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
                >
                  ✏️ Edit
                </button>
              )}
            </div>
          </div>
          {editingDesc ? (
            <div className="space-y-2">
              <MarkdownEditor
                value={descValue}
                onChange={setDescValue}
                rows={8}
              />
              <div className="flex gap-2">
                <button
                  onClick={saveDescription}
                  disabled={savingDesc}
                  className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {savingDesc ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => { setEditingDesc(false); setDescValue(issue.description || ""); }}
                  className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : descValue ? (
            <div
              className="cursor-pointer rounded-lg p-2 hover:bg-white/5 transition-colors"
              onClick={() => setEditingDesc(true)}
              title="Click to edit"
            >
              <MarkdownRenderer content={descValue} />
            </div>
          ) : (
            <button
              onClick={() => setEditingDesc(true)}
              className="text-sm text-gray-600 italic hover:text-gray-400 transition-colors"
            >
              + Add description
            </button>
          )}
        </div>

        {/* Labels */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Labels</p>
          <LabelPicker
            issueId={issue.id}
            currentLabelIds={labelIds}
            allLabels={allLabels}
            onChange={(ids) => onLabelsChanged(issue.id, ids)}
          />
        </div>

        {/* Effort Size */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Effort Size</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {["XS", "S", "M", "L", "XL"].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => updateEffortSize(size)}
                className={`text-xs px-2.5 py-1 rounded-full font-bold transition-colors ${
                  effortSize === size
                    ? EFFORT_CONFIG[size].color + " ring-1 ring-offset-1 ring-offset-gray-900"
                    : "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300"
                }`}
              >
                {size}
              </button>
            ))}
            {effortSize && (
              <button
                type="button"
                onClick={() => updateEffortSize("")}
                className="text-xs px-2 py-0.5 text-gray-600 hover:text-gray-400 transition-colors"
              >
                ✕ clear
              </button>
            )}
          </div>
        </div>

        {/* Dependencies */}
        <div className="space-y-2 border-t border-white/10 pt-4">
          <DependencyPanel
            issueId={issue.id}
            issueTitle={issue.title}
            allIssues={allIssues}
            onLinkClick={(linkedId) => {
              const linked = allIssues.find((i) => i.id === linkedId);
              if (linked) {
                onClose();
                onOpenOtherIssue?.(linked);
              }
            }}
          />
        </div>

        {/* Time Spent */}
        {timeData && (timeData.total_sec > 0) && (
          <div className="space-y-2 border-t border-white/10 pt-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">⏱ Time Spent</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-emerald-400">{formatDuration(timeData.total_sec)}</span>
              <span className="text-xs text-gray-500">total</span>
            </div>
            <div className="space-y-1">
              {Object.entries(timeData.by_agent).map(([agent, sec]) => (
                <div key={agent} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{getAssigneeEmoji(agent)} {agent}</span>
                  <span className="font-mono text-gray-300">{formatDuration(sec)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Timeline */}
        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Activity</p>
          <IssueActivityTimeline issueId={issue.id} />
        </div>
      </div>
    </div>
  );
}

const PRIORITY_COLUMNS: BoardColumn[] = [
  { id: "urgent", label: "Urgent", emoji: "🔴", color: "from-red-500/20 to-red-600/10 border-red-500/20" },
  { id: "high", label: "High", emoji: "🟠", color: "from-orange-500/20 to-orange-600/10 border-orange-500/20" },
  { id: "medium", label: "Medium", emoji: "🟡", color: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/20" },
  { id: "low", label: "Low", emoji: "⚪", color: "from-gray-500/20 to-gray-600/10 border-gray-500/20" },
];

function deriveAssigneeColumns(issues: Issue[]): BoardColumn[] {
  const seen = new Set<string>();
  const cols: BoardColumn[] = [];
  issues.forEach((i) => {
    const key = i.assignee || "__unassigned__";
    if (!seen.has(key)) {
      seen.add(key);
      cols.push({
        id: key,
        label: i.assignee ? i.assignee.charAt(0).toUpperCase() + i.assignee.slice(1) : "Unassigned",
        emoji: getAssigneeEmoji(i.assignee),
        color: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/20",
      });
    }
  });
  // Sort: unassigned last
  cols.sort((a, b) => {
    if (a.id === "__unassigned__") return 1;
    if (b.id === "__unassigned__") return -1;
    return a.label.localeCompare(b.label);
  });
  return cols;
}

function deriveLabelColumns(issues: Issue[], allLabels: Label[]): BoardColumn[] {
  const usedIds = new Set<string>();
  let hasNoLabel = false;
  issues.forEach((i) => {
    let ids: string[] = [];
    try { ids = JSON.parse(i.labels || "[]"); } catch { /* ignore */ }
    if (ids.length === 0) { hasNoLabel = true; }
    ids.forEach((id) => usedIds.add(id));
  });

  const cols: BoardColumn[] = allLabels
    .filter((l) => usedIds.has(l.id))
    .map((l) => ({
      id: l.id,
      label: l.name,
      emoji: "🏷️",
      color: "from-teal-500/20 to-teal-600/10 border-teal-500/20",
    }));

  if (hasNoLabel) {
    cols.push({ id: "__nolabel__", label: "No Label", emoji: "🔖", color: "from-gray-500/20 to-gray-600/10 border-gray-500/20" });
  }
  return cols;
}

function getIssuesForColumn(issues: Issue[], columnId: string, groupBy: GroupBy): Issue[] {
  switch (groupBy) {
    case "status":
      return issues.filter((i) => i.status === columnId).sort((a, b) => a.position - b.position);
    case "assignee": {
      const key = columnId === "__unassigned__" ? null : columnId;
      return issues.filter((i) => (i.assignee ?? null) === key).sort((a, b) => a.position - b.position);
    }
    case "priority":
      return issues.filter((i) => i.priority === columnId).sort((a, b) => a.position - b.position);
    case "label": {
      if (columnId === "__nolabel__") {
        return issues.filter((i) => {
          let ids: string[] = [];
          try { ids = JSON.parse(i.labels || "[]"); } catch { /* ignore */ }
          return ids.length === 0;
        });
      }
      return issues.filter((i) => {
        let ids: string[] = [];
        try { ids = JSON.parse(i.labels || "[]"); } catch { /* ignore */ }
        return ids.includes(columnId);
      });
    }
    default:
      return [];
  }
}

export default function KanbanPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null);
  const [activeFilterLabel, setActiveFilterLabel] = useState<string | null>(null);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIssueIndex, setFocusedIssueIndex] = useState<number>(-1);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  // kbAction: panel shown over focused issue ("assign" | "label" | "status" | null)
  const [kbAction, setKbAction] = useState<"assign" | "label" | "status" | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("kanban-group-by");
      if (stored && ["status", "assignee", "priority", "label"].includes(stored)) {
        return stored as GroupBy;
      }
    }
    return "status";
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch("/api/issues");
      const data = await res.json();
      setIssues(data);
    } catch {
      setError("Failed to load issues");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLabels = useCallback(async () => {
    try {
      const res = await fetch("/api/labels");
      const data = await res.json();
      setAllLabels(data);
    } catch { /* ignore */ }
  }, []);

  const fetchBlockedIds = useCallback(async () => {
    try {
      const res = await fetch("/api/issues/blocked-ids");
      const data: { id: string; count: number }[] = await res.json();
      setBlockedIds(new Set(data.map((r) => r.id)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchIssues();
    fetchLabels();
    fetchBlockedIds();
  }, [fetchIssues, fetchLabels, fetchBlockedIds]);

  // Flat list of all issues in board order (for keyboard navigation)
  const flatIssues = issues.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const focusedIssue = focusedIssueIndex >= 0 && focusedIssueIndex < flatIssues.length
    ? flatIssues[focusedIssueIndex]
    : null;

  // Keyboard shortcuts
  const anyModalOpen = quickAddOpen || templatesOpen || !!detailIssue || showShortcutsHelp || !!kbAction;
  useKeyboardShortcuts({
    disabled: anyModalOpen,
    onNewIssue: () => setQuickAddOpen(true),
    onClose: () => {
      if (kbAction) { setKbAction(null); return; }
      if (showShortcutsHelp) { setShowShortcutsHelp(false); return; }
      if (detailIssue) { setDetailIssue(null); return; }
      setFocusedIssueIndex(-1);
    },
    onNavigateNext: () => {
      setKbAction(null);
      setFocusedIssueIndex(i => Math.min(i + 1, flatIssues.length - 1));
    },
    onNavigatePrev: () => {
      setKbAction(null);
      setFocusedIssueIndex(i => Math.max(i - 1, 0));
    },
    onOpenFocused: () => {
      if (focusedIssue) setDetailIssue(focusedIssue);
    },
    onEditFocused: () => {
      if (focusedIssue) setDetailIssue(focusedIssue);
    },
    onAssignFocused: () => {
      if (focusedIssue) setKbAction("assign");
    },
    onLabelFocused: () => {
      if (focusedIssue) setKbAction("label");
    },
    onStatusFocused: () => {
      if (focusedIssue) setKbAction("status");
    },
    onMarkDone: async () => {
      if (!focusedIssue) return;
      try {
        await fetch(`/api/issues/${focusedIssue.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "done" }),
        });
        setIssues(prev => prev.map(i => i.id === focusedIssue.id ? { ...i, status: "done" } : i));
      } catch { /* ignore */ }
    },
    onToggleHelp: () => setShowShortcutsHelp(v => !v),
  });

  // Persist groupBy to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kanban-group-by", groupBy);
    }
  }, [groupBy]);

  // Derive columns based on groupBy
  const boardColumns: BoardColumn[] = (() => {
    switch (groupBy) {
      case "status": return STATUS_COLUMNS;
      case "priority": return PRIORITY_COLUMNS;
      case "assignee": return deriveAssigneeColumns(issues);
      case "label": return deriveLabelColumns(issues, allLabels);
      default: return STATUS_COLUMNS;
    }
  })();

  const getColumnIssues = (columnId: string) =>
    getIssuesForColumn(issues, columnId, groupBy);

  const handleDragStart = (event: DragStartEvent) => {
    const issue = event.active.data.current?.issue as Issue;
    if (issue) setActiveIssue(issue);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Only support drag reordering in status mode
    if (groupBy !== "status") return;
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeIssueItem = issues.find((i) => i.id === activeId);
    if (!activeIssueItem) return;

    let targetColumn = overId;
    const overIssue = issues.find((i) => i.id === overId);
    if (overIssue) targetColumn = overIssue.status;

    if (activeIssueItem.status !== targetColumn && STATUS_COLUMNS.find((c) => c.id === targetColumn)) {
      setIssues((prev) =>
        prev.map((i) => (i.id === activeId ? { ...i, status: targetColumn } : i))
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIssue(null);

    // Only update status via drag in status mode
    if (groupBy !== "status") return;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const movedIssue = issues.find((i) => i.id === activeId);
    if (!movedIssue) return;

    let targetColumn = overId;
    const overIssue = issues.find((i) => i.id === overId);
    if (overIssue) targetColumn = overIssue.status;

    if (!STATUS_COLUMNS.find((c) => c.id === targetColumn)) return;

    // Warn if moving a blocked issue to in_progress
    if (targetColumn === "in_progress" && blockedIds.has(activeId)) {
      const confirmed = window.confirm(
        `⚠️ "${movedIssue.title}" is currently blocked by open issues. Move to In Progress anyway?`
      );
      if (!confirmed) {
        // Revert optimistic UI
        fetchIssues();
        return;
      }
    }

    try {
      await fetch(`/api/issues/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetColumn }),
      });
      // Refresh blocked-ids in case statuses changed
      fetchBlockedIds();
    } catch {
      setError("Failed to update issue status");
      fetchIssues();
    }
  };

  const handleLabelsChanged = (issueId: string, labelIds: string[]) => {
    setIssues((prev) =>
      prev.map((i) => i.id === issueId ? { ...i, labels: JSON.stringify(labelIds) } : i)
    );
    if (detailIssue?.id === issueId) {
      setDetailIssue((prev) => prev ? { ...prev, labels: JSON.stringify(labelIds) } : null);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (columnIssueIds: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) { columnIssueIds.forEach(id => next.add(id)); }
      else { columnIssueIds.forEach(id => next.delete(id)); }
      return next;
    });
  };

  const handleBulkAction = async (action: string, value: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const res = await fetch("/api/issues/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, value: value || null, changed_by: "pieter" }),
      });
      if (!res.ok) throw new Error("Bulk update failed");

      // Optimistic update
      if (action === "status") {
        setIssues(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: value } : i));
      } else if (action === "assignee") {
        setIssues(prev => prev.map(i => ids.includes(i.id) ? { ...i, assignee: value || null } : i));
      } else if (action === "label") {
        setIssues(prev => prev.map(i => {
          if (!ids.includes(i.id)) return i;
          let lbls: string[] = [];
          try { lbls = JSON.parse(i.labels || "[]"); } catch { lbls = []; }
          if (!lbls.includes(value)) lbls = [...lbls, value];
          return { ...i, labels: JSON.stringify(lbls) };
        }));
      }

      setSelectedIds(new Set());
      fetchBlockedIds();
    } catch {
      setError("Bulk action failed");
    }
  };

  // Get labels used in current issues (for filter bar)
  const usedLabelIds = new Set<string>();
  issues.forEach((i) => {
    try { JSON.parse(i.labels || "[]").forEach((id: string) => usedLabelIds.add(id)); } catch { /* ignore */ }
  });
  const usedLabels = allLabels.filter((l) => usedLabelIds.has(l.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-sm animate-pulse">Loading kanban board...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={fetchIssues}
      />
      <TemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onCreated={fetchIssues}
      />

      {detailIssue && (
        <IssueDetailModal
          issue={detailIssue}
          allLabels={allLabels}
          allIssues={issues}
          onClose={() => { setDetailIssue(null); fetchBlockedIds(); }}
          onLabelsChanged={handleLabelsChanged}
          onDescriptionChanged={(id, desc) => {
            setIssues(prev => prev.map(i => i.id === id ? { ...i, description: desc } : i));
            setDetailIssue(prev => prev && prev.id === id ? { ...prev, description: desc } : prev);
          }}
          onOpenOtherIssue={(linkedIssue) => {
            setDetailIssue(linkedIssue);
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Kanban Board</h1>
          <p className="text-sm text-gray-500 mt-1">{issues.length} issues across {boardColumns.length} columns</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTemplatesOpen(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/8 transition flex items-center gap-1.5"
            title="Issue Templates"
          >
            <span>📋 Templates</span>
          </button>
          <button
            onClick={() => setQuickAddOpen(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-purple-600/80 hover:bg-purple-500 border border-purple-500/30 text-white font-medium transition flex items-center gap-1.5"
            title="Quick add issue (N)"
          >
            <span>+ New Issue</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">N</kbd>
          </button>
          <div className="relative group">
            <button
              className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/8 transition flex items-center gap-1"
            >
              ↓ Export
            </button>
            <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover:flex flex-col bg-gray-900 border border-white/10 rounded-lg overflow-hidden shadow-xl min-w-[140px]">
              <a
                href="/api/issues/export?format=json"
                download
                className="px-3 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition"
              >
                📄 Export JSON
              </a>
              <a
                href="/api/issues/export?format=csv"
                download
                className="px-3 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition"
              >
                📊 Export CSV
              </a>
            </div>
          </div>
          {/* Group By selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-[11px] text-gray-500">Group:</span>
            {(["status", "assignee", "priority", "label"] as GroupBy[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setGroupBy(opt)}
                className={`text-[11px] px-2 py-0.5 rounded-md transition capitalize ${
                  groupBy === opt
                    ? "bg-purple-600/60 text-white font-medium"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowShortcutsHelp(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/8 transition"
            title="Keyboard shortcuts (?)"
          >
            ⌨️ ?
          </button>
          <button
            onClick={fetchIssues}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/8 transition"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Label Filter Bar */}
      {usedLabels.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Filter:</span>
          <button
            onClick={() => setActiveFilterLabel(null)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
              activeFilterLabel === null
                ? "bg-white/15 border-white/30 text-gray-200"
                : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"
            }`}
          >
            All
          </button>
          {usedLabels.map((label) => (
            <button
              key={label.id}
              onClick={() => setActiveFilterLabel(activeFilterLabel === label.id ? null : label.id)}
              className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition ${
                activeFilterLabel === label.id
                  ? "opacity-100 scale-105"
                  : "opacity-60 hover:opacity-90"
              }`}
              style={
                activeFilterLabel === label.id
                  ? { backgroundColor: label.color + "33", borderColor: label.color + "77", color: label.color }
                  : { backgroundColor: label.color + "11", borderColor: label.color + "33", color: label.color }
              }
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: label.color }} />
              {label.name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <BulkActionToolbar
          selectedCount={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onBulkAction={handleBulkAction}
          allLabels={allLabels}
        />
      )}

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {boardColumns.map((column) => (
            <Column
              key={column.id}
              column={column}
              issues={getColumnIssues(column.id)}
              allLabels={allLabels}
              onOpenDetail={setDetailIssue}
              activeFilterLabel={activeFilterLabel}
              blockedIds={blockedIds}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              anySelected={selectedIds.size > 0}
              focusedIssueId={focusedIssue?.id ?? null}
            />
          ))}
        </div>

        <DragOverlay>
          {activeIssue ? (
            <div className="rotate-2 shadow-2xl">
              <IssueCard issue={activeIssue} allLabels={allLabels} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Keyboard shortcuts help */}
      {showShortcutsHelp && (
        <KeyboardShortcutsLegend onClose={() => setShowShortcutsHelp(false)} />
      )}

      {/* Keyboard action panels for focused issue */}
      {kbAction && focusedIssue && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setKbAction(null)}
        >
          <div
            className="bg-gray-900 border border-white/15 rounded-2xl shadow-2xl p-4 min-w-[220px] max-w-xs mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {kbAction === "assign" && (
              <>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Assign: {focusedIssue.title.slice(0, 40)}</p>
                <div className="space-y-1">
                  {["kai", "pieter", "alma", "dev", "luna"].map(agent => (
                    <button
                      key={agent}
                      onClick={async () => {
                        await fetch(`/api/issues/${focusedIssue.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ assignee: agent }),
                        });
                        setIssues(prev => prev.map(i => i.id === focusedIssue.id ? { ...i, assignee: agent } : i));
                        setKbAction(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-gray-300 transition"
                    >
                      <span>{getAssigneeEmoji(agent)}</span>
                      <span className="capitalize">{agent}</span>
                      {focusedIssue.assignee === agent && <span className="ml-auto text-purple-400 text-xs">✓</span>}
                    </button>
                  ))}
                  <button
                    onClick={async () => {
                      await fetch(`/api/issues/${focusedIssue.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ assignee: null }),
                      });
                      setIssues(prev => prev.map(i => i.id === focusedIssue.id ? { ...i, assignee: null } : i));
                      setKbAction(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-gray-500 transition border-t border-white/5 mt-1 pt-2"
                  >
                    🚫 Unassign
                  </button>
                </div>
              </>
            )}

            {kbAction === "label" && (
              <>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Label: {focusedIssue.title.slice(0, 40)}</p>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {allLabels.map(label => {
                    let currentLabelIds: string[] = [];
                    try { currentLabelIds = JSON.parse(focusedIssue.labels || "[]"); } catch { currentLabelIds = []; }
                    const has = currentLabelIds.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        onClick={async () => {
                          let lbls: string[] = [];
                          try { lbls = JSON.parse(focusedIssue.labels || "[]"); } catch { lbls = []; }
                          const next = has ? lbls.filter(x => x !== label.id) : [...lbls, label.id];
                          await fetch(`/api/issues/${focusedIssue.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ labels: JSON.stringify(next) }),
                          });
                          setIssues(prev => prev.map(i => i.id === focusedIssue.id ? { ...i, labels: JSON.stringify(next) } : i));
                          setKbAction(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-sm transition"
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                        <span style={{ color: label.color }}>{label.name}</span>
                        {has && <span className="ml-auto text-purple-400 text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {kbAction === "status" && (
              <>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Status: {focusedIssue.title.slice(0, 40)}</p>
                <div className="space-y-1">
                  {STATUS_COLUMNS.map(col => (
                    <button
                      key={col.id}
                      onClick={async () => {
                        await fetch(`/api/issues/${focusedIssue.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: col.id }),
                        });
                        setIssues(prev => prev.map(i => i.id === focusedIssue.id ? { ...i, status: col.id } : i));
                        setKbAction(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-gray-300 transition"
                    >
                      <span>{col.emoji}</span>
                      <span>{col.label}</span>
                      {focusedIssue.status === col.id && <span className="ml-auto text-purple-400 text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="text-[11px] text-gray-600 mt-3 text-center">Press Esc to cancel</p>
          </div>
        </div>
      )}

      {/* Keyboard shortcut hint bar */}
      {focusedIssue && !kbAction && !detailIssue && !showShortcutsHelp && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900/90 backdrop-blur-md border border-white/10 shadow-xl text-[11px] text-gray-500 pointer-events-none">
          <span className="text-blue-400 font-medium truncate max-w-[200px]">{focusedIssue.title}</span>
          <span className="text-gray-700">·</span>
          {[["Enter","open"],["E","edit"],["A","assign"],["L","label"],["S","status"],["D","done"],["?","help"]].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-gray-400">{key}</kbd>
              <span>{label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
