"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useEffect, useState } from "react";

interface VelocityData {
  sprint_id: string;
  sprint_name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  total: number;
  completed: number;
}

const STATUS_COLOR: Record<string, string> = {
  completed: "#10b981",
  active:    "#3b82f6",
  planning:  "#6b7280",
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const completed = payload.find(p => p.name === "Completed")?.value ?? 0;
  const remaining = payload.find(p => p.name === "Remaining")?.value ?? 0;
  const total = completed + remaining;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm shadow-xl">
      <p className="text-white font-semibold mb-1">{label}</p>
      <p className="text-emerald-400">✓ Completed: {completed}</p>
      <p className="text-gray-400">○ Remaining: {remaining}</p>
      <p className="text-gray-300 mt-1">Total: {total} · {pct}% done</p>
    </div>
  );
}

export default function VelocityChart() {
  const [data, setData] = useState<VelocityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sprints/velocity")
      .then(r => r.json())
      .then(rows => {
        setData(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 animate-pulse h-64 flex items-center justify-center">
        <span className="text-gray-500 text-sm">Loading velocity data…</span>
      </div>
    );
  }

  const sprints = data.filter(d => d.total > 0 || d.status === "completed");

  if (sprints.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center h-48 text-center">
        <span className="text-3xl mb-2">📊</span>
        <p className="text-gray-400 text-sm">No sprint data yet</p>
        <p className="text-gray-600 text-xs mt-1">Assign issues to sprints to see velocity</p>
      </div>
    );
  }

  const chartData = sprints.map(s => ({
    name: s.sprint_name.length > 14 ? s.sprint_name.slice(0, 13) + "…" : s.sprint_name,
    fullName: s.sprint_name,
    Completed: s.completed,
    Remaining: Math.max(0, s.total - s.completed),
    status: s.status,
    total: s.total,
    pct: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
  }));

  // Average velocity for completed sprints
  const completedSprints = sprints.filter(s => s.status === "completed");
  const avgVelocity = completedSprints.length > 0
    ? Math.round(completedSprints.reduce((sum, s) => sum + s.completed, 0) / completedSprints.length)
    : null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold text-sm">📊 Velocity Chart</h2>
          <p className="text-gray-500 text-xs mt-0.5">Issues completed per sprint</p>
        </div>
        {avgVelocity !== null && (
          <div className="text-right">
            <div className="text-emerald-400 font-bold text-xl">{avgVelocity}</div>
            <div className="text-gray-500 text-xs">avg / sprint</div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barSize={28} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#9ca3af", paddingTop: "8px" }}
            iconType="square"
            iconSize={10}
          />
          <Bar dataKey="Completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={STATUS_COLOR[entry.status] ?? "#10b981"}
                opacity={entry.status === "planning" ? 0.5 : 1}
              />
            ))}
          </Bar>
          <Bar dataKey="Remaining" stackId="a" fill="#374151" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend for status */}
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" /> Completed</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-500" /> Active</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-gray-600" /> Remaining / Planning</span>
      </div>
    </div>
  );
}
