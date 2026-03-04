import { getDb } from "@/lib/db";
import { broadcast } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agent, action = "working" } = await req.json();

  if (!agent) {
    return NextResponse.json({ error: "agent required" }, { status: 400 });
  }

  const db = getDb();

  if (action === "idle") {
    db.prepare("DELETE FROM agent_pulse WHERE issue_id = ?").run(id);

    // Close any open time_log for this agent+issue
    const openLog = db.prepare(
      `SELECT id, started_at FROM time_logs
       WHERE issue_id = ? AND agent = ? AND ended_at IS NULL
       ORDER BY started_at DESC LIMIT 1`
    ).get(id, agent) as { id: number; started_at: string } | undefined;

    if (openLog) {
      const now = new Date().toISOString();
      const startMs = new Date(openLog.started_at).getTime();
      const duration_sec = Math.round((Date.now() - startMs) / 1000);
      db.prepare(
        `UPDATE time_logs SET ended_at = ?, duration_sec = ? WHERE id = ?`
      ).run(now, duration_sec, openLog.id);
    }
  } else {
    db.prepare(
      `INSERT INTO agent_pulse (issue_id, agent, last_pulse, action)
       VALUES (?, ?, datetime('now'), ?)
       ON CONFLICT(issue_id) DO UPDATE SET agent = ?, last_pulse = datetime('now'), action = ?`
    ).run(id, agent, action, agent, action);

    // Open a time_log if none is open for this agent+issue
    const openLog = db.prepare(
      `SELECT id FROM time_logs
       WHERE issue_id = ? AND agent = ? AND ended_at IS NULL LIMIT 1`
    ).get(id, agent);

    if (!openLog) {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO time_logs (issue_id, agent, started_at) VALUES (?, ?, ?)`
      ).run(id, agent, now);
    }
  }

  broadcast("agent_pulse", { issueId: id, agent, action });

  return NextResponse.json({ ok: true });
}
