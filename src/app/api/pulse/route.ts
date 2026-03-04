import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const db = getDb();
  const pulses = db.prepare(
    "SELECT * FROM agent_pulse WHERE last_pulse > datetime('now', '-30 seconds')"
  ).all();
  return NextResponse.json(pulses);
}
