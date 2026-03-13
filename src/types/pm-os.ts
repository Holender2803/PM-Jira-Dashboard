export type InitiativeStatus =
    | 'proposed'
    | 'discovery'
    | 'planned'
    | 'in_progress'
    | 'launched'
    | 'done'
    | 'on_hold'
    | 'archived';

export type PmTaskCategory =
    | 'Discovery'
    | 'Delivery'
    | 'Stakeholder'
    | 'Strategy'
    | 'Operations';

export type PmTaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type PrioritizationTargetType = 'jira_issue' | 'initiative';
export type PrioritizationFramework = 'RICE';
export type DecisionStatus = 'draft' | 'decided' | 'revisited' | 'superseded';
export type ObjectiveStatus = 'draft' | 'active' | 'at_risk' | 'done' | 'archived';
export type OutcomeStatus = ObjectiveStatus;
export type KpiMetricType = 'numeric' | 'percentage' | 'currency' | 'duration_days' | 'count';
export type MeasurementFrequency = 'weekly' | 'monthly' | 'quarterly' | 'manual';
export type KpiSourceType = 'manual' | 'jira' | 'derived' | 'other';
export type StrategyRiskType =
    | 'initiative_without_objective'
    | 'initiative_without_outcome'
    | 'objective_without_outcome'
    | 'objective_without_initiative'
    | 'outcome_without_kpi'
    | 'kpi_without_recent_measurement'
    | 'jira_work_without_initiative';
export type StrategyRiskSeverity = 'high' | 'medium' | 'low';
export type NarrativeReportType =
    | 'roadmap_narrative'
    | 'objective_review'
    | 'decision_brief'
    | 'risk_digest'
    | 'daily_pm_plan'
    | 'stakeholder_brief';
export type NarrativeAudience = 'executive' | 'pm_internal' | 'stakeholder' | 'junior_pm';
export type GuidanceCadence = 'daily' | 'weekly' | 'monthly';
export type GuidancePriority = 'high' | 'medium' | 'low';
export type StakeholderRelationshipType =
    | 'sales'
    | 'client'
    | 'engineering'
    | 'design'
    | 'support'
    | 'executive'
    | 'partner'
    | 'compliance'
    | 'operations';
export type FintechContextType =
    | 'data_source'
    | 'reporting_pipeline'
    | 'compliance_constraint'
    | 'reconciliation_point'
    | 'system_integration'
    | 'workflow_friction'
    | 'source_of_truth';

export interface InitiativeRecord {
    id: string;
    title: string;
    summary: string | null;
    status: InitiativeStatus;
    ownerName: string | null;
    theme: string | null;
    targetDate: string | null;
    notes: string | null;
    linkedIssueKeys: string[];
    objectiveId: string | null;
    objectiveTitle: string | null;
    outcomeId: string | null;
    outcomeTitle: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface LinkedJiraIssueSummary {
    key: string;
    summary: string;
    status: string;
    issueType: string;
    url: string;
    assigneeName: string | null;
}

export interface InitiativeHealth {
    totalLinkedIssues: number;
    doneLinkedIssues: number;
    blockedLinkedIssues: number;
    activeLinkedIssues: number;
    completionRate: number;
    linkedIssues: LinkedJiraIssueSummary[];
}

export interface InitiativeWithHealth extends InitiativeRecord {
    health: InitiativeHealth;
}

export interface InitiativeInput {
    title: string;
    summary: string | null;
    status: InitiativeStatus;
    ownerName: string | null;
    theme: string | null;
    targetDate: string | null;
    notes: string | null;
    linkedIssueKeys: string[];
    objectiveId: string | null;
    outcomeId: string | null;
}

export interface PmTaskRecord {
    id: string;
    title: string;
    category: PmTaskCategory;
    status: PmTaskStatus;
    ownerName: string | null;
    dueDate: string | null;
    initiativeId: string | null;
    initiativeTitle: string | null;
    meetingParticipants: string[];
    notes: string | null;
    linkedIssueKeys: string[];
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PmTaskInput {
    title: string;
    category: PmTaskCategory;
    status: PmTaskStatus;
    ownerName: string | null;
    dueDate: string | null;
    initiativeId: string | null;
    meetingParticipants: string[];
    notes: string | null;
    linkedIssueKeys: string[];
}

export interface PmTaskBuckets {
    overdue: PmTaskRecord[];
    today: PmTaskRecord[];
    upcoming: PmTaskRecord[];
    done: PmTaskRecord[];
}

export interface PrioritizationScoreRecord {
    id: string;
    framework: PrioritizationFramework;
    targetType: PrioritizationTargetType;
    targetId: string;
    initiativeId: string | null;
    reach: number;
    impact: number;
    confidence: number;
    effort: number;
    score: number;
    rationale: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PrioritizationScoreInput {
    targetType: PrioritizationTargetType;
    targetId: string;
    initiativeId: string | null;
    reach: number;
    impact: number;
    confidence: number;
    effort: number;
    rationale: string | null;
}

export type PrioritizationInput = PrioritizationScoreInput;

export interface PrioritizationCandidate {
    targetType: PrioritizationTargetType;
    targetId: string;
    title: string;
    summary: string | null;
    issueType: string | null;
    status: string | null;
    url: string | null;
    initiativeId: string | null;
    initiativeTitle: string | null;
}

export interface PrioritizationScoreView extends PrioritizationScoreRecord {
    targetTitle: string;
    targetSummary: string | null;
    targetStatus: string | null;
    targetIssueType: string | null;
    targetUrl: string | null;
    initiativeTitle: string | null;
}

export interface ObjectiveRecord {
    id: string;
    title: string;
    description: string | null;
    status: ObjectiveStatus;
    ownerName: string | null;
    startDate: string | null;
    targetDate: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ObjectiveInput {
    title: string;
    description: string | null;
    status: ObjectiveStatus;
    ownerName: string | null;
    startDate: string | null;
    targetDate: string | null;
}

export interface OutcomeRecord {
    id: string;
    objectiveId: string;
    objectiveTitle: string | null;
    title: string;
    description: string | null;
    baselineText: string | null;
    targetText: string | null;
    status: OutcomeStatus;
    createdAt: string;
    updatedAt: string;
}

export interface OutcomeInput {
    objectiveId: string;
    title: string;
    description: string | null;
    baselineText: string | null;
    targetText: string | null;
    status: OutcomeStatus;
}

export interface KpiMeasurementRecord {
    id: string;
    kpiId: string;
    measuredAt: string;
    value: number;
    note: string | null;
    createdAt: string;
}

export interface KpiMeasurementInput {
    kpiId: string;
    measuredAt: string;
    value: number;
    note: string | null;
}

export interface KpiRecord {
    id: string;
    outcomeId: string;
    outcomeTitle: string | null;
    name: string;
    metricType: KpiMetricType;
    unit: string | null;
    baselineValue: number | null;
    currentValue: number | null;
    targetValue: number | null;
    measurementFrequency: MeasurementFrequency;
    sourceType: KpiSourceType;
    sourceNotes: string | null;
    lastMeasuredAt: string | null;
    createdAt: string;
    updatedAt: string;
    measurements: KpiMeasurementRecord[];
}

export interface KpiInput {
    outcomeId: string;
    name: string;
    metricType: KpiMetricType;
    unit: string | null;
    baselineValue: number | null;
    currentValue: number | null;
    targetValue: number | null;
    measurementFrequency: MeasurementFrequency;
    sourceType: KpiSourceType;
    sourceNotes: string | null;
}

export interface OutcomeWithKpis extends OutcomeRecord {
    kpis: KpiRecord[];
    linkedInitiatives: InitiativeWithHealth[];
}

export interface ObjectiveWithChildren extends ObjectiveRecord {
    outcomes: OutcomeWithKpis[];
    linkedInitiatives: InitiativeWithHealth[];
}

export interface StrategyRiskAlert {
    id: string;
    type: StrategyRiskType;
    severity: StrategyRiskSeverity;
    title: string;
    description: string;
    entityType: 'objective' | 'outcome' | 'kpi' | 'initiative' | 'jira_issue';
    entityId: string;
    entityTitle: string;
    recommendation: string;
}

export interface NarrativeRecord {
    id: string;
    type: NarrativeReportType;
    audience: NarrativeAudience;
    title: string;
    generatedAt: string;
    summary: string;
    content: string;
    issueKeys: string[];
    initiativeIds: string[];
    objectiveIds: string[];
    decisionIds: string[];
    includeRisks: boolean;
    includeTasks: boolean;
}

export interface NarrativeRequest {
    type: NarrativeReportType;
    audience: NarrativeAudience;
    issueKeys: string[];
    initiativeIds: string[];
    objectiveIds: string[];
    decisionIds: string[];
    includeRisks: boolean;
    includeTasks: boolean;
    customInstructions: string | null;
}

export interface GuidanceRecommendation {
    id: string;
    cadence: GuidanceCadence;
    priority: GuidancePriority;
    title: string;
    summary: string;
    action: string;
    mentorNote: string;
    linkHref: string | null;
    linkLabel: string | null;
    signals: string[];
}

export interface OnboardingPlaybookRecord {
    id: string;
    name: string;
    durationDays: number;
    persona: string;
    createdAt: string;
    updatedAt: string;
}

export interface OnboardingStepRecord {
    id: string;
    playbookId: string;
    dayStart: number;
    dayEnd: number;
    category: string;
    title: string;
    description: string;
    successCriteria: string | null;
    linkedPath: string | null;
    sortOrder: number;
    completedAt: string | null;
}

export interface OnboardingPlaybookView extends OnboardingPlaybookRecord {
    steps: OnboardingStepRecord[];
    completedCount: number;
    totalCount: number;
}

export interface StakeholderRecord {
    id: string;
    name: string;
    role: string | null;
    organization: string | null;
    relationshipType: StakeholderRelationshipType;
    linkedInitiativeIds: string[];
    notes: string | null;
    interactionCount: number;
    latestInteractionAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface StakeholderInput {
    name: string;
    role: string | null;
    organization: string | null;
    relationshipType: StakeholderRelationshipType;
    linkedInitiativeIds: string[];
    notes: string | null;
}

export interface StakeholderInteractionRecord {
    id: string;
    stakeholderId: string;
    stakeholderName: string | null;
    interactionDate: string;
    title: string;
    notes: string | null;
    initiativeId: string | null;
    initiativeTitle: string | null;
    linkedIssueKeys: string[];
    createdAt: string;
    updatedAt: string;
}

export interface StakeholderInteractionInput {
    stakeholderId: string;
    interactionDate: string;
    title: string;
    notes: string | null;
    initiativeId: string | null;
    linkedIssueKeys: string[];
}

export interface FintechContextItemRecord {
    id: string;
    contextType: FintechContextType;
    name: string;
    description: string | null;
    systemName: string | null;
    sourceOfTruth: string | null;
    manualStepFlag: boolean;
    reconciliationRiskFlag: boolean;
    complianceNote: string | null;
    ownerStakeholderId: string | null;
    ownerStakeholderName: string | null;
    linkedInitiativeId: string | null;
    linkedInitiativeTitle: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface FintechContextItemInput {
    contextType: FintechContextType;
    name: string;
    description: string | null;
    systemName: string | null;
    sourceOfTruth: string | null;
    manualStepFlag: boolean;
    reconciliationRiskFlag: boolean;
    complianceNote: string | null;
    ownerStakeholderId: string | null;
    linkedInitiativeId: string | null;
}

export interface DecisionOptionRecord {
    id: string;
    decisionId: string;
    optionTitle: string;
    pros: string | null;
    cons: string | null;
    sortOrder: number;
    isSelected: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface DecisionOptionInput {
    optionTitle: string;
    pros: string | null;
    cons: string | null;
    sortOrder: number;
    isSelected: boolean;
}

export interface DecisionRecord {
    id: string;
    title: string;
    problemContext: string;
    finalDecision: string | null;
    expectedOutcome: string | null;
    ownerName: string | null;
    decisionDate: string;
    status: DecisionStatus;
    primaryInitiativeId: string | null;
    primaryInitiativeTitle: string | null;
    linkedInitiativeIds: string[];
    linkedIssueKeys: string[];
    createdAt: string;
    updatedAt: string;
}

export interface DecisionWithOptions extends DecisionRecord {
    options: DecisionOptionRecord[];
}

export interface DecisionInput {
    title: string;
    problemContext: string;
    finalDecision: string | null;
    expectedOutcome: string | null;
    ownerName: string | null;
    decisionDate: string;
    status: DecisionStatus;
    primaryInitiativeId: string | null;
    linkedInitiativeIds: string[];
    linkedIssueKeys: string[];
    options: DecisionOptionInput[];
}

export interface CommandCenterSummary {
    delivery: {
        currentSprintName: string | null;
        sprintIssues: number;
        completionRate: number;
        blockedCount: number;
        activeCount: number;
        openBugs: number;
        releaseReadyCount: number;
    };
    tasks: {
        overdueCount: number;
        todayCount: number;
        upcomingCount: number;
        doneCount: number;
        overdue: PmTaskRecord[];
        today: PmTaskRecord[];
        upcoming: PmTaskRecord[];
    };
    initiatives: InitiativeWithHealth[];
    topPriorities: PrioritizationScoreView[];
    decisions: {
        drafts: DecisionRecord[];
        recent: DecisionRecord[];
    };
    strategy: {
        activeObjectivesCount: number;
        activeOutcomesCount: number;
        activeKpisCount: number;
        objectivesAtRiskCount: number;
        staleKpisCount: number;
        unlinkedInitiativesCount: number;
    };
    risks: StrategyRiskAlert[];
    coach: {
        recommendations: GuidanceRecommendation[];
        onboardingCompletedCount: number;
        onboardingTotalCount: number;
        nextOnboardingSteps: OnboardingStepRecord[];
    };
    stakeholders: {
        totalCount: number;
        externalCount: number;
        recentInteractions: StakeholderInteractionRecord[];
    };
    fintech: {
        totalCount: number;
        manualStepCount: number;
        reconciliationRiskCount: number;
        missingSourceOfTruthCount: number;
        flaggedItems: FintechContextItemRecord[];
    };
}
