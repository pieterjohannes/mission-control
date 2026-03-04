import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const db = getDb();
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

  // Auto-populate notifications from recent activity_log and comments
  syncNotifications(db);

  const notifications = db.prepare(`
    SELECT * FROM notifications
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);

  const unread = (db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE read = 0`).get() as { count: number }).count;

  return NextResponse.json({ notifications, unread });
}

export async function DELETE() {
  // Clear all notifications
  const db = getDb();
  db.prepare("DELETE FROM notifications").run();
  return NextResponse.json({ ok: true });
}

function syncNotifications(db: any) {
  // Import recent activity_log entries as notifications (last 50)
  const recentActivity = db.prepare(`
    SELECT * FROM activity_log
    WHERE created_at > datetime('now', '-7 days')
    ORDER BY created_at DESC
    LIMIT 50
  `).all() as any[];

  const insertNotif = db.prepare(`
    INSERT OR IGNORE INTO notifications (id, type, title, body, issue_id, agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const log of recentActivity) {
    const notifId = `act-${log.id}`;
    const existing = db.prepare("SELECT id FROM notifications WHERE id = ?").get(notifId);
    if (existing) continue;

    let title = `${log.agent}: ${log.action}`;
    let type = "agent_activity";

    if (log.action === "completed") {
      type = "issue_update";
      title = `✅ ${log.agent} completed: ${log.detail || log.issue_id || "task"}`;
    } else if (log.action === "working") {
      title = `🔨 ${log.agent} working on: ${log.detail || log.issue_id || "task"}`;
    }

    insertNotif.run(notifId, type, title, log.detail || null, log.issue_id || null, log.agent, log.created_at);
  }

  // Import recent comments as notifications
  const recentComments = db.prepare(`
    SELECT c.*, i.title as issue_title FROM comments c
    LEFT JOIN issues i ON c.issue_id = i.id
    WHERE c.created_at > datetime('now', '-7 days')
    ORDER BY c.created_at DESC
    LIMIT 20
  `).all() as any[];

  for (const comment of recentComments) {
    const notifId = `cmt-${comment.id}`;
    const existing = db.prepare("SELECT id FROM notifications WHERE id = ?").get(notifId);
    if (existing) continue;

    const hasMention = comment.body?.toLowerCase().includes("@kai") || comment.body?.toLowerCase().includes("@pieter");
    const type = hasMention ? "mention" : "issue_update";
    const title = hasMention
      ? `💬 Mention in ${comment.issue_title || comment.issue_id}`
      : `💬 ${comment.author} commented on ${comment.issue_title || comment.issue_id}`;

    insertNotif.run(notifId, type, title, comment.body?.substring(0, 200) || null, comment.issue_id, comment.author, comment.created_at);
  }
}
