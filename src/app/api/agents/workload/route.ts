import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const MAX_SLOTS = 3;

export interface AgentWorkload {
  agent: string;
  inProgress: number;
  maxSlots: number;
  available: number;
  utilization: number; // 0-1
  specializations: string[]; // from recent project/label activity
}

export interface WorkloadResponse {
  agents: AgentWorkload[];
  unassignedIssues: UnassignedIssue[];
}

export interface UnassignedIssue {
  id: string;
  title: string;
  priority: string;
  project: string | null;
  labels: string[];
  suggestedAgent: string | null;
  suggestedScore: number;
}

// Score an agent for an issue (lower = better fit)
// Algorithm: base = in_progress count, bonus if agent has specialization in project
function scoreAgent(workload: AgentWorkload, issue: UnassignedIssue): number {
  if (workload.available <= 0) return Infinity;
  let score = workload.inProgress; // fewer active = lower score = better
  // Specialization bonus: if agent worked on same project before, -0.5
  if (issue.project && workload.specializations.includes(issue.project)) {
    score -= 0.5;
  }
  // Label specialization bonus
  for (const label of issue.labels) {
    if (workload.specializations.includes(label)) {
      score -= 0.3;
    }
  }
  return score;
}

export async function GET(): Promise<NextResponse<WorkloadResponse>> {
  const db = getDb();

  // Get all known agents (from pulse + activity + issues)
  const agentRows = db.prepare(`
    SELECT DISTINCT agent FROM (
      SELECT agent FROM agent_pulse
      UNION
      SELECT agent FROM activity_log WHERE agent NOT IN ('system')
      UNION
      SELECT assignee as agent FROM issues WHERE assignee IS NOT NULL
    )
    ORDER BY agent
  `).all() as { agent: string }[];

  // Count in_progress issues per agent
  const inProgressMap = new Map<string, number>();
  const inProgressRows = db.prepare(`
    SELECT assignee, COUNT(*) as cnt
    FROM issues
    WHERE status = 'in_progress' AND assignee IS NOT NULL
    GROUP BY assignee
  `).all() as { assignee: string; cnt: number }[];
  for (const r of inProgressRows) {
    inProgressMap.set(r.assignee, r.cnt);
  }

  // Get specializations per agent: projects and labels they've worked on most
  const specializationMap = new Map<string, string[]>();
  for (const { agent } of agentRows) {
    const projectRows = db.prepare(`
      SELECT project, COUNT(*) as cnt
      FROM issues
      WHERE assignee = ? AND project IS NOT NULL
      GROUP BY project
      ORDER BY cnt DESC
      LIMIT 5
    `).all(agent) as { project: string }[];

    const labelRows = db.prepare(`
      SELECT labels FROM issues
      WHERE assignee = ? AND labels != '[]'
      LIMIT 20
    `).all(agent) as { labels: string }[];

    const labelCounts = new Map<string, number>();
    for (const row of labelRows) {
      try {
        const labels: string[] = JSON.parse(row.labels);
        for (const l of labels) {
          labelCounts.set(l, (labelCounts.get(l) || 0) + 1);
        }
      } catch {}
    }
    const topLabels = [...labelCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([l]) => l);

    specializationMap.set(agent, [
      ...projectRows.map(r => r.project),
      ...topLabels,
    ]);
  }

  // Build agent workloads
  const agents: AgentWorkload[] = agentRows.map(({ agent }) => {
    const inProgress = inProgressMap.get(agent) || 0;
    const available = Math.max(0, MAX_SLOTS - inProgress);
    return {
      agent,
      inProgress,
      maxSlots: MAX_SLOTS,
      available,
      utilization: Math.min(1, inProgress / MAX_SLOTS),
      specializations: specializationMap.get(agent) || [],
    };
  });

  // Get unassigned issues (backlog + todo)
  const unassignedRows = db.prepare(`
    SELECT id, title, priority, project, labels
    FROM issues
    WHERE (assignee IS NULL OR assignee = '') AND status NOT IN ('done', 'cancelled')
    ORDER BY
      CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      created_at ASC
    LIMIT 20
  `).all() as { id: string; title: string; priority: string; project: string | null; labels: string }[];

  // Suggest assignments
  const unassignedIssues: UnassignedIssue[] = unassignedRows.map(row => {
    let labels: string[] = [];
    try { labels = JSON.parse(row.labels); } catch {}
    const issue: UnassignedIssue = { ...row, labels, suggestedAgent: null, suggestedScore: Infinity };

    let bestAgent: string | null = null;
    let bestScore = Infinity;
    for (const workload of agents) {
      const score = scoreAgent(workload, issue);
      if (score < bestScore) {
        bestScore = score;
        bestAgent = workload.agent;
      }
    }
    return { ...issue, suggestedAgent: bestAgent, suggestedScore: bestScore };
  });

  return NextResponse.json({ agents, unassignedIssues });
}
