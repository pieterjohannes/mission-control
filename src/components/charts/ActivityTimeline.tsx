"use client";
import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function ActivityTimeline() {
  const [data, setData] = useState<{ day: string; count: number }[]>([]);

  useEffect(() => {
    fetch("/api/charts?chart=activity-timeline")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data.length) return <div className="text-gray-500 text-sm">No activity data yet</div>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="day"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          tickFormatter={(v) => new Date(v + "T00:00").toLocaleDateString("en", { month: "short", day: "numeric" })}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#fff", fontSize: 13 }}
          labelFormatter={(v) => new Date(v + "T00:00").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
        />
        <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="url(#actGrad)" strokeWidth={2} name="Activities" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
