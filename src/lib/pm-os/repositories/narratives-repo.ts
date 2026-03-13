import getDb from '@/lib/db';
import { NarrativeRecord } from '@/types/pm-os';

interface NarrativeRow {
    id: string;
    type: NarrativeRecord['type'];
    audience: NarrativeRecord['audience'] | null;
    title: string | null;
    generated_at: string;
    summary: string;
    content: string;
    issue_keys: string | null;
    source_entities_json: string | null;
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

function parseSourceEntities(raw: string | null | undefined) {
    if (!raw) {
        return {
            initiativeIds: [] as string[],
            objectiveIds: [] as string[],
            decisionIds: [] as string[],
            includeRisks: false,
            includeTasks: false,
        };
    }

    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return {
            initiativeIds: parseStringArray(JSON.stringify(parsed.initiativeIds || [])),
            objectiveIds: parseStringArray(JSON.stringify(parsed.objectiveIds || [])),
            decisionIds: parseStringArray(JSON.stringify(parsed.decisionIds || [])),
            includeRisks: Boolean(parsed.includeRisks),
            includeTasks: Boolean(parsed.includeTasks),
        };
    } catch {
        return {
            initiativeIds: [] as string[],
            objectiveIds: [] as string[],
            decisionIds: [] as string[],
            includeRisks: false,
            includeTasks: false,
        };
    }
}

function mapRow(row: NarrativeRow): NarrativeRecord {
    const sourceEntities = parseSourceEntities(row.source_entities_json);
    return {
        id: row.id,
        type: row.type,
        audience: row.audience || 'pm_internal',
        title: row.title || row.summary,
        generatedAt: row.generated_at,
        summary: row.summary,
        content: row.content,
        issueKeys: parseStringArray(row.issue_keys),
        initiativeIds: sourceEntities.initiativeIds,
        objectiveIds: sourceEntities.objectiveIds,
        decisionIds: sourceEntities.decisionIds,
        includeRisks: sourceEntities.includeRisks,
        includeTasks: sourceEntities.includeTasks,
    };
}

export function listNarratives(limit = 20): NarrativeRecord[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        id,
        type,
        audience,
        title,
        generated_at,
        summary,
        content,
        issue_keys,
        source_entities_json
      FROM ai_reports
      WHERE report_family = 'narrative'
      ORDER BY generated_at DESC
      LIMIT ?
    `).all(limit) as NarrativeRow[];

    return rows.map(mapRow);
}

export function saveNarrative(report: NarrativeRecord, customInstructions: string | null = null): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO ai_reports (
        id,
        type,
        tone,
        generated_at,
        summary,
        content,
        issue_keys,
        sprint_name,
        report_family,
        audience,
        title,
        source_entities_json,
        custom_instructions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'narrative', ?, ?, ?, ?)
    `).run(
        report.id,
        report.type,
        report.audience,
        report.generatedAt,
        report.summary,
        report.content,
        JSON.stringify(report.issueKeys),
        null,
        report.audience,
        report.title,
        JSON.stringify({
            initiativeIds: report.initiativeIds,
            objectiveIds: report.objectiveIds,
            decisionIds: report.decisionIds,
            includeRisks: report.includeRisks,
            includeTasks: report.includeTasks,
        }),
        customInstructions
    );
}
