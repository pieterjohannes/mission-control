"use client";
import { useEffect, useCallback } from "react";

export interface KeyboardShortcutHandlers {
  onNewIssue?: () => void;
  onClose?: () => void;
  onNavigateNext?: () => void;
  onNavigatePrev?: () => void;
  onEditFocused?: () => void;
  onOpenFocused?: () => void;
  onAssignFocused?: () => void;
  onLabelFocused?: () => void;
  onStatusFocused?: () => void;
  onMarkDone?: () => void;
  onToggleHelp?: () => void;
  /** If true, skip global shortcuts (e.g. when typing in an input) */
  disabled?: boolean;
}

export const SHORTCUT_DEFINITIONS = [
  { key: "N", description: "New issue" },
  { key: "J / ↓", description: "Navigate to next issue" },
  { key: "K / ↑", description: "Navigate to previous issue" },
  { key: "Enter", description: "Open focused issue" },
  { key: "E", description: "Edit focused issue" },
  { key: "A", description: "Assign focused issue" },
  { key: "L", description: "Label focused issue" },
  { key: "S", description: "Change status of focused issue" },
  { key: "D", description: "Mark focused issue done" },
  { key: "Esc", description: "Close dialog / panel" },
  { key: "?", description: "Toggle this help" },
] as const;

/** Returns true if the active element is an input-like element (suppress shortcuts) */
function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const {
    onNewIssue,
    onClose,
    onNavigateNext,
    onNavigatePrev,
    onEditFocused,
    onOpenFocused,
    onAssignFocused,
    onLabelFocused,
    onStatusFocused,
    onMarkDone,
    onToggleHelp,
    disabled,
  } = handlers;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Always allow Escape to close dialogs — even when other shortcuts are "disabled"
      if (e.key === "Escape") {
        onClose?.();
        return;
      }

      if (disabled) return;

      // Skip when typing in an input/textarea/select
      if (isTypingTarget(document.activeElement)) return;

      // Skip if modifier keys are held (don't interfere with browser shortcuts)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case "n":
        case "N":
          e.preventDefault();
          onNewIssue?.();
          break;

        case "j":
        case "J":
        case "ArrowDown":
          e.preventDefault();
          onNavigateNext?.();
          break;

        case "k":
        case "K":
        case "ArrowUp":
          e.preventDefault();
          onNavigatePrev?.();
          break;

        case "Enter":
          e.preventDefault();
          onOpenFocused?.();
          break;

        case "e":
        case "E":
          e.preventDefault();
          onEditFocused?.();
          break;

        case "a":
        case "A":
          e.preventDefault();
          onAssignFocused?.();
          break;

        case "l":
        case "L":
          e.preventDefault();
          onLabelFocused?.();
          break;

        case "s":
        case "S":
          e.preventDefault();
          onStatusFocused?.();
          break;

        case "d":
        case "D":
          e.preventDefault();
          onMarkDone?.();
          break;

        case "?":
          e.preventDefault();
          onToggleHelp?.();
          break;
      }
    },
    [disabled, onNewIssue, onClose, onNavigateNext, onNavigatePrev, onEditFocused, onOpenFocused, onAssignFocused, onLabelFocused, onStatusFocused, onMarkDone, onToggleHelp]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
