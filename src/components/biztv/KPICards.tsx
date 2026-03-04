"use client";

const KPIS = [
  { label: "S&P 500", value: "5,124.32", change: "+0.84%", up: true },
  { label: "NASDAQ", value: "16,892.10", change: "+1.12%", up: true },
  { label: "EUR/USD", value: "1.0847", change: "-0.15%", up: false },
  { label: "BTC", value: "$62,340", change: "+2.41%", up: true },
  { label: "Gold", value: "$2,178", change: "-0.32%", up: false },
  { label: "VIX", value: "14.23", change: "-3.10%", up: false },
];

export function KPICards() {
  return (
    <div className="flex gap-px overflow-x-auto p-2">
      {KPIS.map((kpi) => (
        <div
          key={kpi.label}
          className="flex-1 min-w-[100px] bg-white/[0.03] rounded px-3 py-2 border border-white/5"
        >
          <div className="text-[9px] text-white/40 font-mono uppercase tracking-wide">
            {kpi.label}
          </div>
          <div className="text-sm font-bold font-mono text-white/90 mt-0.5">{kpi.value}</div>
          <div
            className={`text-[10px] font-mono font-semibold mt-0.5 ${
              kpi.up ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {kpi.change}
          </div>
        </div>
      ))}
    </div>
  );
}
