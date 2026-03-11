import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import getDb from '@/lib/db';
import { getIssueByKey } from '@/lib/issue-store';
import { extractDescriptionText, formatEpicLabel } from '@/lib/issue-format';
import { JiraIssue } from '@/types';
import { getDemoIssues } from '@/lib/demo-data';
import { scoreTicket } from '@/lib/docReadiness';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const REPORT_PROMPTS: Record<string, string> = {
    ticket_documentation: `Generate documentation for this Jira ticket.
Return ONLY valid JSON.

Rules:
- summary: One sentence max. What was accomplished. Start with a past-tense verb: "Fixed", "Added", "Updated", "Improved".
- shortDescription: 2-3 sentences explaining WHAT changed and WHY it was needed. Focus on the problem that was solved. Do NOT repeat the summary.
- howToUse: ONLY include if the ticket introduces user-facing behavior change or a new workflow step.
  If it's a bug fix with no behavior change, set this to null.
  If it's a backend/internal change, set to null.
  If included: write as numbered steps starting with "To use this feature:"
- impact: ONLY include if the impact is meaningfully different from shortDescription. If the impact is obvious from context, set to null.
  If included: focus on WHO benefits, not WHAT changed.
- audience_notes: tailor per audience requested.
  Each note must be 1-2 sentences ONLY.
  Must NOT repeat summary or shortDescription.
  Must add audience-specific context:
  - implementation: deployment notes, config changes
  - support: what users might ask about
  - sales: customer-facing value proposition
  - marketing: how to describe this publicly
  - engineering: technical approach or debt notes
  - executive: business outcome in one sentence
  - product: how this fits the roadmap

After generating the JSON, add a field "clarificationNeeded" - an array of plain English questions (max 3) where you made assumptions or where more context would significantly improve the documentation.
Examples:
- "Is this fix visible to end users or internal only?"
- "Which client environments does this affect?"
- "Is this feature enabled by default or requires setup?"
If you are confident in the output, return null.

Output schema:
{
  "summary": "string or null",
  "shortDescription": "string or null",
  "howToUse": "string or null",
  "impact": "string or null",
  "audience_notes": {
    "implementation": "string or null",
    "support": "string or null",
    "sales": "string or null",
    "marketing": "string or null",
    "engineering": "string or null",
    "executive": "string or null",
    "product": "string or null"
  },
  "clarificationNeeded": ["question 1", "question 2"] or null
}
Only include keys for requested audiences in audience_notes.
If information is not available, use null for that field.`,
};

const MAX_TOKENS = {
    ticket_documentation: 600,
};

type AIProvider = 'openai' | 'groq';

type AudienceId =
    | 'implementation_team'
    | 'support_team'
    | 'sales_team'
    | 'marketing'
    | 'engineering'
    | 'executive'
    | 'product';

interface AIClientConfig {
    provider: AIProvider;
    apiKey: string;
    baseURL?: string;
    model: string;
}

interface DocsGenerateRequest {
    ticketKeys: string[];
    audiences: AudienceId[];
    qaAnswers?: Record<string, Record<string, string>>;
}

interface CompletenessAssessment {
    score: number;
    missingDescription: boolean;
    missingEpic: boolean;
    missingStoryPoints: boolean;
    missingImpactContext: boolean;
    isReady: boolean;
}

interface LeadingQuestion {
    id: string;
    question: string;
}

interface TicketSummary {
    key: string;
    summary: string;
    status: string;
    type: string;
    assignee: string | null;
    age: number;
    epic: string | null;
    storyPoints: number | null;
    commentsCount: number;
}

interface TicketDocumentation {
    summary: string | null;
    shortDescription: string | null;
    howToUse: string | null;
    impact: string | null;
    audienceNotes: Record<string, string | null>;
}

interface GeneratedDocEntry {
    id: string;
    ticketKey: string;
    generatedAt: string;
    audiences: AudienceId[];
    completenessScore: number;
    ticket: TicketSummary;
    doc: TicketDocumentation;
    clarificationNeeded: string[] | null;
}

interface IncompleteDocEntry {
    ticketKey: string;
    completenessScore: number;
    ticket: TicketSummary;
    questions: LeadingQuestion[];
}

interface TicketDocRow {
    id: string;
    ticket_key: string;
    generated_at: string;
    audiences: string;
    summary: string | null;
    short_description: string | null;
    how_to_use: string | null;
    impact: string | null;
    audience_notes: string;
}

const AUDIENCE_PROMPT_KEYS: Record<AudienceId, string> = {
    implementation_team: 'implementation',
    support_team: 'support',
    sales_team: 'sales',
    marketing: 'marketing',
    engineering: 'engineering',
    executive: 'executive',
    product: 'product',
};

const VALID_AUDIENCES: Set<AudienceId> = new Set(Object.keys(AUDIENCE_PROMPT_KEYS) as AudienceId[]);

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

function normalizeTicketKeys(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const keys = value
        .filter((item): item is string => typeof item === 'string')
        .map((key) => key.trim().toUpperCase())
        .filter(Boolean);
    return [...new Set(keys)];
}

function normalizeAudiences(value: unknown): AudienceId[] {
    if (!Array.isArray(value)) return [];
    const audiences = value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim() as AudienceId)
        .filter((audience): audience is AudienceId => VALID_AUDIENCES.has(audience));
    return [...new Set(audiences)];
}

function normalizeQaAnswers(value: unknown): Record<string, Record<string, string>> {
    if (!value || typeof value !== 'object') return {};

    const normalized: Record<string, Record<string, string>> = {};
    for (const [ticketKey, rawAnswers] of Object.entries(value as Record<string, unknown>)) {
        if (!rawAnswers || typeof rawAnswers !== 'object') continue;
        const answers: Record<string, string> = {};
        for (const [questionId, rawAnswer] of Object.entries(rawAnswers as Record<string, unknown>)) {
            if (typeof rawAnswer !== 'string') continue;
            const trimmed = rawAnswer.trim();
            if (!trimmed) continue;
            answers[questionId] = trimmed;
        }
        if (Object.keys(answers).length > 0) {
            normalized[ticketKey.toUpperCase()] = answers;
        }
    }

    return normalized;
}

function parseAudienceArray(raw: string): AudienceId[] {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return normalizeAudiences(parsed);
    } catch {
        return [];
    }
}

function parseAudienceNotes(raw: string, audiences: AudienceId[]): Record<string, string | null> {
    const empty: Record<string, string | null> = {};
    for (const audience of audiences) {
        empty[audience] = null;
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return empty;

        const asRecord = parsed as Record<string, unknown>;
        for (const audience of audiences) {
            const value = asRecord[audience];
            if (typeof value === 'string') {
                empty[audience] = value.trim() || null;
            } else if (value === null) {
                empty[audience] = null;
            }
        }

        return empty;
    } catch {
        return empty;
    }
}

function normalizeNullableString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function getTicketSummary(issue: JiraIssue): TicketSummary {
    return {
        key: issue.key,
        summary: issue.summary,
        status: issue.status,
        type: issue.issueType,
        assignee: issue.assignee?.displayName || null,
        age: issue.age,
        epic: formatEpicLabel(issue, 'No Epic'),
        storyPoints: issue.storyPoints,
        commentsCount: issue.commentsCount,
    };
}

function hasImpactContext(description: string): boolean {
    const lower = description.toLowerCase();
    return (
        lower.includes('user') ||
        lower.includes('customer') ||
        lower.includes('impact') ||
        lower.includes('business') ||
        lower.includes('benefit') ||
        lower.includes('experience') ||
        lower.includes('admin') ||
        lower.includes('stakeholder')
    );
}

function assessCompleteness(issue: JiraIssue): CompletenessAssessment {
    const description = extractDescriptionText(issue.description || '').trim();
    const hasDescription = description.length > 0;
    const hasEpic = Boolean(issue.epicKey || (issue.epicSummary && issue.epicSummary !== issue.key));
    const hasStoryPoints = typeof issue.storyPoints === 'number' && Number.isFinite(issue.storyPoints);
    const readiness = scoreTicket(issue);
    const missingImpactContext = !hasImpactContext(description);

    return {
        score: readiness.score,
        missingDescription: !hasDescription,
        missingEpic: !hasEpic,
        missingStoryPoints: !hasStoryPoints,
        missingImpactContext,
        isReady: readiness.aiRatable,
    };
}

function buildLeadingQuestions(assessment: CompletenessAssessment): LeadingQuestion[] {
    const questions: LeadingQuestion[] = [];

    if (assessment.missingDescription) {
        questions.push({
            id: 'description',
            question: `What did this ticket change or fix? (e.g. "Fixed a bug where X happened when Y")`,
        });
    }

    if (assessment.missingEpic) {
        questions.push({
            id: 'epic',
            question: `Which feature area or epic does this belong to? (e.g. "Budget Templates", "Data Import", "User Management")`,
        });
    }

    if (assessment.missingStoryPoints) {
        questions.push({
            id: 'story_points',
            question: 'How complex was this work? (Small = 1-2 days / Medium = 3-5 days / Large = 1+ week)',
        });
    }

    if (assessment.missingImpactContext) {
        questions.push({
            id: 'impact_context',
            question: 'Who uses this feature and how does this change affect them? (e.g. "Finance admins who export reports")',
        });
    }

    return questions;
}

function hasMeaningfulAnswers(answers?: Record<string, string>): boolean {
    if (!answers) return false;
    return Object.values(answers).some((answer) => answer.trim().length > 0);
}

function buildQuestionAnswerContext(answers?: Record<string, string>): string {
    if (!answers || Object.keys(answers).length === 0) return 'No extra PM answers provided.';

    return Object.entries(answers)
        .map(([questionId, answer]) => `${questionId}: ${answer}`)
        .join('\n');
}

function parseDocumentationJson(raw: string): {
    summary?: unknown;
    shortDescription?: unknown;
    howToUse?: unknown;
    impact?: unknown;
    audience_notes?: unknown;
    clarificationNeeded?: unknown;
} | null {
    const direct = raw.trim();

    const tryParse = (value: string) => {
        try {
            const parsed = JSON.parse(value) as unknown;
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed as {
                summary?: unknown;
                shortDescription?: unknown;
                howToUse?: unknown;
                impact?: unknown;
                audience_notes?: unknown;
                clarificationNeeded?: unknown;
            };
        } catch {
            return null;
        }
    };

    const directParsed = tryParse(direct);
    if (directParsed) return directParsed;

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
        return tryParse(raw.slice(start, end + 1));
    }

    return null;
}

function normalizeAudienceNotes(raw: unknown, audiences: AudienceId[]): Record<string, string | null> {
    const normalized: Record<string, string | null> = {};

    const source = raw && typeof raw === 'object'
        ? raw as Record<string, unknown>
        : {};

    for (const audience of audiences) {
        const promptKey = AUDIENCE_PROMPT_KEYS[audience];
        const value = source[promptKey];

        if (typeof value === 'string') {
            normalized[audience] = value.trim() || null;
            continue;
        }
        if (value === null) {
            normalized[audience] = null;
            continue;
        }
        normalized[audience] = null;
    }

    return normalized;
}

function normalizeClarificationNeeded(raw: unknown): string[] | null {
    if (raw === null || raw === undefined) return null;
    if (!Array.isArray(raw)) return null;

    const questions = raw
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 3);

    return questions.length > 0 ? questions : null;
}

function buildMockDocumentation(issue: JiraIssue, audiences: AudienceId[]): TicketDocumentation {
    const audienceNotes: Record<string, string | null> = {};
    for (const audience of audiences) {
        audienceNotes[audience] = `${issue.key} update prepared for ${audience.replace('_', ' ')}.`;
    }

    return {
        summary: `${issue.key} delivered an update for ${issue.summary}.`,
        shortDescription: `This ticket updated ${issue.summary}. The change improves expected behavior for the relevant workflow.`,
        howToUse: issue.issueType.toLowerCase() === 'bug'
            ? 'Behavior was corrected. Repeat the previous scenario and confirm the issue no longer reproduces.'
            : 'Open the related feature flow and follow the updated behavior in the product.',
        impact: 'Users and stakeholders impacted by this workflow should see more reliable outcomes.',
        audienceNotes,
    };
}

async function generateDocumentationForTicket(params: {
    issue: JiraIssue;
    audiences: AudienceId[];
    answers?: Record<string, string>;
    aiConfig: AIClientConfig | null;
}): Promise<{ documentation: TicketDocumentation | null; clarificationNeeded: string[] | null; error: string | null; }> {
    const { issue, audiences, answers, aiConfig } = params;

    if (!aiConfig) {
        return { documentation: buildMockDocumentation(issue, audiences), clarificationNeeded: null, error: null };
    }

    const openai = new OpenAI({
        apiKey: aiConfig.apiKey,
        baseURL: aiConfig.baseURL,
    });

    const descriptionText = extractDescriptionText(issue.description || '').trim();
    const audienceKeys = audiences.map((audience) => AUDIENCE_PROMPT_KEYS[audience]).join(', ');

    const userPrompt = [
        `Ticket Key: ${issue.key}`,
        `Summary: ${issue.summary}`,
        `Status: ${issue.status}`,
        `Type: ${issue.issueType}`,
        `Assignee: ${issue.assignee?.displayName || 'Unassigned'}`,
        `Epic: ${formatEpicLabel(issue, 'No Epic')}`,
        `Story Points: ${issue.storyPoints ?? 'Not set'}`,
        `Age: ${issue.age} days`,
        `Comments Count: ${issue.commentsCount}`,
        `Description:\n${descriptionText || 'No description available.'}`,
        `Requested audience_notes keys: ${audienceKeys}`,
        `PM additional context from Q&A:\n${buildQuestionAnswerContext(answers)}`,
    ].join('\n\n');

    let lastError = 'Failed to parse AI response.';

    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const completion = await openai.chat.completions.create({
                model: aiConfig.model,
                messages: [
                    { role: 'system', content: REPORT_PROMPTS.ticket_documentation },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.3,
                max_tokens: MAX_TOKENS.ticket_documentation,
            });

            const content = completion.choices[0]?.message?.content || '';
            const parsed = parseDocumentationJson(content);
            if (!parsed) {
                lastError = `AI JSON parse failed (attempt ${attempt + 1}).`;
                continue;
            }

            return {
                documentation: {
                    summary: normalizeNullableString(parsed.summary),
                    shortDescription: normalizeNullableString(parsed.shortDescription),
                    howToUse: normalizeNullableString(parsed.howToUse),
                    impact: normalizeNullableString(parsed.impact),
                    audienceNotes: normalizeAudienceNotes(parsed.audience_notes, audiences),
                },
                clarificationNeeded: normalizeClarificationNeeded(parsed.clarificationNeeded),
                error: null,
            };
        } catch (error) {
            lastError = String(error);
        }
    }

    return { documentation: null, clarificationNeeded: null, error: lastError };
}

function saveGeneratedDocs(rows: GeneratedDocEntry[]): void {
    if (rows.length === 0 || DEMO_MODE) return;

    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO ticket_docs (
        id,
        ticket_key,
        generated_at,
        audiences,
        summary,
        short_description,
        how_to_use,
        impact,
        audience_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((entries: GeneratedDocEntry[]) => {
        for (const entry of entries) {
            insert.run(
                entry.id,
                entry.ticketKey,
                entry.generatedAt,
                JSON.stringify(entry.audiences),
                entry.doc.summary,
                entry.doc.shortDescription,
                entry.doc.howToUse,
                entry.doc.impact,
                JSON.stringify(entry.doc.audienceNotes)
            );
        }
    });

    transaction(rows);
}

function buildIssueMap(ticketKeys: string[]): Map<string, JiraIssue | null> {
    if (DEMO_MODE) {
        const demoByKey = new Map(getDemoIssues().map((issue) => [issue.key, issue]));
        return new Map(ticketKeys.map((key) => [key, demoByKey.get(key) || null]));
    }

    return new Map(ticketKeys.map((key) => [key, getIssueByKey(key)]));
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({})) as Partial<DocsGenerateRequest>;
        const ticketKeys = normalizeTicketKeys(body.ticketKeys);
        const audiences = normalizeAudiences(body.audiences);
        const qaAnswers = normalizeQaAnswers(body.qaAnswers);

        if (ticketKeys.length === 0) {
            return NextResponse.json({ error: 'ticketKeys is required.' }, { status: 400 });
        }
        if (audiences.length === 0) {
            return NextResponse.json({ error: 'audiences is required.' }, { status: 400 });
        }

        const issueMap = buildIssueMap(ticketKeys);
        const generated: GeneratedDocEntry[] = [];
        const incomplete: IncompleteDocEntry[] = [];
        const errors: Array<{ ticketKey: string; error: string; }> = [];
        const aiConfig = resolveAIClientConfig();

        const results = await Promise.all(ticketKeys.map(async (ticketKey) => {
            const issue = issueMap.get(ticketKey) || null;
            if (!issue) {
                return {
                    generated: null,
                    incomplete: null,
                    error: { ticketKey, error: 'Ticket not found in local data. Sync Jira and try again.' },
                };
            }

            const assessment = assessCompleteness(issue);
            const questions = buildLeadingQuestions(assessment);
            const ticketAnswers = qaAnswers[ticketKey];
            const canUseQaOverride = hasMeaningfulAnswers(ticketAnswers);

            if (!assessment.isReady && !canUseQaOverride) {
                return {
                    generated: null,
                    incomplete: {
                        ticketKey,
                        completenessScore: assessment.score,
                        ticket: getTicketSummary(issue),
                        questions,
                    } as IncompleteDocEntry,
                    error: null,
                };
            }

            const generationResult = await generateDocumentationForTicket({
                issue,
                audiences,
                answers: ticketAnswers,
                aiConfig,
            });

            if (!generationResult.documentation) {
                return {
                    generated: null,
                    incomplete: null,
                    error: { ticketKey, error: generationResult.error || 'Failed to generate documentation.' },
                };
            }

            return {
                generated: {
                    id: `ticket-doc-${Date.now()}-${ticketKey}-${Math.random().toString(36).slice(2, 9)}`,
                    ticketKey,
                    generatedAt: new Date().toISOString(),
                    audiences,
                    completenessScore: assessment.score,
                    ticket: getTicketSummary(issue),
                    doc: generationResult.documentation,
                    clarificationNeeded: generationResult.clarificationNeeded,
                } as GeneratedDocEntry,
                incomplete: null,
                error: null,
            };
        }));

        for (const result of results) {
            if (result.generated) generated.push(result.generated);
            if (result.incomplete) incomplete.push(result.incomplete);
            if (result.error) errors.push(result.error);
        }

        saveGeneratedDocs(generated);

        return NextResponse.json({
            generated,
            incomplete,
            errors,
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function GET() {
    try {
        if (DEMO_MODE) {
            return NextResponse.json([]);
        }

        const db = getDb();
        const rows = db.prepare(`
          SELECT
            id,
            ticket_key,
            generated_at,
            audiences,
            summary,
            short_description,
            how_to_use,
            impact,
            audience_notes
          FROM ticket_docs
          ORDER BY generated_at DESC
          LIMIT 100
        `).all() as TicketDocRow[];

        const history = rows.map((row) => {
            const audiences = parseAudienceArray(row.audiences);
            const issue = getIssueByKey(row.ticket_key);

            return {
                id: row.id,
                ticketKey: row.ticket_key,
                generatedAt: row.generated_at,
                audiences,
                completenessScore: issue ? assessCompleteness(issue).score : 0,
                ticket: issue
                    ? getTicketSummary(issue)
                    : {
                        key: row.ticket_key,
                        summary: row.summary || row.ticket_key,
                        status: 'Unknown',
                        type: 'Unknown',
                        assignee: null,
                        age: 0,
                        epic: null,
                        storyPoints: null,
                        commentsCount: 0,
                    },
                doc: {
                    summary: row.summary,
                    shortDescription: row.short_description,
                    howToUse: row.how_to_use,
                    impact: row.impact,
                    audienceNotes: parseAudienceNotes(row.audience_notes, audiences),
                },
                clarificationNeeded: null,
            };
        });

        return NextResponse.json(history);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
