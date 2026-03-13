ALTER TABLE ai_reports ADD COLUMN report_family TEXT NOT NULL DEFAULT 'report';
ALTER TABLE ai_reports ADD COLUMN audience TEXT;
ALTER TABLE ai_reports ADD COLUMN title TEXT;
ALTER TABLE ai_reports ADD COLUMN source_entities_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE ai_reports ADD COLUMN custom_instructions TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_reports_family_generated_at ON ai_reports(report_family, generated_at DESC);
