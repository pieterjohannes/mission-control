import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json().catch(() => ({}));

  if (body.all) {
    db.prepare("UPDATE notifications SET read = 1").run();
    return NextResponse.json({ ok: true, updated: "all" });
  }

  if (body.id) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(body.id);
    return NextResponse.json({ ok: true, updated: body.id });
  }

  return NextResponse.json({ error: "Provide id or all:true" }, { status: 400 });
}
