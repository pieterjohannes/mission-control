import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const db = getDb();

  // body.items: Array of { id, status, position }
  const update = db.prepare("UPDATE issues SET status = ?, position = ?, updated_at = datetime('now') WHERE id = ?");
  const reorder = db.transaction((items: { id: string; status: string; position: number }[]) => {
    for (const item of items) {
      update.run(item.status, item.position, item.id);
    }
  });

  reorder(body.items || []);
  return NextResponse.json({ ok: true });
}
