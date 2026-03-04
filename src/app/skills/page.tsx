"use client";
import { useEffect, useState } from "react";

interface SkillHealth {
  id: number;
  skill: string;
  last_run: string | null;
  last_status: string;
  last_agent: string | null;
  last_detail: string | null;
  run_count: number;
  success_count: number;
  failure_count: number;
  updated_at: string;
}

interface SkillRun {
  id: number;
  skill: string;
  agent: string;
  status: string;
  detail: string | null;
  duration_ms: number | null;
  created_at: string;
}

const agentEmoji: Record<string, string> = {
  kai: "🤖", pieter: "👤", alma: "💜", marco: "📊", bea: "🎨",
  rex: "🦖", viktor: "🛡️", dev: "💻", luna: "🌙", max: "⚡",
};

const statusConfig: Record<string, { color: string; bg: string; border: string; label: string; dot: string }> = {
  success: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", label: "Success", dot: "bg-green-400" },
  failure: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "Failure", dot: "bg-red-400" },
  error:   { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "Error", dot: "bg-red-400" },
  unknown: { color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/30", label: "Unknown", dot: "bg-gray-500" },
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "never";
  const now = new Date();
  const date = new Date(dateStr + (dateStr.includes("Z") ? "" : "Z"));
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function successRate(skill: SkillHealth): number | null {
  if (skill.run_count === 0) return null;
  return Math.round((skill.success_count / skill.run_count) * 100);
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillHealth[]>([]);
  const [recentRuns, setRecentRuns] = useState<SkillRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "success" | "failure" | "unknown">("all");
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  // Report form state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ skill: "", agent: "kai", status: "success", detail: "" });
  const [reporting, setReporting] = useState(false);

  const fetchData = () => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => {
        setSkills(data.skills || []);
        setRecentRuns(data.recentRuns || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReporting(true);
    try {
      await fetch("/api/skills/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportForm),
      });
      fetchData();
      setReportOpen(false);
      setReportForm({ skill: "", agent: "kai", status: "success", detail: "" });
    } finally {
      setReporting(false);
    }
  };

  const filtered = skills.filter((s) => {
    if (filter === "all") return true;
    const st = s.last_status || "unknown";
    if (filter === "failure") return st === "failure" || st === "error";
    return st === filter;
  });

  const selectedRuns = selectedSkill
    ? recentRuns.filter((r) => r.skill === selectedSkill)
    : [];

  const stats = {
    total: skills.length,
    healthy: skills.filter((s) => s.last_status === "success").length,
    broken: skills.filter((s) => ["failure", "error"].includes(s.last_status)).length,
    unknown: skills.filter((s) => !s.last_status || s.last_status === "unknown").length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🔧 Skill Health</h1>
          <p className="text-gray-400 text-sm mt-1">Live status of all agent skills. Auto-refreshes every 15s.</p>
        </div>
        <button
          onClick={() => setReportOpen(true)}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
        >
          + Log Run
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Skills", value: stats.total, color: "text-white" },
          { label: "✅ Healthy", value: stats.healthy, color: "text-green-400" },
          { label: "❌ Broken", value: stats.broken, color: "text-red-400" },
          { label: "❓ Unknown", value: stats.unknown, color: "text-gray-400" },
        ].map((s) => (
          <div key={s.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-gray-400 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "success", "failure", "unknown"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f
                ? "bg-violet-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 text-center py-12">Loading skill data…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">🔧</div>
          <p className="text-lg font-medium text-gray-400">No skill data yet</p>
          <p className="text-sm mt-2 max-w-sm mx-auto">
            Agents report skill runs via <code className="bg-gray-800 px-1 rounded text-violet-300">POST /api/skills/report</code>.
            Click &quot;+ Log Run&quot; to test.
          </p>
          <div className="mt-6 bg-gray-800 rounded-xl p-4 text-left text-xs font-mono text-gray-300 max-w-lg mx-auto">
            <div className="text-gray-500 mb-2"># Example curl:</div>
            <div>curl -s -X POST http://localhost:3100/api/skills/report \</div>
            <div className="ml-4">-H &apos;Content-Type: application/json&apos; \</div>
            <div className="ml-4">-d &apos;&#123;&quot;skill&quot;:&quot;weather&quot;,&quot;agent&quot;:&quot;kai&quot;,&quot;status&quot;:&quot;success&quot;&#125;&apos;</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((skill) => {
            const st = (skill.last_status || "unknown") as keyof typeof statusConfig;
            const cfg = statusConfig[st] || statusConfig.unknown;
            const rate = successRate(skill);

            return (
              <div
                key={skill.skill}
                onClick={() => setSelectedSkill(selectedSkill === skill.skill ? null : skill.skill)}
                className={`bg-gray-800 rounded-xl p-4 border cursor-pointer transition-all hover:border-violet-500/50 ${cfg.border} ${
                  selectedSkill === skill.skill ? "ring-2 ring-violet-500" : ""
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot} flex-shrink-0 mt-0.5`} />
                    <span className="font-semibold text-white">{skill.skill}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Stats */}
                <div className="space-y-1 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>Last run</span>
                    <span className="text-gray-300">{relativeTime(skill.last_run)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last agent</span>
                    <span className="text-gray-300">
                      {skill.last_agent ? `${agentEmoji[skill.last_agent] || "🤖"} ${skill.last_agent}` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Runs</span>
                    <span className="text-gray-300">{skill.run_count}</span>
                  </div>
                  {rate !== null && (
                    <div className="flex justify-between">
                      <span>Success rate</span>
                      <span className={rate >= 80 ? "text-green-400" : rate >= 50 ? "text-yellow-400" : "text-red-400"}>
                        {rate}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Success rate bar */}
                {rate !== null && (
                  <div className="mt-3 h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${rate >= 80 ? "bg-green-500" : rate >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                )}

                {/* Last detail */}
                {skill.last_detail && (
                  <div className="mt-3 text-xs text-gray-500 truncate" title={skill.last_detail}>
                    {skill.last_detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Run history panel */}
      {selectedSkill && selectedRuns.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              📜 Run History — <span className="text-violet-400">{selectedSkill}</span>
            </h3>
            <button onClick={() => setSelectedSkill(null)} className="text-gray-500 hover:text-white text-xs">✕</button>
          </div>
          <div className="divide-y divide-gray-700 max-h-64 overflow-y-auto">
            {selectedRuns.slice(0, 20).map((run) => {
              const cfg = statusConfig[run.status as keyof typeof statusConfig] || statusConfig.unknown;
              return (
                <div key={run.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className={`text-xs font-medium w-16 flex-shrink-0 ${cfg.color}`}>{run.status}</span>
                  <span className="text-gray-400 text-xs w-8 flex-shrink-0">
                    {agentEmoji[run.agent] || "🤖"} {run.agent}
                  </span>
                  <span className="text-gray-500 text-xs flex-1 truncate">{run.detail || "—"}</span>
                  <span className="text-gray-600 text-xs flex-shrink-0">{relativeTime(run.created_at)}</span>
                  {run.duration_ms && (
                    <span className="text-gray-600 text-xs flex-shrink-0">{run.duration_ms}ms</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Usage docs */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">📖 Agent Integration</h3>
        <p className="text-gray-400 text-xs mb-3">
          After using a skill, agents should POST to <code className="bg-gray-700 px-1 rounded text-violet-300">/api/skills/report</code>:
        </p>
        <pre className="text-xs bg-gray-900 rounded-lg p-3 text-gray-300 overflow-x-auto">{`# curl example (from agent loop or skill SKILL.md):
curl -s -X POST http://localhost:3100/api/skills/report \\
  -H 'Content-Type: application/json' \\
  -d '{"skill":"weather","agent":"kai","status":"success","detail":"Fetched Copenhagen","duration_ms":420}'

# Payload schema:
# skill       string  - skill name (e.g. "weather", "gog", "ticktick")
# agent       string  - agent name (e.g. "kai", "alma")
# status      string  - "success" | "failure" | "error"
# detail      string? - optional message or error text
# duration_ms number? - optional run duration in milliseconds`}</pre>
      </div>

      {/* Log Run modal */}
      {reportOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">Log Skill Run</h2>
            <form onSubmit={handleReport} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Skill name *</label>
                <input
                  required
                  value={reportForm.skill}
                  onChange={(e) => setReportForm((f) => ({ ...f, skill: e.target.value }))}
                  placeholder="e.g. weather, gog, ticktick"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Agent *</label>
                <input
                  required
                  value={reportForm.agent}
                  onChange={(e) => setReportForm((f) => ({ ...f, agent: e.target.value }))}
                  placeholder="kai"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Status *</label>
                <select
                  value={reportForm.status}
                  onChange={(e) => setReportForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="success">✅ success</option>
                  <option value="failure">❌ failure</option>
                  <option value="error">💥 error</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Detail (optional)</label>
                <input
                  value={reportForm.detail}
                  onChange={(e) => setReportForm((f) => ({ ...f, detail: e.target.value }))}
                  placeholder="Brief description or error message"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reporting}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  {reporting ? "Logging…" : "Log Run"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
