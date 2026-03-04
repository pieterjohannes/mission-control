"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { ISSUE_TEMPLATES, type IssueTemplate } from "@/lib/issue-templates";
import { useEvents, type SSEEvent } from "@/lib/useEvents";
import { useSession } from "next-auth/react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import KeyboardShortcutsLegend from "@/components/KeyboardShortcutsLegend";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import StatusTimeline from "@/components/StatusTimeline";
import DependencyPanel from "@/components/DependencyPanel";

// ─── Types ───
interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: string;
  project: string | null;
  assignee: string | null;
  created_by: string | null;
  priority: string;
  labels: string;
  subtasks: string;
  position: number;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  effort_size: string | null;
}

interface Subtask {
  title: string;
  done: boolean;
}

const STATUSES = [
  { key: "backlog", label: "Backlog", icon: "○" },
  { key: "next", label: "Next", icon: "◐" },
  { key: "in_progress", label: "In Progress", icon: "●" },
  { key: "review", label: "Review", icon: "◉" },
  { key: "done", label: "Done", icon: "✓" },
];

const PRIORITY_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  urgent: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Urgent", icon: "🔴" },
  high: { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", label: "High", icon: "🟠" },
  medium: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "Medium", icon: "🟡" },
  low: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", label: "Low", icon: "⚪" },
};

const ASSIGNEE_EMOJI: Record<string, string> = {
  pieter: "👨‍💻", kai: "🤖", alma: "💜", tina: "🧹", vicky: "🛡️", stella: "⭐",
};

const EFFORT_CONFIG: Record<string, { label: string; color: string }> = {
  XS: { label: "XS", color: "bg-sky-500/20 text-sky-400 border border-sky-500/30" },
  S:  { label: "S",  color: "bg-teal-500/20 text-teal-400 border border-teal-500/30" },
  M:  { label: "M",  color: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" },
  L:  { label: "L",  color: "bg-orange-500/20 text-orange-400 border border-orange-500/30" },
  XL: { label: "XL", color: "bg-red-500/20 text-red-400 border border-red-500/30" },
};

const AUTHOR_AVATARS: Record<string, string> = {
  pieter: "👤", kai: "🚀", alma: "💜", tina: "🏠", vicky: "📖", stella: "⭐",
};

// ─── Aging Indicators ───
function getAgingLabel(updatedAt: string): { label: string; colorClass: string } | null {
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return null;
  const label = days < 7 ? `${days}d` : days < 30 ? `${Math.floor(days / 7)}w` : `${Math.floor(days / 30)}mo`;
  const colorClass =
    days < 3 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
    days < 7 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" :
    days < 14 ? "bg-orange-500/15 text-orange-400 border-orange-500/20" :
               "bg-red-500/15 text-red-400 border-red-500/20";
  return { label, colorClass };
}

function AgingBadge({ updatedAt }: { updatedAt: string }) {
  const aging = getAgingLabel(updatedAt);
  if (!aging) return null;
  return (
    <span
      title={`Last updated ${aging.label} ago`}
      className={`text-[10px] px-1 py-0.5 rounded border font-mono leading-none ${aging.colorClass}`}
    >
      {aging.label}
    </span>
  );
}

// ─── Due Date Badge ───
function getDueDateInfo(dueDate: string | null): { label: string; colorClass: string; isOverdue: boolean } | null {
  if (!dueDate) return null;
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  const diffMs = due - now;
  const diffHours = diffMs / (1000 * 60 * 60);
  const date = new Date(dueDate);
  const label = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (diffMs < 0) {
    return { label: `⚠ ${label}`, colorClass: "bg-red-500/20 text-red-400 border-red-500/40", isOverdue: true };
  } else if (diffHours <= 24) {
    return { label: `⏰ ${label}`, colorClass: "bg-orange-500/20 text-orange-400 border-orange-500/40", isOverdue: false };
  }
  return { label: `📅 ${label}`, colorClass: "bg-blue-500/10 text-blue-400 border-blue-500/20", isOverdue: false };
}

function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  const info = getDueDateInfo(dueDate);
  if (!info) return null;
  return (
    <span
      title={info.isOverdue ? "Overdue!" : "Due soon"}
      className={`text-[10px] px-1 py-0.5 rounded border font-mono leading-none ${info.colorClass}`}
    >
      {info.label}
    </span>
  );
}

const AGENT_GLOW_COLORS: Record<string, string> = {
  kai: "139, 92, 246",
  alma: "236, 72, 153",
  tina: "16, 185, 129",
  vicky: "245, 158, 11",
  stella: "234, 179, 8",
  hunter: "239, 68, 68",
  pieter: "59, 130, 246",
};

interface PulseInfo {
  issue_id: string;
  agent: string;
  action: string;
  last_pulse: string;
}

interface Comment {
  id: string;
  issue_id: string;
  author: string;
  body: string;
  created_at: string;
}

const LABEL_COLORS: Record<string, string> = {
  feature: "bg-purple-500/20 text-purple-300",
  ui: "bg-blue-500/20 text-blue-300",
  infra: "bg-teal-500/20 text-teal-300",
  integration: "bg-indigo-500/20 text-indigo-300",
  migration: "bg-amber-500/20 text-amber-300",
  ops: "bg-gray-500/20 text-gray-300",
  idea: "bg-pink-500/20 text-pink-300",
  ai: "bg-emerald-500/20 text-emerald-300",
  analytics: "bg-cyan-500/20 text-cyan-300",
  bug: "bg-red-500/20 text-red-300",
};

// ─── New Issue Modal ───
function NewIssueModal({
  onClose,
  onCreated,
  projects,
}: {
  onClose: () => void;
  onCreated: (issue: Issue) => void;
  projects: string[];
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<IssueTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [labels, setLabels] = useState("");
  const [project, setProject] = useState("");
  const [status, setStatus] = useState("backlog");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const applyTemplate = (tpl: IssueTemplate) => {
    setSelectedTemplate(tpl);
    setDescription(tpl.description);
    setPriority(tpl.priority);
    setLabels(tpl.labels.join(", "));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    const labelArr = labels.split(",").map((l) => l.trim()).filter(Boolean);
    const res = await fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description || null,
        status,
        priority,
        project: project || null,
        labels: JSON.stringify(labelArr),
        created_by: "kai",
        due_date: dueDate || null,
      }),
    });
    const issue = await res.json();
    onCreated(issue);
    setSubmitting(false);
    onClose();
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:bg-white/8 transition-colors";
  const selectClass = inputClass + " cursor-pointer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-100">New Issue</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl">×</button>
          </div>

          {/* Template picker */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Start from a template</p>
            <div className="flex flex-wrap gap-2">
              {ISSUE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    selectedTemplate?.id === tpl.id
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                      : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200"
                  }`}
                >
                  <span>{tpl.emoji}</span>
                  <span>{tpl.label}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              className={inputClass}
              placeholder="Issue title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
            <textarea
              className={inputClass + " min-h-[120px] resize-y font-mono text-xs"}
              placeholder="Description (markdown supported)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Priority</label>
                <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="urgent">🔴 Urgent</option>
                  <option value="high">🟠 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">⚪ Low</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Status</label>
                <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>{s.icon} {s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Project</label>
              <select className={selectClass} value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Labels (comma separated)</label>
              <input
                className={inputClass}
                placeholder="bug, feature, ui..."
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Due Date (optional)</label>
              <input
                type="date"
                className={inputClass + " [color-scheme:dark]"}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Creating..." : "Create Issue"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable Card ───
function SortableCard({
  issue,
  onClick,
  pulse,
  commentBadge,
  flash,
  onMobileMove,
  selected,
  onSelect,
  isBlocked,
  blockerCount,
  focused,
}: {
  issue: Issue;
  onClick: () => void;
  pulse?: PulseInfo | null;
  commentBadge?: number;
  flash?: boolean;
  onMobileMove?: (issue: Issue) => void;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  isBlocked?: boolean;
  blockerCount?: number;
  focused?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { type: "issue", issue },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <IssueCard issue={issue} onClick={onClick} pulse={pulse} commentBadge={commentBadge} flash={flash} onMobileMove={onMobileMove} selected={selected} onSelect={onSelect} isBlocked={isBlocked} blockerCount={blockerCount} focused={focused} />
    </div>
  );
}

// ─── Mobile Move Menu ───
function MobileMoveMenu({
  issue,
  onMove,
  onClose,
}: {
  issue: Issue;
  onMove: (issueId: string, newStatus: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#1a2036] border-t border-white/10 rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
        <p className="text-xs text-gray-500 mb-2">Move &ldquo;{issue.title}&rdquo; to:</p>
        <div className="space-y-1">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              disabled={s.key === issue.status}
              onClick={() => { onMove(issue.id, s.key); onClose(); }}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-3 transition-colors ${
                s.key === issue.status
                  ? "bg-purple-500/15 text-purple-300 border border-purple-500/20"
                  : "text-gray-300 hover:bg-white/5 active:bg-white/10"
              }`}
            >
              <span className="text-base">{s.icon}</span>
              <span>{s.label}</span>
              {s.key === issue.status && <span className="ml-auto text-xs text-purple-400">Current</span>}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-3 py-3 text-sm text-gray-500 hover:text-gray-300 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Issue Card ───
function IssueCard({
  issue,
  onClick,
  overlay,
  pulse,
  commentBadge,
  flash,
  onMobileMove,
  selected,
  onSelect,
  isBlocked,
  blockerCount,
  focused,
}: {
  issue: Issue;
  onClick?: () => void;
  overlay?: boolean;
  pulse?: PulseInfo | null;
  commentBadge?: number;
  flash?: boolean;
  onMobileMove?: (issue: Issue) => void;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  isBlocked?: boolean;
  blockerCount?: number;
  focused?: boolean;
}) {
  const labels: string[] = JSON.parse(issue.labels || "[]");
  const subtasks: Subtask[] = JSON.parse(issue.subtasks || "[]");
  const done = subtasks.filter((s) => s.done).length;
  const priority = PRIORITY_CONFIG[issue.priority];
  const glowRgb = pulse ? AGENT_GLOW_COLORS[pulse.agent] || "139, 92, 246" : "";

  // Aging indicator logic
  const agingDays = Math.floor((Date.now() - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24));
  const isAmberStale = issue.status === "backlog" && agingDays > 30;
  const isRedStale = issue.status === "review" && agingDays > 7;
  const agingTooltip = isRedStale
    ? `Needs review: inactive for ${agingDays} days`
    : isAmberStale
    ? `Stale: in backlog for ${agingDays} days`
    : null;

  return (
    <div
      onClick={onClick}
      className={`group p-3 rounded-xl border cursor-pointer card-transition ${
        overlay
          ? "bg-[#1a2036] border-purple-500/40 shadow-xl shadow-purple-500/10 rotate-2 scale-105"
          : selected
          ? "bg-[#1a2036]/90 border-purple-500/50 ring-1 ring-purple-500/30"
          : focused
          ? "bg-[#1a2036]/80 border-teal-500/50 ring-1 ring-teal-500/30"
          : isBlocked
          ? "bg-[#111827]/60 border-red-500/20 hover:border-red-500/30 hover:bg-[#1a1020]/80 opacity-60 hover:opacity-100"
          : "bg-[#111827]/80 border-white/[0.06] hover:border-purple-500/30 hover:bg-[#1a2036]/80"
      } ${pulse ? "agent-glow" : ""} ${flash ? "card-flash" : ""}`}
      style={pulse ? { "--glow-color": `rgba(${glowRgb}, 0.5)` } as React.CSSProperties : undefined}
    >
      {/* Agent pulse indicator */}
      {pulse && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-xs">{ASSIGNEE_EMOJI[pulse.agent] || "🤖"}</span>
          <span className="text-[10px] text-gray-400">
            {pulse.agent} is working
          </span>
          <span className="flex gap-0.5">
            <span className="typing-dot w-1 h-1 rounded-full bg-gray-400"></span>
            <span className="typing-dot w-1 h-1 rounded-full bg-gray-400"></span>
            <span className="typing-dot w-1 h-1 rounded-full bg-gray-400"></span>
          </span>
        </div>
      )}

      {/* Blocked badge */}
      {isBlocked && (
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-red-500/20 text-red-400 border border-red-500/30">
            🔒 Blocked{blockerCount && blockerCount > 1 ? ` (${blockerCount})` : ""}
          </span>
        </div>
      )}

      {/* Title + comment badge */}
      <div className="flex items-start justify-between gap-1 mb-2">
        <div className="flex items-start gap-1.5 min-w-0">
          {onSelect && !overlay && (
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(issue.id, !selected); }}
              className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                selected
                  ? "bg-purple-500 border-purple-400 text-white"
                  : "border-white/20 hover:border-purple-500/60 bg-transparent opacity-0 group-hover:opacity-100"
              }`}
              title={selected ? "Deselect" : "Select"}
            >
              {selected && <span className="text-[9px] font-bold">✓</span>}
            </button>
          )}
          {agingTooltip && (
            <span
              title={agingTooltip}
              className={`shrink-0 mt-1 w-2 h-2 rounded-full ${isRedStale ? "bg-red-500" : "bg-amber-400"}`}
            />
          )}
          <p className="text-sm font-medium text-gray-100 leading-snug">{issue.title}</p>
        </div>
        {(commentBadge ?? 0) > 0 && (
          <span className="shrink-0 w-5 h-5 rounded-full bg-purple-500/30 text-purple-300 text-[10px] font-bold flex items-center justify-center badge-pulse">
            {commentBadge}
          </span>
        )}
      </div>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {labels.map((l) => (
            <span key={l} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${LABEL_COLORS[l] || "bg-white/10 text-gray-400"}`}>
              {l}
            </span>
          ))}
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <div className="flex items-center gap-2">
          {/* Priority */}
          {priority && <span title={priority.label}>{priority.icon}</span>}
          {/* Assignee */}
          {issue.assignee && (
            <span title={issue.assignee} className="text-xs">
              {ASSIGNEE_EMOJI[issue.assignee] || "👤"}{" "}
              <span className="text-gray-500">{issue.assignee}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Subtask progress */}
          {subtasks.length > 0 && (
            <span className={`${done === subtasks.length ? "text-emerald-400" : "text-gray-500"}`}>
              ☑ {done}/{subtasks.length}
            </span>
          )}
          {/* Effort size badge */}
          {issue.effort_size && EFFORT_CONFIG[issue.effort_size] && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${EFFORT_CONFIG[issue.effort_size].color}`}>
              {EFFORT_CONFIG[issue.effort_size].label}
            </span>
          )}
          {/* Due date badge */}
          <DueDateBadge dueDate={issue.due_date} />
          {/* Aging badge */}
          <AgingBadge updatedAt={issue.updated_at} />
          <span className="text-gray-600 font-mono">{issue.id}</span>
        </div>
      </div>

      {/* Mobile move button */}
      {onMobileMove && !overlay && (
        <button
          onClick={(e) => { e.stopPropagation(); onMobileMove(issue); }}
          className="md:hidden mt-2 w-full py-1.5 text-[11px] text-gray-500 hover:text-gray-300 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg transition-colors active:bg-white/10 flex items-center justify-center gap-1"
        >
          <span>↕</span> Move
        </button>
      )}

      {/* Segmented subtask progress bar */}
      {subtasks.length > 0 && (
        <div className="flex gap-[2px] mt-2.5 -mx-3 -mb-3 px-3 pb-3 rounded-b-xl overflow-hidden">
          {subtasks.map((st, i) => (
            <div
              key={i}
              className={`h-[3px] flex-1 rounded-full transition-all duration-500 ${
                st.done
                  ? "bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_4px_rgba(52,211,153,0.4)]"
                  : "bg-white/[0.06]"
              }`}
              title={`${st.title}${st.done ? " ✓" : ""}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Column ───
function Column({
  status,
  issues,
  onCardClick,
  onQuickAdd,
  collapsed,
  pulses,
  commentBadges,
  flashIds,
  onMobileMove,
  selectedIds,
  onSelect,
  blockedIds,
  focusedIssueId,
  onFocus,
}: {
  status: (typeof STATUSES)[number];
  issues: Issue[];
  onCardClick: (issue: Issue) => void;
  onQuickAdd: (status: string) => void;
  collapsed: Set<string>;
  pulses: Map<string, PulseInfo>;
  commentBadges: Map<string, number>;
  flashIds: Set<string>;
  onMobileMove?: (issue: Issue) => void;
  selectedIds?: Set<string>;
  onSelect?: (id: string, checked: boolean) => void;
  blockedIds?: Map<string, number>;
  focusedIssueId?: string | null;
  onFocus?: (id: string) => void;
}) {
  const [quickTitle, setQuickTitle] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  return (
    <div className="flex-shrink-0 w-full md:w-72 flex flex-col md:max-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-60">{status.icon}</span>
          <h3 className="text-sm font-semibold text-gray-300">{status.label}</h3>
          <span className="text-xs text-gray-600 bg-white/5 rounded-full px-2 py-0.5">{issues.length}</span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[60px]">
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <SortableCard
              key={issue.id}
              issue={issue}
              onClick={() => { onFocus?.(issue.id); onCardClick(issue); }}
              pulse={pulses.get(issue.id)}
              commentBadge={commentBadges.get(issue.id)}
              flash={flashIds.has(issue.id)}
              onMobileMove={onMobileMove}
              selected={selectedIds?.has(issue.id)}
              onSelect={onSelect}
              isBlocked={(blockedIds?.get(issue.id) ?? 0) > 0}
              blockerCount={blockedIds?.get(issue.id)}
              focused={focusedIssueId === issue.id}
            />
          ))}
        </SortableContext>
      </div>

      {/* Quick add */}
      {showQuickAdd ? (
        <div className="mt-2">
          <input
            autoFocus
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && quickTitle.trim()) {
                onQuickAdd(quickTitle.trim());
                setQuickTitle("");
                setShowQuickAdd(false);
              }
              if (e.key === "Escape") { setShowQuickAdd(false); setQuickTitle(""); }
            }}
            onBlur={() => { if (!quickTitle.trim()) setShowQuickAdd(false); }}
            placeholder="Issue title..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
          />
        </div>
      ) : (
        <button
          onClick={() => setShowQuickAdd(true)}
          className="mt-2 w-full text-left px-3 py-1.5 text-sm text-gray-600 hover:text-gray-400 hover:bg-white/5 rounded-lg transition-colors"
        >
          + Add issue
        </button>
      )}
    </div>
  );
}

// ─── Issue Links Panel ───
function IssueLinksPanel({ issueId, allIssues }: { issueId: string; allIssues: Issue[] }) {
  const [links, setLinks] = useState<{ blocking: Issue[]; blocked_by: Issue[] }>({ blocking: [], blocked_by: [] });
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState<"blocking" | "blocked_by" | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    fetch(`/api/issues/${issueId}/links`).then(r => r.json()).then(setLinks);
  };

  useEffect(() => { load(); }, [issueId]);

  const linkedIds = new Set([...links.blocking.map(i => i.id), ...links.blocked_by.map(i => i.id), issueId]);
  const filteredIssues = allIssues.filter(i =>
    !linkedIds.has(i.id) &&
    (search === "" || i.title.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 8);

  const addLink = async (targetId: string, type: "blocking" | "blocked_by") => {
    setLoading(true);
    if (type === "blocking") {
      // This issue blocks targetId
      await fetch(`/api/issues/${issueId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId, type: "blocks" }),
      });
    } else {
      // targetId blocks this issue
      await fetch(`/api/issues/${targetId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: issueId, type: "blocks" }),
      });
    }
    setLoading(false);
    setShowPicker(null);
    setSearch("");
    load();
  };

  const removeLink = async (targetId: string, type: "blocking" | "blocked_by") => {
    if (type === "blocking") {
      await fetch(`/api/issues/${issueId}/links`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId, type: "blocks" }),
      });
    } else {
      await fetch(`/api/issues/${targetId}/links`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: issueId, type: "blocks" }),
      });
    }
    load();
  };

  const LinkRow = ({ issue, onRemove }: { issue: Issue; onRemove: () => void }) => (
    <div className="flex items-center gap-2 group/lr py-1">
      <span className="text-xs font-mono text-gray-500 shrink-0">{issue.id}</span>
      <span className="text-xs text-gray-300 flex-1 truncate">{issue.title}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
        issue.status === "done" ? "text-emerald-400 bg-emerald-500/10" :
        issue.status === "in_progress" ? "text-amber-400 bg-amber-500/10" :
        "text-gray-500 bg-white/5"
      }`}>{issue.status}</span>
      <button onClick={onRemove} className="text-gray-600 hover:text-red-400 opacity-0 group-hover/lr:opacity-100 text-xs transition-opacity">✕</button>
    </div>
  );

  return (
    <div>
      <label className="text-xs text-gray-500 mb-2 block">🔗 Issue Links</label>

      {/* Blocking */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-orange-400 font-medium">Blocks</span>
          <button onClick={() => { setShowPicker("blocking"); setSearch(""); }} className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">+ Add</button>
        </div>
        {links.blocking.length === 0 ? (
          <p className="text-xs text-gray-600 italic">Not blocking any issues</p>
        ) : (
          <div className="space-y-0.5">
            {links.blocking.map(i => <LinkRow key={i.id} issue={i} onRemove={() => removeLink(i.id, "blocking")} />)}
          </div>
        )}
      </div>

      {/* Blocked by */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-red-400 font-medium">Blocked by</span>
          <button onClick={() => { setShowPicker("blocked_by"); setSearch(""); }} className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">+ Add</button>
        </div>
        {links.blocked_by.length === 0 ? (
          <p className="text-xs text-gray-600 italic">Not blocked by any issues</p>
        ) : (
          <div className="space-y-0.5">
            {links.blocked_by.map(i => <LinkRow key={i.id} issue={i} onRemove={() => removeLink(i.id, "blocked_by")} />)}
          </div>
        )}
      </div>

      {/* Issue picker */}
      {showPicker && (
        <div className="mt-2 bg-white/5 border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">
              {showPicker === "blocking" ? "Select issue to block" : "Select issue that blocks this"}
            </span>
            <button onClick={() => setShowPicker(null)} className="text-gray-600 hover:text-gray-300 text-xs">✕</button>
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
            {filteredIssues.map(i => (
              <button
                key={i.id}
                disabled={loading}
                onClick={() => addLink(i.id, showPicker)}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/8 transition-colors group/pick"
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

// ─── Detail Panel ───
function DetailPanel({
  issue,
  onClose,
  onUpdate,
  onDelete,
  subscribe,
  onOpenClearBadge,
  projects,
  allIssues,
}: {
  issue: Issue;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Issue>) => void;
  onDelete: (id: string) => void;
  subscribe: (type: string, cb: (evt: SSEEvent) => void) => () => void;
  projects: string[];
  onOpenClearBadge: (id: string) => void;
  allIssues: Issue[];
}) {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description || "");
  const [status, setStatus] = useState(issue.status);
  const [priority, setPriority] = useState(issue.priority);
  const [assignee, setAssignee] = useState(issue.assignee || "");
  const [project, setProject] = useState(issue.project || "");
  const [labelsStr, setLabelsStr] = useState((JSON.parse(issue.labels || "[]") as string[]).join(", "));
  const [dueDate, setDueDate] = useState(issue.due_date || "");
  const [effortSize, setEffortSize] = useState(issue.effort_size || "");
  const [subtasks, setSubtasks] = useState<Subtask[]>(JSON.parse(issue.subtasks || "[]"));
  const [newSubtask, setNewSubtask] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const { data: session } = useSession();
  const commentAuthor = session?.user?.name?.toLowerCase() || "kai";
  const [loadingComments, setLoadingComments] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const save = useCallback(() => {
    const labels = labelsStr.split(",").map(s => s.trim()).filter(Boolean);
    onUpdate(issue.id, { title, description, status, priority, assignee: assignee || null, project: project || null, labels, subtasks, due_date: dueDate || null, effort_size: effortSize || null } as any);
  }, [title, description, status, priority, assignee, project, labelsStr, subtasks, dueDate, effortSize, issue.id, onUpdate]);

  // Auto-save on change — skip initial mount
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const t = setTimeout(save, 500);
    return () => clearTimeout(t);
  }, [save]);

  // Reset when issue changes
  useEffect(() => {
    setTitle(issue.title);
    setDescription(issue.description || "");
    setStatus(issue.status);
    setPriority(issue.priority);
    setAssignee(issue.assignee || "");
    setProject(issue.project || "");
    setLabelsStr((JSON.parse(issue.labels || "[]") as string[]).join(", "));
    setSubtasks(JSON.parse(issue.subtasks || "[]"));
    setDueDate(issue.due_date || "");
    setEffortSize(issue.effort_size || "");
    // Load comments
    setLoadingComments(true);
    fetch(`/api/issues/${issue.id}/comments`).then(r => r.json()).then(setComments).finally(() => setLoadingComments(false));

    // Clear badge
    onOpenClearBadge(issue.id);
    // Reset mount flag so auto-save skips initial state set for new card
    mountedRef.current = false;
    setTimeout(() => { mountedRef.current = true; }, 600);
  }, [issue.id]);

  // Live comments via SSE
  useEffect(() => {
    return subscribe("comment_added", (evt: SSEEvent) => {
      if ((evt.issueId as string) === issue.id) {
        const comment = evt.comment as Comment;
        if (comment && !localCommentIds.current.has(comment.id)) {
          setComments((prev) => {
            if (prev.some((c) => c.id === comment.id)) return prev;
            return [...prev, comment];
          });
          setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      }
    });
  }, [issue.id, subscribe]);

  const localCommentIds = useRef<Set<string>>(new Set());

  const submitComment = async () => {
    if (!commentBody.trim()) return;
    const body = commentBody.trim();
    setCommentBody("");
    const res = await fetch(`/api/issues/${issue.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: commentAuthor, body }),
    });
    if (res.ok) {
      const comment = await res.json();
      localCommentIds.current.add(comment.id);
      setComments(prev => {
        if (prev.some((c) => c.id === comment.id)) return prev;
        return [...prev, comment];
      });
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const renderCommentBody = (text: string) => {
    return text.split(/(@\w+)/g).map((part, i) =>
      part.startsWith("@") ? <span key={i} className="text-purple-400 font-medium">{part}</span> : part
    );
  };

  const toggleSubtask = (idx: number) => {
    const next = [...subtasks];
    next[idx] = { ...next[idx], done: !next[idx].done };
    setSubtasks(next);
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks([...subtasks, { title: newSubtask.trim(), done: false }]);
    setNewSubtask("");
  };

  const removeSubtask = (idx: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== idx));
  };

  const selectClass = "bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none w-full";
  const inputClass = selectClass;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-[#0d1117] border-l border-white/10 z-50 overflow-y-auto animate-slide-in overscroll-contain"
      >
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-mono">{issue.id}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => onDelete(issue.id)} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">Delete</button>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">✕</button>
            </div>
          </div>

          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-xl font-bold text-white focus:outline-none border-b border-transparent focus:border-purple-500/30 pb-1"
          />

          {/* Fields grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectClass}>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Assignee</label>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={selectClass}>
                <option value="">Unassigned</option>
                {Object.entries(ASSIGNEE_EMOJI).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Project</label>
              <select value={projects.includes(project) ? project : "__custom__"} onChange={(e) => { if (e.target.value === "__custom__") { const name = prompt("New project name:"); if (name) setProject(name); } else { setProject(e.target.value); } }} className={selectClass}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p} value={p}>{p}</option>)}
                {project && !projects.includes(project) && <option value="__custom__">📝 {project}</option>}
                <option value="__custom__">+ New project...</option>
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Due Date</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={selectClass + " flex-1 [color-scheme:dark]"}
              />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate("")}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                  title="Clear due date"
                >✕</button>
              )}
            </div>
            {dueDate && <DueDateBadge dueDate={dueDate} />}
          </div>

          {/* Effort Size */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Effort Size</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {["", "XS", "S", "M", "L", "XL"].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setEffortSize(size)}
                  className={`text-xs px-2.5 py-1 rounded-full font-bold transition-colors ${
                    effortSize === size
                      ? size
                        ? EFFORT_CONFIG[size].color + " ring-1 ring-offset-1 ring-offset-[#0d1117]"
                        : "bg-white/20 text-gray-200 ring-1 ring-offset-1 ring-offset-[#0d1117]"
                      : "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300"
                  }`}
                >
                  {size || "—"}
                </button>
              ))}
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Labels (comma-separated)</label>
            <input value={labelsStr} onChange={(e) => setLabelsStr(e.target.value)} placeholder="feature, ui, bug" className={inputClass} />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={4}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Subtasks */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">
              Subtasks {subtasks.length > 0 && `(${subtasks.filter(s => s.done).length}/${subtasks.length})`}
            </label>
            {subtasks.length > 0 && (
              <div className="mb-2 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-teal-500 transition-all duration-300"
                  style={{ width: `${(subtasks.filter(s => s.done).length / subtasks.length) * 100}%` }}
                />
              </div>
            )}
            <div className="space-y-1">
              {subtasks.map((st, i) => (
                <div key={i} className="flex items-center gap-2 group/st">
                  <button onClick={() => toggleSubtask(i)} className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-[10px] transition-colors ${st.done ? "bg-purple-500/30 border-purple-500/50 text-purple-300" : "border-white/20 hover:border-purple-500/50"}`}>
                    {st.done && "✓"}
                  </button>
                  <span className={`text-sm flex-1 ${st.done ? "text-gray-500 line-through" : "text-gray-300"}`}>{st.title}</span>
                  <button onClick={() => removeSubtask(i)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover/st:opacity-100 text-xs transition-opacity">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                placeholder="Add subtask..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-purple-500/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Links */}
          <IssueLinksPanel issueId={issue.id} allIssues={allIssues} />

          {/* Dependency Graph (blocks/blocked-by) */}
          <div className="border-t border-white/10 pt-4">
            <DependencyPanel
              issueId={issue.id}
              issueTitle={issue.title}
              allIssues={allIssues}
            />
          </div>

          {/* Status History */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">
              🕐 Status History
            </label>
            <StatusTimeline issueId={issue.id} />
          </div>

          {/* Comments */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">
              💬 Comments {comments.length > 0 && `(${comments.length})`}
            </label>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {loadingComments && <p className="text-xs text-gray-600">Loading...</p>}
              {!loadingComments && comments.length === 0 && (
                <p className="text-xs text-gray-600 italic">No comments yet</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <span className="text-lg flex-shrink-0 mt-0.5">{AUTHOR_AVATARS[c.author] || "👤"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white/5 border border-white/[0.06] rounded-xl rounded-tl-sm px-3 py-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-gray-300">{c.author}</span>
                        <span className="text-[10px] text-gray-600">{new Date(c.created_at + "Z").toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{renderCommentBody(c.body)}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>
            {/* Add comment */}
            <div className="mt-3 flex gap-2">
              <span className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300 w-24 flex-shrink-0 flex items-center gap-1">
                {AUTHOR_AVATARS[commentAuthor] || "👤"} {commentAuthor}
              </span>
              <input
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                placeholder="Write a comment..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-purple-500/50 focus:outline-none"
              />
              <button
                onClick={submitComment}
                disabled={!commentBody.trim()}
                className="bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                Send
              </button>
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-600 space-y-1 pt-2 border-t border-white/5">
            <p>Created by {issue.created_by} · {new Date(issue.created_at + "Z").toLocaleString()}</p>
            <p>Updated · {new Date(issue.updated_at + "Z").toLocaleString()}</p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Filter Bar ───
interface SavedFilter {
  id: string;
  name: string;
  filters: { project: string; assignee: string; priority: string };
}

const SAVED_FILTERS_KEY = "mc_saved_filters";
const LAST_FILTER_KEY = "mc_last_filter";

function loadSavedFilters(): SavedFilter[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSavedFilters(filters: SavedFilter[]) {
  localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
}

function loadLastFilter(): { project: string; assignee: string; priority: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_FILTER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function FilterBar({
  filters,
  setFilters,
  projects,
  assignees,
}: {
  filters: { project: string; assignee: string; priority: string };
  setFilters: (f: any) => void;
  projects: string[];
  assignees: string[];
}) {
  const selectClass = "bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:border-purple-500/50 focus:outline-none";
  const hasFilters = filters.project || filters.assignee || filters.priority;

  const [savedViews, setSavedViews] = useState<SavedFilter[]>(() => loadSavedFilters());
  const [saving, setSaving] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Persist last active filter whenever it changes
  useEffect(() => {
    localStorage.setItem(LAST_FILTER_KEY, JSON.stringify(filters));
    // Deselect active view if filters changed from it
    if (activeViewId) {
      const activeView = savedViews.find((v) => v.id === activeViewId);
      if (activeView) {
        const f = activeView.filters;
        if (f.project !== filters.project || f.assignee !== filters.assignee || f.priority !== filters.priority) {
          setActiveViewId(null);
        }
      }
    }
  }, [filters]);

  const applyView = (view: SavedFilter) => {
    setFilters(view.filters);
    setActiveViewId(view.id);
  };

  const saveCurrentFilter = () => {
    const name = newViewName.trim();
    if (!name || !hasFilters) return;
    const newView: SavedFilter = {
      id: `view-${Date.now()}`,
      name,
      filters: { ...filters },
    };
    const updated = [...savedViews, newView];
    setSavedViews(updated);
    saveSavedFilters(updated);
    setNewViewName("");
    setSaving(false);
    setActiveViewId(newView.id);
  };

  const deleteView = (id: string) => {
    const updated = savedViews.filter((v) => v.id !== id);
    setSavedViews(updated);
    saveSavedFilters(updated);
    if (activeViewId === id) setActiveViewId(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Saved views row */}
      {savedViews.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-600">Views:</span>
          {savedViews.map((view) => (
            <div key={view.id} className="flex items-center group/view">
              <button
                onClick={() => applyView(view)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-l-lg text-xs border transition-colors ${
                  activeViewId === view.id
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                    : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/8 hover:text-gray-200"
                }`}
              >
                🔖 {view.name}
              </button>
              <button
                onClick={() => deleteView(view.id)}
                className={`px-1.5 py-1 rounded-r-lg text-xs border border-l-0 transition-colors opacity-0 group-hover/view:opacity-100 ${
                  activeViewId === view.id
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/40 hover:bg-red-500/20 hover:text-red-400"
                    : "bg-white/5 text-gray-600 border-white/10 hover:bg-red-500/20 hover:text-red-400"
                }`}
                title="Delete view"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filter controls row */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filters.project} onChange={(e) => setFilters({ ...filters, project: e.target.value })} className={selectClass}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filters.assignee} onChange={(e) => setFilters({ ...filters, assignee: e.target.value })} className={selectClass}>
          <option value="">All Assignees</option>
          {assignees.map((a) => <option key={a} value={a}>{ASSIGNEE_EMOJI[a] || "👤"} {a}</option>)}
        </select>
        <select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} className={selectClass}>
          <option value="">All Priorities</option>
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setFilters({ project: "", assignee: "", priority: "" }); setActiveViewId(null); }} className="text-xs text-gray-500 hover:text-gray-300">
            ✕ Clear
          </button>
        )}

        {/* Save current filter as view */}
        {hasFilters && !saving && (
          <button
            onClick={() => setSaving(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-white/10 transition-colors"
            title="Save current filter as a view"
          >
            🔖 Save view
          </button>
        )}
        {saving && (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCurrentFilter();
                if (e.key === "Escape") { setSaving(false); setNewViewName(""); }
              }}
              placeholder="View name…"
              className="bg-white/5 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-gray-200 placeholder-gray-600 focus:border-purple-500/50 focus:outline-none w-32"
            />
            <button
              onClick={saveCurrentFilter}
              disabled={!newViewName.trim()}
              className="px-2.5 py-1 rounded-lg text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 disabled:opacity-40 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setSaving(false); setNewViewName(""); }}
              className="text-xs text-gray-600 hover:text-gray-400"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bulk Action Bar ───
function BulkActionBar({
  selectedIds,
  onClearSelection,
  onBulkAction,
  issues,
}: {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onBulkAction: (action: "status" | "priority" | "assignee" | "delete", value?: string) => void;
  issues: Issue[];
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const count = selectedIds.size;

  if (count === 0) return null;

  const closeMenus = () => {
    setShowStatusMenu(false);
    setShowPriorityMenu(false);
    setShowAssigneeMenu(false);
  };

  return (
    <>
      {/* Backdrop to close menus */}
      {(showStatusMenu || showPriorityMenu || showAssigneeMenu) && (
        <div className="fixed inset-0 z-[55]" onClick={closeMenus} />
      )}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-3 bg-[#1a1a2e]/95 backdrop-blur-md border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-900/30 animate-fade-in">
        {/* Count + clear */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
          <span className="w-6 h-6 bg-purple-500 rounded-full text-white text-xs font-bold flex items-center justify-center">{count}</span>
          <span className="text-sm text-gray-300">selected</span>
          <button onClick={onClearSelection} className="text-gray-600 hover:text-gray-300 text-sm ml-1" title="Clear selection">✕</button>
        </div>

        {/* Status */}
        <div className="relative">
          <button
            onClick={() => { closeMenus(); setShowStatusMenu(v => !v); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors"
          >
            <span>Status</span>
            <span className="text-gray-500">▾</span>
          </button>
          {showStatusMenu && (
            <div className="absolute bottom-full mb-2 left-0 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden w-40 z-[65]">
              {STATUSES.map((s) => (
                <button key={s.key} onClick={() => { onBulkAction("status", s.key); closeMenus(); }} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/8 flex items-center gap-2 transition-colors">
                  <span>{s.icon}</span> {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priority */}
        <div className="relative">
          <button
            onClick={() => { closeMenus(); setShowPriorityMenu(v => !v); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors"
          >
            <span>Priority</span>
            <span className="text-gray-500">▾</span>
          </button>
          {showPriorityMenu && (
            <div className="absolute bottom-full mb-2 left-0 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden w-36 z-[65]">
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                <button key={k} onClick={() => { onBulkAction("priority", k); closeMenus(); }} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/8 flex items-center gap-2 transition-colors">
                  <span>{v.icon}</span> {v.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assignee */}
        <div className="relative">
          <button
            onClick={() => { closeMenus(); setShowAssigneeMenu(v => !v); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors"
          >
            <span>Assign</span>
            <span className="text-gray-500">▾</span>
          </button>
          {showAssigneeMenu && (
            <div className="absolute bottom-full mb-2 left-0 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden w-40 z-[65]">
              <button onClick={() => { onBulkAction("assignee", ""); closeMenus(); }} className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-white/8 transition-colors">
                — Unassign
              </button>
              {Object.entries(ASSIGNEE_EMOJI).map(([k, v]) => (
                <button key={k} onClick={() => { onBulkAction("assignee", k); closeMenus(); }} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/8 flex items-center gap-2 transition-colors">
                  <span>{v}</span> {k}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={() => {
            if (confirm(`Delete ${count} issue${count > 1 ? "s" : ""}? This cannot be undone.`)) {
              onBulkAction("delete");
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-colors ml-1"
        >
          🗑 Delete
        </button>
      </div>
    </>
  );
}

// ─── View Toggle ───
type ViewMode = "board" | "swimlane" | "list";

// ─── Main Page ───
export default function ProjectsPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState(() => loadLastFilter() ?? { project: "", assignee: "", priority: "" });
  const [pulses, setPulses] = useState<Map<string, PulseInfo>>(new Map());
  const [commentBadges, setCommentBadges] = useState<Map<string, number>>(new Map());
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [mobileMovingIssue, setMobileMovingIssue] = useState<Issue | null>(null);
  const [showNewIssueModal, setShowNewIssueModal] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Map<string, number>>(new Map());
  const [focusedIssueId, setFocusedIssueId] = useState<string | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { subscribe } = useEvents();

  // ─── Keyboard shortcuts ───
  const flatIssues = issues; // all visible issues in current filter
  useKeyboardShortcuts({
    disabled: showNewIssueModal || !!selectedIssue || showShortcutsHelp,
    onNewIssue: () => setShowNewIssueModal(true),
    onClose: () => {
      if (showShortcutsHelp) { setShowShortcutsHelp(false); return; }
      if (showNewIssueModal) { setShowNewIssueModal(false); return; }
      if (selectedIssue) { setSelectedIssue(null); return; }
    },
    onToggleHelp: () => setShowShortcutsHelp((v) => !v),
    onNavigateNext: () => {
      if (flatIssues.length === 0) return;
      const idx = flatIssues.findIndex((i) => i.id === focusedIssueId);
      const nextIdx = idx < flatIssues.length - 1 ? idx + 1 : 0;
      setFocusedIssueId(flatIssues[nextIdx].id);
    },
    onNavigatePrev: () => {
      if (flatIssues.length === 0) return;
      const idx = flatIssues.findIndex((i) => i.id === focusedIssueId);
      const prevIdx = idx > 0 ? idx - 1 : flatIssues.length - 1;
      setFocusedIssueId(flatIssues[prevIdx].id);
    },
    onEditFocused: () => {
      if (!focusedIssueId) return;
      const issue = flatIssues.find((i) => i.id === focusedIssueId);
      if (issue) setSelectedIssue(issue);
    },
    onMarkDone: () => {
      if (!focusedIssueId) return;
      const issue = flatIssues.find((i) => i.id === focusedIssueId);
      if (issue && issue.status !== "done") {
        updateIssue(issue.id, { status: "done" });
        setIssues((prev) => prev.map((i) => i.id === focusedIssueId ? { ...i, status: "done" } : i));
      }
    },
  });

  // SSE subscriptions
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      subscribe("issue_updated", (evt: SSEEvent) => {
        const issueId = evt.issueId as string;
        // Flash the card
        setFlashIds((prev) => new Set(prev).add(issueId));
        setTimeout(() => setFlashIds((prev) => { const n = new Set(prev); n.delete(issueId); return n; }), 1200);
        // Refetch
        load();
      })
    );

    unsubs.push(
      subscribe("comment_added", (evt: SSEEvent) => {
        const issueId = evt.issueId as string;
        setCommentBadges((prev) => {
          const n = new Map(prev);
          n.set(issueId, (n.get(issueId) || 0) + 1);
          return n;
        });
      })
    );

    unsubs.push(
      subscribe("agent_pulse", (evt: SSEEvent) => {
        const issueId = evt.issueId as string;
        const action = evt.action as string;
        const agent = evt.agent as string;
        setPulses((prev) => {
          const n = new Map(prev);
          if (action === "idle") {
            n.delete(issueId);
          } else {
            n.set(issueId, { issue_id: issueId, agent, action, last_pulse: new Date().toISOString() });
          }
          return n;
        });
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [subscribe]);

  // Fetch initial pulses
  useEffect(() => {
    fetch("/api/pulse").then((r) => r.json()).then((data: PulseInfo[]) => {
      const m = new Map<string, PulseInfo>();
      for (const p of data) m.set(p.issue_id, p);
      setPulses(m);
    }).catch(() => {});
  }, []);

  // Clear stale pulses every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      setPulses((prev) => {
        const n = new Map(prev);
        const cutoff = Date.now() - 30000;
        for (const [id, p] of n) {
          if (new Date(p.last_pulse).getTime() < cutoff) n.delete(id);
        }
        return n.size === prev.size ? prev : n;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadBlockedIds = useCallback(() => {
    fetch("/api/issues/blocked-ids").then(r => r.json()).then((rows: { id: string; count: number }[]) => {
      setBlockedIds(new Map(rows.map((r) => [r.id, r.count])));
    });
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.project) params.set("project", filters.project);
    if (filters.assignee) params.set("assignee", filters.assignee);
    if (filters.priority) params.set("priority", filters.priority);
    fetch(`/api/issues?${params}`).then((r) => r.json()).then(setIssues);
    loadBlockedIds();
  }, [filters, loadBlockedIds]);

  useEffect(() => { load(); }, [load]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Unique projects and assignees
  const projects = [...new Set(issues.map((i) => i.project).filter(Boolean))] as string[];
  const assignees = [...new Set(issues.map((i) => i.assignee).filter(Boolean))] as string[];

  // Group issues by status
  const byStatus = (status: string) => issues.filter((i) => i.status === status).sort((a, b) => a.position - b.position);

  // Group issues by project then status
  const byProject = () => {
    const grouped: Record<string, Issue[]> = {};
    for (const issue of issues) {
      const proj = issue.project || "Uncategorized";
      if (!grouped[proj]) grouped[proj] = [];
      grouped[proj].push(issue);
    }
    return grouped;
  };

  const toggleLane = (proj: string) => {
    setCollapsedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(proj)) next.delete(proj);
      else next.add(proj);
      return next;
    });
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIssue = issues.find((i) => i.id === active.id);
    if (!activeIssue) return;

    // Check if dragging over a column (status key)
    const overStatus = STATUSES.find((s) => s.key === over.id);
    if (overStatus && activeIssue.status !== overStatus.key) {
      setIssues((prev) =>
        prev.map((i) => (i.id === active.id ? { ...i, status: overStatus.key } : i))
      );
      return;
    }

    // Dragging over another issue
    const overIssue = issues.find((i) => i.id === over.id);
    if (overIssue && activeIssue.status !== overIssue.status) {
      setIssues((prev) =>
        prev.map((i) => (i.id === active.id ? { ...i, status: overIssue.status } : i))
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeIssue = issues.find((i) => i.id === active.id);
    if (!activeIssue) return;

    // Determine target status
    let targetStatus = activeIssue.status;
    const overStatus = STATUSES.find((s) => s.key === over.id);
    if (overStatus) targetStatus = overStatus.key;
    const overIssue = issues.find((i) => i.id === over.id);
    if (overIssue) targetStatus = overIssue.status;

    // Get issues in target column
    let columnIssues = issues.filter((i) => i.status === targetStatus && i.id !== active.id).sort((a, b) => a.position - b.position);

    // Find insert position
    let insertIdx = columnIssues.length;
    if (overIssue && overIssue.status === targetStatus) {
      insertIdx = columnIssues.findIndex((i) => i.id === over.id);
      if (insertIdx === -1) insertIdx = columnIssues.length;
    }

    // Insert active issue
    const updatedIssue = { ...activeIssue, status: targetStatus };
    columnIssues.splice(insertIdx, 0, updatedIssue);

    // Build reorder items
    const reorderItems = columnIssues.map((issue, idx) => ({
      id: issue.id,
      status: targetStatus,
      position: idx,
    }));

    // Optimistic update
    setIssues((prev) => {
      const next = prev.map((i) => {
        const reordered = reorderItems.find((r) => r.id === i.id);
        if (reordered) return { ...i, status: reordered.status, position: reordered.position };
        return i;
      });
      return next;
    });

    // Persist
    await fetch(`/api/issues/${active.id}/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: reorderItems }),
    });
  };

  // Quick add
  const quickAdd = async (status: string, title: string, project?: string) => {
    const res = await fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, status, project, created_by: "kai" }),
    });
    const issue = await res.json();
    setIssues((prev) => [...prev, issue]);
  };

  // Update issue
  const updateIssue = async (id: string, data: Partial<Issue>) => {
    await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    // Reload to get fresh data
    load();
  };

  // Delete issue
  const deleteIssue = async (id: string) => {
    await fetch(`/api/issues/${id}`, { method: "DELETE" });
    setSelectedIssue(null);
    setIssues((prev) => prev.filter((i) => i.id !== id));
  };

  // Selection handlers
  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleBulkAction = useCallback(async (action: "status" | "priority" | "assignee" | "delete", value?: string) => {
    const ids = [...selectedIds];
    await fetch("/api/issues/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action, value: value ?? null, changed_by: "pieter" }),
    });

    if (action === "delete") {
      setIssues((prev) => prev.filter((i) => !selectedIds.has(i.id)));
      if (selectedIssue && selectedIds.has(selectedIssue.id)) setSelectedIssue(null);
    } else {
      setIssues((prev) => prev.map((i) => {
        if (!selectedIds.has(i.id)) return i;
        if (action === "status") return { ...i, status: value! };
        if (action === "priority") return { ...i, priority: value! };
        if (action === "assignee") return { ...i, assignee: value || null };
        return i;
      }));
    }
    setSelectedIds(new Set());
  }, [selectedIds, selectedIssue]);

  const handleMobileMove = async (issueId: string, newStatus: string) => {
    setIssues((prev) => prev.map((i) => (i.id === issueId ? { ...i, status: newStatus } : i)));
    await fetch(`/api/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
  };

  const activeIssue = issues.find((i) => i.id === activeId);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold gradient-text">📋 Issues</h1>
          <p className="text-gray-500 text-sm mt-0.5">{issues.length} issues across {projects.length} projects</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Keyboard shortcuts hint */}
          <button
            onClick={() => setShowShortcutsHelp(true)}
            title="Keyboard shortcuts (?)"
            className="hidden md:flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-white/10 transition-colors"
          >
            <kbd className="font-mono">?</kbd>
          </button>
          {/* New Issue button */}
          <button
            onClick={() => setShowNewIssueModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
          >
            <span>＋</span> New Issue <span className="hidden md:inline text-purple-400/60 text-xs ml-0.5">[N]</span>
          </button>
          {/* View toggle */}
          <div className="flex bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("board")}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${viewMode === "board" ? "bg-purple-500/20 text-purple-300" : "text-gray-500 hover:text-gray-300"}`}
            >
              Board
            </button>
            <button
              onClick={() => setViewMode("swimlane")}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${viewMode === "swimlane" ? "bg-purple-500/20 text-purple-300" : "text-gray-500 hover:text-gray-300"}`}
            >
              Swimlanes
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${viewMode === "list" ? "bg-purple-500/20 text-purple-300" : "text-gray-500 hover:text-gray-300"}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex-shrink-0">
        <FilterBar filters={filters} setFilters={setFilters} projects={projects} assignees={assignees} />
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {viewMode === "board" ? (
          // ── Flat board view ──
          <div className="flex gap-4 flex-1 overflow-x-auto pb-4 kanban-columns">
            {STATUSES.map((status) => (
              <Column
                key={status.key}
                status={status}
                issues={byStatus(status.key)}
                onCardClick={setSelectedIssue}
                onQuickAdd={(title) => quickAdd(status.key, title)}
                collapsed={collapsedLanes}
                pulses={pulses}
                commentBadges={commentBadges}
                flashIds={flashIds}
                onMobileMove={setMobileMovingIssue}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                blockedIds={blockedIds}
                focusedIssueId={focusedIssueId}
                onFocus={setFocusedIssueId}
              />
            ))}
          </div>
        ) : (
          // ── Swimlane view ──
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {Object.entries(byProject())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([proj, projIssues]) => (
                <div key={proj} className="rounded-xl border border-white/[0.06] overflow-hidden">
                  {/* Lane header */}
                  <button
                    onClick={() => toggleLane(proj)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
                  >
                    <span className={`text-xs text-gray-500 transition-transform ${collapsedLanes.has(proj) ? "" : "rotate-90"}`}>▶</span>
                    <span className="text-sm font-semibold text-gray-200">{proj}</span>
                    <span className="text-xs text-gray-600">{projIssues.length} issues</span>
                  </button>

                  {/* Lane content */}
                  {!collapsedLanes.has(proj) && (
                    <div className="flex gap-3 p-3 overflow-x-auto">
                      {STATUSES.map((status) => {
                        const statusIssues = projIssues.filter((i) => i.status === status.key).sort((a, b) => a.position - b.position);
                        return (
                          <div key={status.key} className="flex-shrink-0 w-60">
                            <div className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
                              <span>{status.icon}</span>
                              <span>{status.label}</span>
                              {statusIssues.length > 0 && <span className="text-gray-600">({statusIssues.length})</span>}
                            </div>
                            <SortableContext items={statusIssues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                              <div className="space-y-1.5 min-h-[40px]">
                                {statusIssues.map((issue) => (
                                  <SortableCard
                                    key={issue.id}
                                    issue={issue}
                                    onClick={() => setSelectedIssue(issue)}
                                    pulse={pulses.get(issue.id)}
                                    commentBadge={commentBadges.get(issue.id)}
                                    flash={flashIds.has(issue.id)}
                                    selected={selectedIds.has(issue.id)}
                                    onSelect={handleSelect}
                                    isBlocked={(blockedIds.get(issue.id) ?? 0) > 0}
                                    blockerCount={blockedIds.get(issue.id)}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                            <button
                              onClick={() => quickAdd(status.key, "New issue", proj)}
                              className="mt-1.5 w-full text-left px-2 py-1 text-xs text-gray-600 hover:text-gray-400 hover:bg-white/5 rounded transition-colors"
                            >
                              +
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* List view — outside dnd, rendered after swimlane */}
        {viewMode === "list" && (
          <div className="flex-1 overflow-y-auto pb-4">
            <div className="glass overflow-hidden">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0d1117]/90 backdrop-blur border-b border-white/[0.06]">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium w-8">#</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Title</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Priority</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Effort</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Assignee</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Project</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue, idx) => {
                    const status = STATUSES.find(s => s.key === issue.status);
                    const priority = PRIORITY_CONFIG[issue.priority];
                    return (
                      <tr
                        key={issue.id}
                        onClick={() => setSelectedIssue(issue)}
                        className="border-b border-white/[0.03] hover:bg-white/[0.03] cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-200 font-medium max-w-xs truncate">{issue.title}</td>
                        <td className="px-4 py-2.5">
                          {status && <span className="text-xs text-gray-400">{status.icon} {status.label}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {priority && <span className="text-xs">{priority.icon} {priority.label}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {issue.effort_size && EFFORT_CONFIG[issue.effort_size] ? (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${EFFORT_CONFIG[issue.effort_size].color}`}>
                              {issue.effort_size}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">
                          {issue.assignee ? `${ASSIGNEE_EMOJI[issue.assignee] || "👤"} ${issue.assignee}` : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[120px] truncate">{issue.project || <span className="text-gray-600">—</span>}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{new Date(issue.updated_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {issues.length === 0 && (
                <div className="p-8 text-center text-gray-600 text-sm">No issues found</div>
              )}
            </div>
          </div>
        )}

        {/* Drag overlay */}
        <DragOverlay>
          {activeIssue ? <IssueCard issue={activeIssue} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Mobile move menu */}
      {mobileMovingIssue && (
        <MobileMoveMenu
          issue={mobileMovingIssue}
          onMove={handleMobileMove}
          onClose={() => setMobileMovingIssue(null)}
        />
      )}

      {/* New Issue Modal */}
      {showNewIssueModal && (
        <NewIssueModal
          onClose={() => setShowNewIssueModal(false)}
          onCreated={(issue) => {
            setIssues((prev) => [...prev, issue]);
            setShowNewIssueModal(false);
          }}
          projects={projects}
        />
      )}

      {/* Detail panel */}
      {selectedIssue && (
        <DetailPanel
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onUpdate={updateIssue}
          onDelete={deleteIssue}
          subscribe={subscribe}
          onOpenClearBadge={(id: string) => setCommentBadges((prev) => { const n = new Map(prev); n.delete(id); return n; })}
          projects={[...new Set(issues.map(i => i.project).filter((p): p is string => Boolean(p)))].sort()}
          allIssues={issues}
        />
      )}

      {/* Bulk action bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkAction={handleBulkAction}
        issues={issues}
      />

      {/* Keyboard shortcuts legend */}
      {showShortcutsHelp && (
        <KeyboardShortcutsLegend onClose={() => setShowShortcutsHelp(false)} />
      )}
    </div>
  );
}
