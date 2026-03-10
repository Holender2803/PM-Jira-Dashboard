import { JiraIssue, IssueStatus, WorkflowStage } from '@/types';
import { differenceInDays, parseISO } from 'date-fns';

// ─── Workflow Stage Mapping ────────────────────────────────────────────────────

export const WORKFLOW_STAGES: Record<IssueStatus, WorkflowStage> = {
    'Backlog': 'intake',
    'Open': 'intake',
    'Icebox': 'intake',
    'Refinement': 'discovery',
    'Design': 'discovery',
    'In Progress': 'delivery',
    'Blocked': 'delivery',
    'In Review': 'review',
    'Reviewed': 'review',
    'Ready for QA': 'qa',
    'In QA': 'qa',
    'Ready for Acceptance': 'release',
    'Ready for Release': 'release',
    'Done': 'closed',
    'Archived': 'closed',
    'Rejected': 'closed',
};

export const STAGE_COLORS: Record<WorkflowStage, string> = {
    intake: '#6366f1',
    discovery: '#8b5cf6',
    delivery: '#ec4899',
    review: '#f59e0b',
    qa: '#10b981',
    release: '#06b6d4',
    closed: '#64748b',
};

export const STAGE_LABELS: Record<WorkflowStage, string> = {
    intake: 'Intake',
    discovery: 'Discovery',
    delivery: 'Delivery',
    review: 'Review',
    qa: 'QA',
    release: 'Release',
    closed: 'Closed',
};

export const ACTIVE_STATUSES: IssueStatus[] = [
    'In Progress', 'Blocked', 'In Review', 'Reviewed',
    'Ready for QA', 'In QA', 'Ready for Acceptance', 'Ready for Release'
];

export const CLOSED_STATUSES: IssueStatus[] = ['Done', 'Archived', 'Rejected'];

export const STATUS_COLORS: Record<IssueStatus, string> = {
    'Backlog': '#475569',
    'Open': '#6366f1',
    'Icebox': '#94a3b8',
    'Refinement': '#8b5cf6',
    'Design': '#a855f7',
    'In Progress': '#3b82f6',
    'Blocked': '#ef4444',
    'In Review': '#f59e0b',
    'Reviewed': '#eab308',
    'Ready for QA': '#22c55e',
    'In QA': '#10b981',
    'Ready for Acceptance': '#06b6d4',
    'Ready for Release': '#0ea5e9',
    'Done': '#22c55e',
    'Archived': '#475569',
    'Rejected': '#991b1b',
};

export const ISSUE_TYPE_COLORS: Record<string, string> = {
    'Bug': '#ef4444',
    'Story': '#3b82f6',
    'Task': '#6366f1',
    'Feature': '#8b5cf6',
    'Epic': '#f59e0b',
    'Subtask': '#64748b',
    'Sub-task': '#64748b',
    'Test Sub-task': '#14b8a6',
    'Technical Task': '#06b6d4',
    'Spike': '#a855f7',
    'Developer Request': '#ec4899',
    'Support': '#fb923c',
    'Chore': '#94a3b8',
};

// ─── Computed Fields ───────────────────────────────────────────────────────────

export function computeIssueMetrics(issue: Partial<JiraIssue> & Pick<JiraIssue, 'created' | 'status' | 'resolved' | 'changelog'>): {
    age: number;
    cycleTime: number | null;
    leadTime: number | null;
    timeInCurrentStatus: number;
    reopenCount: number;
    workflowStage: WorkflowStage;
} {
    const now = new Date();
    const created = parseISO(issue.created);
    const age = differenceInDays(now, created);

    // Cycle time: In Progress → Done
    let cycleTime: number | null = null;
    let inProgressDate: Date | null = null;
    let doneDate: Date | null = null;

    // Lead time: Created → Done
    let leadTime: number | null = null;
    if (issue.resolved) {
        const resolved = parseISO(issue.resolved);
        leadTime = differenceInDays(resolved, created);
    }

    // Time in current status + cycle time from changelog
    let lastStatusChange: Date | null = null;
    let reopenCount = 0;
    const changelog = issue.changelog || [];

    for (const entry of changelog) {
        if (entry.field === 'status') {
            const entryDate = parseISO(entry.created);
            if (entry.toString === 'In Progress' && !inProgressDate) {
                inProgressDate = entryDate;
            }
            if (CLOSED_STATUSES.includes(entry.toString as IssueStatus) && inProgressDate) {
                doneDate = entryDate;
                cycleTime = differenceInDays(doneDate, inProgressDate);
            }
            // Count reopens: moving from closed-ish back to active
            if (
                entry.fromString && CLOSED_STATUSES.includes(entry.fromString as IssueStatus) &&
                entry.toString && ACTIVE_STATUSES.includes(entry.toString as IssueStatus)
            ) {
                reopenCount++;
            }
            lastStatusChange = entryDate;
        }
    }

    const timeInCurrentStatus = lastStatusChange
        ? differenceInDays(now, lastStatusChange)
        : age;

    const workflowStage = WORKFLOW_STAGES[issue.status as IssueStatus] || 'intake';

    return { age, cycleTime, leadTime, timeInCurrentStatus, reopenCount, workflowStage };
}

// ─── Filter helpers ────────────────────────────────────────────────────────────

export function getWorkTypeBucket(issueType: string): string {
    const map: Record<string, string> = {
        'Bug': 'Bug',
        'Story': 'Feature',
        'Feature': 'Feature',
        'Task': 'Task',
        'Technical Task': 'Developer Request',
        'Developer Request': 'Developer Request',
        'Spike': 'Spike',
        'Chore': 'Chore',
        'Support': 'Support',
        'Subtask': 'Task',
    };
    return map[issueType] || 'Other';
}

export function sprintLabel(sprint: { state: string; name: string } | null): string {
    if (!sprint) return 'No Sprint';
    return sprint.name;
}

export const ALL_STATUSES: IssueStatus[] = [
    'Backlog', 'Open', 'Icebox', 'Refinement', 'Design',
    'In Progress', 'Blocked', 'In Review', 'Reviewed',
    'Ready for QA', 'In QA', 'Ready for Acceptance',
    'Ready for Release', 'Done', 'Archived', 'Rejected'
];

export const WORKFLOW_STAGE_STATUSES: Record<WorkflowStage, IssueStatus[]> = {
    intake: ['Backlog', 'Open', 'Icebox'],
    discovery: ['Refinement', 'Design'],
    delivery: ['In Progress', 'Blocked'],
    review: ['In Review', 'Reviewed'],
    qa: ['Ready for QA', 'In QA'],
    release: ['Ready for Acceptance', 'Ready for Release'],
    closed: ['Done', 'Archived', 'Rejected'],
};
