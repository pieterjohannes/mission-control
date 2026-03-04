import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const OPENCLAW_BIN = "/opt/homebrew/bin/openclaw";
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "514463244b27ba07df899d2aeb19fa18dcfd7f705c5e8453";

/**
 * POST /api/notify
 * Body: { subscriber: string, message: string }
 *
 * Sends a Telegram notification to the subscriber via OpenClaw system event.
 * If subscriber is "pieter" (the main user), sends directly to the main session.
 * For agent subscribers, the event text includes the subscriber name so the
 * main agent can route it appropriately.
 */
export async function POST(req: NextRequest) {
  try {
    const { subscriber, message } = await req.json();

    if (!subscriber || !message) {
      return NextResponse.json({ error: "subscriber and message are required" }, { status: 400 });
    }

    const text = subscriber === "pieter"
      ? message
      : `[Notify → ${subscriber}] ${message}`;

    const { stdout, stderr } = await execFileAsync(
      OPENCLAW_BIN,
      ["system", "event", "--text", text, "--mode", "now", "--token", GATEWAY_TOKEN],
      { timeout: 10000 }
    );

    return NextResponse.json({ ok: true, stdout: stdout.trim(), stderr: stderr.trim() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
