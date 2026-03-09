import {
    addDays,
    differenceInCalendarDays,
    endOfDay,
    format,
    isAfter,
    isBefore,
    parseISO,
    startOfDay,
    startOfWeek,
    subDays,
    subWeeks,
} from 'date-fns';
import { IssueStatus, JiraIssue, Sprint, SprintMixChange, WorkflowStage } from '@/types';
import {
    ACTIVE_STATUSES,
    ALL_STATUSES,
    CLOSED_STATUSES,
    STAGE_COLORS,
    STAGE_LABELS,
    WORKFLOW_STAGE_STATUSES,
} from './workflow';
import { formatEpicLabel } from './issue-format';

function safeParseDate(value?: string | null): Date | null {
    if (!value) return null;
    const parsed = parseISO(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function isClosed(status: IssueStatus): boolean {
    return CLOSED_STATUSES.includes(status);
}

function isActive(status: IssueStatus): boolean {
    return ACTIVE_STATUSES.includes(status);
}

function getStatusIndex(status: string | null): number {
    if (!status) return -1;
    return ALL_STATUSES.indexOf(status as IssueStatus);
}

function isKnownStatus(status: string | null): status is IssueStatus {
    if (!status) return false;
    return ALL_STATUSES.includes(status as IssueStatus);
}

function buildStatusCountRecord(): Record<IssueStatus, number> {
    return ALL_STATUSES.reduce((acc, status) => {
        acc[status] = 0;
        return acc;
    }, {} as Record<IssueStatus, number>);
}

function normalize(value: string | null | undefined): string {
    return (value || '').toLowerCase().trim();
}

function includesText(haystack: string | null | undefined, needle: string): boolean {
    return normalize(haystack).includes(needle.toLowerCase());
}

function getMostRecentDate(sprint: Sprint): Date {
    const complete = safeParseDate(sprint.completeDate);
    const end = safeParseDate(sprint.endDate);
    const start = safeParseDate(sprint.startDate);
    return complete || end || start || new Date(0);
}

export function getAllSprints(issues: JiraIssue[]): Sprint[] {
    const sprintMap = new Map<number, Sprint>();
    for (const issue of issues) {
        if (!issue.sprint) continue;
        sprintMap.set(issue.sprint.id, issue.sprint);
    }

    return [...sprintMap.values()].sort(
        (a, b) => getMostRecentDate(b).getTime() - getMostRecentDate(a).getTime()
    );
}

export function getCurrentAndPreviousSprints(issues: JiraIssue[]): {
    currentSprint: Sprint | null;
    previousSprint: Sprint | null;
} {
    const sprints = getAllSprints(issues);
    const active = sprints.find((s) => s.state === 'active') || null;

    if (active) {
        const previous = sprints.find((s) => s.state === 'closed' && s.id !== active.id) || null;
        return { currentSprint: active, previousSprint: previous };
    }

    const closed = sprints.filter((s) => s.state === 'closed');
    return {
        currentSprint: closed[0] || null,
        previousSprint: closed[1] || null,
    };
}

export function getIssuesForSprint(issues: JiraIssue[], sprint: Sprint | null): JiraIssue[] {
    if (!sprint) return [];
    return issues.filter((issue) => issue.sprint?.id === sprint.id);
}

export interface SprintOverviewMetrics {
    sprint: Sprint | null;
    committedTickets: number;
    completedTickets: number;
    completionRate: number;
    committedPoints: number;
    completedPoints: number;
    addedAfterStart: number;
    removedFromSprint: number;
    carriedOver: number;
    inProgress: number;
    blocked: number;
    doneThisSprint: number;
    byStatus: Record<IssueStatus, number>;
    storyPointsByStatus: Record<IssueStatus, number>;
    byDay: { date: string; completed: number; remaining: number }[];
}

function issueTouchedSprint(issue: JiraIssue, sprintName: string): boolean {
    return issue.changelog.some((entry) => {
        if (!includesText(entry.field, 'sprint')) return false;
        return (
            includesText(entry.fromString, sprintName) ||
            includesText(entry.toString, sprintName)
        );
    });
}

export function calculateSprintOverview(
    allIssues: JiraIssue[],
    sprint: Sprint | null,
    previousSprint: Sprint | null
): SprintOverviewMetrics {
    const sprintIssues = getIssuesForSprint(allIssues, sprint);
    const statusCounts = buildStatusCountRecord();
    const statusPoints = buildStatusCountRecord();

    for (const issue of sprintIssues) {
        statusCounts[issue.status] += 1;
        statusPoints[issue.status] += issue.storyPoints || 0;
    }

    const completed = sprintIssues.filter((issue) => isClosed(issue.status));
    const inProgress = sprintIssues.filter((issue) => issue.status === 'In Progress').length;
    const blocked = sprintIssues.filter((issue) => issue.status === 'Blocked').length;

    const committedTickets = sprintIssues.length;
    const completedTickets = completed.length;
    const committedPoints = sprintIssues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
    const completedPoints = completed.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);

    const sprintStart = safeParseDate(sprint?.startDate);
    const sprintEnd = safeParseDate(sprint?.endDate) || new Date();

    const addedAfterStart = sprintStart
        ? sprintIssues.filter((issue) => {
            const created = safeParseDate(issue.created);
            return created ? isAfter(created, sprintStart) : false;
        }).length
        : 0;

    const removedFromSprint = sprint
        ? allIssues.filter((issue) => {
            if (issue.sprint?.id === sprint.id) return false;
            return issueTouchedSprint(issue, sprint.name);
        }).length
        : 0;

    const carriedOver = sprintStart
        ? sprintIssues.filter((issue) => {
            const created = safeParseDate(issue.created);
            if (!created) return false;

            if (previousSprint && issueTouchedSprint(issue, previousSprint.name)) {
                return true;
            }

            return isBefore(created, sprintStart) && !isClosed(issue.status);
        }).length
        : 0;

    const doneThisSprint = sprintStart
        ? completed.filter((issue) => {
            const resolved = safeParseDate(issue.resolved);
            if (!resolved) return false;
            return resolved >= sprintStart && resolved <= sprintEnd;
        }).length
        : completedTickets;

    const byDay: { date: string; completed: number; remaining: number }[] = [];
    if (sprintStart) {
        const end = sprint?.state === 'active' ? new Date() : sprintEnd;
        let cursor = startOfDay(sprintStart);
        while (cursor <= endOfDay(end)) {
            const completedByDay = completed.filter((issue) => {
                const resolved = safeParseDate(issue.resolved);
                return resolved ? resolved <= endOfDay(cursor) : false;
            }).length;
            byDay.push({
                date: format(cursor, 'MMM d'),
                completed: completedByDay,
                remaining: Math.max(0, committedTickets - completedByDay),
            });
            cursor = addDays(cursor, 1);
        }
    }

    return {
        sprint,
        committedTickets,
        completedTickets,
        completionRate: committedTickets > 0 ? Math.round((completedTickets / committedTickets) * 100) : 0,
        committedPoints,
        completedPoints,
        addedAfterStart,
        removedFromSprint,
        carriedOver,
        inProgress,
        blocked,
        doneThisSprint,
        byStatus: statusCounts,
        storyPointsByStatus: statusPoints,
        byDay,
    };
}

export interface GroupCountMetric {
    name: string;
    count: number;
    points: number;
    blocked: number;
    stale: number;
}

function buildGroupMetrics(
    issues: JiraIssue[],
    getName: (issue: JiraIssue) => string,
    staleThresholdDays: number
): GroupCountMetric[] {
    const map = new Map<string, GroupCountMetric>();

    for (const issue of issues) {
        const name = getName(issue);
        const current = map.get(name) || {
            name,
            count: 0,
            points: 0,
            blocked: 0,
            stale: 0,
        };

        current.count += 1;
        current.points += issue.storyPoints || 0;
        if (issue.status === 'Blocked') current.blocked += 1;
        if (issue.timeInCurrentStatus >= staleThresholdDays) current.stale += 1;

        map.set(name, current);
    }

    return [...map.values()].sort((a, b) => b.count - a.count);
}

export interface FocusMetrics {
    activeIssues: JiraIssue[];
    inProgress: JiraIssue[];
    inReview: JiraIssue[];
    inQA: JiraIssue[];
    blocked: JiraIssue[];
    readyForRelease: JiraIssue[];
    topUpdatedLast7Days: JiraIssue[];
    staleActive: JiraIssue[];
    byAssignee: GroupCountMetric[];
    byEpic: GroupCountMetric[];
    byIssueType: GroupCountMetric[];
    byPriority: GroupCountMetric[];
}

export function calculateFocusMetrics(
    issues: JiraIssue[],
    staleThresholdDays = 7
): FocusMetrics {
    const activeIssues = issues.filter((issue) => isActive(issue.status));
    const last7Days = subDays(new Date(), 7);

    return {
        activeIssues,
        inProgress: activeIssues.filter((issue) => issue.status === 'In Progress'),
        inReview: activeIssues.filter((issue) => issue.status === 'In Review' || issue.status === 'Reviewed'),
        inQA: activeIssues.filter((issue) => issue.status === 'Ready for QA' || issue.status === 'In QA'),
        blocked: activeIssues.filter((issue) => issue.status === 'Blocked'),
        readyForRelease: activeIssues.filter(
            (issue) => issue.status === 'Ready for Acceptance' || issue.status === 'Ready for Release'
        ),
        topUpdatedLast7Days: [...activeIssues]
            .filter((issue) => {
                const updated = safeParseDate(issue.updated);
                return updated ? updated >= last7Days : false;
            })
            .sort((a, b) => b.updated.localeCompare(a.updated))
            .slice(0, 12),
        staleActive: [...activeIssues]
            .filter((issue) => issue.timeInCurrentStatus >= staleThresholdDays)
            .sort((a, b) => b.timeInCurrentStatus - a.timeInCurrentStatus),
        byAssignee: buildGroupMetrics(activeIssues, (issue) => issue.assignee?.displayName || 'Unassigned', staleThresholdDays),
        byEpic: buildGroupMetrics(activeIssues, (issue) => formatEpicLabel(issue), staleThresholdDays),
        byIssueType: buildGroupMetrics(activeIssues, (issue) => issue.issueType, staleThresholdDays),
        byPriority: buildGroupMetrics(activeIssues, (issue) => issue.priority || 'No Priority', staleThresholdDays),
    };
}

export type WorkMixBucket =
    | 'Bug'
    | 'Feature Request'
    | 'Developer Request'
    | 'Technical Task'
    | 'Spike'
    | 'Chore / Maintenance'
    | 'Support / Implementation'
    | 'Other';

export const WORK_MIX_BUCKET_ORDER: WorkMixBucket[] = [
    'Bug',
    'Feature Request',
    'Developer Request',
    'Technical Task',
    'Spike',
    'Chore / Maintenance',
    'Support / Implementation',
    'Other',
];

export function getWorkMixBucket(issue: JiraIssue): WorkMixBucket {
    const issueType = normalize(issue.issueType);
    const workType = normalize(issue.workType);
    const summary = normalize(issue.summary);
    const labels = issue.labels.map((label) => normalize(label));

    if (issueType === 'bug' || labels.some((label) => label.includes('bug'))) return 'Bug';
    if (issueType.includes('developer request') || workType.includes('developer request')) return 'Developer Request';
    if (issueType.includes('spike') || workType.includes('spike')) return 'Spike';

    if (
        issueType.includes('chore') ||
        workType.includes('maintenance') ||
        labels.some((label) => label.includes('maintenance') || label.includes('chore'))
    ) {
        return 'Chore / Maintenance';
    }

    if (
        issueType.includes('support') ||
        workType.includes('support') ||
        workType.includes('implementation') ||
        labels.some((label) => label.includes('support') || label.includes('implementation'))
    ) {
        return 'Support / Implementation';
    }

    if (
        issueType.includes('story') ||
        issueType.includes('feature') ||
        summary.includes('feature') ||
        summary.includes('request')
    ) {
        return 'Feature Request';
    }

    if (issueType.includes('technical') || issueType.includes('task') || issueType.includes('subtask')) {
        return 'Technical Task';
    }

    return 'Other';
}

export interface WorkMixMetricRow {
    bucket: WorkMixBucket;
    count: number;
    storyPoints: number;
    open: number;
    inProgress: number;
    closed: number;
}

export interface WorkMixMetrics {
    total: number;
    rows: WorkMixMetricRow[];
    bugToFeatureRatio: number;
    bugRatio: number;
    featureRatio: number;
    developerRequestRatio: number;
    sprintOverSprint: SprintMixChange[];
}

function issueStateGroup(status: IssueStatus): 'open' | 'in_progress' | 'closed' {
    if (isClosed(status)) return 'closed';
    if (isActive(status)) return 'in_progress';
    return 'open';
}

function countSprintMix(issues: JiraIssue[], sprintName: string): SprintMixChange {
    const sprintIssues = issues.filter((issue) => issue.sprint?.name === sprintName);
    const mix: SprintMixChange = {
        sprintName,
        bugs: 0,
        features: 0,
        devRequests: 0,
        tasks: 0,
    };

    for (const issue of sprintIssues) {
        const bucket = getWorkMixBucket(issue);
        if (bucket === 'Bug') mix.bugs += 1;
        else if (bucket === 'Feature Request') mix.features += 1;
        else if (bucket === 'Developer Request') mix.devRequests += 1;
        else mix.tasks += 1;
    }

    return mix;
}

export function calculateWorkMixMetrics(issues: JiraIssue[]): WorkMixMetrics {
    const rows = new Map<WorkMixBucket, WorkMixMetricRow>();

    for (const bucket of WORK_MIX_BUCKET_ORDER) {
        rows.set(bucket, {
            bucket,
            count: 0,
            storyPoints: 0,
            open: 0,
            inProgress: 0,
            closed: 0,
        });
    }

    for (const issue of issues) {
        const bucket = getWorkMixBucket(issue);
        const row = rows.get(bucket)!;

        row.count += 1;
        row.storyPoints += issue.storyPoints || 0;

        const state = issueStateGroup(issue.status);
        if (state === 'closed') row.closed += 1;
        else if (state === 'in_progress') row.inProgress += 1;
        else row.open += 1;
    }

    const sortedRows = WORK_MIX_BUCKET_ORDER
        .map((bucket) => rows.get(bucket)!)
        .filter((row) => row.count > 0);

    const total = issues.length;
    const bugCount = rows.get('Bug')?.count || 0;
    const featureCount = rows.get('Feature Request')?.count || 0;
    const devRequestCount = rows.get('Developer Request')?.count || 0;

    const sprintNames = [...new Set(issues.map((issue) => issue.sprint?.name).filter(Boolean) as string[])];
    const sprintOverSprint = sprintNames
        .map((name) => countSprintMix(issues, name))
        .sort((a, b) => a.sprintName.localeCompare(b.sprintName));

    return {
        total,
        rows: sortedRows,
        bugToFeatureRatio: featureCount > 0 ? Number((bugCount / featureCount).toFixed(2)) : 0,
        bugRatio: total > 0 ? Number((bugCount / total).toFixed(2)) : 0,
        featureRatio: total > 0 ? Number((featureCount / total).toFixed(2)) : 0,
        developerRequestRatio: total > 0 ? Number((devRequestCount / total).toFixed(2)) : 0,
        sprintOverSprint,
    };
}

function getStatusDurations(issue: JiraIssue): Partial<Record<IssueStatus, number>> {
    const durations: Partial<Record<IssueStatus, number>> = {};
    const changes = issue.changelog
        .filter((entry) => includesText(entry.field, 'status') && isKnownStatus(entry.toString))
        .sort((a, b) => a.created.localeCompare(b.created));

    if (changes.length === 0) {
        durations[issue.status] = issue.timeInCurrentStatus;
        return durations;
    }

    for (let index = 0; index < changes.length; index += 1) {
        const current = changes[index];
        const next = changes[index + 1];
        const enteredAt = safeParseDate(current.created);
        const exitedAt = safeParseDate(next?.created) || new Date();
        if (!enteredAt) continue;

        const status = current.toString as IssueStatus;
        const days = Math.max(0, differenceInCalendarDays(exitedAt, enteredAt));
        durations[status] = (durations[status] || 0) + days;
    }

    return durations;
}

function statusAtDate(issue: JiraIssue, date: Date): IssueStatus {
    const statusChanges = issue.changelog
        .filter((entry) => includesText(entry.field, 'status') && isKnownStatus(entry.toString))
        .sort((a, b) => a.created.localeCompare(b.created));

    let status: IssueStatus = issue.status;
    for (const change of statusChanges) {
        const changeDate = safeParseDate(change.created);
        if (!changeDate) continue;
        if (changeDate > date) break;
        status = change.toString as IssueStatus;
    }

    return status;
}

export interface WorkflowStageMetric {
    stage: WorkflowStage;
    label: string;
    color: string;
    statuses: IssueStatus[];
    count: number;
    avgDaysInStage: number;
    oldestDays: number;
}

export interface WorkflowMetrics {
    byStatus: Record<IssueStatus, number>;
    byStage: WorkflowStageMetric[];
    avgTimeByStatus: Record<IssueStatus, number>;
    longestAgingByStatus: Record<IssueStatus, JiraIssue[]>;
    blockedAging: JiraIssue[];
    bounceBackIssues: JiraIssue[];
    reopenTotal: number;
    cumulativeFlow: { date: string; open: number; closed: number; blocked: number }[];
}

export function calculateWorkflowMetrics(issues: JiraIssue[]): WorkflowMetrics {
    const byStatus = buildStatusCountRecord();
    const totalDuration = buildStatusCountRecord();
    const durationCounts = buildStatusCountRecord();

    for (const issue of issues) {
        byStatus[issue.status] += 1;

        const durations = getStatusDurations(issue);
        for (const status of ALL_STATUSES) {
            const value = durations[status] || 0;
            if (value > 0) {
                totalDuration[status] += value;
                durationCounts[status] += 1;
            }
        }
    }

    const avgTimeByStatus = buildStatusCountRecord();
    for (const status of ALL_STATUSES) {
        const count = durationCounts[status];
        avgTimeByStatus[status] = count > 0 ? Number((totalDuration[status] / count).toFixed(1)) : 0;
    }

    const longestAgingByStatus = ALL_STATUSES.reduce((acc, status) => {
        acc[status] = issues
            .filter((issue) => issue.status === status)
            .sort((a, b) => b.timeInCurrentStatus - a.timeInCurrentStatus)
            .slice(0, 3);
        return acc;
    }, {} as Record<IssueStatus, JiraIssue[]>);

    const byStage: WorkflowStageMetric[] = Object.entries(WORKFLOW_STAGE_STATUSES).map(
        ([stage, statuses]) => {
            const stageIssues = issues.filter((issue) => statuses.includes(issue.status));
            const totalTime = stageIssues.reduce((sum, issue) => sum + issue.timeInCurrentStatus, 0);
            return {
                stage: stage as WorkflowStage,
                label: STAGE_LABELS[stage as WorkflowStage],
                color: STAGE_COLORS[stage as WorkflowStage],
                statuses,
                count: stageIssues.length,
                avgDaysInStage: stageIssues.length > 0 ? Number((totalTime / stageIssues.length).toFixed(1)) : 0,
                oldestDays: stageIssues.length > 0 ? stageIssues[0].timeInCurrentStatus : 0,
            };
        }
    );

    const bounceBackIssues = issues.filter((issue) => {
        const statuses = issue.changelog
            .filter((entry) => includesText(entry.field, 'status') && isKnownStatus(entry.toString))
            .map((entry) => entry.toString as IssueStatus);

        if (statuses.length < 2) return false;

        for (let index = 1; index < statuses.length; index += 1) {
            const previous = getStatusIndex(statuses[index - 1]);
            const current = getStatusIndex(statuses[index]);
            if (previous > current) {
                return true;
            }
        }

        return false;
    });

    const cumulativeFlow: { date: string; open: number; closed: number; blocked: number }[] = [];
    for (let days = 13; days >= 0; days -= 1) {
        const day = endOfDay(subDays(new Date(), days));
        let open = 0;
        let closed = 0;
        let blocked = 0;

        for (const issue of issues) {
            const created = safeParseDate(issue.created);
            if (!created || created > day) continue;

            const resolved = safeParseDate(issue.resolved);
            const isClosedByDay = resolved ? resolved <= day : false;

            if (isClosedByDay) {
                closed += 1;
                continue;
            }

            open += 1;
            if (statusAtDate(issue, day) === 'Blocked') blocked += 1;
        }

        cumulativeFlow.push({
            date: format(day, 'MMM d'),
            open,
            closed,
            blocked,
        });
    }

    return {
        byStatus,
        byStage,
        avgTimeByStatus,
        longestAgingByStatus,
        blockedAging: issues
            .filter((issue) => issue.status === 'Blocked')
            .sort((a, b) => b.timeInCurrentStatus - a.timeInCurrentStatus),
        bounceBackIssues,
        reopenTotal: issues.reduce((sum, issue) => sum + issue.reopenCount, 0),
        cumulativeFlow,
    };
}

export interface BugsMetrics {
    total: number;
    open: number;
    inProgress: number;
    closed: number;
    byPriority: { priority: string; count: number }[];
    bySprint: { sprint: string; count: number }[];
    byAssignee: { assignee: string; count: number }[];
    byArea: { area: string; count: number }[];
    avgResolutionDays: number;
    oldestUnresolved: JiraIssue[];
    arrivalVsClosureTrend: { week: string; opened: number; closed: number }[];
}

export function calculateBugMetrics(issues: JiraIssue[]): BugsMetrics {
    const bugs = issues.filter((issue) => issue.issueType === 'Bug');

    const byPriorityMap = new Map<string, number>();
    const bySprintMap = new Map<string, number>();
    const byAssigneeMap = new Map<string, number>();
    const byAreaMap = new Map<string, number>();

    for (const bug of bugs) {
        const priority = bug.priority || 'No Priority';
        byPriorityMap.set(priority, (byPriorityMap.get(priority) || 0) + 1);

        const sprintName = bug.sprint?.name || 'No Sprint';
        bySprintMap.set(sprintName, (bySprintMap.get(sprintName) || 0) + 1);

        const assignee = bug.assignee?.displayName || 'Unassigned';
        byAssigneeMap.set(assignee, (byAssigneeMap.get(assignee) || 0) + 1);

        const area = bug.components[0] || formatEpicLabel(bug) || bug.project || 'General';
        byAreaMap.set(area, (byAreaMap.get(area) || 0) + 1);
    }

    const resolvedDurations = bugs
        .filter((bug) => isClosed(bug.status) && bug.leadTime !== null)
        .map((bug) => bug.leadTime as number);

    const avgResolutionDays =
        resolvedDurations.length > 0
            ? Number(
                (
                    resolvedDurations.reduce((sum, duration) => sum + duration, 0) /
                    resolvedDurations.length
                ).toFixed(1)
            )
            : 0;

    const arrivalVsClosureTrend: { week: string; opened: number; closed: number }[] = [];
    for (let weekOffset = 7; weekOffset >= 0; weekOffset -= 1) {
        const weekStart = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);

        const opened = bugs.filter((bug) => {
            const created = safeParseDate(bug.created);
            return created ? created >= weekStart && created <= endOfDay(weekEnd) : false;
        }).length;

        const closed = bugs.filter((bug) => {
            const resolved = safeParseDate(bug.resolved);
            return resolved ? resolved >= weekStart && resolved <= endOfDay(weekEnd) : false;
        }).length;

        arrivalVsClosureTrend.push({
            week: format(weekStart, 'MMM d'),
            opened,
            closed,
        });
    }

    return {
        total: bugs.length,
        open: bugs.filter((bug) => !isClosed(bug.status) && !isActive(bug.status)).length,
        inProgress: bugs.filter((bug) => isActive(bug.status)).length,
        closed: bugs.filter((bug) => isClosed(bug.status)).length,
        byPriority: [...byPriorityMap.entries()]
            .map(([priority, count]) => ({ priority, count }))
            .sort((a, b) => b.count - a.count),
        bySprint: [...bySprintMap.entries()]
            .map(([sprint, count]) => ({ sprint, count }))
            .sort((a, b) => b.count - a.count),
        byAssignee: [...byAssigneeMap.entries()]
            .map(([assignee, count]) => ({ assignee, count }))
            .sort((a, b) => b.count - a.count),
        byArea: [...byAreaMap.entries()]
            .map(([area, count]) => ({ area, count }))
            .sort((a, b) => b.count - a.count),
        avgResolutionDays,
        oldestUnresolved: bugs
            .filter((bug) => !isClosed(bug.status))
            .sort((a, b) => b.age - a.age)
            .slice(0, 10),
        arrivalVsClosureTrend,
    };
}

export interface AgingMetrics {
    unresolvedCount: number;
    buckets: { label: string; min: number; max: number; count: number; issues: JiraIssue[] }[];
    byStatus: { status: string; count: number }[];
    byAssignee: { assignee: string; count: number }[];
    byIssueType: { issueType: string; count: number }[];
    stale: JiraIssue[];
    staleBlocked: JiraIssue[];
    oldestUnresolved: JiraIssue[];
}

export function calculateAgingMetrics(
    issues: JiraIssue[],
    staleDays = 7
): AgingMetrics {
    const unresolved = issues.filter((issue) => !isClosed(issue.status));

    const ranges = [
        { label: '0-7', min: 0, max: 7 },
        { label: '8-14', min: 8, max: 14 },
        { label: '15-30', min: 15, max: 30 },
        { label: '30+', min: 31, max: Number.MAX_SAFE_INTEGER },
    ];

    const buckets = ranges.map((range) => {
        const bucketIssues = unresolved.filter(
            (issue) => issue.age >= range.min && issue.age <= range.max
        );
        return {
            label: range.label,
            min: range.min,
            max: range.max,
            count: bucketIssues.length,
            issues: bucketIssues,
        };
    });

    const byStatusMap = new Map<string, number>();
    const byAssigneeMap = new Map<string, number>();
    const byIssueTypeMap = new Map<string, number>();

    for (const issue of unresolved) {
        byStatusMap.set(issue.status, (byStatusMap.get(issue.status) || 0) + 1);

        const assignee = issue.assignee?.displayName || 'Unassigned';
        byAssigneeMap.set(assignee, (byAssigneeMap.get(assignee) || 0) + 1);

        byIssueTypeMap.set(issue.issueType, (byIssueTypeMap.get(issue.issueType) || 0) + 1);
    }

    const stale = unresolved
        .filter((issue) => issue.timeInCurrentStatus >= staleDays)
        .sort((a, b) => b.timeInCurrentStatus - a.timeInCurrentStatus);

    return {
        unresolvedCount: unresolved.length,
        buckets,
        byStatus: [...byStatusMap.entries()]
            .map(([status, count]) => ({ status, count }))
            .sort((a, b) => b.count - a.count),
        byAssignee: [...byAssigneeMap.entries()]
            .map(([assignee, count]) => ({ assignee, count }))
            .sort((a, b) => b.count - a.count),
        byIssueType: [...byIssueTypeMap.entries()]
            .map(([issueType, count]) => ({ issueType, count }))
            .sort((a, b) => b.count - a.count),
        stale,
        staleBlocked: stale.filter((issue) => issue.status === 'Blocked'),
        oldestUnresolved: [...unresolved].sort((a, b) => b.age - a.age).slice(0, 15),
    };
}

export interface DeliveryOutcomesMetrics {
    completedBySprint: { sprint: string; completed: number; storyPoints: number }[];
    releaseReady: JiraIssue[];
    doneByEpic: { epic: string; count: number }[];
    featureDeliveryTrend: { week: string; completedFeatures: number }[];
    avgCycleTime: number;
    avgLeadTime: number;
    throughputBySprint: { sprint: string; count: number }[];
    throughputByAssignee: { assignee: string; count: number }[];
    doneVsRejectedRatio: number;
    boardHealthScore: number;
    attentionNeeded: JiraIssue[];
}

export function calculateDeliveryOutcomesMetrics(issues: JiraIssue[]): DeliveryOutcomesMetrics {
    const doneIssues = issues.filter((issue) => issue.status === 'Done');
    const rejectedIssues = issues.filter((issue) => issue.status === 'Rejected');
    const closedIssues = issues.filter((issue) => isClosed(issue.status));

    const sprintMap = new Map<string, { sprint: string; completed: number; storyPoints: number }>();
    const assigneeMap = new Map<string, number>();
    const epicMap = new Map<string, number>();

    for (const issue of closedIssues) {
        const sprint = issue.sprint?.name || 'No Sprint';
        const sprintRow = sprintMap.get(sprint) || { sprint, completed: 0, storyPoints: 0 };
        sprintRow.completed += 1;
        sprintRow.storyPoints += issue.storyPoints || 0;
        sprintMap.set(sprint, sprintRow);

        const assignee = issue.assignee?.displayName || 'Unassigned';
        assigneeMap.set(assignee, (assigneeMap.get(assignee) || 0) + 1);

        const epic = formatEpicLabel(issue);
        epicMap.set(epic, (epicMap.get(epic) || 0) + 1);
    }

    const cycleTimes = doneIssues
        .map((issue) => issue.cycleTime)
        .filter((value): value is number => value !== null);

    const leadTimes = doneIssues
        .map((issue) => issue.leadTime)
        .filter((value): value is number => value !== null);

    const avgCycleTime =
        cycleTimes.length > 0
            ? Number((cycleTimes.reduce((sum, value) => sum + value, 0) / cycleTimes.length).toFixed(1))
            : 0;

    const avgLeadTime =
        leadTimes.length > 0
            ? Number((leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length).toFixed(1))
            : 0;

    const featureDeliveryTrend: { week: string; completedFeatures: number }[] = [];
    const featureDone = doneIssues.filter((issue) => {
        const bucket = getWorkMixBucket(issue);
        return bucket === 'Feature Request';
    });

    for (let weekOffset = 7; weekOffset >= 0; weekOffset -= 1) {
        const weekStart = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);

        const completedFeatures = featureDone.filter((issue) => {
            const resolved = safeParseDate(issue.resolved);
            return resolved ? resolved >= weekStart && resolved <= endOfDay(weekEnd) : false;
        }).length;

        featureDeliveryTrend.push({
            week: format(weekStart, 'MMM d'),
            completedFeatures,
        });
    }

    const activeIssues = issues.filter((issue) => !isClosed(issue.status));
    const blockedRate =
        activeIssues.length > 0
            ? activeIssues.filter((issue) => issue.status === 'Blocked').length / activeIssues.length
            : 0;
    const staleRate =
        activeIssues.length > 0
            ? activeIssues.filter((issue) => issue.timeInCurrentStatus >= 7).length / activeIssues.length
            : 0;
    const reopenPenalty = Math.min(0.2, issues.reduce((sum, issue) => sum + issue.reopenCount, 0) / 100);

    const boardHealthScore = Math.max(
        0,
        Math.round(100 - blockedRate * 35 - staleRate * 25 - reopenPenalty * 100)
    );

    const attentionNeeded = [...issues]
        .filter((issue) => {
            if (issue.status === 'Blocked') return true;
            if (!isClosed(issue.status) && issue.timeInCurrentStatus >= 10) return true;
            if (issue.priority === 'Highest' && !isClosed(issue.status)) return true;
            return false;
        })
        .sort((a, b) => {
            if (a.status === 'Blocked' && b.status !== 'Blocked') return -1;
            if (b.status === 'Blocked' && a.status !== 'Blocked') return 1;
            return b.timeInCurrentStatus - a.timeInCurrentStatus;
        })
        .slice(0, 15);

    return {
        completedBySprint: [...sprintMap.values()].sort((a, b) => b.sprint.localeCompare(a.sprint)),
        releaseReady: issues
            .filter(
                (issue) =>
                    issue.status === 'Ready for Acceptance' || issue.status === 'Ready for Release'
            )
            .sort((a, b) => b.updated.localeCompare(a.updated)),
        doneByEpic: [...epicMap.entries()]
            .map(([epic, count]) => ({ epic, count }))
            .sort((a, b) => b.count - a.count),
        featureDeliveryTrend,
        avgCycleTime,
        avgLeadTime,
        throughputBySprint: [...sprintMap.values()]
            .map((item) => ({ sprint: item.sprint, count: item.completed }))
            .sort((a, b) => b.sprint.localeCompare(a.sprint)),
        throughputByAssignee: [...assigneeMap.entries()]
            .map(([assignee, count]) => ({ assignee, count }))
            .sort((a, b) => b.count - a.count),
        doneVsRejectedRatio: rejectedIssues.length > 0
            ? Number((doneIssues.length / rejectedIssues.length).toFixed(2))
            : doneIssues.length,
        boardHealthScore,
        attentionNeeded,
    };
}
