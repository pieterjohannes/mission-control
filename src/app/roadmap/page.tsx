"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface Issue {
  id: string;
  title: string;
  status: string;
  project: string | null;
  priority: string;
  assignee: string | null;
  created_at: string;
  updated_at: string;
  labels: string;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  backlog:     { bg: "bg-gray-500/20",   border: "border-gray-500/40",  text: "text-gray-300",   dot: "bg-gray-400" },
  next:        { bg: "bg-blue-500/20",   border: "border-blue-500/40",  text: "text-blue-300",   dot: "bg-blue-400" },
  in_progress: { bg: "bg-yellow-500/20", border: "border-yellow-500/40",text: "text-yellow-300", dot: "bg-yellow-400" },
  review:      { bg: "bg-purple-500/20", border: "border-purple-500/40",text: "text-purple-300", dot: "bg-purple-400" },
  done:        { bg: "bg-green-500/20",  border: "border-green-500/40", text: "text-green-300",  dot: "bg-green-400" },
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  next: "Next",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// How many months to show on either side of current
const SIDE_MONTHS = 3;

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function monthsInRange(startYear: number, startMonth: number, count: number) {
  const months = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startYear, startMonth + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` });
  }
  return months;
}

export default function RoadmapPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const startYear = new Date(now.getFullYear(), now.getMonth() - SIDE_MONTHS, 1).getFullYear();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - SIDE_MONTHS, 1).getMonth();
  const totalMonths = SIDE_MONTHS * 2 + 1;
  const months = monthsInRange(startYear, startMonth, totalMonths);

  const MONTH_WIDTH = 180; // px per month column

  useEffect(() => {
    fetch("/api/roadmap")
      .then((r) => r.json())
      .then((d) => {
        setIssues(d.issues || []);
        setLoading(false);
      });
  }, []);

  // Scroll to center (current month) on mount
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const offset = SIDE_MONTHS * MONTH_WIDTH - 8;
      scrollRef.current.scrollLeft = offset;
    }
  }, [loading]);

  // Group issues by project
  const projectMap = new Map<string, Issue[]>();
  const filteredIssues = filterStatus === "all" ? issues : issues.filter((i) => i.status === filterStatus);

  for (const issue of filteredIssues) {
    const key = issue.project || "Uncategorized";
    if (!projectMap.has(key)) projectMap.set(key, []);
    projectMap.get(key)!.push(issue);
  }

  const projectGroups = Array.from(projectMap.entries()).sort(([a], [b]) => a.localeCompare(b));

  // Determine which month column an issue belongs to (based on created_at)
  function getIssueMonth(issue: Issue): { year: number; month: number } {
    const d = new Date(issue.created_at);
    return { year: d.getFullYear(), month: d.getMonth() };
  }

  function monthIndex(year: number, month: number): number {
    return months.findIndex((m) => m.year === year && m.month === month);
  }

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">🗺️ Roadmap</h1>
          <p className="text-sm text-gray-400 mt-1">Issues on a monthly timeline, grouped by project</p>
        </div>
        {/* Status filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {["all", ...Object.keys(STATUS_LABELS)].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                filterStatus === s
                  ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                  : "bg-white/5 border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-gray-400">
        {Object.entries(STATUS_LABELS).map(([k, v]) => {
          const c = STATUS_COLORS[k] || STATUS_COLORS.backlog;
          return (
            <div key={k} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
              <span>{v}</span>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading roadmap…</div>
      ) : projectGroups.length === 0 ? (
        <div className="text-center text-gray-500 py-20">No issues found.</div>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/20">
          {/* Timeline header (sticky) */}
          <div className="flex" style={{ minWidth: `${280 + totalMonths * MONTH_WIDTH}px` }}>
            {/* Project label header */}
            <div className="sticky left-0 z-20 w-[280px] shrink-0 bg-black/40 border-r border-white/10 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Project</span>
            </div>
            {/* Month headers */}
            <div
              className="flex overflow-x-auto"
              ref={scrollRef}
              style={{ scrollBehavior: "smooth" }}
            >
              {months.map((m) => {
                const isCurrent = m.year === now.getFullYear() && m.month === now.getMonth();
                return (
                  <div
                    key={`${m.year}-${m.month}`}
                    style={{ width: `${MONTH_WIDTH}px`, minWidth: `${MONTH_WIDTH}px` }}
                    className={`px-3 py-3 text-xs font-semibold border-r border-white/5 ${
                      isCurrent ? "text-purple-300 bg-purple-500/10" : "text-gray-400"
                    }`}
                  >
                    {m.label}
                    {isCurrent && <span className="ml-2 text-[10px] text-purple-400 font-normal">← now</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project rows */}
          <div
            style={{ minWidth: `${280 + totalMonths * MONTH_WIDTH}px` }}
          >
            {projectGroups.map(([projectName, projectIssues]) => {
              // Group issues by month
              const issuesByMonth = new Map<number, Issue[]>();
              for (const issue of projectIssues) {
                const { year, month } = getIssueMonth(issue);
                const idx = monthIndex(year, month);
                if (idx < 0) continue; // outside visible range
                if (!issuesByMonth.has(idx)) issuesByMonth.set(idx, []);
                issuesByMonth.get(idx)!.push(issue);
              }

              // Issues outside visible range
              const outOfRange = projectIssues.filter((issue) => {
                const { year, month } = getIssueMonth(issue);
                return monthIndex(year, month) < 0;
              });

              return (
                <div
                  key={projectName}
                  className="flex border-t border-white/5 hover:bg-white/[0.01] transition-colors"
                >
                  {/* Project name label */}
                  <div className="sticky left-0 z-10 w-[280px] shrink-0 bg-black/30 border-r border-white/10 px-4 py-3 flex flex-col justify-start">
                    <span className="text-sm font-semibold text-gray-200 truncate">{projectName}</span>
                    <span className="text-xs text-gray-500 mt-0.5">{projectIssues.length} issue{projectIssues.length !== 1 ? "s" : ""}</span>
                    {outOfRange.length > 0 && (
                      <span className="text-[10px] text-gray-600 mt-1">{outOfRange.length} outside view</span>
                    )}
                  </div>

                  {/* Month cells */}
                  <div className="flex flex-1 overflow-hidden">
                    {months.map((m, idx) => {
                      const isCurrent = m.year === now.getFullYear() && m.month === now.getMonth();
                      const cellIssues = issuesByMonth.get(idx) || [];
                      return (
                        <div
                          key={`${m.year}-${m.month}`}
                          style={{ width: `${MONTH_WIDTH}px`, minWidth: `${MONTH_WIDTH}px` }}
                          className={`border-r border-white/5 px-1.5 py-2 flex flex-col gap-1 ${
                            isCurrent ? "bg-purple-500/5" : ""
                          }`}
                        >
                          {cellIssues.map((issue) => {
                            const c = STATUS_COLORS[issue.status] || STATUS_COLORS.backlog;
                            return (
                              <button
                                key={issue.id}
                                onClick={() => router.push(`/?issue=${issue.id}`)}
                                title={`${issue.title}\nStatus: ${STATUS_LABELS[issue.status] || issue.status}\nID: ${issue.id}`}
                                className={`w-full text-left rounded-md px-2 py-1.5 border text-xs transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.99] cursor-pointer ${c.bg} ${c.border} ${c.text}`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                                  <span className="truncate font-medium leading-tight">{issue.title}</span>
                                </div>
                                <div className="text-[10px] opacity-60 mt-0.5 pl-3 truncate">{issue.id}</div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary stats */}
      {!loading && (
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(STATUS_LABELS).map(([k, v]) => {
            const count = issues.filter((i) => i.status === k).length;
            const c = STATUS_COLORS[k] || STATUS_COLORS.backlog;
            return (
              <button
                key={k}
                onClick={() => setFilterStatus(filterStatus === k ? "all" : k)}
                className={`rounded-xl border p-3 text-center transition-all hover:scale-[1.02] cursor-pointer ${
                  filterStatus === k ? `${c.bg} ${c.border}` : "bg-white/5 border-white/10 hover:bg-white/8"
                }`}
              >
                <div className={`text-2xl font-bold ${c.text}`}>{count}</div>
                <div className="text-xs text-gray-400 mt-1">{v}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
