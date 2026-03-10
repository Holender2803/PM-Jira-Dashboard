import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { AIReportRequest, JiraIssue } from '@/types';
import { getDemoIssues } from '@/lib/demo-data';
import { queryIssues } from '@/lib/issue-store';
import { extractDescriptionText, formatEpicLabel } from '@/lib/issue-format';

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
};

const MAX_TOKENS: Record<string, number> = {
    morning_briefing: 150,
    slide_speaker_notes: 100,
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

export async function POST(request: Request) {
    try {
        const body: AIReportRequest = await request.json();
        const { type, tone, issueKeys, sprintName, customInstructions } = body;

        // Gather issue data
        let issues: JiraIssue[];
        if (DEMO_MODE) {
            const all = getDemoIssues();
            issues = issueKeys.length > 0
                ? all.filter(i => issueKeys.includes(i.key))
                : all.filter(i => i.sprint?.state === 'active');
        } else {
            issues = queryIssues({ selectedKeys: issueKeys.length > 0 ? issueKeys : undefined, sprint: 'current' });
        }

        // Build context for AI
        const issueContext = issues.map(iss => `
[${iss.key}] ${iss.summary}
Type: ${iss.issueType} | Status: ${iss.status} | Priority: ${iss.priority || 'None'}
Assignee: ${iss.assignee?.displayName || 'Unassigned'} | Points: ${iss.storyPoints || '?'}
Sprint: ${iss.sprint?.name || 'No Sprint'}
Epic: ${formatEpicLabel(iss)}
Age: ${iss.age} days | Cycle Time: ${iss.cycleTime !== null ? iss.cycleTime + ' days' : 'N/A'}
${iss.description ? `Description: ${extractDescriptionText(iss.description).slice(0, 300)}` : ''}
`).join('\n---\n');

        const isMorningBriefing = type === 'morning_briefing';
        const formatGuide = isMorningBriefing ? '' : CONFLUENCE_FORMAT_GUIDE;
        const maxTokens = MAX_TOKENS[type] || 1500;
        const effectiveTemperature = isMorningBriefing ? 0.3 : 0.7;
        const criticalMorningPrefix = isMorningBriefing
            ? 'CRITICAL: Output exactly 3 sentences. Stop after the third sentence. Do not output ticket keys, lists, headers, or any text after the third sentence ends with a period.'
            : '';

        const systemPrompt = `${criticalMorningPrefix ? `${criticalMorningPrefix}\n` : ''}You are a productivity assistant specialized in helping Product Managers communicate sprint progress, delivery status, and team updates.

Team: MDFM / Legacy MDFM Engineering Team
Sprint Cadence: 2-week sprints
${sprintName ? `Current Sprint: ${sprintName}` : ''}

TONE: ${TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.pm_internal}

TASK: ${REPORT_PROMPTS[type] || REPORT_PROMPTS.selected_tickets}
${formatGuide}

${customInstructions ? `ADDITIONAL INSTRUCTIONS: ${customInstructions}` : ''}`;

        const userPrompt = isMorningBriefing
            ? (customInstructions || 'Write the 3-sentence morning briefing now. No lists, no headers, plain sentences only.')
            : `Here are the Jira tickets to analyze:\n\n${issueContext}\n\nPlease generate the requested ${type.replace('_', ' ')}.`;

        // Check if AI provider is configured
        const aiConfig = resolveAIClientConfig();
        if (!aiConfig) {
            // Return mock AI response for demo
            return NextResponse.json({
                id: `report-${Date.now()}`,
                type,
                tone,
                generatedAt: new Date().toISOString(),
                issueKeys,
                summary: `${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} — ${issues.length} tickets analyzed`,
                content: generateMockReport(type, tone, issues, sprintName),
            });
        }

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

        const content = completion.choices[0]?.message?.content || 'No response generated.';

        const report = {
            id: `report-${Date.now()}`,
            type,
            tone,
            generatedAt: new Date().toISOString(),
            issueKeys,
            summary: `${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} — ${issues.length} tickets`,
            content,
        };

        // Save to DB if not demo
        if (!DEMO_MODE) {
            try {
                const db = (await import('@/lib/db')).default();
                db.prepare(`
          INSERT INTO ai_reports (id, type, tone, generated_at, summary, content, issue_keys, sprint_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
                    report.id, type, tone, report.generatedAt,
                    report.summary, content, JSON.stringify(issueKeys), sprintName || null
                );
            } catch { /* non-critical */ }
        }

        return NextResponse.json(report);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function GET() {
    try {
        if (DEMO_MODE) {
            return NextResponse.json([]);
        }

        const db = (await import('@/lib/db')).default();
        const rows = db.prepare(`
      SELECT id, type, tone, generated_at, summary, content, issue_keys
      FROM ai_reports
      ORDER BY generated_at DESC
      LIMIT 20
    `).all() as {
            id: string;
            type: string;
            tone: string;
            generated_at: string;
            summary: string;
            content: string;
            issue_keys: string;
        }[];

        return NextResponse.json(rows.map((row) => ({
            id: row.id,
            type: row.type,
            tone: row.tone,
            generatedAt: row.generated_at,
            summary: row.summary,
            content: row.content,
            issueKeys: row.issue_keys ? JSON.parse(row.issue_keys) : [],
        })));
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

function generateMockReport(type: string, tone: string, issues: JiraIssue[], sprintName?: string): string {
    const done = issues.filter(i => i.status === 'Done').length;
    const inProgress = issues.filter(i => i.status === 'In Progress').length;
    const blocked = issues.filter(i => i.status === 'Blocked').length;
    const bugs = issues.filter(i => i.issueType === 'Bug').length;
    const sprint = sprintName || issues.find(i => i.sprint)?.sprint?.name || 'Current Sprint';

    if (tone === 'slack') {
        return `🚀 **${sprint} Update**\n\n✅ ${done} tickets shipped\n🔄 ${inProgress} in progress\n🚧 ${blocked} blocked\n🐛 ${bugs} bugs tracked\n\nGreat momentum from the team this sprint! Ping me if you need details on any specific items. 💪`;
    }

    if (type === 'executive_summary') {
        return `## Executive Summary — ${sprint}\n\n- **${done}** tickets completed this sprint, demonstrating solid delivery momentum\n- **${inProgress}** items actively in development; key Policy Engine work nearing completion\n- **${blocked}** items require escalation to unblock the team\n- Bug count stands at **${bugs}** — down from previous sprint, reflecting improved quality focus\n\n*Next sprint focus: Release blocked SSO integration and complete QA backlog.*`;
    }

    if (type === 'release_notes') {
        const completedBugs = issues.filter(i => i.status === 'Done' && i.issueType === 'Bug');
        const completedFeatures = issues.filter(i => i.status === 'Done' && i.issueType !== 'Bug');
        return `## Release Notes — ${sprint}\n\n### ✨ Features & Improvements\n${completedFeatures.map(i => `- **[${i.key}]** ${i.summary}`).join('\n') || '- No feature completions this period'}\n\n### 🐛 Bug Fixes\n${completedBugs.map(i => `- **[${i.key}]** ${i.summary}`).join('\n') || '- No bug fixes this period'}`;
    }

    if (type === 'blockers_summary') {
        const blockedIssues = issues.filter(i => i.status === 'Blocked');
        return `## Blockers Summary — ${sprint}\n\n${blockedIssues.length === 0 ? '✅ No blocked tickets currently.' : blockedIssues.map(i => `### 🚧 [${i.key}] ${i.summary}\n- **Assignee:** ${i.assignee?.displayName || 'Unassigned'}\n- **Blocked for:** ${i.timeInCurrentStatus} days\n- **Recommended action:** Review with ${i.assignee?.displayName || 'assignee'} and escalate dependencies`).join('\n\n')}`;
    }

    if (type === 'slide_speaker_notes') {
        return `Highlight sprint progress in one line, name the top risk clearly, and end with one concrete next action for this audience.`;
    }

    // Default: sprint summary
    return `## Sprint Summary — ${sprint}\n\n### 📊 At a Glance\n- **Completed:** ${done} tickets\n- **In Progress:** ${inProgress} tickets  \n- **Blocked:** ${blocked} tickets\n- **Bugs resolved:** ${bugs > 0 ? bugs : 'N/A'}\n\n### ✅ Key Completions\n${issues.filter(i => i.status === 'Done').slice(0, 5).map(i => `- **[${i.key}]** ${i.summary}`).join('\n')}\n\n### 🔄 In Flight\n${issues.filter(i => i.status === 'In Progress').map(i => `- **[${i.key}]** ${i.summary} (${i.assignee?.displayName || 'Unassigned'})`).join('\n') || '- None'}\n\n### ⚠️ Needs Attention\n${blocked > 0 ? issues.filter(i => i.status === 'Blocked').map(i => `- **[${i.key}]** ${i.summary} — blocked for ${i.timeInCurrentStatus}d`).join('\n') : '- No blockers currently'}\n\n### 📌 Next Steps\n- Resolve blockers for SSO integration\n- Complete QA on remaining Policy Engine tickets\n- Prepare release candidates for upcoming sprint review`;
}
