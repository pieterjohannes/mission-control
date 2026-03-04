"use client";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#ec4899"];

export default function AgentActivity() {
  const [data, setData] = useState<{ agent: string; count: number }[]>([]);

  useEffect(() => {
    fetch("/api/charts?chart=agent-activity")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data.length) return <div className="text-gray-500 text-sm">No agent data yet</div>;

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="agent" cx="50%" cy="50%" innerRadius={40} outerRadius={70} strokeWidth={0}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#fff", fontSize: 13 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5">
        {data.map((d, i) => (
          <div key={d.agent} className="flex items-center gap-2 text-sm">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-gray-300 capitalize">{d.agent}</span>
            <span className="text-gray-500 ml-auto">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
