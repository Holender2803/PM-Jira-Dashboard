// ─── Jira Issue Types ──────────────────────────────────────────────────────────

export type IssueStatus =
    | 'Backlog' | 'Open' | 'Icebox' | 'Refinement' | 'Design'
    | 'In Progress' | 'Blocked' | 'In Review' | 'Reviewed'
    | 'Ready for QA' | 'In QA' | 'Ready for Acceptance'
    | 'Ready for Release' | 'Done' | 'Archived' | 'Rejected';

export type WorkflowGroup =
    | 'Backlog'
    | 'Planning'
    | 'In Progress'
    | 'Review / QA'
    | 'Awaiting'
    | 'Blocked / Hold'
    | 'Done';

export type WorkflowStage =
    | 'intake' | 'discovery' | 'delivery' | 'review' | 'qa' | 'release' | 'closed';

export type IssueType =
    | 'Bug' | 'Story' | 'Task' | 'Feature' | 'Epic' | 'Subtask'
    | 'Technical Task' | 'Spike' | 'Developer Request' | 'Support' | 'Chore';

export type Priority = 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';

export interface JiraUser {
    accountId: string;
    displayName: string;
    emailAddress?: string;
    avatarUrl?: string;
}

export interface Sprint {
    id: number;
    name: string;
    state: 'active' | 'closed' | 'future';
    startDate?: string;
    endDate?: string;
    completeDate?: string;
    goal?: string;
}

export interface ChangelogEntry {
    id: string;
    created: string;
    author: JiraUser;
    field: string;
    fromString: string | null;
    toString: string | null;
}

export interface JiraIssue {
    id: string;
    key: string;
    summary: string;
    description: string | null;
    issueType: IssueType;
    status: IssueStatus;
    priority: Priority | null;
    assignee: JiraUser | null;
    reporter: JiraUser | null;
    labels: string[];
    components: string[];
    parentKey: string | null;
    parentSummary: string | null;
    epicKey: string | null;
    epicSummary: string | null;
    sprint: Sprint | null;
    storyPoints: number | null;
    created: string;
    updated: string;
    resolved: string | null;
    dueDate: string | null;
    changelog: ChangelogEntry[];
    commentsCount: number;
    linkedIssues: string[];
    project: string;
    workType: string | null;
    squad: string | null;
    url: string;
    // Computed
    age: number; // days since created
    cycleTime: number | null; // days from In Progress to Done
    leadTime: number | null; // days from Created to Done
    timeInCurrentStatus: number; // days
    reopenCount: number;
    workflowStage: WorkflowStage;
}

// ─── Dashboard Filter Types ────────────────────────────────────────────────────

export interface DashboardFilters {
    sprint?: string;
    sprintId?: number;
    dateFrom?: string;
    dateTo?: string;
    issueType?: IssueType[];
    status?: IssueStatus[];
    assignee?: string[];
    priority?: Priority[];
    squad?: string[];
    project?: string[];
    label?: string[];
    epicKey?: string[];
    epicPresence?: 'with' | 'without';
    blockedOnly?: boolean;
    bugsOnly?: boolean;
    unresolvedOnly?: boolean;
    atRiskOnly?: boolean;
    selectedOnly?: boolean;
    selectedKeys?: string[];
    groupFilter?: WorkflowGroup[];
}

// ─── Metric Types ─────────────────────────────────────────────────────────────

export interface SprintMetrics {
    sprint: Sprint | null;
    committed: number;
    completed: number;
    completionRate: number;
    committedPoints: number;
    completedPoints: number;
    addedAfterStart: number;
    removedFromSprint: number;
    carriedOver: number;
    inProgress: number;
    blocked: number;
    done: number;
    byStatus: Record<IssueStatus, number>;
    byDay: { date: string; completed: number; remaining: number }[];
}

export interface WorkMixMetrics {
    byType: Record<string, { count: number; points: number }>;
    bugsRatio: number;
    featureRatio: number;
    devRequestRatio: number;
    sprintOverSprint: SprintMixChange[];
}

export interface SprintMixChange {
    sprintName: string;
    bugs: number;
    features: number;
    devRequests: number;
    tasks: number;
}

export interface AgingBucket {
    label: string;
    min: number;
    max: number;
    count: number;
    issues: JiraIssue[];
}

export interface WorkflowFunnelStage {
    stage: WorkflowStage;
    label: string;
    statuses: IssueStatus[];
    count: number;
    avgDaysInStage: number;
    oldestDays: number;
    color: string;
}

// ─── AI Report Types ───────────────────────────────────────────────────────────

export type AIReportType =
    | 'sprint_summary' | 'stakeholder_update' | 'executive_summary'
    | 'pm_weekly' | 'release_notes' | 'blockers_summary' | 'selected_tickets';

export type AIReportTone =
    | 'executive' | 'pm_internal' | 'engineering' | 'slack' | 'polished';

export interface AIReportRequest {
    type: AIReportType;
    tone: AIReportTone;
    issueKeys: string[];
    sprintName?: string;
    customInstructions?: string;
}

export interface AIReportResponse {
    id: string;
    type: AIReportType;
    tone: AIReportTone;
    generatedAt: string;
    summary: string;
    content: string;
    issueKeys: string[];
}

// ─── Saved View Types ─────────────────────────────────────────────────────────

export interface SavedView {
    id: string;
    name: string;
    description?: string;
    filters: DashboardFilters;
    createdAt: string;
    updatedAt: string;
    isDefault?: boolean;
}

// ─── Config Types ─────────────────────────────────────────────────────────────

export interface JiraConfig {
    baseUrl: string;
    email: string;
    apiToken: string;
    jql: string;
    syncIntervalMinutes: number;
}

export interface AppConfig {
    jira: JiraConfig;
    demoMode: boolean;
    lastSynced: string | null;
    totalIssues: number;
}
