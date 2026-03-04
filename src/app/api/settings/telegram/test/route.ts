import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST() {
  // Get bot token from openclaw config
  let botToken: string | null = null;
  try {
    const configPath = path.join(process.env.HOME || '', '.openclaw-lmnry', 'openclaw.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    botToken = config?.channels?.telegram?.botToken || null;
  } catch {}

  if (!botToken) {
    return NextResponse.json({ ok: false, error: 'Bot token not configured in openclaw.json' }, { status: 400 });
  }

  // Get chat ID from DB
  const db = getDb();
  const row = db.prepare("SELECT * FROM integrations WHERE id = 'telegram'").get() as any;
  const chatId = row ? JSON.parse(row.config || '{}').chatId : null;

  if (!chatId) {
    return NextResponse.json({ ok: false, error: 'Chat ID not configured' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ LUMA Mission Control connected successfully!\n\nTelegram alerts are working.',
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json({ ok: false, error: data.description || 'Telegram API error' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
