import { getDb, logActivity } from "@/lib/db";
import { broadcast } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const agent = url.searchParams.get("agent");
  const project = url.searchParams.get("project");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const since = url.searchParams.get("since");

  const db = getDb();

  // Build query — optionally join with issues to filter by project
  let query: string;
  const params: (string | number)[] = [];

  if (project && project !== "all") {
    query = `
      SELECT a.*
      FROM activity_log a
      LEFT JOIN issues i ON a.issue_id = i.id
      WHERE (i.project = ? OR a.issue_id IS NULL)
    `;
    params.push(project);
  } else {
    query = "SELECT * FROM activity_log WHERE 1=1";
  }

  if (agent && agent !== "all") {
    query += " AND agent = ?";
    params.push(agent);
  }
  if (since) {
    query += " AND created_at > ?";
    params.push(since);
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const logs = db.prepare(query).all(...params);

  // Agent status
  const agents = db.prepare(`
    SELECT agent, MAX(created_at) as last_active
    FROM activity_log
    GROUP BY agent
  `).all() as { agent: string; last_active: string }[];

  // Projects list (for filter UI)
  const projects = db.prepare(`
    SELECT DISTINCT i.project
    FROM issues i
    WHERE i.project IS NOT NULL AND i.project != ''
    ORDER BY i.project
  `).all() as { project: string }[];

  // Total count for pagination
  let countQuery: string;
  const countParams: (string | number)[] = [];
  if (project && project !== "all") {
    countQuery = `SELECT COUNT(*) as total FROM activity_log a LEFT JOIN issues i ON a.issue_id = i.id WHERE (i.project = ? OR a.issue_id IS NULL)`;
    countParams.push(project);
  } else {
    countQuery = "SELECT COUNT(*) as total FROM activity_log WHERE 1=1";
  }
  if (agent && agent !== "all") {
    countQuery += " AND agent = ?";
    countParams.push(agent);
  }
  const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

  return NextResponse.json({ logs, agents, projects: projects.map(p => p.project), total, offset, limit });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.agent || !body.action) {
    return NextResponse.json({ error: "agent and action required" }, { status: 400 });
  }
  logActivity(body.agent, body.action, body.detail, body.issue_id);

  broadcast("activity_logged", {
    agent: body.agent,
    action: body.action,
    detail: body.detail,
    issueId: body.issue_id,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
