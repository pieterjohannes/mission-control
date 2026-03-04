/**
 * AgingBadge - shows a visual indicator for stale issues
 *
 * Thresholds:
 *   in_progress: stale >7d, very stale >14d
 *   backlog:     stale >14d, very stale >28d
 *   (other statuses: no badge)
 */

interface AgingBadgeProps {
  status: string;
  daysSinceUpdate: number | null | undefined;
  /** compact: smaller font, used on cards */
  compact?: boolean;
}

export function getAgingLevel(
  status: string,
  days: number | null | undefined
): "very_stale" | "stale" | "fresh" {
  if (days == null) return "fresh";
  if (status === "in_progress") {
    if (days >= 14) return "very_stale";
    if (days >= 7) return "stale";
  } else if (status === "backlog") {
    if (days >= 28) return "very_stale";
    if (days >= 14) return "stale";
  }
  return "fresh";
}

export default function AgingBadge({ status, daysSinceUpdate, compact = false }: AgingBadgeProps) {
  const level = getAgingLevel(status, daysSinceUpdate);
  if (level === "fresh" || daysSinceUpdate == null) return null;

  const days = daysSinceUpdate;

  const styles =
    level === "very_stale"
      ? "bg-red-500/25 text-red-300 border border-red-500/40"
      : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/35";

  const sizeClass = compact ? "text-[9px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full font-semibold shrink-0 ${sizeClass} ${styles}`}
      title={`Last updated ${days} day${days !== 1 ? "s" : ""} ago`}
    >
      🕐 {days}d
    </span>
  );
}
