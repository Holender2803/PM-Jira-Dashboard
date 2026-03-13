CREATE TABLE IF NOT EXISTS objectives (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','at_risk','done','archived')),
  owner_name TEXT,
  start_date TEXT,
  target_date TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives(status);
CREATE INDEX IF NOT EXISTS idx_objectives_target_date ON objectives(target_date);

CREATE TABLE IF NOT EXISTS outcomes (
  id TEXT PRIMARY KEY,
  objective_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  baseline_text TEXT,
  target_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','at_risk','done','archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (objective_id) REFERENCES objectives(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_outcomes_objective_id ON outcomes(objective_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_status ON outcomes(status);

CREATE TABLE IF NOT EXISTS kpis (
  id TEXT PRIMARY KEY,
  outcome_id TEXT NOT NULL,
  name TEXT NOT NULL,
  metric_type TEXT NOT NULL DEFAULT 'numeric'
    CHECK (metric_type IN ('numeric','percentage','currency','duration_days','count')),
  unit TEXT,
  baseline_value REAL,
  current_value REAL,
  target_value REAL,
  measurement_frequency TEXT NOT NULL DEFAULT 'monthly'
    CHECK (measurement_frequency IN ('weekly','monthly','quarterly','manual')),
  source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual','jira','derived','other')),
  source_notes TEXT,
  last_measured_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (outcome_id) REFERENCES outcomes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kpis_outcome_id ON kpis(outcome_id);
CREATE INDEX IF NOT EXISTS idx_kpis_last_measured_at ON kpis(last_measured_at);

CREATE TABLE IF NOT EXISTS kpi_measurements (
  id TEXT PRIMARY KEY,
  kpi_id TEXT NOT NULL,
  measured_at TEXT NOT NULL,
  value REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (kpi_id) REFERENCES kpis(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kpi_measurements_kpi_id ON kpi_measurements(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_measurements_measured_at ON kpi_measurements(measured_at);
