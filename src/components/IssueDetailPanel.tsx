"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import LabelPicker, { Label } from "@/components/LabelPicker";
import { MarkdownEditor, MarkdownRenderer } from "@/components/MarkdownEditor";
import DependencyPanel from "@/components/DependencyPanel";
import RelatedIssues from "@/components/RelatedIssues";
import IssueActivityTimeline from "@/components/IssueActivityTimeline";
import AgentPulseTimeline from "@/components/AgentPulseTimeline";
import IssueChangelog from "@/components/IssueChangelog";
import AgingBadge from "@/components/AgingBadge";
import TimeInStatusBadge from "@/components/TimeInStatusBadge";
import PomodoroTimer from "@/components/PomodoroTimer";
import DueDateBadge from "@/components/DueDateBadge";
import IssueScratchpad from "@/components/IssueScratchpad";

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
}

interface Subtask {
  title: string;
  done: boolean;
}

interface Comment {
  id: string;
  issue_id: string;
  author: string;
  body: string;
  created_at: string;
  reply_to_id?: string | null;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: "Urgent", color: "bg-red-500/20 text-red-300 border-red-500/30", dot: "bg-red-400" },
  high: { label: "High", color: "bg-orange-500/20 text-orange-300 border-orange-500/30", dot: "bg-orange-400" },
  medium: { label: "Med", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", dot: "bg-yellow-400" },
  low: { label: "Low", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", dot: "bg-gray-500" },
};

const EFFORT_CONFIG: Record<string, { label: string; color: string }> = {
  XS: { label: "XS", color: "bg-sky-500/20 text-sky-400 border border-sky-500/30" },
  S:  { label: "S",  color: "bg-teal-500/20 text-teal-400 border border-teal-500/30" },
  M:  { label: "M",  color: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" },
  L:  { label: "L",  color: "bg-orange-500/20 text-orange-400 border border-orange-500/30" },
  XL: { label: "XL", color: "bg-red-500/20 text-red-400 border border-red-500/30" },
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

interface IssueDetailPanelProps {
  issue: Issue | null;
  allLabels: Label[];
  allIssues: Issue[];
  onClose: () => void;
  onLabelsChanged: (issueId: string, labelIds: string[]) => void;
  onDescriptionChanged?: (issueId: string, description: string) => void;
  onOpenOtherIssue?: (issue: Issue) => void;
  onFocusMode?: (issue: Issue) => void;
}

// ─── Scratchpad ───────────────────────────────────────────────────────────────
// Private rough notes stored in localStorage, keyed by issue ID.
// Never synced to the server — purely local/personal.
function ScratchpadSection({ issueId }: { issueId: string }) {
  const storageKey = `scratch:${issueId}`;
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setText(localStorage.getItem(storageKey) ?? "");
    }
  }, [open, storageKey]);

  const save = (val: string) => {
    setText(val);
    if (val.trim()) {
      localStorage.setItem(storageKey, val);
    } else {
      localStorage.removeItem(storageKey);
    }
  };

  const hasContent = typeof window !== "undefined" && !!localStorage.getItem(storageKey);

  return (
    <div className="border-t border-white/10 pt-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full text-left"
      >
        <span className="font-medium uppercase tracking-wide">
          ✏️ Scratchpad
        </span>
        {hasContent && !open && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">has notes</span>
        )}
        <span className="ml-auto">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          <textarea
            value={text}
            onChange={e => save(e.target.value)}
            placeholder="Rough notes, ideas, TODOs… (private, never synced)"
            className="w-full min-h-[100px] bg-gray-800/60 border border-white/10 rounded-lg p-2.5 text-xs text-gray-200 placeholder-gray-600 resize-y focus:outline-none focus:border-yellow-500/40 focus:ring-1 focus:ring-yellow-500/20"
          />
          <p className="text-[10px] text-gray-600">🔒 Stored locally only — never saved to server or visible to others.</p>
        </div>
      )}
    </div>
  );
}

// ─── End Scratchpad ───────────────────────────────────────────────────────────

export default function IssueDetailPanel({
  issue,
  allLabels,
  allIssues,
  onClose,
  onLabelsChanged,
  onDescriptionChanged,
  onOpenOtherIssue,
  onFocusMode,
}: IssueDetailPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(issue?.title || "");
  const [savingTitle, setSavingTitle] = useState(false);
  const [issueStatus, setIssueStatus] = useState(issue?.status || "backlog");
  const [issuePriority, setIssuePriority] = useState(issue?.priority || "medium");
  const [savingMeta, setSavingMeta] = useState(false);

  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(issue?.description || "");
  const [savingDesc, setSavingDesc] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [timeData, setTimeData] = useState<{ total_sec: number; by_agent: Record<string, number> } | null>(null);
  const [costData, setCostData] = useState<{
    total_cost_usd: number; total_tokens_in: number; total_tokens_out: number;
    by_agent: { agent: string; cost_usd: number; tokens_in: number; tokens_out: number }[];
  } | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [watchers, setWatchers] = useState<{ subscriber: string; channel: string; created_at: string }[]>([]);
  const [cloning, setCloning] = useState(false);
  const [cloneToast, setCloneToast] = useState<string | null>(null);
  const [effortSize, setEffortSize] = useState(issue?.effort_size || "");

  // Subtasks state
  const [subtasks, setSubtasks] = useState<Subtask[]>(() => {
    try { let p = JSON.parse(issue?.subtasks || "[]"); if (typeof p === "string") p = JSON.parse(p); return Array.isArray(p) ? p : []; } catch { return []; }
  });
  const [savingSubtasks, setSavingSubtasks] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  // Decomposer state
  const [decomposing, setDecomposing] = useState(false);
  const [proposedSubtasks, setProposedSubtasks] = useState<Subtask[]>([]);
  const [selectedProposed, setSelectedProposed] = useState<boolean[]>([]);
  const [showDecomposer, setShowDecomposer] = useState(false);

  // Log Time form state
  const [showLogTime, setShowLogTime] = useState(false);
  const [logTimeAgent, setLogTimeAgent] = useState("pieter");
  const [logTimeDuration, setLogTimeDuration] = useState("");
  const [logTimeNote, setLogTimeNote] = useState("");
  const [loggingTime, setLoggingTime] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [dueDate, setDueDate] = useState(issue?.due_date || "");
  const [savingDueDate, setSavingDueDate] = useState(false);
  const SUBSCRIBER = "pieter";

  const parseRecurrenceConfig = (raw: string | null | undefined): RecurrenceConfig | null => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };
  const [recurrence, setRecurrence] = useState<RecurrenceConfig | null>(
    parseRecurrenceConfig(issue?.recurrence_config)
  );
  const [savingRecurrence, setSavingRecurrence] = useState(false);

  // Sync state when issue changes
  useEffect(() => {
    if (issue) {
      setTitleValue(issue.title || "");
      setIssueStatus(issue.status || "backlog");
      setIssuePriority(issue.priority || "medium");
      setDescValue(issue.description || "");
      setEffortSize(issue.effort_size || "");
      setDueDate(issue.due_date || "");
      setRecurrence(parseRecurrenceConfig(issue.recurrence_config));
      setEditingDesc(false);
      setEditingTitle(false);
      try { let p = JSON.parse(issue.subtasks || "[]"); if (typeof p === "string") p = JSON.parse(p); setSubtasks(Array.isArray(p) ? p : []); } catch { setSubtasks([]); }
    }
  }, [issue?.id]);

  // Fetch comments when issue changes
  const fetchComments = useCallback(async (issueId: string) => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/comments`);
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []);
    } catch { setComments([]); }
    finally { setLoadingComments(false); }
  }, []);

  useEffect(() => {
    if (issue?.id) {
      setComments([]);
      fetchComments(issue.id);
    }
  }, [issue?.id, fetchComments]);

  // Update URL for deep-linking
  useEffect(() => {
    if (issue) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("issue", issue.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("issue");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [issue?.id]);

  // Fetch time data and subscription
  useEffect(() => {
    if (!issue) return;
    fetch(`/api/issues/${issue.id}/time-log`)
      .then(r => r.json())
      .then(d => setTimeData({ total_sec: d.total_sec, by_agent: d.by_agent }))
      .catch(() => {});

    fetch(`/api/issues/${issue.id}/cost`)
      .then(r => r.json())
      .then(d => setCostData(d))
      .catch(() => {});

    fetch(`/api/issues/${issue.id}/subscribe`)
      .then(r => r.json())
      .then((subs: { subscriber: string; channel: string; created_at: string }[]) => {
        setSubscribed(Array.isArray(subs) && subs.some(s => s.subscriber === SUBSCRIBER));
        setWatchers(Array.isArray(subs) ? subs : []);
      })
      .catch(() => {});
  }, [issue?.id]);

  // Escape key to close
  useEffect(() => {
    if (!issue) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [issue, onClose]);



  const toggleSubscription = async () => {
    if (!issue) return;
    setSubLoading(true);
    try {
      await fetch(`/api/issues/${issue.id}/subscribe`, {
        method: subscribed ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriber: SUBSCRIBER }),
      });
      const newSub = !subscribed;
      setSubscribed(newSub);
      // Refresh watcher list
      fetch(`/api/issues/${issue.id}/subscribe`)
        .then(r => r.json())
        .then((subs: { subscriber: string; channel: string; created_at: string }[]) => {
          setWatchers(Array.isArray(subs) ? subs : []);
        })
        .catch(() => {});
    } finally {
      setSubLoading(false);
    }
  };

  const handleClone = async () => {
    if (!issue || cloning) return;
    setCloning(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/clone`, { method: "POST" });
      if (res.ok) {
        const newIssue = await res.json();
        setCloneToast(`Cloned → ${newIssue.id}`);
        setTimeout(() => setCloneToast(null), 4000);
      }
    } finally {
      setCloning(false);
    }
  };

  const saveTitle = async () => {
    if (!issue || !titleValue.trim()) return;
    setSavingTitle(true);
    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleValue.trim() }),
      });
      setEditingTitle(false);
    } finally {
      setSavingTitle(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!issue) return;
    setSavingMeta(true);
    setIssueStatus(newStatus);
    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } finally {
      setSavingMeta(false);
    }
  };

  const updatePriority = async (newPriority: string) => {
    if (!issue) return;
    setSavingMeta(true);
    setIssuePriority(newPriority);
    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
    } finally {
      setSavingMeta(false);
    }
  };

  const saveDescription = async () => {
    if (!issue) return;
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
    if (!issue) return;
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

  const updateEffortSize = async (size: string) => {
    if (!issue) return;
    setEffortSize(size);
    await fetch(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ effort_size: size || null }),
    });
  };

  const updateDueDate = async (date: string) => {
    if (!issue) return;
    setSavingDueDate(true);
    setDueDate(date);
    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_date: date || null }),
      });
    } finally {
      setSavingDueDate(false);
    }
  };

  const saveRecurrence = async (config: RecurrenceConfig | null) => {
    if (!issue) return;
    setSavingRecurrence(true);
    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurrence_config: config }),
      });
      setRecurrence(config);
    } finally {
      setSavingRecurrence(false);
    }
  };

  const saveSubtasks = async (updated: Subtask[]) => {
    if (!issue) return;
    setSavingSubtasks(true);
    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: updated }),
      });
      setSubtasks(updated);
    } finally {
      setSavingSubtasks(false);
    }
  };

  const toggleSubtask = (index: number) => {
    const updated = subtasks.map((s, i) => i === index ? { ...s, done: !s.done } : s);
    saveSubtasks(updated);
  };

  const addSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    const updated = [...subtasks, { title: newSubtaskTitle.trim(), done: false }];
    setNewSubtaskTitle("");
    await saveSubtasks(updated);
  };

  const removeSubtask = (index: number) => {
    const updated = subtasks.filter((_, i) => i !== index);
    saveSubtasks(updated);
  };

  const runDecomposer = async () => {
    if (!issue || decomposing) return;
    setDecomposing(true);
    setShowDecomposer(false);
    try {
      const res = await fetch(`/api/issues/${issue.id}/decompose`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const proposals: Subtask[] = data.subtasks || [];
        setProposedSubtasks(proposals);
        setSelectedProposed(proposals.map(() => true));
        setShowDecomposer(true);
      }
    } finally {
      setDecomposing(false);
    }
  };

  const applyDecomposer = async () => {
    const toAdd = proposedSubtasks.filter((_, i) => selectedProposed[i]);
    const updated = [...subtasks, ...toAdd];
    setShowDecomposer(false);
    setProposedSubtasks([]);
    await saveSubtasks(updated);
  };

  const cancelDecomposer = () => {
    setShowDecomposer(false);
    setProposedSubtasks([]);
    setSelectedProposed([]);
  };

  const submitComment = async () => {
    if (!issue || !newComment.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: "pieter", body: newComment.trim(), reply_to_id: replyToId }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments(prev => [...prev, comment]);
        setNewComment("");
        setReplyToId(null);
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const open = !!issue;

  if (!issue) {
    return null;
  }

  let labelIds: string[] = [];
  try { labelIds = JSON.parse(issue.labels || "[]"); } catch { labelIds = []; }
  const priority = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Issue: ${issue.title}`}
        className={`
          fixed top-0 right-0 bottom-0 z-50
          w-full sm:w-[540px] lg:w-[600px]
          bg-gray-950 border-l border-white/10
          shadow-2xl shadow-black/60
          flex flex-col
          transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Panel header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 font-mono mb-1">{issue.id}</p>
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                    if (e.key === "Escape") { setEditingTitle(false); setTitleValue(issue.title); }
                  }}
                  className="flex-1 bg-gray-800 border border-purple-500/50 rounded-lg px-2 py-1 text-sm font-semibold text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                />
                <button onClick={saveTitle} disabled={savingTitle} className="text-xs px-2 py-1 bg-purple-600/80 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50">
                  {savingTitle ? "…" : "✓"}
                </button>
                <button onClick={() => { setEditingTitle(false); setTitleValue(issue.title); }} className="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg">✕</button>
              </div>
            ) : (
              <h2
                className="text-base font-semibold text-gray-100 leading-snug cursor-pointer hover:text-purple-300 transition-colors"
                onClick={() => setEditingTitle(true)}
                title="Click to edit title"
              >
                {titleValue || issue.title}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/issue/${issue.id}`}
              title="Open full-page view"
              className="text-xs px-2 py-1 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:text-blue-300 hover:bg-blue-500/10 hover:border-blue-500/30 transition-colors flex items-center gap-1"
            >
              Open full page →
            </Link>
            <button
              onClick={() => {
                const url = `${window.location.origin}/issue/${issue.id}`;
                navigator.clipboard.writeText(url).then(() => {
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                });
              }}
              title="Copy shareable link"
              className="text-xs px-2 py-1 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10 hover:border-white/20 transition-colors"
            >
              {linkCopied ? "✅ Copied!" : "🔗 Share"}
            </button>
            {onFocusMode && (
              <button
                onClick={() => onFocusMode(issue)}
                title="Open in Focus Mode (F)"
                className="text-xs px-2 py-1 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:text-purple-300 hover:bg-purple-500/15 hover:border-purple-500/30 transition-colors"
              >
                🎯 Focus
              </button>
            )}
            <button
              onClick={handleClone}
              disabled={cloning}
              title="Clone this issue"
              className="text-xs px-2 py-1 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/15 hover:border-cyan-500/30 transition-colors disabled:opacity-50"
            >
              {cloning ? "⏳" : "📋 Clone"}
            </button>
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
              aria-label="Close panel"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Meta badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status dropdown */}
            <select
              value={issueStatus}
              onChange={(e) => updateStatus(e.target.value)}
              disabled={savingMeta}
              className="text-xs px-2 py-1 rounded-lg border border-white/15 bg-gray-800 text-gray-300 focus:outline-none focus:border-purple-500/50 capitalize cursor-pointer disabled:opacity-60"
              title="Change status"
            >
              <option value="backlog">📋 Backlog</option>
              <option value="next">⏭️ Next</option>
              <option value="in_progress">🔄 In Progress</option>
              <option value="review">🔍 Review</option>
              <option value="done">✅ Done</option>
            </select>
            {/* Priority dropdown */}
            <select
              value={issuePriority}
              onChange={(e) => updatePriority(e.target.value)}
              disabled={savingMeta}
              className={`text-xs px-2 py-1 rounded-lg border cursor-pointer disabled:opacity-60 focus:outline-none ${(PRIORITY_CONFIG[issuePriority] || PRIORITY_CONFIG.medium).color}`}
              title="Change priority"
            >
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">⚪ Low</option>
            </select>
            {issue.project && (
              <span className="text-xs px-2 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/20">
                {issue.project}
              </span>
            )}
            {issue.assignee && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                {getAssigneeEmoji(issue.assignee)} {issue.assignee}
              </span>
            )}
            {issue.days_since_update != null && (
              <span className="text-xs text-gray-500">🕐 {issue.days_since_update}d ago</span>
            )}
            <AgingBadge status={issueStatus} daysSinceUpdate={issue.days_since_update} daysInStatus={issue.days_in_status} />
            <TimeInStatusBadge daysInStatus={issue.days_in_status} status={issueStatus} />
            <DueDateBadge dueDate={issue.due_date} />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Description</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={enrichDescription}
                  disabled={enriching}
                  title="AI-enrich this issue"
                  className="text-xs px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 transition-colors disabled:opacity-50"
                >
                  {enriching ? "✨ Enriching…" : "✨ Enrich"}
                </button>
                {!editingDesc && (
                  <button onClick={() => setEditingDesc(true)} className="text-xs text-gray-500 hover:text-blue-400 transition-colors">
                    ✏️ Edit
                  </button>
                )}
              </div>
            </div>
            {editingDesc ? (
              <div className="space-y-2">
                <MarkdownEditor value={descValue} onChange={setDescValue} rows={8} />
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
              <div className="cursor-pointer rounded-lg p-2 hover:bg-white/5 transition-colors" onClick={() => setEditingDesc(true)} title="Click to edit">
                <MarkdownRenderer content={descValue} />
              </div>
            ) : (
              <button onClick={() => setEditingDesc(true)} className="text-sm text-gray-600 italic hover:text-gray-400 transition-colors">
                + Add description
              </button>
            )}
          </div>

          {/* Scratchpad */}
          <IssueScratchpad issueId={issue.id} />

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

          {/* Subtasks */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                Subtasks {subtasks.length > 0 && (
                  <span className="ml-1 text-gray-600 normal-case font-normal">
                    ({subtasks.filter(s => s.done).length}/{subtasks.length})
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                {savingSubtasks && <span className="text-xs text-gray-600 animate-pulse">Saving…</span>}
                <button
                  onClick={runDecomposer}
                  disabled={decomposing}
                  title="AI: auto-generate subtasks"
                  className="text-xs px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {decomposing ? "✨ Thinking…" : "✨ Decompose"}
                </button>
              </div>
            </div>

            {/* Decomposer preview */}
            {showDecomposer && proposedSubtasks.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <p className="text-xs text-amber-300 font-medium">AI proposed subtasks — select to add:</p>
                <div className="space-y-1">
                  {proposedSubtasks.map((s, i) => (
                    <label key={i} className="flex items-start gap-2 cursor-pointer group/prop">
                      <input
                        type="checkbox"
                        checked={selectedProposed[i] ?? true}
                        onChange={(e) => {
                          const updated = [...selectedProposed];
                          updated[i] = e.target.checked;
                          setSelectedProposed(updated);
                        }}
                        className="mt-0.5 accent-amber-400 shrink-0"
                      />
                      <span className={`text-sm leading-snug transition-colors ${selectedProposed[i] ? "text-gray-200" : "text-gray-500 line-through"}`}>
                        {s.title}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={applyDecomposer}
                    disabled={!selectedProposed.some(Boolean)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white font-medium transition disabled:opacity-40"
                  >
                    ✅ Apply ({selectedProposed.filter(Boolean).length})
                  </button>
                  <button
                    onClick={cancelDecomposer}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}


            {subtasks.length > 0 && (
              <div className="space-y-1">
                {subtasks.map((subtask, i) => (
                  <div key={i} className="flex items-start gap-2 group/subtask">
                    <button
                      onClick={() => toggleSubtask(i)}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        subtask.done
                          ? "bg-emerald-500/30 border-emerald-500/50 text-emerald-300"
                          : "bg-white/5 border-white/20 hover:border-purple-400/60"
                      }`}
                    >
                      {subtask.done && <span className="text-[10px] leading-none">✓</span>}
                    </button>
                    <span className={`text-sm flex-1 leading-snug ${subtask.done ? "line-through text-gray-500" : "text-gray-300"}`}>
                      {subtask.title}
                    </span>
                    <button
                      onClick={() => removeSubtask(i)}
                      className="opacity-0 group-hover/subtask:opacity-100 text-gray-600 hover:text-red-400 text-xs transition-all px-1"
                      title="Remove subtask"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {subtasks.length > 0 && (
                  <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full transition-all bg-emerald-500"
                      style={{ width: `${Math.round((subtasks.filter(s => s.done).length / subtasks.length) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Add subtask */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addSubtask(); }}
                placeholder="Add subtask…"
                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition"
              />
              <button
                onClick={addSubtask}
                disabled={!newSubtaskTitle.trim()}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:bg-purple-600/50 transition disabled:opacity-40"
              >
                + Add
              </button>
            </div>
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
                      ? EFFORT_CONFIG[size].color + " ring-1 ring-offset-1 ring-offset-gray-950"
                      : "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300"
                  }`}
                >
                  {size}
                </button>
              ))}
              {effortSize && (
                <button type="button" onClick={() => updateEffortSize("")} className="text-xs px-2 py-0.5 text-gray-600 hover:text-gray-400 transition-colors">
                  ✕ clear
                </button>
              )}
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">📅 Due Date</p>
              {dueDate && (
                <button
                  onClick={() => updateDueDate("")}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                >
                  ✕ Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => updateDueDate(e.target.value)}
                className="text-xs bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-gray-300 focus:outline-none focus:border-purple-500/50 transition [color-scheme:dark]"
              />
              {savingDueDate && <span className="text-xs text-gray-500 animate-pulse">Saving…</span>}
              {dueDate && <DueDateBadge dueDate={dueDate} />}
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">🔁 Recurrence</p>
              {recurrence && (
                <button
                  onClick={() => saveRecurrence(null)}
                  disabled={savingRecurrence}
                  className="text-xs px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
            {recurrence ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                  🔁 {recurrence.interval > 1 ? recurrence.interval + " " : ""}{recurrence.type} — next: {recurrence.next_run}
                </span>
                <select
                  value={recurrence.type}
                  onChange={(e) => saveRecurrence({ ...recurrence, type: e.target.value as RecurrenceConfig["type"] })}
                  className="text-xs bg-gray-800 border border-white/10 rounded-lg px-2 py-1 text-gray-300"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">every</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={recurrence.interval}
                    onChange={(e) => saveRecurrence({ ...recurrence, interval: parseInt(e.target.value) || 1 })}
                    className="w-14 text-xs bg-gray-800 border border-white/10 rounded-lg px-2 py-1 text-gray-300 text-center"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">next:</span>
                  <input
                    type="date"
                    value={recurrence.next_run}
                    onChange={(e) => saveRecurrence({ ...recurrence, next_run: e.target.value })}
                    className="text-xs bg-gray-800 border border-white/10 rounded-lg px-2 py-1 text-gray-300"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 italic">Not recurring</span>
                <button
                  onClick={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    saveRecurrence({ type: "weekly", interval: 1, next_run: tomorrow.toISOString().slice(0, 10) });
                  }}
                  disabled={savingRecurrence}
                  className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                >
                  + Set Recurrence
                </button>
              </div>
            )}
            {issue.parent_id && (
              <p className="text-xs text-orange-400/70">↩ Spawned from template: <span className="font-mono">{issue.parent_id}</span></p>
            )}
          </div>

          {/* Agent Cost */}
          {costData && costData.total_cost_usd > 0 && (
            <div className="space-y-2 border-t border-white/10 pt-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">💸 Agent Cost</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-amber-400">${costData.total_cost_usd.toFixed(4)}</span>
                <span className="text-xs text-gray-500">
                  {(costData.total_tokens_in + costData.total_tokens_out).toLocaleString()} tokens
                </span>
              </div>
              <div className="space-y-1">
                {costData.by_agent.map((a) => (
                  <div key={a.agent} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{a.agent}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-mono text-[10px]">
                        {(a.tokens_in + a.tokens_out).toLocaleString()} tok
                      </span>
                      <span className="font-mono text-amber-300">${a.cost_usd.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pomodoro Timer */}
          <div className="border-t border-white/10 pt-4">
            <PomodoroTimer
              issueId={issue.id}
              issueStatus={issue.status}
            />
          </div>

          {/* Related Issues */}
          <RelatedIssues
            issueId={issue.id}
            onOpenIssue={(relatedId) => {
              const linked = allIssues.find((i) => i.id === relatedId);
              if (linked) {
                onClose();
                onOpenOtherIssue?.(linked);
              }
            }}
          />

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
          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">⏱ Time Spent</p>
              <button
                onClick={() => setShowLogTime(v => !v)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors"
              >
                {showLogTime ? "Cancel" : "+ Log Time"}
              </button>
            </div>
            {timeData && timeData.total_sec > 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-emerald-400">{formatDuration(timeData.total_sec)}</span>
                  <span className="text-xs text-gray-500">total</span>
                </div>
                <div className="space-y-1">
                  {Object.entries(timeData.by_agent).map(([agent, sec]) => (
                    <div key={agent} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{getAssigneeEmoji(agent)} {agent}</span>
                      <span className="font-mono text-gray-300">{formatDuration(sec as number)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-600 italic">No time logged yet.</p>
            )}
            {showLogTime && (
              <div className="mt-2 space-y-2 p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[11px] text-gray-400 font-medium">Log time manually</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 30m, 1h, 1h30m"
                    value={logTimeDuration}
                    onChange={e => setLogTimeDuration(e.target.value)}
                    className="flex-1 bg-gray-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
                  />
                  <input
                    type="text"
                    placeholder="Agent (e.g. kai)"
                    value={logTimeAgent}
                    onChange={e => setLogTimeAgent(e.target.value)}
                    className="w-24 bg-gray-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={logTimeNote}
                  onChange={e => setLogTimeNote(e.target.value)}
                  className="w-full bg-gray-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  disabled={loggingTime || !logTimeDuration.trim() || !logTimeAgent.trim()}
                  onClick={async () => {
                    const raw = logTimeDuration.trim().toLowerCase();
                    // Parse duration string: "30m", "1h", "1h30m", "90" (minutes)
                    let totalSec = 0;
                    const hourMatch = raw.match(/(\d+)h/);
                    const minMatch = raw.match(/(\d+)m/);
                    const secMatch = raw.match(/(\d+)s/);
                    if (hourMatch) totalSec += parseInt(hourMatch[1]) * 3600;
                    if (minMatch) totalSec += parseInt(minMatch[1]) * 60;
                    if (secMatch) totalSec += parseInt(secMatch[1]);
                    if (!hourMatch && !minMatch && !secMatch) {
                      // Treat plain number as minutes
                      const mins = parseInt(raw);
                      if (!isNaN(mins)) totalSec = mins * 60;
                    }
                    if (totalSec <= 0) {
                      alert("Invalid duration. Use format like 30m, 1h, 1h30m");
                      return;
                    }
                    setLoggingTime(true);
                    try {
                      await fetch(`/api/issues/${issue.id}/time-log`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          agent: logTimeAgent.trim(),
                          duration_sec: totalSec,
                          note: logTimeNote.trim() || undefined,
                          started_at: new Date().toISOString(),
                        }),
                      });
                      // Refresh time data
                      const d = await fetch(`/api/issues/${issue.id}/time-log`).then(r => r.json());
                      setTimeData({ total_sec: d.total_sec, by_agent: d.by_agent });
                      setLogTimeDuration("");
                      setLogTimeNote("");
                      setShowLogTime(false);
                    } finally {
                      setLoggingTime(false);
                    }
                  }}
                  className="w-full py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                >
                  {loggingTime ? "Saving..." : "Save Time Entry"}
                </button>
              </div>
            )}
          </div>

          {/* Agent Pulse Timeline */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">⚡ Agent Activity (24h)</p>
            <AgentPulseTimeline issueId={issue.id} />
          </div>

          {/* Watchers */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              🔔 Watchers {watchers.length > 0 && <span className="text-gray-600 font-normal normal-case">({watchers.length})</span>}
            </p>
            {watchers.length === 0 ? (
              <p className="text-xs text-gray-600 italic">No watchers yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {watchers.map((w) => (
                  <span
                    key={w.subscriber}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300"
                    title={`${w.subscriber} via ${w.channel}`}
                  >
                    {w.subscriber === "kai" ? "🤖" : w.subscriber === "pieter" ? "👨💻" : w.subscriber.slice(0, 2).toUpperCase()}
                    <span className="capitalize">{w.subscriber}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Scratchpad */}
          <ScratchpadSection issueId={issue.id} />

          {/* Comments */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Comments {comments.length > 0 && <span className="text-gray-600 font-normal normal-case">({comments.length})</span>}
            </p>

            {loadingComments && (
              <p className="text-xs text-gray-600 animate-pulse">Loading comments…</p>
            )}

            {!loadingComments && comments.length === 0 && (
              <p className="text-xs text-gray-600 italic">No comments yet.</p>
            )}

            {comments.length > 0 && (() => {
              const topLevel = comments.filter(c => !c.reply_to_id);
              const repliesMap = comments.reduce<Record<string, Comment[]>>((acc, c) => {
                if (c.reply_to_id) {
                  if (!acc[c.reply_to_id]) acc[c.reply_to_id] = [];
                  acc[c.reply_to_id].push(c);
                }
                return acc;
              }, {});

              const renderComment = (comment: Comment, isReply = false): React.ReactNode => {
                const replies = repliesMap[comment.id] || [];
                return (
                  <div key={comment.id} className={isReply ? "ml-8 border-l border-white/10 pl-3" : ""}>
                    <div className="flex gap-2.5 group">
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs shrink-0 mt-0.5">
                        {comment.author === "kai" ? "🤖" : comment.author === "pieter" ? "👨‍💻" : comment.author.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-medium text-gray-300 capitalize">{comment.author}</span>
                          <span className="text-[10px] text-gray-600">{new Date(comment.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          {!isReply && replies.length > 0 && (
                            <span className="text-[10px] text-purple-400/70 ml-1">↩ {replies.length} {replies.length === 1 ? "reply" : "replies"}</span>
                          )}
                          <button
                            onClick={() => { setReplyToId(comment.id); setTimeout(() => commentInputRef.current?.focus(), 50); }}
                            className="ml-auto text-[10px] text-gray-600 hover:text-purple-400 opacity-0 group-hover:opacity-100 transition"
                          >
                            Reply
                          </button>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap break-words">{comment.body}</p>
                      </div>
                    </div>
                    {replies.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {replies.map(reply => renderComment(reply, true))}
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div className="space-y-3">
                  {topLevel.map(c => renderComment(c))}
                </div>
              );
            })()}

            {/* Add comment form */}
            <div className="space-y-2">
              {replyToId && (() => {
                const parent = comments.find(c => c.id === replyToId);
                return parent ? (
                  <div className="flex items-center gap-2 text-[11px] text-purple-400/80 bg-purple-500/10 border border-purple-500/20 rounded px-2 py-1">
                    <span>↩ Replying to <span className="font-medium capitalize">{parent.author}</span></span>
                    <button onClick={() => setReplyToId(null)} className="ml-auto text-gray-500 hover:text-gray-300">✕</button>
                  </div>
                ) : null;
              })()}
              <textarea
                ref={commentInputRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submitComment(); }
                }}
                placeholder={replyToId ? "Write a reply… (⌘↵ to submit)" : "Add a comment… (⌘↵ to submit)"}
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 resize-none transition"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-600">⌘↵ to submit</span>
                <button
                  onClick={submitComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="text-xs px-3 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white font-medium transition disabled:opacity-40"
                >
                  {submittingComment ? "Posting…" : replyToId ? "Reply" : "Comment"}
                </button>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Activity</p>
            <IssueActivityTimeline issueId={issue.id} />
          </div>

          {/* Field Changelog */}
          <div className="space-y-3 border-t border-white/10 pt-4 pb-8">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Changelog</p>
            <IssueChangelog issueId={issue.id} />
          </div>
        </div>
      </div>

      {/* Clone toast */}
      {cloneToast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-cyan-900/90 border border-cyan-500/40 text-cyan-200 text-sm px-4 py-2 rounded-xl shadow-lg backdrop-blur-sm animate-fade-in">
          ✅ {cloneToast}
        </div>
      )}
    </>
  );
}
