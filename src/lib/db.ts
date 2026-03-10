import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || './data/jira-dashboard.db';
const absolutePath = path.resolve(process.cwd(), DB_PATH);

// Ensure data directory exists
const dir = path.dirname(absolutePath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

let db: Database.Database;

export function getDb(): Database.Database {
    if (!db) {
        db = new Database(absolutePath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initSchema(db);
    }
    return db;
}

function initSchema(db: Database.Database) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      summary TEXT NOT NULL,
      description TEXT,
      issue_type TEXT,
      status TEXT,
      priority TEXT,
      assignee_id TEXT,
      assignee_name TEXT,
      assignee_email TEXT,
      reporter_id TEXT,
      reporter_name TEXT,
      labels TEXT DEFAULT '[]',
      components TEXT DEFAULT '[]',
      parent_key TEXT,
      parent_summary TEXT,
      epic_key TEXT,
      epic_summary TEXT,
      sprint_id INTEGER,
      sprint_name TEXT,
      sprint_state TEXT,
      sprint_start TEXT,
      sprint_end TEXT,
      story_points REAL,
      created TEXT,
      updated TEXT,
      resolved TEXT,
      comments_count INTEGER DEFAULT 0,
      linked_issues TEXT DEFAULT '[]',
      project TEXT,
      work_type TEXT,
      squad TEXT,
      url TEXT,
      changelog TEXT DEFAULT '[]',
      synced_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      raw_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
    CREATE INDEX IF NOT EXISTS idx_issues_sprint ON issues(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(issue_type);
    CREATE INDEX IF NOT EXISTS idx_issues_created ON issues(created);
    CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project);

    CREATE TABLE IF NOT EXISTS epics (
      key TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      updated_at TEXT,
      source TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_epics_updated_at ON epics(updated_at);

    CREATE TABLE IF NOT EXISTS sprints (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      state TEXT,
      start_date TEXT,
      end_date TEXT,
      complete_date TEXT,
      goal TEXT,
      board_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      issues_synced INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running',
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS saved_views (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      filters TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ai_reports (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      tone TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      summary TEXT,
      content TEXT,
      issue_keys TEXT,
      sprint_name TEXT
    );

    CREATE TABLE IF NOT EXISTS status_reports (
      id TEXT PRIMARY KEY,
      generated_at TEXT,
      audience TEXT,
      sprint_name TEXT,
      content TEXT,
      is_auto INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS bug_tracking_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      bug_source_label TEXT NOT NULL DEFAULT 'source',
      production_keywords TEXT NOT NULL DEFAULT 'production, prod, client-reported, escaped',
      qa_keywords TEXT NOT NULL DEFAULT 'qa, testing, internal, caught-in-qa',
      configured INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS team_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      team_name TEXT DEFAULT 'Engineering Team',
      active_engineers INTEGER DEFAULT 3,
      hourly_rate INTEGER DEFAULT 100,
      productive_hours_per_sprint INTEGER DEFAULT 50,
      sprint_length_weeks INTEGER DEFAULT 2,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS report_schedule (
      id INTEGER PRIMARY KEY DEFAULT 1,
      enabled INTEGER DEFAULT 0,
      day_of_week TEXT DEFAULT 'Friday',
      time TEXT DEFAULT '09:00',
      audience TEXT DEFAULT 'executive',
      last_run_at TEXT,
      next_run_at TEXT
    );
  `);

    const statusReportColumns = db.prepare(`PRAGMA table_info(status_reports)`).all() as { name: string }[];
    if (!statusReportColumns.some((column) => column.name === 'is_auto')) {
        db.exec(`ALTER TABLE status_reports ADD COLUMN is_auto INTEGER DEFAULT 0`);
    }

    // Backfill epics table for existing databases created before epics persistence.
    db.exec(`
    INSERT OR IGNORE INTO epics (key, summary, updated_at, source)
    SELECT key, summary, updated, 'issues_backfill'
    FROM issues
    WHERE LOWER(issue_type) = 'epic'
      AND summary IS NOT NULL
      AND TRIM(summary) <> '';

    INSERT OR IGNORE INTO epics (key, summary, updated_at, source)
    SELECT epic_key, epic_summary, updated, 'issues_backfill'
    FROM issues
    WHERE epic_key IS NOT NULL
      AND TRIM(epic_key) <> ''
      AND epic_summary IS NOT NULL
      AND TRIM(epic_summary) <> ''
      AND epic_summary <> epic_key;
  `);

    // Ensure built-in saved views exist.
    const insert = db.prepare(`
    INSERT OR IGNORE INTO saved_views (id, name, description, filters, is_default)
    VALUES (?, ?, ?, ?, ?)
  `);
    const defaultViews = [
        ['view-current-sprint', 'Current Sprint', 'All tickets in the active sprint', JSON.stringify({ sprint: 'current' }), 1],
        ['view-blocked', 'Blocked Tickets', 'All currently blocked tickets', JSON.stringify({ status: ['Blocked'] }), 0],
        ['view-bugs-sprint', 'Bugs This Sprint', 'Bug tickets in current sprint', JSON.stringify({ sprint: 'current', issueType: ['Bug'] }), 0],
        ['view-release-ready', 'Ready for Release', 'Tickets ready to ship', JSON.stringify({ status: ['Ready for Release', 'Ready for Acceptance'] }), 0],
        ['view-aging', 'Aging Work', 'Unresolved tickets older than 30 days', JSON.stringify({ unresolvedOnly: true }), 0],
        ['view-feature-only', 'Feature Work Only', 'Stories and features only', JSON.stringify({ issueType: ['Story', 'Feature'] }), 0],
        ['view-legacy-mdfm', 'Legacy MDFM Only', 'Tickets scoped to Legacy MDFM squad', JSON.stringify({ squad: ['Legacy MDFM'] }), 0],
        ['view-mdfm', 'MDFM Only', 'Tickets scoped to MDFM squad', JSON.stringify({ squad: ['MDFM'] }), 0],
        ['view-weekly-review', 'My Team Weekly Review', 'Current sprint with unresolved and blocked focus', JSON.stringify({ sprint: 'current', unresolvedOnly: true }), 0],
    ];
    for (const v of defaultViews) {
        insert.run(...v);
    }
}

export default getDb;
