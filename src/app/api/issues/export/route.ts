import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json";
  const project = url.searchParams.get("project");

  let query = "SELECT * FROM issues WHERE 1=1";
  const params: string[] = [];
  if (project) {
    query += " AND project = ?";
    params.push(project);
  }
  query += " ORDER BY project ASC, status ASC, position ASC";

  const issues = db.prepare(query).all(...params) as Record<string, unknown>[];

  if (format === "csv") {
    const columns = [
      "id", "title", "description", "status", "priority", "project",
      "assignee", "created_by", "labels", "subtasks", "due_date",
      "sprint_id", "position", "created_at", "updated_at"
    ];
    const header = columns.join(",");
    const rows = issues.map(issue =>
      columns.map(col => escapeCSV(issue[col])).join(",")
    );
    const csv = [header, ...rows].join("\n");

    const filename = project
      ? `issues-${project.toLowerCase().replace(/\s+/g, "-")}.csv`
      : "issues-all.csv";

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // JSON export
  const filename = project
    ? `issues-${project.toLowerCase().replace(/\s+/g, "-")}.json`
    : "issues-all.json";

  return new NextResponse(JSON.stringify(issues, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
