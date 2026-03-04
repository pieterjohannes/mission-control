import { getDb, logActivity } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/skills/report
 * Agents call this after using a skill to report success/failure.
 *
 * Body:
 * {
 *   skill: string;       // skill name e.g. "weather", "gog", "ticktick"
 *   agent: string;       // agent name e.g. "kai", "alma"
 *   status: "success" | "failure" | "error";
 *   detail?: string;     // optional message / error text
 *   duration_ms?: number; // optional run duration
 * }
 *
 * Example (from agent code):
 *   await fetch('http://localhost:3100/api/skills/report', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ skill: 'weather', agent: 'kai', status: 'success', detail: 'Fetched Copenhagen weather' })
 *   });
 *
 * Or via curl:
 *   curl -s -X POST http://localhost:3100/api/skills/report \
 *     -H 'Content-Type: application/json' \
 *     -d '{"skill":"weather","agent":"kai","status":"success","detail":"Fetched weather OK"}'
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { skill, agent, status, detail, duration_ms } = body;

  if (!skill || !agent || !status) {
    return NextResponse.json(
      { error: "skill, agent, and status are required" },
      { status: 400 }
    );
  }

  if (!["success", "failure", "error"].includes(status)) {
    return NextResponse.json(
      { error: "status must be success, failure, or error" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Insert run log
  db.prepare(`
    INSERT INTO skill_runs (skill, agent, status, detail, duration_ms)
    VALUES (?, ?, ?, ?, ?)
  `).run(skill, agent, status, detail || null, duration_ms || null);

  // Upsert skill_health
  const existing = db.prepare("SELECT * FROM skill_health WHERE skill = ?").get(skill) as any;

  if (existing) {
    db.prepare(`
      UPDATE skill_health SET
        last_run = datetime('now'),
        last_status = ?,
        last_agent = ?,
        last_detail = ?,
        run_count = run_count + 1,
        success_count = success_count + ?,
        failure_count = failure_count + ?,
        updated_at = datetime('now')
      WHERE skill = ?
    `).run(
      status,
      agent,
      detail || null,
      status === "success" ? 1 : 0,
      status !== "success" ? 1 : 0,
      skill
    );
  } else {
    db.prepare(`
      INSERT INTO skill_health (skill, last_run, last_status, last_agent, last_detail, run_count, success_count, failure_count)
      VALUES (?, datetime('now'), ?, ?, ?, 1, ?, ?)
    `).run(
      skill,
      status,
      agent,
      detail || null,
      status === "success" ? 1 : 0,
      status !== "success" ? 1 : 0
    );
  }

  // Log activity
  logActivity(agent, `skill_${status}`, `[${skill}] ${detail || ""}`, null);

  const updated = db.prepare("SELECT * FROM skill_health WHERE skill = ?").get(skill);
  return NextResponse.json({ ok: true, skill: updated }, { status: 201 });
}
