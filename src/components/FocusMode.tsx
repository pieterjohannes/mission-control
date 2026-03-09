"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MarkdownRenderer } from "@/components/MarkdownEditor";
import IssueActivityTimeline from "@/components/IssueActivityTimeline";

interface Subtask {
  title: string;
  done: boolean;
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
  subtasks?: string | null;
  parent_id?: string | null;
}

interface Comment {
  id: string;
  author: string;
  body: string;
  created_at: string;
}

interface FocusSession {
  id: string;
  issue_id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  note: string | null;
  completed: number;
}

const POMODORO_DURATION = 25 * 60; // 25 minutes in seconds

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: "Urgent", color: "bg-red-500/20 text-red-300 border-red-500/30", dot: "bg-red-400" },
  high: { label: "High", color: "bg-orange-500/20 text-orange-300 border-orange-500/30", dot: "bg-orange-400" },
  medium: { label: "Med", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", dot: "bg-yellow-400" },
  low: { label: "Low", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", dot: "bg-gray-500" },
};

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  next: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  in_progress: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  review: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  done: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

const AGENT_AVATARS: Record<string, string> = {
  kai: "🤖", pieter: "👤", alma: "💜", marco: "📊", bea: "🎨",
  rex: "🦖", viktor: "🛡️", dev: "💻", luna: "🌙", max: "⚡",
};

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes("Z") ? "" : "Z"));
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function generateId(): string {
  return `fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

type TimerState = "idle" | "running" | "paused" | "completed";

interface FocusModeProps {
  issue: Issue | null;
  allIssues?: Issue[];
  onClose: () => void;
  onOpenOtherIssue?: (issue: Issue) => void;
  onIssueUpdated?: (issueId: string, changes: Partial<Issue>) => void;
}

export default function FocusMode({ issue, allIssues = [], onClose, onOpenOtherIssue, onIssueUpdated }: FocusModeProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [relatedIssues, setRelatedIssues] = useState<Issue[]>([]);
  const [activeTab, setActiveTab] = useState<"description" | "comments" | "activity">("description");

  // Pomodoro state
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [timeLeft, setTimeLeft] = useState(POMODORO_DURATION);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [totalFocusSec, setTotalFocusSec] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [showAccomplishmentModal, setShowAccomplishmentModal] = useState(false);
  const [accomplishmentNote, setAccomplishmentNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [pendingCompletedSessionId, setPendingCompletedSessionId] = useState<string | null>(null);
  const [pendingDurationSec, setPendingDurationSec] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0); // seconds elapsed in current session

  // Parse subtasks when issue changes
  useEffect(() => {
    if (!issue) return;
    try {
      let parsed = JSON.parse(issue.subtasks || "[]");
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      setSubtasks(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSubtasks([]);
    }
    setNewComment("");
    setActiveTab("description");
    // Reset timer when issue changes
    setTimerState("idle");
    setTimeLeft(POMODORO_DURATION);
    setSessionId(null);
    setSessionStartedAt(null);
    elapsedRef.current = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [issue?.id]);

  // Fetch comments
  useEffect(() => {
    if (!issue) return;
    fetch(`/api/issues/${issue.id}/comments`)
      .then(r => r.json())
      .then(d => setComments(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [issue?.id]);

  // Fetch focus session totals
  useEffect(() => {
    if (!issue) return;
    fetch(`/api/issues/${issue.id}/focus-sessions`)
      .then(r => r.json())
      .then(d => {
        setTotalFocusSec(d.total_sec || 0);
        setSessionCount((d.sessions || []).filter((s: FocusSession) => s.completed).length);
      })
      .catch(() => {});
  }, [issue?.id]);

  // Find related issues
  useEffect(() => {
    if (!issue || !allIssues.length) return;
    const related = allIssues
      .filter(i => i.id !== issue.id && i.project === issue.project && i.project)
      .slice(0, 5);
    setRelatedIssues(related);
  }, [issue?.id, allIssues]);

  // Escape key handler
  useEffect(() => {
    if (!issue) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showAccomplishmentModal) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [issue, onClose, showAccomplishmentModal]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Start focus session
  const startTimer = useCallback(async () => {
    if (!issue) return;
    const sid = generateId();
    const startedAt = new Date().toISOString();
    setSessionId(sid);
    setSessionStartedAt(startedAt);
    setTimerState("running");
    elapsedRef.current = 0;

    // Auto-move to in_progress if not already
    if (issue.status !== "in_progress") {
      try {
        await fetch(`/api/issues/${issue.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "in_progress" }),
        });
        onIssueUpdated?.(issue.id, { status: "in_progress" });
      } catch { /* ignore */ }
    }

    // Create session record
    try {
      await fetch(`/api/issues/${issue.id}/focus-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sid, started_at: startedAt }),
      });
    } catch { /* ignore */ }

    // Start countdown
    intervalRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Timer complete
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimerState("completed");
          setPendingCompletedSessionId(sid);
          setPendingDurationSec(POMODORO_DURATION);
          setShowAccomplishmentModal(true);
          // Play notification sound if available
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1.5);
          } catch { /* ignore */ }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [issue, onIssueUpdated]);

  // Pause/resume timer
  const pauseTimer = useCallback(() => {
    if (timerState === "running") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setTimerState("paused");
    } else if (timerState === "paused") {
      setTimerState("running");
      intervalRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setTimerState("completed");
            setPendingCompletedSessionId(sessionId);
            setPendingDurationSec(POMODORO_DURATION);
            setShowAccomplishmentModal(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [timerState, sessionId]);

  // Stop timer early
  const stopTimer = useCallback(async () => {
    if (!issue || !sessionId) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    const durationSec = elapsedRef.current;
    const endedAt = new Date().toISOString();

    try {
      await fetch(`/api/issues/${issue.id}/focus-sessions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sessionId,
          ended_at: endedAt,
          duration_sec: durationSec,
          completed: false,
        }),
      });
    } catch { /* ignore */ }

    // Refresh total
    fetch(`/api/issues/${issue.id}/focus-sessions`)
      .then(r => r.json())
      .then(d => {
        setTotalFocusSec(d.total_sec || 0);
        setSessionCount((d.sessions || []).filter((s: FocusSession) => s.completed).length);
      })
      .catch(() => {});

    setTimerState("idle");
    setTimeLeft(POMODORO_DURATION);
    setSessionId(null);
    setSessionStartedAt(null);
    elapsedRef.current = 0;
  }, [issue, sessionId]);

  // Save accomplishment note and complete session
  const saveAccomplishment = useCallback(async () => {
    if (!issue || !pendingCompletedSessionId) return;
    setSavingNote(true);
    const endedAt = new Date().toISOString();

    try {
      await fetch(`/api/issues/${issue.id}/focus-sessions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pendingCompletedSessionId,
          ended_at: endedAt,
          duration_sec: pendingDurationSec,
          note: accomplishmentNote.trim() || null,
          completed: true,
        }),
      });

      // If there's a note, post it as a comment too
      if (accomplishmentNote.trim()) {
        await fetch(`/api/issues/${issue.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            author: "kai",
            body: `🍅 **Pomodoro complete** (${formatDuration(pendingDurationSec)})\n\n${accomplishmentNote.trim()}`,
          }),
        });
      }
    } catch { /* ignore */ }

    // Refresh totals
    const data = await fetch(`/api/issues/${issue.id}/focus-sessions`).then(r => r.json()).catch(() => ({ total_sec: 0, sessions: [] }));
    setTotalFocusSec(data.total_sec || 0);
    setSessionCount((data.sessions || []).filter((s: FocusSession) => s.completed).length);

    // Refresh comments if note was added
    if (accomplishmentNote.trim()) {
      fetch(`/api/issues/${issue.id}/comments`)
        .then(r => r.json())
        .then(d => setComments(Array.isArray(d) ? d : []))
        .catch(() => {});
    }

    setSavingNote(false);
    setShowAccomplishmentModal(false);
    setAccomplishmentNote("");
    setPendingCompletedSessionId(null);
    setTimerState("idle");
    setTimeLeft(POMODORO_DURATION);
    setSessionId(null);
    setSessionStartedAt(null);
    elapsedRef.current = 0;
  }, [issue, pendingCompletedSessionId, pendingDurationSec, accomplishmentNote]);

  // Toggle subtask
  const toggleSubtask = useCallback(async (index: number) => {
    if (!issue) return;
    const updated = subtasks.map((st, i) => i === index ? { ...st, done: !st.done } : st);
    setSubtasks(updated);
    try {
      await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: updated }),
      });
    } catch { /* ignore */ }
  }, [issue, subtasks]);

  // Post comment
  const postComment = useCallback(async () => {
    if (!issue || !newComment.trim()) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: "pieter", body: newComment.trim() }),
      });
      if (res.ok) {
        const c = await res.json();
        setComments(prev => [...prev, c]);
        setNewComment("");
      }
    } finally {
      setPostingComment(false);
    }
  }, [issue, newComment]);

  if (!issue) return null;

  const priority = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium;
  const statusColor = STATUS_COLORS[issue.status] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  const doneCount = subtasks.filter(st => st.done).length;
  const totalCount = subtasks.length;

  // Timer ring progress
  const progress = (POMODORO_DURATION - timeLeft) / POMODORO_DURATION;
  const circumference = 2 * Math.PI * 54; // radius=54
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="fixed inset-0 z-[100] bg-gray-950/98 backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Accomplishment modal */}
      {showAccomplishmentModal && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="text-4xl">🍅</div>
              <h2 className="text-xl font-bold text-gray-100">Pomodoro Complete!</h2>
              <p className="text-sm text-gray-400">Great work! What did you accomplish in this session?</p>
            </div>
            <textarea
              autoFocus
              value={accomplishmentNote}
              onChange={e => setAccomplishmentNote(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  saveAccomplishment();
                }
              }}
              placeholder="Briefly describe what you got done… (optional)"
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition"
            />
            <div className="flex gap-3">
              <button
                onClick={saveAccomplishment}
                disabled={savingNote}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {savingNote ? "Saving…" : "Log Session ⌘↵"}
              </button>
              <button
                onClick={saveAccomplishment}
                disabled={savingNote}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 text-sm rounded-lg border border-white/10 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-gray-950/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-purple-400/80">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.75 3.75 0 01-2.663 1.103H9.375a3.75 3.75 0 01-2.663-1.103l-.347-.347z" />
            </svg>
            <span className="text-xs font-medium tracking-wider uppercase text-purple-400/60">Focus Mode</span>
          </div>
          <span className="text-gray-700">|</span>
          <span className="text-xs font-mono text-gray-600">{issue.id}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600 hidden sm:block">Press <kbd className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded text-[10px] font-mono">Esc</kbd> to exit</span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

          {/* Issue header */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${priority.color}`}>
                {priority.label}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize ${statusColor}`}>
                {issue.status.replace("_", " ")}
              </span>
              {issue.project && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20">
                  {issue.project}
                </span>
              )}
              {issue.assignee && (
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <span>{AGENT_AVATARS[issue.assignee.toLowerCase()] || "👤"}</span>
                  {issue.assignee}
                </span>
              )}
              {issue.effort_size && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/20 font-bold">
                  {issue.effort_size}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-100 leading-snug">{issue.title}</h1>
          </div>

          {/* ───── Pomodoro Timer ───── */}
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Pomodoro Timer</p>
                {totalFocusSec > 0 && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    {sessionCount} session{sessionCount !== 1 ? "s" : ""} · {formatDuration(totalFocusSec)} total focus
                  </p>
                )}
              </div>
              {timerState === "running" && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  In session
                </span>
              )}
              {timerState === "paused" && (
                <span className="text-xs text-yellow-400 font-medium">Paused</span>
              )}
              {timerState === "completed" && (
                <span className="text-xs text-purple-400 font-medium">🍅 Done!</span>
              )}
            </div>

            <div className="flex items-center gap-8">
              {/* Ring timer */}
              <div className="relative shrink-0">
                <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
                  {/* Track */}
                  <circle
                    cx="64" cy="64" r="54"
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="8"
                  />
                  {/* Progress */}
                  <circle
                    cx="64" cy="64" r="54"
                    fill="none"
                    stroke={timerState === "running" ? "#a855f7" : timerState === "paused" ? "#eab308" : timerState === "completed" ? "#10b981" : "rgba(168,85,247,0.3)"}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-bold font-mono tabular-nums ${
                    timerState === "running" ? "text-gray-100" :
                    timerState === "paused" ? "text-yellow-300" :
                    timerState === "completed" ? "text-emerald-300" :
                    "text-gray-500"
                  }`}>
                    {formatTimer(timeLeft)}
                  </span>
                  <span className="text-[10px] text-gray-600 mt-0.5">
                    {timerState === "idle" ? "25:00" : timerState === "completed" ? "done" : "left"}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-3 flex-1">
                {timerState === "idle" && (
                  <button
                    onClick={startTimer}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-purple-900/30"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Start Focus
                  </button>
                )}

                {(timerState === "running" || timerState === "paused") && (
                  <div className="flex gap-2">
                    <button
                      onClick={pauseTimer}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                        timerState === "running"
                          ? "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30"
                          : "bg-purple-600 hover:bg-purple-500 text-white"
                      }`}
                    >
                      {timerState === "running" ? (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                          </svg>
                          Pause
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          Resume
                        </>
                      )}
                    </button>
                    <button
                      onClick={stopTimer}
                      className="px-4 py-2.5 bg-white/5 hover:bg-red-500/15 text-gray-500 hover:text-red-400 text-sm rounded-xl border border-white/10 hover:border-red-500/30 transition-colors"
                      title="Stop session"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 6h12v12H6z" />
                      </svg>
                    </button>
                  </div>
                )}

                {timerState === "completed" && (
                  <button
                    onClick={() => {
                      setTimerState("idle");
                      setTimeLeft(POMODORO_DURATION);
                      elapsedRef.current = 0;
                    }}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    Start Next Session
                  </button>
                )}

                {/* Info blurb */}
                <div className="text-xs text-gray-600 space-y-0.5">
                  {timerState === "idle" && (
                    <p>25-min deep work block. Issue moves to <span className="text-yellow-500/70">in progress</span> automatically.</p>
                  )}
                  {timerState === "running" && sessionStartedAt && (
                    <p>Started {formatRelative(sessionStartedAt)}</p>
                  )}
                  {timerState === "paused" && (
                    <p className="text-yellow-600">Timer paused — session still open.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Session dots (visual log of completed sessions) */}
            {sessionCount > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-1.5">
                <span className="text-[10px] text-gray-700 mr-1">Sessions</span>
                {Array.from({ length: Math.min(sessionCount, 12) }).map((_, i) => (
                  <span key={i} className="text-sm">🍅</span>
                ))}
                {sessionCount > 12 && <span className="text-xs text-gray-600">+{sessionCount - 12}</span>}
              </div>
            )}
          </div>

          {/* Subtasks progress bar (if any) */}
          {totalCount > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Subtasks</p>
                <span className="text-xs text-gray-500 font-mono">{doneCount}/{totalCount}</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
                />
              </div>
              <div className="space-y-2">
                {subtasks.map((st, i) => (
                  <button
                    key={i}
                    onClick={() => toggleSubtask(i)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all group ${
                      st.done
                        ? "bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15"
                        : "bg-white/5 border border-white/10 hover:bg-white/8"
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      st.done
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-gray-600 group-hover:border-gray-400"
                    }`}>
                      {st.done && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm leading-relaxed ${st.done ? "text-gray-500 line-through" : "text-gray-300"}`}>
                      {st.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tabs: Description / Comments / Activity */}
          <div>
            <div className="flex gap-0 border-b border-white/10 mb-4">
              {[
                { key: "description", label: "Description" },
                { key: "comments", label: `Comments${comments.length > 0 ? ` (${comments.length})` : ""}` },
                { key: "activity", label: "Activity" },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.key
                      ? "border-purple-500 text-purple-300"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Description tab */}
            {activeTab === "description" && (
              <div>
                {issue.description ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <MarkdownRenderer content={issue.description} />
                  </div>
                ) : (
                  <p className="text-gray-600 italic text-sm">No description yet.</p>
                )}
              </div>
            )}

            {/* Comments tab */}
            {activeTab === "comments" && (
              <div className="space-y-4">
                {comments.length === 0 && (
                  <p className="text-gray-600 italic text-sm">No comments yet.</p>
                )}
                {comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-sm shrink-0">
                      {AGENT_AVATARS[c.author?.toLowerCase()] || "👤"}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-300">{c.author}</span>
                        <span className="text-xs text-gray-600">{formatRelative(c.created_at)}</span>
                      </div>
                      <div className="text-sm text-gray-300 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                        <MarkdownRenderer content={c.body} />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add comment */}
                <div className="mt-4 flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-sm shrink-0">
                    👤
                  </div>
                  <div className="flex-1 space-y-2">
                    <textarea
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          postComment();
                        }
                      }}
                      placeholder="Add a comment… (⌘+Enter to submit)"
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition"
                    />
                    <button
                      onClick={postComment}
                      disabled={!newComment.trim() || postingComment}
                      className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      {postingComment ? "Posting…" : "Comment"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Activity tab */}
            {activeTab === "activity" && (
              <IssueActivityTimeline issueId={issue.id} />
            )}
          </div>

          {/* Related issues */}
          {relatedIssues.length > 0 && (
            <div className="space-y-3 border-t border-white/10 pt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Related in {issue.project}</p>
              <div className="space-y-1.5">
                {relatedIssues.map(ri => {
                  const rp = PRIORITY_CONFIG[ri.priority] || PRIORITY_CONFIG.medium;
                  return (
                    <button
                      key={ri.id}
                      onClick={() => {
                        onClose();
                        onOpenOtherIssue?.(ri);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/15 text-left transition-colors group"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${rp.dot}`} />
                      <span className="text-xs font-mono text-gray-600 shrink-0">{ri.id.slice(0, 10)}</span>
                      <span className="text-sm text-gray-300 truncate flex-1">{ri.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border capitalize shrink-0 ${STATUS_COLORS[ri.status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                        {ri.status.replace("_", " ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom hint bar */}
      <div className="border-t border-white/10 bg-gray-950/80 px-6 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-xs text-gray-700">
          <span><kbd className="bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono text-[10px]">Tab</kbd> Switch tabs</span>
          <span><kbd className="bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono text-[10px]">Space</kbd> Check subtask</span>
          <span><kbd className="bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono text-[10px]">⌘+Enter</kbd> Submit comment</span>
        </div>
        <div className="flex items-center gap-3">
          {totalFocusSec > 0 && (
            <span className="text-xs text-gray-700 font-mono">🍅 {formatDuration(totalFocusSec)}</span>
          )}
          <span className="text-xs text-gray-700 font-mono">{issue.id}</span>
        </div>
      </div>
    </div>
  );
}
