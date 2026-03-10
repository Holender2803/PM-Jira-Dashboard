import { DashboardFilters, JiraIssue } from '@/types';
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import { CLOSED_STATUSES } from './workflow';
import {
    normalizeWorkflowGroupFilter,
    resolveWorkflowGroup,
    WORKFLOW_GROUP_ORDER,
} from './workflow-groups';

function safeParseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getDaysUntilDue(
    issue: Pick<JiraIssue, 'dueDate'>,
    now: Date = new Date()
): number | null {
    const due = safeParseDate(issue.dueDate);
    if (!due) return null;
    return differenceInCalendarDays(startOfDay(due), startOfDay(now));
}

export function isAtRiskIssue(issue: JiraIssue, now: Date = new Date()): boolean {
    if (CLOSED_STATUSES.includes(issue.status)) return false;
    const daysUntilDue = getDaysUntilDue(issue, now);
    if (daysUntilDue === null) return false;
    return daysUntilDue <= 0;
}

export function applyGroupFilter(
    issues: JiraIssue[],
    groupFilter?: DashboardFilters['groupFilter']
): JiraIssue[] {
    const normalized = normalizeWorkflowGroupFilter(groupFilter);
    if (normalized.length === WORKFLOW_GROUP_ORDER.length) {
        return issues;
    }

    const selected = new Set(normalized);
    return issues.filter((issue) => {
        const group = resolveWorkflowGroup(issue.status);
        return group ? selected.has(group) : false;
    });
}

export function filterIssues(issues: JiraIssue[], filters: DashboardFilters): JiraIssue[] {
    return applyGroupFilter(issues, filters.groupFilter).filter((issue) => {
        const createdAt = Date.parse(issue.created);
        if (filters.status?.length && !filters.status.includes(issue.status)) return false;
        if (filters.issueType?.length && !filters.issueType.includes(issue.issueType)) return false;
        if (filters.assignee?.length && (!issue.assignee || !filters.assignee.includes(issue.assignee.accountId))) return false;
        if (filters.priority?.length && (!issue.priority || !filters.priority.includes(issue.priority))) return false;
        if (filters.project?.length && !filters.project.includes(issue.project)) return false;
        if (filters.label?.length && !filters.label.some((label) => issue.labels.includes(label))) return false;
        if (filters.blockedOnly && issue.status !== 'Blocked') return false;
        if (filters.bugsOnly && issue.issueType !== 'Bug') return false;
        if (filters.unresolvedOnly && issue.resolved) return false;
        if (filters.atRiskOnly && !isAtRiskIssue(issue)) return false;
        if (filters.selectedKeys?.length && !filters.selectedKeys.includes(issue.key)) return false;
        if (filters.selectedOnly && (!filters.selectedKeys || !filters.selectedKeys.includes(issue.key))) return false;
        if (filters.squad?.length && (!issue.squad || !filters.squad.includes(issue.squad))) return false;
        if (filters.epicKey?.length && (!issue.epicKey || !filters.epicKey.includes(issue.epicKey))) return false;
        if (filters.epicPresence === 'with' && !issue.epicKey && !issue.epicSummary) return false;
        if (filters.epicPresence === 'without' && (issue.epicKey || issue.epicSummary)) return false;
        if (filters.sprintId && issue.sprint?.id !== filters.sprintId) return false;
        if (filters.sprint === 'current' && (!issue.sprint || issue.sprint.state !== 'active')) return false;
        if (filters.sprint === 'previous' && (!issue.sprint || issue.sprint.state !== 'closed')) return false;
        if (
            filters.sprint &&
            filters.sprint !== 'current' &&
            filters.sprint !== 'previous' &&
            issue.sprint?.name !== filters.sprint
        ) return false;
        if (filters.dateFrom) {
            const from = Date.parse(filters.dateFrom);
            if (!Number.isNaN(from) && !Number.isNaN(createdAt) && createdAt < from) return false;
        }
        if (filters.dateTo) {
            const to = Date.parse(`${filters.dateTo}T23:59:59.999`);
            if (!Number.isNaN(to) && !Number.isNaN(createdAt) && createdAt > to) return false;
        }
        return true;
    });
}
