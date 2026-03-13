import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import getDb from '@/lib/db';
import { AIReportRequest, JiraIssue } from '@/types';
import { getDemoIssues } from '@/lib/demo-data';
import { queryIssues } from '@/lib/issue-store';
import { extractDescriptionText, formatEpicLabel } from '@/lib/issue-format';
import { APP_CONFIG_KEYS, getAppConfigBoolean, setAppConfigBoolean } from '@/lib/app-config';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const REPORT_PROMPTS: Record<string, string> = {
    sprint_summary: 'Generate a comprehensive sprint summary for the Product Manager. Include: completed items, key achievements, blockers, what was added mid-sprint, and what carries over.',
    stakeholder_update: 'Write a stakeholder update (non-technical, business-focused). Highlight customer-facing improvements, key milestones, and any risks.',
    executive_summary: 'Write a brief executive summary (3-4 bullet points max). Focus on business impact and delivery against goals.',
    pm_weekly: 'Write a PM weekly update including: what shipped, what\'s in flight, blockers needing attention, and next week\'s priorities.',
    release_notes: 'Write release notes for the completed and release-ready tickets. Group by feature area. Write for a technical but non-developer audience.',
    blockers_summary: 'Summarize all blockers and at-risk items. For each, describe what\'s blocked and suggest possible actions.',
    selected_tickets: 'Generate a concise summary of the selected tickets. Include: status, key achievements, current risks, what\'s still in progress, and suggested PM talking points.',
    slide_speaker_notes: 'Write concise presenter notes for a PM slideshow slide. Keep it practical, audience-aware, and action-oriented.',
    morning_briefing: `You are a PM assistant. Write ONLY 3 sentences.
No headers. No bullet points. No numbered lists. No sections.
No markdown. Plain conversational sentences only.

Sentence 1: Sprint health — completion % and days remaining.
Sentence 2: Biggest risk right now (blockers or carry-over count).
Sentence 3: The single most important action for today.

Example output:
"Sprint MDFM 26.05 is 59% complete with 3 days remaining.
12 tickets are at carry-over risk and 5 are blocked —
the longest blocked for 220 days.
Top priority today: escalate the MDFM UI uplift blocker
with Samuel before end of day."

If days remaining is 0 or unavailable, say "sprint end date
not configured" instead of "0 days remaining".
NEVER use numbered lists, headers, or section titles.
Output the 3 sentences and nothing else.`,
    sync_briefing: `You are a PM assistant.
A Jira sync just completed. Write two short sections.

SECTION 1 — FOR YOUR STANDUP WITH DEVS (3-4 bullets):
What just changed that the dev team needs to know.
Be specific and technical. Use ticket keys.
Format each bullet as: "• KEY — what changed and why it matters"

SECTION 2 — FOR STAKEHOLDER UPDATE (2-3 bullets):
Same changes, translated to business language.
No ticket keys. Focus on impact, not implementation.
Format: "• What this means for the product/users"

Keep total response under 200 words.
No headers, no numbered lists, no markdown formatting.`,
    ticket_documentation: `Generate internal documentation for this ticket. Output ONLY valid JSON, no other text:
{
  "summary": "One sentence. What this ticket accomplished.",
  "shortDescription": "2-3 sentences. What changed and why it matters to users or the business. No technical jargon.",
  "howToUse": "Step by step if applicable. If it's a bug fix, describe what behavior changed. If feature, how to access it.",
  "impact": "Who benefits and how.",
  "audience_notes": {
    "implementation": "...",
    "support": "...",
    "sales": "...",
    "marketing": "...",
    "engineering": "...",
    "executive": "...",
    "product": "..."
  }
}
Only include keys for requested audiences in audience_notes.
If information is not available, use null for that field.`,
};

const MAX_TOKENS: Record<string, number> = {
    morning_briefing: 150,
    slide_speaker_notes: 100,
    sync_briefing: 250,
    ticket_documentation: 600,
};

const TONE_INSTRUCTIONS: Record<string, string> = {
    executive: 'Write in a concise executive style. Use bullet points. Avoid technical jargon. Focus on business outcomes.',
    pm_internal: 'Write in a PM internal style — detailed, specific, professional. Include context the PM can use in planning.',
    engineering: 'Write in a technical tone appropriate for an engineering audience. Be specific about implementation details.',
    slack: 'Write as a short, casual Slack update. Use emoji. Keep it under 200 words. Be energetic and positive.',
    polished: 'Write as a polished status report. Use professional language, clear headings, and structured sections.',
};

const CONFLUENCE_FORMAT_GUIDE = `
OUTPUT FORMAT (Confluence-friendly):
- Keep content highly scannable with short sections and bullet points.
- Use this structure unless the report type clearly requires variation:
  1) Title line
  2) Sprint/Date/Scope snapshot
  3) What Shipped
  4) What Is In Flight
  5) Risks / Blockers
  6) Next Priorities
  7) Action Items
- For ticket references, always use: KEY — Summary (Status, Owner).
- Use plain section headers and bullets, not long paragraphs.
- Avoid markdown tables.
- Avoid long narrative paragraphs; prefer concise bullets.
- End with a short PM talking points section.
`;

type AIProvider = 'openai' | 'groq';

interface AIClientConfig {
    provider: AIProvider;
    apiKey: string;
    baseURL?: string;
    model: string;
}

interface SyncStatusChange {
    key: string;
    from: string;
    to: string;
}

interface SyncDiffPayload {
    syncedAt: string;
    sprintName: string | null;
    newlyBlocked: string[];
    newlyResolved: string[];
    statusChanges: SyncStatusChange[];
    newTickets: string[];
    removedFromSprint: string[];
}

interface StoredReportRow {
    id: string;
    type: string;
    tone: string;
    generated_at: string;
    summary: string;
    content: string;
    issue_keys: string;
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

function parseStringArray(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((value): value is string => typeof value === 'string');
    } catch {
        return [];
    }
}

function parseStatusChanges(raw: string | null | undefined): SyncStatusChange[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((value): value is { key?: unknown; from?: unknown; to?: unknown } => typeof value === 'object' && value !== null)
            .map((value) => ({
                key: typeof value.key === 'string' ? value.key : 'UNKNOWN',
                from: typeof value.from === 'string' ? value.from : 'Unknown',
                to: typeof value.to === 'string' ? value.to : 'Unknown',
            }));
    } catch {
        return [];
    }
}

function getLatestSyncDiff(): SyncDiffPayload | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        synced_at,
        sprint_name,
        newly_blocked,
        newly_resolved,
        status_changes,
        new_tickets,
        removed_from_sprint
      FROM sync_diffs
      ORDER BY synced_at DESC
      LIMIT 1
    `).get() as {
        synced_at: string;
        sprint_name: string | null;
        newly_blocked: string;
        newly_resolved: string;
        status_changes: string;
        new_tickets: string;
        removed_from_sprint: string | null;
    } | undefined;

    if (!row) return null;

    return {
        syncedAt: row.synced_at,
        sprintName: row.sprint_name,
        newlyBlocked: parseStringArray(row.newly_blocked),
        newlyResolved: parseStringArray(row.newly_resolved),
        statusChanges: parseStatusChanges(row.status_changes),
        newTickets: parseStringArray(row.new_tickets),
        removedFromSprint: parseStringArray(row.removed_from_sprint || '[]'),
    };
}

function buildSyncDiffSummary(diff: SyncDiffPayload): string {
    const formatList = (values: string[]) => (values.length > 0 ? values.join(', ') : 'None');
    const changeLines = diff.statusChanges.length > 0
        ? diff.statusChanges.map((change) => `${change.key}: ${change.from} -> ${change.to}`).join('\n')
        : 'None';

    return [
        'Sync diff summary (computed fields only):',
        `Synced at: ${diff.syncedAt}`,
        `Sprint: ${diff.sprintName || 'No active sprint detected'}`,
        `Newly blocked (${diff.newlyBlocked.length}): ${formatList(diff.newlyBlocked)}`,
        `Newly resolved (${diff.newlyResolved.length}): ${formatList(diff.newlyResolved)}`,
        `Status changes (${diff.statusChanges.length}):`,
        changeLines,
        `New tickets (${diff.newTickets.length}): ${formatList(diff.newTickets)}`,
        `Removed from active sprint (${diff.removedFromSprint.length}): ${formatList(diff.removedFromSprint)}`,
    ].join('\n');
}

function buildIssueDigest(issues: JiraIssue[]): string {
    if (issues.length === 0) {
        return 'Ticket digest: no Jira tickets were provided.';
    }

    const statusCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();
    let blocked = 0;
    let done = 0;

    for (const issue of issues) {
        statusCounts.set(issue.status, (statusCounts.get(issue.status) || 0) + 1);
        typeCounts.set(issue.issueType, (typeCounts.get(issue.issueType) || 0) + 1);
        if (issue.status === 'Blocked') blocked += 1;
        if (issue.status === 'Done') done += 1;
    }

    const topStatuses = [...statusCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([status, count]) => `${status}: ${count}`)
        .join(', ');
    const topTypes = [...typeCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
    const topBlockers = issues
        .filter((issue) => issue.status === 'Blocked')
        .slice(0, 5)
        .map((issue) => `${issue.key} (${issue.summary})`)
        .join(', ') || 'None';

    return [
        `Ticket digest: ${issues.length} ticket(s), ${done} done, ${blocked} blocked.`,
        `Status mix: ${topStatuses || 'N/A'}`,
        `Type mix: ${topTypes || 'N/A'}`,
        `Top blockers: ${topBlockers}`,
    ].join('\n');
}

function reportTypeLabel(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function toReportResponse(row: StoredReportRow) {
    return {
        id: row.id,
        type: row.type,
        tone: row.tone,
        generatedAt: row.generated_at,
        summary: row.summary,
        content: row.content,
        issueKeys: row.issue_keys ? parseStringArray(row.issue_keys) : [],
    };
}

function buildSyncBriefingSummary(diff: SyncDiffPayload | null): string {
    if (!diff) return 'Sync Briefing — automatic post-sync update';
    const totalChanges =
        diff.newlyBlocked.length +
        diff.newlyResolved.length +
        diff.statusChanges.length +
        diff.newTickets.length +
        diff.removedFromSprint.length;

    return `Sync Briefing — ${totalChanges} tracked change${totalChanges === 1 ? '' : 's'}`;
}

function saveReportToDb(params: {
    id: string;
    type: string;
    tone: string;
    generatedAt: string;
    summary: string;
    content: string;
    issueKeys: string[];
    sprintName?: string;
}) {
    if (DEMO_MODE) return;

    const db = getDb();
    db.prepare(`
      INSERT INTO ai_reports (id, type, tone, generated_at, summary, content, issue_keys, sprint_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        params.id,
        params.type,
        params.tone,
        params.generatedAt,
        params.summary,
        params.content,
        JSON.stringify(params.issueKeys),
        params.sprintName || null
    );
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({})) as Partial<AIReportRequest>;
        const type = typeof body.type === 'string' ? body.type : 'selected_tickets';
        const tone = typeof body.tone === 'string' ? body.tone : 'pm_internal';
        const sprintName = typeof body.sprintName === 'string' ? body.sprintName : undefined;
        const customInstructions = typeof body.customInstructions === 'string'
            ? body.customInstructions.trim()
            : '';
        const issueKeys = Array.isArray(body.issueKeys)
            ? body.issueKeys.filter((key): key is string => typeof key === 'string')
            : [];

        const isMorningBriefing = type === 'morning_briefing';
        const isSyncBriefing = type === 'sync_briefing';

        let syncDiff: SyncDiffPayload | null = null;
        let syncDiffSummary = '';
        if (isSyncBriefing) {
            if (customInstructions) {
                syncDiffSummary = customInstructions;
            } else if (!DEMO_MODE) {
                syncDiff = getLatestSyncDiff();
                if (!syncDiff) {
                    return NextResponse.json(
                        { error: 'No sync data available yet. Sync your Jira data first.' },
                        { status: 400 }
                    );
                }
                syncDiffSummary = buildSyncDiffSummary(syncDiff);
            }

            if (!syncDiffSummary) {
                syncDiffSummary = [
                    'Sync diff summary (computed fields only):',
                    `Synced at: ${new Date().toISOString()}`,
                    'Sprint: Demo mode',
                    'Newly blocked (0): None',
                    'Newly resolved (0): None',
                    'Status changes (0):',
                    'None',
                    'New tickets (0): None',
                    'Removed from active sprint (0): None',
                ].join('\n');
            }
        }

        // Gather issue data for issue-based reports only.
        let issues: JiraIssue[] = [];
        if (!isSyncBriefing) {
            if (DEMO_MODE) {
                const all = getDemoIssues();
                issues = issueKeys.length > 0
                    ? all.filter((issue) => issueKeys.includes(issue.key))
                    : all.filter((issue) => issue.sprint?.state === 'active');
            } else {
                issues = queryIssues({
                    selectedKeys: issueKeys.length > 0 ? issueKeys : undefined,
                    sprint: 'current',
                });
            }
        }

        // Build context for AI.
        const issueContext = isSyncBriefing
            ? ''
            : issues.map((issue) => `
[${issue.key}] ${issue.summary}
Type: ${issue.issueType} | Status: ${issue.status} | Priority: ${issue.priority || 'None'}
Assignee: ${issue.assignee?.displayName || 'Unassigned'} | Points: ${issue.storyPoints || '?'}
Sprint: ${issue.sprint?.name || 'No Sprint'}
Epic: ${formatEpicLabel(issue)}
Age: ${issue.age} days | Cycle Time: ${issue.cycleTime !== null ? `${issue.cycleTime} days` : 'N/A'}
${issue.description ? `Description: ${extractDescriptionText(issue.description).slice(0, 300)}` : ''}
`).join('\n---\n');

        const formatGuide = (isMorningBriefing || isSyncBriefing) ? '' : CONFLUENCE_FORMAT_GUIDE;
        const maxTokens = MAX_TOKENS[type] || 1500;
        const effectiveTemperature = (isMorningBriefing || isSyncBriefing) ? 0.25 : 0.45;
        const criticalMorningPrefix = isMorningBriefing
            ? 'CRITICAL: Output exactly 3 sentences. Stop after the third sentence. Do not output ticket keys, lists, headers, or any text after the third sentence ends with a period.'
            : '';
        const additionalInstructions = (!isSyncBriefing && customInstructions)
            ? `ADDITIONAL INSTRUCTIONS: ${customInstructions}`
            : '';
        const issueDigest = isSyncBriefing ? '' : buildIssueDigest(issues);

        const systemPrompt = `${criticalMorningPrefix ? `${criticalMorningPrefix}\n` : ''}You are a productivity assistant specialized in helping Product Managers communicate sprint progress, delivery status, and team updates.

Team: MDFM / Legacy MDFM Engineering Team
Sprint Cadence: 2-week sprints
${sprintName ? `Current Sprint: ${sprintName}` : ''}

TONE: ${TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.pm_internal}

TASK: ${REPORT_PROMPTS[type] || REPORT_PROMPTS.selected_tickets}
${formatGuide}

GROUNDING RULES:
- Use only the Jira data provided in this prompt.
- Do not invent metrics, dates, owners, blockers, causes, or outcomes.
- Only mention ticket keys that appear in the provided Jira context.
- If evidence is thin or missing, say so briefly instead of filling gaps.
- Keep claims proportional to the data; avoid overconfident language.

${additionalInstructions}`;

        const userPrompt = isMorningBriefing
            ? (customInstructions || 'Write the 3-sentence morning briefing now. No lists, no headers, plain sentences only.')
            : isSyncBriefing
                ? `Here is the computed sync diff summary:\n\n${syncDiffSummary}\n\nGenerate the sync briefing now.`
                : `Here is a summary of the Jira ticket set:\n\n${issueDigest}\n\nHere are the Jira tickets to analyze:\n\n${issueContext}\n\nPlease generate the requested ${type.replace('_', ' ')}.`;

        let content: string;

        const aiConfig = resolveAIClientConfig();
        if (!aiConfig) {
            content = generateMockReport(type, tone, issues, sprintName, syncDiff);
        } else {
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
                temperature: effectiveTemperature,
                max_tokens: maxTokens,
            });

            content = completion.choices[0]?.message?.content || 'No response generated.';
        }

        const report = {
            id: `report-${Date.now()}`,
            type,
            tone,
            generatedAt: new Date().toISOString(),
            issueKeys,
            summary: isSyncBriefing
                ? buildSyncBriefingSummary(syncDiff)
                : `${reportTypeLabel(type)} — ${issues.length} tickets`,
            content,
        };

        try {
            saveReportToDb({
                id: report.id,
                type: report.type,
                tone: report.tone,
                generatedAt: report.generatedAt,
                summary: report.summary,
                content: report.content,
                issueKeys: report.issueKeys,
                sprintName,
            });
        } catch {
            // Non-critical persistence failure.
        }

        return NextResponse.json(report);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const syncBriefingMode = searchParams.get('syncBriefing');

        if (syncBriefingMode === 'latest') {
            if (DEMO_MODE) {
                return NextResponse.json({
                    report: null,
                    syncedAt: null,
                    hasUnread: false,
                });
            }

            const markRead = searchParams.get('markRead') === 'true';
            if (markRead) {
                setAppConfigBoolean(APP_CONFIG_KEYS.syncBriefingUnread, false);
            }

            const db = getDb();
            const reportRow = db.prepare(`
              SELECT id, type, tone, generated_at, summary, content, issue_keys
              FROM ai_reports
              WHERE type = 'sync_briefing'
              ORDER BY generated_at DESC
              LIMIT 1
            `).get() as StoredReportRow | undefined;

            const syncRow = db.prepare(`
              SELECT synced_at
              FROM sync_diffs
              ORDER BY synced_at DESC
              LIMIT 1
            `).get() as { synced_at: string | null } | undefined;

            return NextResponse.json({
                report: reportRow ? toReportResponse(reportRow) : null,
                syncedAt: syncRow?.synced_at || null,
                hasUnread: markRead ? false : getAppConfigBoolean(APP_CONFIG_KEYS.syncBriefingUnread),
            });
        }

        if (DEMO_MODE) {
            return NextResponse.json([]);
        }

        const db = getDb();
        const rows = db.prepare(`
          SELECT id, type, tone, generated_at, summary, content, issue_keys
          FROM ai_reports
          ORDER BY generated_at DESC
          LIMIT 20
        `).all() as StoredReportRow[];

        return NextResponse.json(rows.map(toReportResponse));
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

function generateMockSyncBriefing(syncDiff: SyncDiffPayload | null): string {
    if (!syncDiff) {
        return [
            '• No Jira status transitions were detected in this sync, so no immediate engineering actions are required.',
            '• The active sprint scope is stable and there are no new blockers to triage.',
            '• Continue executing the current plan and monitor the next sync for movement.',
            '',
            '• Delivery is steady with no newly surfaced execution risks.',
            '• Current sprint commitments remain on track for users and internal milestones.',
        ].join('\n');
    }

    const devBullets: string[] = [];
    if (syncDiff.newlyBlocked.length > 0) {
        devBullets.push(`• ${syncDiff.newlyBlocked.slice(0, 3).join(', ')} — moved to blocked; review dependencies and assign an owner for unblock actions.`);
    }
    if (syncDiff.newlyResolved.length > 0) {
        devBullets.push(`• ${syncDiff.newlyResolved.slice(0, 3).join(', ')} — moved to done/closed; update downstream tasks and release readiness checks.`);
    }
    if (syncDiff.statusChanges.length > 0) {
        const sample = syncDiff.statusChanges
            .slice(0, 3)
            .map((change) => `${change.key} ${change.from}→${change.to}`)
            .join('; ');
        devBullets.push(`• ${sample} — status flow changed and may impact handoffs across dev/QA/release.`);
    }
    if (syncDiff.newTickets.length > 0) {
        devBullets.push(`• ${syncDiff.newTickets.slice(0, 3).join(', ')} — added since last sync; confirm sizing and sprint fit before pull-in.`);
    }
    if (syncDiff.removedFromSprint.length > 0) {
        devBullets.push(`• ${syncDiff.removedFromSprint.slice(0, 3).join(', ')} — left active sprint; re-check scope assumptions and dependency plans.`);
    }
    if (devBullets.length === 0) {
        devBullets.push('• No ticket-level status changes were detected in this sync; engineering execution remains stable.');
    }

    const stakeholderBullets: string[] = [];
    if (syncDiff.newlyBlocked.length > 0) {
        stakeholderBullets.push('• Some delivery items hit new constraints, which may require prioritization support to protect sprint outcomes.');
    }
    if (syncDiff.newlyResolved.length > 0) {
        stakeholderBullets.push('• Multiple in-flight items reached completion, improving confidence in near-term delivery goals.');
    }
    if (syncDiff.newTickets.length > 0 || syncDiff.removedFromSprint.length > 0) {
        stakeholderBullets.push('• Sprint scope shifted during execution, so timelines and expectations should be reviewed against the updated plan.');
    }
    if (stakeholderBullets.length === 0) {
        stakeholderBullets.push('• No major scope or risk shifts were detected, so product delivery remains on the current trajectory.');
        stakeholderBullets.push('• Current work continues to support planned user and business outcomes without new escalations.');
    }

    return [
        ...devBullets.slice(0, 4),
        '',
        ...stakeholderBullets.slice(0, 3),
    ].join('\n');
}

function generateMockReport(
    type: string,
    tone: string,
    issues: JiraIssue[],
    sprintName?: string,
    syncDiff: SyncDiffPayload | null = null
): string {
    if (type === 'sync_briefing') {
        return generateMockSyncBriefing(syncDiff);
    }

    const done = issues.filter((issue) => issue.status === 'Done').length;
    const inProgress = issues.filter((issue) => issue.status === 'In Progress').length;
    const blocked = issues.filter((issue) => issue.status === 'Blocked').length;
    const bugs = issues.filter((issue) => issue.issueType === 'Bug').length;
    const sprint = sprintName || issues.find((issue) => issue.sprint)?.sprint?.name || 'Current Sprint';

    if (tone === 'slack') {
        return `🚀 **${sprint} Update**\n\n✅ ${done} tickets shipped\n🔄 ${inProgress} in progress\n🚧 ${blocked} blocked\n🐛 ${bugs} bugs tracked\n\nGreat momentum from the team this sprint! Ping me if you need details on any specific items. 💪`;
    }

    if (type === 'executive_summary') {
        return `## Executive Summary — ${sprint}\n\n- **${done}** tickets completed this sprint, demonstrating solid delivery momentum\n- **${inProgress}** items actively in development; key Policy Engine work nearing completion\n- **${blocked}** items require escalation to unblock the team\n- Bug count stands at **${bugs}** — down from previous sprint, reflecting improved quality focus\n\n*Next sprint focus: Release blocked SSO integration and complete QA backlog.*`;
    }

    if (type === 'release_notes') {
        const completedBugs = issues.filter((issue) => issue.status === 'Done' && issue.issueType === 'Bug');
        const completedFeatures = issues.filter((issue) => issue.status === 'Done' && issue.issueType !== 'Bug');
        return `## Release Notes — ${sprint}\n\n### ✨ Features & Improvements\n${completedFeatures.map((issue) => `- **[${issue.key}]** ${issue.summary}`).join('\n') || '- No feature completions this period'}\n\n### 🐛 Bug Fixes\n${completedBugs.map((issue) => `- **[${issue.key}]** ${issue.summary}`).join('\n') || '- No bug fixes this period'}`;
    }

    if (type === 'blockers_summary') {
        const blockedIssues = issues.filter((issue) => issue.status === 'Blocked');
        return `## Blockers Summary — ${sprint}\n\n${blockedIssues.length === 0 ? '✅ No blocked tickets currently.' : blockedIssues.map((issue) => `### 🚧 [${issue.key}] ${issue.summary}\n- **Assignee:** ${issue.assignee?.displayName || 'Unassigned'}\n- **Blocked for:** ${issue.timeInCurrentStatus} days\n- **Recommended action:** Review with ${issue.assignee?.displayName || 'assignee'} and escalate dependencies`).join('\n\n')}`;
    }

    if (type === 'slide_speaker_notes') {
        return 'Highlight sprint progress in one line, name the top risk clearly, and end with one concrete next action for this audience.';
    }

    // Default: sprint summary
    return `## Sprint Summary — ${sprint}\n\n### 📊 At a Glance\n- **Completed:** ${done} tickets\n- **In Progress:** ${inProgress} tickets  \n- **Blocked:** ${blocked} tickets\n- **Bugs resolved:** ${bugs > 0 ? bugs : 'N/A'}\n\n### ✅ Key Completions\n${issues.filter((issue) => issue.status === 'Done').slice(0, 5).map((issue) => `- **[${issue.key}]** ${issue.summary}`).join('\n')}\n\n### 🔄 In Flight\n${issues.filter((issue) => issue.status === 'In Progress').map((issue) => `- **[${issue.key}]** ${issue.summary} (${issue.assignee?.displayName || 'Unassigned'})`).join('\n') || '- None'}\n\n### ⚠️ Needs Attention\n${blocked > 0 ? issues.filter((issue) => issue.status === 'Blocked').map((issue) => `- **[${issue.key}]** ${issue.summary} — blocked for ${issue.timeInCurrentStatus}d`).join('\n') : '- No blockers currently'}\n\n### 📌 Next Steps\n- Resolve blockers for SSO integration\n- Complete QA on remaining Policy Engine tickets\n- Prepare release candidates for upcoming sprint review`;
}
