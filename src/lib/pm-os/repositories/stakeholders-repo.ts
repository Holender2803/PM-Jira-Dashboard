import getDb from '@/lib/db';
import {
    StakeholderInput,
    StakeholderInteractionInput,
    StakeholderInteractionRecord,
    StakeholderRecord,
} from '@/types/pm-os';

interface StakeholderRow {
    id: string;
    name: string;
    role: string | null;
    organization: string | null;
    relationship_type: StakeholderRecord['relationshipType'];
    linked_initiative_ids: string;
    notes: string | null;
    interaction_count: number;
    latest_interaction_at: string | null;
    created_at: string;
    updated_at: string;
}

interface StakeholderInteractionRow {
    id: string;
    stakeholder_id: string;
    stakeholder_name: string | null;
    interaction_date: string;
    title: string;
    notes: string | null;
    initiative_id: string | null;
    initiative_title: string | null;
    linked_issue_keys: string;
    created_at: string;
    updated_at: string;
}

interface StakeholderFilters {
    relationshipType?: string | null;
    search?: string | null;
    organization?: string | null;
}

interface StakeholderInteractionFilters {
    stakeholderId?: string | null;
    initiativeId?: string | null;
    search?: string | null;
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

function buildUpdate(fields: Record<string, unknown>) {
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return null;
    return {
        clause: entries.map(([column]) => `${column} = ?`).join(', '),
        values: entries.map(([, value]) => value),
    };
}

function mapStakeholderRow(row: StakeholderRow): StakeholderRecord {
    return {
        id: row.id,
        name: row.name,
        role: row.role,
        organization: row.organization,
        relationshipType: row.relationship_type,
        linkedInitiativeIds: parseStringArray(row.linked_initiative_ids),
        notes: row.notes,
        interactionCount: row.interaction_count || 0,
        latestInteractionAt: row.latest_interaction_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapInteractionRow(row: StakeholderInteractionRow): StakeholderInteractionRecord {
    return {
        id: row.id,
        stakeholderId: row.stakeholder_id,
        stakeholderName: row.stakeholder_name,
        interactionDate: row.interaction_date,
        title: row.title,
        notes: row.notes,
        initiativeId: row.initiative_id,
        initiativeTitle: row.initiative_title,
        linkedIssueKeys: parseStringArray(row.linked_issue_keys),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function listStakeholders(filters: StakeholderFilters = {}): StakeholderRecord[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.relationshipType) {
        conditions.push('s.relationship_type = ?');
        params.push(filters.relationshipType);
    }
    if (filters.organization) {
        conditions.push('s.organization = ?');
        params.push(filters.organization);
    }
    if (filters.search) {
        conditions.push('(s.name LIKE ? OR s.role LIKE ? OR s.organization LIKE ? OR s.notes LIKE ?)');
        const search = `%${filters.search}%`;
        params.push(search, search, search, search);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT
        s.*,
        COUNT(i.id) AS interaction_count,
        MAX(i.interaction_date) AS latest_interaction_at
      FROM stakeholders s
      LEFT JOIN stakeholder_interactions i ON i.stakeholder_id = s.id
      ${where}
      GROUP BY s.id
      ORDER BY
        CASE s.relationship_type
          WHEN 'client' THEN 0
          WHEN 'sales' THEN 1
          WHEN 'executive' THEN 2
          WHEN 'engineering' THEN 3
          WHEN 'design' THEN 4
          WHEN 'support' THEN 5
          WHEN 'partner' THEN 6
          WHEN 'compliance' THEN 7
          ELSE 8
        END,
        COALESCE(MAX(i.interaction_date), s.updated_at) DESC,
        s.name ASC
    `).all(...params) as StakeholderRow[];

    return rows.map(mapStakeholderRow);
}

export function getStakeholderById(id: string): StakeholderRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        s.*,
        COUNT(i.id) AS interaction_count,
        MAX(i.interaction_date) AS latest_interaction_at
      FROM stakeholders s
      LEFT JOIN stakeholder_interactions i ON i.stakeholder_id = s.id
      WHERE s.id = ?
      GROUP BY s.id
      LIMIT 1
    `).get(id) as StakeholderRow | undefined;

    return row ? mapStakeholderRow(row) : null;
}

export function createStakeholder(input: StakeholderInput): StakeholderRecord {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO stakeholders (
        id,
        name,
        role,
        organization,
        relationship_type,
        linked_initiative_ids,
        notes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        input.name,
        input.role,
        input.organization,
        input.relationshipType,
        JSON.stringify(input.linkedInitiativeIds),
        input.notes,
        now,
        now
    );

    const created = getStakeholderById(id);
    if (!created) throw new Error('Failed to create stakeholder.');
    return created;
}

export function updateStakeholder(id: string, input: Partial<StakeholderInput>): StakeholderRecord | null {
    const update = buildUpdate({
        name: input.name,
        role: input.role,
        organization: input.organization,
        relationship_type: input.relationshipType,
        linked_initiative_ids: input.linkedInitiativeIds ? JSON.stringify(input.linkedInitiativeIds) : undefined,
        notes: input.notes,
        updated_at: new Date().toISOString(),
    });

    if (!update) {
        return getStakeholderById(id);
    }

    const db = getDb();
    const result = db.prepare(`
      UPDATE stakeholders
      SET ${update.clause}
      WHERE id = ?
    `).run(...update.values, id);

    if (result.changes === 0) return null;
    return getStakeholderById(id);
}

export function deleteStakeholder(id: string): boolean {
    const db = getDb();
    const result = db.prepare(`
      DELETE FROM stakeholders
      WHERE id = ?
    `).run(id);

    return result.changes > 0;
}

export function listStakeholderInteractions(filters: StakeholderInteractionFilters = {}): StakeholderInteractionRecord[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.stakeholderId) {
        conditions.push('i.stakeholder_id = ?');
        params.push(filters.stakeholderId);
    }
    if (filters.initiativeId) {
        conditions.push('i.initiative_id = ?');
        params.push(filters.initiativeId);
    }
    if (filters.search) {
        conditions.push('(i.title LIKE ? OR i.notes LIKE ? OR s.name LIKE ?)');
        const search = `%${filters.search}%`;
        params.push(search, search, search);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT
        i.*,
        s.name AS stakeholder_name,
        init.title AS initiative_title
      FROM stakeholder_interactions i
      LEFT JOIN stakeholders s ON s.id = i.stakeholder_id
      LEFT JOIN initiatives init ON init.id = i.initiative_id
      ${where}
      ORDER BY i.interaction_date DESC, i.updated_at DESC
    `).all(...params) as StakeholderInteractionRow[];

    return rows.map(mapInteractionRow);
}

export function getStakeholderInteractionById(id: string): StakeholderInteractionRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        i.*,
        s.name AS stakeholder_name,
        init.title AS initiative_title
      FROM stakeholder_interactions i
      LEFT JOIN stakeholders s ON s.id = i.stakeholder_id
      LEFT JOIN initiatives init ON init.id = i.initiative_id
      WHERE i.id = ?
      LIMIT 1
    `).get(id) as StakeholderInteractionRow | undefined;

    return row ? mapInteractionRow(row) : null;
}

export function createStakeholderInteraction(input: StakeholderInteractionInput): StakeholderInteractionRecord {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO stakeholder_interactions (
        id,
        stakeholder_id,
        interaction_date,
        title,
        notes,
        initiative_id,
        linked_issue_keys,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        input.stakeholderId,
        input.interactionDate,
        input.title,
        input.notes,
        input.initiativeId,
        JSON.stringify(input.linkedIssueKeys),
        now,
        now
    );

    const created = getStakeholderInteractionById(id);
    if (!created) throw new Error('Failed to create stakeholder interaction.');
    return created;
}

export function updateStakeholderInteraction(id: string, input: Partial<StakeholderInteractionInput>): StakeholderInteractionRecord | null {
    const update = buildUpdate({
        stakeholder_id: input.stakeholderId,
        interaction_date: input.interactionDate,
        title: input.title,
        notes: input.notes,
        initiative_id: input.initiativeId,
        linked_issue_keys: input.linkedIssueKeys ? JSON.stringify(input.linkedIssueKeys) : undefined,
        updated_at: new Date().toISOString(),
    });

    if (!update) {
        return getStakeholderInteractionById(id);
    }

    const db = getDb();
    const result = db.prepare(`
      UPDATE stakeholder_interactions
      SET ${update.clause}
      WHERE id = ?
    `).run(...update.values, id);

    if (result.changes === 0) return null;
    return getStakeholderInteractionById(id);
}
