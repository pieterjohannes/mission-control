import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const project = url.searchParams.get("project");
  const assignee = url.searchParams.get("assignee");
  const priority = url.searchParams.get("priority");
  const status = url.searchParams.get("status");
  const label = url.searchParams.get("label");
  const sprint = url.searchParams.get("sprint");

  let query = "SELECT *, CAST(julianday('now') - julianday(updated_at) AS INTEGER) as days_since_update FROM issues WHERE 1=1";
  const params: string[] = [];

  if (project) { query += " AND project = ?"; params.push(project); }
  if (assignee) { query += " AND assignee = ?"; params.push(assignee); }
  if (priority) { query += " AND priority = ?"; params.push(priority); }
  if (status) { query += " AND status = ?"; params.push(status); }
  if (label) { query += " AND labels LIKE ?"; params.push(`%"${label}"%`); }
  if (sprint === "none") { query += " AND (sprint_id IS NULL OR sprint_id = '')"; }
  else if (sprint) { query += " AND sprint_id = ?"; params.push(sprint); }

  query += " ORDER BY position ASC, created_at ASC";

  const issues = db.prepare(query).all(...params);
  return NextResponse.json(issues);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const id = body.id || `${(body.project || "misc").toLowerCase().replace(/[^a-z]/g, "").slice(0, 4)}-${crypto.randomBytes(4).toString("hex")}`;

  // Get max position for this status
  const maxPos = db.prepare("SELECT COALESCE(MAX(position), -1) + 1 as next FROM issues WHERE status = ?").get(body.status || "backlog") as { next: number };

  db.prepare(
    `INSERT INTO issues (id, title, description, status, project, assignee, created_by, priority, labels, subtasks, position, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    body.title,
    body.description || null,
    body.status || "backlog",
    body.project || null,
    body.assignee || null,
    body.created_by || "kai",
    body.priority || "medium",
    JSON.stringify(body.labels || []),
    JSON.stringify(body.subtasks || []),
    body.position ?? maxPos.next,
    body.due_date || null
  );

  const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(id);

  // Auto-enrich if description is very short (< 50 chars)
  const descLen = (body.description || "").length;
  if (descLen < 50) {
    // Fire-and-forget async enrichment
    fetch(`http://localhost:3100/api/issues/${id}/enrich`, { method: "POST" }).catch(() => {});
  }

  return NextResponse.json(issue, { status: 201 });
}
