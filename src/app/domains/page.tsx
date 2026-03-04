"use client";
import { useEffect, useState, useMemo } from "react";

interface Domain {
  id: number; domain: string; registrar: string; status: string;
  project_id: number; project_name: string; expiry_date: string;
  auto_renew: number; notes: string; created_at: string; category: string;
}

type SortKey = "domain" | "expiry_date" | "status" | "project_name";
type SortDir = "asc" | "desc";

function parseExpiry(d: string | null): Date | null {
  if (!d) return null;
  // Handle MM/DD/YYYY format
  const parts = d.split("/");
  if (parts.length === 3) return new Date(+parts[2], +parts[0] - 1, +parts[1]);
  return new Date(d);
}

function daysUntilExpiry(d: string | null): number | null {
  const date = parseExpiry(d);
  if (!date || isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function expiryClass(days: number | null): string {
  if (days === null) return "text-gray-500";
  if (days < 0) return "text-red-400 font-semibold";
  if (days <= 30) return "text-red-400";
  if (days <= 90) return "text-amber-400";
  return "text-gray-400";
}

function expiryLabel(days: number | null, raw: string | null): string {
  if (days === null) return raw || "—";
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today!";
  if (days <= 90) return `${days}d left`;
  return raw || "—";
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [expiryFilter, setExpiryFilter] = useState<string>("all"); // all | soon | expired
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("domain");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ domain: "", notes: "" });

  const load = () => fetch("/api/domains").then(r => r.json()).then(setDomains);
  useEffect(() => { load(); }, []);

  const projects = useMemo(() => {
    const set = new Set<string>();
    domains.forEach(d => d.project_name && set.add(d.project_name));
    return [...set].sort();
  }, [domains]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    domains.forEach(d => {
      const cat = d.category || "uncategorized";
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [domains]);

  const filtered = useMemo(() => {
    let list = domains;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d => d.domain.toLowerCase().includes(q) || d.notes?.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") list = list.filter(d => d.status === statusFilter);
    if (projectFilter !== "all") {
      if (projectFilter === "none") list = list.filter(d => !d.project_name);
      else list = list.filter(d => d.project_name === projectFilter);
    }
    if (expiryFilter === "soon") list = list.filter(d => { const days = daysUntilExpiry(d.expiry_date); return days !== null && days >= 0 && days <= 90; });
    if (expiryFilter === "expired") list = list.filter(d => { const days = daysUntilExpiry(d.expiry_date); return days !== null && days < 0; });
    if (categoryFilter !== "all") list = list.filter(d => (d.category || "uncategorized") === categoryFilter);

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "expiry_date") {
        const da = daysUntilExpiry(a.expiry_date), db_ = daysUntilExpiry(b.expiry_date);
        if (da === null && db_ === null) cmp = 0;
        else if (da === null) cmp = 1;
        else if (db_ === null) cmp = -1;
        else cmp = da - db_;
      } else {
        const va = (a[sortKey] || "").toLowerCase(), vb = (b[sortKey] || "").toLowerCase();
        cmp = va < vb ? -1 : va > vb ? 1 : 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [domains, search, statusFilter, projectFilter, expiryFilter, categoryFilter, sortKey, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const total = domains.length;
    const active = domains.filter(d => d.status === "active").length;
    const linked = domains.filter(d => d.project_name).length;
    const expiringSoon = domains.filter(d => { const days = daysUntilExpiry(d.expiry_date); return days !== null && days >= 0 && days <= 90; }).length;
    const expired = domains.filter(d => { const days = daysUntilExpiry(d.expiry_date); return days !== null && days < 0; }).length;
    return { total, active, linked, unlinked: total - linked, expiringSoon, expired };
  }, [domains]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortIcon = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const submit = async () => {
    await fetch("/api/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ domain: "", notes: "" });
    setShowForm(false);
    load();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">🌐 Domains</h1>
          <p className="text-gray-500 mt-1">{stats.total} domains registered</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-sm font-medium">
          + Add Domain
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, emoji: "🌐", color: "from-purple-500/20 to-purple-500/5" },
          { label: "Active", value: stats.active, emoji: "✅", color: "from-emerald-500/20 to-emerald-500/5" },
          { label: "Linked", value: stats.linked, emoji: "🔗", color: "from-blue-500/20 to-blue-500/5" },
          { label: "Expiring Soon", value: stats.expiringSoon, emoji: "⚠️", color: stats.expiringSoon > 0 ? "from-amber-500/20 to-amber-500/5" : "from-gray-500/10 to-gray-500/5", onClick: () => setExpiryFilter(expiryFilter === "soon" ? "all" : "soon") },
          { label: "Expired", value: stats.expired, emoji: "🔴", color: stats.expired > 0 ? "from-red-500/20 to-red-500/5" : "from-gray-500/10 to-gray-500/5", onClick: () => setExpiryFilter(expiryFilter === "expired" ? "all" : "expired") },
        ].map((card) => (
          <div
            key={card.label}
            onClick={"onClick" in card ? card.onClick : undefined}
            className={`glass p-4 bg-gradient-to-br ${card.color} ${"onClick" in card ? "cursor-pointer hover:scale-[1.02]" : ""} transition-all duration-200`}
          >
            <div className="text-lg">{card.emoji}</div>
            <div className="text-xl font-bold text-white">{card.value}</div>
            <div className="text-xs text-gray-400">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${categoryFilter === "all" ? "bg-purple-500/30 text-purple-200" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
        >
          All ({domains.length})
        </button>
        {categories.map(([cat, count]) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? "all" : cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${categoryFilter === cat ? "bg-purple-500/30 text-purple-200" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
          >
            {cat} ({count})
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="glass p-4 flex flex-col md:flex-row gap-3">
        <input
          placeholder="🔍 Search domains..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:border-purple-500/50 focus:outline-none">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="parked">Parked</option>
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:border-purple-500/50 focus:outline-none">
          <option value="all">All categories</option>
          {categories.map(([cat, count]) => <option key={cat} value={cat}>{cat} ({count})</option>)}
        </select>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:border-purple-500/50 focus:outline-none">
          <option value="all">All projects</option>
          <option value="none">Unlinked</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(search || statusFilter !== "all" || projectFilter !== "all" || expiryFilter !== "all" || categoryFilter !== "all") && (
          <button onClick={() => { setSearch(""); setStatusFilter("all"); setProjectFilter("all"); setExpiryFilter("all"); setCategoryFilter("all"); }} className="px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white transition-colors">
            ✕ Clear
          </button>
        )}
      </div>

      {showForm && (
        <div className="glass p-4 md:p-6 flex flex-col md:flex-row gap-3 md:gap-4 md:items-end">
          <input placeholder="domain.com" value={form.domain} onChange={e => setForm({...form, domain: e.target.value})} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" />
          <input placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none" />
          <button onClick={submit} className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors">Save</button>
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-gray-500">{filtered.length} domain{filtered.length !== 1 ? "s" : ""} shown</p>

      {/* Desktop table */}
      <div className="glass overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th onClick={() => toggleSort("domain")} className="text-left p-4 text-gray-400 font-medium cursor-pointer hover:text-white select-none">Domain{sortIcon("domain")}</th>
              <th onClick={() => toggleSort("project_name")} className="text-left p-4 text-gray-400 font-medium cursor-pointer hover:text-white select-none">Project{sortIcon("project_name")}</th>
              <th className="text-left p-4 text-gray-400 font-medium">Category</th>
              <th onClick={() => toggleSort("status")} className="text-left p-4 text-gray-400 font-medium cursor-pointer hover:text-white select-none">Status{sortIcon("status")}</th>
              <th className="text-left p-4 text-gray-400 font-medium">Registrar</th>
              <th onClick={() => toggleSort("expiry_date")} className="text-left p-4 text-gray-400 font-medium cursor-pointer hover:text-white select-none">Expiry{sortIcon("expiry_date")}</th>
              <th className="text-left p-4 text-gray-400 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const days = daysUntilExpiry(d.expiry_date);
              return (
                <tr key={d.id} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                  <td className="p-4 text-white font-medium">{d.domain}</td>
                  <td className="p-4 text-gray-400">{d.project_name || "—"}</td>
                  <td className="p-4"><span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400 cursor-pointer hover:bg-white/10" onClick={() => setCategoryFilter(d.category || "uncategorized")}>{d.category || "—"}</span></td>
                  <td className="p-4"><span className={`badge ${d.status === "active" ? "badge-active" : "badge-parked"}`}>{d.status}</span></td>
                  <td className="p-4 text-gray-500">{d.registrar}</td>
                  <td className={`p-4 ${expiryClass(days)}`} title={d.expiry_date || undefined}>{expiryLabel(days, d.expiry_date)}</td>
                  <td className="p-4 text-gray-500 max-w-[200px] truncate">{d.notes || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {filtered.map((d) => {
          const days = daysUntilExpiry(d.expiry_date);
          return (
            <div key={d.id} className="glass p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium text-sm truncate">{d.domain}</span>
                <span className={`badge text-xs ${d.status === "active" ? "badge-active" : "badge-parked"}`}>{d.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {d.category && <div><span className="text-gray-500">Category: </span><span className="text-purple-400">{d.category}</span></div>}
                {d.project_name && <div><span className="text-gray-500">Project: </span><span className="text-gray-300">{d.project_name}</span></div>}
                {d.registrar && <div><span className="text-gray-500">Registrar: </span><span className="text-gray-300">{d.registrar}</span></div>}
                {d.expiry_date && <div><span className="text-gray-500">Expiry: </span><span className={expiryClass(days)}>{expiryLabel(days, d.expiry_date)}</span></div>}
              </div>
              {d.notes && <p className="text-xs text-gray-500 truncate">{d.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
