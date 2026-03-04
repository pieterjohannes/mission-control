"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeProvider";

interface SearchResult {
  id: string | number;
  title: string;
  status: string;
  type: "issue" | "idea" | "project" | "comment" | "domain";
  snippet: string;
  title_snippet: string;
  desc_snippet: string;
  matched_field: "title" | "description" | "both";
  bm25_score: number;
}

const typeEmoji: Record<string, string> = { issue: "🎫", idea: "💡", project: "🚀", comment: "💬", domain: "🌐" };
const typeHref: Record<string, () => string> = {
  issue: () => "/", idea: () => "/ideas", project: () => "/projects", comment: () => "/", domain: () => "/domains",
};
const typeLabel: Record<string, string> = { issue: "Issues", idea: "Ideas", project: "Projects", comment: "Comments", domain: "Domains" };
const sectionOrder = ["issue", "project", "domain", "idea", "comment"];

export default function MobileSearch() {
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
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const grouped = sectionOrder.map(type => ({ type, items: results.filter(r => r.type === type) })).filter(g => g.items.length > 0);

  return (
    <div className="flex items-center gap-2">
    <div className="relative flex-1" ref={containerRef}>
      <input
        type="text"
        placeholder="🔍 Search everything…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => query.trim() && results.length > 0 && setOpen(true)}
        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/40 transition-all"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl max-h-72 overflow-y-auto z-[100]">
          {grouped.map(({ type, items }) => (
            <div key={type}>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-400/70 bg-white/[0.02] sticky top-0">{typeLabel[type]}</div>
              {items.map((r, i) => (
                <button key={`${r.type}-${r.id}-${i}`} className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                  onClick={() => { setOpen(false); setQuery(""); router.push(typeHref[r.type]()); }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{typeEmoji[r.type]}</span>
                    <span className="text-sm text-white font-medium truncate"
                      dangerouslySetInnerHTML={{ __html: r.title_snippet || r.title }} />
                    {r.status && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 ml-auto shrink-0">{r.status}</span>}
                  </div>
                  {r.desc_snippet && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate pl-6"
                      dangerouslySetInnerHTML={{ __html: r.desc_snippet }} />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 text-center text-sm text-gray-500 z-[100]">
          No results for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
    <ThemeToggle className="shrink-0" />
    </div>
  );
}
