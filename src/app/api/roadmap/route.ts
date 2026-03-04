import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const db = getDb();

  const issues = db.prepare(`
    SELECT id, title, status, project, priority, assignee, created_at, updated_at, labels
    FROM issues
    ORDER BY project ASC, created_at ASC
  `).all() as {
    id: string;
    title: string;
    status: string;
    project: string | null;
    priority: string;
    assignee: string | null;
    created_at: string;
    updated_at: string;
    labels: string;
  }[];

  const projects = db.prepare(`SELECT id, name FROM projects ORDER BY name ASC`).all() as {
    id: number;
    name: string;
  }[];

  return NextResponse.json({ issues, projects });
}
