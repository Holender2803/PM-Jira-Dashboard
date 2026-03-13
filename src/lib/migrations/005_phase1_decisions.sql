CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  problem_context TEXT NOT NULL,
  final_decision TEXT,
  expected_outcome TEXT,
  owner_name TEXT,
  decision_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','decided','revisited','superseded')),
  primary_initiative_id TEXT,
  linked_initiative_ids TEXT NOT NULL DEFAULT '[]',
  linked_issue_keys TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (primary_initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS decision_options (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  option_title TEXT NOT NULL,
  pros TEXT,
  cons TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_selected INTEGER NOT NULL DEFAULT 0
    CHECK (is_selected IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_decision_date ON decisions(decision_date);
CREATE INDEX IF NOT EXISTS idx_decisions_primary_initiative_id ON decisions(primary_initiative_id);
CREATE INDEX IF NOT EXISTS idx_decision_options_decision_id ON decision_options(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_options_decision_sort ON decision_options(decision_id, sort_order);
