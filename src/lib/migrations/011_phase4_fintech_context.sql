CREATE TABLE IF NOT EXISTS fintech_context_items (
  id TEXT PRIMARY KEY,
  context_type TEXT NOT NULL
    CHECK (context_type IN ('data_source','reporting_pipeline','compliance_constraint','reconciliation_point','system_integration','workflow_friction','source_of_truth')),
  name TEXT NOT NULL,
  description TEXT,
  system_name TEXT,
  source_of_truth TEXT,
  manual_step_flag INTEGER NOT NULL DEFAULT 0
    CHECK (manual_step_flag IN (0,1)),
  reconciliation_risk_flag INTEGER NOT NULL DEFAULT 0
    CHECK (reconciliation_risk_flag IN (0,1)),
  compliance_note TEXT,
  owner_stakeholder_id TEXT,
  linked_initiative_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (owner_stakeholder_id) REFERENCES stakeholders(id) ON DELETE SET NULL,
  FOREIGN KEY (linked_initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fintech_context_items_type ON fintech_context_items(context_type);
CREATE INDEX IF NOT EXISTS idx_fintech_context_items_manual_step ON fintech_context_items(manual_step_flag);
CREATE INDEX IF NOT EXISTS idx_fintech_context_items_reconciliation_risk ON fintech_context_items(reconciliation_risk_flag);
CREATE INDEX IF NOT EXISTS idx_fintech_context_items_owner_stakeholder_id ON fintech_context_items(owner_stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_fintech_context_items_linked_initiative_id ON fintech_context_items(linked_initiative_id);
