import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export interface LeaderboardEntry {
  agent: string;
  issuesClosedThisWeek: number;
  avgHoursToClose: number | null;
  totalClosed: number;
  rank: number;
}

export async function GET() {
  const db = getDb();

  // Start of current week (Monday 00:00)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const weekStart = monday.toISOString().replace("T", " ").slice(0, 19);

  // Issues closed this week: from status_history, new_status='done', grouped by changed_by (agent)
  const closedThisWeek = db.prepare(`
    SELECT
      sh.changed_by AS agent,
      COUNT(DISTINCT sh.issue_id) AS issues_closed
    FROM status_history sh
    WHERE sh.new_status = 'done'
      AND sh.changed_at >= ?
    GROUP BY sh.changed_by
    ORDER BY issues_closed DESC
  `).all(weekStart) as { agent: string; issues_closed: number }[];

  // Also check activity_log for 'complete'/'completed'/'issue_completed' actions this week
  // (some completions might only be in activity_log)
  const activityClosed = db.prepare(`
    SELECT
      agent,
      COUNT(DISTINCT issue_id) AS issues_closed
    FROM activity_log
    WHERE action IN ('complete', 'completed', 'issue_completed')
      AND created_at >= ?
      AND issue_id IS NOT NULL
    GROUP BY agent
  `).all(weekStart) as { agent: string; issues_closed: number }[];

  // Merge both sources
  const merged = new Map<string, number>();
  for (const row of closedThisWeek) {
    merged.set(row.agent, (merged.get(row.agent) || 0) + row.issues_closed);
  }
  for (const row of activityClosed) {
    // Only add if not already counted via status_history (avoid double-counting)
    // Use status_history as source of truth; activity_log supplements agents not in status_history
    if (!closedThisWeek.find(r => r.agent === row.agent)) {
      merged.set(row.agent, (merged.get(row.agent) || 0) + row.issues_closed);
    }
  }

  // Avg time-to-close per agent: from issue created_at to when status became 'done'
  // Use status_history joined with issues
  const avgTimeToClose = db.prepare(`
    SELECT
      sh.changed_by AS agent,
      COUNT(DISTINCT sh.issue_id) AS total_closed,
      AVG(
        (julianday(sh.changed_at) - julianday(i.created_at)) * 24
      ) AS avg_hours
    FROM status_history sh
    JOIN issues i ON i.id = sh.issue_id
    WHERE sh.new_status = 'done'
    GROUP BY sh.changed_by
  `).all() as { agent: string; total_closed: number; avg_hours: number }[];

  const avgMap = new Map<string, { total: number; avgHours: number }>();
  for (const row of avgTimeToClose) {
    avgMap.set(row.agent, { total: row.total_closed, avgHours: Math.round(row.avg_hours * 10) / 10 });
  }

  // Build leaderboard — include all agents with any activity this week, or from status_history
  const allAgents = new Set([...merged.keys()]);
  // Also include agents with closed issues ever (for context)
  for (const agent of avgMap.keys()) {
    allAgents.add(agent);
  }

  const leaderboard: LeaderboardEntry[] = [...allAgents]
    .map(agent => ({
      agent,
      issuesClosedThisWeek: merged.get(agent) || 0,
      avgHoursToClose: avgMap.get(agent)?.avgHours ?? null,
      totalClosed: avgMap.get(agent)?.total || 0,
      rank: 0,
    }))
    .filter(e => e.issuesClosedThisWeek > 0 || e.totalClosed > 0)
    .sort((a, b) => {
      // Sort by this week first, then total
      if (b.issuesClosedThisWeek !== a.issuesClosedThisWeek) return b.issuesClosedThisWeek - a.issuesClosedThisWeek;
      return b.totalClosed - a.totalClosed;
    })
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  return NextResponse.json({ leaderboard, weekStart });
}
