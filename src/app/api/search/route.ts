import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const db = getDb();
  // Escape FTS5 special chars and add prefix matching
  const safeQuery = q.replace(/['"*()]/g, "").split(/\s+/).filter(Boolean).map(w => `"${w}"*`).join(" ");
  if (!safeQuery) return NextResponse.json({ results: [] });

  const issues = db.prepare(`
    SELECT i.id, i.title, i.description, i.status, i.project, 'issue' as type,
           bm25(issues_fts) as bm25_score,
           snippet(issues_fts, 1, '<mark>', '</mark>', '…', 10) as title_snippet,
           snippet(issues_fts, 2, '<mark>', '</mark>', '…', 20) as desc_snippet,
           (CASE
             WHEN snippet(issues_fts, 1, '|||', '|||', '', 1) != i.title THEN
               (CASE WHEN snippet(issues_fts, 2, '|||', '|||', '', 1) != '' THEN 'both' ELSE 'title' END)
             WHEN snippet(issues_fts, 2, '|||', '|||', '', 1) != '' THEN 'description'
             ELSE 'title'
           END) as matched_field
    FROM issues_fts f JOIN issues i ON f.id = i.id
    WHERE issues_fts MATCH ? ORDER BY bm25(issues_fts) LIMIT 20
  `).all(safeQuery) as Array<Record<string, unknown>>;

  const ideas = db.prepare(`
    SELECT i.id, i.title, i.description, i.stage as status, '' as project, 'idea' as type,
           bm25(ideas_fts) as bm25_score,
           snippet(ideas_fts, 1, '<mark>', '</mark>', '…', 10) as title_snippet,
           snippet(ideas_fts, 2, '<mark>', '</mark>', '…', 20) as desc_snippet,
           'title' as matched_field
    FROM ideas_fts f JOIN ideas i ON CAST(f.id AS INTEGER) = i.id
    WHERE ideas_fts MATCH ? ORDER BY bm25(ideas_fts) LIMIT 20
  `).all(safeQuery) as Array<Record<string, unknown>>;

  const projects = db.prepare(`
    SELECT p.id, p.name as title, p.description, p.status, '' as project, 'project' as type,
           bm25(projects_fts) as bm25_score,
           snippet(projects_fts, 1, '<mark>', '</mark>', '…', 10) as title_snippet,
           snippet(projects_fts, 2, '<mark>', '</mark>', '…', 20) as desc_snippet,
           'title' as matched_field
    FROM projects_fts f JOIN projects p ON CAST(f.id AS INTEGER) = p.id
    WHERE projects_fts MATCH ? ORDER BY bm25(projects_fts) LIMIT 20
  `).all(safeQuery) as Array<Record<string, unknown>>;

  const comments = db.prepare(`
    SELECT c.id, i.title, c.body as description, i.status, i.project, 'comment' as type,
           bm25(comments_fts) as bm25_score,
           snippet(comments_fts, 3, '<mark>', '</mark>', '…', 10) as title_snippet,
           snippet(comments_fts, 3, '<mark>', '</mark>', '…', 20) as desc_snippet,
           'description' as matched_field
    FROM comments_fts f JOIN comments c ON f.id = c.id JOIN issues i ON c.issue_id = i.id
    WHERE comments_fts MATCH ? ORDER BY bm25(comments_fts) LIMIT 20
  `).all(safeQuery) as Array<Record<string, unknown>>;

  // Domains: LIKE fallback (no FTS table)
  const likePattern = `%${q}%`;
  const domains = db.prepare(`
    SELECT d.id, d.domain as title, d.notes as description, d.status, '' as project, 'domain' as type,
           0 as bm25_score, '' as title_snippet, '' as desc_snippet, 'title' as matched_field
    FROM domains d
    WHERE d.domain LIKE ? OR d.notes LIKE ?
    ORDER BY d.domain LIMIT 20
  `).all(likePattern, likePattern) as Array<Record<string, unknown>>;

  // Normalize results: pick best snippet and expose matched_field
  const normalize = (row: Record<string, unknown>) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    project: row.project,
    type: row.type,
    bm25_score: row.bm25_score,
    snippet: (row.title_snippet as string) || (row.desc_snippet as string) || "",
    title_snippet: row.title_snippet || "",
    desc_snippet: row.desc_snippet || "",
    matched_field: row.matched_field || "title",
  });

  const results = [
    ...issues.map(normalize),
    ...projects.map(normalize),
    ...domains.map(normalize),
    ...ideas.map(normalize),
    ...comments.map(normalize),
  ];

  return NextResponse.json({ results });
}
