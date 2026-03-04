import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDb();
  const { id: agent } = await params;

  // Get all activity for the last 90 days, grouped by date
  const rows = db.prepare(`
    SELECT
      date(created_at) as date,
      COUNT(*) as count,
      SUM(CASE WHEN issue_id IS NOT NULL AND action NOT IN ('commented','comment') THEN 1 ELSE 0 END) as issues,
      SUM(CASE WHEN action IN ('commented','comment','note') THEN 1 ELSE 0 END) as comments,
      COUNT(*) - SUM(CASE WHEN issue_id IS NOT NULL AND action NOT IN ('commented','comment') THEN 1 ELSE 0 END) - SUM(CASE WHEN action IN ('commented','comment','note') THEN 1 ELSE 0 END) as actions
    FROM activity_log
    WHERE agent = ?
      AND created_at >= date('now', '-90 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(agent) as { date: string; count: number; issues: number; comments: number; actions: number }[];

  return NextResponse.json({ dates: rows, agent });
}
