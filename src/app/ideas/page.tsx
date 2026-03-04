"use client";
import { useEffect, useState } from "react";

interface Idea {
  id: number; title: string; description: string; stage: string;
  priority: number; domain: string; target_audience: string;
  revenue_model: string; notes: string; created_at: string;
}

const stages = ["idea", "researching", "building", "launched", "revenue"];
const stageEmoji: Record<string, string> = {
  idea: "💡", researching: "🔍", building: "🔨", launched: "🚀", revenue: "💰",
};
const stageColors: Record<string, string> = {
  idea: "border-amber-500/30", researching: "border-blue-500/30",
  building: "border-purple-500/30", launched: "border-teal-500/30", revenue: "border-emerald-500/30",
};

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", stage: "idea", priority: 0 });

  const load = () => fetch("/api/ideas").then(r => r.json()).then(setIdeas);
  useEffect(() => { load(); }, []);

  const submit = async () => {
    await fetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ title: "", description: "", stage: "idea", priority: 0 });
    setShowForm(false);
    load();
  };

  const moveIdea = async (id: number, newStage: string) => {
    await fetch(`/api/ideas/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: newStage }) });
    load();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">💡 Ideas Pipeline</h1>
          <p className="text-gray-500 mt-1">Kanban board — from spark to revenue</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-sm font-medium">
          + New Idea
        </button>
      </div>

      {showForm && (
        <div className="glass p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Idea Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" />
            <select value={form.stage} onChange={e => setForm({...form, stage: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none">
              {stages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" rows={2} />
          <button onClick={submit} className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors">Save</button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex md:grid md:grid-cols-5 gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-x-visible snap-x snap-mandatory md:snap-none">
        {stages.map((stage) => {
          const stageIdeas = ideas.filter(i => i.stage === stage);
          return (
            <div key={stage} className={`glass p-4 border-t-2 ${stageColors[stage]} min-w-[260px] md:min-w-0 snap-start`}>
              <div className="flex items-center gap-2 mb-4">
                <span>{stageEmoji[stage]}</span>
                <h3 className="text-sm font-semibold text-white capitalize">{stage}</h3>
                <span className="text-xs text-gray-500 ml-auto">{stageIdeas.length}</span>
              </div>
              <div className="space-y-3">
                {stageIdeas.map((idea) => (
                  <div key={idea.id} className="bg-white/5 rounded-xl p-3 hover:bg-white/8 transition-colors group">
                    <h4 className="text-sm font-medium text-white">{idea.title}</h4>
                    {idea.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{idea.description}</p>}
                    <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {stages.filter(s => s !== stage).map(s => (
                        <button key={s} onClick={() => moveIdea(idea.id, s)} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                          → {stageEmoji[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
