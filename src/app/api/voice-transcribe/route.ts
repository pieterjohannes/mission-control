import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;
    const createTask = formData.get("createTask") === "true";
    const taskTitle = formData.get("taskTitle") as string | null;

    if (!audio) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Get OPENAI_API_KEY from env (loaded via .zshrc / .env.local)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    // Write audio to temp file
    const buffer = Buffer.from(await audio.arrayBuffer());
    const ext = audio.name.split(".").pop() || "m4a";
    const tmpFile = path.join(os.tmpdir(), `voice-note-${Date.now()}.${ext}`);
    await writeFile(tmpFile, buffer);

    let transcript = "";
    try {
      // Call OpenAI Whisper API via curl (no openai npm package needed)
      const curlCmd = `curl -s -X POST https://api.openai.com/v1/audio/transcriptions \
        -H "Authorization: Bearer ${apiKey}" \
        -F file="@${tmpFile};type=${audio.type || "audio/mpeg"}" \
        -F model="whisper-1"`;

      const { stdout, stderr } = await execAsync(curlCmd, { maxBuffer: 10 * 1024 * 1024 });
      if (stderr) console.error("Whisper stderr:", stderr);

      const result = JSON.parse(stdout);
      if (result.error) {
        return NextResponse.json({ error: result.error.message || "Whisper API error" }, { status: 500 });
      }
      transcript = result.text || "";
    } finally {
      await unlink(tmpFile).catch(() => {});
    }

    // Optionally create TickTick task
    let ticktickResult: { ok: boolean; output?: string; error?: string } | null = null;
    if (createTask && transcript) {
      const title = taskTitle || transcript.slice(0, 100);
      const ttScript = `/Users/pieter/clawd/skills/ticktick/scripts/tt`;
      try {
        const { stdout } = await execAsync(
          `source ~/.zshrc 2>/dev/null; python3 "${ttScript}" add ${JSON.stringify(title)}`,
          { shell: "/bin/zsh", timeout: 15000 }
        );
        ticktickResult = { ok: true, output: stdout.trim() };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        ticktickResult = { ok: false, error: msg };
      }
    }

    return NextResponse.json({ transcript, ticktick: ticktickResult });
  } catch (err: unknown) {
    console.error("voice-transcribe error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
