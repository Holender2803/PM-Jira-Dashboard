import getDb from '@/lib/db';
import { InitiativeInput, InitiativeRecord } from '@/types/pm-os';

interface InitiativeRow {
    id: string;
    title: string;
    summary: string | null;
    status: InitiativeRecord['status'];
    owner_name: string | null;
    theme: string | null;
    target_date: string | null;
    notes: string | null;
    linked_issue_keys: string;
    objective_id: string | null;
    objective_title: string | null;
    outcome_id: string | null;
    outcome_title: string | null;
    created_at: string;
    updated_at: string;
}

interface InitiativeFilters {
    status?: string | null;
    search?: string | null;
    owner?: string | null;
}

function parseStringArray(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((value): value is string => typeof value === 'string');
    } catch {
        return [];
    }
}

function mapRow(row: InitiativeRow): InitiativeRecord {
    return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        status: row.status,
        ownerName: row.owner_name,
        theme: row.theme,
        targetDate: row.target_date,
        notes: row.notes,
        linkedIssueKeys: parseStringArray(row.linked_issue_keys),
        objectiveId: row.objective_id,
        objectiveTitle: row.objective_title,
        outcomeId: row.outcome_id,
        outcomeTitle: row.outcome_title,
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

export function listInitiatives(filters: InitiativeFilters = {}): InitiativeRecord[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
        conditions.push('i.status = ?');
        params.push(filters.status);
    }
    if (filters.owner) {
        conditions.push('i.owner_name = ?');
        params.push(filters.owner);
    }
    if (filters.search) {
        conditions.push('(i.title LIKE ? OR i.summary LIKE ? OR i.theme LIKE ? OR o.title LIKE ? OR outc.title LIKE ?)');
        const search = `%${filters.search}%`;
        params.push(search, search, search, search, search);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT
        i.*,
        o.title AS objective_title,
        outc.title AS outcome_title
      FROM initiatives i
      LEFT JOIN objectives o ON o.id = i.objective_id
      LEFT JOIN outcomes outc ON outc.id = i.outcome_id
      ${where}
      ORDER BY
        CASE i.status
          WHEN 'in_progress' THEN 0
          WHEN 'planned' THEN 1
          WHEN 'discovery' THEN 2
          WHEN 'proposed' THEN 3
          WHEN 'launched' THEN 4
          WHEN 'done' THEN 5
          WHEN 'on_hold' THEN 6
          ELSE 7
        END,
        COALESCE(i.target_date, '9999-12-31') ASC,
        i.updated_at DESC
    `).all(...params) as InitiativeRow[];

    return rows.map(mapRow);
}

export function getInitiativeById(id: string): InitiativeRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        i.*,
        o.title AS objective_title,
        outc.title AS outcome_title
      FROM initiatives i
      LEFT JOIN objectives o ON o.id = i.objective_id
      LEFT JOIN outcomes outc ON outc.id = i.outcome_id
      WHERE i.id = ?
      LIMIT 1
    `).get(id) as InitiativeRow | undefined;

    return row ? mapRow(row) : null;
}

export function createInitiative(input: InitiativeInput): InitiativeRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO initiatives (
        id,
        title,
        summary,
        status,
        owner_name,
        theme,
        target_date,
        notes,
        linked_issue_keys,
        objective_id,
        outcome_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        input.title,
        input.summary,
        input.status,
        input.ownerName,
        input.theme,
        input.targetDate,
        input.notes,
        JSON.stringify(input.linkedIssueKeys),
        input.objectiveId,
        input.outcomeId,
        now,
        now
    );

    const created = getInitiativeById(id);
    if (!created) {
        throw new Error('Failed to create initiative.');
    }
    return created;
}

export function updateInitiative(id: string, input: Partial<InitiativeInput>): InitiativeRecord | null {
    const update = buildUpdate({
        title: input.title,
        summary: input.summary,
        status: input.status,
        owner_name: input.ownerName,
        theme: input.theme,
        target_date: input.targetDate,
        notes: input.notes,
        linked_issue_keys: input.linkedIssueKeys ? JSON.stringify(input.linkedIssueKeys) : undefined,
        objective_id: input.objectiveId,
        outcome_id: input.outcomeId,
        updated_at: new Date().toISOString(),
    });

    if (!update) {
        return getInitiativeById(id);
    }

    const db = getDb();
    const result = db.prepare(`
      UPDATE initiatives
      SET ${update.clause}
      WHERE id = ?
    `).run(...update.values, id);

    if (result.changes === 0) {
        return null;
    }

    return getInitiativeById(id);
}
