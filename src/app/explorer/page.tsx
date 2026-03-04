"use client";
import { useEffect, useState } from "react";

export default function ExplorerPage() {
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("");
  const [tables, setTables] = useState<Array<{ name: string }>>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<Array<{ name: string }>>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/explorer").then(r => r.json()).then(d => setDatabases(d.databases || []));
  }, []);

  const selectDb = async (db: string) => {
    setSelectedDb(db);
    setSelectedTable("");
    setRows([]);
    setError("");
    const res = await fetch(`/api/explorer?db=${db}`);
    const data = await res.json();
    setTables(data.tables || []);
  };

  const selectTable = async (table: string) => {
    setSelectedTable(table);
    setError("");
    const res = await fetch(`/api/explorer?db=${selectedDb}&table=${table}`);
    const data = await res.json();
    setRows(data.rows || []);
    setColumns(data.columns || []);
  };

  const runQuery = async () => {
    setError("");
    try {
      const res = await fetch(`/api/explorer?db=${selectedDb}&query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setRows(data.rows || []);
      setColumns(data.rows?.[0] ? Object.keys(data.rows[0]).map(n => ({ name: n })) : []);
      setSelectedTable("");
    } catch { setError("Query failed"); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold gradient-text">🔍 Data Explorer</h1>
        <p className="text-gray-500 mt-1">Browse SQLite databases in /data/</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* DB list */}
        <div className="glass p-4 w-full md:w-56 md:shrink-0">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Databases</h3>
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
            {databases.map(db => (
              <button key={db} onClick={() => selectDb(db)} className={`block whitespace-nowrap md:w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedDb === db ? "bg-purple-500/15 text-purple-300" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                🗄️ {db}
              </button>
            ))}
          </div>
          {selectedDb && (
            <>
              <h3 className="text-sm font-semibold text-gray-400 mt-4 mb-3">Tables</h3>
              <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
                {tables.map(t => (
                  <button key={t.name} onClick={() => selectTable(t.name)} className={`block whitespace-nowrap md:w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedTable === t.name ? "bg-blue-500/15 text-blue-300" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                    📋 {t.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Main area */}
        <div className="flex-1 space-y-4">
          {selectedDb && (
            <div className="glass p-4 flex flex-col md:flex-row gap-2">
              <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && runQuery()} placeholder="SELECT * FROM ..." className="w-full md:flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none font-mono" />
              <button onClick={runQuery} className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors">Run</button>
            </div>
          )}

          {error && <div className="glass p-4 text-red-400 text-sm">{error}</div>}

          {rows.length > 0 && (
            <div className="glass overflow-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-900/90 backdrop-blur">
                  <tr className="border-b border-white/5">
                    {columns.map(c => (
                      <th key={c.name} className="text-left p-3 text-gray-400 font-medium text-xs">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b border-white/3 hover:bg-white/3">
                      {columns.map(c => (
                        <td key={c.name} className="p-3 text-gray-300 font-mono text-xs max-w-xs truncate">
                          {String(row[c.name] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 text-xs text-gray-600 border-t border-white/5">{rows.length} rows</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
