import { extractDescriptionText } from '@/lib/issue-format';
import { getGroupForStatus } from '@/lib/statusGroups';
import { DocGrade, DocScore, JiraIssue } from '@/types';

const ACTION_VERB_PATTERN = /\b(fix(?:ed|es|ing)?|add(?:ed|s|ing)?|remove(?:d|s|ing)?|update(?:d|s|ing)?|refactor(?:ed|s|ing)?|implement(?:ed|s|ing)?|improv(?:e|ed|es|ing)|migrate(?:d|s|ing)?|optimi[sz](?:e|ed|es|ing)|prevent(?:ed|s|ing)?|support(?:ed|s|ing)?|allow(?:ed|s|ing)?|enable(?:d|s|ing)?|disable(?:d|s|ing)?|introduc(?:e|ed|es|ing)|resolve(?:d|s|ing)?|correct(?:ed|s|ing)?|patch(?:ed|es|ing)?)\b/i;

export const DOC_GRADE_COLORS: Record<DocGrade, string> = {
    A: '#22C55E',
    B: '#3B82F6',
    C: '#F59E0B',
    D: '#EF4444',
};

function normalizeText(value: string | null | undefined): string {
    return (value || '').trim();
}

function isResolvedStatus(status: string | null | undefined): boolean {
    const normalized = normalizeText(status);
    if (!normalized) return false;
    if (/\b(done|closed)\b/i.test(normalized)) return true;
    return getGroupForStatus(normalized) === 'Done';
}

function isSummaryDescriptive(summary: string | null | undefined): boolean {
    const normalized = normalizeText(summary);
    if (normalized.length <= 30) return false;
    return !/^\s*(CLONE|TEST|COPY)\b/i.test(normalized);
}

function hasPriority(priority: string | null | undefined): boolean {
    const normalized = normalizeText(priority).toLowerCase();
    return normalized.length > 0 && normalized !== 'none' && normalized !== 'null';
}

function hasEpic(issue: JiraIssue): boolean {
    const key = normalizeText(issue.epicKey);
    const summary = normalizeText(issue.epicSummary);
    return Boolean(key || summary);
}

function getGrade(score: number): DocGrade {
    if (score >= 85) return 'A';
    if (score >= 65) return 'B';
    if (score >= 40) return 'C';
    return 'D';
}

function isDocGrade(value: string | null | undefined): value is DocGrade {
    return value === 'A' || value === 'B' || value === 'C' || value === 'D';
}

export interface DocReadinessChecklistItem {
    id:
    | 'description_length'
    | 'description_verb'
    | 'epic'
    | 'story_points'
    | 'assignee'
    | 'resolved'
    | 'summary'
    | 'priority';
    label: string;
    points: number;
    passed: boolean;
}

export function getDocReadinessChecklist(issue: JiraIssue): DocReadinessChecklistItem[] {
    const description = extractDescriptionText(issue.description || '').trim();
    const hasLongDescription = description.length > 150;
    const hasVerb = ACTION_VERB_PATTERN.test(description);
    const hasStoryPoints = typeof issue.storyPoints === 'number' && Number.isFinite(issue.storyPoints);
    const hasAssignee = Boolean(issue.assignee?.displayName);
    const resolved = isResolvedStatus(issue.status);
    const summaryDescriptive = isSummaryDescriptive(issue.summary);
    const prioritySet = hasPriority(issue.priority);

    return [
        {
            id: 'description_length',
            label: hasLongDescription ? 'Has strong description (>150 chars)' : description ? 'Description too short' : 'No description',
            points: 25,
            passed: hasLongDescription,
        },
        {
            id: 'description_verb',
            label: hasVerb ? 'Description includes action language' : 'Description lacks action verb',
            points: 10,
            passed: hasVerb,
        },
        {
            id: 'epic',
            label: hasEpic(issue) ? 'Epic linked' : 'No epic linked',
            points: 15,
            passed: hasEpic(issue),
        },
        {
            id: 'story_points',
            label: hasStoryPoints ? 'Story points set' : 'Story points not set',
            points: 10,
            passed: hasStoryPoints,
        },
        {
            id: 'assignee',
            label: hasAssignee ? 'Assignee set' : 'No assignee',
            points: 10,
            passed: hasAssignee,
        },
        {
            id: 'resolved',
            label: resolved ? 'Resolved (Done/Closed)' : 'Not yet resolved',
            points: 15,
            passed: resolved,
        },
        {
            id: 'summary',
            label: summaryDescriptive ? 'Summary is descriptive' : 'Summary is too generic',
            points: 10,
            passed: summaryDescriptive,
        },
        {
            id: 'priority',
            label: prioritySet ? 'Priority set' : 'Priority not set',
            points: 5,
            passed: prioritySet,
        },
    ];
}

export function scoreTicket(issue: JiraIssue): DocScore {
    const checklist = getDocReadinessChecklist(issue);
    const score = checklist.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0);
    const grade = getGrade(score);
    const missingFields = checklist
        .filter((item) => !item.passed)
        .map((item) => item.label);

    return {
        score,
        grade,
        color: DOC_GRADE_COLORS[grade],
        missingFields,
        aiRatable: score >= 60,
    };
}

export function getTicketDocScore(issue: JiraIssue): DocScore {
    if (typeof issue.docScore === 'number' && Number.isFinite(issue.docScore) && isDocGrade(issue.docGrade)) {
        const score = Math.max(0, Math.min(100, Math.round(issue.docScore)));
        const grade = issue.docGrade;
        return {
            score,
            grade,
            color: DOC_GRADE_COLORS[grade],
            missingFields: Array.isArray(issue.docMissingFields) ? issue.docMissingFields : [],
            aiRatable: score >= 60,
        };
    }

    return scoreTicket(issue);
}

export function getDocGradeColor(grade: DocGrade): string {
    return DOC_GRADE_COLORS[grade];
}

export function getDocGradeLabel(grade: DocGrade): string {
    if (grade === 'A') return 'Ready to document';
    if (grade === 'B') return 'Good - minor gaps';
    if (grade === 'C') return 'Needs more info';
    return 'Incomplete - Q&A needed';
}
