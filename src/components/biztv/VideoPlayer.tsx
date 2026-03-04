"use client";

import { useState } from "react";

const CHANNELS = [
  { id: "bloomberg", label: "Bloomberg", src: "https://www.youtube.com/embed/dp8PhLsUcFE?autoplay=1&mute=1" },
  { id: "cnbc", label: "CNBC", src: "https://www.youtube.com/embed/9NyxcX3rhQs?autoplay=1&mute=1" },
  { id: "dw", label: "DW News", src: "https://www.youtube.com/embed/GE_SfNVNyqk?autoplay=1&mute=1" },
];

export function VideoPlayer() {
  const [channel, setChannel] = useState(0);
  const ch = CHANNELS[channel];

  return (
    <div className="flex flex-col h-full">
      {/* Channel selector */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-black/30 shrink-0">
        {CHANNELS.map((c, i) => (
          <button
            key={c.id}
            onClick={() => setChannel(i)}
            className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wide transition-all ${
              i === channel
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {/* Video */}
      <div className="flex-1 relative bg-black">
        <iframe
          key={ch.id}
          src={ch.src}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    </div>
  );
}
