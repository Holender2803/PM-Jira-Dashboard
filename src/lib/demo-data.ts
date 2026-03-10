import { JiraIssue, Sprint, IssueStatus, IssueType, Priority } from '@/types';
import { computeIssueMetrics, WORKFLOW_STAGES } from './workflow';
import { addDays, formatISO, subDays } from 'date-fns';

const now = new Date();
const d = (days: number) => formatISO(subDays(now, days));

const SPRINTS: Sprint[] = [
    {
        id: 1,
        name: 'MDFM Sprint 24',
        state: 'closed',
        startDate: d(28),
        endDate: d(14),
        completeDate: d(14),
        goal: 'Ship Fare Management v2 and resolve legacy bugs',
    },
    {
        id: 2,
        name: 'MDFM Sprint 25',
        state: 'active',
        startDate: d(14),
        endDate: d(0),
        goal: 'Complete Policy Engine redesign and QA backlog',
    },
];

const ASSIGNEES = [
    { accountId: 'u1', displayName: 'Sarah Chen', emailAddress: 'sarah@company.com', avatarUrl: '' },
    { accountId: 'u2', displayName: 'Marcus Webb', emailAddress: 'marcus@company.com', avatarUrl: '' },
    { accountId: 'u3', displayName: 'Priya Nair', emailAddress: 'priya@company.com', avatarUrl: '' },
    { accountId: 'u4', displayName: 'Tom Bradley', emailAddress: 'tom@company.com', avatarUrl: '' },
    { accountId: 'u5', displayName: 'Lena Hoffmann', emailAddress: 'lena@company.com', avatarUrl: '' },
    { accountId: 'u6', displayName: 'James Park', emailAddress: 'james@company.com', avatarUrl: '' },
];

function deriveDueDate(key: string, status: IssueStatus): string | null {
    if (['Done', 'Archived', 'Rejected'].includes(status)) return null;
    const hash = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const offsetDays = (hash % 32) - 8; // deterministic window: overdue and future dates
    return formatISO(addDays(now, offsetDays), { representation: 'date' });
}

function makeIssue(
    key: string,
    summary: string,
    issueType: IssueType,
    status: IssueStatus,
    priority: Priority,
    assigneeIdx: number,
    sprint: Sprint | null,
    storyPoints: number | null,
    createdDaysAgo: number,
    updatedDaysAgoOrResolved: number | boolean,
    ...rest: unknown[]
): JiraIssue {
    let updatedDaysAgo: number;
    let resolved = false;
    let epicKey: string | undefined;
    let epicSummary: string | undefined;
    let labels: string[] = [];
    let squad = 'MDFM';

    if (typeof updatedDaysAgoOrResolved === 'number') {
        updatedDaysAgo = updatedDaysAgoOrResolved;
        if (typeof rest[0] === 'boolean') {
            resolved = rest[0];
            epicKey = typeof rest[1] === 'string' ? rest[1] : undefined;
            epicSummary = typeof rest[2] === 'string' ? rest[2] : undefined;
            labels = Array.isArray(rest[3]) ? rest[3] as string[] : [];
            squad = typeof rest[4] === 'string' ? rest[4] : 'MDFM';
        } else {
            epicKey = typeof rest[0] === 'string' ? rest[0] : undefined;
            epicSummary = typeof rest[1] === 'string' ? rest[1] : undefined;
            labels = Array.isArray(rest[2]) ? rest[2] as string[] : [];
            squad = typeof rest[3] === 'string' ? rest[3] : 'MDFM';
        }
    } else {
        updatedDaysAgo = Math.max(0, createdDaysAgo - 1);
        resolved = updatedDaysAgoOrResolved;
        epicKey = typeof rest[0] === 'string' ? rest[0] : undefined;
        epicSummary = typeof rest[1] === 'string' ? rest[1] : undefined;
        labels = Array.isArray(rest[2]) ? rest[2] as string[] : [];
        squad = typeof rest[3] === 'string' ? rest[3] : 'MDFM';
    }

    const created = d(createdDaysAgo);
    const updated = d(updatedDaysAgo);
    const resolvedDate = resolved ? d(updatedDaysAgo) : null;
    const assignee = assigneeIdx >= 0 ? ASSIGNEES[assigneeIdx] : null;
    const changelog = generateChangelog(status, createdDaysAgo, updatedDaysAgo);

    const metrics = computeIssueMetrics({ created, status, resolved: resolvedDate, changelog });

    return {
        id: key,
        key,
        summary,
        description: `This ticket covers: ${summary}. Acceptance criteria defined in Confluence.`,
        issueType,
        status,
        priority,
        assignee,
        reporter: ASSIGNEES[0],
        labels,
        components: [],
        parentKey: null,
        parentSummary: null,
        epicKey: epicKey || null,
        epicSummary: epicSummary || null,
        sprint,
        storyPoints,
        created,
        updated,
        resolved: resolvedDate,
        dueDate: deriveDueDate(key, status),
        changelog,
        commentsCount: Math.floor(Math.random() * 8),
        linkedIssues: [],
        project: key.startsWith('ENG') ? 'Engineering' : 'Product',
        workType: null,
        squad,
        url: `https://company.atlassian.net/browse/${key}`,
        ...metrics,
        workflowStage: WORKFLOW_STAGES[status] || 'intake',
    };
}

function generateChangelog(
    currentStatus: IssueStatus,
    createdDaysAgo: number,
    updatedDaysAgo: number,
): import('@/types').ChangelogEntry[] {
    const author = ASSIGNEES[0];
    const entries: import('@/types').ChangelogEntry[] = [];

    const flow: IssueStatus[] = ['Open', 'In Progress'];
    if (['In Review', 'Reviewed', 'Ready for QA', 'In QA', 'Ready for Acceptance', 'Ready for Release', 'Done'].includes(currentStatus)) {
        flow.push('In Review');
    }
    if (['Ready for QA', 'In QA', 'Ready for Acceptance', 'Ready for Release', 'Done'].includes(currentStatus)) {
        flow.push('Ready for QA', 'In QA');
    }
    if (['Done'].includes(currentStatus)) {
        flow.push('Done');
    }

    const totalDays = createdDaysAgo - updatedDaysAgo;
    const step = Math.max(1, Math.floor(totalDays / flow.length));

    flow.forEach((status, i) => {
        const daysAgo = createdDaysAgo - i * step;
        entries.push({
            id: `cl-${Math.random()}`,
            created: d(Math.max(updatedDaysAgo, daysAgo)),
            author,
            field: 'status',
            fromString: i === 0 ? 'Backlog' : flow[i - 1],
            toString: status,
        });
    });

    return entries;
}

// ─── Build the demo dataset ────────────────────────────────────────────────────

export function getDemoIssues(): JiraIssue[] {
    const s24 = SPRINTS[0];
    const s25 = SPRINTS[1];

    return [
        // ── Sprint 25 (Current) — In Progress ──
        makeIssue('ENG-1021', 'Policy Engine: Refactor fare calculation rules', 'Story', 'In Progress', 'High', 0, s25, 8, 10, 2, false, 'ENG-900', 'Policy Engine Redesign', ['policy', 'backend'], 'MDFM'),
        makeIssue('ENG-1022', 'Add dynamic surcharge support to fare API', 'Story', 'In Progress', 'High', 1, s25, 5, 8, 1, false, 'ENG-900', 'Policy Engine Redesign', ['api', 'fare'], 'MDFM'),
        makeIssue('ENG-1023', 'Fix: Race condition in booking lock mechanism', 'Bug', 'In Progress', 'Highest', 2, s25, 3, 1, false, undefined, undefined, ['bug', 'critical'], 'MDFM'),
        makeIssue('ENG-1024', 'UI: Fare breakdown modal redesign', 'Story', 'In Progress', 'Medium', 3, s25, 5, 3, false, 'ENG-901', 'Fare Display Redesign', ['frontend', 'ui'], 'MDFM'),

        // ── Sprint 25 — Blocked ──
        makeIssue('ENG-1025', 'Implement SSO integration for corporate accounts', 'Story', 'Blocked', 'High', 4, s25, 13, 0, false, 'ENG-902', 'Corporate SSO', ['sso', 'auth'], 'Legacy MDFM'),
        makeIssue('ENG-1026', 'DB migration: Add policy_rules table indexes', 'Technical Task', 'Blocked', 'Medium', 5, s25, 8, 4, false, undefined, undefined, ['database'], 'MDFM'),

        // ── Sprint 25 — In Review ──
        makeIssue('ENG-1027', 'Policy validator: Add unit test coverage', 'Task', 'In Review', 'Medium', 1, s25, 5, 2, false, 'ENG-900', 'Policy Engine Redesign', ['testing'], 'MDFM'),
        makeIssue('ENG-1028', 'Fix: Incorrect currency conversion on multi-leg trips', 'Bug', 'In Review', 'High', 2, s25, 6, 1, false, undefined, undefined, ['bug', 'currency'], 'MDFM'),
        makeIssue('ENG-1029', 'Refactor LegacyFareController to use new service layer', 'Technical Task', 'In Review', 'Medium', 0, s25, 8, 2, false, undefined, undefined, ['legacy', 'refactor'], 'Legacy MDFM'),

        // ── Sprint 25 — In QA ──
        makeIssue('ENG-1030', 'Fare rules: E2E tests for discount application', 'Story', 'In QA', 'Medium', 3, s25, 5, 3, false, 'ENG-900', 'Policy Engine Redesign', ['qa', 'testing'], 'MDFM'),
        makeIssue('ENG-1031', 'Fix: Admin panel crashes on empty seat map', 'Bug', 'In QA', 'High', 4, s25, 4, 1, false, undefined, undefined, ['bug', 'admin'], 'MDFM'),
        makeIssue('ENG-1032', 'Developer Request: Export report as CSV', 'Developer Request', 'In QA', 'Low', 5, s25, 3, 1, false, undefined, undefined, ['reporting'], 'MDFM'),

        // ── Sprint 25 — Ready for Release ──
        makeIssue('ENG-1033', 'Feature: Preferred vendor priority setting', 'Story', 'Ready for Release', 'Medium', 1, s25, 12, 3, false, 'ENG-903', 'Vendor Management', ['feature'], 'MDFM'),
        makeIssue('ENG-1034', 'Fix: Timezone bug in trip summary emails', 'Bug', 'Ready for Release', 'High', 2, s25, 9, 2, false, undefined, undefined, ['bug', 'email'], 'MDFM'),

        // ── Sprint 25 — Done ──
        makeIssue('ENG-1035', 'Policy Engine: Core rule processor v1', 'Story', 'Done', 'High', 0, s25, 8, 8, true, 'ENG-900', 'Policy Engine Redesign', [], 'MDFM'),
        makeIssue('ENG-1036', 'Update Swagger docs for fare API v2', 'Task', 'Done', 'Low', 1, s25, 5, 10, true, undefined, undefined, ['docs'], 'MDFM'),
        makeIssue('ENG-1037', 'Fix: Memory leak in long-polling route update service', 'Bug', 'Done', 'Highest', 2, s25, 3, 9, true, undefined, undefined, ['bug', 'performance'], 'MDFM'),
        makeIssue('ENG-1038', 'Spike: Evaluate Redis for real-time seat availability', 'Spike', 'Done', 'Medium', 3, s25, 8, 12, true, undefined, undefined, ['spike', 'research'], 'MDFM'),
        makeIssue('ENG-1039', 'Implement audit log for policy changes', 'Story', 'Done', 'Medium', 4, s25, 5, 11, true, 'ENG-900', 'Policy Engine Redesign', ['audit'], 'MDFM'),
        makeIssue('ENG-1040', 'Developer Request: Bulk import corporate profiles via API', 'Developer Request', 'Done', 'Medium', 5, s25, 3, 10, true, undefined, undefined, ['api'], 'Legacy MDFM'),
        makeIssue('ENG-1041', 'Fix: Route card not updating after live price refresh', 'Bug', 'Done', 'High', 0, s25, 2, 9, true, undefined, undefined, ['bug', 'frontend'], 'MDFM'),
        makeIssue('ENG-1042', 'Add rate limiting to public booking API', 'Technical Task', 'Done', 'High', 1, s25, 5, 10, true, undefined, undefined, ['security', 'api'], 'MDFM'),

        // ── Backlog / Open ──
        makeIssue('ENG-1043', 'Redesign travel policy management screen', 'Story', 'Backlog', 'Medium', -1, null, 8, 20, false, 'ENG-904', 'Admin UX Refresh', ['frontend', 'ux'], 'MDFM'),
        makeIssue('ENG-1044', 'Fix: Non-refundable ticket flow shows wrong confirmation', 'Bug', 'Open', 'High', -1, null, 2, 18, false, undefined, undefined, ['bug'], 'MDFM'),
        makeIssue('ENG-1045', 'Implement multi-currency wallet for corporate accounts', 'Story', 'Backlog', 'Low', -1, null, 13, 25, false, 'ENG-905', 'Wallet Feature', ['feature', 'payments'], 'MDFM'),
        makeIssue('ENG-1046', 'Developer Request: API webhooks for booking status changes', 'Developer Request', 'Open', 'Medium', -1, null, 5, 22, false, undefined, undefined, ['api', 'webhook'], 'Legacy MDFM'),
        makeIssue('ENG-1047', 'Accessibility: WCAG 2.1 audit and fixes for booking flow', 'Task', 'Backlog', 'Medium', -1, null, 5, 30, false, undefined, undefined, ['a11y'], 'MDFM'),
        makeIssue('ENG-1048', 'Fix: Sorting by departure time broken on mobile', 'Bug', 'Open', 'Medium', -1, null, 2, 15, false, undefined, undefined, ['bug', 'mobile'], 'MDFM'),
        makeIssue('ENG-1049', 'Icebox: Predictive pricing suggestions feature', 'Story', 'Icebox', 'Low', -1, null, 21, 45, false, undefined, undefined, ['future', 'ai'], 'MDFM'),

        // ── Refinement / Design ──
        makeIssue('ENG-1050', 'Redesign expense report export flow', 'Story', 'Refinement', 'Medium', 0, null, 8, 5, false, 'ENG-904', 'Admin UX Refresh', ['ux'], 'MDFM'),
        makeIssue('ENG-1051', 'Design: New trip summary card component system', 'Story', 'Design', 'Medium', 3, null, 5, 4, false, 'ENG-901', 'Fare Display Redesign', ['design', 'ui'], 'MDFM'),
        makeIssue('ENG-1052', 'Spike: Evaluate GraphQL migration path', 'Spike', 'Refinement', 'Low', -1, null, 8, 7, false, undefined, undefined, ['spike', 'architecture'], 'MDFM'),

        // ── Sprint 24 (Previous) — Done ──
        makeIssue('ENG-0991', 'Fare Management v2: Core pricing API', 'Story', 'Done', 'High', 0, s24, 13, 28, true, 'ENG-850', 'Fare Management v2', [], 'MDFM'),
        makeIssue('ENG-0992', 'Fix: Duplicate booking race condition', 'Bug', 'Done', 'Highest', 2, s24, 3, 26, true, undefined, undefined, ['bug', 'critical'], 'MDFM'),
        makeIssue('ENG-0993', 'Implement trip cancellation flow v2', 'Story', 'Done', 'High', 1, s24, 8, 25, true, 'ENG-850', 'Fare Management v2', [], 'MDFM'),
        makeIssue('ENG-0994', 'Developer Request: Rate card management dashboard', 'Developer Request', 'Done', 'Medium', 3, s24, 5, 24, true, undefined, undefined, ['developer-request'], 'Legacy MDFM'),
        makeIssue('ENG-0995', 'Fix: Search results sorting edge case', 'Bug', 'Done', 'Medium', 4, s24, 3, 27, true, undefined, undefined, ['bug'], 'MDFM'),
        makeIssue('ENG-0996', 'Add carbon emission estimates to trip cards', 'Story', 'Done', 'Low', 5, s24, 5, 28, true, 'ENG-851', 'Sustainability Features', [], 'MDFM'),
        makeIssue('ENG-0997', 'Technical cleanup: Remove deprecated v1 booking endpoints', 'Technical Task', 'Done', 'Medium', 0, s24, 5, 22, true, undefined, undefined, ['cleanup', 'legacy'], 'Legacy MDFM'),
        makeIssue('ENG-0998', 'Fix: Policy override not persisting for admin users', 'Bug', 'Done', 'High', 1, s24, 2, 21, true, undefined, undefined, ['bug', 'admin'], 'MDFM'),
        makeIssue('ENG-0999', 'Spike: Mobile offline booking feasibility', 'Spike', 'Done', 'Medium', 2, s24, 5, 20, true, undefined, undefined, ['spike'], 'MDFM'),
        makeIssue('ENG-1000', 'Add pagination to trips history API', 'Task', 'Done', 'Low', 3, s24, 3, 25, true, undefined, undefined, ['api', 'performance'], 'MDFM'),

        // ── Sprint 24 — Carried Over (not done) ──
        makeIssue('ENG-1001', 'Legacy fare sync: Handle edge case for charter flights', 'Story', 'Open', 'Medium', -1, null, 13, 14, false, 'ENG-850', 'Fare Management v2', ['legacy'], 'Legacy MDFM'),
        makeIssue('ENG-1002', 'Fix: PDF receipt generation fails for multi-leg trips', 'Bug', 'Open', 'High', -1, null, 3, 14, false, undefined, undefined, ['bug', 'reports'], 'MDFM'),

        // ── Aging tickets ──
        makeIssue('ENG-0901', 'Refactor authentication middleware to support OAuth2', 'Technical Task', 'In Progress', 'Medium', 2, null, 13, 35, false, undefined, undefined, ['auth', 'legacy'], 'Legacy MDFM'),
        makeIssue('ENG-0856', 'Fix: Search autocomplete performance degradation', 'Bug', 'Blocked', 'High', 4, null, 3, 42, false, undefined, undefined, ['bug', 'performance'], 'MDFM'),
        makeIssue('ENG-0812', 'Migrate booking service to microservices architecture', 'Technical Task', 'Refinement', 'Low', -1, null, 21, 60, false, undefined, undefined, ['architecture', 'migration'], 'Legacy MDFM'),
        makeIssue('ENG-0801', 'Developer Request: Bulk export of booking data', 'Developer Request', 'Open', 'Low', -1, null, 5, 75, false, undefined, undefined, ['export'], 'Legacy MDFM'),
    ];
}

export function getDemoSprints(): Sprint[] {
    return SPRINTS;
}

export const DEMO_ACTIVE_SPRINT = SPRINTS[1];
export const DEMO_PREVIOUS_SPRINT = SPRINTS[0];
