import { getDb, logActivity } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/issues/[id]/links
// Returns { blocking: Issue[], blocked_by: Issue[] }
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const blocking = db.prepare(`
    SELECT i.* FROM issues i
    JOIN issue_links l ON l.to_id = i.id
    WHERE l.from_id = ? AND l.type = 'blocks'
  `).all(id);

  const blocked_by = db.prepare(`
    SELECT i.* FROM issues i
    JOIN issue_links l ON l.from_id = i.id
    WHERE l.to_id = ? AND l.type = 'blocks'
  `).all(id);

  return NextResponse.json({ blocking, blocked_by });
}

// POST /api/issues/[id]/links
// Body: { target_id: string, type: "blocks" }
// Creates link: id -> target_id (id blocks target_id)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { target_id, type = "blocks" } = await req.json();

  if (!target_id) return NextResponse.json({ error: "target_id required" }, { status: 400 });

  const db = getDb();

  // Ensure both issues exist
  const from = db.prepare("SELECT id, title FROM issues WHERE id = ?").get(id) as { id: string; title: string } | undefined;
  const to = db.prepare("SELECT id, title FROM issues WHERE id = ?").get(target_id) as { id: string; title: string } | undefined;
  if (!from) return NextResponse.json({ error: "Source issue not found" }, { status: 404 });
  if (!to) return NextResponse.json({ error: "Target issue not found" }, { status: 404 });

  try {
    db.prepare("INSERT INTO issue_links (from_id, to_id, type) VALUES (?, ?, ?)").run(id, target_id, type);
  } catch (e: any) {
    if (e.message?.includes("UNIQUE")) {
      return NextResponse.json({ error: "Link already exists" }, { status: 409 });
    }
    throw e;
  }

  logActivity("kai", "link_created", `${from.title} blocks ${to.title}`, id);

  return NextResponse.json({ ok: true, from_id: id, to_id: target_id, type });
}

// DELETE /api/issues/[id]/links
// Body: { target_id: string, type: "blocks" }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { target_id, type = "blocks" } = await req.json();

  if (!target_id) return NextResponse.json({ error: "target_id required" }, { status: 400 });

  const db = getDb();
  db.prepare("DELETE FROM issue_links WHERE from_id = ? AND to_id = ? AND type = ?").run(id, target_id, type);

  logActivity("kai", "link_removed", `Link removed: ${id} → ${target_id}`, id);

  return NextResponse.json({ ok: true });
}
