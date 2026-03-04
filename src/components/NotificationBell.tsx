"use client";
import { useState, useEffect, useRef, useCallback } from "react";

interface Notification {
  id: string;
  type: "agent_activity" | "issue_update" | "mention";
  title: string;
  body?: string;
  issue_id?: string;
  agent?: string;
  read: number;
  created_at: string;
}

const typeIcon: Record<string, string> = {
  agent_activity: "🤖",
  issue_update: "📋",
  mention: "💬",
};

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnread(data.unread || 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id: string) => {
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    setLoading(true);
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    setUnread(0);
    setLoading(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        className="relative p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all"
        title="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold bg-purple-500 text-white rounded-full px-0.5 leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-[200] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-semibold text-gray-200">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="text-xs text-purple-400 hover:text-purple-300 transition disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 transition">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-colors ${
                    n.read === 0 ? "bg-purple-500/5 hover:bg-purple-500/10" : "hover:bg-white/3"
                  }`}
                >
                  <span className="text-base shrink-0 mt-0.5">{typeIcon[n.type] || "📌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug truncate ${n.read === 0 ? "text-gray-100 font-medium" : "text-gray-300"}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-[10px] text-gray-600 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {n.read === 0 && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="shrink-0 w-2 h-2 rounded-full bg-purple-500 mt-2 hover:bg-purple-400 transition"
                      title="Mark as read"
                    />
                  )}
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-white/5 text-center">
              <span className="text-[10px] text-gray-600">{notifications.length} notifications</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
