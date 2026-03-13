import getDb from '@/lib/db';
import { ObjectiveInput, ObjectiveRecord } from '@/types/pm-os';

interface ObjectiveRow {
    id: string;
    title: string;
    description: string | null;
    status: ObjectiveRecord['status'];
    owner_name: string | null;
    start_date: string | null;
    target_date: string | null;
    created_at: string;
    updated_at: string;
}

interface ObjectiveFilters {
    status?: string | null;
    search?: string | null;
}

function mapRow(row: ObjectiveRow): ObjectiveRecord {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        ownerName: row.owner_name,
        startDate: row.start_date,
        targetDate: row.target_date,
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

export function listObjectives(filters: ObjectiveFilters = {}): ObjectiveRecord[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
    }
    if (filters.search) {
        conditions.push('(title LIKE ? OR description LIKE ?)');
        const search = `%${filters.search}%`;
        params.push(search, search);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT *
      FROM objectives
      ${where}
      ORDER BY
        CASE status
          WHEN 'active' THEN 0
          WHEN 'at_risk' THEN 1
          WHEN 'draft' THEN 2
          WHEN 'done' THEN 3
          ELSE 4
        END,
        COALESCE(target_date, '9999-12-31') ASC,
        updated_at DESC
    `).all(...params) as ObjectiveRow[];
    return rows.map(mapRow);
}

export function getObjectiveById(id: string): ObjectiveRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT *
      FROM objectives
      WHERE id = ?
      LIMIT 1
    `).get(id) as ObjectiveRow | undefined;
    return row ? mapRow(row) : null;
}

export function createObjective(input: ObjectiveInput): ObjectiveRecord {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO objectives (
        id, title, description, status, owner_name, start_date, target_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        input.title,
        input.description,
        input.status,
        input.ownerName,
        input.startDate,
        input.targetDate,
        now,
        now
    );
    const created = getObjectiveById(id);
    if (!created) throw new Error('Failed to create objective.');
    return created;
}

export function updateObjective(id: string, input: Partial<ObjectiveInput>): ObjectiveRecord | null {
    const update = buildUpdate({
        title: input.title,
        description: input.description,
        status: input.status,
        owner_name: input.ownerName,
        start_date: input.startDate,
        target_date: input.targetDate,
        updated_at: new Date().toISOString(),
    });
    if (!update) return getObjectiveById(id);
    const db = getDb();
    const result = db.prepare(`
      UPDATE objectives
      SET ${update.clause}
      WHERE id = ?
    `).run(...update.values, id);
    if (result.changes === 0) return null;
    return getObjectiveById(id);
}
