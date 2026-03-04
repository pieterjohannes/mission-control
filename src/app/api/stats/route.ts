import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const db = getDb();
  const projects = db.prepare("SELECT COUNT(*) as c FROM projects").get() as { c: number };
  const active = db.prepare("SELECT COUNT(*) as c FROM projects WHERE status IN ('active','building','launched')").get() as { c: number };
  const domains = db.prepare("SELECT COUNT(*) as c FROM domains").get() as { c: number };
  const ideas = db.prepare("SELECT COUNT(*) as c FROM ideas").get() as { c: number };
  const logs = db.prepare("SELECT COUNT(*) as c FROM agent_logs").get() as { c: number };
  const recentLogs = db.prepare("SELECT * FROM agent_logs ORDER BY created_at DESC LIMIT 5").all();
  const projectsByStatus = db.prepare("SELECT status, COUNT(*) as count FROM projects GROUP BY status").all();

  return NextResponse.json({
    totalProjects: projects.c,
    activeProjects: active.c,
    totalDomains: domains.c,
    totalIdeas: ideas.c,
    totalLogs: logs.c,
    recentLogs,
    projectsByStatus,
  });
}
