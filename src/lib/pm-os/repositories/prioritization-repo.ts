import getDb from '@/lib/db';
import { CLOSED_STATUSES } from '@/lib/workflow';
import { getDemoIssues } from '@/lib/demo-data';
import { queryIssues } from '@/lib/issue-store';
import { calculateRiceScore } from '@/lib/pm-os/rice';
import {
    InitiativeRecord,
    PrioritizationCandidate,
    PrioritizationInput,
    PrioritizationScoreRecord,
    PrioritizationScoreView,
} from '@/types/pm-os';
import { listInitiatives } from './initiatives-repo';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

interface ScoreRow {
    id: string;
    framework: 'RICE';
    target_type: 'jira_issue' | 'initiative';
    target_id: string;
    initiative_id: string | null;
    reach: number;
    impact: number;
    confidence: number;
    effort: number;
    score: number;
    rationale: string | null;
    created_at: string;
    updated_at: string;
    initiative_title: string | null;
}

interface ScoreFilters {
    targetType?: string | null;
    initiativeId?: string | null;
}

function mapRow(row: ScoreRow): PrioritizationScoreRecord {
    return {
        id: row.id,
        framework: row.framework,
        targetType: row.target_type,
        targetId: row.target_id,
        initiativeId: row.initiative_id,
        reach: row.reach,
        impact: row.impact,
        confidence: row.confidence,
        effort: row.effort,
        score: row.score,
        rationale: row.rationale,
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

function getJiraCandidates(): PrioritizationCandidate[] {
    const issues = DEMO_MODE ? getDemoIssues() : queryIssues();
    return issues
        .filter((issue) => ['Epic', 'Story', 'Feature'].includes(issue.issueType))
        .filter((issue) => !CLOSED_STATUSES.includes(issue.status))
        .map((issue) => ({
            targetType: 'jira_issue' as const,
            targetId: issue.key,
            title: issue.summary,
            summary: issue.epicSummary || issue.description,
            issueType: issue.issueType,
            status: issue.status,
            url: issue.url,
            initiativeId: null,
            initiativeTitle: null,
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
}

function getInitiativeCandidates(): PrioritizationCandidate[] {
    return listInitiatives()
        .filter((initiative) => !['done', 'archived'].includes(initiative.status))
        .map((initiative) => ({
            targetType: 'initiative' as const,
            targetId: initiative.id,
            title: initiative.title,
            summary: initiative.summary,
            issueType: null,
            status: initiative.status,
            url: null,
            initiativeId: initiative.id,
            initiativeTitle: initiative.title,
        }));
}

export function listPrioritizationCandidates(): PrioritizationCandidate[] {
    return [...getInitiativeCandidates(), ...getJiraCandidates()];
}

export function listPrioritizationScores(filters: ScoreFilters = {}): PrioritizationScoreRecord[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.targetType) {
        conditions.push('s.target_type = ?');
        params.push(filters.targetType);
    }
    if (filters.initiativeId) {
        conditions.push('s.initiative_id = ?');
        params.push(filters.initiativeId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT
        s.*,
        i.title AS initiative_title
      FROM prioritization_scores s
      LEFT JOIN initiatives i ON i.id = s.initiative_id
      ${where}
      ORDER BY s.score DESC, s.updated_at DESC
    `).all(...params) as ScoreRow[];

    return rows.map(mapRow);
}

export function getPrioritizationScoreById(id: string): PrioritizationScoreRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        s.*,
        i.title AS initiative_title
      FROM prioritization_scores s
      LEFT JOIN initiatives i ON i.id = s.initiative_id
      WHERE s.id = ?
      LIMIT 1
    `).get(id) as ScoreRow | undefined;
    return row ? mapRow(row) : null;
}

export function createPrioritizationScore(input: PrioritizationInput): PrioritizationScoreRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const score = calculateRiceScore(input);

    db.prepare(`
      INSERT INTO prioritization_scores (
        id,
        framework,
        target_type,
        target_id,
        initiative_id,
        reach,
        impact,
        confidence,
        effort,
        score,
        rationale,
        created_at,
        updated_at
      ) VALUES (?, 'RICE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        input.targetType,
        input.targetId,
        input.initiativeId,
        input.reach,
        input.impact,
        input.confidence,
        input.effort,
        score,
        input.rationale,
        now,
        now
    );

    const created = getPrioritizationScoreById(id);
    if (!created) throw new Error('Failed to create prioritization score.');
    return created;
}

export function updatePrioritizationScore(id: string, input: Partial<PrioritizationInput>): PrioritizationScoreRecord | null {
    const current = getPrioritizationScoreById(id);
    if (!current) return null;

    const nextValues = {
        targetType: input.targetType ?? current.targetType,
        targetId: input.targetId ?? current.targetId,
        initiativeId: input.initiativeId ?? current.initiativeId,
        reach: input.reach ?? current.reach,
        impact: input.impact ?? current.impact,
        confidence: input.confidence ?? current.confidence,
        effort: input.effort ?? current.effort,
        rationale: input.rationale ?? current.rationale,
    };

    const update = buildUpdate({
        target_type: nextValues.targetType,
        target_id: nextValues.targetId,
        initiative_id: nextValues.initiativeId,
        reach: nextValues.reach,
        impact: nextValues.impact,
        confidence: nextValues.confidence,
        effort: nextValues.effort,
        score: calculateRiceScore(nextValues),
        rationale: nextValues.rationale,
        updated_at: new Date().toISOString(),
    });

    if (!update) return current;

    const db = getDb();
    const result = db.prepare(`
      UPDATE prioritization_scores
      SET ${update.clause}
      WHERE id = ?
    `).run(...update.values, id);

    if (result.changes === 0) return null;
    return getPrioritizationScoreById(id);
}

export function listPrioritizationScoreViews(filters: ScoreFilters = {}): PrioritizationScoreView[] {
    const scores = listPrioritizationScores(filters);
    const candidates = listPrioritizationCandidates();
    const candidateById = new Map(candidates.map((candidate) => [`${candidate.targetType}:${candidate.targetId}`, candidate]));
    const initiativesById = new Map<string, InitiativeRecord>(listInitiatives().map((initiative) => [initiative.id, initiative]));

    return scores.map((score) => {
        const candidate = candidateById.get(`${score.targetType}:${score.targetId}`);
        const initiative = score.initiativeId ? initiativesById.get(score.initiativeId) : null;
        return {
            ...score,
            targetTitle: candidate?.title || score.targetId,
            targetSummary: candidate?.summary || null,
            targetStatus: candidate?.status || null,
            targetIssueType: candidate?.issueType || null,
            targetUrl: candidate?.url || null,
            initiativeTitle: initiative?.title || candidate?.initiativeTitle || null,
        };
    });
}
