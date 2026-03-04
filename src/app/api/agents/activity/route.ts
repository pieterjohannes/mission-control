import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export interface ActiveAgent {
  issue_id: string;
  agent: string;
  last_pulse: string;
  action: string | null;
}

export interface ActivityLogEntry {
  id: number;
  agent: string;
  action: string;
  detail: string | null;
  issue_id: string | null;
  created_at: string;
}

export interface SparklinePoint {
  date: string;
  count: number;
}

export interface AgentActivityData {
  activeAgents: ActiveAgent[];
  recentLogs: ActivityLogEntry[];
  sparkline: SparklinePoint[];
}

export async function GET(): Promise<NextResponse<AgentActivityData>> {
  const db = getDb();

  // Active agents: pulse within last 2 minutes
  const activeAgents = db.prepare(`
    SELECT issue_id, agent, last_pulse, action
    FROM agent_pulse
    WHERE datetime(last_pulse) >= datetime('now', '-2 minutes')
    ORDER BY last_pulse DESC
  `).all() as ActiveAgent[];

  // Recent 10 activity_log entries
  const recentLogs = db.prepare(`
    SELECT id, agent, action, detail, issue_id, created_at
    FROM activity_log
    ORDER BY id DESC
    LIMIT 10
  `).all() as ActivityLogEntry[];

  // Sparkline: agent runs per day for past 7 days
  const sparkline = db.prepare(`
    SELECT
      date(created_at) as date,
      COUNT(*) as count
    FROM activity_log
    WHERE date(created_at) >= date('now', '-6 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all() as SparklinePoint[];

  // Fill in missing days with 0
  const today = new Date();
  const filledSparkline: SparklinePoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().substring(0, 10);
    const found = sparkline.find((s) => s.date === dateStr);
    filledSparkline.push({ date: dateStr, count: found ? found.count : 0 });
  }

  return NextResponse.json({ activeAgents, recentLogs, sparkline: filledSparkline });
}
