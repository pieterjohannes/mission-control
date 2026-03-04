import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "..", "data");

export async function GET(req: NextRequest) {
  const dbFile = req.nextUrl.searchParams.get("db");
  const table = req.nextUrl.searchParams.get("table");
  const query = req.nextUrl.searchParams.get("query");

  // List available databases
  if (!dbFile) {
    try {
      const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".db"));
      return NextResponse.json({ databases: files });
    } catch {
      return NextResponse.json({ databases: [] });
    }
  }

  // Validate path safety
  if (dbFile.includes("..") || dbFile.includes("/")) {
    return NextResponse.json({ error: "Invalid db name" }, { status: 400 });
  }

  const dbPath = path.join(DATA_DIR, dbFile);
  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: "Database not found" }, { status: 404 });
  }

  const db = new Database(dbPath, { readonly: true });

  try {
    if (query) {
      // Only allow SELECT
      if (!query.trim().toUpperCase().startsWith("SELECT")) {
        return NextResponse.json({ error: "Only SELECT queries allowed" }, { status: 400 });
      }
      const rows = db.prepare(query).all();
      return NextResponse.json({ rows, count: rows.length });
    }

    if (table) {
      const rows = db.prepare(`SELECT * FROM "${table}" LIMIT 100`).all();
      const info = db.prepare(`PRAGMA table_info("${table}")`).all();
      return NextResponse.json({ rows, columns: info, count: rows.length });
    }

    // List tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    return NextResponse.json({ tables });
  } finally {
    db.close();
  }
}
