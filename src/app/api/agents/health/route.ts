import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export interface AgentHealth {
  agent: string;
  lastSeen: string | null;
  taskCount: number;
  status: "active" | "idle" | "offline";
  recentActions: string[];
  lastPulse: string | null;
}

export async function GET(): Promise<NextResponse<AgentHealth[]>> {
  const db = getDb();

  // Get per-agent stats from activity_log
  const agentStats = db.prepare(`
    SELECT agent, COUNT(*) as taskCount, MAX(created_at) as lastSeen
    FROM activity_log
    WHERE agent NOT IN ('system')
    GROUP BY agent
    ORDER BY lastSeen DESC
  `).all() as { agent: string; taskCount: number; lastSeen: string }[];

  // Get last pulse per agent
  const pulses = db.prepare(`
    SELECT agent, MAX(last_pulse) as last_pulse
    FROM agent_pulse
    GROUP BY agent
  `).all() as { agent: string; last_pulse: string }[];

  const pulseMap = new Map(pulses.map(p => [p.agent, p.last_pulse]));

  // Get recent actions per agent (last 3)
  const recentActionsMap = new Map<string, string[]>();
  for (const { agent } of agentStats) {
    const rows = db.prepare(`
      SELECT action, detail
      FROM activity_log
      WHERE agent = ?
      ORDER BY id DESC
      LIMIT 3
    `).all(agent) as { action: string; detail: string | null }[];
    recentActionsMap.set(
      agent,
      rows.map(r => r.detail ? `${r.action.replace(/_/g, " ")}: ${r.detail}` : r.action.replace(/_/g, " "))
    );
  }

  const now = new Date();

  const results: AgentHealth[] = agentStats.map(({ agent, taskCount, lastSeen }) => {
    const lastPulse = pulseMap.get(agent) || null;
    const recentActions = recentActionsMap.get(agent) || [];

    // Determine status from pulse
    let status: AgentHealth["status"] = "offline";
    if (lastPulse) {
      const pulseDate = new Date(lastPulse + (lastPulse.includes("Z") ? "" : "Z"));
      const diffMs = now.getTime() - pulseDate.getTime();
      if (diffMs < 2 * 60 * 1000) {
        status = "active";
      } else if (diffMs < 60 * 60 * 1000) {
        status = "idle";
      }
    }

    return { agent, lastSeen, taskCount, status, recentActions, lastPulse };
  });

  // Add any agents with pulses but no activity log entries
  for (const { agent, last_pulse } of pulses) {
    if (!results.find(r => r.agent === agent)) {
      const pulseDate = new Date(last_pulse + (last_pulse.includes("Z") ? "" : "Z"));
      const diffMs = now.getTime() - pulseDate.getTime();
      let status: AgentHealth["status"] = "offline";
      if (diffMs < 2 * 60 * 1000) status = "active";
      else if (diffMs < 60 * 60 * 1000) status = "idle";
      results.push({ agent, lastSeen: last_pulse, taskCount: 0, status, recentActions: [], lastPulse: last_pulse });
    }
  }

  return NextResponse.json(results);
}
