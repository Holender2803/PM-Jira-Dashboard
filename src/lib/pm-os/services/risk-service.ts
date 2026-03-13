import { getDemoIssues } from '@/lib/demo-data';
import { queryIssues } from '@/lib/issue-store';
import { listInitiatives } from '@/lib/pm-os/repositories/initiatives-repo';
import { listKpis } from '@/lib/pm-os/repositories/kpis-repo';
import { listObjectives } from '@/lib/pm-os/repositories/objectives-repo';
import { listOutcomes } from '@/lib/pm-os/repositories/outcomes-repo';
import { CLOSED_STATUSES } from '@/lib/workflow';
import { StrategyRiskAlert } from '@/types/pm-os';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

function makeRiskId(type: StrategyRiskAlert['type'], entityId: string): string {
    return `${type}:${entityId}`;
}

function getStalenessThresholdDays(frequency: string): number {
    if (frequency === 'weekly') return 14;
    if (frequency === 'quarterly') return 120;
    if (frequency === 'manual') return 180;
    return 45;
}

export function getStrategyRiskAlerts(): StrategyRiskAlert[] {
    const objectives = listObjectives();
    const outcomes = listOutcomes();
    const kpis = listKpis();
    const initiatives = listInitiatives();
    const issues = DEMO_MODE ? getDemoIssues() : queryIssues();

    const alerts: StrategyRiskAlert[] = [];

    const outcomesByObjectiveId = new Map<string, number>();
    for (const outcome of outcomes) {
        outcomesByObjectiveId.set(outcome.objectiveId, (outcomesByObjectiveId.get(outcome.objectiveId) || 0) + 1);
    }

    const initiativesByObjectiveId = new Map<string, number>();
    for (const initiative of initiatives) {
        if (initiative.objectiveId) {
            initiativesByObjectiveId.set(initiative.objectiveId, (initiativesByObjectiveId.get(initiative.objectiveId) || 0) + 1);
        }

        if (!initiative.objectiveId) {
            alerts.push({
                id: makeRiskId('initiative_without_objective', initiative.id),
                type: 'initiative_without_objective',
                severity: 'high',
                title: 'Initiative has no objective link',
                description: `${initiative.title} is not connected to a product objective.`,
                entityType: 'initiative',
                entityId: initiative.id,
                entityTitle: initiative.title,
                recommendation: 'Link the initiative to an objective so delivery work maps to strategy.',
            });
        }
        if (!initiative.outcomeId) {
            alerts.push({
                id: makeRiskId('initiative_without_outcome', initiative.id),
                type: 'initiative_without_outcome',
                severity: 'medium',
                title: 'Initiative has no outcome link',
                description: `${initiative.title} is not tied to a measurable outcome.`,
                entityType: 'initiative',
                entityId: initiative.id,
                entityTitle: initiative.title,
                recommendation: 'Link the initiative to an outcome so success can be measured.',
            });
        }
    }

    for (const objective of objectives) {
        if (!outcomesByObjectiveId.get(objective.id)) {
            alerts.push({
                id: makeRiskId('objective_without_outcome', objective.id),
                type: 'objective_without_outcome',
                severity: 'high',
                title: 'Objective has no outcomes',
                description: `${objective.title} does not yet break down into outcomes.`,
                entityType: 'objective',
                entityId: objective.id,
                entityTitle: objective.title,
                recommendation: 'Add at least one outcome that makes the objective measurable.',
            });
        }
        if (!initiativesByObjectiveId.get(objective.id)) {
            alerts.push({
                id: makeRiskId('objective_without_initiative', objective.id),
                type: 'objective_without_initiative',
                severity: 'medium',
                title: 'Objective has no linked initiatives',
                description: `${objective.title} has no initiatives driving it forward.`,
                entityType: 'objective',
                entityId: objective.id,
                entityTitle: objective.title,
                recommendation: 'Link at least one active initiative to this objective.',
            });
        }
    }

    const kpisByOutcomeId = new Map<string, number>();
    for (const kpi of kpis) {
        kpisByOutcomeId.set(kpi.outcomeId, (kpisByOutcomeId.get(kpi.outcomeId) || 0) + 1);

        const thresholdDays = getStalenessThresholdDays(kpi.measurementFrequency);
        const lastMeasured = kpi.lastMeasuredAt ? new Date(kpi.lastMeasuredAt) : null;
        const stale = !lastMeasured || Number.isNaN(lastMeasured.getTime()) || ((Date.now() - lastMeasured.getTime()) / (1000 * 60 * 60 * 24)) > thresholdDays;
        if (stale) {
            alerts.push({
                id: makeRiskId('kpi_without_recent_measurement', kpi.id),
                type: 'kpi_without_recent_measurement',
                severity: 'medium',
                title: 'KPI is stale',
                description: `${kpi.name} has no recent measurement for its ${kpi.measurementFrequency} cadence.`,
                entityType: 'kpi',
                entityId: kpi.id,
                entityTitle: kpi.name,
                recommendation: 'Log a fresh KPI measurement or reduce the measurement cadence if manual updates are intended.',
            });
        }
    }

    for (const outcome of outcomes) {
        if (!kpisByOutcomeId.get(outcome.id)) {
            alerts.push({
                id: makeRiskId('outcome_without_kpi', outcome.id),
                type: 'outcome_without_kpi',
                severity: 'high',
                title: 'Outcome has no KPI',
                description: `${outcome.title} is not connected to any KPI.`,
                entityType: 'outcome',
                entityId: outcome.id,
                entityTitle: outcome.title,
                recommendation: 'Create a KPI so the team can tell whether this outcome is improving.',
            });
        }
    }

    const initiativeIssueKeys = new Set(
        initiatives.flatMap((initiative) => initiative.linkedIssueKeys)
    );

    const unlinkedIssues = issues
        .filter((issue) => ['Epic', 'Story', 'Feature'].includes(issue.issueType))
        .filter((issue) => !CLOSED_STATUSES.includes(issue.status))
        .filter((issue) => !initiativeIssueKeys.has(issue.key))
        .slice(0, 12);

    for (const issue of unlinkedIssues) {
        alerts.push({
            id: makeRiskId('jira_work_without_initiative', issue.key),
            type: 'jira_work_without_initiative',
            severity: 'low',
            title: 'Jira work has no initiative context',
            description: `${issue.key} ${issue.summary} is active but not linked to an initiative.`,
            entityType: 'jira_issue',
            entityId: issue.key,
            entityTitle: issue.summary,
            recommendation: 'Link this work to an initiative or confirm it is intentional ad hoc delivery work.',
        });
    }

    return alerts.sort((left, right) => {
        const severityWeight = { high: 0, medium: 1, low: 2 };
        return severityWeight[left.severity] - severityWeight[right.severity] || left.title.localeCompare(right.title);
    });
}
