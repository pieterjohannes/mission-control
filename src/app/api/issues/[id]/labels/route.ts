import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const issue = db.prepare("SELECT labels FROM issues WHERE id = ?").get(id) as { labels: string } | undefined;
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let labelIds: string[] = [];
  try { labelIds = JSON.parse(issue.labels || "[]"); } catch { labelIds = []; }

  // Resolve label objects
  const labels = labelIds.length > 0
    ? db.prepare(`SELECT * FROM labels WHERE id IN (${labelIds.map(() => "?").join(",")}) ORDER BY name ASC`).all(...labelIds)
    : [];

  return NextResponse.json({ labelIds, labels });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const labelIds: string[] = body.labelIds || [];

  db.prepare("DROP TRIGGER IF EXISTS issues_ai").run();
  db.prepare("DROP TRIGGER IF EXISTS issues_au").run();
  db.prepare("DROP TRIGGER IF EXISTS issues_ad").run();

  db.prepare("UPDATE issues SET labels = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(labelIds), id);

  db.prepare("INSERT INTO issues_fts(issues_fts) VALUES('rebuild')").run();

  const labels = labelIds.length > 0
    ? db.prepare(`SELECT * FROM labels WHERE id IN (${labelIds.map(() => "?").join(",")}) ORDER BY name ASC`).all(...labelIds)
    : [];

  return NextResponse.json({ labelIds, labels });
}
