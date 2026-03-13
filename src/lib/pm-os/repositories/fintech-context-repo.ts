import getDb from '@/lib/db';
import { FintechContextItemInput, FintechContextItemRecord } from '@/types/pm-os';

interface FintechContextRow {
    id: string;
    context_type: FintechContextItemRecord['contextType'];
    name: string;
    description: string | null;
    system_name: string | null;
    source_of_truth: string | null;
    manual_step_flag: number;
    reconciliation_risk_flag: number;
    compliance_note: string | null;
    owner_stakeholder_id: string | null;
    owner_stakeholder_name: string | null;
    linked_initiative_id: string | null;
    linked_initiative_title: string | null;
    created_at: string;
    updated_at: string;
}

interface FintechContextFilters {
    contextType?: string | null;
    search?: string | null;
    manualOnly?: boolean;
    reconciliationOnly?: boolean;
}

function buildUpdate(fields: Record<string, unknown>) {
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return null;
    return {
        clause: entries.map(([column]) => `${column} = ?`).join(', '),
        values: entries.map(([, value]) => value),
    };
}

function mapRow(row: FintechContextRow): FintechContextItemRecord {
    return {
        id: row.id,
        contextType: row.context_type,
        name: row.name,
        description: row.description,
        systemName: row.system_name,
        sourceOfTruth: row.source_of_truth,
        manualStepFlag: row.manual_step_flag === 1,
        reconciliationRiskFlag: row.reconciliation_risk_flag === 1,
        complianceNote: row.compliance_note,
        ownerStakeholderId: row.owner_stakeholder_id,
        ownerStakeholderName: row.owner_stakeholder_name,
        linkedInitiativeId: row.linked_initiative_id,
        linkedInitiativeTitle: row.linked_initiative_title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function listFintechContextItems(filters: FintechContextFilters = {}): FintechContextItemRecord[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.contextType) {
        conditions.push('f.context_type = ?');
        params.push(filters.contextType);
    }
    if (filters.manualOnly) {
        conditions.push('f.manual_step_flag = 1');
    }
    if (filters.reconciliationOnly) {
        conditions.push('f.reconciliation_risk_flag = 1');
    }
    if (filters.search) {
        conditions.push('(f.name LIKE ? OR f.description LIKE ? OR f.system_name LIKE ? OR f.source_of_truth LIKE ? OR f.compliance_note LIKE ?)');
        const search = `%${filters.search}%`;
        params.push(search, search, search, search, search);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT
        f.*,
        s.name AS owner_stakeholder_name,
        i.title AS linked_initiative_title
      FROM fintech_context_items f
      LEFT JOIN stakeholders s ON s.id = f.owner_stakeholder_id
      LEFT JOIN initiatives i ON i.id = f.linked_initiative_id
      ${where}
      ORDER BY
        f.reconciliation_risk_flag DESC,
        f.manual_step_flag DESC,
        f.updated_at DESC
    `).all(...params) as FintechContextRow[];

    return rows.map(mapRow);
}

export function getFintechContextItemById(id: string): FintechContextItemRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        f.*,
        s.name AS owner_stakeholder_name,
        i.title AS linked_initiative_title
      FROM fintech_context_items f
      LEFT JOIN stakeholders s ON s.id = f.owner_stakeholder_id
      LEFT JOIN initiatives i ON i.id = f.linked_initiative_id
      WHERE f.id = ?
      LIMIT 1
    `).get(id) as FintechContextRow | undefined;

    return row ? mapRow(row) : null;
}

export function createFintechContextItem(input: FintechContextItemInput): FintechContextItemRecord {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO fintech_context_items (
        id,
        context_type,
        name,
        description,
        system_name,
        source_of_truth,
        manual_step_flag,
        reconciliation_risk_flag,
        compliance_note,
        owner_stakeholder_id,
        linked_initiative_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        input.contextType,
        input.name,
        input.description,
        input.systemName,
        input.sourceOfTruth,
        input.manualStepFlag ? 1 : 0,
        input.reconciliationRiskFlag ? 1 : 0,
        input.complianceNote,
        input.ownerStakeholderId,
        input.linkedInitiativeId,
        now,
        now
    );

    const created = getFintechContextItemById(id);
    if (!created) throw new Error('Failed to create fintech context item.');
    return created;
}

export function updateFintechContextItem(id: string, input: Partial<FintechContextItemInput>): FintechContextItemRecord | null {
    const update = buildUpdate({
        context_type: input.contextType,
        name: input.name,
        description: input.description,
        system_name: input.systemName,
        source_of_truth: input.sourceOfTruth,
        manual_step_flag: input.manualStepFlag === undefined ? undefined : (input.manualStepFlag ? 1 : 0),
        reconciliation_risk_flag: input.reconciliationRiskFlag === undefined ? undefined : (input.reconciliationRiskFlag ? 1 : 0),
        compliance_note: input.complianceNote,
        owner_stakeholder_id: input.ownerStakeholderId,
        linked_initiative_id: input.linkedInitiativeId,
        updated_at: new Date().toISOString(),
    });

    if (!update) {
        return getFintechContextItemById(id);
    }

    const db = getDb();
    const result = db.prepare(`
      UPDATE fintech_context_items
      SET ${update.clause}
      WHERE id = ?
    `).run(...update.values, id);

    if (result.changes === 0) return null;
    return getFintechContextItemById(id);
}
