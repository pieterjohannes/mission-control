"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";

interface CycleTimeRow {
  project: string;
  done_count: number;
  avg_cycle_hours: number;
  min_hours: number;
  max_hours: number;
}

interface SparklineProject {
  project: string;
  sparkline: { week: string; closed: number }[];
  total: number;
  latest: number;
}

const PROJECT_COLORS = [
  "#8b5cf6", "#3b82f6", "#06b6d4", "#22c55e",
  "#f59e0b", "#ef4444", "#ec4899", "#6366f1",
];

function Sparkline({ data }: { data: { week: string; closed: number }[] }) {
  if (!data.length) return <div className="text-gray-600 text-xs">no data</div>;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Line
          type="monotone"
          dataKey="closed"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function formatHours(h: number): string {
  if (h < 24) return `${h.toFixed(1)}h`;
  const days = h / 24;
  if (days < 7) return `${days.toFixed(1)}d`;
  return `${(days / 7).toFixed(1)}w`;
}

export default function CycleTimeChart() {
  const [cycleTime, setCycleTime] = useState<CycleTimeRow[]>([]);
  const [sparklines, setSparklines] = useState<SparklineProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/charts?chart=cycle-time").then(r => r.json()),
      fetch("/api/charts?chart=throughput-sparkline").then(r => r.json()),
    ]).then(([ct, sp]) => {
      setCycleTime(ct);
      setSparklines(sp);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-gray-500 text-sm animate-pulse">Loading analytics…</div>;

  return (
    <div className="space-y-8">
      {/* Avg Cycle Time bar chart */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          ⏱️ Avg Cycle Time per Project
          <span className="text-xs font-normal text-gray-500 ml-2">(created → done)</span>
        </h3>
        {cycleTime.length === 0 ? (
          <div className="text-gray-500 text-sm">No completed issues with tracked cycle time yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cycleTime} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
              <XAxis
                dataKey="project"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatHours(v)}
              />
              <Tooltip
                contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#fff", fontSize: 13 }}
                formatter={(v: number | undefined) => {
                  if (v == null) return ["—", "Avg Cycle Time"];
                  return [formatHours(v), "Avg Cycle Time"];
                }}
              />
              <Bar dataKey="avg_cycle_hours" radius={[4, 4, 0, 0]} name="Avg Cycle Time">
                {cycleTime.map((_, i) => (
                  <Cell key={i} fill={PROJECT_COLORS[i % PROJECT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Throughput sparklines per project */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          📈 Weekly Throughput (last 8 weeks)
        </h3>
        {sparklines.length === 0 ? (
          <div className="text-gray-500 text-sm">No throughput data yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sparklines.map((proj, i) => (
              <div
                key={proj.project}
                className="glass rounded-xl p-3 border border-white/5"
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-xs font-semibold truncate"
                    style={{ color: PROJECT_COLORS[i % PROJECT_COLORS.length] }}
                  >
                    {proj.project}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
                    <span title="Last week">{proj.latest} this wk</span>
                    <span className="text-gray-600">|</span>
                    <span title="Total 8 weeks">{proj.total} total</span>
                  </div>
                </div>
                <Sparkline data={proj.sparkline} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cycle time table */}
      {cycleTime.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">📊 Cycle Time Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-white/5">
                  <th className="text-left py-2 pr-4">Project</th>
                  <th className="text-right py-2 pr-4">Done Issues</th>
                  <th className="text-right py-2 pr-4">Avg Time</th>
                  <th className="text-right py-2 pr-4">Min</th>
                  <th className="text-right py-2">Max</th>
                </tr>
              </thead>
              <tbody>
                {cycleTime.map((row, i) => (
                  <tr key={row.project} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="py-2 pr-4">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: PROJECT_COLORS[i % PROJECT_COLORS.length] + "22",
                          color: PROJECT_COLORS[i % PROJECT_COLORS.length],
                        }}
                      >
                        {row.project}
                      </span>
                    </td>
                    <td className="text-right py-2 pr-4 text-gray-300">{row.done_count}</td>
                    <td className="text-right py-2 pr-4 text-purple-300 font-mono">
                      {formatHours(row.avg_cycle_hours)}
                    </td>
                    <td className="text-right py-2 pr-4 text-gray-400 font-mono">
                      {formatHours(row.min_hours)}
                    </td>
                    <td className="text-right py-2 text-gray-400 font-mono">
                      {formatHours(row.max_hours)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
