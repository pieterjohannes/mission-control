import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const db = getDb();
  const labels = db.prepare("SELECT * FROM labels ORDER BY project ASC NULLS FIRST, name ASC").all();
  return NextResponse.json(labels);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const id = body.id || `lbl-${crypto.randomBytes(4).toString("hex")}`;

  db.prepare(
    "INSERT INTO labels (id, name, color, project) VALUES (?, ?, ?, ?)"
  ).run(id, body.name, body.color || "#6366f1", body.project || null);

  const label = db.prepare("SELECT * FROM labels WHERE id = ?").get(id);
  return NextResponse.json(label, { status: 201 });
}
