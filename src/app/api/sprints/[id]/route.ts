import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const sprint = db.prepare("SELECT * FROM sprints WHERE id = ?").get(id);
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const issues = db.prepare("SELECT * FROM issues WHERE sprint_id = ? ORDER BY position ASC, created_at ASC").all(id);
  const total = issues.length;
  const done = issues.filter((i: any) => i.status === "done").length;

  return NextResponse.json({ ...sprint as object, issues, issue_count: total, done_count: done });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const sprint = db.prepare("SELECT * FROM sprints WHERE id = ?").get(id);
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fields = ["name", "goal", "status", "start_date", "end_date", "project"];
  const updates: string[] = [];
  const values: any[] = [];

  for (const f of fields) {
    if (body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(body[f]);
    }
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE sprints SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  }

  return NextResponse.json(db.prepare("SELECT * FROM sprints WHERE id = ?").get(id));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  // Unassign issues from this sprint
  db.prepare("UPDATE issues SET sprint_id = NULL, updated_at = datetime('now') WHERE sprint_id = ?").run(id);
  db.prepare("DELETE FROM sprints WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
