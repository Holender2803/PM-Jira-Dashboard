import { getDemoIssues } from '@/lib/demo-data';
import { queryIssues } from '@/lib/issue-store';
import { CLOSED_STATUSES } from '@/lib/workflow';
import { InitiativeHealth, InitiativeRecord, InitiativeWithHealth, LinkedJiraIssueSummary } from '@/types/pm-os';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

function getLinkedIssues(keys: string[]): LinkedJiraIssueSummary[] {
    if (keys.length === 0) return [];

    const sourceIssues = DEMO_MODE
        ? getDemoIssues()
        : queryIssues({ selectedKeys: keys });
    const issueByKey = new Map(sourceIssues.map((issue) => [issue.key, issue]));

    return keys
        .map((key) => issueByKey.get(key))
        .filter((issue): issue is NonNullable<typeof issue> => Boolean(issue))
        .map((issue) => ({
            key: issue.key,
            summary: issue.summary,
            status: issue.status,
            issueType: issue.issueType,
            url: issue.url,
            assigneeName: issue.assignee?.displayName || null,
        }));
}

export function buildInitiativeHealth(linkedIssueKeys: string[]): InitiativeHealth {
    const linkedIssues = getLinkedIssues(linkedIssueKeys);
    const totalLinkedIssues = linkedIssues.length;
    const doneLinkedIssues = linkedIssues.filter((issue) => CLOSED_STATUSES.includes(issue.status as typeof CLOSED_STATUSES[number])).length;
    const blockedLinkedIssues = linkedIssues.filter((issue) => issue.status === 'Blocked').length;
    const activeLinkedIssues = totalLinkedIssues - doneLinkedIssues;
    const completionRate = totalLinkedIssues > 0
        ? Math.round((doneLinkedIssues / totalLinkedIssues) * 100)
        : 0;

    return {
        totalLinkedIssues,
        doneLinkedIssues,
        blockedLinkedIssues,
        activeLinkedIssues,
        completionRate,
        linkedIssues,
    };
}

export function attachInitiativeHealth<T extends InitiativeRecord>(initiatives: T[]): InitiativeWithHealth[] {
    return initiatives.map((initiative) => ({
        ...initiative,
        health: buildInitiativeHealth(initiative.linkedIssueKeys),
    }));
}
