import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const db = getDb();

  // Query activity_log grouped by day of week and hour
  // SQLite: strftime('%w', ...) returns 0=Sunday, 1=Monday, ..., 6=Saturday
  const rows = db.prepare(`
    SELECT
      CAST(strftime('%w', created_at) AS INTEGER) as day_raw,
      CAST(strftime('%H', created_at) AS INTEGER) as hour,
      COUNT(*) as count
    FROM activity_log
    WHERE created_at >= datetime('now', '-90 days')
    GROUP BY day_raw, hour
    ORDER BY day_raw, hour
  `).all() as { day_raw: number; hour: number; count: number }[];

  // Convert SQLite day (0=Sun, 1=Mon..6=Sat) to Mon=0..Sun=6
  const data = rows.map(row => ({
    day: row.day_raw === 0 ? 6 : row.day_raw - 1, // Mon=0, Tue=1, ..., Sun=6
    hour: row.hour,
    count: row.count,
  }));

  const max = data.reduce((m, r) => Math.max(m, r.count), 0);

  return NextResponse.json({ data, max });
}
