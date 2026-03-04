"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "./ThemeProvider";
import VoiceNoteWidget from "./VoiceNoteWidget";
import { NotificationBell } from "./NotificationBell";

interface SearchResult {
  id: string | number;
  title: string;
  description: string;
  status: string;
  project: string;
  type: "issue" | "idea" | "project" | "comment";
  snippet: string;
  title_snippet: string;
  desc_snippet: string;
  matched_field: "title" | "description" | "both";
  bm25_score: number;
}

const typeEmoji: Record<string, string> = { issue: "🎫", idea: "💡", project: "🚀", comment: "💬", domain: "🌐" };
const typeHref: Record<string, (id: string | number) => string> = {
  issue: () => "/",
  idea: () => "/ideas",
  project: () => "/projects",
  comment: () => "/",
  domain: () => "/domains",
};
const typeLabel: Record<string, string> = { issue: "Issues", idea: "Ideas", project: "Projects", comment: "Comments", domain: "Domains" };
const sectionOrder = ["issue", "project", "domain", "idea", "comment"];

const nav = [
  { href: "/", label: "🏠 Dashboard", key: "home" },
  { href: "/kanban", label: "🗂️ Kanban", key: "kanban" },
  { href: "/sprints", label: "🏃 Sprints", key: "sprints" },
  { href: "/roadmap", label: "🗺️ Roadmap", key: "roadmap" },
  { href: "/projects", label: "🚀 Projects", key: "projects" },
  { href: "/domains", label: "🌐 Domains", key: "domains" },
  { href: "/ideas", label: "💡 Ideas", key: "ideas" },
  { href: "/skills", label: "🔧 Skill Health", key: "skills" },
  { href: "/review-queue", label: "🔍 Review Queue", key: "review-queue" },
  { href: "/standup", label: "🧍 Standup", key: "standup" },
  { href: "/analytics", label: "📊 Analytics", key: "analytics" },
  { href: "/insights", label: "🔎 Insights", key: "insights" },
  { href: "/agents", label: "🤖 Agent Health", key: "agents" },
  { href: "/agents/timeline", label: "↳ Timeline", key: "agents-timeline" },
  { href: "/memory", label: "🧠 Memory", key: "memory" },
  { href: "/activity", label: "📋 Activity Log", key: "activity" },
  { href: "/explorer", label: "🔍 Data Explorer", key: "explorer" },
  { href: "/biztv", label: "📺 BizTV", key: "biztv" },
  { href: "/settings", label: "⚙️ Settings", key: "settings" },
];

function UserMenu() {
  const { data: session } = useSession();
  if (!session?.user) return null;
  return (
    <div className="p-4 border-t border-white/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="truncate">{session.user.name || session.user.email}</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs text-gray-500 hover:text-gray-300 transition"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json()).then(d => {
      setResults(d.results || []);
      setOpen(true);
    });
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const input = containerRef.current?.querySelector("input");
        input?.focus();
        input?.select();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 glass border-r border-white/5 flex flex-col z-50">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold gradient-text">⚡ Mission Control</h1>
            <p className="text-xs text-gray-500 mt-1">Kai&apos;s Workspace</p>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pt-4 relative" ref={containerRef}>
        <input
          type="text"
          placeholder="Search… ⌘K"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.trim() && results.length > 0 && setOpen(true)}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/40 focus:bg-white/8 transition-all"
        />
        {open && results.length > 0 && (() => {
          const grouped = sectionOrder
            .map(type => ({ type, items: results.filter(r => r.type === type) }))
            .filter(g => g.items.length > 0);
          return (
            <div className="absolute left-4 right-4 top-full mt-1 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl max-h-80 overflow-y-auto z-[100]">
              {grouped.map(({ type, items }) => (
                <div key={type}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-400/70 bg-white/[0.02] sticky top-0">
                    {typeLabel[type]}
                  </div>
                  {items.map((r, i) => (
                    <button
                      key={`${r.type}-${r.id}-${i}`}
                      className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                      onClick={() => { setOpen(false); setQuery(""); router.push(typeHref[r.type](r.id)); }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{typeEmoji[r.type]}</span>
                        <span className="text-sm text-white font-medium truncate"
                          dangerouslySetInnerHTML={{ __html: r.title_snippet || r.title }} />
                        {r.status && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 ml-auto shrink-0">{r.status}</span>
                        )}
                      </div>
                      {r.desc_snippet && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate pl-6" dangerouslySetInnerHTML={{ __html: r.desc_snippet }} />
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}
        {open && query.trim() && results.length === 0 && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 text-center text-sm text-gray-500 z-[100]">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`block px-4 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                active
                  ? "bg-purple-500/15 text-purple-300 border border-purple-500/20"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {/* Voice Note Widget */}
      <div className="border-t border-white/5 pt-2">
        <VoiceNoteWidget />
      </div>
      <UserMenu />
    </aside>
  );
}
