import OpenAI from 'openai';
import getDb from '@/lib/db';
import { queryIssues, getActiveSprints } from '@/lib/issue-store';
import { calculateWorkflowMetrics, getReopenRates } from '@/lib/analytics';
import { CLOSED_STATUSES } from '@/lib/workflow';

export type ReportAudience = 'team' | 'executive' | 'client';
type AIProvider = 'openai' | 'groq';

interface AIClientConfig {
    provider: AIProvider;
    apiKey: string;
    baseURL?: string;
    model: string;
}

interface TeamConfigRow {
    active_engineers: number | null;
    hourly_rate: number | null;
    productive_hours_per_sprint: number | null;
}

interface StatusReportRow {
    id: string;
    generated_at: string;
    audience: string;
    sprint_name: string;
    content: string;
    is_auto: number | null;
}

interface ReportData {
    sprint: {
        name: string;
        committed: number;
        done: number;
        inProgress: number;
        blocked: number;
    };
    resolvedLast30Days: Array<{
        key: string;
        summary: string;
        type: string;
        assignee: string;
    }>;
    openBlockers: Array<{
        key: string;
        summary: string;
        daysBlocked: number;
    }>;
    activeEpics: Array<{
        name: string;
        totalTickets: number;
        doneTickets: number;
    }>;
    quality: {
        openBugs: number;
        reopenRate: number;
        bounceRate: number;
    };
    cost: {
        sprintCost: number | null;
        costPerTicket: number | null;
        deliveryEfficiency: number;
        carryOverCost: number | null;
    };
}

export interface StatusReportRecord {
    id: string;
    generatedAt: string;
    audience: ReportAudience;
    sprintName: string;
    content: string;
    isAuto: boolean;
}

export interface CreateStatusReportOptions {
    audience: ReportAudience;
    isAuto?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CURRENCY = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
});

export function normalizeReportAudience(value: unknown): ReportAudience {
    if (value === 'executive') return 'executive';
    if (value === 'client') return 'client';
    return 'team';
}

function toValidDate(value?: string | null): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toPositiveInteger(value: number | null | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    const rounded = Math.round(value);
    return rounded > 0 ? rounded : fallback;
}

function formatUsd(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return 'N/A';
    return CURRENCY.format(Math.round(value));
}

function stripTicketKey(value: string): string {
    return value.replace(/\b[A-Z][A-Z0-9]+-\d+\b/g, '').replace(/\s{2,}/g, ' ').trim();
}

function sanitizeClientSummary(value: string): string {
    return stripTicketKey(value)
        .replace(/\b(epic|backlog|jira|qa|api|refactor|sprint)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function resolveAIClientConfig(): AIClientConfig | null {
    const explicitProvider = (process.env.AI_PROVIDER || '').toLowerCase();
    const openAIKey = process.env.OPENAI_API_KEY || '';
    const groqKey =
        process.env.GROQ_API_KEY ||
        (openAIKey.startsWith('gsk_') ? openAIKey : '');

    const usingGroq =
        explicitProvider === 'groq' ||
        (!explicitProvider && groqKey.length > 0 && !openAIKey.startsWith('sk-'));

    if (usingGroq) {
        if (!groqKey || groqKey === 'gsk-your_groq_api_key_here') return null;
        return {
            provider: 'groq',
            apiKey: groqKey,
            baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        };
    }

    if (!openAIKey || openAIKey === 'sk-your_openai_api_key_here') return null;
    return {
        provider: 'openai',
        apiKey: openAIKey,
        baseURL: process.env.OPENAI_BASE_URL || undefined,
        model: process.env.OPENAI_MODEL || 'gpt-4o',
    };
}

export function ensureStatusReportsTable() {
    const db = getDb();
    db.exec(`
    CREATE TABLE IF NOT EXISTS status_reports (
      id TEXT PRIMARY KEY,
      generated_at TEXT,
      audience TEXT,
      sprint_name TEXT,
      content TEXT,
      is_auto INTEGER DEFAULT 0
    )
  `);

    const columns = db.prepare(`PRAGMA table_info(status_reports)`).all() as { name: string }[];
    if (!columns.some((column) => column.name === 'is_auto')) {
        db.exec(`ALTER TABLE status_reports ADD COLUMN is_auto INTEGER DEFAULT 0`);
    }
}

function collectReportData(): ReportData {
    const allIssues = queryIssues();
    const sprintIssues = queryIssues({ sprint: 'current' });
    const activeSprint = getActiveSprints().find((sprint) => sprint.state === 'active') || null;
    const sprintName = sprintIssues[0]?.sprint?.name || activeSprint?.name || 'Current Sprint';

    const committed = sprintIssues.length;
    const doneIssues = sprintIssues.filter((issue) => CLOSED_STATUSES.includes(issue.status));
    const done = doneIssues.length;
    const inProgress = sprintIssues.filter((issue) => issue.status === 'In Progress').length;
    const blockedIssues = sprintIssues
        .filter((issue) => issue.status === 'Blocked')
        .sort((a, b) => b.timeInCurrentStatus - a.timeInCurrentStatus);
    const blocked = blockedIssues.length;

    const cutoff = Date.now() - (30 * DAY_MS);
    const resolvedLast30Days = allIssues
        .filter((issue) => {
            const resolvedAt = toValidDate(issue.resolved);
            return (
                resolvedAt !== null &&
                resolvedAt.getTime() >= cutoff &&
                CLOSED_STATUSES.includes(issue.status)
            );
        })
        .sort((a, b) => {
            const aResolved = toValidDate(a.resolved)?.getTime() || 0;
            const bResolved = toValidDate(b.resolved)?.getTime() || 0;
            return bResolved - aResolved;
        })
        .map((issue) => ({
            key: issue.key,
            summary: issue.summary,
            type: issue.issueType,
            assignee: issue.assignee?.displayName || 'Unassigned',
        }));

    const openBlockers = blockedIssues.map((issue) => ({
        key: issue.key,
        summary: issue.summary,
        daysBlocked: issue.timeInCurrentStatus,
    }));

    const epicMap = new Map<string, { name: string; totalTickets: number; doneTickets: number }>();
    for (const issue of sprintIssues) {
        if (!issue.epicKey) continue;
        const key = issue.epicKey;
        const name = issue.epicSummary && issue.epicSummary !== key
            ? issue.epicSummary
            : key;
        const row = epicMap.get(key) || { name, totalTickets: 0, doneTickets: 0 };
        row.totalTickets += 1;
        if (CLOSED_STATUSES.includes(issue.status)) row.doneTickets += 1;
        epicMap.set(key, row);
    }
    const activeEpics = [...epicMap.values()].sort((a, b) => b.totalTickets - a.totalTickets);

    const openBugs = sprintIssues.filter(
        (issue) => !CLOSED_STATUSES.includes(issue.status) && issue.issueType === 'Bug'
    ).length;
    const reopenRate = getReopenRates(sprintIssues).reopenRate;
    const workflowMetrics = calculateWorkflowMetrics(sprintIssues);
    const bounceRate = sprintIssues.length > 0
        ? Number(((workflowMetrics.bounceBackIssues.length / sprintIssues.length) * 100).toFixed(1))
        : 0;

    const carryOverCount = sprintIssues.filter(
        (issue) =>
            !CLOSED_STATUSES.includes(issue.status) &&
            (issue.status === 'In Progress' || issue.status === 'Open')
    ).length;

    const db = getDb();
    const teamConfigRow = db.prepare(`
      SELECT active_engineers, hourly_rate, productive_hours_per_sprint
      FROM team_config
      WHERE id = 1
    `).get() as TeamConfigRow | undefined;

    const activeEngineers = toPositiveInteger(teamConfigRow?.active_engineers, 3);
    const hourlyRate = toPositiveInteger(teamConfigRow?.hourly_rate, 100);
    const productiveHoursPerSprint = toPositiveInteger(teamConfigRow?.productive_hours_per_sprint, 50);

    const sprintCost = teamConfigRow
        ? activeEngineers * hourlyRate * productiveHoursPerSprint
        : null;
    const costPerTicket = sprintCost !== null && done > 0
        ? sprintCost / done
        : null;
    const deliveryEfficiency = committed > 0
        ? Number(((done / committed) * 100).toFixed(1))
        : 0;
    const carryOverCost = sprintCost !== null && committed > 0
        ? carryOverCount * (sprintCost / committed)
        : null;

    return {
        sprint: {
            name: sprintName,
            committed,
            done,
            inProgress,
            blocked,
        },
        resolvedLast30Days,
        openBlockers,
        activeEpics,
        quality: {
            openBugs,
            reopenRate,
            bounceRate,
        },
        cost: {
            sprintCost,
            costPerTicket,
            deliveryEfficiency,
            carryOverCost,
        },
    };
}

function buildAudienceInstructions(audience: ReportAudience, data: ReportData): string {
    const resolvedForTeam = data.resolvedLast30Days
        .slice(0, 12)
        .map((issue) => `- ${issue.key}: ${issue.summary} (${issue.type}, ${issue.assignee})`)
        .join('\n') || '- None';

    const resolvedForExecutive = data.resolvedLast30Days
        .slice(0, 12)
        .map((issue) => `- ${stripTicketKey(issue.summary)} (${issue.type})`)
        .join('\n') || '- None';

    const resolvedForClient = data.resolvedLast30Days
        .slice(0, 12)
        .map((issue) => `- ${sanitizeClientSummary(issue.summary) || 'Customer-facing improvement completed'}`)
        .join('\n') || '- None';

    const blockersForTeam = data.openBlockers
        .slice(0, 10)
        .map((issue) => `- ${issue.key}: ${issue.summary} (blocked ${issue.daysBlocked}d)`)
        .join('\n') || '- None';

    const blockersForExecutive = data.openBlockers
        .slice(0, 10)
        .map((issue) => `- ${stripTicketKey(issue.summary)} (blocked ${issue.daysBlocked}d)`)
        .join('\n') || '- None';

    const blockersForClient = data.openBlockers
        .slice(0, 10)
        .map((issue) => `- ${sanitizeClientSummary(issue.summary) || 'An in-flight item requires additional coordination'}`)
        .join('\n') || '- None';

    const epicLines = data.activeEpics
        .slice(0, 8)
        .map((epic) => `- ${epic.name}: ${epic.doneTickets}/${epic.totalTickets} done`)
        .join('\n') || '- None';

    const structure = [
        'Output valid markdown using this exact section order:',
        `## Sprint Status — ${data.sprint.name}`,
        '### 🎯 Executive Summary',
        ...(audience === 'client' ? [] : ['### 💰 Sprint Investment']),
        '### ✅ Resolved This Period',
        '### 🔄 In Progress',
        '### ⚠️ Risks & Blockers',
        '### 📋 Next Steps',
    ].join('\n');

    if (audience === 'executive') {
        return [
            'Audience: Executive.',
            'Business outcomes only. No ticket keys.',
            'Lead the Executive Summary with sprint cost and delivery rate.',
            'Keep every section under 100 words.',
            structure,
            'Data:',
            `Sprint: committed ${data.sprint.committed}, done ${data.sprint.done}, in progress ${data.sprint.inProgress}, blocked ${data.sprint.blocked}.`,
            `Cost: sprintCost ${formatUsd(data.cost.sprintCost)}, costPerTicket ${formatUsd(data.cost.costPerTicket)}, deliveryEfficiency ${data.cost.deliveryEfficiency}%, carryOverCost ${formatUsd(data.cost.carryOverCost)}.`,
            `Quality: openBugs ${data.quality.openBugs}, reopenRate ${data.quality.reopenRate}%, bounceRate ${data.quality.bounceRate}%.`,
            'Resolved items (no keys):',
            resolvedForExecutive,
            'Open blockers (no keys):',
            blockersForExecutive,
            'Active epics:',
            epicLines,
        ].join('\n');
    }

    if (audience === 'client') {
        return [
            'Audience: Client.',
            'Feature-focused and positive framing.',
            'No ticket keys. No cost data. No internal names.',
            'Use language patterns: "we completed" and "we are building".',
            structure,
            'Data:',
            `Sprint: committed ${data.sprint.committed}, done ${data.sprint.done}, in progress ${data.sprint.inProgress}, blocked ${data.sprint.blocked}.`,
            `Quality: openBugs ${data.quality.openBugs}, reopenRate ${data.quality.reopenRate}%, bounceRate ${data.quality.bounceRate}%.`,
            'Resolved items (client-safe summaries):',
            resolvedForClient,
            'Open blockers (client-safe summaries):',
            blockersForClient,
            'Active epics:',
            epicLines,
        ].join('\n');
    }

    return [
        'Audience: Team.',
        'Include ticket keys, technical detail, and all provided metrics.',
        'Provide practical detail PM + engineering can execute from.',
        structure,
        'Data:',
        `Sprint: committed ${data.sprint.committed}, done ${data.sprint.done}, in progress ${data.sprint.inProgress}, blocked ${data.sprint.blocked}.`,
        `Cost: sprintCost ${formatUsd(data.cost.sprintCost)}, costPerTicket ${formatUsd(data.cost.costPerTicket)}, deliveryEfficiency ${data.cost.deliveryEfficiency}%, carryOverCost ${formatUsd(data.cost.carryOverCost)}.`,
        `Quality: openBugs ${data.quality.openBugs}, reopenRate ${data.quality.reopenRate}%, bounceRate ${data.quality.bounceRate}%.`,
        'Resolved items:',
        resolvedForTeam,
        'Open blockers:',
        blockersForTeam,
        'Active epics:',
        epicLines,
    ].join('\n');
}

function generateFallbackReport(data: ReportData, audience: ReportAudience): string {
    const resolvedLine = data.resolvedLast30Days
        .slice(0, 5)
        .map((issue) =>
            audience === 'team'
                ? `- ${issue.key} — ${issue.summary}`
                : `- ${sanitizeClientSummary(issue.summary) || stripTicketKey(issue.summary)}`
        )
        .join('\n') || '- None this period';

    const blockerLine = data.openBlockers
        .slice(0, 5)
        .map((issue) =>
            audience === 'team'
                ? `- ${issue.key} — blocked ${issue.daysBlocked}d: ${issue.summary}`
                : `- ${sanitizeClientSummary(issue.summary) || 'An item needs extra coordination'}`
        )
        .join('\n') || '- No active blockers';

    const inProgressLine = [
        `- ${data.sprint.inProgress} items in progress right now.`,
        `- ${data.activeEpics.length} active epics carrying current sprint scope.`,
        `- Quality watch: ${data.quality.openBugs} open bugs, ${data.quality.reopenRate}% reopen rate, ${data.quality.bounceRate}% bounce rate.`,
    ].join('\n');

    const costSection = audience === 'client'
        ? ''
        : `### 💰 Sprint Investment
- Estimated sprint cost: ${formatUsd(data.cost.sprintCost)}
- Cost per resolved ticket: ${formatUsd(data.cost.costPerTicket)}
- Delivery efficiency: ${data.cost.deliveryEfficiency}%
- Carry-over cost: ${formatUsd(data.cost.carryOverCost)}
`;

    const executiveSummary = audience === 'executive'
        ? `Delivery efficiency is ${data.cost.deliveryEfficiency}% this sprint with estimated investment ${formatUsd(data.cost.sprintCost)}. ${data.sprint.done} of ${data.sprint.committed} committed items are complete.`
        : audience === 'client'
            ? `We completed ${data.sprint.done} sprint commitments and we are building the next set of improvements with ${data.sprint.inProgress} items currently in progress.`
            : `Sprint ${data.sprint.name} is tracking ${data.sprint.done}/${data.sprint.committed} completed with ${data.sprint.blocked} blockers and ${data.sprint.inProgress} in progress.`;

    return `## Sprint Status — ${data.sprint.name}
### 🎯 Executive Summary
${executiveSummary}

${costSection}### ✅ Resolved This Period
${resolvedLine}

### 🔄 In Progress
${inProgressLine}

### ⚠️ Risks & Blockers
${blockerLine}

### 📋 Next Steps
- Keep focus on highest-impact in-progress work.
- Resolve blocker dependencies early in the sprint.
- Confirm sprint-ready priorities for the upcoming planning cycle.`;
}

async function generateStatusReportContent(audience: ReportAudience, data: ReportData): Promise<string> {
    const aiConfig = resolveAIClientConfig();
    if (!aiConfig) {
        return generateFallbackReport(data, audience);
    }

    const systemPrompt = `You are a PM reporting assistant. Generate a high-quality sprint status report based only on provided data.
Follow all audience and formatting instructions exactly.
Do not invent metrics or tickets.
If data is missing, acknowledge it briefly and continue.`;

    const userPrompt = buildAudienceInstructions(audience, data);

    const openai = new OpenAI({
        apiKey: aiConfig.apiKey,
        baseURL: aiConfig.baseURL,
    });

    const completion = await openai.chat.completions.create({
        model: aiConfig.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1400,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
        return generateFallbackReport(data, audience);
    }
    return content;
}

function rowToStatusReport(row: StatusReportRow): StatusReportRecord {
    return {
        id: row.id,
        generatedAt: row.generated_at,
        audience: normalizeReportAudience(row.audience),
        sprintName: row.sprint_name,
        content: row.content,
        isAuto: Boolean(row.is_auto),
    };
}

export async function createStatusReport(options: CreateStatusReportOptions): Promise<StatusReportRecord> {
    ensureStatusReportsTable();

    const audience = normalizeReportAudience(options.audience);
    const isAuto = Boolean(options.isAuto);
    const data = collectReportData();
    const content = await generateStatusReportContent(audience, data);
    const generatedAt = new Date().toISOString();
    const id = `status-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const db = getDb();
    db.prepare(`
      INSERT INTO status_reports (id, generated_at, audience, sprint_name, content, is_auto)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, generatedAt, audience, data.sprint.name, content, isAuto ? 1 : 0);

    return {
        id,
        generatedAt,
        audience,
        sprintName: data.sprint.name,
        content,
        isAuto,
    };
}

export function listStatusReports(limit = 10): StatusReportRecord[] {
    ensureStatusReportsTable();

    const db = getDb();
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.round(limit))) : 10;
    const rows = db.prepare(`
      SELECT id, generated_at, audience, sprint_name, content, is_auto
      FROM status_reports
      ORDER BY generated_at DESC
      LIMIT ?
    `).all(safeLimit) as StatusReportRow[];

    return rows.map(rowToStatusReport);
}
