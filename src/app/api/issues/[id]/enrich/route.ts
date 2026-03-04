import { getDb } from "@/lib/db";
import { broadcast } from "@/lib/events";
import { NextRequest, NextResponse } from "next/server";

interface EnrichResult {
  description: string;
  acceptance_criteria: string[];
  subtasks: { title: string; done: boolean }[];
}

async function enrichWithAI(title: string, description: string | null): Promise<EnrichResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  const useAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const useOpenAI = !useAnthropic && !!process.env.OPENAI_API_KEY;

  const prompt = `You are a software project manager. Enrich this issue for a developer.

Issue title: ${title}
Current description: ${description || "(none)"}

Return ONLY valid JSON (no markdown, no code blocks), matching this exact shape:
{
  "description": "expanded description with context and details (2-3 paragraphs)",
  "acceptance_criteria": ["criterion 1", "criterion 2", "criterion 3"],
  "subtasks": [{"title": "subtask 1", "done": false}, {"title": "subtask 2", "done": false}]
}

Keep it concise and technical. 3-5 acceptance criteria. 3-5 subtasks.`;

  if (useAnthropic) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    return JSON.parse(text) as EnrichResult;
  }

  if (useOpenAI) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1024,
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    return JSON.parse(text) as EnrichResult;
  }

  throw new Error("No AI API key configured (ANTHROPIC_API_KEY or OPENAI_API_KEY)");
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const title = issue.title as string;
  const description = issue.description as string | null;

  let enriched: EnrichResult;
  try {
    enriched = await enrichWithAI(title, description);
  } catch (err) {
    console.error("Enrichment AI error:", err);
    return NextResponse.json({ error: "AI enrichment failed", detail: String(err) }, { status: 502 });
  }

  // Build full description with acceptance criteria
  const fullDescription =
    enriched.description +
    "\n\n**Acceptance Criteria:**\n" +
    enriched.acceptance_criteria.map((c) => `- ${c}`).join("\n");

  // Merge new subtasks with existing ones (preserve done state of existing)
  let existingSubtasks: { title: string; done: boolean }[] = [];
  try {
    existingSubtasks = JSON.parse((issue.subtasks as string) || "[]");
  } catch { /* ignore */ }

  const mergedSubtasks = enriched.subtasks.map((st) => {
    const existing = existingSubtasks.find((e) => e.title === st.title);
    return existing ?? st;
  });

  // Update via PATCH (respects FTS triggers)
  const patchRes = await fetch(`http://localhost:3100/api/issues/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: fullDescription,
      subtasks: mergedSubtasks,
      changed_by: "kai",
    }),
  });

  if (!patchRes.ok) {
    return NextResponse.json({ error: "Failed to save enrichment" }, { status: 500 });
  }

  const updated = await patchRes.json();

  broadcast("issue_enriched", { issueId: id, issue: updated });

  return NextResponse.json({ ok: true, issue: updated });
}
