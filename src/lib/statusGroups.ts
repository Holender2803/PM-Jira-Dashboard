import { JiraIssue } from '@/types';

export const ALL_GROUP_NAMES = [
    'Backlog',
    'Planning',
    'In Progress',
    'Review/QA',
    'Awaiting',
    'Blocked/Hold',
    'Done',
] as const;

export type WorkflowGroupName = typeof ALL_GROUP_NAMES[number];

export const STATUS_GROUPS: Record<WorkflowGroupName, string[]> = {
    Backlog: ['New', 'IceBox', 'Icebox', 'Backlog', 'Open'],
    Planning: ['Refinement', 'Requirements Gathering and Analysis', 'Design', 'Sprint Ready'],
    'In Progress': [
        'In progress',
        'In Progress',
        'Confirmed Bug (In Development)',
        'Confirmed bug (RPA)',
        'Team Lead Review',
    ],
    'Review/QA': [
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
    Awaiting: ['Ready for Dev', 'Ready for Production', 'Ready for Release'],
    'Blocked/Hold': ['Blocked', 'On Hold', 'Waiting for User Confirmation'],
    Done: ['Done', 'Closed', 'Reviewed', 'Rejected', 'Archived'],
};

export const GROUP_COLORS: Record<WorkflowGroupName, { bg: string; text: string; border: string }> = {
    Backlog: {
        bg: '#475569',
        text: '#e2e8f0',
        border: 'rgba(100,116,139,0.72)',
    },
    Planning: {
        bg: '#7c3aed',
        text: '#ede9fe',
        border: 'rgba(139,92,246,0.72)',
    },
    'In Progress': {
        bg: '#2563eb',
        text: '#dbeafe',
        border: 'rgba(59,130,246,0.72)',
    },
    'Review/QA': {
        bg: '#0f766e',
        text: '#ccfbf1',
        border: 'rgba(20,184,166,0.72)',
    },
    Awaiting: {
        bg: '#4f46e5',
        text: '#e0e7ff',
        border: 'rgba(99,102,241,0.72)',
    },
    'Blocked/Hold': {
        bg: '#dc2626',
        text: '#fee2e2',
        border: 'rgba(239,68,68,0.78)',
    },
    Done: {
        bg: '#059669',
        text: '#d1fae5',
        border: 'rgba(16,185,129,0.72)',
    },
};

export const WORKFLOW_GROUP_ORDER: WorkflowGroupName[] = [...ALL_GROUP_NAMES];

export const WORKFLOW_ACTIVE_ONLY_GROUPS: WorkflowGroupName[] = [
    'Planning',
    'In Progress',
    'Review/QA',
    'Awaiting',
    'Blocked/Hold',
];

export const WORKFLOW_GROUP_STAGE_INDEX: Record<WorkflowGroupName, number> = {
    Backlog: 0,
    Planning: 1,
    'In Progress': 2,
    'Review/QA': 3,
    Awaiting: 4,
    'Blocked/Hold': 5,
    Done: 6,
};

export const WORKFLOW_GROUP_DISPLAY_LABELS: Record<WorkflowGroupName, string> = {
    Backlog: 'Backlog',
    Planning: 'Planning',
    'In Progress': 'In Progress',
    'Review/QA': 'Review/QA',
    Awaiting: 'Awaiting',
    'Blocked/Hold': 'Blocked/Hold',
    Done: 'Done',
};

export const WORKFLOW_GROUP_COLORS: Record<WorkflowGroupName, string> = {
    Backlog: '#64748b',
    Planning: '#8b5cf6',
    'In Progress': '#3b82f6',
    'Review/QA': '#14b8a6',
    Awaiting: '#6366f1',
    'Blocked/Hold': '#ef4444',
    Done: '#10b981',
};

export const WORKFLOW_GROUP_STATUS_ALIASES: Record<WorkflowGroupName, string[]> = STATUS_GROUPS;

const GROUP_SET = new Set<string>(ALL_GROUP_NAMES);

function normalizeToken(value: string | null | undefined): string {
    return (value || '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const NORMALIZED_GROUP_NAME_MAP = (() => {
    const map = new Map<string, WorkflowGroupName>();
    for (const name of ALL_GROUP_NAMES) {
        map.set(normalizeToken(name), name);
    }

    map.set('review / qa', 'Review/QA');
    map.set('review qa', 'Review/QA');
    map.set('blocked / hold', 'Blocked/Hold');
    map.set('blocked hold', 'Blocked/Hold');
    return map;
})();

function normalizeGroupName(group: string | null | undefined): WorkflowGroupName | null {
    if (!group) return null;
    if (GROUP_SET.has(group)) return group as WorkflowGroupName;
    const normalized = NORMALIZED_GROUP_NAME_MAP.get(normalizeToken(group));
    return normalized || null;
}

const STATUS_TO_GROUP = (() => {
    const map = new Map<string, WorkflowGroupName>();
    for (const group of ALL_GROUP_NAMES) {
        for (const status of STATUS_GROUPS[group]) {
            map.set(normalizeToken(status), group);
        }
    }
    return map;
})();

export function getGroupForStatus(rawStatus: string): string {
    const normalized = normalizeToken(rawStatus);
    if (!normalized) return 'Other';

    const direct = STATUS_TO_GROUP.get(normalized);
    if (direct) return direct;

    if (normalized.includes('blocked') || normalized.includes('hold') || normalized.includes('waiting')) {
        return 'Blocked/Hold';
    }
    if (
        normalized.includes('under review') ||
        normalized.includes('review') ||
        normalized.includes('qa') ||
        normalized.includes('testing') ||
        normalized.includes('acceptance')
    ) {
        return 'Review/QA';
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
        normalized.includes('resolved') ||
        normalized.includes('rejected') ||
        normalized.includes('archiv')
    ) {
        return 'Done';
    }
    if (
        normalized.includes('in progress') ||
        normalized.includes('development') ||
        normalized.includes('confirmed bug') ||
        normalized.includes('team lead review') ||
        normalized.includes('wip')
    ) {
        return 'In Progress';
    }
    if (
        normalized.includes('refinement') ||
        normalized.includes('requirements') ||
        normalized.includes('design') ||
        normalized.includes('sprint ready') ||
        normalized.includes('planning')
    ) {
        return 'Planning';
    }
    if (
        normalized.includes('new') ||
        normalized.includes('icebox') ||
        normalized.includes('backlog') ||
        normalized === 'open' ||
        normalized === 'to do' ||
        normalized === 'todo'
    ) {
        return 'Backlog';
    }

    return 'Other';
}

export function getStatusesForGroups(groups: string[]): string[] {
    const selectedGroups = normalizeWorkflowGroupFilter(groups);
    const statuses = new Set<string>();

    for (const group of selectedGroups) {
        for (const status of STATUS_GROUPS[group]) {
            statuses.add(status);
        }
    }

    return [...statuses];
}

export function normalizeWorkflowGroupFilter(groups?: string[] | null): WorkflowGroupName[] {
    if (!groups || groups.length === 0) return [...ALL_GROUP_NAMES];

    const selected: WorkflowGroupName[] = [];
    for (const group of groups) {
        const normalized = normalizeGroupName(group);
        if (!normalized) continue;
        if (!selected.includes(normalized)) selected.push(normalized);
    }

    if (selected.length === 0) return [...ALL_GROUP_NAMES];
    return ALL_GROUP_NAMES.filter((group) => selected.includes(group));
}

export function isAllWorkflowGroupsSelected(groups?: string[] | null): boolean {
    const normalized = normalizeWorkflowGroupFilter(groups);
    return normalized.length === ALL_GROUP_NAMES.length;
}

export function resolveWorkflowGroup(
    status: string | null | undefined
): WorkflowGroupName | null {
    if (!status) return null;
    const group = getGroupForStatus(status);
    return group === 'Other' ? null : (group as WorkflowGroupName);
}

export function getResolvedStatusesForGroups(groups?: string[] | null): string[] {
    return getStatusesForGroups(groups || [...ALL_GROUP_NAMES]);
}

export function getStageIndexByGroup(group: string | null | undefined): number {
    const normalized = normalizeGroupName(group);
    if (!normalized) return -1;
    return WORKFLOW_GROUP_STAGE_INDEX[normalized];
}

export function getIssueWorkflowGroup(issue: Pick<JiraIssue, 'status'>): WorkflowGroupName | null {
    return resolveWorkflowGroup(issue.status);
}
