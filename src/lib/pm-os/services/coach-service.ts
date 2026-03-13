import { getDemoIssues } from '@/lib/demo-data';
import { queryIssues } from '@/lib/issue-store';
import { listDecisions } from '@/lib/pm-os/repositories/decisions-repo';
import { getOnboardingPlaybook } from '@/lib/pm-os/repositories/onboarding-repo';
import { listPmTasks } from '@/lib/pm-os/repositories/pm-tasks-repo';
import { listPrioritizationScoreViews } from '@/lib/pm-os/repositories/prioritization-repo';
import { getStrategyRiskAlerts } from '@/lib/pm-os/services/risk-service';
import { CLOSED_STATUSES } from '@/lib/workflow';
import { GuidanceRecommendation } from '@/types/pm-os';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

function daysBetween(left: string, right = new Date().toISOString()): number {
    const start = new Date(left);
    const end = new Date(right);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function getGuidanceRecommendations(): GuidanceRecommendation[] {
    const issues = DEMO_MODE ? getDemoIssues() : queryIssues();
    const tasks = listPmTasks();
    const decisions = listDecisions();
    const priorities = listPrioritizationScoreViews();
    const risks = getStrategyRiskAlerts();
    const playbook = getOnboardingPlaybook();

    const recommendations: GuidanceRecommendation[] = [];
    const push = (recommendation: GuidanceRecommendation) => recommendations.push(recommendation);

    const overdueTasks = tasks.filter((task) => task.status !== 'done' && task.dueDate && daysBetween(task.dueDate) > 0);
    if (overdueTasks.length > 0) {
        push({
            id: 'daily-overdue-tasks',
            cadence: 'daily',
            priority: 'high',
            title: 'Clear overdue PM tasks first',
            summary: `${overdueTasks.length} PM task${overdueTasks.length === 1 ? '' : 's'} slipped past their due date.`,
            action: 'Review the overdue PM work list and either complete, reschedule, or explicitly cancel each item.',
            mentorNote: 'A PM operating system only saves time if the task queue stays trustworthy. Overdue PM work is usually where stakeholder friction starts.',
            linkHref: '/tasks',
            linkLabel: 'Open PM Tasks',
            signals: overdueTasks.slice(0, 3).map((task) => task.title),
        });
    }

    const blockedIssues = issues.filter((issue) => issue.status === 'Blocked' && !CLOSED_STATUSES.includes(issue.status));
    if (blockedIssues.length > 0) {
        push({
            id: 'daily-blocked-issues',
            cadence: 'daily',
            priority: 'high',
            title: 'Triage blocked delivery work',
            summary: `${blockedIssues.length} active Jira item${blockedIssues.length === 1 ? '' : 's'} are blocked right now.`,
            action: 'Check what is blocking progress, who owns the unblock, and whether scope or sequencing should change.',
            mentorNote: 'New PMs often watch blockers instead of owning the unblock path. Your job is to create movement, not just observe the metric.',
            linkHref: '/focus',
            linkLabel: 'Open Focus',
            signals: blockedIssues.slice(0, 3).map((issue) => issue.key),
        });
    }

    const draftDecisions = decisions.filter((decision) => decision.status === 'draft');
    if (draftDecisions.length > 0) {
        push({
            id: 'daily-draft-decisions',
            cadence: 'daily',
            priority: 'medium',
            title: 'Close open decision loops',
            summary: `${draftDecisions.length} decision record${draftDecisions.length === 1 ? '' : 's'} are still in draft.`,
            action: 'Either finalize the decision, add the missing evidence, or note what is still unresolved.',
            mentorNote: 'Decision logs are useful only when they capture the actual call, not just the pre-read.',
            linkHref: '/decisions',
            linkLabel: 'Open Decisions',
            signals: draftDecisions.slice(0, 3).map((decision) => decision.title),
        });
    }

    const staleKpis = risks.filter((risk) => risk.type === 'kpi_without_recent_measurement');
    if (staleKpis.length > 0) {
        push({
            id: 'weekly-stale-kpis',
            cadence: 'weekly',
            priority: 'medium',
            title: 'Refresh stale KPI measurements',
            summary: `${staleKpis.length} KPI${staleKpis.length === 1 ? '' : 's'} do not have recent measurements.`,
            action: 'Log updated KPI values before your next roadmap or stakeholder review so the strategy discussion is evidence-based.',
            mentorNote: 'PMs lose credibility when they talk strategy without current measures. If the KPI is manual, schedule the update explicitly.',
            linkHref: '/strategy',
            linkLabel: 'Open Strategy',
            signals: staleKpis.slice(0, 3).map((risk) => risk.entityTitle),
        });
    }

    const unlinkedInitiatives = risks.filter((risk) => risk.type === 'initiative_without_objective');
    if (unlinkedInitiatives.length > 0) {
        push({
            id: 'weekly-unlinked-initiatives',
            cadence: 'weekly',
            priority: 'high',
            title: 'Link active initiatives to strategy',
            summary: `${unlinkedInitiatives.length} initiative${unlinkedInitiatives.length === 1 ? '' : 's'} are active without an objective link.`,
            action: 'Review each initiative and attach it to the objective and outcome it is supposed to move.',
            mentorNote: 'Busy does not mean strategic. If you cannot explain what objective an initiative serves, you probably should not be pushing it forward yet.',
            linkHref: '/initiatives',
            linkLabel: 'Open Initiatives',
            signals: unlinkedInitiatives.slice(0, 3).map((risk) => risk.entityTitle),
        });
    }

    const stalePriorities = priorities.filter((priority) => daysBetween(priority.updatedAt) > 14);
    if (priorities.length === 0 || stalePriorities.length > 0) {
        push({
            id: 'weekly-prioritization',
            cadence: 'weekly',
            priority: priorities.length === 0 ? 'high' : 'medium',
            title: priorities.length === 0 ? 'Start scoring the backlog' : 'Refresh backlog prioritization',
            summary: priorities.length === 0
                ? 'No RICE scores exist yet for active work.'
                : `${stalePriorities.length} scored item${stalePriorities.length === 1 ? '' : 's'} have not been reviewed in over two weeks.`,
            action: 'Re-score the highest-value initiatives and Jira items before your next roadmap or sprint planning conversation.',
            mentorNote: 'Prioritization is a living decision. Scores that never change become spreadsheet theater.',
            linkHref: '/prioritization',
            linkLabel: 'Open Prioritization',
            signals: stalePriorities.slice(0, 3).map((priority) => priority.targetTitle),
        });
    }

    const openBugs = issues.filter((issue) => issue.issueType === 'Bug' && !CLOSED_STATUSES.includes(issue.status));
    if (openBugs.length >= 5) {
        push({
            id: 'monthly-quality-review',
            cadence: 'monthly',
            priority: 'medium',
            title: 'Run a quality pressure review',
            summary: `${openBugs.length} bugs are still open and need trend review.`,
            action: 'Review bug clusters, aging, and ownership to decide whether quality debt is consuming roadmap capacity.',
            mentorNote: 'When bugs become “background noise,” roadmap trust erodes quietly. Monthly quality reviews keep that debt visible.',
            linkHref: '/bugs',
            linkLabel: 'Open Bugs',
            signals: openBugs.slice(0, 3).map((issue) => issue.key),
        });
    }

    if (playbook && playbook.completedCount < playbook.totalCount) {
        const remaining = playbook.steps.filter((step) => !step.completedAt);
        push({
            id: 'monthly-onboarding',
            cadence: 'monthly',
            priority: 'low',
            title: 'Keep the PM onboarding playbook moving',
            summary: `${playbook.totalCount - playbook.completedCount} onboarding step${playbook.totalCount - playbook.completedCount === 1 ? '' : 's'} remain open.`,
            action: 'Complete the next onboarding milestone or explicitly defer it if it no longer matches your role.',
            mentorNote: 'Good PMs make their own learning plan explicit. Hidden onboarding debt usually shows up later as weak judgment.',
            linkHref: '/onboarding',
            linkLabel: 'Open Onboarding',
            signals: remaining.slice(0, 3).map((step) => step.title),
        });
    }

    push({
        id: 'monthly-narrative',
        cadence: 'monthly',
        priority: 'low',
        title: 'Generate a stakeholder narrative',
        summary: 'Package delivery, decisions, risks, and KPI movement into one explainable story.',
        action: 'Draft a roadmap or stakeholder brief before your next cross-functional review so you are not writing from scratch at the last minute.',
        mentorNote: 'A strong PM does not just know what happened. They can explain why it matters and what should happen next.',
        linkHref: '/narratives',
        linkLabel: 'Open Narratives',
        signals: [],
    });

    const cadenceOrder = { daily: 0, weekly: 1, monthly: 2 };
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    return recommendations.sort((left, right) => {
        return cadenceOrder[left.cadence] - cadenceOrder[right.cadence]
            || priorityOrder[left.priority] - priorityOrder[right.priority]
            || left.title.localeCompare(right.title);
    });
}
