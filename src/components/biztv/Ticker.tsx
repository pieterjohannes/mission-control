"use client";

const TICKER_ITEMS = [
  { symbol: "AAPL", price: "182.52", change: "+1.23%" },
  { symbol: "MSFT", price: "415.10", change: "+0.87%" },
  { symbol: "GOOGL", price: "147.60", change: "-0.42%" },
  { symbol: "AMZN", price: "178.25", change: "+2.10%" },
  { symbol: "META", price: "502.30", change: "+1.56%" },
  { symbol: "TSLA", price: "193.57", change: "-1.84%" },
  { symbol: "NVDA", price: "788.17", change: "+4.32%" },
  { symbol: "BRK.B", price: "412.08", change: "+0.15%" },
  { symbol: "JPM", price: "198.42", change: "+0.67%" },
  { symbol: "V", price: "282.94", change: "+0.33%" },
];

export function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]; // duplicate for seamless loop

  return (
    <div className="overflow-hidden h-7 flex items-center bg-[#080b14]">
      <div className="flex animate-ticker whitespace-nowrap">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-4 text-[11px] font-mono">
            <span className="text-amber-400 font-bold">{item.symbol}</span>
            <span className="text-white/70">{item.price}</span>
            <span
              className={`font-semibold ${
                item.change.startsWith("+") ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {item.change}
            </span>
          </span>
        ))}
      </div>

      <style jsx>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: ticker 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
