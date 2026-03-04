import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  // Verify issue exists
  const issue = db.prepare("SELECT id FROM issues WHERE id = ?").get(id);
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch activity_log entries for this issue
  const activityEntries = db.prepare(
    "SELECT id, agent, action, detail, created_at FROM activity_log WHERE issue_id = ? ORDER BY created_at ASC"
  ).all(id) as { id: number; agent: string; action: string; detail: string | null; created_at: string }[];

  // Fetch comments
  const comments = db.prepare(
    "SELECT id, author, body, created_at FROM comments WHERE issue_id = ? ORDER BY created_at ASC"
  ).all(id) as { id: string; author: string; body: string; created_at: string }[];

  // Fetch status_history
  const statusHistory = db.prepare(
    "SELECT id, old_status, new_status, changed_by, changed_at FROM status_history WHERE issue_id = ? ORDER BY changed_at ASC"
  ).all(id) as { id: number; old_status: string | null; new_status: string; changed_by: string; changed_at: string }[];

  // Merge into unified timeline
  const timeline: {
    id: string;
    type: "activity" | "comment" | "status_change";
    actor: string;
    action?: string;
    detail?: string | null;
    old_status?: string | null;
    new_status?: string;
    body?: string;
    created_at: string;
  }[] = [];

  for (const e of activityEntries) {
    timeline.push({
      id: `act-${e.id}`,
      type: "activity",
      actor: e.agent,
      action: e.action,
      detail: e.detail,
      created_at: e.created_at,
    });
  }

  for (const c of comments) {
    timeline.push({
      id: c.id,
      type: "comment",
      actor: c.author,
      body: c.body,
      created_at: c.created_at,
    });
  }

  for (const s of statusHistory) {
    timeline.push({
      id: `sh-${s.id}`,
      type: "status_change",
      actor: s.changed_by,
      old_status: s.old_status,
      new_status: s.new_status,
      created_at: s.changed_at,
    });
  }

  // Sort by created_at descending (most recent first)
  timeline.sort((a, b) => {
    const ta = new Date(a.created_at.includes("Z") ? a.created_at : a.created_at + "Z").getTime();
    const tb = new Date(b.created_at.includes("Z") ? b.created_at : b.created_at + "Z").getTime();
    return tb - ta;
  });

  return NextResponse.json(timeline);
}
