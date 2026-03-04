import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const project = url.searchParams.get("project");

  let query = "SELECT * FROM issue_templates WHERE 1=1";
  const params: string[] = [];
  if (project) { query += " AND project = ?"; params.push(project); }
  query += " ORDER BY created_at DESC";

  const templates = db.prepare(query).all(...params);
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const id = `tpl-${crypto.randomBytes(4).toString("hex")}`;
  db.prepare(
    `INSERT INTO issue_templates (id, name, description, project, priority, labels, default_subtasks, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    body.name.trim(),
    body.description || null,
    body.project || null,
    body.priority || "medium",
    JSON.stringify(body.labels || []),
    JSON.stringify(body.default_subtasks || []),
    body.created_by || "kai"
  );

  const template = db.prepare("SELECT * FROM issue_templates WHERE id = ?").get(id);
  return NextResponse.json(template, { status: 201 });
}
