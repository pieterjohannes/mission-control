import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const project = url.searchParams.get("project");
  const status = url.searchParams.get("status");

  let query = "SELECT * FROM sprints WHERE 1=1";
  const params: string[] = [];

  if (project) { query += " AND project = ?"; params.push(project); }
  if (status) { query += " AND status = ?"; params.push(status); }

  query += " ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'planning' THEN 1 WHEN 'completed' THEN 2 END, start_date DESC";

  const sprints = db.prepare(query).all(...params);

  // Attach issue counts to each sprint
  const result = sprints.map((sprint: any) => {
    const total = (db.prepare("SELECT COUNT(*) as c FROM issues WHERE sprint_id = ?").get(sprint.id) as { c: number }).c;
    const done = (db.prepare("SELECT COUNT(*) as c FROM issues WHERE sprint_id = ? AND status = 'done'").get(sprint.id) as { c: number }).c;
    return { ...sprint, issue_count: total, done_count: done };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const id = `sprint-${crypto.randomBytes(4).toString("hex")}`;

  db.prepare(
    `INSERT INTO sprints (id, name, goal, status, start_date, end_date, project, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    body.name,
    body.goal || null,
    body.status || "planning",
    body.start_date || null,
    body.end_date || null,
    body.project || null,
    body.created_by || "kai"
  );

  const sprint = db.prepare("SELECT * FROM sprints WHERE id = ?").get(id);
  return NextResponse.json(sprint, { status: 201 });
}
