import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// POST: assign issue to sprint  { issue_id }
// DELETE: unassign issue from sprint  { issue_id }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { issue_id } = await req.json();
  const db = getDb();
  db.prepare("UPDATE issues SET sprint_id = ?, updated_at = datetime('now') WHERE id = ?").run(id, issue_id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { issue_id } = await req.json();
  const db = getDb();
  db.prepare("UPDATE issues SET sprint_id = NULL, updated_at = datetime('now') WHERE id = ? AND sprint_id = ?").run(issue_id, id);
  return NextResponse.json({ ok: true });
}
