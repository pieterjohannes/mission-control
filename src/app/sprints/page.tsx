"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VelocityChart from "@/components/VelocityChart";

interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  project: string | null;
  issue_count: number;
  done_count: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  planning: { label: "Planning", color: "text-blue-300", bg: "bg-blue-500/20 border-blue-500/30" },
  active:   { label: "Active",   color: "text-green-300", bg: "bg-green-500/20 border-green-500/30" },
  completed:{ label: "Done",     color: "text-gray-400",  bg: "bg-gray-500/20 border-gray-500/30" },
};

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{done}/{total} issues done</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div
          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SprintsPage() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", goal: "", start_date: "", end_date: "", project: "", status: "planning" });

  async function load() {
    const res = await fetch("/api/sprints");
    setSprints(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createSprint(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/sprints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setCreating(false);
    setForm({ name: "", goal: "", start_date: "", end_date: "", project: "", status: "planning" });
    load();
  }

  async function deleteSprint(id: string) {
    if (!confirm("Delete sprint? Issues will be unassigned.")) return;
    await fetch(`/api/sprints/${id}`, { method: "DELETE" });
    load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/sprints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  const activeSprints = sprints.filter(s => s.status === "active");
  const planningSprints = sprints.filter(s => s.status === "planning");
  const completedSprints = sprints.filter(s => s.status === "completed");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🏃 Sprints</h1>
          <p className="text-gray-400 text-sm mt-1">Track delivery cadence and milestone progress</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Sprint
        </button>
      </div>

      {/* Velocity Chart */}
      {!loading && sprints.length > 0 && (
        <div className="mb-6">
          <VelocityChart />
        </div>
      )}

      {/* Create form */}
      {creating && (
        <form onSubmit={createSprint} className="mb-6 p-4 bg-gray-800 border border-gray-700 rounded-xl">
          <h2 className="text-white font-semibold mb-4">New Sprint</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="Sprint name (e.g. Sprint 1)"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="col-span-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <input
              placeholder="Goal / focus area"
              value={form.goal}
              onChange={e => setForm({ ...form, goal: e.target.value })}
              className="col-span-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Start date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">End date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <input
              placeholder="Project (optional)"
              value={form.project}
              onChange={e => setForm({ ...form, project: e.target.value })}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <select
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">Create</button>
            <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Loading sprints…</div>
      ) : sprints.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">🏃</div>
          <div className="text-lg font-medium text-gray-400">No sprints yet</div>
          <div className="text-sm mt-1">Create your first sprint to start tracking delivery cadence</div>
        </div>
      ) : (
        <div className="space-y-6">
          {activeSprints.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">🟢 Active</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSprints.map(s => <SprintCard key={s.id} sprint={s} onDelete={deleteSprint} onStatusChange={updateStatus} />)}
              </div>
            </section>
          )}
          {planningSprints.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">🔵 Planning</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {planningSprints.map(s => <SprintCard key={s.id} sprint={s} onDelete={deleteSprint} onStatusChange={updateStatus} />)}
              </div>
            </section>
          )}
          {completedSprints.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">✅ Completed</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedSprints.map(s => <SprintCard key={s.id} sprint={s} onDelete={deleteSprint} onStatusChange={updateStatus} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SprintCard({ sprint, onDelete, onStatusChange }: { sprint: Sprint; onDelete: (id: string) => void; onStatusChange: (id: string, status: string) => void }) {
  const cfg = STATUS_CONFIG[sprint.status] || STATUS_CONFIG.planning;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/sprints/${sprint.id}`} className="font-semibold text-white hover:text-blue-300 transition-colors text-sm">
          {sprint.name}
        </Link>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} shrink-0`}>
          {cfg.label}
        </span>
      </div>

      {sprint.goal && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{sprint.goal}</p>}
      {sprint.project && <p className="text-xs text-blue-400 mt-1">📁 {sprint.project}</p>}

      {(sprint.start_date || sprint.end_date) && (
        <p className="text-xs text-gray-500 mt-1">
          {sprint.start_date ? new Date(sprint.start_date).toLocaleDateString() : "?"} → {sprint.end_date ? new Date(sprint.end_date).toLocaleDateString() : "?"}
        </p>
      )}

      <ProgressBar done={sprint.done_count} total={sprint.issue_count} />

      <div className="flex items-center gap-2 mt-3">
        <Link
          href={`/sprints/${sprint.id}`}
          className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors"
        >
          View board →
        </Link>
        {sprint.status === "planning" && (
          <button onClick={() => onStatusChange(sprint.id, "active")} className="text-xs px-2 py-1 bg-green-700/50 hover:bg-green-600/50 text-green-300 rounded-md transition-colors">
            Start
          </button>
        )}
        {sprint.status === "active" && (
          <button onClick={() => onStatusChange(sprint.id, "completed")} className="text-xs px-2 py-1 bg-purple-700/50 hover:bg-purple-600/50 text-purple-300 rounded-md transition-colors">
            Complete
          </button>
        )}
        <button onClick={() => onDelete(sprint.id)} className="ml-auto text-xs text-gray-600 hover:text-red-400 transition-colors">
          ✕
        </button>
      </div>
    </div>
  );
}
