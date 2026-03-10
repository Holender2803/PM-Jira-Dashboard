import { JiraIssue } from '@/types';

export const WORKFLOW_GROUP_ORDER = [
    'Backlog',
    'Planning',
    'In Progress',
    'Review / QA',
    'Awaiting',
    'Blocked / Hold',
    'Done',
] as const;

export type WorkflowGroupName = typeof WORKFLOW_GROUP_ORDER[number];

export const WORKFLOW_ACTIVE_ONLY_GROUPS: WorkflowGroupName[] = [
    'Planning',
    'In Progress',
    'Review / QA',
    'Awaiting',
    'Blocked / Hold',
];

export const WORKFLOW_GROUP_STAGE_INDEX: Record<WorkflowGroupName, number> = {
    Backlog: 0,
    Planning: 1,
    'In Progress': 2,
    'Review / QA': 3,
    Awaiting: 4,
    'Blocked / Hold': 5,
    Done: 6,
};

export const WORKFLOW_GROUP_DISPLAY_LABELS: Record<WorkflowGroupName, string> = {
    Backlog: 'Backlog',
    Planning: 'Planning',
    'In Progress': 'In Progress',
    'Review / QA': 'Review/QA',
    Awaiting: 'Awaiting',
    'Blocked / Hold': 'Blocked/Hold',
    Done: 'Done',
};

export const WORKFLOW_GROUP_COLORS: Record<WorkflowGroupName, string> = {
    Backlog: '#64748b',
    Planning: '#8b5cf6',
    'In Progress': '#3b82f6',
    'Review / QA': '#f59e0b',
    Awaiting: '#06b6d4',
    'Blocked / Hold': '#ef4444',
    Done: '#10b981',
};

export const WORKFLOW_GROUP_STATUS_ALIASES: Record<WorkflowGroupName, string[]> = {
    Backlog: ['New', 'IceBox', 'Icebox', 'Backlog', 'Open'],
    Planning: ['Refinement', 'Requirements Gathering and Analysis', 'Design', 'Sprint Ready'],
    'In Progress': [
        'In progress',
        'In Progress',
        'Confirmed Bug (In Development)',
        'Confirmed bug (RPA)',
        'Team Lead Review',
    ],
    'Review / QA': [
        'Under Review',
        'Under Review (migrated)',
        'In Review',
        'Ready for QA',
        'Ready For QA',
        'IN QA',
        'In QA',
        'Ready for Testing',
        'Ready for Acceptance',
    ],
    'Blocked / Hold': ['Blocked', 'On Hold', 'Waiting for User Confirmation'],
    Awaiting: ['Ready for Dev', 'Ready for Production', 'Ready for Release'],
    Done: ['Done', 'Closed', 'Reviewed', 'Rejected', 'Archived'],
};

const GROUP_SET = new Set<string>(WORKFLOW_GROUP_ORDER);

function normalizeStatus(value: string | null | undefined): string {
    return (value || '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const STATUS_TO_GROUP = (() => {
    const map = new Map<string, WorkflowGroupName>();
    for (const group of WORKFLOW_GROUP_ORDER) {
        for (const status of WORKFLOW_GROUP_STATUS_ALIASES[group]) {
            map.set(normalizeStatus(status), group);
        }
    }
    return map;
})();

export function normalizeWorkflowGroupFilter(groups?: string[] | null): WorkflowGroupName[] {
    if (!groups || groups.length === 0) return [...WORKFLOW_GROUP_ORDER];
    const selected: WorkflowGroupName[] = [];
    for (const group of groups) {
        if (!GROUP_SET.has(group)) continue;
        const typed = group as WorkflowGroupName;
        if (!selected.includes(typed)) selected.push(typed);
    }
    if (selected.length === 0) return [...WORKFLOW_GROUP_ORDER];
    return WORKFLOW_GROUP_ORDER.filter((group) => selected.includes(group));
}

export function isAllWorkflowGroupsSelected(groups?: string[] | null): boolean {
    const normalized = normalizeWorkflowGroupFilter(groups);
    return normalized.length === WORKFLOW_GROUP_ORDER.length;
}

export function resolveWorkflowGroup(status: string | null | undefined): WorkflowGroupName | null {
    const normalized = normalizeStatus(status);
    if (!normalized) return null;

    const direct = STATUS_TO_GROUP.get(normalized);
    if (direct) return direct;

    if (normalized.includes('blocked') || normalized.includes('hold') || normalized.includes('waiting')) {
        return 'Blocked / Hold';
    }
    if (
        normalized.includes('under review') ||
        normalized.includes('review') ||
        normalized.includes('qa') ||
        normalized.includes('testing') ||
        normalized.includes('acceptance')
    ) {
        return 'Review / QA';
    }
    if (
        normalized.includes('ready for release') ||
        normalized.includes('ready for dev') ||
        normalized.includes('ready for production') ||
        normalized.includes('await')
    ) {
        return 'Awaiting';
    }
    if (
        normalized.includes('done') ||
        normalized.includes('closed') ||
        normalized.includes('rejected') ||
        normalized.includes('archiv')
    ) {
        return 'Done';
    }
    if (
        normalized.includes('in progress') ||
        normalized.includes('development') ||
        normalized.includes('confirmed bug') ||
        normalized.includes('team lead review')
    ) {
        return 'In Progress';
    }
    if (
        normalized.includes('refinement') ||
        normalized.includes('requirements') ||
        normalized.includes('design') ||
        normalized.includes('sprint ready')
    ) {
        return 'Planning';
    }
    if (
        normalized.includes('new') ||
        normalized.includes('icebox') ||
        normalized.includes('backlog') ||
        normalized === 'open'
    ) {
        return 'Backlog';
    }

    return null;
}

export function getResolvedStatusesForGroups(groups?: string[] | null): string[] {
    const selected = normalizeWorkflowGroupFilter(groups);
    const statuses = new Set<string>();
    for (const group of selected) {
        for (const status of WORKFLOW_GROUP_STATUS_ALIASES[group]) {
            statuses.add(status);
        }
    }
    return [...statuses];
}

export function getStageIndexByGroup(group: string | null | undefined): number {
    if (!group) return -1;
    if (!GROUP_SET.has(group)) return -1;
    return WORKFLOW_GROUP_STAGE_INDEX[group as WorkflowGroupName];
}

export function getIssueWorkflowGroup(issue: Pick<JiraIssue, 'status'>): WorkflowGroupName | null {
    return resolveWorkflowGroup(issue.status);
}
