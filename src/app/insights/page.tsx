"use client";

import { lazy, Suspense } from "react";

const HeatmapChart = lazy(() => import("@/components/HeatmapChart"));

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-200">{title}</h2>
        {subtitle && <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function InsightsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text">🔎 Insights</h1>
        <p className="text-gray-500 text-sm mt-1">Work patterns, productive windows, and activity trends</p>
      </div>

      <ChartCard
        title="🗓️ Activity Heatmap"
        subtitle="Agent actions by day of week and hour of day (last 90 days)"
      >
        <Suspense fallback={<div className="text-gray-500 text-sm animate-pulse py-8 text-center">Loading…</div>}>
          <HeatmapChart />
        </Suspense>
      </ChartCard>
    </div>
  );
}
