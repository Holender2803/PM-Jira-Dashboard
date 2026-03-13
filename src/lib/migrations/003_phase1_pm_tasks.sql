CREATE TABLE IF NOT EXISTS pm_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('Discovery','Delivery','Stakeholder','Strategy','Operations')),
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','done','cancelled')),
  owner_name TEXT,
  due_date TEXT,
  initiative_id TEXT,
  meeting_participants TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  linked_issue_keys TEXT NOT NULL DEFAULT '[]',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pm_tasks_status ON pm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_category ON pm_tasks(category);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_due_date ON pm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_initiative_id ON pm_tasks(initiative_id);
