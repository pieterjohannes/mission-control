import { getDb } from "@/lib/db";
import { logActivity } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const template = db.prepare("SELECT * FROM issue_templates WHERE id = ?").get(id) as any;
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  // Parse template fields
  const labels = typeof template.labels === "string" ? JSON.parse(template.labels) : template.labels;
  const subtasks = typeof template.default_subtasks === "string" ? JSON.parse(template.default_subtasks) : template.default_subtasks;

  const project = body.project ?? template.project;
  const issueId = `${(project || "misc").toLowerCase().replace(/[^a-z]/g, "").slice(0, 4)}-${crypto.randomBytes(4).toString("hex")}`;

  const maxPos = db.prepare(
    "SELECT COALESCE(MAX(position), -1) + 1 as next FROM issues WHERE status = ?"
  ).get(body.status || "backlog") as { next: number };

  db.prepare(
    `INSERT INTO issues (id, title, description, status, project, assignee, created_by, priority, labels, subtasks, position, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    issueId,
    body.title ?? template.name,
    body.description ?? template.description ?? null,
    body.status || "backlog",
    project || null,
    body.assignee || null,
    body.created_by || template.created_by || "kai",
    body.priority ?? template.priority ?? "medium",
    JSON.stringify(body.labels ?? labels),
    JSON.stringify(
      (subtasks as { title: string }[]).map((s) => ({ title: s.title ?? s, done: false }))
    ),
    body.position ?? maxPos.next,
    body.due_date || null
  );

  const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(issueId);

  logActivity(
    body.created_by || "kai",
    "issue_from_template",
    `Created issue from template "${template.name}"`,
    issueId
  );

  return NextResponse.json(issue, { status: 201 });
}
