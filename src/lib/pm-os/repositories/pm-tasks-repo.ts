import getDb from '@/lib/db';
import { PmTaskInput, PmTaskRecord } from '@/types/pm-os';

interface TaskRow {
    id: string;
    title: string;
    category: PmTaskRecord['category'];
    status: PmTaskRecord['status'];
    owner_name: string | null;
    due_date: string | null;
    initiative_id: string | null;
    initiative_title: string | null;
    meeting_participants: string;
    notes: string | null;
    linked_issue_keys: string;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

interface TaskFilters {
    status?: string | null;
    category?: string | null;
    initiativeId?: string | null;
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

function mapRow(row: TaskRow): PmTaskRecord {
    return {
        id: row.id,
        title: row.title,
        category: row.category,
        status: row.status,
        ownerName: row.owner_name,
        dueDate: row.due_date,
        initiativeId: row.initiative_id,
        initiativeTitle: row.initiative_title,
        meetingParticipants: parseStringArray(row.meeting_participants),
        notes: row.notes,
        linkedIssueKeys: parseStringArray(row.linked_issue_keys),
        completedAt: row.completed_at,
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

export function listPmTasks(filters: TaskFilters = {}): PmTaskRecord[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
        conditions.push('t.status = ?');
        params.push(filters.status);
    }
    if (filters.category) {
        conditions.push('t.category = ?');
        params.push(filters.category);
    }
    if (filters.initiativeId) {
        conditions.push('t.initiative_id = ?');
        params.push(filters.initiativeId);
    }
    if (filters.owner) {
        conditions.push('t.owner_name = ?');
        params.push(filters.owner);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT
        t.*,
        i.title AS initiative_title
      FROM pm_tasks t
      LEFT JOIN initiatives i ON i.id = t.initiative_id
      ${where}
      ORDER BY
        CASE t.status
          WHEN 'todo' THEN 0
          WHEN 'in_progress' THEN 1
          WHEN 'done' THEN 2
          ELSE 3
        END,
        COALESCE(t.due_date, '9999-12-31') ASC,
        t.updated_at DESC
    `).all(...params) as TaskRow[];

    return rows.map(mapRow);
}

export function getPmTaskById(id: string): PmTaskRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        t.*,
        i.title AS initiative_title
      FROM pm_tasks t
      LEFT JOIN initiatives i ON i.id = t.initiative_id
      WHERE t.id = ?
      LIMIT 1
    `).get(id) as TaskRow | undefined;

    return row ? mapRow(row) : null;
}

export function createPmTask(input: PmTaskInput): PmTaskRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO pm_tasks (
        id,
        title,
        category,
        status,
        owner_name,
        due_date,
        initiative_id,
        meeting_participants,
        notes,
        linked_issue_keys,
        completed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        input.title,
        input.category,
        input.status,
        input.ownerName,
        input.dueDate,
        input.initiativeId,
        JSON.stringify(input.meetingParticipants),
        input.notes,
        JSON.stringify(input.linkedIssueKeys),
        input.status === 'done' ? now : null,
        now,
        now
    );

    const created = getPmTaskById(id);
    if (!created) throw new Error('Failed to create PM task.');
    return created;
}

export function updatePmTask(id: string, input: Partial<PmTaskInput>): PmTaskRecord | null {
    let completedAt: string | null | undefined;
    if (input.status === 'done') {
        completedAt = new Date().toISOString();
    } else if (input.status) {
        completedAt = null;
    }

    const update = buildUpdate({
        title: input.title,
        category: input.category,
        status: input.status,
        owner_name: input.ownerName,
        due_date: input.dueDate,
        initiative_id: input.initiativeId,
        meeting_participants: input.meetingParticipants ? JSON.stringify(input.meetingParticipants) : undefined,
        notes: input.notes,
        linked_issue_keys: input.linkedIssueKeys ? JSON.stringify(input.linkedIssueKeys) : undefined,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
    });

    if (!update) return getPmTaskById(id);

    const db = getDb();
    const result = db.prepare(`
      UPDATE pm_tasks
      SET ${update.clause}
      WHERE id = ?
    `).run(...update.values, id);

    if (result.changes === 0) return null;
    return getPmTaskById(id);
}
