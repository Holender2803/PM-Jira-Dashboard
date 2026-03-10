import { JiraIssue } from '@/types';

export interface BugTrackingConfig {
    bugSourceLabel: string;
    productionKeywords: string;
    qaKeywords: string;
    configured: boolean;
    updatedAt: string | null;
}

export const DEFAULT_BUG_TRACKING_CONFIG: BugTrackingConfig = {
    bugSourceLabel: 'source',
    productionKeywords: 'production, prod, client-reported, escaped',
    qaKeywords: 'qa, testing, internal, caught-in-qa',
    configured: false,
    updatedAt: null,
};

function normalize(value: string | null | undefined): string {
    return (value || '').trim().toLowerCase();
}

function splitKeywords(value: string): string[] {
    return value
        .split(',')
        .map((token) => normalize(token))
        .filter(Boolean);
}

function extractSourceCandidates(label: string, sourceLabel: string): string[] {
    const normalizedLabel = normalize(label);
    const normalizedSourceLabel = normalize(sourceLabel);
    if (!normalizedLabel) return [];

    const candidates: string[] = [normalizedLabel];

    const colonPrefix = `${normalizedSourceLabel}:`;
    if (normalizedSourceLabel && normalizedLabel.startsWith(colonPrefix)) {
        const value = normalize(normalizedLabel.slice(colonPrefix.length));
        if (value) candidates.push(value);
    }

    const equalsPrefix = `${normalizedSourceLabel}=`;
    if (normalizedSourceLabel && normalizedLabel.startsWith(equalsPrefix)) {
        const value = normalize(normalizedLabel.slice(equalsPrefix.length));
        if (value) candidates.push(value);
    }

    return candidates;
}

function classifyBugSource(issue: JiraIssue, config: BugTrackingConfig): 'production' | 'qa' | null {
    const productionKeywords = new Set(splitKeywords(config.productionKeywords));
    const qaKeywords = new Set(splitKeywords(config.qaKeywords));

    let hasProductionSignal = false;
    let hasQaSignal = false;

    for (const rawLabel of issue.labels) {
        const candidates = extractSourceCandidates(rawLabel, config.bugSourceLabel);
        for (const candidate of candidates) {
            if (productionKeywords.has(candidate)) hasProductionSignal = true;
            if (qaKeywords.has(candidate)) hasQaSignal = true;
        }
    }

    if (hasProductionSignal) return 'production';
    if (hasQaSignal) return 'qa';
    return null;
}

export interface BugEscapeRateMetrics {
    productionBugs: number;
    qaBugs: number;
    totalClassified: number;
    escapeRate: number | null;
}

export function calculateBugEscapeRate(
    issues: JiraIssue[],
    config: BugTrackingConfig
): BugEscapeRateMetrics {
    let productionBugs = 0;
    let qaBugs = 0;

    for (const issue of issues) {
        if (issue.issueType !== 'Bug') continue;
        const source = classifyBugSource(issue, config);
        if (source === 'production') {
            productionBugs += 1;
        } else if (source === 'qa') {
            qaBugs += 1;
        }
    }

    const totalClassified = productionBugs + qaBugs;
    const escapeRate = totalClassified > 0
        ? Number(((productionBugs / totalClassified) * 100).toFixed(1))
        : null;

    return {
        productionBugs,
        qaBugs,
        totalClassified,
        escapeRate,
    };
}
