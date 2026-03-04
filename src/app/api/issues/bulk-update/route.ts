import { getDb, logActivity } from "@/lib/db";
import { broadcast } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ids, action, value, changed_by } = body as {
    ids: string[];
    action: "status" | "priority" | "assignee" | "label" | "delete";
    value?: string;
    changed_by?: string;
  };

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }
  if (!action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  const db = getDb();
  const changer = changed_by || "pieter";
  const placeholders = ids.map(() => "?").join(", ");

  if (action === "delete") {
    db.prepare(`DELETE FROM issues WHERE id IN (${placeholders})`).run(...ids);
    for (const id of ids) {
      logActivity(changer, "bulk_delete", `Deleted issue ${id}`, id);
    }
    broadcast("issue_updated", { issueId: ids[0] });
    return NextResponse.json({ ok: true, count: ids.length });
  }

  if (action === "status" || action === "priority" || action === "assignee") {
    const col = action;
    const existing = db.prepare(`SELECT id, title, status, priority, assignee FROM issues WHERE id IN (${placeholders})`).all(...ids) as Array<{
      id: string; title: string; status: string; priority: string; assignee: string;
    }>;

    db.prepare(`UPDATE issues SET ${col} = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`).run(value ?? null, ...ids);

    for (const issue of existing) {
      const oldVal = issue[col as keyof typeof issue] as string;
      if (oldVal !== value) {
        logActivity(changer, `bulk_${action}`, `${issue.title}: ${oldVal} → ${value}`, issue.id);
      }
    }

    broadcast("issue_updated", { issueId: ids[0] });
    return NextResponse.json({ ok: true, count: ids.length });
  }

  if (action === "label") {
    // value is a label id to add to all selected issues
    if (!value) return NextResponse.json({ error: "value (label id) required" }, { status: 400 });
    const existing = db.prepare(`SELECT id, title, labels FROM issues WHERE id IN (${placeholders})`).all(...ids) as Array<{
      id: string; title: string; labels: string;
    }>;

    const updatedLabels: Record<string, string[]> = {};
    for (const issue of existing) {
      let labelIds: string[] = [];
      try { labelIds = JSON.parse(issue.labels || "[]"); } catch { labelIds = []; }
      if (!labelIds.includes(value)) {
        labelIds.push(value);
        logActivity(changer, "bulk_label", `${issue.title}: added label ${value}`, issue.id);
      }
      updatedLabels[issue.id] = labelIds;
    }

    const updateStmt = db.prepare(`UPDATE issues SET labels = ?, updated_at = datetime('now') WHERE id = ?`);
    const updateMany = db.transaction((rows: Array<{ id: string; labels: string[] }>) => {
      for (const row of rows) {
        updateStmt.run(JSON.stringify(row.labels), row.id);
      }
    });
    updateMany(Object.entries(updatedLabels).map(([id, labels]) => ({ id, labels })));

    broadcast("issue_updated", { issueId: ids[0] });
    return NextResponse.json({ ok: true, count: ids.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
