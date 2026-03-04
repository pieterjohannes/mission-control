import { getDb, logActivity } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// DELETE /api/issues/[id]/dependencies/[blocker_id]
// Removes the dependency: blocker_id no longer blocks id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; blocker_id: string }> }
) {
  const { id, blocker_id } = await params;
  const db = getDb();

  db.prepare(
    "DELETE FROM issue_links WHERE from_id = ? AND to_id = ? AND type = 'blocks'"
  ).run(blocker_id, id);

  logActivity("kai", "dependency_removed", `Blocker removed: ${blocker_id} no longer blocks ${id}`, id);

  return NextResponse.json({ ok: true, issue_id: id, blocker_id });
}
