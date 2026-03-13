ALTER TABLE initiatives ADD COLUMN objective_id TEXT;
ALTER TABLE initiatives ADD COLUMN outcome_id TEXT;

CREATE INDEX IF NOT EXISTS idx_initiatives_objective_id ON initiatives(objective_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_outcome_id ON initiatives(outcome_id);
