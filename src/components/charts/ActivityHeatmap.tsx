"use client";
import { useEffect, useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface HeatmapCell {
  dow: number;
  hour: number;
  count: number;
}

export default function ActivityHeatmap() {
  const [data, setData] = useState<HeatmapCell[]>([]);

  useEffect(() => {
    fetch("/api/charts?chart=activity-heatmap")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const getCount = (dow: number, hour: number) =>
    data.find((d) => d.dow === dow && d.hour === hour)?.count || 0;

  const getColor = (count: number) => {
    if (count === 0) return "bg-white/[0.03]";
    const intensity = count / maxCount;
    if (intensity < 0.25) return "bg-purple-500/20";
    if (intensity < 0.5) return "bg-purple-500/40";
    if (intensity < 0.75) return "bg-purple-500/60";
    return "bg-purple-500/90";
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        {/* Hour labels */}
        <div className="flex items-center mb-1 ml-10">
          {HOURS.filter((h) => h % 3 === 0).map((h) => (
            <span key={h} className="text-[10px] text-gray-500" style={{ width: `${100 / 8}%` }}>
              {h.toString().padStart(2, "0")}
            </span>
          ))}
        </div>
        {/* Grid */}
        {DAYS.map((day, dow) => (
          <div key={day} className="flex items-center gap-1 mb-[2px]">
            <span className="text-[11px] text-gray-500 w-8 text-right mr-1">{day}</span>
            <div className="flex gap-[2px] flex-1">
              {HOURS.map((hour) => {
                const count = getCount(dow, hour);
                return (
                  <div
                    key={hour}
                    className={`flex-1 h-4 rounded-sm ${getColor(count)} transition-colors`}
                    title={`${day} ${hour}:00 — ${count} activities`}
                  />
                );
              })}
            </div>
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 ml-10">
          <span className="text-[10px] text-gray-500">Less</span>
          {["bg-white/[0.03]", "bg-purple-500/20", "bg-purple-500/40", "bg-purple-500/60", "bg-purple-500/90"].map((c) => (
            <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
          ))}
          <span className="text-[10px] text-gray-500">More</span>
        </div>
      </div>
    </div>
  );
}
