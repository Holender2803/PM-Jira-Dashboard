import { DashboardFilters, JiraIssue } from '@/types';

export function filterIssues(issues: JiraIssue[], filters: DashboardFilters): JiraIssue[] {
    return issues.filter((issue) => {
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
