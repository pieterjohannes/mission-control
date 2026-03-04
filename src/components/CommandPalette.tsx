"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string | number;
  title: string;
  status: string;
  project?: string;
  type: "issue" | "project" | "idea" | "domain" | "comment";
  snippet?: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  type: "action";
}

type Item = (SearchResult & { type: "issue" | "project" | "idea" | "domain" | "comment" }) | QuickAction;

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  "in-progress": "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
  review: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  done: "bg-green-500/20 text-green-300 border border-green-500/30",
  closed: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
  active: "bg-green-500/20 text-green-300 border border-green-500/30",
  planning: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  archived: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
};

const TYPE_ICONS: Record<string, string> = {
  issue: "🎯",
  project: "📁",
  idea: "💡",
  domain: "🌐",
  comment: "💬",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const quickActions: QuickAction[] = [
    {
      id: "new-issue",
      label: "New Issue",
      icon: "➕",
      type: "action",
      action: () => {
        setOpen(false);
        // Trigger quick add modal via custom event
        window.dispatchEvent(new CustomEvent("mc:new-issue"));
      },
    },
    {
      id: "go-dashboard",
      label: "Go to Dashboard",
      icon: "🏠",
      type: "action",
      action: () => { setOpen(false); router.push("/"); },
    },
    {
      id: "go-kanban",
      label: "Go to Kanban",
      icon: "📋",
      type: "action",
      action: () => { setOpen(false); router.push("/kanban"); },
    },
    {
      id: "go-projects",
      label: "Go to Projects",
      icon: "📁",
      type: "action",
      action: () => { setOpen(false); router.push("/projects"); },
    },
  ];

  // Build flat list for keyboard nav
  const allItems: Item[] = query.trim()
    ? [
        ...results.filter((r) => r.type === "issue"),
        ...results.filter((r) => r.type === "project"),
        ...results.filter((r) => !["issue", "project"].includes(r.type)),
      ]
    : quickActions;

  const handleSelect = useCallback(
    (item: Item) => {
      if (item.type === "action") {
        (item as QuickAction).action();
        return;
      }
      const r = item as SearchResult;
      setOpen(false);
      if (r.type === "issue") router.push(`/issues/${r.id}`);
      else if (r.type === "project") router.push(`/projects/${r.id}`);
      else if (r.type === "idea") router.push(`/ideas`);
      else if (r.type === "domain") router.push(`/domains`);
    },
    [router]
  );

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      } catch {
        // aborted
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  // Keyboard nav inside palette
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && allItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(allItems[selectedIndex]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, allItems, selectedIndex, handleSelect]);

  if (!open) return null;

  const issueResults = results.filter((r) => r.type === "issue");
  const projectResults = results.filter((r) => r.type === "project");
  const otherResults = results.filter((r) => !["issue", "project"].includes(r.type));

  // Compute flat index offsets for selected highlighting
  const issueOffset = 0;
  const projectOffset = issueResults.length;
  const otherOffset = projectOffset + projectResults.length;

  const renderResult = (item: SearchResult, flatIndex: number) => {
    const isSelected = flatIndex === selectedIndex;
    return (
      <button
        key={`${item.type}-${item.id}`}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
          isSelected ? "bg-white/10" : "hover:bg-white/5"
        }`}
        onMouseEnter={() => setSelectedIndex(flatIndex)}
        onClick={() => handleSelect(item)}
      >
        <span className="text-base shrink-0">{TYPE_ICONS[item.type] || "📄"}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white truncate">{item.title}</div>
          {item.project && (
            <div className="text-xs text-gray-500 truncate">{item.project}</div>
          )}
        </div>
        {item.status && (
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[item.status] || "bg-gray-500/20 text-gray-400"}`}>
            {item.status}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div className="relative w-full max-w-xl mx-4 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        style={{ background: "rgba(10,14,26,0.95)" }}>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <span className="text-gray-400 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues, projects, or type a command…"
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
          />
          {loading && <span className="text-gray-500 text-xs">searching…</span>}
          <kbd className="text-xs text-gray-600 border border-gray-700 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!query.trim() && (
            <>
              <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider font-medium">Quick Actions</div>
              {quickActions.map((action, i) => (
                <button
                  key={action.id}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === selectedIndex ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => action.action()}
                >
                  <span className="text-base shrink-0">{action.icon}</span>
                  <span className="text-sm text-white">{action.label}</span>
                </button>
              ))}
            </>
          )}

          {query.trim() && results.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {issueResults.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider font-medium border-t border-white/5">Issues</div>
              {issueResults.map((r, i) => renderResult(r, issueOffset + i))}
            </>
          )}

          {projectResults.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider font-medium border-t border-white/5">Projects</div>
              {projectResults.map((r, i) => renderResult(r, projectOffset + i))}
            </>
          )}

          {otherResults.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider font-medium border-t border-white/5">Other</div>
              {otherResults.map((r, i) => renderResult(r, otherOffset + i))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-white/10 flex gap-4 text-xs text-gray-600">
          <span><kbd className="border border-gray-700 rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="border border-gray-700 rounded px-1">↵</kbd> select</span>
          <span><kbd className="border border-gray-700 rounded px-1">⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
