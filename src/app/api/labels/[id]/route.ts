import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM labels WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { fields.push("name = ?"); values.push(body.name); }
  if (body.color !== undefined) { fields.push("color = ?"); values.push(body.color); }
  if (body.project !== undefined) { fields.push("project = ?"); values.push(body.project); }

  if (fields.length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });
  values.push(id);

  db.prepare(`UPDATE labels SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  const label = db.prepare("SELECT * FROM labels WHERE id = ?").get(id);
  return NextResponse.json(label);
}
