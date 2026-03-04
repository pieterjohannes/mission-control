"use client";
import { SHORTCUT_DEFINITIONS } from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsLegendProps {
  onClose: () => void;
}

export default function KeyboardShortcutsLegend({ onClose }: KeyboardShortcutsLegendProps) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-sm mx-4 shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-100">⌨️ Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
        </div>
        <div className="space-y-2">
          {SHORTCUT_DEFINITIONS.map(({ key, description }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-400">{description}</span>
              <kbd className="shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-white/8 border border-white/15 text-xs text-gray-300 font-mono min-w-[2rem] text-center">
                {key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-600 mt-4">Shortcuts are disabled when typing in a field.</p>
      </div>
    </div>
  );
}
