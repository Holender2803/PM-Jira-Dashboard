CREATE TABLE IF NOT EXISTS prioritization_scores (
  id TEXT PRIMARY KEY,
  framework TEXT NOT NULL DEFAULT 'RICE'
    CHECK (framework IN ('RICE')),
  target_type TEXT NOT NULL
    CHECK (target_type IN ('jira_issue','initiative')),
  target_id TEXT NOT NULL,
  initiative_id TEXT,
  reach REAL NOT NULL DEFAULT 0,
  impact REAL NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 100
    CHECK (confidence >= 0 AND confidence <= 100),
  effort REAL NOT NULL DEFAULT 1
    CHECK (effort > 0),
  score REAL NOT NULL DEFAULT 0,
  rationale TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL,
  UNIQUE (framework, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_prioritization_target_type ON prioritization_scores(target_type);
CREATE INDEX IF NOT EXISTS idx_prioritization_initiative_id ON prioritization_scores(initiative_id);
CREATE INDEX IF NOT EXISTS idx_prioritization_score ON prioritization_scores(score);
