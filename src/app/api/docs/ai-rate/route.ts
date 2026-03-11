import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getDemoIssues } from '@/lib/demo-data';
import { saveIssueDocAiRating, getIssueByKey } from '@/lib/issue-store';
import { extractDescriptionText } from '@/lib/issue-format';
import { DocAIRating, JiraIssue } from '@/types';
import { scoreTicket } from '@/lib/docReadiness';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

type AIProvider = 'openai' | 'groq';

interface AIClientConfig {
    provider: AIProvider;
    apiKey: string;
    baseURL?: string;
    model: string;
}

interface AIRateRequest {
    ticketKey?: string;
    ticketKeys?: string[];
}

interface AIRateResult {
    ticketKey: string;
    score: number;
    grade: string;
    cached: boolean;
    rating: DocAIRating | null;
    error?: string;
}

const AI_RATE_PROMPT = `Rate this Jira ticket description for documentation quality. Return ONLY JSON, no other text:
{
  "clarity": 1-5,
  "completeness": 1-5,
  "userImpact": 1-5,
  "overallScore": 1-5,
  "oneLineFeedback": "plain English suggestion"
}

clarity: Is it clear what was done?
completeness: Does it explain why and how?
userImpact: Does it mention who is affected?

Example good description score: 4-5
Example bad: just a ticket title repeated = 1-2`;

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

function normalizeTicketKey(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const key = raw.trim().toUpperCase();
    if (!key) return null;
    return key;
}

function normalizeTicketKeys(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean))];
}

function clampRating(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.min(5, Math.round(parsed)));
}

function parseAiRating(raw: string): DocAIRating | null {
    const tryParse = (value: string): DocAIRating | null => {
        try {
            const parsed = JSON.parse(value) as unknown;
            if (!parsed || typeof parsed !== 'object') return null;
            const record = parsed as Record<string, unknown>;
            return {
                clarity: clampRating(record.clarity),
                completeness: clampRating(record.completeness),
                userImpact: clampRating(record.userImpact),
                overallScore: clampRating(record.overallScore),
                oneLineFeedback: typeof record.oneLineFeedback === 'string'
                    ? record.oneLineFeedback.trim()
                    : '',
            };
        } catch {
            return null;
        }
    };

    const direct = tryParse(raw.trim());
    if (direct) return direct;

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
        return tryParse(raw.slice(start, end + 1));
    }

    return null;
}

function getMockRating(issue: JiraIssue): DocAIRating {
    const description = extractDescriptionText(issue.description || '');
    const lengthScore = description.length > 220 ? 4 : description.length > 120 ? 3 : 2;
    const impactScore = /\b(user|customer|impact|business)\b/i.test(description) ? 4 : 2;
    const clarity = Math.max(1, Math.min(5, lengthScore));
    const completeness = Math.max(1, Math.min(5, Math.round((lengthScore + impactScore) / 2)));
    const userImpact = impactScore;
    const overallScore = Math.max(1, Math.min(5, Math.round((clarity + completeness + userImpact) / 3)));
    const oneLineFeedback = impactScore >= 3
        ? 'Strong context. Add exact behavior change details for future readers.'
        : 'Add who is impacted and what behavior changed to improve doc quality.';

    return {
        clarity,
        completeness,
        userImpact,
        overallScore,
        oneLineFeedback,
    };
}

async function runAiRating(issue: JiraIssue, aiConfig: AIClientConfig): Promise<DocAIRating> {
    const openai = new OpenAI({
        apiKey: aiConfig.apiKey,
        baseURL: aiConfig.baseURL,
    });

    const description = extractDescriptionText(issue.description || '').trim();
    const prompt = [
        `Ticket Key: ${issue.key}`,
        `Summary: ${issue.summary}`,
        `Status: ${issue.status}`,
        'Description:',
        description || 'No description provided.',
    ].join('\n');

    const completion = await openai.chat.completions.create({
        model: aiConfig.model,
        messages: [
            { role: 'system', content: AI_RATE_PROMPT },
            { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 220,
    });

    const content = completion.choices[0]?.message?.content || '';
    const parsed = parseAiRating(content);
    if (!parsed) {
        throw new Error('Failed to parse AI rating response.');
    }
    return parsed;
}

function findDemoIssue(key: string): JiraIssue | null {
    return getDemoIssues().find((issue) => issue.key === key) || null;
}

async function rateTicket(ticketKey: string, aiConfig: AIClientConfig | null): Promise<AIRateResult> {
    const issue = DEMO_MODE ? findDemoIssue(ticketKey) : getIssueByKey(ticketKey);
    if (!issue) {
        return {
            ticketKey,
            score: 0,
            grade: 'D',
            cached: false,
            rating: null,
            error: 'Ticket not found.',
        };
    }

    const readiness = scoreTicket(issue);
    if (readiness.score < 40) {
        return {
            ticketKey,
            score: readiness.score,
            grade: readiness.grade,
            cached: false,
            rating: null,
            error: 'AI rating is available only for tickets with Doc Readiness score >= 40.',
        };
    }

    if (issue.docAiRating) {
        return {
            ticketKey,
            score: readiness.score,
            grade: readiness.grade,
            cached: true,
            rating: issue.docAiRating,
        };
    }

    const rating = aiConfig
        ? await runAiRating(issue, aiConfig)
        : getMockRating(issue);

    if (!DEMO_MODE) {
        saveIssueDocAiRating(ticketKey, rating);
    }

    return {
        ticketKey,
        score: readiness.score,
        grade: readiness.grade,
        cached: false,
        rating,
    };
}

async function handleBatchRate(ticketKeys: string[], aiConfig: AIClientConfig | null): Promise<NextResponse> {
    const encoder = new TextEncoder();
    const total = ticketKeys.length;

    const stream = new ReadableStream({
        start(controller) {
            const write = (payload: unknown) => {
                controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
            };

            void (async () => {
                const results: AIRateResult[] = [];
                let processed = 0;

                await Promise.all(ticketKeys.map(async (ticketKey) => {
                    try {
                        const result = await rateTicket(ticketKey, aiConfig);
                        results.push(result);
                    } catch (error) {
                        results.push({
                            ticketKey,
                            score: 0,
                            grade: 'D',
                            cached: false,
                            rating: null,
                            error: String(error),
                        });
                    } finally {
                        processed += 1;
                        write({ type: 'progress', processed, total });
                    }
                }));

                const successful = results.filter((result) => !result.error && result.rating);
                const errors = results.filter((result) => Boolean(result.error));

                write({
                    type: 'done',
                    total,
                    rated: successful.length,
                    results,
                    errors,
                });
                controller.close();
            })();
        },
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({})) as AIRateRequest;
        const ticketKeys = normalizeTicketKeys(body.ticketKeys);
        const aiConfig = resolveAIClientConfig();

        if (ticketKeys.length > 0) {
            return handleBatchRate(ticketKeys, aiConfig);
        }

        const ticketKey = normalizeTicketKey(body.ticketKey);
        if (!ticketKey) {
            return NextResponse.json({ error: 'ticketKey is required.' }, { status: 400 });
        }

        const result = await rateTicket(ticketKey, aiConfig);
        if (result.error) {
            const status = result.error.includes('not found') ? 404 : 400;
            return NextResponse.json({ error: result.error, score: result.score }, { status });
        }

        return NextResponse.json({
            ok: true,
            cached: result.cached,
            ticketKey,
            score: result.score,
            grade: result.grade,
            rating: result.rating,
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
