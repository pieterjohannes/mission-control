import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const fields = Object.keys(body).map(k => `${k} = ?`).join(", ");
  const values = Object.values(body);
  db.prepare(`UPDATE ideas SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...values, id);
  return NextResponse.json({ ok: true });
}
