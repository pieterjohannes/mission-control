import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export interface StandupSummary {
  date: string;
  completed: IssueRow[];
  inReview: IssueRow[];
  inProgress: IssueRow[];
  nextUp: IssueRow[];
  blockers: IssueRow[];
  generatedAt: string;
}

interface IssueRow {
  id: string;
  title: string;
  project: string | null;
  assignee: string | null;
  priority: string;
  labels: string;
  status: string;
  updated_at: string;
}

function buildSummary(): StandupSummary {
  const db = getDb();

  const completed = db
    .prepare(
      `SELECT id, title, project, assignee, priority, labels, status, updated_at FROM issues
       WHERE status = 'done' AND updated_at > datetime('now', '-24 hours')
       ORDER BY updated_at DESC`
    )
    .all() as IssueRow[];

  const inReview = db
    .prepare(
      `SELECT id, title, project, assignee, priority, labels, status, updated_at FROM issues
       WHERE status = 'review'
       ORDER BY priority DESC, updated_at DESC`
    )
    .all() as IssueRow[];

  const inProgress = db
    .prepare(
      `SELECT id, title, project, assignee, priority, labels, status, updated_at FROM issues
       WHERE status = 'in_progress'
       ORDER BY priority DESC, updated_at DESC`
    )
    .all() as IssueRow[];

  const nextUp = db
    .prepare(
      `SELECT id, title, project, assignee, priority, labels, status, updated_at FROM issues
       WHERE status = 'next'
       ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC, updated_at DESC
       LIMIT 3`
    )
    .all() as IssueRow[];

  const blockers = db
    .prepare(
      `SELECT id, title, project, assignee, priority, labels, status, updated_at FROM issues
       WHERE status = 'blocked' OR labels LIKE '%blocked%'
       ORDER BY priority DESC, updated_at DESC`
    )
    .all() as IssueRow[];

  const now = new Date();
  return {
    date: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    completed,
    inReview,
    inProgress,
    nextUp,
    blockers,
    generatedAt: now.toISOString(),
  };
}

function formatStandupText(summary: StandupSummary): string {
  const lines: string[] = [`📋 Daily Standup — ${summary.date}`, ""];

  const section = (title: string, issues: IssueRow[]) => {
    lines.push(title);
    if (issues.length === 0) {
      lines.push("  — none");
    } else {
      for (const i of issues) {
        const proj = i.project ? ` [${i.project}]` : "";
        const who = i.assignee ? ` @${i.assignee}` : "";
        lines.push(`  • ${i.id}: ${i.title}${proj}${who}`);
      }
    }
    lines.push("");
  };

  section("✅ Completed (last 24h):", summary.completed);
  section("🔍 In Review:", summary.inReview);
  section("🔨 In Progress:", summary.inProgress);
  section("📌 Next Up:", summary.nextUp);
  section("🚧 Blockers:", summary.blockers);

  return lines.join("\n").trim();
}

export async function GET() {
  const summary = buildSummary();
  return NextResponse.json(summary);
}

export async function POST() {
  const db = getDb();
  const now = new Date().toISOString();

  // Ensure meta-standup issue exists
  const existing = db.prepare("SELECT id FROM issues WHERE id = ?").get("meta-standup");
  if (!existing) {
    db.prepare(
      `INSERT INTO issues (id, title, description, status, project, assignee, created_by, priority, labels, subtasks, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "meta-standup",
      "Daily Standup Log",
      "Auto-generated daily standup summaries from Kai.",
      "in_progress",
      "Mission Control",
      null,
      "kai",
      "low",
      '["ops"]',
      "[]",
      999
    );
  }

  // Generate summary
  const summary = buildSummary();
  const text = formatStandupText(summary);
  const datePrefix = new Date().toISOString().slice(0, 10);
  const body = `**${datePrefix}**\n\n${text}`;

  // Save as comment
  const commentId = "c-" + Math.random().toString(36).slice(2, 10);
  db.prepare(
    "INSERT INTO comments (id, issue_id, author, body, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(commentId, "meta-standup", "kai", body, now);

  // Log activity
  db.prepare(
    "INSERT INTO activity_log (agent, action, detail, issue_id, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run("kai", "standup_generated", `Daily standup generated for ${datePrefix}`, "meta-standup", now);

  return NextResponse.json({ ok: true, commentId, summary });
}
