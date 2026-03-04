import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/biztv - fetch latest news items, action items, KPI deltas
export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const category = searchParams.get('category');

  // Ensure tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS biztv_sources (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, filename TEXT, url TEXT,
      duration_seconds REAL, transcription TEXT, transcription_model TEXT DEFAULT 'whisper-1',
      language TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS biztv_news_items (
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL,
      headline TEXT NOT NULL, summary TEXT NOT NULL, category TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.0, source_quote TEXT,
      source_offset_start REAL, source_offset_end REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS biztv_action_items (
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL,
      news_item_id TEXT, action TEXT NOT NULL, assignee TEXT,
      priority TEXT DEFAULT 'medium', due_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS biztv_kpi_deltas (
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL,
      news_item_id TEXT, metric TEXT NOT NULL, value_before TEXT,
      value_after TEXT, delta TEXT, direction TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  let newsQuery = `
    SELECT n.*, s.filename as source_filename, s.url as source_url, s.type as source_type
    FROM biztv_news_items n
    LEFT JOIN biztv_sources s ON n.source_id = s.id
  `;
  const params: any[] = [];
  
  if (category) {
    newsQuery += ' WHERE n.category = ?';
    params.push(category);
  }
  newsQuery += ' ORDER BY n.created_at DESC LIMIT ?';
  params.push(limit);

  const news_items = db.prepare(newsQuery).all(...params);
  
  const action_items = db.prepare(
    'SELECT * FROM biztv_action_items ORDER BY created_at DESC LIMIT ?'
  ).all(limit);
  
  const kpi_deltas = db.prepare(
    'SELECT * FROM biztv_kpi_deltas ORDER BY created_at DESC LIMIT ?'
  ).all(limit);

  return NextResponse.json({ news_items, action_items, kpi_deltas });
}
