CREATE TABLE IF NOT EXISTS initiatives (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','discovery','planned','in_progress','launched','done','on_hold','archived')),
  owner_name TEXT,
  theme TEXT,
  target_date TEXT,
  notes TEXT,
  linked_issue_keys TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_initiatives_status ON initiatives(status);
CREATE INDEX IF NOT EXISTS idx_initiatives_target_date ON initiatives(target_date);
CREATE INDEX IF NOT EXISTS idx_initiatives_updated_at ON initiatives(updated_at);
