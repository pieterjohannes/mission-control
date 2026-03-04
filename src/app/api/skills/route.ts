import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const db = getDb();

  // Get all skill health records
  const skills = db.prepare(`
    SELECT * FROM skill_health ORDER BY updated_at DESC
  `).all();

  // Also get recent run history per skill (last 10)
  const recentRuns = db.prepare(`
    SELECT * FROM skill_runs ORDER BY created_at DESC LIMIT 100
  `).all();

  return NextResponse.json({ skills, recentRuns });
}
