import { attachInitiativeHealth } from '@/lib/pm-os/services/initiative-health-service';
import { listInitiatives } from '@/lib/pm-os/repositories/initiatives-repo';
import { listKpis } from '@/lib/pm-os/repositories/kpis-repo';
import { listObjectives } from '@/lib/pm-os/repositories/objectives-repo';
import { listOutcomes } from '@/lib/pm-os/repositories/outcomes-repo';
import { ObjectiveWithChildren, OutcomeWithKpis } from '@/types/pm-os';

export function getStrategyTree(): ObjectiveWithChildren[] {
    const objectives = listObjectives();
    const outcomes = listOutcomes();
    const kpis = listKpis();
    const initiatives = attachInitiativeHealth(listInitiatives());

    const kpisByOutcomeId = new Map<string, typeof kpis>();
    for (const kpi of kpis) {
        const current = kpisByOutcomeId.get(kpi.outcomeId) || [];
        current.push(kpi);
        kpisByOutcomeId.set(kpi.outcomeId, current);
    }

    const initiativesByOutcomeId = new Map<string, typeof initiatives>();
    const initiativesByObjectiveId = new Map<string, typeof initiatives>();
    for (const initiative of initiatives) {
        if (initiative.outcomeId) {
            const current = initiativesByOutcomeId.get(initiative.outcomeId) || [];
            current.push(initiative);
            initiativesByOutcomeId.set(initiative.outcomeId, current);
        }
        if (initiative.objectiveId) {
            const current = initiativesByObjectiveId.get(initiative.objectiveId) || [];
            current.push(initiative);
            initiativesByObjectiveId.set(initiative.objectiveId, current);
        }
    }

    const outcomesByObjectiveId = new Map<string, OutcomeWithKpis[]>();
    for (const outcome of outcomes) {
        const current = outcomesByObjectiveId.get(outcome.objectiveId) || [];
        current.push({
            ...outcome,
            kpis: kpisByOutcomeId.get(outcome.id) || [],
            linkedInitiatives: initiativesByOutcomeId.get(outcome.id) || [],
        });
        outcomesByObjectiveId.set(outcome.objectiveId, current);
    }

    return objectives.map((objective) => ({
        ...objective,
        outcomes: outcomesByObjectiveId.get(objective.id) || [],
        linkedInitiatives: initiativesByObjectiveId.get(objective.id) || [],
    }));
}
