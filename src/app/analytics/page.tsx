"use client";
import { lazy, Suspense } from "react";

const CycleTimeChart = lazy(() => import("@/components/charts/CycleTimeChart"));
const IssueThroughput = lazy(() => import("@/components/charts/IssueThroughput"));

function ChartCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/5">
      {title && <h2 className="text-base font-semibold text-gray-200 mb-4">{title}</h2>}
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text">📊 Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Cycle time, throughput, and velocity per project</p>
      </div>

      {/* Cycle time + throughput sparklines */}
      <ChartCard>
        <Suspense fallback={<div className="text-gray-500 text-sm animate-pulse">Loading…</div>}>
          <CycleTimeChart />
        </Suspense>
      </ChartCard>

      {/* Existing issue throughput chart */}
      <ChartCard title="📦 Issue Throughput (Created vs Completed by Week)">
        <Suspense fallback={<div className="text-gray-500 text-sm animate-pulse">Loading…</div>}>
          <IssueThroughput />
        </Suspense>
      </ChartCard>
    </div>
  );
}
