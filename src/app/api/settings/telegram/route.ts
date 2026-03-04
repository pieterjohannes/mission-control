import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

function getTelegramConfig() {
  try {
    const configPath = path.join(process.env.HOME || '', '.openclaw-lmnry', 'openclaw.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const tg = config?.channels?.telegram;
    if (tg?.botToken) {
      return {
        configured: true,
        botToken: '••••' + tg.botToken.slice(-6),
      };
    }
  } catch {}
  return { configured: false, botToken: null };
}

export async function GET() {
  const db = getDb();
  const row = db.prepare("SELECT * FROM integrations WHERE id = 'telegram'").get() as any;
  const tgConfig = getTelegramConfig();

  if (!row) {
    return NextResponse.json({
      id: 'telegram',
      type: 'telegram',
      enabled: false,
      config: { chatId: '', notifications: { statusChanges: true, newComments: true, agentActivity: true } },
      telegramConnection: tgConfig,
    });
  }

  return NextResponse.json({
    ...row,
    enabled: !!row.enabled,
    config: JSON.parse(row.config || '{}'),
    telegramConnection: tgConfig,
  });
}

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json();
  const { enabled, config } = body;

  db.prepare(`
    INSERT INTO integrations (id, type, enabled, config, updated_at)
    VALUES ('telegram', 'telegram', ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      enabled = excluded.enabled,
      config = excluded.config,
      updated_at = datetime('now')
  `).run(enabled ? 1 : 0, JSON.stringify(config || {}));

  return NextResponse.json({ ok: true });
}
