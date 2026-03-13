import getDb from '@/lib/db';
import { OutcomeInput, OutcomeRecord } from '@/types/pm-os';

interface OutcomeRow {
    id: string;
    objective_id: string;
    objective_title: string | null;
    title: string;
    description: string | null;
    baseline_text: string | null;
    target_text: string | null;
    status: OutcomeRecord['status'];
    created_at: string;
    updated_at: string;
}

interface OutcomeFilters {
    objectiveId?: string | null;
}

function mapRow(row: OutcomeRow): OutcomeRecord {
    return {
        id: row.id,
        objectiveId: row.objective_id,
        objectiveTitle: row.objective_title,
        title: row.title,
        description: row.description,
        baselineText: row.baseline_text,
        targetText: row.target_text,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function buildUpdate(fields: Record<string, unknown>) {
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return null;
    return {
        clause: entries.map(([column]) => `${column} = ?`).join(', '),
        values: entries.map(([, value]) => value),
    };
}

export function listOutcomes(filters: OutcomeFilters = {}): OutcomeRecord[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.objectiveId) {
        conditions.push('o.objective_id = ?');
        params.push(filters.objectiveId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT
        o.*,
        ob.title AS objective_title
      FROM outcomes o
      LEFT JOIN objectives ob ON ob.id = o.objective_id
      ${where}
      ORDER BY o.updated_at DESC
    `).all(...params) as OutcomeRow[];
    return rows.map(mapRow);
}

export function getOutcomeById(id: string): OutcomeRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        o.*,
        ob.title AS objective_title
      FROM outcomes o
      LEFT JOIN objectives ob ON ob.id = o.objective_id
      WHERE o.id = ?
      LIMIT 1
    `).get(id) as OutcomeRow | undefined;
    return row ? mapRow(row) : null;
}

export function createOutcome(input: OutcomeInput): OutcomeRecord {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO outcomes (
        id, objective_id, title, description, baseline_text, target_text, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        input.objectiveId,
        input.title,
        input.description,
        input.baselineText,
        input.targetText,
        input.status,
        now,
        now
    );
    const created = getOutcomeById(id);
    if (!created) throw new Error('Failed to create outcome.');
    return created;
}

export function updateOutcome(id: string, input: Partial<OutcomeInput>): OutcomeRecord | null {
    const update = buildUpdate({
        objective_id: input.objectiveId,
        title: input.title,
        description: input.description,
        baseline_text: input.baselineText,
        target_text: input.targetText,
        status: input.status,
        updated_at: new Date().toISOString(),
    });
    if (!update) return getOutcomeById(id);
    const db = getDb();
    const result = db.prepare(`
      UPDATE outcomes
      SET ${update.clause}
      WHERE id = ?
    `).run(...update.values, id);
    if (result.changes === 0) return null;
    return getOutcomeById(id);
}
