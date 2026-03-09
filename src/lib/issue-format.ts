import { JiraIssue } from '@/types';

function normalizeText(value: string | null | undefined): string {
    return (value || '').trim();
}

export function formatEpicLabelFromParts(
    epicKey: string | null | undefined,
    epicSummary: string | null | undefined,
    fallback = 'No Epic'
): string {
    const key = normalizeText(epicKey);
    const summary = normalizeText(epicSummary);
    if (!key && !summary) return fallback;
    if (key && summary && key !== summary) return `${key} — ${summary}`;
    return key || summary || fallback;
}

export function formatEpicLabel(
    issue: Pick<JiraIssue, 'epicKey' | 'epicSummary'>,
    fallback = 'No Epic'
): string {
    return formatEpicLabelFromParts(issue.epicKey, issue.epicSummary, fallback);
}

export function isEpicIssue(
    issue: Pick<JiraIssue, 'issueType'>
): boolean {
    return issue.issueType.toLowerCase() === 'epic';
}

export function enrichIssuesWithEpicSummaries(issues: JiraIssue[]): JiraIssue[] {
    const epicSummaryByKey = new Map<string, string>();

    for (const issue of issues) {
        if (isEpicIssue(issue)) {
            epicSummaryByKey.set(issue.key, issue.summary);
        }
        const key = normalizeText(issue.epicKey);
        const summary = normalizeText(issue.epicSummary);
        if (key && summary && key !== summary) {
            epicSummaryByKey.set(key, summary);
        }
    }

    let changed = false;
    const enriched = issues.map((issue) => {
        const key = normalizeText(issue.epicKey);
        if (!key) return issue;

        const currentSummary = normalizeText(issue.epicSummary);
        if (currentSummary && currentSummary !== key) return issue;

        const mapped = epicSummaryByKey.get(key);
        if (!mapped || mapped === currentSummary) return issue;

        changed = true;
        return {
            ...issue,
            epicSummary: mapped,
        };
    });

    return changed ? enriched : issues;
}

type AdfNode = {
    type?: string;
    text?: string;
    content?: AdfNode[];
};

function adfToPlainText(node: AdfNode | null | undefined): string {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (node.type === 'hardBreak') return '\n';
    if (!Array.isArray(node.content) || node.content.length === 0) return '';
    const parts = node.content.map((child) => adfToPlainText(child)).filter(Boolean);
    const joined = parts.join(node.type === 'paragraph' ? '' : ' ').trim();
    if (node.type === 'paragraph') return `${joined}\n`;
    return joined;
}

export function extractDescriptionText(description: string | null): string {
    if (!description) return '';
    const trimmed = description.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return trimmed;

    try {
        const parsed = JSON.parse(trimmed) as AdfNode;
        if (parsed && parsed.type === 'doc') {
            return adfToPlainText(parsed).replace(/\n{3,}/g, '\n\n').trim();
        }
    } catch {
        return description;
    }

    return description;
}
