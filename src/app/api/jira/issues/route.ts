import { NextResponse } from 'next/server';
import { getDemoIssues, getDemoSprints } from '@/lib/demo-data';
import {
    queryIssues,
    getActiveSprints,
    getActiveSprintEndDate,
    getLastSyncedAt,
    getTotalIssues,
} from '@/lib/issue-store';
import { DashboardFilters } from '@/types';
import { filterIssues } from '@/lib/filters';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        // Parse filters from query params
        const filters: DashboardFilters = {};
        const sprint = searchParams.get('sprint');
        if (sprint) filters.sprint = sprint;
        const sprintId = searchParams.get('sprintId');
        if (sprintId) filters.sprintId = Number(sprintId);
        const status = searchParams.get('status');
        if (status) filters.status = status.split(',') as DashboardFilters['status'];
        const issueType = searchParams.get('issueType');
        if (issueType) filters.issueType = issueType.split(',') as DashboardFilters['issueType'];
        const assignee = searchParams.get('assignee');
        if (assignee) filters.assignee = assignee.split(',');
        const priority = searchParams.get('priority');
        if (priority) filters.priority = priority.split(',') as DashboardFilters['priority'];
        const blockedOnly = searchParams.get('blockedOnly');
        if (blockedOnly === 'true') filters.blockedOnly = true;
        const bugsOnly = searchParams.get('bugsOnly');
        if (bugsOnly === 'true') filters.bugsOnly = true;
        const unresolvedOnly = searchParams.get('unresolvedOnly');
        if (unresolvedOnly === 'true') filters.unresolvedOnly = true;
        const atRiskOnly = searchParams.get('atRiskOnly');
        if (atRiskOnly === 'true') filters.atRiskOnly = true;
        const squad = searchParams.get('squad');
        if (squad) filters.squad = squad.split(',');
        const epicKey = searchParams.get('epicKey');
        if (epicKey) filters.epicKey = epicKey.split(',');
        const epicPresence = searchParams.get('epicPresence');
        if (epicPresence === 'with' || epicPresence === 'without') filters.epicPresence = epicPresence;
        const selectedKeys = searchParams.get('selectedKeys');
        if (selectedKeys) filters.selectedKeys = selectedKeys.split(',');
        const project = searchParams.get('project');
        if (project) filters.project = project.split(',');
        const label = searchParams.get('label');
        if (label) filters.label = label.split(',');
        const groupFilter = searchParams.get('groupFilter');
        if (groupFilter) filters.groupFilter = groupFilter.split(',') as DashboardFilters['groupFilter'];
        const dateFrom = searchParams.get('dateFrom');
        if (dateFrom) filters.dateFrom = dateFrom;
        const dateTo = searchParams.get('dateTo');
        if (dateTo) filters.dateTo = dateTo;

        if (DEMO_MODE) {
            const allIssues = getDemoIssues();
            const filtered = filterIssues(allIssues, filters);
            return NextResponse.json({
                issues: filtered,
                total: filtered.length,
                lastSynced: new Date().toISOString(),
                sprints: getDemoSprints(),
                demoMode: true,
            });
        }

        const issues = queryIssues(filters);
        const sprints = getActiveSprints();
        const activeSprintEndDate = getActiveSprintEndDate();
        const normalizedSprints = sprints.map((sprint) => {
            if (sprint.state === 'active' && !sprint.endDate && activeSprintEndDate) {
                return { ...sprint, endDate: activeSprintEndDate };
            }
            return sprint;
        });
        const lastSynced = getLastSyncedAt();
        const total = getTotalIssues();

        return NextResponse.json({
            issues,
            total,
            lastSynced,
            sprints: normalizedSprints,
            activeSprintEndDate,
            demoMode: false,
        });
    } catch (error) {
        console.error('Issues API error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
