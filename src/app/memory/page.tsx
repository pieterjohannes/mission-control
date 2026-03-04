"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MemoryFile {
  agent: string;
  filename: string;
  path: string;
  date: string | null;
  size: number;
  modified: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const agentEmoji: Record<string, string> = {
  kai: "⚡", alma: "💜", tina: "🏠", vicky: "📖", stella: "⭐",
  hunter: "🎯", bea: "🧠", dev: "💻", viktor: "🛡️", aria: "🎵",
  luma: "🌙", chef: "🍳",
};

export default function MemoryPage() {
  const [agents, setAgents] = useState<string[]>([]);
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [selectedFile, setSelectedFile] = useState<MemoryFile | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);

  // Debounce keyword
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword), 400);
    return () => clearTimeout(t);
  }, [keyword]);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedAgent !== "all") params.set("agent", selectedAgent);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (debouncedKeyword) params.set("keyword", debouncedKeyword);

    const res = await fetch(`/api/memory?${params}`);
    const data = await res.json();
    setFiles(data.files || []);
    if (data.agents) setAgents(data.agents);
    setLoading(false);
  }, [selectedAgent, dateFrom, dateTo, debouncedKeyword]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const loadContent = async (file: MemoryFile) => {
    setSelectedFile(file);
    setContentLoading(true);
    setContent("");
    const res = await fetch(`/api/memory/content?path=${encodeURIComponent(file.path)}`);
    const data = await res.json();
    setContent(data.content || data.error || "");
    setContentLoading(false);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
        <h1 className="text-2xl font-bold gradient-text">🧠 Agent Memory</h1>
        <p className="text-xs text-gray-500 mt-1">Browse and search memory files across all agents</p>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-white/5 flex flex-wrap gap-3 items-end flex-shrink-0">
        {/* Agent filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Agent</label>
          <select
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 focus:outline-none focus:border-purple-500/40"
          >
            <option value="all">All agents</option>
            {agents.map(a => (
              <option key={a} value={a}>{agentEmoji[a] || "🤖"} {a}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 focus:outline-none focus:border-purple-500/40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 focus:outline-none focus:border-purple-500/40"
          />
        </div>

        {/* Keyword search */}
        <div className="flex flex-col gap-1 flex-1 min-w-48">
          <label className="text-xs text-gray-500">Search content</label>
          <input
            type="text"
            placeholder="Keyword search…"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/40"
          />
        </div>

        {/* Clear */}
        {(selectedAgent !== "all" || dateFrom || dateTo || keyword) && (
          <button
            onClick={() => { setSelectedAgent("all"); setDateFrom(""); setDateTo(""); setKeyword(""); }}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 border border-white/10 rounded-lg hover:bg-white/5 transition"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Main split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* File list */}
        <div className="w-80 flex-shrink-0 border-r border-white/5 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>
          ) : files.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">No files found</div>
          ) : (
            <div className="divide-y divide-white/5">
              {files.map((f, i) => (
                <button
                  key={i}
                  onClick={() => loadContent(f)}
                  className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors ${
                    selectedFile?.path === f.path ? "bg-purple-500/10 border-l-2 border-purple-500" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{agentEmoji[f.agent] || "🤖"}</span>
                    <span className="text-sm font-medium text-gray-200 truncate flex-1">{f.filename}</span>
                    <span className="text-xs text-gray-500 shrink-0">{formatSize(f.size)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 pl-6">
                    <span className="text-xs text-purple-400/70">{f.agent}</span>
                    <span className="text-xs text-gray-500">· {formatDate(f.modified)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Markdown preview */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedFile ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-3">🧠</div>
                <p className="text-sm">Select a file to preview</p>
                <p className="text-xs text-gray-600 mt-1">{files.length} file{files.length !== 1 ? "s" : ""} available</p>
              </div>
            </div>
          ) : contentLoading ? (
            <div className="text-gray-500 text-sm">Loading…</div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
                <span className="text-2xl">{agentEmoji[selectedFile.agent] || "🤖"}</span>
                <div>
                  <h2 className="font-semibold text-gray-200">{selectedFile.filename}</h2>
                  <p className="text-xs text-gray-500">{selectedFile.agent} · {selectedFile.path}</p>
                </div>
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
