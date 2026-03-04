import { getDb, logActivity, notifySubscribers } from "@/lib/db";
import { broadcast } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const existing = db.prepare("SELECT * FROM issues WHERE id = ?").get(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of ["title", "description", "status", "project", "assignee", "created_by", "priority", "position", "due_date", "effort_size"]) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  for (const key of ["labels", "subtasks"]) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(JSON.stringify(body[key]));
    }
  }

  if (fields.length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE issues SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  const updated = db.prepare("SELECT * FROM issues WHERE id = ?").get(id) as Record<string, unknown>;

  // Extract old values for comparison
  const oldStatus = (existing as Record<string, unknown>).status as string;
  const oldAssignee = (existing as Record<string, unknown>).assignee as string;

  // Log activity
  const changer = body.changed_by || "pieter";
  if (body.status !== undefined && body.status !== oldStatus) {
    logActivity(changer, "status_change", `${(existing as Record<string, unknown>).title}: ${oldStatus} → ${body.status}`, id);
    // Record status history
    db.prepare(
      "INSERT INTO status_history (issue_id, old_status, new_status, changed_by, changed_at) VALUES (?, ?, ?, ?, datetime('now'))"
    ).run(id, oldStatus, body.status, changer);
  }
  if (body.assignee !== undefined && body.assignee !== oldAssignee) {
    logActivity(changer, "assignee_change", `${(existing as Record<string, unknown>).title}: ${oldAssignee || "unassigned"} → ${body.assignee}`, id);
    notifySubscribers(id, `👤 Issue "${(existing as Record<string, unknown>).title}" (${id}) reassigned: ${oldAssignee || "unassigned"} → ${body.assignee}`);
  }

  if (body.status !== undefined && body.status !== oldStatus) {
    notifySubscribers(id, `📋 Issue "${(existing as Record<string, unknown>).title}" (${id}) status changed: ${oldStatus} → ${body.status}`);
  }

  // Notify Kai instantly — only when status CHANGED to an actionable state
  const newAssignee = (body.assignee ?? oldAssignee) as string;
  const newStatus = (body.status ?? oldStatus) as string;
  const statusChanged = body.status !== undefined && body.status !== oldStatus;
  const assigneeChanged = body.assignee !== undefined && body.assignee !== oldAssignee;
  if (newAssignee === "kai" && ["next", "in_progress"].includes(newStatus) && (statusChanged || assigneeChanged)) {
    const title = updated.title;
    const priority = updated.priority;
    const project = updated.project;
    const msg = `🎯 Mission Control: Issue "${title}" (${id}) [${priority}] in project "${project}" was moved to "${newStatus}" and assigned to you. Check it and start working on it.`;
    fetch("http://localhost:3100/api/webhook/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg }),
    }).catch(() => {});
  }

  // Broadcast SSE — only for meaningful changes (skip position-only and no-op saves)
  const meaningfulFields = Object.keys(body).filter(k => k !== "position" && k !== "changed_by");
  const hasRealChange = meaningfulFields.some(k => {
    const oldVal = (existing as Record<string, unknown>)[k];
    const newVal = body[k];
    if (k === "labels" || k === "subtasks") {
      return JSON.stringify(oldVal) !== JSON.stringify(newVal);
    }
    return String(oldVal ?? "") !== String(newVal ?? "");
  });
  if (hasRealChange && meaningfulFields.length > 0) {
    broadcast("issue_updated", {
      issueId: id,
      fields: meaningfulFields,
      agent: changer,
      issue: updated,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM issues WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
