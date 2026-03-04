"use client";

import { useEffect, useState, useRef } from "react";

interface HeatmapDay {
  date: string;
  count: number;
  issues: number;
  comments: number;
  actions: number;
}

interface TooltipState {
  day: HeatmapDay & { dateLabel: string };
  x: number;
  y: number;
}

function getColorClass(count: number): string {
  if (count === 0) return "bg-gray-800 border-gray-700";
  if (count <= 2) return "bg-green-900 border-green-800";
  if (count <= 5) return "bg-green-700 border-green-600";
  return "bg-green-500 border-green-400";
}

function buildGrid(days: HeatmapDay[]): (HeatmapDay | null)[][] {
  // Build a map for quick lookup
  const map = new Map<string, HeatmapDay>();
  days.forEach(d => map.set(d.date, d));

  // Generate last 90 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allDates: string[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    allDates.push(d.toISOString().slice(0, 10));
  }

  // Find the day-of-week of the first date (0=Sun, need Mon-based)
  const firstDate = new Date(allDates[0] + "T00:00:00");
  // Monday-based: 0=Mon ... 6=Sun
  const firstDow = (firstDate.getDay() + 6) % 7;

  // Build columns (weeks), each column is 7 days (Mon-Sun)
  const columns: (HeatmapDay | null)[][] = [];
  let col: (HeatmapDay | null)[] = [];

  // Fill leading nulls for alignment
  for (let i = 0; i < firstDow; i++) col.push(null);

  for (const dateStr of allDates) {
    col.push(map.get(dateStr) ?? { date: dateStr, count: 0, issues: 0, comments: 0, actions: 0 });
    if (col.length === 7) {
      columns.push(col);
      col = [];
    }
  }
  if (col.length > 0) {
    while (col.length < 7) col.push(null);
    columns.push(col);
  }

  return columns;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function ActivityHeatmap({ agentId }: { agentId: string }) {
  const [days, setDays] = useState<HeatmapDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/agents/${agentId}/heatmap`)
      .then(r => r.json())
      .then(data => {
        setDays(data.dates ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [agentId]);

  const columns = buildGrid(days);
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const totalActivity = days.reduce((s, d) => s + d.count, 0);
  const activeDays = days.filter(d => d.count > 0).length;

  const handleMouseEnter = (day: HeatmapDay | null, e: React.MouseEvent) => {
    if (!day) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setTooltip({
      day: { ...day, dateLabel: formatDate(day.date) },
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top,
    });
  };

  if (loading) {
    return (
      <div className="glass p-4 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-40 mb-3" />
        <div className="h-20 bg-gray-800 rounded" />
      </div>
    );
  }

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-300">Activity Heatmap</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalActivity} actions across {activeDays} active days (last 90 days)
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-gray-800 border border-gray-700" />
          <div className="w-3 h-3 rounded-sm bg-green-900 border border-green-800" />
          <div className="w-3 h-3 rounded-sm bg-green-700 border border-green-600" />
          <div className="w-3 h-3 rounded-sm bg-green-500 border border-green-400" />
          <span>More</span>
        </div>
      </div>

      <div ref={containerRef} className="relative">
        <div className="flex gap-0.5 overflow-x-auto pb-1">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1 shrink-0">
            {DAYS.map((d, i) => (
              <div
                key={d}
                className="h-3.5 text-[9px] text-gray-600 flex items-center"
                style={{ visibility: i % 2 === 0 ? "visible" : "hidden" }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid columns */}
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-0.5 shrink-0">
              {col.map((day, ri) => (
                <div
                  key={ri}
                  className={`w-3.5 h-3.5 rounded-sm border cursor-default transition-transform hover:scale-125 ${
                    day ? getColorClass(day.count) : "bg-transparent border-transparent"
                  }`}
                  onMouseEnter={day ? (e) => handleMouseEnter(day, e) : undefined}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 pointer-events-none bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs shadow-xl"
            style={{
              left: Math.min(tooltip.x - 80, containerRef.current ? containerRef.current.offsetWidth - 175 : tooltip.x),
              top: tooltip.y - 100,
              width: 170,
            }}
          >
            <p className="text-gray-300 font-medium mb-1.5">{tooltip.day.dateLabel}</p>
            {tooltip.day.count === 0 ? (
              <p className="text-gray-500">No activity</p>
            ) : (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total</span>
                  <span className="text-white font-semibold">{tooltip.day.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Issues</span>
                  <span className="text-blue-400">{tooltip.day.issues}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Comments</span>
                  <span className="text-yellow-400">{tooltip.day.comments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Actions</span>
                  <span className="text-green-400">{tooltip.day.actions}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
