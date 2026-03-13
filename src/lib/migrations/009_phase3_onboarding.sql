CREATE TABLE IF NOT EXISTS onboarding_playbooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 90,
  persona TEXT NOT NULL DEFAULT 'new_pm',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS onboarding_steps (
  id TEXT PRIMARY KEY,
  playbook_id TEXT NOT NULL,
  day_start INTEGER NOT NULL,
  day_end INTEGER NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  success_criteria TEXT,
  linked_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (playbook_id) REFERENCES onboarding_playbooks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS onboarding_step_progress (
  step_id TEXT PRIMARY KEY,
  completed_at TEXT,
  note TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (step_id) REFERENCES onboarding_steps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_playbook_order ON onboarding_steps(playbook_id, sort_order);

INSERT OR IGNORE INTO onboarding_playbooks (
  id,
  name,
  duration_days,
  persona
) VALUES (
  'pm-default-30-60-90',
  'PM 30/60/90 Playbook',
  90,
  'new_pm'
);

INSERT OR IGNORE INTO onboarding_steps (
  id, playbook_id, day_start, day_end, category, title, description, success_criteria, linked_path, sort_order
) VALUES
  ('step-30-01', 'pm-default-30-60-90', 0, 30, 'Learn', 'Study the product and Jira history', 'Review recent sprint dashboards, initiative history, and major Jira epics so you understand what has shipped and what is still in flight.', 'You can explain the current roadmap and recent delivery pattern without opening Jira.', '/tickets', 10),
  ('step-30-02', 'pm-default-30-60-90', 0, 30, 'People', 'Meet engineering, design, support, and sales leads', 'Build your initial stakeholder map by meeting the people who see product risk and customer pain most often.', 'You have a clear list of primary stakeholders and know what each expects from Product.', '/tasks', 20),
  ('step-30-03', 'pm-default-30-60-90', 0, 30, 'Context', 'Review objectives, outcomes, and KPI baselines', 'Understand how the team measures success and where KPI data is stale or missing.', 'You can name the top objectives and the KPIs used to judge progress.', '/strategy', 30),
  ('step-60-01', 'pm-default-30-60-90', 31, 60, 'Analysis', 'Identify delivery friction and recurring risks', 'Use workflow, bug, and risk views to spot blockers, carry-over patterns, and quality hotspots.', 'You have documented the biggest delivery bottlenecks and who needs to help fix them.', '/risks', 40),
  ('step-60-02', 'pm-default-30-60-90', 31, 60, 'Discovery', 'Synthesize customer and stakeholder pain points', 'Review decision history, support themes, and sales feedback to understand where user friction is highest.', 'You can state the top customer pain points in business language and tie them to delivery work.', '/decisions', 50),
  ('step-60-03', 'pm-default-30-60-90', 31, 60, 'Prioritization', 'Score current backlog themes with RICE', 'Use bounded RICE scoring on the most important initiatives and Jira work so prioritization is explicit and comparable.', 'The backlog has clear top priorities with written rationale.', '/prioritization', 60),
  ('step-90-01', 'pm-default-30-60-90', 61, 90, 'Strategy', 'Propose objective-aligned initiative changes', 'Use the strategy tree and risk data to propose what should be accelerated, paused, or reframed.', 'You have a concrete recommendation for leadership on what to change and why.', '/strategy', 70),
  ('step-90-02', 'pm-default-30-60-90', 61, 90, 'Communication', 'Generate stakeholder narratives and executive updates', 'Translate product work into crisp stakeholder-ready narratives using the narrative builder and decision log.', 'You can produce a roadmap narrative or executive brief without starting from a blank page.', '/narratives', 80),
  ('step-90-03', 'pm-default-30-60-90', 61, 90, 'Leadership', 'Run a recurring PM operating cadence', 'Establish a weekly operating loop for tasks, priorities, risks, decisions, and KPI review.', 'Your weekly PM review routine is documented and sustainable.', '/coach', 90);
