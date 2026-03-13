import { getDemoIssues } from '@/lib/demo-data';
import { listPmTasks } from '@/lib/pm-os/repositories/pm-tasks-repo';
import { listInitiatives } from '@/lib/pm-os/repositories/initiatives-repo';
import { listPrioritizationScoreViews } from '@/lib/pm-os/repositories/prioritization-repo';
import { listDecisions } from '@/lib/pm-os/repositories/decisions-repo';
import { attachInitiativeHealth } from '@/lib/pm-os/services/initiative-health-service';
import { listObjectives } from '@/lib/pm-os/repositories/objectives-repo';
import { listOutcomes } from '@/lib/pm-os/repositories/outcomes-repo';
import { listKpis } from '@/lib/pm-os/repositories/kpis-repo';
import { getOnboardingPlaybook } from '@/lib/pm-os/repositories/onboarding-repo';
import { listStakeholderInteractions, listStakeholders } from '@/lib/pm-os/repositories/stakeholders-repo';
import { listFintechContextItems } from '@/lib/pm-os/repositories/fintech-context-repo';
import { getGuidanceRecommendations } from '@/lib/pm-os/services/coach-service';
import { getStrategyRiskAlerts } from '@/lib/pm-os/services/risk-service';
import { CommandCenterSummary, PmTaskBuckets, PmTaskRecord } from '@/types/pm-os';
import { queryIssues } from '@/lib/issue-store';
import { ACTIVE_STATUSES, CLOSED_STATUSES } from '@/lib/workflow';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

function isSameDate(left: Date, right: Date): boolean {
    return left.getFullYear() === right.getFullYear()
        && left.getMonth() === right.getMonth()
        && left.getDate() === right.getDate();
}

function bucketTasks(tasks: PmTaskRecord[]): PmTaskBuckets {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets: PmTaskBuckets = {
        overdue: [],
        today: [],
        upcoming: [],
        done: [],
    };

    for (const task of tasks) {
        if (task.status === 'done') {
            buckets.done.push(task);
            continue;
        }

        if (!task.dueDate) {
            buckets.upcoming.push(task);
            continue;
        }

        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate.getTime() < today.getTime()) {
            buckets.overdue.push(task);
        } else if (isSameDate(dueDate, today)) {
            buckets.today.push(task);
        } else {
            buckets.upcoming.push(task);
        }
    }

    return buckets;
}

export function getCommandCenterSummary(): CommandCenterSummary {
    const issues = DEMO_MODE ? getDemoIssues() : queryIssues();
    const sprintIssues = issues.filter((issue) => issue.sprint?.state === 'active');
    const done = sprintIssues.filter((issue) => CLOSED_STATUSES.includes(issue.status));
    const blockedCount = issues.filter((issue) => issue.status === 'Blocked').length;
    const activeCount = sprintIssues.filter((issue) => ACTIVE_STATUSES.includes(issue.status)).length;
    const releaseReadyCount = issues.filter((issue) => ['Ready for Release', 'Ready for Acceptance'].includes(issue.status)).length;
    const openBugs = issues.filter((issue) => issue.issueType === 'Bug' && !CLOSED_STATUSES.includes(issue.status)).length;

    const taskBuckets = bucketTasks(listPmTasks());
    const activeInitiatives = attachInitiativeHealth(
        listInitiatives().filter((initiative) => !['done', 'archived'].includes(initiative.status))
    ).slice(0, 6);

    const topPriorities = listPrioritizationScoreViews().slice(0, 6);
    const allDecisions = listDecisions();
    const drafts = allDecisions.filter((decision) => decision.status === 'draft').slice(0, 5);
    const recent = allDecisions.slice(0, 5);
    const objectives = listObjectives();
    const outcomes = listOutcomes();
    const kpis = listKpis();
    const risks = getStrategyRiskAlerts();
    const recommendations = getGuidanceRecommendations();
    const playbook = getOnboardingPlaybook();
    const stakeholders = listStakeholders();
    const recentStakeholderInteractions = listStakeholderInteractions().slice(0, 5);
    const fintechContextItems = listFintechContextItems();
    const externalStakeholderCount = stakeholders.filter((stakeholder) => ['sales', 'client', 'partner'].includes(stakeholder.relationshipType)).length;
    const missingSourceOfTruthCount = fintechContextItems.filter((item) => !item.sourceOfTruth).length;

    return {
        delivery: {
            currentSprintName: sprintIssues[0]?.sprint?.name || null,
            sprintIssues: sprintIssues.length,
            completionRate: sprintIssues.length > 0 ? Math.round((done.length / sprintIssues.length) * 100) : 0,
            blockedCount,
            activeCount,
            openBugs,
            releaseReadyCount,
        },
        tasks: {
            overdueCount: taskBuckets.overdue.length,
            todayCount: taskBuckets.today.length,
            upcomingCount: taskBuckets.upcoming.length,
            doneCount: taskBuckets.done.length,
            overdue: taskBuckets.overdue.slice(0, 5),
            today: taskBuckets.today.slice(0, 5),
            upcoming: taskBuckets.upcoming.slice(0, 5),
        },
        initiatives: activeInitiatives,
        topPriorities,
        decisions: {
            drafts,
            recent,
        },
        strategy: {
            activeObjectivesCount: objectives.filter((objective) => objective.status === 'active').length,
            activeOutcomesCount: outcomes.filter((outcome) => outcome.status === 'active').length,
            activeKpisCount: kpis.length,
            objectivesAtRiskCount: objectives.filter((objective) => objective.status === 'at_risk').length,
            staleKpisCount: risks.filter((risk) => risk.type === 'kpi_without_recent_measurement').length,
            unlinkedInitiativesCount: risks.filter((risk) => risk.type === 'initiative_without_objective').length,
        },
        risks: risks.slice(0, 6),
        coach: {
            recommendations: recommendations.slice(0, 4),
            onboardingCompletedCount: playbook?.completedCount || 0,
            onboardingTotalCount: playbook?.totalCount || 0,
            nextOnboardingSteps: playbook?.steps.filter((step) => !step.completedAt).slice(0, 3) || [],
        },
        stakeholders: {
            totalCount: stakeholders.length,
            externalCount: externalStakeholderCount,
            recentInteractions: recentStakeholderInteractions,
        },
        fintech: {
            totalCount: fintechContextItems.length,
            manualStepCount: fintechContextItems.filter((item) => item.manualStepFlag).length,
            reconciliationRiskCount: fintechContextItems.filter((item) => item.reconciliationRiskFlag).length,
            missingSourceOfTruthCount,
            flaggedItems: fintechContextItems
                .filter((item) => item.reconciliationRiskFlag || item.manualStepFlag || !item.sourceOfTruth)
                .slice(0, 5),
        },
    };
}
