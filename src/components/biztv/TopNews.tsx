"use client";

import { useEffect, useState } from "react";

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  category: string;
  confidence: number;
  source_quote?: string;
  source_filename?: string;
  created_at: string;
}

const FALLBACK_NEWS = [
  { tag: "BREAKING", headline: "ECB holds rates steady, signals June cut", time: "2m ago" },
  { tag: "EARNINGS", headline: "NVIDIA beats Q4 estimates, data center revenue surges 400%", time: "1h ago" },
  { tag: "MARKETS", headline: "S&P 500 hits new all-time high on AI optimism", time: "2h ago" },
  { tag: "CRYPTO", headline: "Bitcoin ETF inflows top $500M for third straight day", time: "3h ago" },
  { tag: "MACRO", headline: "US jobless claims fall to 4-month low", time: "4h ago" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function TopNews() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/biztv?limit=10")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.news_items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Refresh every 60s
    const iv = setInterval(() => {
      fetch("/api/biztv?limit=10")
        .then((r) => r.json())
        .then((data) => setItems(data.news_items || []))
        .catch(() => {});
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  // Use real data if available, otherwise fallback
  const hasRealData = items.length > 0;

  return (
    <div className="p-3 max-h-[200px] overflow-y-auto">
      <h2 className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-2">
        Top Stories
        {hasRealData && (
          <span className="ml-2 text-green-400/60">● LIVE</span>
        )}
      </h2>
      <div className="space-y-1.5">
        {hasRealData
          ? items.map((item) => (
              <div key={item.id} className="flex items-start gap-2 text-xs group" title={item.source_quote || item.summary}>
                <span
                  className={`shrink-0 px-1 py-0.5 rounded text-[9px] font-bold tracking-wide ${
                    item.category === "BREAKING"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-white/5 text-white/40"
                  }`}
                >
                  {item.category}
                </span>
                <span className="text-white/80 leading-snug flex-1">{item.headline}</span>
                <span className="text-white/20 text-[10px] font-mono shrink-0">
                  {item.confidence >= 0.9 ? "✓" : item.confidence >= 0.7 ? "~" : "?"}{" "}
                  {timeAgo(item.created_at)}
                </span>
              </div>
            ))
          : FALLBACK_NEWS.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span
                  className={`shrink-0 px-1 py-0.5 rounded text-[9px] font-bold tracking-wide ${
                    item.tag === "BREAKING"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-white/5 text-white/40"
                  }`}
                >
                  {item.tag}
                </span>
                <span className="text-white/80 leading-snug flex-1">{item.headline}</span>
                <span className="text-white/20 text-[10px] font-mono shrink-0">{item.time}</span>
              </div>
            ))}
      </div>
    </div>
  );
}
