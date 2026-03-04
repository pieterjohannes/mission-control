import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const db = getDb();
  const chart = req.nextUrl.searchParams.get("chart");

  if (chart === "activity-timeline") {
    // Activity count per day for last 30 days
    const rows = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count
      FROM activity_log
      WHERE created_at > datetime('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY day
    `).all();
    return NextResponse.json(rows);
  }

  if (chart === "activity-heatmap") {
    // Activity by hour-of-week for heatmap
    const rows = db.prepare(`
      SELECT 
        cast(strftime('%w', created_at) as integer) as dow,
        cast(strftime('%H', created_at) as integer) as hour,
        COUNT(*) as count
      FROM activity_log
      GROUP BY dow, hour
      ORDER BY dow, hour
    `).all();
    return NextResponse.json(rows);
  }

  if (chart === "issue-throughput") {
    // Issues created vs completed over time (by week)
    const created = db.prepare(`
      SELECT date(created_at, 'weekday 0', '-6 days') as week, COUNT(*) as created
      FROM issues
      GROUP BY week
      ORDER BY week
    `).all() as { week: string; created: number }[];

    const completed = db.prepare(`
      SELECT date(updated_at, 'weekday 0', '-6 days') as week, COUNT(*) as completed
      FROM issues
      WHERE status = 'done'
      GROUP BY week
      ORDER BY week
    `).all() as { week: string; completed: number }[];

    // Merge
    const weekMap = new Map<string, { week: string; created: number; completed: number }>();
    for (const r of created) {
      weekMap.set(r.week, { week: r.week, created: r.created, completed: 0 });
    }
    for (const r of completed) {
      const entry = weekMap.get(r.week) || { week: r.week, created: 0, completed: 0 };
      entry.completed = r.completed;
      weekMap.set(r.week, entry);
    }
    const merged = [...weekMap.values()].sort((a, b) => a.week.localeCompare(b.week));
    return NextResponse.json(merged);
  }

  if (chart === "agent-activity") {
    // Activity count per agent
    const rows = db.prepare(`
      SELECT agent, COUNT(*) as count
      FROM activity_log
      GROUP BY agent
      ORDER BY count DESC
    `).all();
    return NextResponse.json(rows);
  }

  if (chart === "issues-by-status") {
    const rows = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM issues
      GROUP BY status
      ORDER BY count DESC
    `).all();
    return NextResponse.json(rows);
  }

  if (chart === "issues-by-project") {
    const rows = db.prepare(`
      SELECT project, status, COUNT(*) as count
      FROM issues
      WHERE project IS NOT NULL
      GROUP BY project, status
      ORDER BY project
    `).all();
    return NextResponse.json(rows);
  }

  if (chart === "project-pulse") {
    const rows = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.status,
        p.domain,
        p.url,
        (SELECT COUNT(*) FROM issues i WHERE i.project = p.name AND i.status != 'done') as open_issues,
        (SELECT COUNT(*) FROM issues i WHERE i.project = p.name AND i.status = 'done') as done_issues,
        (SELECT MAX(a.created_at) FROM activity_log a 
         WHERE a.detail LIKE '%' || p.name || '%' 
            OR a.issue_id IN (SELECT i.id FROM issues i WHERE i.project = p.name)
        ) as last_activity,
        (SELECT MAX(i.updated_at) FROM issues i WHERE i.project = p.name) as last_issue_update,
        p.revenue_monthly,
        p.updated_at
      FROM projects p
      ORDER BY p.status = 'launched' DESC, p.status = 'active' DESC, p.status = 'building' DESC, p.name
    `).all();
    return NextResponse.json(rows);
  }

  if (chart === "dashboard-stats") {
    const total = (db.prepare("SELECT COUNT(*) as c FROM issues").get() as { c: number }).c;
    const inProgress = (db.prepare("SELECT COUNT(*) as c FROM issues WHERE status = 'in_progress'").get() as { c: number }).c;
    const doneThisWeek = (db.prepare(`
      SELECT COUNT(*) as c FROM issues 
      WHERE status = 'done' AND updated_at > datetime('now', '-7 days')
    `).get() as { c: number }).c;
    const activeAgents = (db.prepare(`
      SELECT COUNT(DISTINCT agent) as c FROM activity_log 
      WHERE created_at > datetime('now', '-24 hours')
    `).get() as { c: number }).c;
    const recentActivity = db.prepare(`
      SELECT agent, action, detail, issue_id, created_at 
      FROM activity_log 
      ORDER BY created_at DESC LIMIT 10
    `).all();
    return NextResponse.json({ total, inProgress, doneThisWeek, activeAgents, recentActivity });
  }

  if (chart === "cycle-time") {
    // Average cycle time (in_progress → done) per project, from activity_log transitions
    // We approximate: time between first 'in_progress' and 'done' status updates per issue
    // using updated_at on issues where status=done, and created_at as proxy for start
    const rows = db.prepare(`
      SELECT
        project,
        COUNT(*) as done_count,
        ROUND(AVG(
          (julianday(updated_at) - julianday(created_at)) * 24
        ), 1) as avg_cycle_hours,
        MIN((julianday(updated_at) - julianday(created_at)) * 24) as min_hours,
        MAX((julianday(updated_at) - julianday(created_at)) * 24) as max_hours
      FROM issues
      WHERE status = 'done'
        AND project IS NOT NULL
        AND updated_at != created_at
      GROUP BY project
      ORDER BY done_count DESC
    `).all();
    return NextResponse.json(rows);
  }

  if (chart === "weekly-throughput") {
    // Issues closed per week for last 12 weeks, grouped by project
    const project = req.nextUrl.searchParams.get("project");
    const whereClause = project ? `AND project = ?` : "";
    const params = project ? [project] : [];

    const rows = db.prepare(`
      SELECT
        date(updated_at, 'weekday 0', '-6 days') as week,
        project,
        COUNT(*) as closed
      FROM issues
      WHERE status = 'done'
        AND updated_at > datetime('now', '-12 weeks')
        ${whereClause}
      GROUP BY week, project
      ORDER BY week, project
    `).all(...params);

    // Also get list of active projects for filter
    const projects = db.prepare(`
      SELECT DISTINCT project FROM issues
      WHERE status = 'done' AND project IS NOT NULL
        AND updated_at > datetime('now', '-12 weeks')
      ORDER BY project
    `).all() as { project: string }[];

    return NextResponse.json({ rows, projects: projects.map(p => p.project) });
  }

  if (chart === "throughput-sparkline") {
    // Weekly throughput for each project as sparkline data (last 8 weeks)
    const rows = db.prepare(`
      SELECT
        project,
        date(updated_at, 'weekday 0', '-6 days') as week,
        COUNT(*) as closed
      FROM issues
      WHERE status = 'done'
        AND project IS NOT NULL
        AND updated_at > datetime('now', '-8 weeks')
      GROUP BY project, week
      ORDER BY project, week
    `).all() as { project: string; week: string; closed: number }[];

    // Build sparkline series per project
    const projectMap = new Map<string, { week: string; closed: number }[]>();
    for (const r of rows) {
      if (!projectMap.has(r.project)) projectMap.set(r.project, []);
      projectMap.get(r.project)!.push({ week: r.week, closed: r.closed });
    }

    const result = Array.from(projectMap.entries()).map(([project, weeks]) => ({
      project,
      sparkline: weeks,
      total: weeks.reduce((s, w) => s + w.closed, 0),
      latest: weeks[weeks.length - 1]?.closed ?? 0,
    }));

    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown chart type" }, { status: 400 });
}
