import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const WORKSPACE = "/Users/pieter/clawd";

interface MemoryFile {
  agent: string;
  filename: string;
  path: string;
  date: string | null;
  size: number;
  modified: string;
}

function extractDate(filename: string): string | null {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function listFiles(): MemoryFile[] {
  const files: MemoryFile[] = [];

  // kai root MEMORY.md
  const rootMemory = path.join(WORKSPACE, "MEMORY.md");
  if (fs.existsSync(rootMemory)) {
    const stat = fs.statSync(rootMemory);
    files.push({
      agent: "kai",
      filename: "MEMORY.md",
      path: rootMemory,
      date: null,
      size: stat.size,
      modified: stat.mtime.toISOString(),
    });
  }

  // kai daily notes
  const kaiMemDir = path.join(WORKSPACE, "memory");
  if (fs.existsSync(kaiMemDir)) {
    for (const f of fs.readdirSync(kaiMemDir)) {
      if (!f.endsWith(".md")) continue;
      const fullPath = path.join(kaiMemDir, f);
      const stat = fs.statSync(fullPath);
      files.push({
        agent: "kai",
        filename: f,
        path: fullPath,
        date: extractDate(f),
        size: stat.size,
        modified: stat.mtime.toISOString(),
      });
    }
  }

  // agent-specific memory dirs
  const agentsDir = path.join(WORKSPACE, "agents");
  if (fs.existsSync(agentsDir)) {
    for (const agent of fs.readdirSync(agentsDir)) {
      const agentMemDir = path.join(agentsDir, agent, "memory");
      if (!fs.existsSync(agentMemDir)) continue;
      // MEMORY.md for agent
      const agentMemFile = path.join(agentsDir, agent, "MEMORY.md");
      if (fs.existsSync(agentMemFile)) {
        const stat = fs.statSync(agentMemFile);
        files.push({
          agent,
          filename: "MEMORY.md",
          path: agentMemFile,
          date: null,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      }
      for (const f of fs.readdirSync(agentMemDir)) {
        if (!f.endsWith(".md")) continue;
        const fullPath = path.join(agentMemDir, f);
        const stat = fs.statSync(fullPath);
        files.push({
          agent,
          filename: f,
          path: fullPath,
          date: extractDate(f),
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      }
    }
  }

  return files.sort((a, b) => b.modified.localeCompare(a.modified));
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const agent = searchParams.get("agent");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const keyword = searchParams.get("keyword")?.toLowerCase();

  let files = listFiles();

  if (agent && agent !== "all") {
    files = files.filter(f => f.agent === agent);
  }

  if (dateFrom) {
    files = files.filter(f => !f.date || f.date >= dateFrom);
  }

  if (dateTo) {
    files = files.filter(f => !f.date || f.date <= dateTo);
  }

  if (keyword) {
    files = files.filter(f => {
      try {
        const content = fs.readFileSync(f.path, "utf-8").toLowerCase();
        return content.includes(keyword) || f.filename.toLowerCase().includes(keyword);
      } catch {
        return false;
      }
    });
  }

  const agents = Array.from(new Set(listFiles().map(f => f.agent))).sort();

  return NextResponse.json({ files, agents });
}
