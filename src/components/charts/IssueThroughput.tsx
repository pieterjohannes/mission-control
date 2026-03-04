"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function IssueThroughput() {
  const [data, setData] = useState<{ week: string; created: number; completed: number }[]>([]);

  useEffect(() => {
    fetch("/api/charts?chart=issue-throughput")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data.length) return <div className="text-gray-500 text-sm">No issue data yet</div>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="week"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          tickFormatter={(v) => new Date(v + "T00:00").toLocaleDateString("en", { month: "short", day: "numeric" })}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#fff", fontSize: 13 }}
          labelFormatter={(v) => `Week of ${new Date(v + "T00:00").toLocaleDateString("en", { month: "short", day: "numeric" })}`}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
        <Bar dataKey="created" fill="#6366f1" radius={[3, 3, 0, 0]} name="Created" />
        <Bar dataKey="completed" fill="#22c55e" radius={[3, 3, 0, 0]} name="Completed" />
      </BarChart>
    </ResponsiveContainer>
  );
}
