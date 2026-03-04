"use client";
import { lazy, Suspense } from "react";

const AgentHealthDashboard = lazy(() => import("@/components/AgentHealthDashboard"));
const WorkloadView = lazy(() => import("@/components/WorkloadView"));

export default function AgentsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-10 md:space-y-12 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold gradient-text">🤖 Agent Health</h1>
        <p className="text-gray-500 mt-1">Per-agent uptime, last seen, and task counts</p>
      </div>

      <Suspense fallback={
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse bg-white/5 rounded-2xl" />
          ))}
        </div>
      }>
        <AgentHealthDashboard />
      </Suspense>

      {/* Workload balancing section */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold gradient-text">⚖️ Workload Balancer</h1>
        <p className="text-gray-500 mt-1">Auto-assign unassigned issues based on agent capacity &amp; specialization</p>
      </div>

      <Suspense fallback={
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse bg-white/5 rounded-2xl" />
          ))}
        </div>
      }>
        <WorkloadView />
      </Suspense>
    </div>
  );
}
