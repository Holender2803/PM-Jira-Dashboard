import {
    DecisionInput,
    DecisionOptionInput,
    DecisionStatus,
    FintechContextItemInput,
    FintechContextType,
    InitiativeInput,
    InitiativeStatus,
    KpiInput,
    KpiMeasurementInput,
    KpiMetricType,
    KpiSourceType,
    MeasurementFrequency,
    NarrativeAudience,
    NarrativeRequest,
    NarrativeReportType,
    ObjectiveInput,
    ObjectiveStatus,
    OutcomeInput,
    OutcomeStatus,
    PmTaskCategory,
    PmTaskInput,
    PmTaskStatus,
    PrioritizationInput,
    PrioritizationTargetType,
    StakeholderInput,
    StakeholderInteractionInput,
    StakeholderRelationshipType,
} from '@/types/pm-os';
import {
    RICE_CONFIDENCE_OPTIONS,
    RICE_EFFORT_OPTIONS,
    RICE_IMPACT_OPTIONS,
    RICE_REACH_OPTIONS,
} from './rice';

const INITIATIVE_STATUSES: InitiativeStatus[] = [
    'proposed',
    'discovery',
    'planned',
    'in_progress',
    'launched',
    'done',
    'on_hold',
    'archived',
];

const PM_TASK_CATEGORIES: PmTaskCategory[] = [
    'Discovery',
    'Delivery',
    'Stakeholder',
    'Strategy',
    'Operations',
];

const PM_TASK_STATUSES: PmTaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];
const TARGET_TYPES: PrioritizationTargetType[] = ['jira_issue', 'initiative'];
const DECISION_STATUSES: DecisionStatus[] = ['draft', 'decided', 'revisited', 'superseded'];
const OBJECTIVE_STATUSES: ObjectiveStatus[] = ['draft', 'active', 'at_risk', 'done', 'archived'];
const OUTCOME_STATUSES: OutcomeStatus[] = OBJECTIVE_STATUSES;
const KPI_METRIC_TYPES: KpiMetricType[] = ['numeric', 'percentage', 'currency', 'duration_days', 'count'];
const MEASUREMENT_FREQUENCIES: MeasurementFrequency[] = ['weekly', 'monthly', 'quarterly', 'manual'];
const KPI_SOURCE_TYPES: KpiSourceType[] = ['manual', 'jira', 'derived', 'other'];
const NARRATIVE_TYPES: NarrativeReportType[] = ['roadmap_narrative', 'objective_review', 'decision_brief', 'risk_digest', 'daily_pm_plan', 'stakeholder_brief'];
const NARRATIVE_AUDIENCES: NarrativeAudience[] = ['executive', 'pm_internal', 'stakeholder', 'junior_pm'];
const STAKEHOLDER_RELATIONSHIP_TYPES: StakeholderRelationshipType[] = ['sales', 'client', 'engineering', 'design', 'support', 'executive', 'partner', 'compliance', 'operations'];
const FINTECH_CONTEXT_TYPES: FintechContextType[] = ['data_source', 'reporting_pipeline', 'compliance_constraint', 'reconciliation_point', 'system_integration', 'workflow_friction', 'source_of_truth'];

function normalizeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown): string | null {
    const normalized = normalizeString(value);
    return normalized || null;
}

function ensureEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return allowed.includes(value as T) ? (value as T) : fallback;
}

function ensureDateString(value: unknown): string | null {
    const normalized = normalizeString(value);
    if (!normalized) return null;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${normalized}`);
    }
    return normalized;
}

function ensureRequiredString(value: unknown, fieldName: string): string {
    const normalized = normalizeString(value);
    if (!normalized) {
        throw new Error(`${fieldName} is required.`);
    }
    return normalized;
}

function ensureNumber(value: unknown, fieldName: string, fallback = 0): number {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`${fieldName} must be a number.`);
    }
    return parsed;
}

function ensureAllowedNumber<T extends readonly number[]>(
    value: unknown,
    fieldName: string,
    allowed: T,
    fallback: T[number]
): T[number] {
    const parsed = ensureNumber(value, fieldName, fallback);
    if (!allowed.includes(parsed as T[number])) {
        throw new Error(`${fieldName} must be one of: ${allowed.join(', ')}`);
    }
    return parsed as T[number];
}

export function normalizeIssueKeys(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(
        value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean)
    )];
}

export function normalizePlainStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(
        value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean)
    )];
}

export function normalizeInitiativeIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(
        value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean)
    )];
}

export function parseInitiativeInput(value: unknown, partial = false): Partial<InitiativeInput> | InitiativeInput {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const parsed: Partial<InitiativeInput> = {
        summary: optionalString(payload.summary),
        status: ensureEnum(payload.status, INITIATIVE_STATUSES, 'proposed'),
        ownerName: optionalString(payload.ownerName),
        theme: optionalString(payload.theme),
        targetDate: ensureDateString(payload.targetDate),
        notes: optionalString(payload.notes),
        linkedIssueKeys: normalizeIssueKeys(payload.linkedIssueKeys),
        objectiveId: optionalString(payload.objectiveId),
        outcomeId: optionalString(payload.outcomeId),
    };

    const title = optionalString(payload.title);
    if (title) parsed.title = title;

    if (partial) {
        return parsed;
    }

    return {
        title: ensureRequiredString(payload.title, 'title'),
        summary: parsed.summary ?? null,
        status: parsed.status ?? 'proposed',
        ownerName: parsed.ownerName ?? null,
        theme: parsed.theme ?? null,
        targetDate: parsed.targetDate ?? null,
        notes: parsed.notes ?? null,
        linkedIssueKeys: parsed.linkedIssueKeys ?? [],
        objectiveId: parsed.objectiveId ?? null,
        outcomeId: parsed.outcomeId ?? null,
    };
}

export function parsePmTaskInput(value: unknown, partial = false): Partial<PmTaskInput> | PmTaskInput {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const parsed: Partial<PmTaskInput> = {
        category: ensureEnum(payload.category, PM_TASK_CATEGORIES, 'Discovery'),
        status: ensureEnum(payload.status, PM_TASK_STATUSES, 'todo'),
        ownerName: optionalString(payload.ownerName),
        dueDate: ensureDateString(payload.dueDate),
        initiativeId: optionalString(payload.initiativeId),
        meetingParticipants: normalizePlainStringArray(payload.meetingParticipants),
        notes: optionalString(payload.notes),
        linkedIssueKeys: normalizeIssueKeys(payload.linkedIssueKeys),
    };

    const title = optionalString(payload.title);
    if (title) parsed.title = title;

    if (partial) {
        return parsed;
    }

    return {
        title: ensureRequiredString(payload.title, 'title'),
        category: parsed.category ?? 'Discovery',
        status: parsed.status ?? 'todo',
        ownerName: parsed.ownerName ?? null,
        dueDate: parsed.dueDate ?? null,
        initiativeId: parsed.initiativeId ?? null,
        meetingParticipants: parsed.meetingParticipants ?? [],
        notes: parsed.notes ?? null,
        linkedIssueKeys: parsed.linkedIssueKeys ?? [],
    };
}

export function parsePrioritizationInput(value: unknown, partial = false): Partial<PrioritizationInput> | PrioritizationInput {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const parsed: Partial<PrioritizationInput> = {
        targetType: ensureEnum(payload.targetType, TARGET_TYPES, 'jira_issue'),
        initiativeId: optionalString(payload.initiativeId),
        reach: ensureAllowedNumber(payload.reach, 'reach', RICE_REACH_OPTIONS, RICE_REACH_OPTIONS[0]),
        impact: ensureAllowedNumber(payload.impact, 'impact', RICE_IMPACT_OPTIONS, RICE_IMPACT_OPTIONS[2]),
        confidence: ensureAllowedNumber(payload.confidence, 'confidence', RICE_CONFIDENCE_OPTIONS, RICE_CONFIDENCE_OPTIONS[1]),
        effort: ensureAllowedNumber(payload.effort, 'effort', RICE_EFFORT_OPTIONS, RICE_EFFORT_OPTIONS[1]),
        rationale: optionalString(payload.rationale),
    };

    const targetId = optionalString(payload.targetId);
    if (targetId) parsed.targetId = targetId;

    if (partial) {
        return parsed;
    }

    return {
        targetType: parsed.targetType ?? 'jira_issue',
        targetId: ensureRequiredString(payload.targetId, 'targetId'),
        initiativeId: parsed.initiativeId ?? null,
        reach: parsed.reach ?? 0,
        impact: parsed.impact ?? 0,
        confidence: parsed.confidence ?? 100,
        effort: parsed.effort ?? 1,
        rationale: parsed.rationale ?? null,
    };
}

function parseDecisionOption(value: unknown, index: number): DecisionOptionInput {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return {
        optionTitle: ensureRequiredString(payload.optionTitle, `options[${index}].optionTitle`),
        pros: optionalString(payload.pros),
        cons: optionalString(payload.cons),
        sortOrder: ensureNumber(payload.sortOrder, `options[${index}].sortOrder`, index),
        isSelected: Boolean(payload.isSelected),
    };
}

export function parseDecisionInput(value: unknown, partial = false): Partial<DecisionInput> | DecisionInput {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const parsed: Partial<DecisionInput> = {
        finalDecision: optionalString(payload.finalDecision),
        expectedOutcome: optionalString(payload.expectedOutcome),
        ownerName: optionalString(payload.ownerName),
        decisionDate: ensureDateString(payload.decisionDate) ?? new Date().toISOString().slice(0, 10),
        status: ensureEnum(payload.status, DECISION_STATUSES, 'draft'),
        primaryInitiativeId: optionalString(payload.primaryInitiativeId),
        linkedInitiativeIds: normalizeInitiativeIds(payload.linkedInitiativeIds),
        linkedIssueKeys: normalizeIssueKeys(payload.linkedIssueKeys),
    };

    const title = optionalString(payload.title);
    const problemContext = optionalString(payload.problemContext);
    if (title) parsed.title = title;
    if (problemContext) parsed.problemContext = problemContext;

    if (Array.isArray(payload.options)) {
        parsed.options = payload.options.map((option, index) => parseDecisionOption(option, index));
    }

    if (partial) {
        return parsed;
    }

    return {
        title: ensureRequiredString(payload.title, 'title'),
        problemContext: ensureRequiredString(payload.problemContext, 'problemContext'),
        finalDecision: parsed.finalDecision ?? null,
        expectedOutcome: parsed.expectedOutcome ?? null,
        ownerName: parsed.ownerName ?? null,
        decisionDate: parsed.decisionDate ?? new Date().toISOString().slice(0, 10),
        status: parsed.status ?? 'draft',
        primaryInitiativeId: parsed.primaryInitiativeId ?? null,
        linkedInitiativeIds: parsed.linkedInitiativeIds ?? [],
        linkedIssueKeys: parsed.linkedIssueKeys ?? [],
        options: Array.isArray(parsed.options) ? parsed.options : [],
    };
}

export function parseObjectiveInput(value: unknown, partial = false): Partial<ObjectiveInput> | ObjectiveInput {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const parsed: Partial<ObjectiveInput> = {
        description: optionalString(payload.description),
        status: ensureEnum(payload.status, OBJECTIVE_STATUSES, 'draft'),
        ownerName: optionalString(payload.ownerName),
        startDate: ensureDateString(payload.startDate),
        targetDate: ensureDateString(payload.targetDate),
    };

    const title = optionalString(payload.title);
    if (title) parsed.title = title;
    if (partial) return parsed;

    return {
        title: ensureRequiredString(payload.title, 'title'),
        description: parsed.description ?? null,
        status: parsed.status ?? 'draft',
        ownerName: parsed.ownerName ?? null,
        startDate: parsed.startDate ?? null,
        targetDate: parsed.targetDate ?? null,
    };
}

export function parseOutcomeInput(value: unknown, partial = false): Partial<OutcomeInput> | OutcomeInput {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const parsed: Partial<OutcomeInput> = {
        objectiveId: optionalString(payload.objectiveId) || undefined,
        description: optionalString(payload.description),
        baselineText: optionalString(payload.baselineText),
        targetText: optionalString(payload.targetText),
        status: ensureEnum(payload.status, OUTCOME_STATUSES, 'draft'),
    };

    const title = optionalString(payload.title);
    if (title) parsed.title = title;
    if (partial) return parsed;

    return {
        objectiveId: ensureRequiredString(payload.objectiveId, 'objectiveId'),
        title: ensureRequiredString(payload.title, 'title'),
        description: parsed.description ?? null,
        baselineText: parsed.baselineText ?? null,
        targetText: parsed.targetText ?? null,
        status: parsed.status ?? 'draft',
    };
}

export function parseKpiInput(value: unknown, partial = false): Partial<KpiInput> | KpiInput {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const parsed: Partial<KpiInput> = {
        outcomeId: optionalString(payload.outcomeId) || undefined,
        metricType: ensureEnum(payload.metricType, KPI_METRIC_TYPES, 'numeric'),
        unit: optionalString(payload.unit),
        baselineValue: payload.baselineValue === '' ? null : (payload.baselineValue === undefined ? undefined : ensureNumber(payload.baselineValue, 'baselineValue')),
        currentValue: payload.currentValue === '' ? null : (payload.currentValue === undefined ? undefined : ensureNumber(payload.currentValue, 'currentValue')),
        targetValue: payload.targetValue === '' ? null : (payload.targetValue === undefined ? undefined : ensureNumber(payload.targetValue, 'targetValue')),
        measurementFrequency: ensureEnum(payload.measurementFrequency, MEASUREMENT_FREQUENCIES, 'monthly'),
        sourceType: ensureEnum(payload.sourceType, KPI_SOURCE_TYPES, 'manual'),
        sourceNotes: optionalString(payload.sourceNotes),
    };

    const name = optionalString(payload.name);
    if (name) parsed.name = name;
    if (partial) return parsed;

    return {
        outcomeId: ensureRequiredString(payload.outcomeId, 'outcomeId'),
        name: ensureRequiredString(payload.name, 'name'),
        metricType: parsed.metricType ?? 'numeric',
        unit: parsed.unit ?? null,
        baselineValue: parsed.baselineValue ?? null,
        currentValue: parsed.currentValue ?? null,
        targetValue: parsed.targetValue ?? null,
        measurementFrequency: parsed.measurementFrequency ?? 'monthly',
        sourceType: parsed.sourceType ?? 'manual',
        sourceNotes: parsed.sourceNotes ?? null,
    };
}

export function parseKpiMeasurementInput(value: unknown): KpiMeasurementInput {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return {
        kpiId: ensureRequiredString(payload.kpiId, 'kpiId'),
        measuredAt: ensureDateString(payload.measuredAt) ?? new Date().toISOString().slice(0, 10),
        value: ensureNumber(payload.value, 'value'),
        note: optionalString(payload.note),
    };
}

export function parseNarrativeRequest(value: unknown): NarrativeRequest {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return {
        type: ensureEnum(payload.type, NARRATIVE_TYPES, 'stakeholder_brief'),
        audience: ensureEnum(payload.audience, NARRATIVE_AUDIENCES, 'pm_internal'),
        issueKeys: normalizeIssueKeys(payload.issueKeys),
        initiativeIds: normalizeInitiativeIds(payload.initiativeIds),
        objectiveIds: normalizeInitiativeIds(payload.objectiveIds),
        decisionIds: normalizeInitiativeIds(payload.decisionIds),
        includeRisks: Boolean(payload.includeRisks),
        includeTasks: Boolean(payload.includeTasks),
        customInstructions: optionalString(payload.customInstructions),
    };
}

export function parseOnboardingProgressInput(value: unknown): {
    stepId: string;
    completed: boolean;
    note: string | null;
} {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return {
        stepId: ensureRequiredString(payload.stepId, 'stepId'),
        completed: Boolean(payload.completed),
        note: optionalString(payload.note),
    };
}

export function parseStakeholderInput(value: unknown, partial = false): Partial<StakeholderInput> | StakeholderInput {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const parsed: Partial<StakeholderInput> = {
        role: optionalString(payload.role),
        organization: optionalString(payload.organization),
        relationshipType: ensureEnum(payload.relationshipType, STAKEHOLDER_RELATIONSHIP_TYPES, 'engineering'),
        linkedInitiativeIds: normalizeInitiativeIds(payload.linkedInitiativeIds),
        notes: optionalString(payload.notes),
    };

    const name = optionalString(payload.name);
    if (name) parsed.name = name;

    if (partial) {
        return parsed;
    }

    return {
        name: ensureRequiredString(payload.name, 'name'),
        role: parsed.role ?? null,
        organization: parsed.organization ?? null,
        relationshipType: parsed.relationshipType ?? 'engineering',
        linkedInitiativeIds: parsed.linkedInitiativeIds ?? [],
        notes: parsed.notes ?? null,
    };
}

export function parseStakeholderInteractionInput(value: unknown, partial = false): Partial<StakeholderInteractionInput> | StakeholderInteractionInput {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const parsed: Partial<StakeholderInteractionInput> = {
        stakeholderId: optionalString(payload.stakeholderId) || undefined,
        interactionDate: ensureDateString(payload.interactionDate) ?? new Date().toISOString().slice(0, 10),
        notes: optionalString(payload.notes),
        initiativeId: optionalString(payload.initiativeId),
        linkedIssueKeys: normalizeIssueKeys(payload.linkedIssueKeys),
    };

    const title = optionalString(payload.title);
    if (title) parsed.title = title;

    if (partial) {
        return parsed;
    }

    return {
        stakeholderId: ensureRequiredString(payload.stakeholderId, 'stakeholderId'),
        interactionDate: parsed.interactionDate ?? new Date().toISOString().slice(0, 10),
        title: ensureRequiredString(payload.title, 'title'),
        notes: parsed.notes ?? null,
        initiativeId: parsed.initiativeId ?? null,
        linkedIssueKeys: parsed.linkedIssueKeys ?? [],
    };
}

export function parseFintechContextItemInput(value: unknown, partial = false): Partial<FintechContextItemInput> | FintechContextItemInput {
    const payload = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const parsed: Partial<FintechContextItemInput> = {
        contextType: ensureEnum(payload.contextType, FINTECH_CONTEXT_TYPES, 'workflow_friction'),
        description: optionalString(payload.description),
        systemName: optionalString(payload.systemName),
        sourceOfTruth: optionalString(payload.sourceOfTruth),
        manualStepFlag: payload.manualStepFlag === undefined ? undefined : Boolean(payload.manualStepFlag),
        reconciliationRiskFlag: payload.reconciliationRiskFlag === undefined ? undefined : Boolean(payload.reconciliationRiskFlag),
        complianceNote: optionalString(payload.complianceNote),
        ownerStakeholderId: optionalString(payload.ownerStakeholderId),
        linkedInitiativeId: optionalString(payload.linkedInitiativeId),
    };

    const name = optionalString(payload.name);
    if (name) parsed.name = name;

    if (partial) {
        return parsed;
    }

    return {
        contextType: parsed.contextType ?? 'workflow_friction',
        name: ensureRequiredString(payload.name, 'name'),
        description: parsed.description ?? null,
        systemName: parsed.systemName ?? null,
        sourceOfTruth: parsed.sourceOfTruth ?? null,
        manualStepFlag: parsed.manualStepFlag ?? false,
        reconciliationRiskFlag: parsed.reconciliationRiskFlag ?? false,
        complianceNote: parsed.complianceNote ?? null,
        ownerStakeholderId: parsed.ownerStakeholderId ?? null,
        linkedInitiativeId: parsed.linkedInitiativeId ?? null,
    };
}
