import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { subscriber, channel = "telegram" } = await req.json();

  if (!subscriber) {
    return NextResponse.json({ error: "subscriber is required" }, { status: 400 });
  }

  const db = getDb();
  const issue = db.prepare("SELECT id FROM issues WHERE id = ?").get(id);
  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  db.prepare(`
    INSERT INTO issue_subscriptions (issue_id, subscriber, channel)
    VALUES (?, ?, ?)
    ON CONFLICT(issue_id, subscriber) DO UPDATE SET channel = excluded.channel
  `).run(id, subscriber, channel);

  return NextResponse.json({ ok: true, issue_id: id, subscriber, channel }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { subscriber } = await req.json();

  if (!subscriber) {
    return NextResponse.json({ error: "subscriber is required" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("DELETE FROM issue_subscriptions WHERE issue_id = ? AND subscriber = ?").run(id, subscriber);

  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const subs = db.prepare("SELECT * FROM issue_subscriptions WHERE issue_id = ? ORDER BY created_at ASC").all(id);
  return NextResponse.json(subs);
}
