import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, issue_id, old_status, new_status, changed_by, changed_at FROM status_history WHERE issue_id = ? ORDER BY changed_at ASC"
  ).all(id);
  return NextResponse.json(rows);
}
