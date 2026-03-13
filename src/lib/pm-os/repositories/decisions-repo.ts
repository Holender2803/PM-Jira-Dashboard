import getDb from '@/lib/db';
import { DecisionInput, DecisionOptionRecord, DecisionRecord, DecisionWithOptions } from '@/types/pm-os';

interface DecisionRow {
    id: string;
    title: string;
    problem_context: string;
    final_decision: string | null;
    expected_outcome: string | null;
    owner_name: string | null;
    decision_date: string;
    status: DecisionRecord['status'];
    primary_initiative_id: string | null;
    linked_initiative_ids: string;
    linked_issue_keys: string;
    created_at: string;
    updated_at: string;
    primary_initiative_title: string | null;
}

interface DecisionOptionRow {
    id: string;
    decision_id: string;
    option_title: string;
    pros: string | null;
    cons: string | null;
    sort_order: number;
    is_selected: number;
    created_at: string;
    updated_at: string;
}

interface DecisionFilters {
    status?: string | null;
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

function mapDecisionRow(row: DecisionRow): DecisionRecord {
    return {
        id: row.id,
        title: row.title,
        problemContext: row.problem_context,
        finalDecision: row.final_decision,
        expectedOutcome: row.expected_outcome,
        ownerName: row.owner_name,
        decisionDate: row.decision_date,
        status: row.status,
        primaryInitiativeId: row.primary_initiative_id,
        primaryInitiativeTitle: row.primary_initiative_title,
        linkedInitiativeIds: parseStringArray(row.linked_initiative_ids),
        linkedIssueKeys: parseStringArray(row.linked_issue_keys),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapOptionRow(row: DecisionOptionRow): DecisionOptionRecord {
    return {
        id: row.id,
        decisionId: row.decision_id,
        optionTitle: row.option_title,
        pros: row.pros,
        cons: row.cons,
        sortOrder: row.sort_order,
        isSelected: row.is_selected === 1,
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

function writeDecisionOptions(decisionId: string, options: DecisionInput['options']) {
    const db = getDb();
    const deleteExisting = db.prepare(`
      DELETE FROM decision_options
      WHERE decision_id = ?
    `);
    const insert = db.prepare(`
      INSERT INTO decision_options (
        id,
        decision_id,
        option_title,
        pros,
        cons,
        sort_order,
        is_selected,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();

    deleteExisting.run(decisionId);
    options.forEach((option, index) => {
        insert.run(
            crypto.randomUUID(),
            decisionId,
            option.optionTitle,
            option.pros,
            option.cons,
            option.sortOrder ?? index,
            option.isSelected ? 1 : 0,
            now,
            now
        );
    });
}

export function listDecisions(filters: DecisionFilters = {}): DecisionRecord[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
        conditions.push('d.status = ?');
        params.push(filters.status);
    }
    if (filters.initiativeId) {
        conditions.push('(d.primary_initiative_id = ? OR d.linked_initiative_ids LIKE ?)');
        params.push(filters.initiativeId, `%${filters.initiativeId}%`);
    }
    if (filters.search) {
        conditions.push('(d.title LIKE ? OR d.problem_context LIKE ? OR d.final_decision LIKE ?)');
        const search = `%${filters.search}%`;
        params.push(search, search, search);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT
        d.*,
        i.title AS primary_initiative_title
      FROM decisions d
      LEFT JOIN initiatives i ON i.id = d.primary_initiative_id
      ${where}
      ORDER BY d.decision_date DESC, d.updated_at DESC
    `).all(...params) as DecisionRow[];

    return rows.map(mapDecisionRow);
}

export function getDecisionById(id: string): DecisionWithOptions | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        d.*,
        i.title AS primary_initiative_title
      FROM decisions d
      LEFT JOIN initiatives i ON i.id = d.primary_initiative_id
      WHERE d.id = ?
      LIMIT 1
    `).get(id) as DecisionRow | undefined;

    if (!row) return null;

    const options = db.prepare(`
      SELECT *
      FROM decision_options
      WHERE decision_id = ?
      ORDER BY sort_order ASC, created_at ASC
    `).all(id) as DecisionOptionRow[];

    return {
        ...mapDecisionRow(row),
        options: options.map(mapOptionRow),
    };
}

export function createDecision(input: DecisionInput): DecisionWithOptions {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const transaction = db.transaction(() => {
        db.prepare(`
          INSERT INTO decisions (
            id,
            title,
            problem_context,
            final_decision,
            expected_outcome,
            owner_name,
            decision_date,
            status,
            primary_initiative_id,
            linked_initiative_ids,
            linked_issue_keys,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            input.title,
            input.problemContext,
            input.finalDecision,
            input.expectedOutcome,
            input.ownerName,
            input.decisionDate,
            input.status,
            input.primaryInitiativeId,
            JSON.stringify(input.linkedInitiativeIds),
            JSON.stringify(input.linkedIssueKeys),
            now,
            now
        );

        writeDecisionOptions(id, input.options);
    });

    transaction();

    const created = getDecisionById(id);
    if (!created) throw new Error('Failed to create decision.');
    return created;
}

export function updateDecision(id: string, input: Partial<DecisionInput>): DecisionWithOptions | null {
    const existing = getDecisionById(id);
    if (!existing) return null;

    const update = buildUpdate({
        title: input.title,
        problem_context: input.problemContext,
        final_decision: input.finalDecision,
        expected_outcome: input.expectedOutcome,
        owner_name: input.ownerName,
        decision_date: input.decisionDate,
        status: input.status,
        primary_initiative_id: input.primaryInitiativeId,
        linked_initiative_ids: input.linkedInitiativeIds ? JSON.stringify(input.linkedInitiativeIds) : undefined,
        linked_issue_keys: input.linkedIssueKeys ? JSON.stringify(input.linkedIssueKeys) : undefined,
        updated_at: new Date().toISOString(),
    });

    const db = getDb();
    const transaction = db.transaction(() => {
        if (update) {
            db.prepare(`
              UPDATE decisions
              SET ${update.clause}
              WHERE id = ?
            `).run(...update.values, id);
        }

        if (input.options) {
            writeDecisionOptions(id, input.options);
        }
    });

    transaction();
    return getDecisionById(id);
}
