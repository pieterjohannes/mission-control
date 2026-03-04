import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

function ensureIntegrationsTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      config TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function getSlackConfig() {
  try {
    const configPath = path.join(process.env.HOME || '', '.openclaw-lmnry', 'openclaw.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const slack = config?.channels?.slack;
    if (slack) {
      return {
        configured: true,
        botToken: slack.botToken ? '••••' + slack.botToken.slice(-6) : null,
        appToken: slack.appToken ? '••••' + slack.appToken.slice(-6) : null,
        webhookPath: slack.webhookPath || null,
      };
    }
  } catch {}
  return { configured: false, botToken: null, appToken: null, webhookPath: null };
}

export async function GET() {
  const db = ensureIntegrationsTable();
  const row = db.prepare("SELECT * FROM integrations WHERE id = 'slack'").get() as any;
  const slackConfig = getSlackConfig();

  if (!row) {
    return NextResponse.json({
      id: 'slack',
      type: 'slack',
      enabled: false,
      config: { channels: [] },
      slackConnection: slackConfig,
    });
  }

  return NextResponse.json({
    ...row,
    enabled: !!row.enabled,
    config: JSON.parse(row.config || '{}'),
    slackConnection: slackConfig,
  });
}

export async function POST(request: Request) {
  const db = ensureIntegrationsTable();
  const body = await request.json();
  const { enabled, config } = body;

  db.prepare(`
    INSERT INTO integrations (id, type, enabled, config, updated_at)
    VALUES ('slack', 'slack', ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      enabled = excluded.enabled,
      config = excluded.config,
      updated_at = datetime('now')
  `).run(enabled ? 1 : 0, JSON.stringify(config || {}));

  return NextResponse.json({ ok: true });
}
