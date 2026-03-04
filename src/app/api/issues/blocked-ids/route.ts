import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/issues/blocked-ids
// Returns array of { id: string, count: number } for issues that are blocked
// by at least one open (non-done) issue.
export async function GET() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT l.to_id as id, COUNT(*) as count
    FROM issue_links l
    JOIN issues blocker ON blocker.id = l.from_id
    WHERE l.type = 'blocks'
      AND blocker.status != 'done'
    GROUP BY l.to_id
  `).all() as { id: string; count: number }[];
  return NextResponse.json(rows);
}
