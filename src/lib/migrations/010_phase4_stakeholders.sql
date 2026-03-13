CREATE TABLE IF NOT EXISTS stakeholders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  organization TEXT,
  relationship_type TEXT NOT NULL DEFAULT 'engineering'
    CHECK (relationship_type IN ('sales','client','engineering','design','support','executive','partner','compliance','operations')),
  linked_initiative_ids TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS stakeholder_interactions (
  id TEXT PRIMARY KEY,
  stakeholder_id TEXT NOT NULL,
  interaction_date TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  initiative_id TEXT,
  linked_issue_keys TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (stakeholder_id) REFERENCES stakeholders(id) ON DELETE CASCADE,
  FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stakeholders_relationship_type ON stakeholders(relationship_type);
CREATE INDEX IF NOT EXISTS idx_stakeholders_organization ON stakeholders(organization);
CREATE INDEX IF NOT EXISTS idx_stakeholders_updated_at ON stakeholders(updated_at);
CREATE INDEX IF NOT EXISTS idx_stakeholder_interactions_stakeholder_id ON stakeholder_interactions(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_interactions_date ON stakeholder_interactions(interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_stakeholder_interactions_initiative_id ON stakeholder_interactions(initiative_id);
