import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getIssueByKey } from '@/lib/issue-store';
import { extractDescriptionText, formatEpicLabel } from '@/lib/issue-format';

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

interface RewriteRequest {
    ticketKey?: string;
    audience?: AudienceId;
    original?: {
        summary?: string | null;
        shortDescription?: string | null;
        howToUse?: string | null;
        impact?: string | null;
    };
    audienceNote?: string | null;
}

const AUDIENCE_TONE: Record<AudienceId, string> = {
    implementation_team: 'Technical and deployment-focused. Mention configuration and rollout considerations.',
    support_team: 'User-facing, empathetic, FAQ-ready language. Highlight what users may ask.',
    sales_team: 'Benefit-led language with minimal jargon. Emphasize customer value.',
    marketing: 'Feature announcement style suitable for release updates.',
    engineering: 'Technical detail with code context and implementation implications.',
    executive: 'Business impact language, concise, one short paragraph tone.',
    product: 'Roadmap context and user story framing.',
};

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

function parseRewriteJson(raw: string): {
    summary?: unknown;
    shortDescription?: unknown;
    howToUse?: unknown;
    impact?: unknown;
} | null {
    const tryParse = (value: string) => {
        try {
            const parsed = JSON.parse(value) as unknown;
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed as {
                summary?: unknown;
                shortDescription?: unknown;
                howToUse?: unknown;
                impact?: unknown;
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

function normalizeNullable(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function fallbackRewrite(params: {
    audience: AudienceId;
    original?: RewriteRequest['original'];
    audienceNote?: string | null;
}) {
    const note = params.audienceNote?.trim() || null;
    const audienceLabel = params.audience.replace('_', ' ');

    return {
        summary: params.original?.summary || null,
        shortDescription: note || params.original?.shortDescription || null,
        howToUse: params.original?.howToUse || null,
        impact: params.original?.impact || null,
        rewrittenFor: audienceLabel,
    };
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({})) as RewriteRequest;
        const ticketKey = typeof body.ticketKey === 'string'
            ? body.ticketKey.trim().toUpperCase()
            : '';
        const audience = body.audience;

        if (!ticketKey) {
            return NextResponse.json({ error: 'ticketKey is required.' }, { status: 400 });
        }
        if (!audience || !AUDIENCE_TONE[audience]) {
            return NextResponse.json({ error: 'audience is required.' }, { status: 400 });
        }

        const issue = getIssueByKey(ticketKey);
        if (!issue) {
            return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
        }

        const aiConfig = resolveAIClientConfig();
        if (!aiConfig) {
            return NextResponse.json({
                ok: true,
                doc: fallbackRewrite({
                    audience,
                    original: body.original,
                    audienceNote: body.audienceNote,
                }),
            });
        }

        const openai = new OpenAI({
            apiKey: aiConfig.apiKey,
            baseURL: aiConfig.baseURL,
        });

        const prompt = [
            'Rewrite the existing ticket documentation for a specific audience.',
            `Audience: ${audience}`,
            `Audience tone guidance: ${AUDIENCE_TONE[audience]}`,
            `Ticket Key: ${issue.key}`,
            `Ticket Summary: ${issue.summary}`,
            `Ticket Status: ${issue.status}`,
            `Ticket Type: ${issue.issueType}`,
            `Epic: ${formatEpicLabel(issue, 'No Epic')}`,
            `Description: ${extractDescriptionText(issue.description || '').trim() || 'No description.'}`,
            `Original summary: ${body.original?.summary || 'null'}`,
            `Original shortDescription: ${body.original?.shortDescription || 'null'}`,
            `Original howToUse: ${body.original?.howToUse || 'null'}`,
            `Original impact: ${body.original?.impact || 'null'}`,
            `Audience-specific note: ${body.audienceNote || 'null'}`,
            'Return ONLY JSON with this shape:',
            '{"summary": "... or null", "shortDescription": "... or null", "howToUse": "... or null", "impact": "... or null"}',
        ].join('\n\n');

        const completion = await openai.chat.completions.create({
            model: aiConfig.model,
            messages: [
                {
                    role: 'system',
                    content: 'Rewrite for the specified audience. Keep concise. Do not invent product behavior. Return JSON only.',
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 500,
        });

        const raw = completion.choices[0]?.message?.content || '';
        const parsed = parseRewriteJson(raw);
        if (!parsed) {
            return NextResponse.json({ error: 'Failed to parse rewrite response.' }, { status: 502 });
        }

        return NextResponse.json({
            ok: true,
            doc: {
                summary: normalizeNullable(parsed.summary),
                shortDescription: normalizeNullable(parsed.shortDescription),
                howToUse: normalizeNullable(parsed.howToUse),
                impact: normalizeNullable(parsed.impact),
            },
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
