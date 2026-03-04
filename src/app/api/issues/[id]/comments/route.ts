import { getDb, notifySubscribers } from "@/lib/db";
import { broadcast } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const comments = db.prepare("SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at ASC").all(id);
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { author, body } = await req.json();

  if (!author || !body) {
    return NextResponse.json({ error: "author and body required" }, { status: 400 });
  }

  const db = getDb();
  const issueRow = db.prepare("SELECT id, title FROM issues WHERE id = ?").get(id) as { id: string; title: string } | undefined;
  if (!issueRow) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const commentId = `cmt-${crypto.randomUUID().slice(0, 8)}`;
  db.prepare("INSERT INTO comments (id, issue_id, author, body) VALUES (?, ?, ?, ?)").run(commentId, id, author, body);
  const comment = db.prepare("SELECT * FROM comments WHERE id = ?").get(commentId);

  broadcast("comment_added", { issueId: id, comment, author });

  // Notify subscribers
  notifySubscribers(id, `💬 New comment on "${issueRow.title}" (${id}) by ${author}:\n${body.slice(0, 200)}${body.length > 200 ? "…" : ""}`);

  return NextResponse.json(comment, { status: 201 });
}
