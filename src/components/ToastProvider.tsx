"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useEvents, type SSEEvent } from "@/lib/useEvents";
import { useRouter } from "next/navigation";

const AGENT_META: Record<string, { emoji: string; color: string }> = {
  kai:    { emoji: "🚀", color: "#8B5CF6" },
  alma:   { emoji: "💜", color: "#EC4899" },
  tina:   { emoji: "🏠", color: "#10B981" },
  vicky:  { emoji: "📖", color: "#F59E0B" },
  stella: { emoji: "⭐", color: "#EAB308" },
  hunter: { emoji: "🎯", color: "#EF4444" },
  pieter: { emoji: "👤", color: "#3B82F6" },
  system: { emoji: "⚙️", color: "#6B7280" },
};

interface Toast {
  id: string;
  emoji: string;
  message: string;
  color: string;
  href?: string;
  exiting?: boolean;
}

const MAX_TOASTS = 5;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { subscribe, connected } = useEvents();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();
  const idRef = useRef(0);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${++idRef.current}`;
    setToasts((prev) => {
      const next = [...prev, { ...toast, id }];
      // Dismiss oldest if over max
      while (next.filter((t) => !t.exiting).length > MAX_TOASTS) {
        const oldest = next.find((t) => !t.exiting);
        if (oldest) oldest.exiting = true;
      }
      return next;
    });

    // Auto-dismiss after 5s
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
    }, 5000);

    // Remove from DOM after exit animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5400);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 400);
  }, []);

  // Dedup: track recent toasts to avoid spam
  const recentToastsRef = useRef<Map<string, number>>(new Map());

  const addToastDeduped = useCallback((key: string, toast: Omit<Toast, "id">) => {
    const now = Date.now();
    const last = recentToastsRef.current.get(key);
    if (last && now - last < 3000) return; // Skip if same toast within 3s
    recentToastsRef.current.set(key, now);
    // Cleanup old entries
    if (recentToastsRef.current.size > 50) {
      for (const [k, v] of recentToastsRef.current) {
        if (now - v > 10000) recentToastsRef.current.delete(k);
      }
    }
    addToast(toast);
  }, [addToast]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      subscribe("issue_updated", (evt: SSEEvent) => {
        const fields = evt.fields as string[];
        const issue = evt.issue as Record<string, string> | undefined;
        const agent = (evt.agent as string) || "system";
        const meta = AGENT_META[agent] || AGENT_META.system;
        const title = issue?.title || (evt.issueId as string);
        const issueId = evt.issueId as string;

        // Only toast for meaningful changes: status or assignee
        if (fields?.includes("status") && issue?.status) {
          const status = issue.status;
          const label = status === "done" ? "✅" : "📋";
          addToastDeduped(`status-${issueId}-${status}`, {
            emoji: label,
            message: `'${title}' moved to ${status.replace(/_/g, " ")}`,
            color: meta.color,
            href: "/projects",
          });
        } else if (fields?.includes("assignee") && issue?.assignee) {
          const assigneeMeta = AGENT_META[issue.assignee] || AGENT_META.system;
          addToastDeduped(`assignee-${issueId}-${issue.assignee}`, {
            emoji: "🎯",
            message: `New issue assigned to ${issue.assignee}: '${title}'`,
            color: assigneeMeta.color,
            href: "/projects",
          });
        }
        // Skip toasts for position, labels, description, title changes etc.
      })
    );

    unsubs.push(
      subscribe("comment_added", (evt: SSEEvent) => {
        const author = (evt.author as string) || "someone";
        const comment = evt.comment as Record<string, string> | undefined;
        const issueId = evt.issueId as string;
        addToast({
          emoji: "💬",
          message: `New comment on ${issueId} by ${author}`,
          color: (AGENT_META[author] || AGENT_META.system).color,
          href: "/projects",
        });
      })
    );

    unsubs.push(
      subscribe("agent_pulse", (evt: SSEEvent) => {
        const agent = evt.agent as string;
        const action = evt.action as string;
        const issueId = evt.issueId as string;
        const meta = AGENT_META[agent] || AGENT_META.system;
        if (action === "working") {
          addToast({
            emoji: meta.emoji,
            message: `${agent} started working on ${issueId}`,
            color: meta.color,
            href: "/projects",
          });
        } else if (action === "idle") {
          addToast({
            emoji: "✅",
            message: `${agent} finished working on ${issueId}`,
            color: meta.color,
            href: "/projects",
          });
        }
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [subscribe, addToast]);

  return (
    <>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 pointer-events-none max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => {
              if (toast.href) router.push(toast.href);
              dismiss(toast.id);
            }}
            className={`pointer-events-auto toast-item ${toast.exiting ? "toast-exit" : "toast-enter"}`}
            style={{ "--toast-color": toast.color } as React.CSSProperties}
          >
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#111827]/90 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/30 cursor-pointer hover:bg-[#1a2036]/90 transition-colors">
              <span className="text-lg shrink-0">{toast.emoji}</span>
              <p className="text-sm text-gray-200 leading-snug flex-1">{toast.message}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(toast.id);
                }}
                className="text-gray-600 hover:text-gray-400 text-xs shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
            {/* Accent line */}
            <div
              className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
              style={{ background: toast.color }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
