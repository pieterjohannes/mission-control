"use client";
import { useEffect, useState } from "react";

interface HealthData {
  total_active: number;
  expired: number;
  expiring_within_days: number;
  expiring_count: number;
  no_auto_renew: number;
  by_category: { category: string; count: number }[];
  expiring_soon: {
    domain: string;
    days_left: number;
    category: string;
    auto_renew: boolean;
    project_name: string | null;
  }[];
}

export default function DomainHealth() {
  const [data, setData] = useState<HealthData | null>(null);

  useEffect(() => {
    fetch("/api/domains/health?days=90")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-[200px] animate-pulse bg-white/5 rounded-xl" />;

  const urgent = data.expiring_soon.filter((d) => d.days_left <= 30);
  const warning = data.expiring_soon.filter((d) => d.days_left > 30 && d.days_left <= 90);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-white/5">
          <div className="text-xl font-bold text-white">{data.total_active}</div>
          <div className="text-xs text-gray-400">Active Domains</div>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <div className={`text-xl font-bold ${data.expired > 0 ? "text-red-400" : "text-white"}`}>
            {data.expired}
          </div>
          <div className="text-xs text-gray-400">Expired</div>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <div className={`text-xl font-bold ${urgent.length > 0 ? "text-amber-400" : "text-white"}`}>
            {data.expiring_count}
          </div>
          <div className="text-xs text-gray-400">Expiring (90d)</div>
        </div>
        <div className="p-3 rounded-xl bg-white/5">
          <div className={`text-xl font-bold ${data.no_auto_renew > 0 ? "text-amber-400" : "text-white"}`}>
            {data.no_auto_renew}
          </div>
          <div className="text-xs text-gray-400">No Auto-Renew</div>
        </div>
      </div>

      {/* Urgent domains */}
      {urgent.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-red-400 mb-2">🚨 Expiring within 30 days</h3>
          <div className="space-y-1">
            {urgent.map((d) => (
              <div key={d.domain} className="flex items-center justify-between p-2 rounded-lg bg-red-500/10">
                <span className="text-sm text-white font-mono">{d.domain}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{d.category}</span>
                  <span className="text-xs font-medium text-red-400">{d.days_left}d</span>
                  {!d.auto_renew && <span className="text-xs text-amber-400">⚠️ no AR</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning domains */}
      {warning.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-400 mb-2">⏰ Expiring within 90 days</h3>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {warning.slice(0, 10).map((d) => (
              <div key={d.domain} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03]">
                <span className="text-sm text-white font-mono">{d.domain}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{d.category}</span>
                  <span className="text-xs text-amber-400">{d.days_left}d</span>
                </div>
              </div>
            ))}
            {warning.length > 10 && (
              <div className="text-xs text-gray-500 text-center py-1">
                +{warning.length - 10} more →{" "}
                <a href="/domains" className="text-purple-400 hover:underline">View all</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top categories */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-2">Top Categories</h3>
        <div className="flex flex-wrap gap-2">
          {data.by_category.slice(0, 8).map((c) => (
            <span key={c.category} className="px-2 py-1 text-xs rounded-full bg-white/5 text-gray-300">
              {c.category} <span className="text-gray-500">({c.count})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
