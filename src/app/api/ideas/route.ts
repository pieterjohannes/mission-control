import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const db = getDb();
  const ideas = db.prepare("SELECT * FROM ideas ORDER BY stage, position, created_at DESC").all();
  return NextResponse.json(ideas);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO ideas (title, description, stage, priority, domain, target_audience, revenue_model, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(body.title, body.description, body.stage || "idea", body.priority || 0, body.domain, body.target_audience, body.revenue_model, body.notes);
  return NextResponse.json({ id: result.lastInsertRowid });
}
