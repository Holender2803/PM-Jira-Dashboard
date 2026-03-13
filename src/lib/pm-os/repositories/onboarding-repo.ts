import getDb from '@/lib/db';
import {
    OnboardingPlaybookRecord,
    OnboardingPlaybookView,
    OnboardingStepRecord,
} from '@/types/pm-os';

interface PlaybookRow {
    id: string;
    name: string;
    duration_days: number;
    persona: string;
    created_at: string;
    updated_at: string;
}

interface StepRow {
    id: string;
    playbook_id: string;
    day_start: number;
    day_end: number;
    category: string;
    title: string;
    description: string;
    success_criteria: string | null;
    linked_path: string | null;
    sort_order: number;
    completed_at: string | null;
}

function mapPlaybookRow(row: PlaybookRow): OnboardingPlaybookRecord {
    return {
        id: row.id,
        name: row.name,
        durationDays: row.duration_days,
        persona: row.persona,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapStepRow(row: StepRow): OnboardingStepRecord {
    return {
        id: row.id,
        playbookId: row.playbook_id,
        dayStart: row.day_start,
        dayEnd: row.day_end,
        category: row.category,
        title: row.title,
        description: row.description,
        successCriteria: row.success_criteria,
        linkedPath: row.linked_path,
        sortOrder: row.sort_order,
        completedAt: row.completed_at,
    };
}

export function getOnboardingPlaybook(id = 'pm-default-30-60-90'): OnboardingPlaybookView | null {
    const db = getDb();
    const playbookRow = db.prepare(`
      SELECT *
      FROM onboarding_playbooks
      WHERE id = ?
      LIMIT 1
    `).get(id) as PlaybookRow | undefined;

    if (!playbookRow) return null;

    const stepRows = db.prepare(`
      SELECT
        s.*,
        p.completed_at
      FROM onboarding_steps s
      LEFT JOIN onboarding_step_progress p ON p.step_id = s.id
      WHERE s.playbook_id = ?
      ORDER BY s.sort_order ASC, s.day_start ASC, s.title ASC
    `).all(id) as StepRow[];

    const steps = stepRows.map(mapStepRow);
    return {
        ...mapPlaybookRow(playbookRow),
        steps,
        completedCount: steps.filter((step) => Boolean(step.completedAt)).length,
        totalCount: steps.length,
    };
}

export function setOnboardingStepCompletion(stepId: string, completed: boolean, note: string | null = null): OnboardingStepRecord | null {
    const db = getDb();
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
        db.prepare(`
          INSERT INTO onboarding_step_progress (step_id, completed_at, note, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(step_id) DO UPDATE SET
            completed_at = excluded.completed_at,
            note = excluded.note,
            updated_at = excluded.updated_at
        `).run(
            stepId,
            completed ? now : null,
            note,
            now
        );
    });

    transaction();

    const row = db.prepare(`
      SELECT
        s.*,
        p.completed_at
      FROM onboarding_steps s
      LEFT JOIN onboarding_step_progress p ON p.step_id = s.id
      WHERE s.id = ?
      LIMIT 1
    `).get(stepId) as StepRow | undefined;

    return row ? mapStepRow(row) : null;
}
