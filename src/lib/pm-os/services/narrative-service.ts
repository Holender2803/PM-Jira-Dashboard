import OpenAI from 'openai';
import { getDemoIssues } from '@/lib/demo-data';
import { queryIssues } from '@/lib/issue-store';
import { getDecisionById } from '@/lib/pm-os/repositories/decisions-repo';
import { getInitiativeById } from '@/lib/pm-os/repositories/initiatives-repo';
import { getObjectiveById } from '@/lib/pm-os/repositories/objectives-repo';
import { listPmTasks } from '@/lib/pm-os/repositories/pm-tasks-repo';
import { saveNarrative } from '@/lib/pm-os/repositories/narratives-repo';
import { getStrategyRiskAlerts } from '@/lib/pm-os/services/risk-service';
import { NarrativeRecord, NarrativeRequest } from '@/types/pm-os';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

type AIProvider = 'openai' | 'groq';

interface AIClientConfig {
    provider: AIProvider;
    apiKey: string;
    baseURL?: string;
    model: string;
}

const NARRATIVE_PROMPTS: Record<NarrativeRequest['type'], string> = {
    roadmap_narrative: 'Write a roadmap narrative using Problem, Evidence, Solution, and Impact. Tie delivery work back to strategy and explain tradeoffs clearly.',
    objective_review: 'Write an objective review. Explain objective progress, KPI movement, missing measures, and what the PM should decide next.',
    decision_brief: 'Write a decision brief capturing problem context, options considered, final decision, expected outcome, and unresolved risks.',
    risk_digest: 'Write a PM risk digest that explains the top product and delivery risks, why they matter, and the mitigation path.',
    daily_pm_plan: 'Write a daily PM plan with clear priorities, sequencing, and follow-ups. Make it actionable and time-aware.',
    stakeholder_brief: 'Write a stakeholder-ready update that is non-technical, concise, and clear about business impact.',
};

const AUDIENCE_INSTRUCTIONS: Record<NarrativeRequest['audience'], string> = {
    executive: 'Audience is executives. Be concise, outcome-focused, and business-oriented.',
    pm_internal: 'Audience is an experienced PM. Be specific, structured, and explicit about tradeoffs.',
    stakeholder: 'Audience is cross-functional stakeholders. Translate delivery detail into impact and expectations.',
    junior_pm: 'Audience is a newer PM. Include mentoring guidance and explain what to pay attention to next.',
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

function reportTypeLabel(type: NarrativeRequest['type']): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function buildNarrativeSummary(request: NarrativeRequest): string {
    const sourceCount = request.issueKeys.length + request.initiativeIds.length + request.objectiveIds.length + request.decisionIds.length;
    return `${reportTypeLabel(request.type)} — ${sourceCount} selected source${sourceCount === 1 ? '' : 's'}`;
}

function buildSourceDigest(request: NarrativeRequest): string {
    return [
        `Source counts: ${request.issueKeys.length} Jira issue(s), ${request.initiativeIds.length} initiative(s), ${request.objectiveIds.length} objective(s), ${request.decisionIds.length} decision(s).`,
        `Include PM tasks: ${request.includeTasks ? 'yes' : 'no'}.`,
        `Include risks: ${request.includeRisks ? 'yes' : 'no'}.`,
    ].join('\n');
}

function buildContext(request: NarrativeRequest): string {
    const allIssues = DEMO_MODE ? getDemoIssues() : queryIssues();
    const issues = request.issueKeys.length > 0
        ? allIssues.filter((issue) => request.issueKeys.includes(issue.key))
        : allIssues.filter((issue) => issue.sprint?.state === 'active').slice(0, 20);

    const initiatives = request.initiativeIds
        .map((id) => getInitiativeById(id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const objectives = request.objectiveIds
        .map((id) => getObjectiveById(id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const decisions = request.decisionIds
        .map((id) => getDecisionById(id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const tasks = request.includeTasks
        ? listPmTasks().filter((task) => task.status !== 'done').slice(0, 8)
        : [];
    const risks = request.includeRisks
        ? getStrategyRiskAlerts().slice(0, 8)
        : [];

    const issueContext = issues.length > 0
        ? issues.map((issue) => `${issue.key} — ${issue.summary} (${issue.status}, ${issue.issueType})`).join('\n')
        : 'None';
    const initiativeContext = initiatives.length > 0
        ? initiatives.map((initiative) => `${initiative.title} (${initiative.status})${initiative.objectiveTitle ? ` · Objective: ${initiative.objectiveTitle}` : ''}${initiative.outcomeTitle ? ` · Outcome: ${initiative.outcomeTitle}` : ''}`).join('\n')
        : 'None';
    const objectiveContext = objectives.length > 0
        ? objectives.map((objective) => `${objective.title} (${objective.status})${objective.targetDate ? ` · Target ${objective.targetDate}` : ''}`).join('\n')
        : 'None';
    const decisionContext = decisions.length > 0
        ? decisions.map((decision) => `${decision.title} (${decision.status}) · ${decision.problemContext}${decision.finalDecision ? ` · Final: ${decision.finalDecision}` : ''}`).join('\n')
        : 'None';
    const taskContext = tasks.length > 0
        ? tasks.map((task) => `${task.title} (${task.category})${task.dueDate ? ` · Due ${task.dueDate}` : ''}`).join('\n')
        : 'None';
    const riskContext = risks.length > 0
        ? risks.map((risk) => `${risk.title} (${risk.severity}) · ${risk.recommendation}`).join('\n')
        : 'None';

    return [
        'Jira / delivery context:',
        issueContext,
        '',
        'Initiative context:',
        initiativeContext,
        '',
        'Objective context:',
        objectiveContext,
        '',
        'Decision context:',
        decisionContext,
        '',
        'PM task context:',
        taskContext,
        '',
        'Risk context:',
        riskContext,
    ].join('\n');
}

function generateMockNarrative(request: NarrativeRequest): string {
    const sections = [
        `Narrative type: ${reportTypeLabel(request.type)}`,
        `Audience: ${request.audience}`,
        `Selected Jira issues: ${request.issueKeys.length}`,
        `Selected initiatives: ${request.initiativeIds.length}`,
        `Selected objectives: ${request.objectiveIds.length}`,
        `Selected decisions: ${request.decisionIds.length}`,
    ];

    if (request.includeRisks) {
        sections.push('Include risk framing: yes');
    }
    if (request.includeTasks) {
        sections.push('Include PM tasks: yes');
    }

    const nextStep = request.type === 'daily_pm_plan'
        ? 'Today, focus first on unblock actions, then close decision loops, then refresh stakeholder communication.'
        : 'Next, turn this narrative into a stakeholder conversation and confirm the decisions or follow-ups it implies.';

    return [
        `${reportTypeLabel(request.type)}`,
        '',
        'Problem',
        'The product team needs a coherent explanation that ties delivery activity back to product intent and next actions.',
        '',
        'Evidence',
        sections.map((line) => `- ${line}`).join('\n'),
        '',
        'Story',
        'Delivery signals, PM decisions, and strategic context have been combined so the PM can explain not only what is happening, but why it matters.',
        '',
        'Next Step',
        nextStep,
    ].join('\n');
}

export async function generateNarrative(request: NarrativeRequest): Promise<NarrativeRecord> {
    const systemPrompt = [
        'You are a senior product management operating system assistant.',
        AUDIENCE_INSTRUCTIONS[request.audience],
        NARRATIVE_PROMPTS[request.type],
        request.audience === 'junior_pm'
            ? 'Include brief mentor-style guidance about how a strong PM should interpret the situation.'
            : 'Keep the writing practical and decision-oriented.',
        'Prefer clear sections and concise bullets over long paragraphs.',
        'Use only the supplied Jira, strategy, decision, task, and risk context.',
        'Do not invent metrics, decisions, or stakeholder commitments.',
        'If evidence is weak or missing, say so directly instead of filling gaps.',
        request.type === 'daily_pm_plan'
            ? 'Order recommendations by urgency and sequence them explicitly.'
            : 'Explain what changed, why it matters, and what the PM should do next.',
    ].join('\n');

    const userPrompt = [
        `Generate a ${reportTypeLabel(request.type)} now.`,
        request.customInstructions ? `Additional instructions: ${request.customInstructions}` : '',
        '',
        buildSourceDigest(request),
        '',
        buildContext(request),
    ].filter(Boolean).join('\n');

    let content = '';
    const aiConfig = resolveAIClientConfig();
    if (!aiConfig) {
        content = generateMockNarrative(request);
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
            temperature: request.type === 'daily_pm_plan' ? 0.3 : 0.45,
            max_tokens: 900,
        });

        content = completion.choices[0]?.message?.content || 'No response generated.';
    }

    const report: NarrativeRecord = {
        id: `narrative-${Date.now()}`,
        type: request.type,
        audience: request.audience,
        title: reportTypeLabel(request.type),
        generatedAt: new Date().toISOString(),
        summary: buildNarrativeSummary(request),
        content,
        issueKeys: request.issueKeys,
        initiativeIds: request.initiativeIds,
        objectiveIds: request.objectiveIds,
        decisionIds: request.decisionIds,
        includeRisks: request.includeRisks,
        includeTasks: request.includeTasks,
    };

    if (!DEMO_MODE) {
        try {
            saveNarrative(report, request.customInstructions);
        } catch {
            // Persistence failure should not block response.
        }
    }

    return report;
}
