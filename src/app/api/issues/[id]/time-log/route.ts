import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// POST /api/issues/[id]/time-log
// Body: { agent, started_at, ended_at? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agent, started_at, ended_at } = await req.json();

  if (!agent || !started_at) {
    return NextResponse.json({ error: "agent and started_at required" }, { status: 400 });
  }

  const db = getDb();

  // Verify issue exists
  const issue = db.prepare("SELECT id FROM issues WHERE id = ?").get(id);
  if (!issue) {
    return NextResponse.json({ error: "issue not found" }, { status: 404 });
  }

  let duration_sec: number | null = null;
  if (ended_at) {
    const start = new Date(started_at).getTime();
    const end = new Date(ended_at).getTime();
    if (!isNaN(start) && !isNaN(end) && end > start) {
      duration_sec = Math.round((end - start) / 1000);
    }
  }

  const result = db.prepare(
    `INSERT INTO time_logs (issue_id, agent, started_at, ended_at, duration_sec)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, agent, started_at, ended_at || null, duration_sec);

  return NextResponse.json({ ok: true, id: result.lastInsertRowid, duration_sec });
}

// GET /api/issues/[id]/time-log
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const logs = db.prepare(
    `SELECT * FROM time_logs WHERE issue_id = ? ORDER BY started_at ASC`
  ).all(id);

  const byAgent: Record<string, number> = {};
  let total = 0;
  for (const log of logs as any[]) {
    if (log.duration_sec) {
      byAgent[log.agent] = (byAgent[log.agent] || 0) + log.duration_sec;
      total += log.duration_sec;
    }
  }

  return NextResponse.json({ logs, total_sec: total, by_agent: byAgent });
}
