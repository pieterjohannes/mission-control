"use client";

import { useState } from "react";
import { VideoPlayer } from "@/components/biztv/VideoPlayer";
import { SchedulePanel } from "@/components/biztv/SchedulePanel";
import { KPICards } from "@/components/biztv/KPICards";
import { TopNews } from "@/components/biztv/TopNews";
import { Ticker } from "@/components/biztv/Ticker";

export default function BizTVPage() {
  const [focusMode, setFocusMode] = useState(false);

  return (
    <div className="flex flex-col bg-[#0a0e1a] text-slate-100 overflow-hidden -m-4 md:-m-8" style={{ height: "calc(100vh - 0px)" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#0d1117] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-bold tracking-wider text-white/90 uppercase">
            Biz<span className="text-amber-400">TV</span>
          </span>
          <span className="text-[10px] text-white/40 font-mono">LIVE</span>
        </div>
        <button
          onClick={() => setFocusMode(!focusMode)}
          className={`text-xs px-3 py-1 rounded border transition-all ${
            focusMode
              ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
              : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"
          }`}
        >
          {focusMode ? "⚡ FOCUS" : "☰ FULL"}
        </button>
      </header>

      {/* Main Grid */}
      <div
        className={`flex-1 grid gap-px bg-white/5 overflow-hidden transition-all ${
          focusMode
            ? "grid-cols-1 grid-rows-1"
            : "grid-cols-[1fr_320px] grid-rows-[1fr_auto_auto]"
        }`}
      >
        {/* A: Video Player - always visible */}
        <div className={`bg-[#0d1117] overflow-hidden ${focusMode ? "" : "row-span-1"}`}>
          <VideoPlayer />
        </div>

        {/* B: Schedule Panel */}
        {!focusMode && (
          <div className="bg-[#0d1117] overflow-y-auto row-span-2 border-l border-white/5">
            <SchedulePanel />
          </div>
        )}

        {/* C: KPI Cards */}
        {!focusMode && (
          <div className="bg-[#0d1117] border-t border-white/5">
            <KPICards />
          </div>
        )}

        {/* D: Top News */}
        {!focusMode && (
          <div className="bg-[#0d1117] border-t border-white/5">
            <TopNews />
          </div>
        )}
      </div>

      {/* E: Ticker - always visible */}
      <div className="shrink-0 border-t border-white/10 bg-[#0d1117]">
        <Ticker />
      </div>
    </div>
  );
}
