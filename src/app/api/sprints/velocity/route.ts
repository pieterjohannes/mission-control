import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      s.id        AS sprint_id,
      s.name      AS sprint_name,
      s.start_date,
      s.end_date,
      s.status,
      COUNT(i.id) AS total,
      SUM(CASE WHEN i.status = 'done' THEN 1 ELSE 0 END) AS completed
    FROM sprints s
    LEFT JOIN issues i ON i.sprint_id = s.id
    GROUP BY s.id
    ORDER BY s.start_date ASC, s.created_at ASC
  `).all();

  return NextResponse.json(rows);
}
