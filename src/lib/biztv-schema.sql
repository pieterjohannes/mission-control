-- BizTV news_items storage layer
-- Run via better-sqlite3 in initializeDb or standalone

CREATE TABLE IF NOT EXISTS biztv_sources (
  id TEXT PRIMARY KEY,                    -- e.g. 'src-abc123'
  type TEXT NOT NULL,                     -- 'audio', 'video', 'text', 'url'
  filename TEXT,
  url TEXT,
  duration_seconds REAL,
  transcription TEXT,                     -- raw whisper output
  transcription_model TEXT DEFAULT 'whisper-1',
  language TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS biztv_news_items (
  id TEXT PRIMARY KEY,                    -- e.g. 'news-abc123'
  source_id TEXT NOT NULL REFERENCES biztv_sources(id),
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL,                 -- 'BREAKING','EARNINGS','MARKETS','CRYPTO','MACRO','TECH','POLICY'
  confidence REAL NOT NULL DEFAULT 0.0,   -- 0.0 - 1.0 hallucination guard score
  source_quote TEXT,                      -- exact quote from transcript backing this item
  source_offset_start REAL,              -- timestamp in source
  source_offset_end REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS biztv_action_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES biztv_sources(id),
  news_item_id TEXT REFERENCES biztv_news_items(id),
  action TEXT NOT NULL,
  assignee TEXT,
  priority TEXT DEFAULT 'medium',
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS biztv_kpi_deltas (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES biztv_sources(id),
  news_item_id TEXT REFERENCES biztv_news_items(id),
  metric TEXT NOT NULL,                   -- e.g. 'S&P 500', 'BTC price', 'jobless claims'
  value_before TEXT,
  value_after TEXT,
  delta TEXT,                             -- e.g. '+2.3%', '-50K'
  direction TEXT,                         -- 'up', 'down', 'flat'
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_news_source ON biztv_news_items(source_id);
CREATE INDEX IF NOT EXISTS idx_news_created ON biztv_news_items(created_at);
CREATE INDEX IF NOT EXISTS idx_news_category ON biztv_news_items(category);
CREATE INDEX IF NOT EXISTS idx_actions_source ON biztv_action_items(source_id);
CREATE INDEX IF NOT EXISTS idx_kpi_source ON biztv_kpi_deltas(source_id);
