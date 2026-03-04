"use client";

const SCHEDULE = [
  { time: "06:00", title: "Market Open Pre-Show", status: "done" as const },
  { time: "09:00", title: "EU Markets Open", status: "done" as const },
  { time: "10:30", title: "ECB Rate Decision", status: "live" as const },
  { time: "14:00", title: "US Pre-Market", status: "upcoming" as const },
  { time: "15:30", title: "Wall Street Open", status: "upcoming" as const },
  { time: "17:00", title: "Earnings: NVDA", status: "upcoming" as const },
  { time: "18:00", title: "Commodities Wrap", status: "upcoming" as const },
  { time: "20:00", title: "Asia Preview", status: "upcoming" as const },
];

export function SchedulePanel() {
  return (
    <div className="p-3">
      <h2 className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-3">
        Schedule
      </h2>
      <div className="space-y-1">
        {SCHEDULE.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs font-mono ${
              item.status === "live"
                ? "bg-red-500/10 border border-red-500/20"
                : item.status === "done"
                ? "opacity-40"
                : "hover:bg-white/5"
            }`}
          >
            <span className="text-white/30 w-10 shrink-0">{item.time}</span>
            {item.status === "live" && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            )}
            <span
              className={`flex-1 truncate ${
                item.status === "live" ? "text-red-400 font-semibold" : "text-white/70"
              }`}
            >
              {item.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
