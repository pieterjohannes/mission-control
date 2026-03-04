import Database from 'better-sqlite3';
import path from 'path';
import { broadcast } from './events';

const DATA_DIR = path.join(process.cwd(), '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'mission-control.db');

let db: Database.Database | null = null;

// Known databases for WAL checkpoint management
export const KNOWN_DATABASES = [
  { name: 'mission-control.db', path: path.join(DATA_DIR, 'mission-control.db') },
  { name: 'mmcb.db', path: path.join(DATA_DIR, 'mmcb.db') },
  { name: 'kai.db', path: path.join(DATA_DIR, 'kai.db') },
  { name: 'domains.db', path: path.join(DATA_DIR, 'domains.db') },
];

let lastCheckpointTime: string | null = null;
let checkpointTimer: ReturnType<typeof setInterval> | null = null;

export function getLastCheckpointTime() { return lastCheckpointTime; }

export function checkpointAllDatabases(): { name: string; success: boolean; error?: string; walSize?: number; dbSize?: number }[] {
  const fs = require('fs');
  const results = KNOWN_DATABASES.map(({ name, path: dbPath }) => {
    try {
      if (!fs.existsSync(dbPath)) {
        return { name, success: false, error: 'File not found' };
      }
      const tempDb = new Database(dbPath);
      tempDb.pragma('busy_timeout = 5000');
      tempDb.pragma('wal_checkpoint(TRUNCATE)');
      tempDb.close();

      const dbSize = fs.statSync(dbPath).size;
      const walPath = dbPath + '-wal';
      const walSize = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;
      return { name, success: true, dbSize, walSize };
    } catch (e: any) {
      return { name, success: false, error: e.message };
    }
  });
  lastCheckpointTime = new Date().toISOString();
  return results;
}

export function getDatabaseStats(): { name: string; dbSize: number; walSize: number; exists: boolean }[] {
  const fs = require('fs');
  return KNOWN_DATABASES.map(({ name, path: dbPath }) => {
    const exists = fs.existsSync(dbPath);
    const dbSize = exists ? fs.statSync(dbPath).size : 0;
    const walPath = dbPath + '-wal';
    const walSize = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;
    return { name, dbSize, walSize, exists };
  });
}

// Start hourly auto-checkpoint
function startAutoCheckpoint() {
  if (checkpointTimer) return;
  checkpointTimer = setInterval(() => {
    try { checkpointAllDatabases(); } catch {}
  }, 60 * 60 * 1000); // 1 hour
}

// Auto-start on module load
startAutoCheckpoint();

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000');
    db.pragma('temp_store = MEMORY');
    db.pragma('trusted_schema = 1'); // Required for FTS5 triggers in SQLite 3.37+
    initializeDb(db);
  }
  return db;
}

function initializeDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      image TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'idea',
      domain TEXT,
      repo TEXT,
      url TEXT,
      notes TEXT,
      revenue_monthly REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL UNIQUE,
      registrar TEXT DEFAULT 'namecheap',
      status TEXT DEFAULT 'active',
      project_id INTEGER,
      expiry_date TEXT,
      auto_renew INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      stage TEXT NOT NULL DEFAULT 'idea',
      priority INTEGER DEFAULT 0,
      domain TEXT,
      target_audience TEXT,
      revenue_model TEXT,
      notes TEXT,
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT NOT NULL DEFAULT 'kai',
      action TEXT NOT NULL,
      details TEXT,
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      issue_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_activity_agent ON activity_log(agent);
    CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_log(created_at);

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      project TEXT,
      assignee TEXT,
      created_by TEXT DEFAULT 'kai',
      priority TEXT DEFAULT 'medium',
      labels TEXT DEFAULT '[]',
      subtasks TEXT DEFAULT '[]',
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_comments_issue ON comments(issue_id);

    CREATE TABLE IF NOT EXISTS agent_pulse (
      issue_id TEXT PRIMARY KEY,
      agent TEXT NOT NULL,
      last_pulse TEXT DEFAULT (datetime('now')),
      action TEXT
    );

    CREATE TABLE IF NOT EXISTS skill_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill TEXT NOT NULL UNIQUE,
      last_run TEXT,
      last_status TEXT DEFAULT 'unknown',
      last_agent TEXT,
      last_detail TEXT,
      run_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS skill_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill TEXT NOT NULL,
      agent TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT,
      duration_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_skill_runs_skill ON skill_runs(skill);
    CREATE INDEX IF NOT EXISTS idx_skill_runs_created ON skill_runs(created_at);

    CREATE TABLE IF NOT EXISTS issue_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      to_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'blocks',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(from_id, to_id, type)
    );
    CREATE INDEX IF NOT EXISTS idx_issue_links_from ON issue_links(from_id);
    CREATE INDEX IF NOT EXISTS idx_issue_links_to ON issue_links(to_id);

    CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      project TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by TEXT NOT NULL DEFAULT 'unknown',
      changed_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_status_history_issue ON status_history(issue_id);
    CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON status_history(changed_at);

    CREATE TABLE IF NOT EXISTS sprints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      goal TEXT,
      status TEXT NOT NULL DEFAULT 'planning',
      start_date TEXT,
      end_date TEXT,
      project TEXT,
      created_by TEXT DEFAULT 'kai',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);
    CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints(project);

    CREATE TABLE IF NOT EXISTS issue_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      project TEXT,
      priority TEXT DEFAULT 'medium',
      labels TEXT DEFAULT '[]',
      default_subtasks TEXT DEFAULT '[]',
      created_by TEXT DEFAULT 'kai',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_issue_templates_project ON issue_templates(project);

    CREATE TABLE IF NOT EXISTS time_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      agent TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_sec INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_time_logs_issue ON time_logs(issue_id);
    CREATE INDEX IF NOT EXISTS idx_time_logs_agent ON time_logs(agent);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      issue_id TEXT,
      agent TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

    CREATE TABLE IF NOT EXISTS issue_subscriptions (
      id TEXT PRIMARY KEY DEFAULT ('sub-' || lower(hex(randomblob(4)))),
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      subscriber TEXT NOT NULL,
      channel TEXT DEFAULT 'telegram',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(issue_id, subscriber)
    );
    CREATE INDEX IF NOT EXISTS idx_issue_subscriptions_issue ON issue_subscriptions(issue_id);
  `);

  // FTS5 virtual tables (content-backed for external content sync)
  // Note: IF NOT EXISTS won't upgrade old non-content tables; migration handles that separately
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS issues_fts USING fts5(
      id UNINDEXED, title, description, project, content='issues', content_rowid='rowid'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS ideas_fts USING fts5(
      id UNINDEXED, title, description, notes, content='ideas', content_rowid='rowid'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
      id UNINDEXED, name, description, notes, content='projects', content_rowid='rowid'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS comments_fts USING fts5(
      id UNINDEXED, issue_id UNINDEXED, author, body, content='comments', content_rowid='rowid'
    );
  `);

  // Triggers to keep FTS in sync — issues
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS issues_ai AFTER INSERT ON issues BEGIN
      INSERT INTO issues_fts(rowid, id, title, description, project)
      VALUES (NEW.rowid, NEW.id, NEW.title, NEW.description, NEW.project);
    END;
    CREATE TRIGGER IF NOT EXISTS issues_ad AFTER DELETE ON issues BEGIN
      INSERT INTO issues_fts(issues_fts, rowid, id, title, description, project)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.description, OLD.project);
    END;
    CREATE TRIGGER IF NOT EXISTS issues_au AFTER UPDATE ON issues BEGIN
      INSERT INTO issues_fts(issues_fts, rowid, id, title, description, project)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.description, OLD.project);
      INSERT INTO issues_fts(rowid, id, title, description, project)
      VALUES (NEW.rowid, NEW.id, NEW.title, NEW.description, NEW.project);
    END;
  `);

  // Triggers — ideas
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS ideas_ai AFTER INSERT ON ideas BEGIN
      INSERT INTO ideas_fts(rowid, id, title, description, notes)
      VALUES (NEW.rowid, NEW.id, NEW.title, NEW.description, NEW.notes);
    END;
    CREATE TRIGGER IF NOT EXISTS ideas_ad AFTER DELETE ON ideas BEGIN
      INSERT INTO ideas_fts(ideas_fts, rowid, id, title, description, notes)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.description, OLD.notes);
    END;
    CREATE TRIGGER IF NOT EXISTS ideas_au AFTER UPDATE ON ideas BEGIN
      INSERT INTO ideas_fts(ideas_fts, rowid, id, title, description, notes)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.description, OLD.notes);
      INSERT INTO ideas_fts(rowid, id, title, description, notes)
      VALUES (NEW.rowid, NEW.id, NEW.title, NEW.description, NEW.notes);
    END;
  `);

  // Triggers — projects
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS projects_ai AFTER INSERT ON projects BEGIN
      INSERT INTO projects_fts(rowid, id, name, description, notes)
      VALUES (NEW.rowid, NEW.id, NEW.name, NEW.description, NEW.notes);
    END;
    CREATE TRIGGER IF NOT EXISTS projects_ad AFTER DELETE ON projects BEGIN
      INSERT INTO projects_fts(projects_fts, rowid, id, name, description, notes)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.description, OLD.notes);
    END;
    CREATE TRIGGER IF NOT EXISTS projects_au AFTER UPDATE ON projects BEGIN
      INSERT INTO projects_fts(projects_fts, rowid, id, name, description, notes)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.description, OLD.notes);
      INSERT INTO projects_fts(rowid, id, name, description, notes)
      VALUES (NEW.rowid, NEW.id, NEW.name, NEW.description, NEW.notes);
    END;
  `);

  // Triggers — comments
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS comments_ai AFTER INSERT ON comments BEGIN
      INSERT INTO comments_fts(rowid, id, issue_id, author, body)
      VALUES (NEW.rowid, NEW.id, NEW.issue_id, NEW.author, NEW.body);
    END;
    CREATE TRIGGER IF NOT EXISTS comments_ad AFTER DELETE ON comments BEGIN
      INSERT INTO comments_fts(comments_fts, rowid, id, issue_id, author, body)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.issue_id, OLD.author, OLD.body);
    END;
    CREATE TRIGGER IF NOT EXISTS comments_au AFTER UPDATE ON comments BEGIN
      INSERT INTO comments_fts(comments_fts, rowid, id, issue_id, author, body)
      VALUES ('delete', OLD.rowid, OLD.id, OLD.issue_id, OLD.author, OLD.body);
      INSERT INTO comments_fts(rowid, id, issue_id, author, body)
      VALUES (NEW.rowid, NEW.id, NEW.issue_id, NEW.author, NEW.body);
    END;
  `);

  // Rebuild FTS indexes from current data (idempotent)
  db.exec(`
    INSERT INTO issues_fts(issues_fts) VALUES('rebuild');
    INSERT INTO ideas_fts(ideas_fts) VALUES('rebuild');
    INSERT INTO projects_fts(projects_fts) VALUES('rebuild');
    INSERT INTO comments_fts(comments_fts) VALUES('rebuild');
  `);

  // Migrations: add sprint_id to issues if not present
  const issuesCols = db.pragma('table_info(issues)') as { name: string }[];
  if (!issuesCols.find(c => c.name === 'sprint_id')) {
    db.exec('ALTER TABLE issues ADD COLUMN sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL');
    db.exec('CREATE INDEX IF NOT EXISTS idx_issues_sprint ON issues(sprint_id)');
  }

  // Migrations: add effort_size to issues if not present
  if (!issuesCols.find(c => c.name === 'effort_size')) {
    db.exec("ALTER TABLE issues ADD COLUMN effort_size TEXT");
  }

  // Seed users
  seedUsers(db);

  // Seed if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number };
  if (count.c === 0) {
    seedData(db);
  }

  // Seed issues independently
  seedIssues(db);

  // Seed labels
  seedLabels(db);
}

export function notifySubscribers(issueId: string, message: string): void {
  try {
    const db = getDb();
    const subs = db.prepare("SELECT subscriber FROM issue_subscriptions WHERE issue_id = ?").all(issueId) as { subscriber: string }[];
    for (const { subscriber } of subs) {
      fetch("http://localhost:3100/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriber, message }),
      }).catch(() => {});
    }
  } catch {}
}

export function logActivity(agent: string, action: string, detail?: string | null, issueId?: string | null) {
  const db = getDb();
  db.prepare("INSERT INTO activity_log (agent, action, detail, issue_id) VALUES (?, ?, ?, ?)").run(agent, action, detail || null, issueId || null);

  // Broadcast to all SSE clients
  broadcast("activity_logged", {
    agent,
    action,
    detail: detail || null,
    issueId: issueId || null,
  });
}

function seedUsers(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (count.c > 0) return;

  // bcryptjs hashSync - pre-computed hashes for default passwords
  // Password for pieter: "mission-control-2026" 
  // Password for agents: "agent-mc-2026"
  const bcrypt = require('bcryptjs');
  const pieterHash = bcrypt.hashSync('mission-control-2026', 10);
  const agentHash = bcrypt.hashSync('agent-mc-2026', 10);

  const insert = db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)');
  const seed = db.transaction(() => {
    insert.run('usr-pieter', 'Pieter', 'pieter.beens@gmail.com', pieterHash, 'admin');
    insert.run('usr-kai', 'Kai', 'kai@agn.team', agentHash, 'agent');
    insert.run('usr-alma', 'Alma', 'alma@agn.team', agentHash, 'agent');
    insert.run('usr-marco', 'Marco', 'marco@agn.team', agentHash, 'agent');
    insert.run('usr-bea', 'Bea', 'bea@agn.team', agentHash, 'agent');
    insert.run('usr-rex', 'Rex', 'rex@agn.team', agentHash, 'agent');
    insert.run('usr-viktor', 'Viktor', 'viktor@agn.team', agentHash, 'agent');
    insert.run('usr-dev', 'Dev', 'dev@agn.team', agentHash, 'agent');
    insert.run('usr-luna', 'Luna', 'luna@agn.team', agentHash, 'agent');
    insert.run('usr-max', 'Max', 'max@agn.team', agentHash, 'agent');
  });
  seed();
}

function seedData(db: Database.Database) {
  const insertProject = db.prepare(
    'INSERT INTO projects (name, description, status, domain, repo, url, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertDomain = db.prepare(
    'INSERT INTO domains (domain, status, project_id, notes) VALUES (?, ?, ?, ?)'
  );
  const insertIdea = db.prepare(
    'INSERT INTO ideas (title, description, stage, priority) VALUES (?, ?, ?, ?)'
  );
  const insertLog = db.prepare(
    'INSERT INTO agent_logs (agent, action, details) VALUES (?, ?, ?)'
  );

  const seed = db.transaction(() => {
    // Projects from MEMORY.md
    insertProject.run('closing.team', 'AI sales CRM for commission-based teams', 'parked', 'closing.team', 'pieterjohannes/closing-team', 'https://closing.team', 'Parked due to auth bug - Bearer token auth → Supabase SSR getUser() returns "Auth session missing!"');
    insertProject.run('Voicy.coach', 'Meeting voice coach with black zen UI', 'launched', 'voicy.coach', 'pieterjohannes/voicy', 'https://voicy.coach', 'MVP shipped 2026-01-31');
    insertProject.run('MMCB', 'Maiken\'s Morning Career Brief - daily job search', 'active', null, null, null, 'Cron: 9 AM Copenhagen → WhatsApp');
    insertProject.run('AGN.TEAM', 'Agent identity infrastructure - agents can send email', 'launched', 'agn.team', null, null, 'Agents can send email as name@agn.team. Gmail push notifications.');
    insertProject.run('Bot Family', '9 AI agent personas on Telegram', 'active', null, null, null, 'v0.1 - Alma LIVE on Telegram');
    insertProject.run('LMNRY Labs', 'AI/software agency with Sebastiaan Schinkel', 'active', 'lmnrylabs.com', null, null, 'Main business');
    insertProject.run('B1S Consulting', 'Danish IT/strategy consultancy', 'active', 'b1s.consulting', null, null, 'CVR: 45624056');
    insertProject.run('Mission Control', 'Kai\'s local workspace dashboard', 'building', null, null, 'http://localhost:3100', 'This app!');

    // Domains
    insertDomain.run('closing.team', 'active', 1, 'AI sales CRM');
    insertDomain.run('voicy.coach', 'active', 2, 'Voice coach app');
    insertDomain.run('agn.team', 'active', 4, 'Agent identity');
    insertDomain.run('lmnrylabs.com', 'active', 6, 'Agency');
    insertDomain.run('b1s.consulting', 'active', 7, 'Consultancy');

    // Ideas
    insertIdea.run('n8n AI Email Agent', 'Watches Dropbox/email → translate → summarize → TickTick + Calendar + Notion', 'idea', 3);
    insertIdea.run('Apple Watch OC Voice', 'Apple Watch → OpenClaw voice integration', 'idea', 2);
    insertIdea.run('Discord LifeOS', 'Personal + work Discord servers for life management', 'idea', 2);
    insertIdea.run('Domain/Idea Tracker SaaS', 'Public version of domain tracking system', 'idea', 1);

    // Initial log
    insertLog.run('kai', 'mission_control_created', 'Mission Control initialized with seed data from MEMORY.md');
  });

  seed();
}

function seedLabels(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as c FROM labels').get() as { c: number };
  if (count.c > 0) return;

  const insert = db.prepare('INSERT OR IGNORE INTO labels (id, name, color, project) VALUES (?, ?, ?, ?)');
  const seed = db.transaction(() => {
    insert.run('lbl-bug', 'bug', '#ef4444', null);
    insert.run('lbl-feature', 'feature', '#3b82f6', null);
    insert.run('lbl-ux', 'ux', '#a855f7', null);
    insert.run('lbl-dx', 'dx', '#f59e0b', null);
    insert.run('lbl-analytics', 'analytics', '#10b981', null);
    insert.run('lbl-infra', 'infra', '#6366f1', null);
    insert.run('lbl-ops', 'ops', '#64748b', null);
    insert.run('lbl-ai', 'ai', '#ec4899', null);
    insert.run('lbl-migration', 'migration', '#f97316', null);
    insert.run('lbl-integration', 'integration', '#14b8a6', null);
    insert.run('lbl-idea', 'idea', '#eab308', null);
    insert.run('lbl-ui', 'ui', '#8b5cf6', null);
  });
  seed();
}

function seedIssues(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as c FROM issues').get() as { c: number };
  if (count.c > 0) return;

  const insert = db.prepare(
    `INSERT INTO issues (id, title, description, status, project, assignee, created_by, priority, labels, subtasks, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const issues = [
    // Mission Control
    ['mc-1', 'Kanban board for issues', 'Linear-inspired drag-and-drop board', 'in_progress', 'Mission Control', 'kai', 'pieter', 'high', '["feature"]', '[]', 0],
    ['mc-2', 'Add search across all entities', 'Global search bar in sidebar', 'backlog', 'Mission Control', 'kai', 'kai', 'medium', '["feature"]', '[]', 1],
    ['mc-3', 'Mobile responsive layout', 'Sidebar collapse on mobile', 'backlog', 'Mission Control', 'kai', 'kai', 'medium', '["ui"]', '[]', 2],
    ['mc-4', 'Dashboard charts with real data', 'Revenue over time, activity heatmap', 'next', 'Mission Control', 'kai', 'pieter', 'medium', '["feature","analytics"]', '[]', 0],
    ['mc-5', 'Dark mode toggle', 'Support light mode too', 'backlog', 'Mission Control', 'kai', 'kai', 'low', '["ui"]', '[]', 3],

    // LUMA
    ['lm-1', 'Docker compose for LUMA stack', 'Postgres + Redis + API + Worker', 'next', 'LUMA', 'pieter', 'pieter', 'urgent', '["infra"]', JSON.stringify([{title:'Write Dockerfile',done:true},{title:'Docker compose',done:false},{title:'Health checks',done:false}]), 0],
    ['lm-2', 'Slack integration', 'Bot posts updates to #luma channel', 'backlog', 'LUMA', 'kai', 'pieter', 'high', '["integration"]', '[]', 0],
    ['lm-3', 'Telegram bot for LUMA alerts', 'Critical alerts via Telegram', 'backlog', 'LUMA', 'kai', 'kai', 'medium', '["integration"]', '[]', 1],

    // SQLite Wiring
    ['sq-1', 'Migrate kai.db heartbeat checks', 'Move to new schema with indexes', 'review', 'SQLite Wiring', 'kai', 'kai', 'high', '["migration"]', JSON.stringify([{title:'Create new schema',done:true},{title:'Migrate data',done:true},{title:'Update queries',done:false}]), 0],
    ['sq-2', 'Add FTS5 to mission-control.db', 'Full-text search on projects + ideas', 'next', 'SQLite Wiring', 'kai', 'kai', 'medium', '["feature"]', '[]', 1],
    ['sq-3', 'WAL checkpoint automation', 'Auto checkpoint when WAL > 10MB', 'backlog', 'SQLite Wiring', 'kai', 'kai', 'low', '["ops"]', '[]', 0],

    // Ideas from Kai
    ['id-1', 'Agent standup bot', 'Daily 9am standup from all agents → Telegram', 'backlog', 'Bot Family', 'kai', 'kai', 'medium', '["idea"]', '[]', 0],
    ['id-2', 'TRMNL weather widget', 'Show weather + calendar on e-ink', 'done', 'Bot Family', 'kai', 'kai', 'low', '["feature"]', '[]', 0],
    ['id-3', 'Voice notes transcription', 'Apple Watch → transcribe → TickTick task', 'backlog', 'Bot Family', 'pieter', 'pieter', 'high', '["idea","ai"]', '[]', 1],
  ];

  for (const issue of issues) {
    insert.run(...issue);
  }
}
