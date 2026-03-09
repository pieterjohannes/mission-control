"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import QuickAddModal from "@/components/QuickAddModal";
import TemplatesModal from "@/components/TemplatesModal";
import ImportIssuesModal from "@/components/ImportIssuesModal";
import LabelPicker, { LabelChip, Label } from "@/components/LabelPicker";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import ShortcutsPanel from "@/components/ShortcutsPanel";

import AgingBadge, { getAgingLevel, getAgingCardClass } from "@/components/AgingBadge";
import StaleBadge from "@/components/StaleBadge";
import TimeInStatusBadge from "@/components/TimeInStatusBadge";
import IssueAgeBadge from "@/components/IssueAgeBadge";
import DueDateBadge, { getDueDateStatus } from "@/components/DueDateBadge";
import IssueDetailPanel from "@/components/IssueDetailPanel";
import FocusMode from "@/components/FocusMode";
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

interface RecurrenceConfig {
  type: "daily" | "weekly" | "monthly";
  interval: number;
  next_run: string;
}

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
  days_in_status?: number | null;
  effort_size?: string | null;
  recurrence_config?: string | null;
  parent_id?: string | null;
  due_date?: string | null;
  subtasks?: string | null;
  watcher_count?: number | null;
  confidence_score?: number | null;
  reopen_count?: number | null;
  total_time_sec?: number | null;
  isStale?: number | null;
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

// Default WIP limits (overridden by API/settings)
const DEFAULT_WIP_LIMITS: Record<string, number | null> = {
  backlog: null,
  next: null,
  in_progress: 5,
  review: 5,
  done: null,
};

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
  bounceCount,
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
  bounceCount?: number;
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  anySelected?: boolean;
  isFocused?: boolean;
}) {
  const priority = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium;
  let labelIds: string[] = [];
  try { labelIds = JSON.parse(issue.labels || "[]"); } catch { labelIds = []; }
  const labels = allLabels.filter((l) => labelIds.includes(l.id));

  // Compute stale CSS class from days_since_update (based on updated_at)
  const staleDays = issue.days_since_update ?? null;
  const staleClass = issue.status === "done" || staleDays == null
    ? ""
    : staleDays >= 30
    ? "stale-30d"
    : staleDays >= 7
    ? "stale-7d"
    : "";

  return (
    <div
      onClick={onClick}
      className={`
        group/card relative rounded-xl border bg-gray-900/80 backdrop-blur-sm p-3 space-y-2
        border-white/10 hover:border-white/20 transition-all
        ${isDragging ? "opacity-50 scale-95" : ""}
        ${dimmed ? "opacity-30" : ""}
        ${isSelected ? "ring-2 ring-purple-500/60 border-purple-500/40" : isFocused ? "" : getDueDateStatus(issue.due_date) === "overdue" ? "ring-1 ring-red-500/50 border-red-500/30" : getAgingCardClass(getAgingLevel(issue.status, issue.days_in_status ?? issue.days_since_update))}
        ${isFocused ? "ring-2 ring-blue-400/70 border-blue-400/50 shadow-lg shadow-blue-500/10" : ""}
        ${staleClass}
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

      {(isBlocked || (bounceCount != null && bounceCount >= 2) || issue.isStale || staleClass) && (
        <div className="flex items-center gap-1 flex-wrap">
          {isBlocked && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-medium">
              🚫 Blocked
            </span>
          )}
          {bounceCount != null && bounceCount >= 2 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-medium" title={`Flaky — bounced from review ${bounceCount}×`}>
              🔥 Flaky ×{bounceCount}
            </span>
          )}
          {staleClass === "stale-30d" ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-medium" title={`No updates in ${staleDays} days`}>
              💀 Stale {staleDays}d
            </span>
          ) : staleClass === "stale-7d" ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium" title={`No updates in ${staleDays} days`}>
              💤 Stale {staleDays}d
            </span>
          ) : issue.isStale ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium" title={`No updates in 14+ days`}>
              💤 Stale
            </span>
          ) : null}
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
          <AgingBadge status={issue.status} daysSinceUpdate={issue.days_since_update} daysInStatus={issue.days_in_status} compact />
          <StaleBadge status={issue.status} days={issue.days_in_status ?? issue.days_since_update} compact />
          <TimeInStatusBadge daysInStatus={issue.days_in_status} status={issue.status} compact />
          <IssueAgeBadge daysInStatus={issue.days_in_status} status={issue.status} compact />
          {issue.effort_size && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-sky-500/15 text-sky-400 border border-sky-500/25">
              {issue.effort_size}
            </span>
          )}
          {issue.recurrence_config && (() => {
            try {
              const rc = JSON.parse(issue.recurrence_config) as RecurrenceConfig;
              const label = rc.interval === 1 ? rc.type : `${rc.interval}×${rc.type.slice(0,1)}`;
              return (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25" title={`Recurring: ${rc.interval > 1 ? rc.interval + ' ' : ''}${rc.type} — next: ${rc.next_run}`}>
                  🔁 {label}
                </span>
              );
            } catch { return null; }
          })()}
          {issue.parent_id && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25" title={`Spawned from: ${issue.parent_id}`}>
              ↩ recur
            </span>
          )}
          <DueDateBadge dueDate={issue.due_date} compact />
          {issue.confidence_score != null && (() => {
            const score = issue.confidence_score as number;
            const stars = "⭐".repeat(score);
            const tooltipLines = [
              `Confidence: ${score}/5`,
              (issue.title || "").trim().length > 10 ? "✅ Clear title" : "❌ Title too short",
              (issue.description || "").trim().length > 150 ? "✅ Rich description" : (issue.description || "").trim().length > 50 ? "⚠️ Desc OK" : "❌ No/short description",
              (() => { try { const s = JSON.parse(issue.subtasks || "[]"); return Array.isArray(s) && s.length > 0 ? "✅ Has subtasks" : "❌ No subtasks"; } catch { return "❌ No subtasks"; } })(),
              issue.assignee ? "✅ Has assignee" : "❌ No assignee",
            ].join("\n");
            return (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${score <= 2 ? "bg-red-500/15 text-red-400 border-red-500/25" : score <= 3 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" : "bg-green-500/15 text-green-400 border-green-500/25"}`}
                title={tooltipLines}
              >
                {stars}
              </span>
            );
          })()}
        </div>
        <div className="flex items-center gap-1.5">
          {(issue.watcher_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-500" title={`${issue.watcher_count} watcher${issue.watcher_count === 1 ? "" : "s"}`}>
              🔔 {issue.watcher_count}
            </span>
          )}
          {(issue.total_time_sec ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-400/80 font-mono" title={`Time logged: ${formatDuration(issue.total_time_sec!)}`}>
              ⏱ {formatDuration(issue.total_time_sec!)}
            </span>
          )}
          <div
            className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs"
            title={issue.assignee || "Unassigned"}
          >
            {getAssigneeEmoji(issue.assignee)}
          </div>
        </div>
      </div>

      {(issue.confidence_score != null && (issue.confidence_score as number) <= 2) && (
        <div className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1">
          💡 Improve this issue — add description, subtasks, or assignee
        </div>
      )}

      {(() => {
        let subtasks: { title: string; done: boolean }[] = [];
        try { let p = JSON.parse(issue.subtasks || "[]"); if (typeof p === "string") p = JSON.parse(p); subtasks = Array.isArray(p) ? p : []; } catch { subtasks = []; }
        if (!subtasks.length) return null;
        const done = subtasks.filter((s) => s.done).length;
        const total = subtasks.length;
        const pct = Math.round((done / total) * 100);
        const allDone = done === total;
        return (
          <div className="-mx-3 -mb-3 mt-1">
            <div className="flex items-center justify-end px-3 pb-1">
              <span className="text-[10px] text-gray-500 font-mono">{done}/{total}</span>
            </div>
            <div className="h-1 w-full bg-white/10 rounded-b-xl overflow-hidden">
              <div
                className={`h-full transition-all ${allDone ? "bg-green-500" : "bg-purple-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function SortableCard({ issue, allLabels, onOpenDetail, activeFilterLabel, blockedIds, bounceIds, isSelected, onToggleSelect, anySelected, isFocused }: {
  issue: Issue;
  allLabels: Label[];
  onOpenDetail: (issue: Issue) => void;
  activeFilterLabel: string | null;
  blockedIds: Set<string>;
  bounceIds: Map<string, number>;
  isSelected: boolean;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
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
        bounceCount={Math.max(bounceIds.get(issue.id) ?? 0, issue.reopen_count ?? 0)}
        isSelected={isSelected}
        anySelected={anySelected}
        isFocused={isFocused}
        onToggleSelect={(e) => { e.stopPropagation(); onToggleSelect(issue.id, e.shiftKey); }}
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
  bounceIds,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  anySelected,
  focusedIssueId,
  wipLimit,
}: {
  column: BoardColumn;
  issues: Issue[];
  allLabels: Label[];
  onOpenDetail: (issue: Issue) => void;
  activeFilterLabel: string | null;
  blockedIds: Set<string>;
  bounceIds: Map<string, number>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  onSelectAll: (columnIssueIds: string[], selected: boolean) => void;
  anySelected: boolean;
  focusedIssueId?: string | null;
  wipLimit?: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  const columnIds = issues.map(i => i.id);
  const allColumnSelected = columnIds.length > 0 && columnIds.every(id => selectedIds.has(id));
  const someColumnSelected = columnIds.some(id => selectedIds.has(id));

  // WIP limit calculation
  const wipExceeded = wipLimit != null && issues.length >= wipLimit;
  const wipWarning = wipLimit != null && !wipExceeded && issues.length / wipLimit >= 0.8;

  return (
    <div
      className={`
        flex flex-col rounded-2xl border bg-gradient-to-b ${column.color}
        backdrop-blur-sm min-w-[280px] max-w-[280px] h-full
        transition-all duration-200
        ${isOver ? "ring-2 ring-purple-400/40 scale-[1.01]" : ""}
        ${wipExceeded ? "ring-2 ring-red-500/50" : wipWarning ? "ring-2 ring-amber-500/40" : ""}
      `}
    >
      <div className={`p-4 border-b border-white/5 flex items-center justify-between rounded-t-2xl transition-colors ${wipExceeded ? "bg-red-500/10" : wipWarning ? "bg-amber-500/8" : ""}`}>
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
          <h3 className={`font-semibold text-sm ${wipExceeded ? "text-red-300" : wipWarning ? "text-amber-300" : "text-gray-200"}`}>{column.label}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {wipLimit != null ? (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold border ${
                wipExceeded
                  ? "bg-red-500/20 text-red-300 border-red-500/40"
                  : wipWarning
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-white/10 text-gray-400 border-white/10"
              }`}
              title={`WIP limit: ${wipLimit}`}
            >
              {wipExceeded ? "🔴" : wipWarning ? "🟡" : ""}{issues.length}/{wipLimit}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400 font-mono">
              {issues.length}
            </span>
          )}
        </div>
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
              bounceIds={bounceIds}
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
  const [showPriority, setShowPriority] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const AGENTS = ["kai", "pieter", "alma", "dev", "luna"];

  const closeAllMenus = () => {
    setShowMove(false);
    setShowAssign(false);
    setShowLabel(false);
    setShowPriority(false);
  };

  const handle = async (action: string, value: string) => {
    setLoading(true);
    closeAllMenus();
    try {
      await onBulkAction(action, value);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setShowDeleteConfirm(false);
    try {
      await onBulkAction("delete", "");
    } finally {
      setLoading(false);
    }
  };

  const PRIORITY_OPTIONS = [
    { id: "urgent", label: "Urgent", emoji: "🔴" },
    { id: "high", label: "High", emoji: "🟠" },
    { id: "medium", label: "Medium", emoji: "🟡" },
    { id: "low", label: "Low", emoji: "⚪" },
  ];

  return (
    <>
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl shadow-2xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-3">
              <div className="text-4xl">🗑️</div>
              <h3 className="text-lg font-semibold text-white">Delete {selectedCount} issue{selectedCount !== 1 ? "s" : ""}?</h3>
              <p className="text-sm text-gray-400">This action cannot be undone. All selected issues will be permanently deleted.</p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/15 text-sm transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition"
                >
                  Delete All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-gray-900/95 backdrop-blur-md border border-white/15 shadow-2xl shadow-black/50">
        <span className="text-sm font-semibold text-purple-300">{selectedCount} selected</span>
        <div className="w-px h-5 bg-white/10" />

        {/* Move (status) */}
        <div className="relative">
          <button
            disabled={loading}
            onClick={() => { setShowMove(!showMove); setShowAssign(false); setShowLabel(false); setShowPriority(false); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:bg-blue-600/50 transition disabled:opacity-50"
          >
            📦 Status…
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

        {/* Priority */}
        <div className="relative">
          <button
            disabled={loading}
            onClick={() => { setShowPriority(!showPriority); setShowMove(false); setShowAssign(false); setShowLabel(false); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-orange-600/30 border border-orange-500/40 text-orange-300 hover:bg-orange-600/50 transition disabled:opacity-50"
          >
            🎯 Priority…
          </button>
          {showPriority && (
            <div className="absolute bottom-full mb-2 left-0 bg-gray-900 border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[140px]">
              {PRIORITY_OPTIONS.map(p => (
                <button key={p.id} onClick={() => handle("priority", p.id)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 flex items-center gap-2">
                  <span>{p.emoji}</span><span>{p.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assign */}
        <div className="relative">
          <button
            disabled={loading}
            onClick={() => { setShowAssign(!showAssign); setShowMove(false); setShowLabel(false); setShowPriority(false); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/50 transition disabled:opacity-50"
          >
            👤 Assign…
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
            onClick={() => { setShowLabel(!showLabel); setShowMove(false); setShowAssign(false); setShowPriority(false); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-amber-600/30 border border-amber-500/40 text-amber-300 hover:bg-amber-600/50 transition disabled:opacity-50"
          >
            🏷️ Label…
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

        {/* Delete */}
        <button
          disabled={loading}
          onClick={() => { closeAllMenus(); setShowDeleteConfirm(true); }}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/40 transition disabled:opacity-50"
          title={`Delete ${selectedCount} selected issue${selectedCount !== 1 ? "s" : ""}`}
        >
          🗑️ Delete
        </button>

        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-300 transition px-2 py-1 rounded-lg hover:bg-white/5"
        >
          ✕ Clear
        </button>
      </div>
    </>
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

function KanbanPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null);
  const [focusModeIssue, setFocusModeIssue] = useState<Issue | null>(null);
  const [wipLimits, setWipLimits] = useState<Record<string, number | null>>(DEFAULT_WIP_LIMITS);
  const [wipToast, setWipToast] = useState<string | null>(null);
  const [activeFilterLabel, setActiveFilterLabel] = useState<string | null>(null);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [bounceIds, setBounceIds] = useState<Map<string, number>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIssueIndex, setFocusedIssueIndex] = useState<number>(-1);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  // kbAction: panel shown over focused issue ("assign" | "label" | "status" | null)
  const [kbAction, setKbAction] = useState<"assign" | "label" | "status" | "comment" | null>(null);
  const [commentBody, setCommentBody] = useState("");
  type QuickFilter = "all" | "urgent" | "high" | "mine" | "unassigned" | "flaky" | "due_soon" | "stale";
  const VALID_QUICK_FILTERS: QuickFilter[] = ["all", "urgent", "high", "mine", "unassigned", "flaky", "due_soon", "stale"];
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(() => {
    if (typeof window !== "undefined") {
      const urlVal = new URLSearchParams(window.location.search).get("qf") as QuickFilter | null;
      if (urlVal && VALID_QUICK_FILTERS.includes(urlVal)) return urlVal;
    }
    return "all";
  });
  const [textFilter, setTextFilter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const urlVal = new URLSearchParams(window.location.search).get("q");
      if (urlVal !== null) return urlVal;
      return localStorage.getItem("kanban-text-filter") ?? "";
    }
    return "";
  });
  const [assigneeFilter, setAssigneeFilter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const urlVal = new URLSearchParams(window.location.search).get("assignee");
      if (urlVal !== null) return urlVal;
      return localStorage.getItem("kanban-assignee-filter") ?? "";
    }
    return "";
  });
  const [priorityFilters, setPriorityFilters] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const urlVal = new URLSearchParams(window.location.search).get("priority");
      if (urlVal !== null) {
        const vals = urlVal.split(",").filter(Boolean);
        return new Set<string>(vals);
      }
      const stored = localStorage.getItem("kanban-priority-filters");
      if (stored) try { return new Set(JSON.parse(stored)); } catch { /* ignore */ }
    }
    return new Set<string>();
  });
  const [labelFilter, setLabelFilter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const urlVal = new URLSearchParams(window.location.search).get("label");
      if (urlVal !== null) return urlVal;
      return localStorage.getItem("kanban-label-filter") ?? "";
    }
    return "";
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
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

  const fetchBounceIds = useCallback(async () => {
    try {
      const res = await fetch("/api/issues/bounce-ids");
      const data: { id: string; bounces: number }[] = await res.json();
      const map = new Map<string, number>();
      data.forEach(r => map.set(r.id, r.bounces));
      setBounceIds(map);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchIssues();
    fetchLabels();
    fetchBlockedIds();
    fetchBounceIds();
    fetch("/api/settings/wip-limits")
      .then((r) => r.json())
      .then((data) => setWipLimits(data))
      .catch(() => {});
  }, [fetchIssues, fetchLabels, fetchBlockedIds]);

  // Deep-link: open panel if ?issue=<id> is in the URL
  useEffect(() => {
    const issueId = searchParams.get("issue");
    if (issueId && issues.length > 0) {
      const found = issues.find(i => i.id === issueId);
      if (found) setDetailIssue(found);
    }
  }, [searchParams, issues]);

  // Persist filter state to localStorage
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("kanban-text-filter", textFilter); }, [textFilter]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("kanban-assignee-filter", assigneeFilter); }, [assigneeFilter]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("kanban-priority-filters", JSON.stringify(Array.from(priorityFilters))); }, [priorityFilters]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("kanban-label-filter", labelFilter); }, [labelFilter]);

  // Sync active filters → URL query params (for shareability)
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    // Text filter
    if (textFilter) params.set("q", textFilter); else params.delete("q");
    // Assignee filter
    if (assigneeFilter) params.set("assignee", assigneeFilter); else params.delete("assignee");
    // Priority filters
    if (priorityFilters.size > 0) params.set("priority", Array.from(priorityFilters).join(",")); else params.delete("priority");
    // Label filter
    if (labelFilter) params.set("label", labelFilter); else params.delete("label");
    // Quick filter
    if (quickFilter && quickFilter !== "all") params.set("qf", quickFilter); else params.delete("qf");
    // Replace URL without pushing a new history entry
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textFilter, assigneeFilter, priorityFilters, labelFilter, quickFilter]);

  // Sync labelFilter → activeFilterLabel
  useEffect(() => { setActiveFilterLabel(labelFilter || null); }, [labelFilter]);

  // Quick filter: filter issues before rendering columns
  const filteredIssues = issues.filter((i) => {
    const matchesQuick = (() => {
      switch (quickFilter) {
        case "urgent": return i.priority === "urgent";
        case "high": return i.priority === "high";
        case "mine": return (i.assignee ?? "").toLowerCase() === "kai";
        case "unassigned": return !i.assignee;
        case "flaky": return (i.reopen_count ?? bounceIds.get(i.id) ?? 0) >= 2;
        case "due_soon": {
          if (!i.due_date || i.status === "done") return false;
          const s = getDueDateStatus(i.due_date);
          return s === "overdue" || s === "critical" || s === "warning";
        }
        case "stale": return !!i.isStale && i.status !== "done";
        default: return true;
      }
    })();
    const q = textFilter.trim().toLowerCase();
    const matchesText = !q || i.title.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q) || (i.assignee ?? "").toLowerCase().includes(q) || (i.project ?? "").toLowerCase().includes(q);
    const matchesAssignee = !assigneeFilter || (assigneeFilter === "__unassigned__" ? !i.assignee : (i.assignee ?? "").toLowerCase() === assigneeFilter);
    const matchesPriority = priorityFilters.size === 0 || priorityFilters.has(i.priority);
    const matchesLabel = !labelFilter || (() => {
      let ids: string[] = [];
      try { ids = JSON.parse(i.labels || "[]"); } catch { ids = []; }
      return ids.includes(labelFilter);
    })();
    return matchesQuick && matchesText && matchesAssignee && matchesPriority && matchesLabel;
  });

  // Flat list of all issues in board order (for keyboard navigation)
  const flatIssues = filteredIssues.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const focusedIssue = focusedIssueIndex >= 0 && focusedIssueIndex < flatIssues.length
    ? flatIssues[focusedIssueIndex]
    : null;

  // Keyboard shortcuts
  const anyModalOpen = quickAddOpen || templatesOpen || importOpen || !!detailIssue || !!focusModeIssue || showShortcutsHelp || !!kbAction;
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  useKeyboardShortcuts({
    disabled: anyModalOpen,
    onNewIssue: () => setQuickAddOpen(true),
    onClose: () => {
      if (focusModeIssue) { setFocusModeIssue(null); return; }
      if (kbAction) { setKbAction(null); return; }
      if (showShortcutsHelp) { setShowShortcutsHelp(false); return; }
      if (detailIssue) { setDetailIssue(null); return; }
      if (selectedIds.size > 0) { setSelectedIds(new Set()); return; }
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
    onFocusMode: () => {
      if (focusedIssue) setFocusModeIssue(focusedIssue);
      else if (detailIssue) setFocusModeIssue(detailIssue);
    },
    onEditFocused: () => {
      if (focusedIssue) setDetailIssue(focusedIssue);
    },
    onCommentFocused: () => {
      if (focusedIssue) { setCommentBody(""); setKbAction("comment"); }
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
    onFocusSearch: () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
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
      case "assignee": return deriveAssigneeColumns(filteredIssues);
      case "label": return deriveLabelColumns(filteredIssues, allLabels);
      default: return STATUS_COLUMNS;
    }
  })();

  const getColumnIssues = (columnId: string) =>
    getIssuesForColumn(filteredIssues, columnId, groupBy);

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

    // Soft-warn if dragging into a column at/over WIP limit
    if (groupBy === "status") {
      const limit = wipLimits[targetColumn] ?? null;
      if (limit != null && targetColumn !== movedIssue.status) {
        const colCount = issues.filter(i => i.status === targetColumn && i.id !== activeId).length;
        if (colCount >= limit) {
          const colLabel = STATUS_COLUMNS.find(c => c.id === targetColumn)?.label ?? targetColumn;
          setWipToast(`⚠️ "${colLabel}" is at WIP limit (${limit}). Proceeding anyway.`);
          setTimeout(() => setWipToast(null), 3500);
        }
      }
    }

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

  const lastSelectedIdRef = useRef<string | null>(null);

  const handleToggleSelect = useCallback((id: string, shiftKey = false) => {
    if (shiftKey && lastSelectedIdRef.current && lastSelectedIdRef.current !== id) {
      // Range select: select all issues between lastSelected and id in flatIssues order
      const allIds = flatIssues.map(i => i.id);
      const fromIdx = allIds.indexOf(lastSelectedIdRef.current);
      const toIdx = allIds.indexOf(id);
      if (fromIdx !== -1 && toIdx !== -1) {
        const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
        const rangeIds = allIds.slice(start, end + 1);
        setSelectedIds(prev => {
          const next = new Set(prev);
          rangeIds.forEach(rid => next.add(rid));
          return next;
        });
        lastSelectedIdRef.current = id;
        return;
      }
    }
    lastSelectedIdRef.current = id;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [flatIssues]);

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
      } else if (action === "priority") {
        setIssues(prev => prev.map(i => ids.includes(i.id) ? { ...i, priority: value } : i));
      } else if (action === "label") {
        setIssues(prev => prev.map(i => {
          if (!ids.includes(i.id)) return i;
          let lbls: string[] = [];
          try { lbls = JSON.parse(i.labels || "[]"); } catch { lbls = []; }
          if (!lbls.includes(value)) lbls = [...lbls, value];
          return { ...i, labels: JSON.stringify(lbls) };
        }));
      } else if (action === "delete") {
        setIssues(prev => prev.filter(i => !ids.includes(i.id)));
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

  // Get unique assignees (for filter dropdown)
  const uniqueAssignees = Array.from(new Set(issues.map(i => i.assignee).filter(Boolean) as string[])).sort();

  const hasActiveFilters = !!textFilter || !!assigneeFilter || priorityFilters.size > 0 || !!labelFilter;

  const clearAllFilters = () => {
    setTextFilter("");
    setAssigneeFilter("");
    setPriorityFilters(new Set());
    setLabelFilter("");
    setQuickFilter("all");
  };

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
      <ImportIssuesModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchIssues}
      />

      <IssueDetailPanel
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
        onFocusMode={(issue) => {
          setDetailIssue(null);
          setFocusModeIssue(issue);
        }}
      />

      <FocusMode
        issue={focusModeIssue}
        allIssues={issues}
        onClose={() => setFocusModeIssue(null)}
        onOpenOtherIssue={(linkedIssue) => {
          setFocusModeIssue(linkedIssue);
        }}
      />

      {/* Header */}
      <div className="kanban-header-row flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Kanban Board</h1>
          <p className="text-sm text-gray-500 mt-1">{filteredIssues.length}{(quickFilter !== "all" || hasActiveFilters) ? ` of ${issues.length}` : ""} issues across {boardColumns.length} columns</p>
        </div>
        <div className="kanban-header-actions flex items-center gap-2 flex-wrap">
          <Link
            href="/dep-graph"
            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/8 transition flex items-center gap-1.5"
            title="View dependency graph"
          >
            <span>🕸️ Dep Graph</span>
          </Link>
          <button
            onClick={() => setTemplatesOpen(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/8 transition flex items-center gap-1.5"
            title="Issue Templates"
          >
            <span>📋 Templates</span>
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/8 transition flex items-center gap-1.5"
            title="Import issues from CSV or JSON"
          >
            <span>📥 Import</span>
          </button>
          <button
            onClick={() => setQuickAddOpen(true)}
            className="quick-add-button px-3 py-1.5 text-xs rounded-lg bg-purple-600/80 hover:bg-purple-500 border border-purple-500/30 text-white font-medium transition flex items-center gap-1.5"
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
            <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover:flex flex-col bg-gray-900 border border-white/10 rounded-lg overflow-hidden shadow-xl min-w-[160px]">
              {(["json", "csv"] as const).map((fmt) => {
                const params = new URLSearchParams({ format: fmt });
                if (assigneeFilter) params.set("assignee", assigneeFilter);
                if (priorityFilters.size === 1) params.set("priority", [...priorityFilters][0]);
                const url = `/api/issues/export?${params.toString()}`;
                return (
                  <a
                    key={fmt}
                    href={url}
                    download
                    className="px-3 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition"
                  >
                    {fmt === "json" ? "📄 Export JSON" : "📊 Export CSV"}
                    {(assigneeFilter || priorityFilters.size > 0) && (
                      <span className="ml-1 text-purple-400">(filtered)</span>
                    )}
                  </a>
                );
              })}
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

      {/* Search & Filter Bar — sticky */}
      <div className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-gray-950/95 backdrop-blur-md border-b border-white/5 shadow-sm">
        <div className="flex flex-col gap-2">
          {/* Row 1: search + assignee + priority + label */}
          <div className="kanban-filter-row flex items-center gap-2 flex-wrap">
            {/* Text search */}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 text-xs">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setTextFilter(""); searchInputRef.current?.blur(); } }}
                placeholder="Search title/description… (/)"
                className="w-56 pl-7 pr-7 py-1.5 text-[11px] rounded-lg bg-white/5 border border-white/10 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition"
              />
              {textFilter && (
                <button
                  onClick={() => { setTextFilter(""); searchInputRef.current?.focus(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
                >×</button>
              )}
            </div>

            {/* Assignee dropdown */}
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className={`text-[11px] px-2.5 py-1.5 rounded-lg border bg-gray-900 transition cursor-pointer focus:outline-none focus:border-purple-500/50 ${
                assigneeFilter ? "border-purple-500/50 text-purple-300" : "border-white/10 text-gray-400"
              }`}
            >
              <option value="">👤 All assignees</option>
              <option value="__unassigned__">🚫 Unassigned</option>
              {uniqueAssignees.map(a => (
                <option key={a} value={a}>{getAssigneeEmoji(a)} {a.charAt(0).toUpperCase() + a.slice(1)}</option>
              ))}
            </select>

            {/* Priority multi-select */}
            <div className="flex items-center gap-1">
              {(["urgent", "high", "medium", "low"] as const).map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                const active = priorityFilters.has(p);
                return (
                  <button
                    key={p}
                    onClick={() => setPriorityFilters(prev => {
                      const next = new Set(prev);
                      if (next.has(p)) next.delete(p); else next.add(p);
                      return next;
                    })}
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition-all ${
                      active
                        ? `${cfg.color} scale-105 shadow-sm`
                        : "bg-white/5 border-white/10 text-gray-600 hover:text-gray-300 hover:bg-white/10"
                    }`}
                    title={`Filter by ${cfg.label} priority`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? cfg.dot : "bg-gray-600"}`} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Label filter */}
            {usedLabels.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[11px] text-gray-600">🏷️</span>
                {usedLabels.map((label) => (
                  <button
                    key={label.id}
                    onClick={() => setLabelFilter(labelFilter === label.id ? "" : label.id)}
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border transition-all ${
                      labelFilter === label.id ? "opacity-100 scale-105" : "opacity-50 hover:opacity-80"
                    }`}
                    style={
                      labelFilter === label.id
                        ? { backgroundColor: label.color + "33", borderColor: label.color + "77", color: label.color }
                        : { backgroundColor: label.color + "11", borderColor: label.color + "33", color: label.color }
                    }
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                    {label.name}
                  </button>
                ))}
              </div>
            )}

            {/* Clear all filters */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition ml-auto"
              >
                ✕ Clear filters
              </button>
            )}
          </div>

          {/* Row 2: quick filter pills */}
          <div className="kanban-quickfilter-row flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: "all",        label: "All",        emoji: "🗂️" },
                { id: "urgent",     label: "Urgent",     emoji: "🔴" },
                { id: "high",       label: "High",       emoji: "🟠" },
                { id: "mine",       label: "Mine",       emoji: "🤖" },
                { id: "unassigned", label: "Unassigned", emoji: "👤" },
                { id: "flaky",      label: "Flaky",      emoji: "🔥" },
                { id: "due_soon",   label: "Due Soon",   emoji: "⏰" },
                { id: "stale",      label: "Stale",      emoji: "💤" },
              ] as { id: QuickFilter; label: string; emoji: string }[]
            ).map(({ id, label, emoji }) => {
              const count = id === "all" ? issues.length : issues.filter((i) => {
                switch (id) {
                  case "urgent": return i.priority === "urgent";
                  case "high": return i.priority === "high";
                  case "mine": return (i.assignee ?? "").toLowerCase() === "kai";
                  case "unassigned": return !i.assignee;
                  case "flaky": return (i.reopen_count ?? bounceIds.get(i.id) ?? 0) >= 2;
                  case "due_soon": {
                    if (!i.due_date || i.status === "done") return false;
                    const s = getDueDateStatus(i.due_date);
                    return s === "overdue" || s === "critical" || s === "warning";
                  }
                  case "stale": return !!i.isStale && i.status !== "done";
                  default: return true;
                }
              }).length;
              const active = quickFilter === id;
              return (
                <button
                  key={id}
                  onClick={() => setQuickFilter(active && id !== "all" ? "all" : id)}
                  className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                    active
                      ? "bg-purple-600/40 border-purple-500/60 text-purple-200 scale-105 shadow-sm shadow-purple-500/20"
                      : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/10"
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1 rounded-full ${active ? "bg-purple-500/40 text-purple-200" : "bg-white/10 text-gray-500"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
            <span className="text-[11px] text-gray-600 ml-auto">{filteredIssues.length}{filteredIssues.length !== issues.length ? ` of ${issues.length}` : ""} issues</span>
          </div>
        </div>
      </div>

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
        <div className="kanban-columns flex gap-4 overflow-x-auto pb-4 flex-1">
          {boardColumns.map((column) => (
            <Column
              key={column.id}
              column={column}
              issues={getColumnIssues(column.id)}
              allLabels={allLabels}
              onOpenDetail={setDetailIssue}
              activeFilterLabel={activeFilterLabel}
              blockedIds={blockedIds}
              bounceIds={bounceIds}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              anySelected={selectedIds.size > 0}
              focusedIssueId={focusedIssue?.id ?? null}
              wipLimit={groupBy === "status" ? (wipLimits[column.id] ?? null) : null}
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
        <ShortcutsPanel onClose={() => setShowShortcutsHelp(false)} />
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

            {kbAction === "comment" && (
              <>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">💬 Comment on: {focusedIssue.title.slice(0, 40)}</p>
                <textarea
                  ref={commentTextareaRef}
                  autoFocus
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Escape") { setKbAction(null); return; }
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      if (!commentBody.trim()) return;
                      await fetch(`/api/issues/${focusedIssue.id}/comments`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ author: "pieter", body: commentBody.trim() }),
                      });
                      setCommentBody("");
                      setKbAction(null);
                    }
                  }}
                  placeholder="Write a comment…"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 resize-none transition"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-gray-600">⌘↵ to submit · Esc to cancel</span>
                  <button
                    onClick={async () => {
                      if (!commentBody.trim()) return;
                      await fetch(`/api/issues/${focusedIssue.id}/comments`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ author: "pieter", body: commentBody.trim() }),
                      });
                      setCommentBody("");
                      setKbAction(null);
                    }}
                    disabled={!commentBody.trim()}
                    className="text-xs px-3 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white font-medium transition disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </>
            )}

            <p className="text-[11px] text-gray-600 mt-3 text-center">Press Esc to cancel</p>
          </div>
        </div>
      )}

      {/* WIP limit soft-block toast */}
      {wipToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-2xl bg-orange-900/90 backdrop-blur-md border border-orange-500/40 shadow-2xl text-sm text-orange-200 font-medium pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
          {wipToast}
        </div>
      )}

      {/* Keyboard shortcut hint bar */}
      {focusedIssue && !kbAction && !detailIssue && !showShortcutsHelp && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900/90 backdrop-blur-md border border-white/10 shadow-xl text-[11px] text-gray-500 pointer-events-none">
          <span className="text-blue-400 font-medium truncate max-w-[200px]">{focusedIssue.title}</span>
          <span className="text-gray-700">·</span>
          {[["Enter","open"],["E","edit"],["C","comment"],["A","assign"],["L","label"],["S","status"],["D","done"],["?","help"]].map(([key, label]) => (
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

export default function KanbanPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 text-sm animate-pulse">Loading kanban board...</div></div>}>
      <KanbanPageInner />
    </Suspense>
  );
}
