import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/db";
import { broadcast } from "@/lib/events";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const OPENCLAW_BIN = "/opt/homebrew/bin/openclaw";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "514463244b27ba07df899d2aeb19fa18dcfd7f705c5e8453";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, mode = "now" } = body;

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    logActivity(body.agent || "system", "webhook_notify", text.slice(0, 200));

    broadcast("activity_logged", {
      agent: body.agent || "system",
      action: "webhook_notify",
      detail: text.slice(0, 200),
    });

    const { stdout, stderr } = await execFileAsync(
      OPENCLAW_BIN,
      ["system", "event", "--text", text, "--mode", mode, "--token", GATEWAY_TOKEN],
      { timeout: 10000 }
    );

    return NextResponse.json({ ok: true, stdout: stdout.trim(), stderr: stderr.trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
