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
import {
    IssueStatus,
    JiraIssue,
    Sprint,
    SprintMixChange,
    WorkflowGroup,
    WorkflowStage,
} from '@/types';
import {
    ACTIVE_STATUSES,
    ALL_STATUSES,
    CLOSED_STATUSES,
    STAGE_COLORS,
    STAGE_LABELS,
    WORKFLOW_STAGE_STATUSES,
} from './workflow';
import { formatEpicLabel, isEpicIssue } from './issue-format';
import { applyGroupFilter, getDaysUntilDue } from './filters';
import {
    getStageIndexByGroup,
    resolveWorkflowGroup,
    WORKFLOW_GROUP_ORDER,
} from './workflow-groups';

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

function scopeIssuesByGroupFilter(
    issues: JiraIssue[],
    groupFilter?: WorkflowGroup[]
): JiraIssue[] {
    if (!groupFilter || groupFilter.length === 0) return issues;
    return applyGroupFilter(issues, groupFilter);
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

export interface StoryPointsCoverage {
    coveredCount: number;
    totalCount: number;
    coveragePercent: number;
}

interface StoryPointsCoverageOptions {
    excludeIssueTypes?: string[];
}

export function hasStoryPointsCoverage(
    issues: JiraIssue[],
    options: StoryPointsCoverageOptions = {}
): StoryPointsCoverage {
    const excludedTypes = new Set(
        (options.excludeIssueTypes || []).map((type) => type.trim().toLowerCase())
    );

    const coverageScope = issues.filter((issue) => {
        if (excludedTypes.size === 0) return true;
        return !excludedTypes.has((issue.issueType || '').toLowerCase());
    });

    const totalCount = coverageScope.length;
    const coveredCount = coverageScope.filter((issue) => issue.storyPoints !== null && issue.storyPoints !== undefined).length;
    const coveragePercent = totalCount > 0
        ? Math.round((coveredCount / totalCount) * 100)
        : 100;

    return {
        coveredCount,
        totalCount,
        coveragePercent,
    };
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

export interface VelocityTrendPoint {
    sprintName: string;
    sprintEndDate: string;
    completedPoints: number;
    completedTickets: number;
    rollingAvg3Sprint: number;
}

export interface CapacitySprintPoint {
    sprintId: number;
    sprintName: string;
    sprintState: Sprint['state'] | 'unknown';
    sprintEndDate: string;
    committed: number;
    completed: number;
    completionRate: number;
}

export interface CapacityData {
    committed: number;
    completed: number;
    completionRate: number;
    forecast3Sprint: number;
    teamCapacityDelta: number;
    rollingAvgCompletionRate: number;
    bySprint: CapacitySprintPoint[];
    historical3Sprint: CapacitySprintPoint[];
    targetSprintId: number | null;
    targetSprintName: string;
    forecastConfidenceLow: number;
    forecastConfidenceHigh: number;
}

export type CycleLeadMetric = 'cycle' | 'lead';

export interface CycleLeadTimeDistributionFilters {
    metric?: CycleLeadMetric;
    issueTypes?: string[];
    bucketSizeDays?: number;
    groupFilter?: WorkflowGroup[];
}

export interface DistributionPercentiles {
    p50: number;
    p75: number;
    p95: number;
}

export interface DistributionDataPoint {
    key: string;
    issueType: string;
    days: number;
}

export interface DistributionIssueTypeGroup {
    issueType: string;
    percentiles: DistributionPercentiles;
    rawData: DistributionDataPoint[];
}

export interface DistributionHistogramBin {
    bucket: string;
    minDays: number;
    maxDays: number;
    count: number;
}

export interface CycleLeadTimeDistribution {
    metric: CycleLeadMetric;
    totalPoints: number;
    percentiles: DistributionPercentiles;
    histogram: DistributionHistogramBin[];
    byIssueType: DistributionIssueTypeGroup[];
}

function percentileFromSorted(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const rank = Math.ceil(percentile * sortedValues.length);
    const index = Math.min(sortedValues.length - 1, Math.max(0, rank - 1));
    return sortedValues[index];
}

function calculateDistributionPercentiles(values: number[]): DistributionPercentiles {
    if (values.length === 0) {
        return { p50: 0, p75: 0, p95: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    return {
        p50: Number(percentileFromSorted(sorted, 0.5).toFixed(1)),
        p75: Number(percentileFromSorted(sorted, 0.75).toFixed(1)),
        p95: Number(percentileFromSorted(sorted, 0.95).toFixed(1)),
    };
}

function chooseDistributionBucketSize(maxDays: number): number {
    if (maxDays <= 14) return 2;
    if (maxDays <= 35) return 5;
    if (maxDays <= 70) return 7;
    return 14;
}

function buildDistributionHistogram(
    values: number[],
    bucketSizeDays: number
): DistributionHistogramBin[] {
    if (values.length === 0) return [];

    const safeBucketSize = Math.max(1, bucketSizeDays);
    const sorted = [...values].sort((a, b) => a - b);
    const maxValue = sorted[sorted.length - 1];
    const bins: DistributionHistogramBin[] = [];

    for (let start = 0; start <= maxValue; start += safeBucketSize) {
        const end = start + safeBucketSize - 1;
        const count = sorted.filter((value) => value >= start && value <= end).length;
        bins.push({
            bucket: `${start}-${end}d`,
            minDays: start,
            maxDays: end,
            count,
        });
    }

    return bins;
}

function getLeadTimeDays(issue: JiraIssue): number | null {
    const created = safeParseDate(issue.created);
    const resolved = safeParseDate(issue.resolved);
    if (!created || !resolved) return null;
    return Math.max(0, differenceInCalendarDays(resolved, created));
}

function getCycleTimeDays(issue: JiraIssue): number | null {
    const resolved = safeParseDate(issue.resolved);
    if (!resolved) return null;

    const inProgressTransition = issue.changelog
        .filter((entry) => includesText(entry.field, 'status') && entry.toString === 'In Progress')
        .sort((a, b) => a.created.localeCompare(b.created))[0];

    const inProgressDate = safeParseDate(inProgressTransition?.created || null);
    if (!inProgressDate) return null;

    return Math.max(0, differenceInCalendarDays(resolved, inProgressDate));
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

export function getVelocityTrend(
    issues: JiraIssue[],
    projectKey?: string
): VelocityTrendPoint[] {
    type Aggregate = {
        sprintName: string;
        sprintEndDate: string;
        completedPoints: number;
        completedTickets: number;
        sortTime: number;
    };

    const bySprint = new Map<number, Aggregate>();

    for (const issue of issues) {
        if (!issue.sprint) continue;
        if (!isClosed(issue.status)) continue;
        if (projectKey && issue.project !== projectKey) continue;

        const sprintDate =
            safeParseDate(issue.sprint.completeDate) ||
            safeParseDate(issue.sprint.endDate) ||
            safeParseDate(issue.resolved) ||
            safeParseDate(issue.updated) ||
            safeParseDate(issue.created) ||
            new Date(0);

        const key = issue.sprint.id;
        const existing = bySprint.get(key);
        if (!existing) {
            bySprint.set(key, {
                sprintName: issue.sprint.name || `Sprint ${issue.sprint.id}`,
                sprintEndDate: format(sprintDate, 'yyyy-MM-dd'),
                completedPoints: issue.storyPoints || 0,
                completedTickets: 1,
                sortTime: sprintDate.getTime(),
            });
            continue;
        }

        existing.completedPoints += issue.storyPoints || 0;
        existing.completedTickets += 1;

        const sprintTime = sprintDate.getTime();
        if (sprintTime > existing.sortTime) {
            existing.sortTime = sprintTime;
            existing.sprintEndDate = format(sprintDate, 'yyyy-MM-dd');
        }
    }

    const ordered = [...bySprint.values()].sort((a, b) => a.sortTime - b.sortTime);

    return ordered.map((row, index) => {
        const windowStart = Math.max(0, index - 2);
        const window = ordered.slice(windowStart, index + 1);
        const rollingAvg3Sprint =
            window.reduce((sum, item) => sum + item.completedPoints, 0) / window.length;

        return {
            sprintName: row.sprintName,
            sprintEndDate: row.sprintEndDate,
            completedPoints: row.completedPoints,
            completedTickets: row.completedTickets,
            rollingAvg3Sprint: Number(rollingAvg3Sprint.toFixed(1)),
        };
    });
}

function average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = average(values);
    const variance =
        values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}

function safeRound(value: number, decimals = 1): number {
    return Number(value.toFixed(decimals));
}

export function getCapacityData(
    input: JiraIssue[] | { issues: JiraIssue[]; sprintId?: number },
    sprintId?: number
): CapacityData {
    const issues = Array.isArray(input) ? input : input.issues;
    const targetSprintId = Array.isArray(input) ? sprintId : input.sprintId;

    type Aggregate = {
        sprintId: number;
        sprintName: string;
        sprintState: Sprint['state'] | 'unknown';
        sprintEndDate: string;
        sortTime: number;
        committed: number;
        completed: number;
    };

    const bySprint = new Map<number, Aggregate>();
    for (const issue of issues) {
        if (!issue.sprint) continue;
        const id = issue.sprint.id;
        const sprintDate =
            safeParseDate(issue.sprint.completeDate) ||
            safeParseDate(issue.sprint.endDate) ||
            safeParseDate(issue.sprint.startDate) ||
            safeParseDate(issue.updated) ||
            safeParseDate(issue.created) ||
            new Date(0);

        const existing = bySprint.get(id) || {
            sprintId: id,
            sprintName: issue.sprint.name || `Sprint ${id}`,
            sprintState: issue.sprint.state || 'unknown',
            sprintEndDate: format(sprintDate, 'yyyy-MM-dd'),
            sortTime: sprintDate.getTime(),
            committed: 0,
            completed: 0,
        };

        existing.committed += issue.storyPoints || 0;
        if (isClosed(issue.status)) {
            existing.completed += issue.storyPoints || 0;
        }

        const sprintTime = sprintDate.getTime();
        if (sprintTime > existing.sortTime) {
            existing.sortTime = sprintTime;
            existing.sprintEndDate = format(sprintDate, 'yyyy-MM-dd');
        }
        existing.sprintState = issue.sprint.state || existing.sprintState;
        bySprint.set(id, existing);
    }

    const ordered = [...bySprint.values()]
        .sort((a, b) => a.sortTime - b.sortTime)
        .map<CapacitySprintPoint>((row) => ({
            sprintId: row.sprintId,
            sprintName: row.sprintName,
            sprintState: row.sprintState,
            sprintEndDate: row.sprintEndDate,
            committed: safeRound(row.committed),
            completed: safeRound(row.completed),
            completionRate:
                row.committed > 0
                    ? safeRound((row.completed / row.committed) * 100)
                    : 0,
        }));

    const target =
        (targetSprintId !== undefined
            ? ordered.find((row) => row.sprintId === targetSprintId)
            : undefined) ||
        ordered.find((row) => row.sprintState === 'active') ||
        ordered[ordered.length - 1] ||
        null;

    const priorClosed = target
        ? ordered.filter(
            (row) => row.sprintState === 'closed' && row.sprintId !== target.sprintId
        )
        : ordered.filter((row) => row.sprintState === 'closed');

    const historical3Sprint = priorClosed.slice(-3);
    const historicalRates = historical3Sprint
        .filter((row) => row.committed > 0)
        .map((row) => row.completed / row.committed);
    const rollingRate = average(historicalRates);
    const rollingAvgCompletionRate = safeRound(rollingRate * 100, 1);

    const committed = target?.committed || 0;
    const completed = target?.completed || 0;
    const completionRate = target?.completionRate || 0;

    // Forecast uses rolling 3-sprint completion rate × committed points.
    const forecast3Sprint = safeRound(committed * rollingRate, 1);
    const teamCapacityDelta = safeRound(forecast3Sprint - committed, 1);

    const rateStdDev = standardDeviation(historicalRates);
    const lowRate = Math.max(0, rollingRate - rateStdDev);
    const highRate = Math.min(1, rollingRate + rateStdDev);
    const forecastConfidenceLow = safeRound(committed * lowRate, 1);
    const forecastConfidenceHigh = safeRound(committed * highRate, 1);

    return {
        committed,
        completed,
        completionRate,
        forecast3Sprint,
        teamCapacityDelta,
        rollingAvgCompletionRate,
        bySprint: ordered.slice(-6),
        historical3Sprint,
        targetSprintId: target?.sprintId || null,
        targetSprintName: target?.sprintName || 'Current / Next Sprint',
        forecastConfidenceLow,
        forecastConfidenceHigh,
    };
}

export function getCycleLeadTimeDistribution(
    input: JiraIssue[] | (CycleLeadTimeDistributionFilters & { issues: JiraIssue[] }),
    filters: CycleLeadTimeDistributionFilters = {}
): CycleLeadTimeDistribution {
    const issues = Array.isArray(input) ? input : input.issues;
    const distributionFilters = Array.isArray(input) ? filters : input;
    const scopedIssues = scopeIssuesByGroupFilter(issues, distributionFilters.groupFilter);
    const metric: CycleLeadMetric = distributionFilters.metric || 'cycle';
    const selectedTypes = new Set((distributionFilters.issueTypes || []).map((type) => type.toLowerCase()));
    const grouped = new Map<string, DistributionDataPoint[]>();

    for (const issue of scopedIssues) {
        if (selectedTypes.size > 0 && !selectedTypes.has(issue.issueType.toLowerCase())) {
            continue;
        }

        const days =
            metric === 'lead'
                ? getLeadTimeDays(issue)
                : getCycleTimeDays(issue);

        if (days === null) continue;

        const points = grouped.get(issue.issueType) || [];
        points.push({
            key: issue.key,
            issueType: issue.issueType,
            days,
        });
        grouped.set(issue.issueType, points);
    }

    const byIssueType: DistributionIssueTypeGroup[] = [...grouped.entries()]
        .map(([issueType, rawData]) => {
            const values = rawData.map((point) => point.days);
            return {
                issueType,
                percentiles: calculateDistributionPercentiles(values),
                rawData: [...rawData].sort((a, b) => a.days - b.days),
            };
        })
        .sort((a, b) => b.rawData.length - a.rawData.length);

    const allValues = byIssueType.flatMap((group) => group.rawData.map((point) => point.days));
    const maxDays = allValues.length > 0 ? Math.max(...allValues) : 0;
    const bucketSizeDays = distributionFilters.bucketSizeDays || chooseDistributionBucketSize(maxDays);

    return {
        metric,
        totalPoints: allValues.length,
        percentiles: calculateDistributionPercentiles(allValues),
        histogram: buildDistributionHistogram(allValues, bucketSizeDays),
        byIssueType,
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

export interface AssigneeWorkloadFilters {
    workloadThreshold?: number;
    now?: Date;
    includeUnassigned?: boolean;
    groupFilter?: WorkflowGroup[];
}

export interface AssigneeWorkloadRow {
    accountId: string | null;
    displayName: string;
    avatarUrl: string | null;
    openTickets: number;
    openPoints: number;
    inProgressTickets: number;
    inProgressPoints: number;
    blockedCount: number;
    overdueCount: number;
    totalPoints: number;
    overloaded: boolean;
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

export function getAssigneeWorkload(
    input: JiraIssue[] | ({ issues: JiraIssue[] } & AssigneeWorkloadFilters),
    filters: AssigneeWorkloadFilters = {}
): AssigneeWorkloadRow[] {
    const issues = Array.isArray(input) ? input : input.issues;
    const resolvedFilters = Array.isArray(input) ? filters : input;
    const scopedIssues = scopeIssuesByGroupFilter(issues, resolvedFilters.groupFilter);
    const workloadThreshold = resolvedFilters.workloadThreshold ?? 13;
    const now = resolvedFilters.now || new Date();
    const includeUnassigned = resolvedFilters.includeUnassigned === true;

    const byAssignee = new Map<string, AssigneeWorkloadRow>();

    for (const issue of scopedIssues) {
        if (isClosed(issue.status)) continue;

        const assigneeId = issue.assignee?.accountId || null;
        const assigneeName = issue.assignee?.displayName || 'Unassigned';

        if (!includeUnassigned && !assigneeId) continue;

        const key = assigneeId || 'unassigned';
        const row = byAssignee.get(key) || {
            accountId: assigneeId,
            displayName: assigneeName,
            avatarUrl: issue.assignee?.avatarUrl || null,
            openTickets: 0,
            openPoints: 0,
            inProgressTickets: 0,
            inProgressPoints: 0,
            blockedCount: 0,
            overdueCount: 0,
            totalPoints: 0,
            overloaded: false,
        };

        const points = issue.storyPoints || 0;
        if (issue.status === 'In Progress') {
            row.inProgressTickets += 1;
            row.inProgressPoints += points;
        } else {
            row.openTickets += 1;
            row.openPoints += points;
        }

        if (issue.status === 'Blocked') {
            row.blockedCount += 1;
        }

        const daysUntilDue = getDaysUntilDue(issue, now);
        if (daysUntilDue !== null && daysUntilDue < 0) {
            row.overdueCount += 1;
        }

        byAssignee.set(key, row);
    }

    return [...byAssignee.values()]
        .map((row) => {
            const totalPoints = Number((row.openPoints + row.inProgressPoints).toFixed(1));
            return {
                ...row,
                totalPoints,
                openPoints: Number(row.openPoints.toFixed(1)),
                inProgressPoints: Number(row.inProgressPoints.toFixed(1)),
                overloaded: totalPoints > workloadThreshold,
            };
        })
        .sort((a, b) => {
            if (a.overloaded !== b.overloaded) return a.overloaded ? -1 : 1;
            if (b.openPoints !== a.openPoints) return b.openPoints - a.openPoints;
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            return a.displayName.localeCompare(b.displayName);
        });
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

export type StatusTransitionDirection = 'forward' | 'backward' | 'lateral';
export type StatusTransitionView = 'all' | 'bottleneck';

export interface StatusTransitionPair {
    fromStatus: string;
    toStatus: string;
    count: number;
    direction: StatusTransitionDirection;
}

export interface StatusTransitionFlowFilters {
    view?: StatusTransitionView;
    groupFilter?: WorkflowGroup[];
}

export interface StatusTransitionFlow {
    transitions: StatusTransitionPair[];
    ticketsWithBackward: number;
    totalTickets: number;
    backwardTicketPercent: number;
    nodeTicketCounts: Record<string, number>;
    bottleneckStatuses: string[];
    avgTimeByStatus: Record<string, number>;
    medianStatusDays: number;
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
}

function getTransitionDirection(fromStatus: string, toStatus: string): StatusTransitionDirection {
    const fromIndex = getStageIndexByGroup(fromStatus);
    const toIndex = getStageIndexByGroup(toStatus);

    if (toIndex > fromIndex) return 'forward';
    if (toIndex < fromIndex) return 'backward';
    return 'lateral';
}

export function getStatusTransitionFlow(
    input: JiraIssue[] | ({ issues: JiraIssue[] } & StatusTransitionFlowFilters),
    filters: StatusTransitionFlowFilters = {}
): StatusTransitionFlow {
    const issues = Array.isArray(input) ? input : input.issues;
    const resolvedFilters = Array.isArray(input) ? filters : input;
    const scopedIssues = scopeIssuesByGroupFilter(issues, resolvedFilters.groupFilter);
    const view: StatusTransitionView = resolvedFilters.view || 'all';

    const transitionMap = new Map<string, StatusTransitionPair>();
    const groupDurationTotal = new Map<string, number>();
    const groupDurationCount = new Map<string, number>();
    const groupTicketSets = new Map<string, Set<string>>();

    let ticketsWithBackward = 0;
    const totalTickets = scopedIssues.length;

    for (const issue of scopedIssues) {
        const statusChanges = issue.changelog
            .filter((entry) => includesText(entry.field, 'status'))
            .sort((a, b) => a.created.localeCompare(b.created));

        const touchedGroups = new Set<string>();
        let sawBackward = false;

        for (const change of statusChanges) {
            const fromGroup = resolveWorkflowGroup(change.fromString);
            const toGroup = resolveWorkflowGroup(change.toString);
            if (!fromGroup || !toGroup || fromGroup === toGroup) continue;

            touchedGroups.add(fromGroup);
            touchedGroups.add(toGroup);

            const direction = getTransitionDirection(fromGroup, toGroup);
            if (direction === 'backward') sawBackward = true;

            const key = `${fromGroup}||${toGroup}`;
            const existing = transitionMap.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                transitionMap.set(key, {
                    fromStatus: fromGroup,
                    toStatus: toGroup,
                    count: 1,
                    direction,
                });
            }
        }

        if (sawBackward) ticketsWithBackward += 1;

        const durations = getStatusDurations(issue);
        for (const [status, value] of Object.entries(durations)) {
            if (!value || value <= 0) continue;
            const group = resolveWorkflowGroup(status);
            if (!group) continue;
            touchedGroups.add(group);
            groupDurationTotal.set(group, (groupDurationTotal.get(group) || 0) + value);
            groupDurationCount.set(group, (groupDurationCount.get(group) || 0) + 1);
        }

        const currentGroup = resolveWorkflowGroup(issue.status);
        if (currentGroup) {
            touchedGroups.add(currentGroup);
        }

        for (const group of touchedGroups) {
            const keys = groupTicketSets.get(group) || new Set<string>();
            keys.add(issue.key);
            groupTicketSets.set(group, keys);
        }
    }

    const avgTimeByStatus: Record<string, number> = {};
    for (const [group, total] of groupDurationTotal.entries()) {
        const count = groupDurationCount.get(group) || 0;
        if (count <= 0) continue;
        avgTimeByStatus[group] = Number((total / count).toFixed(1));
    }

    const medianStatusDays = median(Object.values(avgTimeByStatus));
    const bottleneckStatuses = Object.entries(avgTimeByStatus)
        .filter(([, avg]) => medianStatusDays > 0 && avg > medianStatusDays * 2)
        .map(([status]) => status);

    let transitions = [...transitionMap.values()].sort((a, b) => {
        const fromDiff = getStageIndexByGroup(a.fromStatus) - getStageIndexByGroup(b.fromStatus);
        if (fromDiff !== 0) return fromDiff;
        const toDiff = getStageIndexByGroup(a.toStatus) - getStageIndexByGroup(b.toStatus);
        if (toDiff !== 0) return toDiff;
        return b.count - a.count;
    });
    if (view === 'bottleneck') {
        const bottleneckSet = new Set(bottleneckStatuses);
        transitions = transitions.filter((pair) => bottleneckSet.has(pair.fromStatus));
    }

    const nodeTicketCounts = Object.fromEntries(
        WORKFLOW_GROUP_ORDER.map((group) => [group, groupTicketSets.get(group)?.size || 0])
    ) as Record<string, number>;

    return {
        transitions,
        ticketsWithBackward,
        totalTickets,
        backwardTicketPercent: safePercent(ticketsWithBackward, totalTickets),
        nodeTicketCounts,
        bottleneckStatuses,
        avgTimeByStatus,
        medianStatusDays: Number(medianStatusDays.toFixed(1)),
    };
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

export type SLAUrgency =
    | 'Overdue'
    | 'Due Today'
    | 'Due This Week'
    | 'Due Soon'
    | 'On Track';

export interface SLAIssueRow {
    issue: JiraIssue;
    dueDate: string;
    daysUntilDue: number;
    urgency: SLAUrgency;
    urgencyRank: number;
}

export interface SLAStatusFilters {
    includeResolved?: boolean;
    now?: Date;
    groupFilter?: WorkflowGroup[];
}

export interface SLAStatusMetrics {
    totalWithDueDate: number;
    byUrgency: Record<SLAUrgency, number>;
    rows: SLAIssueRow[];
    atRisk: SLAIssueRow[];
}

export interface SLATrendPoint {
    date: string;
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    atRisk: number;
    totalTracked: number;
}

export interface SLATrendFilters {
    days?: number;
    now?: Date;
    includeResolved?: boolean;
    groupFilter?: WorkflowGroup[];
}

export interface SLAAssigneeBreachRow {
    assignee: string;
    tracked: number;
    atRisk: number;
    overdue: number;
    dueToday: number;
    breachRate: number;
}

export interface SLAAssigneeBreachFilters {
    now?: Date;
    includeResolved?: boolean;
    groupFilter?: WorkflowGroup[];
}

function getSLAUrgency(daysUntilDue: number): SLAUrgency {
    if (daysUntilDue < 0) return 'Overdue';
    if (daysUntilDue === 0) return 'Due Today';
    if (daysUntilDue <= 7) return 'Due This Week';
    if (daysUntilDue <= 14) return 'Due Soon';
    return 'On Track';
}

function getSLAUrgencyRank(urgency: SLAUrgency): number {
    switch (urgency) {
    case 'Overdue':
        return 0;
    case 'Due Today':
        return 1;
    case 'Due This Week':
        return 2;
    case 'Due Soon':
        return 3;
    case 'On Track':
    default:
        return 4;
    }
}

function buildSLAUrgencyCount(): Record<SLAUrgency, number> {
    return {
        Overdue: 0,
        'Due Today': 0,
        'Due This Week': 0,
        'Due Soon': 0,
        'On Track': 0,
    };
}

function isIssueOpenAtDate(issue: JiraIssue, date: Date): boolean {
    const created = safeParseDate(issue.created);
    if (!created) return false;
    if (created > endOfDay(date)) return false;

    const resolved = safeParseDate(issue.resolved);
    if (!resolved) return true;
    return resolved > endOfDay(date);
}

export function getSLAStatus(
    input: JiraIssue[] | ({ issues: JiraIssue[] } & SLAStatusFilters),
    filters: SLAStatusFilters = {}
): SLAStatusMetrics {
    const issues = Array.isArray(input) ? input : input.issues;
    const resolvedFilters = Array.isArray(input) ? filters : input;
    const scopedIssues = scopeIssuesByGroupFilter(issues, resolvedFilters.groupFilter);
    const includeResolved = Boolean(resolvedFilters.includeResolved);
    const now = resolvedFilters.now || new Date();

    const byUrgency = buildSLAUrgencyCount();
    const rows: SLAIssueRow[] = [];
    let totalWithDueDate = 0;

    for (const issue of scopedIssues) {
        const hasDueDate = Boolean(issue.dueDate);
        if (!hasDueDate) continue;
        if (!includeResolved && isClosed(issue.status)) continue;

        const daysUntilDue = getDaysUntilDue(issue, now);
        if (daysUntilDue === null) continue;
        totalWithDueDate += 1;

        const urgency = getSLAUrgency(daysUntilDue);
        byUrgency[urgency] += 1;
        rows.push({
            issue,
            dueDate: issue.dueDate as string,
            daysUntilDue,
            urgency,
            urgencyRank: getSLAUrgencyRank(urgency),
        });
    }

    rows.sort((a, b) => {
        if (a.daysUntilDue !== b.daysUntilDue) return a.daysUntilDue - b.daysUntilDue;
        return b.issue.updated.localeCompare(a.issue.updated);
    });

    return {
        totalWithDueDate,
        byUrgency,
        rows,
        atRisk: rows.filter((row) => row.urgency === 'Overdue' || row.urgency === 'Due Today'),
    };
}

export function getSLATrend(
    input: JiraIssue[] | ({ issues: JiraIssue[] } & SLATrendFilters),
    filters: SLATrendFilters = {}
): SLATrendPoint[] {
    const issues = Array.isArray(input) ? input : input.issues;
    const resolvedFilters = Array.isArray(input) ? filters : input;
    const scopedIssues = scopeIssuesByGroupFilter(issues, resolvedFilters.groupFilter);
    const now = resolvedFilters.now || new Date();
    const days = Math.max(7, resolvedFilters.days || 28);
    const includeResolved = Boolean(resolvedFilters.includeResolved);

    const points: SLATrendPoint[] = [];

    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const day = startOfDay(subDays(now, offset));
        let overdue = 0;
        let dueToday = 0;
        let dueThisWeek = 0;
        let totalTracked = 0;

        for (const issue of scopedIssues) {
            if (!issue.dueDate) continue;
            if (!includeResolved && !isIssueOpenAtDate(issue, day)) continue;

            const daysUntilDue = getDaysUntilDue(issue, day);
            if (daysUntilDue === null) continue;

            totalTracked += 1;
            if (daysUntilDue < 0) {
                overdue += 1;
            } else if (daysUntilDue === 0) {
                dueToday += 1;
            } else if (daysUntilDue <= 7) {
                dueThisWeek += 1;
            }
        }

        points.push({
            date: format(day, 'MMM d'),
            overdue,
            dueToday,
            dueThisWeek,
            atRisk: overdue + dueToday,
            totalTracked,
        });
    }

    return points;
}

export function getSLAAssigneeBreach(
    input: JiraIssue[] | ({ issues: JiraIssue[] } & SLAAssigneeBreachFilters),
    filters: SLAAssigneeBreachFilters = {}
): SLAAssigneeBreachRow[] {
    const issues = Array.isArray(input) ? input : input.issues;
    const resolvedFilters = Array.isArray(input) ? filters : input;
    const scopedIssues = scopeIssuesByGroupFilter(issues, resolvedFilters.groupFilter);
    const now = resolvedFilters.now || new Date();
    const includeResolved = Boolean(resolvedFilters.includeResolved);

    const byAssignee = new Map<string, SLAAssigneeBreachRow>();

    for (const issue of scopedIssues) {
        if (!issue.dueDate) continue;
        if (!includeResolved && !isIssueOpenAtDate(issue, now)) continue;

        const daysUntilDue = getDaysUntilDue(issue, now);
        if (daysUntilDue === null) continue;

        const assignee = issue.assignee?.displayName || 'Unassigned';
        const row = byAssignee.get(assignee) || {
            assignee,
            tracked: 0,
            atRisk: 0,
            overdue: 0,
            dueToday: 0,
            breachRate: 0,
        };

        row.tracked += 1;
        if (daysUntilDue < 0) {
            row.overdue += 1;
            row.atRisk += 1;
        } else if (daysUntilDue === 0) {
            row.dueToday += 1;
            row.atRisk += 1;
        }

        byAssignee.set(assignee, row);
    }

    return [...byAssignee.values()]
        .map((row) => ({
            ...row,
            breachRate: safePercent(row.atRisk, row.tracked),
        }))
        .sort((a, b) => {
            if (b.atRisk !== a.atRisk) return b.atRisk - a.atRisk;
            if (b.breachRate !== a.breachRate) return b.breachRate - a.breachRate;
            return b.tracked - a.tracked;
        });
}

export interface ReopenRateFilters {
    windowDays?: number;
    now?: Date;
    groupFilter?: WorkflowGroup[];
}

export interface ReopenRateTicket {
    key: string;
    summary: string;
    reopenCount: number;
    url: string;
    status: IssueStatus;
    assignee: string | null;
}

export interface ReopenRateMetrics {
    totalBugs: number;
    reopenedCount: number;
    reopenRate: number;
    topReopenedTickets: ReopenRateTicket[];
    currentWindowRate: number;
    priorWindowRate: number;
    trendVsPrior30Day: number | null;
    windowDays: number;
    methodology: string;
}

function isClosedStatusLabel(value: string | null | undefined): boolean {
    if (!value) return false;
    const normalized = normalize(value);
    return CLOSED_STATUSES.some((status) => normalize(status) === normalized);
}

function countReopenTransitions(issue: JiraIssue): number {
    const statusChanges = issue.changelog
        .filter((entry) => includesText(entry.field, 'status'))
        .sort((a, b) => a.created.localeCompare(b.created));

    let reopenTransitions = 0;
    for (const change of statusChanges) {
        const fromClosed = isClosedStatusLabel(change.fromString);
        const toOpenOrActive = !!change.toString && !isClosedStatusLabel(change.toString);
        if (fromClosed && toOpenOrActive) reopenTransitions += 1;
    }

    return reopenTransitions;
}

function safePercent(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return Number(((numerator / denominator) * 100).toFixed(1));
}

export function getReopenRates(
    input: JiraIssue[] | ({ issues: JiraIssue[] } & ReopenRateFilters),
    filters: ReopenRateFilters = {}
): ReopenRateMetrics {
    const issues = Array.isArray(input) ? input : input.issues;
    const resolvedFilters = Array.isArray(input) ? filters : input;
    const scopedIssues = scopeIssuesByGroupFilter(issues, resolvedFilters.groupFilter);
    const windowDays = resolvedFilters.windowDays || 30;
    const now = resolvedFilters.now || new Date();
    const currentStart = subDays(now, windowDays);
    const previousStart = subDays(currentStart, windowDays);

    const bugReopenRows = scopedIssues
        .filter((issue) => issue.issueType === 'Bug')
        .map((issue) => ({
            issue,
            reopenCount: countReopenTransitions(issue),
            updatedAt: safeParseDate(issue.updated) || safeParseDate(issue.created) || new Date(0),
        }));

    const totalBugs = bugReopenRows.length;
    const reopened = bugReopenRows.filter((row) => row.reopenCount > 0);
    const reopenedCount = reopened.length;
    const reopenRate = safePercent(reopenedCount, totalBugs);

    const topReopenedTickets = [...reopened]
        .sort((a, b) => {
            if (b.reopenCount !== a.reopenCount) return b.reopenCount - a.reopenCount;
            return b.updatedAt.getTime() - a.updatedAt.getTime();
        })
        .slice(0, 5)
        .map(({ issue, reopenCount }) => ({
            key: issue.key,
            summary: issue.summary,
            reopenCount,
            url: issue.url,
            status: issue.status,
            assignee: issue.assignee?.displayName || null,
        }));

    const currentWindow = bugReopenRows.filter(
        (row) => row.updatedAt >= currentStart && row.updatedAt <= now
    );
    const priorWindow = bugReopenRows.filter(
        (row) => row.updatedAt >= previousStart && row.updatedAt < currentStart
    );

    const currentWindowRate = safePercent(
        currentWindow.filter((row) => row.reopenCount > 0).length,
        currentWindow.length
    );
    const priorWindowRate = safePercent(
        priorWindow.filter((row) => row.reopenCount > 0).length,
        priorWindow.length
    );

    return {
        totalBugs,
        reopenedCount,
        reopenRate,
        topReopenedTickets,
        currentWindowRate,
        priorWindowRate,
        trendVsPrior30Day:
            priorWindow.length > 0
                ? Number((currentWindowRate - priorWindowRate).toFixed(1))
                : null,
        windowDays,
        methodology:
            'A bug is counted as reopened when status history transitions from closed (Done/Archived/Rejected) back to a non-closed status. Reopen rate = reopened bugs / total bugs in current filter scope.',
    };
}

export function calculateBugMetrics(issues: JiraIssue[]): BugsMetrics {
    const bugs = issues.filter((issue) => issue.issueType === 'Bug');
    const epicSummaryByKey = new Map<string, string>();

    for (const issue of issues) {
        if (isEpicIssue(issue)) {
            epicSummaryByKey.set(issue.key, issue.summary);
        }
        if (
            issue.epicKey &&
            issue.epicSummary &&
            issue.epicSummary.trim().length > 0 &&
            issue.epicSummary !== issue.epicKey
        ) {
            epicSummaryByKey.set(issue.epicKey, issue.epicSummary);
        }
        if (issue.key && issue.summary) {
            epicSummaryByKey.set(issue.key, issue.summary);
        }
    }

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

        const epicSummary = bug.epicKey ? epicSummaryByKey.get(bug.epicKey) || bug.epicSummary : bug.epicSummary;
        const area = bug.components[0]
            || (bug.epicKey || epicSummary
                ? formatEpicLabel({ epicKey: bug.epicKey, epicSummary: epicSummary || null })
                : '')
            || bug.project
            || 'General';
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
