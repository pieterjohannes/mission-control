import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const db = getDb();
  const domains = db.prepare(`
    SELECT d.*, d.category, p.name as project_name FROM domains d 
    LEFT JOIN projects p ON d.project_id = p.id 
    ORDER BY d.domain
  `).all();
  return NextResponse.json(domains);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO domains (domain, registrar, status, project_id, expiry_date, notes) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(body.domain, body.registrar || "namecheap", body.status || "active", body.project_id, body.expiry_date, body.notes);
  return NextResponse.json({ id: result.lastInsertRowid });
}
