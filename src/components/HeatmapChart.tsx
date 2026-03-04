"use client";

import { useEffect, useState } from "react";

interface HeatmapCell {
  day: number;
  hour: number;
  count: number;
}

interface HeatmapData {
  data: HeatmapCell[];
  max: number;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`
);

function getColor(count: number, max: number): string {
  if (count === 0 || max === 0) return "bg-white/5";
  const intensity = count / max;
  if (intensity < 0.15) return "bg-indigo-900/40";
  if (intensity < 0.30) return "bg-indigo-700/50";
  if (intensity < 0.50) return "bg-indigo-600/60";
  if (intensity < 0.70) return "bg-indigo-500/75";
  if (intensity < 0.85) return "bg-indigo-400/85";
  return "bg-indigo-400";
}

export default function HeatmapChart() {
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [tooltip, setTooltip] = useState<{ day: number; hour: number; count: number; x: number; y: number } | null>(null);

  useEffect(() => {
    fetch("/api/insights/heatmap")
      .then(r => r.json())
      .then(setHeatmap)
      .catch(console.error);
  }, []);

  if (!heatmap) {
    return (
      <div className="text-gray-500 text-sm animate-pulse py-8 text-center">
        Loading heatmap…
      </div>
    );
  }

  // Build lookup: day → hour → count
  const lookup: Record<number, Record<number, number>> = {};
  for (const cell of heatmap.data) {
    if (!lookup[cell.day]) lookup[cell.day] = {};
    lookup[cell.day][cell.hour] = cell.count;
  }

  return (
    <div className="relative">
      {/* Hour axis labels — show every 3rd */}
      <div className="flex ml-12 mb-1">
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="flex-1 text-center text-[10px] text-gray-600">
            {h % 3 === 0 ? HOUR_LABELS[h] : ""}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-1">
        {DAYS.map((day, d) => (
          <div key={d} className="flex items-center gap-1">
            {/* Day label */}
            <div className="w-10 text-right text-xs text-gray-500 pr-1 shrink-0">{day}</div>
            {/* Hour cells */}
            {Array.from({ length: 24 }, (_, h) => {
              const count = lookup[d]?.[h] ?? 0;
              return (
                <div
                  key={h}
                  className={`flex-1 aspect-square rounded-sm cursor-default transition-all duration-150 hover:ring-1 hover:ring-indigo-400/60 ${getColor(count, heatmap.max)}`}
                  onMouseEnter={e => {
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    setTooltip({ day: d, hour: h, count, x: rect.left + rect.width / 2, y: rect.top });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Color scale legend */}
      <div className="flex items-center gap-2 mt-3 ml-12">
        <span className="text-[10px] text-gray-600">Less</span>
        {["bg-white/5", "bg-indigo-900/40", "bg-indigo-700/50", "bg-indigo-600/60", "bg-indigo-500/75", "bg-indigo-400"].map((cls, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
        ))}
        <span className="text-[10px] text-gray-600">More</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl"
          style={{ left: tooltip.x, top: tooltip.y - 56, transform: "translateX(-50%)" }}
        >
          <div className="text-gray-300 font-medium">{DAYS[tooltip.day]}, {HOUR_LABELS[tooltip.hour]}</div>
          <div className="text-indigo-400">{tooltip.count} action{tooltip.count !== 1 ? "s" : ""}</div>
        </div>
      )}
    </div>
  );
}
