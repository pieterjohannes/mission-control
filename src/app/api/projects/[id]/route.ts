import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const fields = Object.keys(body).map(k => `${k} = ?`).join(", ");
  const values = Object.values(body);
  db.prepare(`UPDATE projects SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...values, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
