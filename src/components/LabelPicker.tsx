"use client";

import { useEffect, useRef, useState } from "react";

export interface Label {
  id: string;
  name: string;
  color: string;
  project: string | null;
}

interface LabelPickerProps {
  issueId: string;
  currentLabelIds: string[];
  allLabels: Label[];
  onChange?: (labelIds: string[]) => void;
}

export function LabelChip({ label, onRemove }: { label: Label; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium"
      style={{
        backgroundColor: label.color + "22",
        borderColor: label.color + "55",
        color: label.color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: label.color }}
      />
      {label.name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 opacity-60 hover:opacity-100 leading-none"
          aria-label={`Remove ${label.name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

export default function LabelPicker({ issueId, currentLabelIds, allLabels, onChange }: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(currentLabelIds);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync prop changes
  useEffect(() => { setSelected(currentLabelIds); }, [currentLabelIds.join(",")]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = async (labelId: string) => {
    const next = selected.includes(labelId)
      ? selected.filter((id) => id !== labelId)
      : [...selected, labelId];
    setSelected(next);
    setSaving(true);
    try {
      await fetch(`/api/issues/${issueId}/labels`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelIds: next }),
      });
      onChange?.(next);
    } finally {
      setSaving(false);
    }
  };

  const selectedLabels = allLabels.filter((l) => selected.includes(l.id));

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-1">
        {selectedLabels.map((label) => (
          <LabelChip key={label.id} label={label} onRemove={() => toggle(label.id)} />
        ))}
        <button
          onClick={() => setOpen(!open)}
          className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20 transition"
        >
          {saving ? "..." : "+ label"}
        </button>
      </div>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-48 rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-sm shadow-2xl p-1">
          {allLabels.length === 0 && (
            <p className="text-xs text-gray-500 p-2">No labels available</p>
          )}
          {allLabels.map((label) => (
            <button
              key={label.id}
              onClick={() => toggle(label.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition text-left"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: label.color }}
              />
              <span className="text-xs text-gray-300 flex-1">{label.name}</span>
              {selected.includes(label.id) && (
                <span className="text-[10px] text-emerald-400">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
