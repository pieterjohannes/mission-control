import { getDb, logActivity } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/issues/[id]/dependencies
// Returns { blockers: Issue[], blocked_by: Issue[] }
// "blockers" = issues that block THIS issue (this issue is blocked by them)
// "blocked_by" = issues that THIS issue is blocking
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  // Issues that block this issue (this issue is "to_id", blockers are "from_id")
  const blockers = db.prepare(`
    SELECT i.* FROM issues i
    JOIN issue_links l ON l.from_id = i.id
    WHERE l.to_id = ? AND l.type = 'blocks'
  `).all(id);

  // Issues that this issue is blocking (this issue is "from_id", blocked are "to_id")
  const blocked_by = db.prepare(`
    SELECT i.* FROM issues i
    JOIN issue_links l ON l.to_id = i.id
    WHERE l.from_id = ? AND l.type = 'blocks'
  `).all(id);

  return NextResponse.json({ blockers, blocked_by });
}

// POST /api/issues/[id]/dependencies
// Body: { blocker_id: string } — marks blocker_id as blocking this issue
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { blocker_id } = await req.json();

  if (!blocker_id) return NextResponse.json({ error: "blocker_id required" }, { status: 400 });

  const db = getDb();
  const thisIssue = db.prepare("SELECT id, title FROM issues WHERE id = ?").get(id) as { id: string; title: string } | undefined;
  const blocker = db.prepare("SELECT id, title FROM issues WHERE id = ?").get(blocker_id) as { id: string; title: string } | undefined;

  if (!thisIssue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  if (!blocker) return NextResponse.json({ error: "Blocker issue not found" }, { status: 404 });

  try {
    // blocker_id blocks id → blocker_id is from_id, id is to_id
    db.prepare("INSERT INTO issue_links (from_id, to_id, type) VALUES (?, ?, 'blocks')").run(blocker_id, id);
  } catch (e: any) {
    if (e.message?.includes("UNIQUE")) {
      return NextResponse.json({ error: "Dependency already exists" }, { status: 409 });
    }
    throw e;
  }

  logActivity("kai", "dependency_added", `${blocker.title} now blocks ${thisIssue.title}`, id);

  return NextResponse.json({ ok: true, issue_id: id, blocker_id });
}
