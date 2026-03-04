import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const db = getDb();
  const projects = db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all();
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO projects (name, description, status, domain, repo, url, notes) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(body.name, body.description, body.status || "idea", body.domain, body.repo, body.url, body.notes);
  return NextResponse.json({ id: result.lastInsertRowid });
}
