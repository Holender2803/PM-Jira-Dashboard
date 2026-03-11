'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { DocAIRating, DocGrade, JiraIssue } from '@/types';
import { getGroupForStatus } from '@/lib/statusGroups';
import { getDocGradeColor, getDocReadinessChecklist, getTicketDocScore } from '@/lib/docReadiness';
import IssueDrawer from '@/components/tables/IssueDrawer';

type StatusFilter = 'all' | 'done' | 'in_progress' | 'any';
type TypeFilter = 'all' | 'bug' | 'feature' | 'task';
type ExportMode = 'plain' | 'confluence' | 'notion' | 'download';
type ScoreFilter = 'all' | 'ready' | 'needs_info' | 'incomplete';
type DocsSort = 'doc_desc' | 'doc_asc' | 'ai_desc' | 'ai_asc';
type GenerateMode = 'replace' | 'add';

type AudienceId =
    | 'implementation_team'
    | 'support_team'
    | 'sales_team'
    | 'marketing'
    | 'engineering'
    | 'executive'
    | 'product';

interface AudienceOption {
    id: AudienceId;
    label: string;
    shortLabel: string;
    sectionLabel: string;
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

interface RewriteDocFields {
    summary: string | null;
    shortDescription: string | null;
    howToUse: string | null;
    impact: string | null;
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
    rewrites?: Partial<Record<AudienceId, RewriteDocFields>>;
}

interface LeadingQuestion {
    id: string;
    question: string;
}

interface IncompleteDocEntry {
    ticketKey: string;
    completenessScore: number;
    ticket: TicketSummary;
    questions: LeadingQuestion[];
}

interface TicketGenerationError {
    ticketKey: string;
    error: string;
}

interface DocsGenerateResponse {
    generated: GeneratedDocEntry[];
    incomplete: IncompleteDocEntry[];
    errors: TicketGenerationError[];
}

interface AiRateStreamProgress {
    type: 'progress';
    processed: number;
    total: number;
}

interface AiRateStreamDone {
    type: 'done';
    total: number;
    rated: number;
    results: Array<{
        ticketKey: string;
        rating: DocAIRating | null;
        error?: string;
    }>;
    errors: Array<{
        ticketKey: string;
        error: string;
    }>;
}

interface RewriteResponse {
    ok: boolean;
    doc: RewriteDocFields;
    error?: string;
}

interface GenerationSummary {
    generatedCount: number;
    clarificationCount: number;
    lowQualityCount: number;
    generatedKeys: string[];
    clarificationKeys: string[];
    lowQualityKeys: string[];
}

const DOC_AUDIENCES: AudienceOption[] = [
    { id: 'implementation_team', label: '📦 Implementation Team', shortLabel: 'Impl', sectionLabel: 'IMPLEMENTATION TEAM' },
    { id: 'support_team', label: '🛠 Support Team', shortLabel: 'Support', sectionLabel: 'SUPPORT TEAM' },
    { id: 'sales_team', label: '💼 Sales Team', shortLabel: 'Sales', sectionLabel: 'SALES TEAM' },
    { id: 'marketing', label: '📣 Marketing', shortLabel: 'Marketing', sectionLabel: 'MARKETING' },
    { id: 'engineering', label: '🔧 Engineering', shortLabel: 'Eng', sectionLabel: 'ENGINEERING' },
    { id: 'executive', label: '👔 Executive', shortLabel: 'Exec', sectionLabel: 'EXECUTIVE' },
    { id: 'product', label: '📋 Product', shortLabel: 'Product', sectionLabel: 'PRODUCT' },
];

const AUDIENCE_BY_ID = Object.fromEntries(DOC_AUDIENCES.map((audience) => [audience.id, audience])) as Record<AudienceId, AudienceOption>;

const PANEL_RATIO_STORAGE_KEY = 'ticket-docs-panel-ratio-v1';
const AI_RATING_CACHE_KEY = 'ticket-docs-ai-rating-cache-v1';

function toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toSafeDate(value: string): Date | null {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function truncateSummary(summary: string, max = 76): string {
    if (summary.length <= max) return summary;
    return `${summary.slice(0, max - 1)}…`;
}

function normalizeText(value: string | null | undefined, fallback = 'N/A'): string {
    if (!value || !value.trim()) return fallback;
    return value.trim();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildAssigneeNamePatterns(cards: GeneratedDocEntry[]): RegExp[] {
    const names = new Set<string>();

    for (const card of cards) {
        const assignee = card.ticket.assignee?.trim();
        if (!assignee) continue;

        names.add(assignee);
        const parts = assignee.split(/\s+/).filter((part) => part.length >= 3);
        for (const part of parts) {
            names.add(part);
        }
    }

    return [...names].map((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi'));
}

function getStatusBadgeStyle(status: string): { background: string; color: string; border: string } {
    const group = getGroupForStatus(status);
    if (group === 'Done') {
        return {
            background: 'rgba(16,185,129,0.15)',
            color: '#34d399',
            border: '1px solid rgba(16,185,129,0.45)',
        };
    }
    if (group === 'Blocked/Hold') {
        return {
            background: 'rgba(239,68,68,0.16)',
            color: '#f87171',
            border: '1px solid rgba(239,68,68,0.42)',
        };
    }
    if (group === 'In Progress') {
        return {
            background: 'rgba(59,130,246,0.16)',
            color: '#60a5fa',
            border: '1px solid rgba(59,130,246,0.44)',
        };
    }
    return {
        background: 'rgba(148,163,184,0.16)',
        color: '#cbd5e1',
        border: '1px solid rgba(148,163,184,0.35)',
    };
}

function getIssueTypeMeta(issueType: string): {
    emoji: string;
    label: string;
    copyLabel: string;
    style: { background: string; color: string; border: string; };
} {
    const normalized = issueType.trim().toLowerCase();

    if (normalized === 'bug') {
        return {
            emoji: '🐛',
            label: 'Bug',
            copyLabel: 'BUG',
            style: {
                background: 'rgba(239,68,68,0.16)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.45)',
            },
        };
    }
    if (normalized === 'feature') {
        return {
            emoji: '✨',
            label: 'Feature',
            copyLabel: 'FEATURE',
            style: {
                background: 'rgba(168,85,247,0.18)',
                color: '#c084fc',
                border: '1px solid rgba(168,85,247,0.45)',
            },
        };
    }
    if (normalized === 'story') {
        return {
            emoji: '📖',
            label: 'Story',
            copyLabel: 'STORY',
            style: {
                background: 'rgba(20,184,166,0.18)',
                color: '#2dd4bf',
                border: '1px solid rgba(20,184,166,0.42)',
            },
        };
    }
    if (normalized === 'spike') {
        return {
            emoji: '⚡',
            label: 'Spike',
            copyLabel: 'SPIKE',
            style: {
                background: 'rgba(249,115,22,0.18)',
                color: '#fb923c',
                border: '1px solid rgba(249,115,22,0.44)',
            },
        };
    }

    return {
        emoji: '🔧',
        label: 'Task',
        copyLabel: 'TASK',
        style: {
            background: 'rgba(59,130,246,0.16)',
            color: '#60a5fa',
            border: '1px solid rgba(59,130,246,0.44)',
        },
    };
}

function matchesStatus(issue: JiraIssue, filter: StatusFilter): boolean {
    if (filter === 'all' || filter === 'any') return true;
    const group = getGroupForStatus(issue.status);
    if (filter === 'done') return group === 'Done';
    if (filter === 'in_progress') return group === 'In Progress';
    return true;
}

function matchesType(issue: JiraIssue, filter: TypeFilter): boolean {
    if (filter === 'all') return true;
    const issueType = issue.issueType.toLowerCase();
    if (filter === 'bug') return issueType === 'bug';
    if (filter === 'feature') return issueType === 'feature';
    if (filter === 'task') return issueType === 'task' || issueType === 'technical task';
    return true;
}

function matchesScoreFilter(grade: DocGrade, filter: ScoreFilter): boolean {
    if (filter === 'all') return true;
    if (filter === 'ready') return grade === 'A' || grade === 'B';
    if (filter === 'needs_info') return grade === 'C';
    return grade === 'D';
}

function getDocBadgeStyle(grade: DocGrade): { background: string; color: string; border: string } {
    const color = getDocGradeColor(grade);
    return {
        background: `${color}26`,
        color,
        border: `1px solid ${color}80`,
    };
}

function getDocTooltip(issue: JiraIssue): string {
    const readiness = getTicketDocScore(issue);
    const checks = new Map(getDocReadinessChecklist(issue).map((check) => [check.id, check.passed]));

    const lines = [
        `Doc Readiness: ${readiness.score}/100`,
        `${checks.get('description_length') ? '✅' : '❌'} ${checks.get('description_length') ? 'Has description' : 'Description too short or missing'}`,
        `${checks.get('epic') ? '✅' : '❌'} ${checks.get('epic') ? 'Has epic' : 'No epic linked'}`,
        `${checks.get('assignee') ? '✅' : '❌'} ${checks.get('assignee') ? 'Assignee set' : 'Assignee not set'}`,
        `${checks.get('story_points') ? '✅' : '❌'} ${checks.get('story_points') ? 'Story points set' : 'Story points missing'}`,
        `${checks.get('resolved') ? '✅' : '❌'} ${checks.get('resolved') ? 'Status resolved' : 'Status not resolved yet'}`,
        '',
    ];

    if (readiness.grade === 'A') {
        lines.push('This ticket is ready for documentation.');
    } else if (readiness.grade === 'B') {
        lines.push('This ticket is ready for documentation with minor gaps.');
    } else if (readiness.grade === 'C') {
        lines.push('This ticket needs more context before high-quality documentation.');
    } else {
        lines.push('This ticket is incomplete and should go through the Q&A flow.');
    }

    return lines.join('\n');
}

function renderStars(rating: DocAIRating | null | undefined): string {
    if (!rating) return '';
    const filled = Math.max(0, Math.min(5, Math.round(rating.overallScore)));
    return '★'.repeat(filled);
}

function getAiRatingSortValue(rating: DocAIRating | null | undefined): number {
    if (!rating) return -1;
    return Math.max(0, Math.min(5, Math.round(rating.overallScore)));
}

function getAiRatingTooltip(rating: DocAIRating | null | undefined): string {
    if (!rating) return 'No AI rating yet';

    const overall = Math.max(1, Math.min(5, Math.round(rating.overallScore)));
    const feedback = rating.oneLineFeedback?.trim();

    if (overall <= 2) {
        return feedback
            ? `Low AI rating: ${overall}/5. ${feedback}`
            : `Low AI rating: ${overall}/5. Missing clarity/completeness context.`;
    }

    return feedback
        ? `AI rating: ${overall}/5. ${feedback}`
        : `AI rating: ${overall}/5`;
}

function sanitizeAudienceText(value: string | null, includeAssigneeNames: boolean, namePatterns: RegExp[]): string | null {
    if (!value) return null;
    if (includeAssigneeNames) return value;

    let sanitized = value;
    for (const pattern of namePatterns) {
        sanitized = sanitized.replace(pattern, 'the engineering team');
    }
    return sanitized;
}

function formatCardPlainText(
    card: GeneratedDocEntry,
    options: { includeAssigneeNames: boolean; namePatterns: RegExp[]; },
    docOverride?: RewriteDocFields
): string {
    const typeMeta = getIssueTypeMeta(card.ticket.type);
    const doc = docOverride || card.doc;
    const headerLine = `${typeMeta.emoji} ${typeMeta.copyLabel} — ${card.ticket.key}`;
    const statusLine = options.includeAssigneeNames
        ? `Status: ${card.ticket.status} | Type: ${card.ticket.type} | Assignee: ${card.ticket.assignee || 'Unassigned'}`
        : `Status: ${card.ticket.status} | Type: ${card.ticket.type}`;

    const lines: string[] = [
        '────────────────────────',
        headerLine,
        card.ticket.summary,
        statusLine,
        '',
        'SUMMARY:',
        normalizeText(doc.summary),
        '',
        'SHORT DESCRIPTION:',
        normalizeText(doc.shortDescription),
    ];

    if (doc.howToUse) {
        lines.push('');
        lines.push('HOW TO USE:');
        lines.push(normalizeText(doc.howToUse));
    }

    if (doc.impact) {
        lines.push('');
        lines.push('IMPACT:');
        lines.push(normalizeText(doc.impact));
    }

    lines.push('');

    for (const audience of card.audiences) {
        const option = AUDIENCE_BY_ID[audience];
        lines.push(`${option.sectionLabel} NOTES:`);
        lines.push(normalizeText(sanitizeAudienceText(card.doc.audienceNotes[audience] || null, options.includeAssigneeNames, options.namePatterns)));
        lines.push('');
    }

    lines.push('────────────────────────');
    return lines.join('\n');
}

function formatCardConfluence(
    card: GeneratedDocEntry,
    options: { includeAssigneeNames: boolean; namePatterns: RegExp[]; },
    docOverride?: RewriteDocFields
): string {
    const typeMeta = getIssueTypeMeta(card.ticket.type);
    const doc = docOverride || card.doc;
    const statusLine = options.includeAssigneeNames
        ? `*Status:* ${card.ticket.status} | *Type:* ${card.ticket.type} | *Assignee:* ${card.ticket.assignee || 'Unassigned'}`
        : `*Status:* ${card.ticket.status} | *Type:* ${card.ticket.type}`;

    const lines: string[] = [
        `h3. ${typeMeta.emoji} ${typeMeta.copyLabel} — ${card.ticket.key}`,
        card.ticket.summary,
        statusLine,
        '',
        '*Summary*',
        normalizeText(doc.summary),
        '',
        '*Short Description*',
        normalizeText(doc.shortDescription),
    ];

    if (doc.howToUse) {
        lines.push('');
        lines.push('*How to Use / What Changed*');
        lines.push(normalizeText(doc.howToUse));
    }

    if (doc.impact) {
        lines.push('');
        lines.push('*Impact*');
        lines.push(normalizeText(doc.impact));
    }

    lines.push('');

    for (const audience of card.audiences) {
        const option = AUDIENCE_BY_ID[audience];
        lines.push(`*${option.sectionLabel} Notes*`);
        lines.push(normalizeText(sanitizeAudienceText(card.doc.audienceNotes[audience] || null, options.includeAssigneeNames, options.namePatterns)));
        lines.push('');
    }

    return lines.join('\n');
}

function formatCardNotion(
    card: GeneratedDocEntry,
    options: { includeAssigneeNames: boolean; namePatterns: RegExp[]; },
    docOverride?: RewriteDocFields
): string {
    const typeMeta = getIssueTypeMeta(card.ticket.type);
    const doc = docOverride || card.doc;
    const statusLine = options.includeAssigneeNames
        ? `Status: ${card.ticket.status} | Type: ${card.ticket.type} | Assignee: ${card.ticket.assignee || 'Unassigned'}`
        : `Status: ${card.ticket.status} | Type: ${card.ticket.type}`;

    const lines: string[] = [
        `## ${typeMeta.emoji} ${typeMeta.copyLabel} — ${card.ticket.key}`,
        card.ticket.summary,
        statusLine,
        '',
        '### Summary',
        normalizeText(doc.summary),
        '',
        '### Short Description',
        normalizeText(doc.shortDescription),
    ];

    if (doc.howToUse) {
        lines.push('');
        lines.push('### How to Use / What Changed');
        lines.push(normalizeText(doc.howToUse));
    }

    if (doc.impact) {
        lines.push('');
        lines.push('### Impact');
        lines.push(normalizeText(doc.impact));
    }

    lines.push('');

    for (const audience of card.audiences) {
        const option = AUDIENCE_BY_ID[audience];
        lines.push(`### ${option.sectionLabel} Notes`);
        lines.push(normalizeText(sanitizeAudienceText(card.doc.audienceNotes[audience] || null, options.includeAssigneeNames, options.namePatterns)));
        lines.push('');
    }

    return lines.join('\n');
}

function prependUniqueDocs(previous: GeneratedDocEntry[], incoming: GeneratedDocEntry[]): GeneratedDocEntry[] {
    const seen = new Set<string>();
    const merged: GeneratedDocEntry[] = [];

    for (const entry of [...incoming, ...previous]) {
        if (seen.has(entry.ticketKey)) continue;
        seen.add(entry.ticketKey);
        merged.push(entry);
    }

    return merged;
}

function upsertDocs(previous: GeneratedDocEntry[], incoming: GeneratedDocEntry[]): GeneratedDocEntry[] {
    const byTicket = new Map(previous.map((entry) => [entry.ticketKey, entry]));

    for (const entry of incoming) {
        byTicket.set(entry.ticketKey, entry);
    }

    return [...byTicket.values()].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

function toLocalEntries(entries: GeneratedDocEntry[]): GeneratedDocEntry[] {
    return entries.map((entry) => ({
        ...entry,
        rewrites: entry.rewrites || {},
    }));
}

function parseCachedRatings(raw: string | null): Record<string, DocAIRating> {
    if (!raw) return {};

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return {};

        const next: Record<string, DocAIRating> = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (!value || typeof value !== 'object') continue;
            const rating = value as Record<string, unknown>;
            const clarity = Number(rating.clarity);
            const completeness = Number(rating.completeness);
            const userImpact = Number(rating.userImpact);
            const overallScore = Number(rating.overallScore);
            if (![clarity, completeness, userImpact, overallScore].every((item) => Number.isFinite(item))) continue;

            next[key.toUpperCase()] = {
                clarity,
                completeness,
                userImpact,
                overallScore,
                oneLineFeedback: typeof rating.oneLineFeedback === 'string' ? rating.oneLineFeedback : '',
            };
        }

        return next;
    } catch {
        return {};
    }
}

export default function TicketDocsPage() {
    const {
        issues,
        isLoading,
        selectedDocTickets,
        selectedDocAudiences,
        setSelectedDocTickets,
        setSelectedDocAudiences,
        toggleDocTicket,
        toggleDocAudience,
        clearDocTicketSelection,
    } = useAppStore();

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('ready');
    const [sortBy, setSortBy] = useState<DocsSort>('doc_desc');
    const [dateFrom, setDateFrom] = useState(() => {
        const now = new Date();
        const last30Days = new Date(now);
        last30Days.setDate(now.getDate() - 30);
        return toDateInputValue(last30Days);
    });
    const [dateTo, setDateTo] = useState(() => toDateInputValue(new Date()));
    const [generateMode, setGenerateMode] = useState<GenerateMode>('replace');

    const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocEntry[]>([]);
    const [incompleteTickets, setIncompleteTickets] = useState<IncompleteDocEntry[]>([]);
    const [ticketErrors, setTicketErrors] = useState<TicketGenerationError[]>([]);
    const [history, setHistory] = useState<GeneratedDocEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [generatingPlaceholders, setGeneratingPlaceholders] = useState<string[]>([]);
    const [ticketGenerating, setTicketGenerating] = useState<Record<string, boolean>>({});
    const [qaAnswers, setQaAnswers] = useState<Record<string, Record<string, string>>>({});
    const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, Record<string, string>>>({});
    const [activeAudienceByTicket, setActiveAudienceByTicket] = useState<Record<string, AudienceId | null>>({});
    const [rewriteLoadingByTicket, setRewriteLoadingByTicket] = useState<Record<string, boolean>>({});
    const [rewriteErrorByTicket, setRewriteErrorByTicket] = useState<Record<string, string>>({});

    const [leftPanelRatio, setLeftPanelRatio] = useState(40);
    const [isNarrowLayout, setIsNarrowLayout] = useState(false);
    const [exportMode, setExportMode] = useState<ExportMode>('plain');
    const [includeAssigneeNames, setIncludeAssigneeNames] = useState(false);
    const [expandedSummaryByTicket, setExpandedSummaryByTicket] = useState<Record<string, boolean>>({});
    const [focusedRowKey, setFocusedRowKey] = useState<string | null>(null);

    const [aiRatingByTicket, setAiRatingByTicket] = useState<Record<string, DocAIRating>>({});
    const [aiRateAllLoading, setAiRateAllLoading] = useState(false);
    const [aiRateProgress, setAiRateProgress] = useState<{ processed: number; total: number; } | null>(null);

    const [drawerIssue, setDrawerIssue] = useState<JiraIssue | null>(null);
    const [generationSummary, setGenerationSummary] = useState<GenerationSummary | null>(null);
    const [pendingQaTicket, setPendingQaTicket] = useState<string | null>(null);

    const initialParamsApplied = useRef(false);
    const qaAutostarted = useRef(new Set<string>());
    const panelLayoutRef = useRef<HTMLDivElement | null>(null);
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const incompleteRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const fromDate = useMemo(() => toSafeDate(dateFrom), [dateFrom]);
    const toDate = useMemo(() => toSafeDate(dateTo), [dateTo]);
    const selectedTicketSet = useMemo(() => new Set(selectedDocTickets), [selectedDocTickets]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const updateLayout = () => {
            setIsNarrowLayout(window.innerWidth < 1180);
        };

        updateLayout();
        window.addEventListener('resize', updateLayout);
        return () => window.removeEventListener('resize', updateLayout);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const rawRatio = window.localStorage.getItem(PANEL_RATIO_STORAGE_KEY);
        const parsedRatio = Number(rawRatio);
        if (Number.isFinite(parsedRatio)) {
            setLeftPanelRatio(Math.max(25, Math.min(60, parsedRatio)));
        }

        const cachedRatings = parseCachedRatings(window.localStorage.getItem(AI_RATING_CACHE_KEY));
        if (Object.keys(cachedRatings).length > 0) {
            setAiRatingByTicket(cachedRatings);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(PANEL_RATIO_STORAGE_KEY, String(leftPanelRatio));
    }, [leftPanelRatio]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(AI_RATING_CACHE_KEY, JSON.stringify(aiRatingByTicket));
    }, [aiRatingByTicket]);

    useEffect(() => {
        if (initialParamsApplied.current) return;
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);

        const sortParam = params.get('sort');
        if (sortParam === 'doc_asc' || sortParam === 'doc_desc' || sortParam === 'ai_asc' || sortParam === 'ai_desc') {
            setSortBy(sortParam);
        }

        const filterParam = params.get('docFilter');
        if (filterParam === 'all' || filterParam === 'ready' || filterParam === 'needs_info' || filterParam === 'incomplete') {
            setScoreFilter(filterParam);
        }

        const ticketParam = params.get('ticket');
        const normalizedTicket = ticketParam?.trim().toUpperCase();
        if (normalizedTicket) {
            setSelectedDocTickets([normalizedTicket]);
            if (params.get('mode') === 'qa') {
                setPendingQaTicket(normalizedTicket);
            }
        }

        initialParamsApplied.current = true;
    }, [setSelectedDocTickets]);

    useEffect(() => {
        setAiRatingByTicket((current) => {
            const next = { ...current };
            let changed = false;
            for (const issue of issues) {
                if (!issue.docAiRating) continue;
                if (!next[issue.key]) {
                    next[issue.key] = issue.docAiRating;
                    changed = true;
                }
            }
            return changed ? next : current;
        });
    }, [issues]);

    const baseFilteredIssues = useMemo(() => {
        const query = search.trim().toLowerCase();

        return issues
            .filter((issue) => {
                if (query) {
                    const matchKey = issue.key.toLowerCase().includes(query);
                    const matchSummary = issue.summary.toLowerCase().includes(query);
                    if (!matchKey && !matchSummary) return false;
                }

                if (!matchesStatus(issue, statusFilter)) return false;
                if (!matchesType(issue, typeFilter)) return false;

                const createdAt = new Date(issue.created);
                if (Number.isNaN(createdAt.getTime())) return false;

                if (fromDate) {
                    const fromStart = new Date(fromDate);
                    fromStart.setHours(0, 0, 0, 0);
                    if (createdAt < fromStart) return false;
                }

                if (toDate) {
                    const toEnd = new Date(toDate);
                    toEnd.setHours(23, 59, 59, 999);
                    if (createdAt > toEnd) return false;
                }

                return true;
            });
    }, [issues, search, statusFilter, typeFilter, fromDate, toDate]);

    const filteredIssues = useMemo(() => {
        return baseFilteredIssues
            .filter((issue) => matchesScoreFilter(getTicketDocScore(issue).grade, scoreFilter))
            .sort((left, right) => {
                const leftReadiness = getTicketDocScore(left);
                const rightReadiness = getTicketDocScore(right);

                let diff = 0;
                if (sortBy === 'doc_desc') {
                    diff = rightReadiness.score - leftReadiness.score;
                } else if (sortBy === 'doc_asc') {
                    diff = leftReadiness.score - rightReadiness.score;
                } else {
                    const leftAi = getAiRatingSortValue(aiRatingByTicket[left.key] || left.docAiRating || null);
                    const rightAi = getAiRatingSortValue(aiRatingByTicket[right.key] || right.docAiRating || null);
                    diff = sortBy === 'ai_desc' ? rightAi - leftAi : leftAi - rightAi;
                }

                if (diff !== 0) return diff;
                return right.updated.localeCompare(left.updated);
            });
    }, [baseFilteredIssues, scoreFilter, sortBy, aiRatingByTicket]);

    const filteredKeys = useMemo(
        () => filteredIssues.map((issue) => issue.key),
        [filteredIssues]
    );

    const readyFilteredKeys = useMemo(
        () => baseFilteredIssues
            .filter((issue) => {
                const grade = getTicketDocScore(issue).grade;
                return grade === 'A' || grade === 'B';
            })
            .map((issue) => issue.key),
        [baseFilteredIssues]
    );

    const visibleRatableKeys = useMemo(
        () => filteredIssues
            .filter((issue) => getTicketDocScore(issue).score >= 40)
            .map((issue) => issue.key),
        [filteredIssues]
    );

    const canGenerate = selectedDocTickets.length > 0 && selectedDocAudiences.length > 0;

    const assigneeNamePatterns = useMemo(
        () => buildAssigneeNamePatterns(generatedDocs),
        [generatedDocs]
    );

    const audienceNoteCounts = useMemo(() => {
        const counts = Object.fromEntries(DOC_AUDIENCES.map((audience) => [audience.id, 0])) as Record<AudienceId, number>;
        const selectedSet = new Set(selectedDocTickets);
        const byTicket = new Map<string, GeneratedDocEntry>();

        for (const entry of generatedDocs) {
            if (!byTicket.has(entry.ticketKey)) {
                byTicket.set(entry.ticketKey, entry);
            }
        }

        for (const [ticketKey, entry] of byTicket.entries()) {
            if (!selectedSet.has(ticketKey)) continue;
            for (const audience of DOC_AUDIENCES) {
                if (entry.doc.audienceNotes[audience.id]?.trim()) {
                    counts[audience.id] += 1;
                }
            }
        }

        return counts;
    }, [generatedDocs, selectedDocTickets]);

    const runGeneration = useCallback(async (params: {
        ticketKeys: string[];
        audiences: AudienceId[];
        qaAnswers?: Record<string, Record<string, string>>;
    }) => {
        const response = await fetch('/api/docs/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to generate documentation.');
        }

        const data = payload as DocsGenerateResponse;
        return {
            generated: Array.isArray(data.generated) ? toLocalEntries(data.generated) : [],
            incomplete: Array.isArray(data.incomplete) ? data.incomplete : [],
            errors: Array.isArray(data.errors) ? data.errors : [],
        };
    }, []);

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const response = await fetch('/api/docs/generate', { cache: 'no-store' });
            if (!response.ok) return;
            const payload = await response.json();
            if (Array.isArray(payload)) {
                setHistory(toLocalEntries(payload as GeneratedDocEntry[]));
            }
        } catch {
            // non-critical
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    const handleSelectAllFiltered = () => {
        setSelectedDocTickets([...new Set([...selectedDocTickets, ...filteredKeys])]);
    };

    const handleSelectAllReady = () => {
        if (readyFilteredKeys.length === 0) return;
        setSelectedDocTickets([...new Set([...selectedDocTickets, ...readyFilteredKeys])]);
    };

    const setTicketLoading = (ticketKey: string, value: boolean) => {
        setTicketGenerating((current) => ({ ...current, [ticketKey]: value }));
    };

    const handleSingleTicketGenerate = useCallback(async (
        ticketKey: string,
        options?: {
            audiencesOverride?: AudienceId[];
            qaContext?: Record<string, string>;
            prepend?: boolean;
        }
    ) => {
        const audiences = options?.audiencesOverride && options.audiencesOverride.length > 0
            ? options.audiencesOverride
            : (selectedDocAudiences as AudienceId[]);

        if (audiences.length === 0) {
            setTicketErrors((current) => [
                ...current.filter((entry) => entry.ticketKey !== ticketKey),
                { ticketKey, error: 'Select at least one audience before generating.' },
            ]);
            return;
        }

        const mergedQaForTicket = {
            ...(qaAnswers[ticketKey] || {}),
            ...(options?.qaContext || {}),
        };

        if (Object.keys(mergedQaForTicket).length > 0) {
            setQaAnswers((current) => ({
                ...current,
                [ticketKey]: mergedQaForTicket,
            }));
        }

        setTicketLoading(ticketKey, true);
        setTicketErrors((current) => current.filter((entry) => entry.ticketKey !== ticketKey));

        try {
            const result = await runGeneration({
                ticketKeys: [ticketKey],
                audiences,
                qaAnswers: Object.keys(mergedQaForTicket).length > 0
                    ? { [ticketKey]: mergedQaForTicket }
                    : undefined,
            });

            if (result.generated.length > 0) {
                setGeneratedDocs((current) => {
                    if (options?.prepend) {
                        return prependUniqueDocs(current, result.generated);
                    }
                    return upsertDocs(current, result.generated);
                });

                setActiveAudienceByTicket((current) => ({
                    ...current,
                    [ticketKey]: current[ticketKey] || null,
                }));

                setIncompleteTickets((current) => current.filter((entry) => entry.ticketKey !== ticketKey));
            }

            if (result.incomplete.length > 0) {
                setIncompleteTickets((current) => {
                    const without = current.filter((entry) => entry.ticketKey !== ticketKey);
                    return [...result.incomplete, ...without];
                });
            }

            if (result.errors.length > 0) {
                setTicketErrors((current) => [
                    ...current.filter((entry) => entry.ticketKey !== ticketKey),
                    ...result.errors,
                ]);
            }

            await loadHistory();
        } catch (error) {
            setTicketErrors((current) => [
                ...current.filter((entry) => entry.ticketKey !== ticketKey),
                { ticketKey, error: String(error) },
            ]);
        } finally {
            setTicketLoading(ticketKey, false);
        }
    }, [selectedDocAudiences, qaAnswers, runGeneration, loadHistory]);

    useEffect(() => {
        if (!pendingQaTicket) return;
        if (qaAutostarted.current.has(pendingQaTicket)) return;

        const ticketExists = issues.some((issue) => issue.key === pendingQaTicket);
        if (!ticketExists) return;

        const audiences = selectedDocAudiences.length > 0
            ? (selectedDocAudiences as AudienceId[])
            : [DOC_AUDIENCES[0].id];

        if (selectedDocAudiences.length === 0) {
            setSelectedDocAudiences(audiences);
        }

        qaAutostarted.current.add(pendingQaTicket);
        void handleSingleTicketGenerate(pendingQaTicket, { audiencesOverride: audiences }).finally(() => {
            setPendingQaTicket(null);
        });
    }, [
        pendingQaTicket,
        issues,
        selectedDocAudiences,
        setSelectedDocAudiences,
        handleSingleTicketGenerate,
    ]);

    const handleGenerateAll = async () => {
        if (!canGenerate || generating) return;

        const ticketKeys = [...selectedDocTickets];
        const audiences = selectedDocAudiences as AudienceId[];
        const mode = generateMode;

        setGenerating(true);
        setGenerationSummary(null);
        setTicketErrors([]);

        if (mode === 'replace') {
            setGeneratedDocs([]);
            setIncompleteTickets([]);
        }

        setGeneratingPlaceholders(ticketKeys);

        const generatedKeys = new Set<string>();
        const clarificationKeys = new Set<string>();
        const lowQualityKeys = new Set<string>();

        await Promise.all(ticketKeys.map(async (ticketKey) => {
            try {
                const ticketQaAnswers = qaAnswers[ticketKey];
                const result = await runGeneration({
                    ticketKeys: [ticketKey],
                    audiences,
                    qaAnswers: ticketQaAnswers ? { [ticketKey]: ticketQaAnswers } : undefined,
                });

                if (result.generated.length > 0) {
                    for (const entry of result.generated) {
                        generatedKeys.add(entry.ticketKey);
                        if (entry.clarificationNeeded && entry.clarificationNeeded.length > 0) {
                            clarificationKeys.add(entry.ticketKey);
                        }
                        if (entry.completenessScore < 60) {
                            lowQualityKeys.add(entry.ticketKey);
                        }
                    }

                    setGeneratedDocs((current) => {
                        if (mode === 'add') {
                            return prependUniqueDocs(current, result.generated);
                        }
                        return upsertDocs(current, result.generated);
                    });

                    setActiveAudienceByTicket((current) => {
                        const next = { ...current };
                        for (const entry of result.generated) {
                            if (!(entry.ticketKey in next)) {
                                next[entry.ticketKey] = null;
                            }
                        }
                        return next;
                    });

                    setIncompleteTickets((current) => current.filter((entry) => entry.ticketKey !== ticketKey));
                }

                if (result.incomplete.length > 0) {
                    for (const entry of result.incomplete) {
                        lowQualityKeys.add(entry.ticketKey);
                    }

                    setIncompleteTickets((current) => {
                        const without = current.filter((entry) => entry.ticketKey !== ticketKey);
                        if (mode === 'add') {
                            return [...result.incomplete, ...without];
                        }
                        return [...without, ...result.incomplete];
                    });
                }

                if (result.errors.length > 0) {
                    setTicketErrors((current) => [
                        ...current.filter((entry) => entry.ticketKey !== ticketKey),
                        ...result.errors,
                    ]);
                } else {
                    setTicketErrors((current) => current.filter((entry) => entry.ticketKey !== ticketKey));
                }
            } catch (error) {
                setTicketErrors((current) => [
                    ...current.filter((entry) => entry.ticketKey !== ticketKey),
                    { ticketKey, error: String(error) },
                ]);
            } finally {
                setGeneratingPlaceholders((current) => current.filter((key) => key !== ticketKey));
            }
        }));

        setGenerationSummary({
            generatedCount: generatedKeys.size,
            clarificationCount: clarificationKeys.size,
            lowQualityCount: lowQualityKeys.size,
            generatedKeys: [...generatedKeys],
            clarificationKeys: [...clarificationKeys],
            lowQualityKeys: [...lowQualityKeys],
        });

        setGenerating(false);
        await loadHistory();
    };

    const handleAiRateAllVisible = async () => {
        if (visibleRatableKeys.length === 0 || aiRateAllLoading) return;

        setAiRateAllLoading(true);
        setAiRateProgress({ processed: 0, total: visibleRatableKeys.length });
        setTicketErrors((current) => current.filter((entry) => !entry.error.startsWith('AI rate:')));

        try {
            const response = await fetch('/api/docs/ai-rate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketKeys: visibleRatableKeys }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to AI-rate visible tickets.');
            }

            if (!response.body) {
                throw new Error('AI rating stream was not returned by the server.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let donePayload: AiRateStreamDone | null = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    try {
                        const payload = JSON.parse(trimmed) as AiRateStreamProgress | AiRateStreamDone;
                        if (payload.type === 'progress') {
                            setAiRateProgress({ processed: payload.processed, total: payload.total });
                        } else if (payload.type === 'done') {
                            donePayload = payload;
                        }
                    } catch {
                        // ignore malformed stream line
                    }
                }
            }

            if (donePayload) {
                const ratedEntries: Record<string, DocAIRating> = {};
                const aiErrors: TicketGenerationError[] = [];

                for (const result of donePayload.results) {
                    if (result.rating) {
                        ratedEntries[result.ticketKey] = result.rating;
                    } else if (result.error) {
                        aiErrors.push({
                            ticketKey: result.ticketKey,
                            error: `AI rate: ${result.error}`,
                        });
                    }
                }

                if (Object.keys(ratedEntries).length > 0) {
                    setAiRatingByTicket((current) => ({ ...current, ...ratedEntries }));
                }

                if (aiErrors.length > 0) {
                    setTicketErrors((current) => [
                        ...current.filter((entry) => !aiErrors.some((error) => error.ticketKey === entry.ticketKey && entry.error.startsWith('AI rate:'))),
                        ...aiErrors,
                    ]);
                }
            }
        } catch (error) {
            setTicketErrors((current) => [
                ...current,
                { ticketKey: 'AI-RATE', error: `AI rate: ${String(error)}` },
            ]);
        } finally {
            setAiRateAllLoading(false);
            setAiRateProgress(null);
        }
    };

    const updateQaAnswer = (ticketKey: string, questionId: string, value: string) => {
        setQaAnswers((current) => ({
            ...current,
            [ticketKey]: {
                ...(current[ticketKey] || {}),
                [questionId]: value,
            },
        }));
    };

    const updateClarificationAnswer = (ticketKey: string, index: number, value: string) => {
        setClarificationAnswers((current) => ({
            ...current,
            [ticketKey]: {
                ...(current[ticketKey] || {}),
                [String(index)]: value,
            },
        }));
    };

    const handleRewriteCard = async (card: GeneratedDocEntry) => {
        const activeAudience = activeAudienceByTicket[card.ticketKey] || null;
        if (!activeAudience) return;

        setRewriteLoadingByTicket((current) => ({ ...current, [card.ticketKey]: true }));
        setRewriteErrorByTicket((current) => {
            const next = { ...current };
            delete next[card.ticketKey];
            return next;
        });

        try {
            const response = await fetch('/api/docs/rewrite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketKey: card.ticketKey,
                    audience: activeAudience,
                    original: {
                        summary: card.doc.summary,
                        shortDescription: card.doc.shortDescription,
                        howToUse: card.doc.howToUse,
                        impact: card.doc.impact,
                    },
                    audienceNote: card.doc.audienceNotes[activeAudience] || null,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to rewrite card.');
            }

            const data = payload as RewriteResponse;
            if (!data.ok || !data.doc) {
                throw new Error(data.error || 'Rewrite response was invalid.');
            }

            setGeneratedDocs((current) => current.map((entry) => {
                if (entry.ticketKey !== card.ticketKey) return entry;
                return {
                    ...entry,
                    rewrites: {
                        ...(entry.rewrites || {}),
                        [activeAudience]: data.doc,
                    },
                };
            }));
        } catch (error) {
            setRewriteErrorByTicket((current) => ({
                ...current,
                [card.ticketKey]: String(error),
            }));
        } finally {
            setRewriteLoadingByTicket((current) => ({ ...current, [card.ticketKey]: false }));
        }
    };

    const dismissClarificationQuestions = (ticketKey: string) => {
        setGeneratedDocs((current) => current.map((entry) => {
            if (entry.ticketKey !== ticketKey) return entry;
            return {
                ...entry,
                clarificationNeeded: null,
            };
        }));
    };

    const refineWithClarificationAnswers = async (card: GeneratedDocEntry) => {
        const answers = clarificationAnswers[card.ticketKey] || {};
        const qaContext: Record<string, string> = {};

        (card.clarificationNeeded || []).forEach((question, index) => {
            const value = answers[String(index)]?.trim();
            if (!value) return;
            qaContext[`clarification_${index + 1}`] = `${question}\nAnswer: ${value}`;
        });

        if (Object.keys(qaContext).length === 0) return;

        await handleSingleTicketGenerate(card.ticketKey, {
            audiencesOverride: card.audiences,
            qaContext,
        });
    };

    const copyCard = async (card: GeneratedDocEntry) => {
        const activeAudience = activeAudienceByTicket[card.ticketKey] || null;
        const docOverride = activeAudience ? card.rewrites?.[activeAudience] : undefined;
        const text = formatCardPlainText(card, {
            includeAssigneeNames,
            namePatterns: assigneeNamePatterns,
        }, docOverride);
        await navigator.clipboard.writeText(text);
    };

    const exportAll = async () => {
        if (generatedDocs.length === 0) return;

        const options = {
            includeAssigneeNames,
            namePatterns: assigneeNamePatterns,
        };

        const plainText = generatedDocs.map((doc) => formatCardPlainText(doc, options)).join('\n\n');

        if (exportMode === 'download') {
            const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            const now = new Date();
            const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            anchor.href = url;
            anchor.download = `ticket-documentation-${stamp}.txt`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            return;
        }

        if (exportMode === 'plain') {
            await navigator.clipboard.writeText(plainText);
            return;
        }

        if (exportMode === 'confluence') {
            const content = generatedDocs.map((doc) => formatCardConfluence(doc, options)).join('\n\n----\n\n');
            await navigator.clipboard.writeText(content);
            return;
        }

        const notionContent = generatedDocs.map((doc) => formatCardNotion(doc, options)).join('\n\n---\n\n');
        await navigator.clipboard.writeText(notionContent);
    };

    const viewHistoryDoc = (entry: GeneratedDocEntry) => {
        const hydrated = toLocalEntries([entry]);
        setGeneratedDocs((current) => prependUniqueDocs(current, hydrated));
        setActiveAudienceByTicket((current) => ({
            ...current,
            [entry.ticketKey]: current[entry.ticketKey] || null,
        }));
    };

    const startResize = (event: React.MouseEvent<HTMLDivElement>) => {
        if (isNarrowLayout) return;

        event.preventDefault();
        const move = (moveEvent: MouseEvent) => {
            const bounds = panelLayoutRef.current?.getBoundingClientRect();
            if (!bounds || bounds.width <= 0) return;

            const rawRatio = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
            const clamped = Math.max(25, Math.min(60, rawRatio));
            setLeftPanelRatio(clamped);
        };

        const stop = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', stop);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', stop);
    };

    const toggleSummaryRow = (ticketKey: string) => {
        setExpandedSummaryByTicket((current) => ({
            ...current,
            [ticketKey]: !current[ticketKey],
        }));
    };

    const scrollToTicket = (ticketKey: string) => {
        const cardNode = cardRefs.current[ticketKey];
        if (cardNode) {
            cardNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        const incompleteNode = incompleteRefs.current[ticketKey];
        if (incompleteNode) {
            incompleteNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const clearAllCards = () => {
        setGeneratedDocs([]);
        setIncompleteTickets([]);
        setTicketErrors([]);
        setGenerationSummary(null);
        setGeneratingPlaceholders([]);
    };

    const removeCard = (ticketKey: string) => {
        setGeneratedDocs((current) => current.filter((entry) => entry.ticketKey !== ticketKey));
    };

    const activeDocs = generatedDocs.length > 0;

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">📝 Ticket Documentation Generator</h1>
                    <p className="page-subtitle">
                        Generate internal ticket documentation with audience-specific notes
                    </p>
                </div>
            </div>

            <div style={{ padding: '24px 32px' }}>
                <div
                    ref={panelLayoutRef}
                    style={{
                        display: 'flex',
                        gap: isNarrowLayout ? 16 : 0,
                        flexDirection: isNarrowLayout ? 'column' : 'row',
                        alignItems: 'stretch',
                    }}
                >
                    <div
                        className="card"
                        style={{
                            flex: isNarrowLayout ? '1 1 auto' : `0 0 ${leftPanelRatio}%`,
                            minWidth: isNarrowLayout ? 0 : 340,
                            maxWidth: isNarrowLayout ? '100%' : `${leftPanelRatio}%`,
                        }}
                    >
                        <div className="chart-title" style={{ marginBottom: 12 }}>Ticket Selector</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <input
                                className="input"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search tickets by key or summary..."
                            />

                            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Date range</label>
                                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                                        <input
                                            className="input"
                                            type="date"
                                            value={dateFrom}
                                            onChange={(event) => setDateFrom(event.target.value)}
                                        />
                                        <input
                                            className="input"
                                            type="date"
                                            value={dateTo}
                                            onChange={(event) => setDateTo(event.target.value)}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Status</label>
                                    <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                                        <option value="all">All</option>
                                        <option value="done">Done</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="any">Any</option>
                                    </select>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Type</label>
                                    <select className="input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}>
                                        <option value="all">All</option>
                                        <option value="bug">Bug</option>
                                        <option value="feature">Feature</option>
                                        <option value="task">Task</option>
                                    </select>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sort</label>
                                    <select className="input" value={sortBy} onChange={(event) => setSortBy(event.target.value as DocsSort)}>
                                        <option value="doc_desc">Doc Score ↓</option>
                                        <option value="doc_asc">Doc Score ↑</option>
                                        <option value="ai_desc">AI Rating ↓</option>
                                        <option value="ai_asc">AI Rating ↑</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => setScoreFilter('all')}
                                    style={{
                                        border: scoreFilter === 'all' ? '1px solid rgba(59,130,246,0.6)' : '1px solid var(--border)',
                                        background: scoreFilter === 'all' ? 'rgba(59,130,246,0.16)' : 'rgba(255,255,255,0.02)',
                                        color: scoreFilter === 'all' ? '#93c5fd' : 'var(--text-secondary)',
                                    }}
                                >
                                    All
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => setScoreFilter('ready')}
                                    style={{
                                        border: scoreFilter === 'ready' ? '1px solid rgba(34,197,94,0.6)' : '1px solid var(--border)',
                                        background: scoreFilter === 'ready' ? 'rgba(34,197,94,0.16)' : 'rgba(255,255,255,0.02)',
                                        color: scoreFilter === 'ready' ? '#86efac' : 'var(--text-secondary)',
                                    }}
                                >
                                    Ready (A+B)
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => setScoreFilter('needs_info')}
                                    style={{
                                        border: scoreFilter === 'needs_info' ? '1px solid rgba(245,158,11,0.6)' : '1px solid var(--border)',
                                        background: scoreFilter === 'needs_info' ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.02)',
                                        color: scoreFilter === 'needs_info' ? '#fcd34d' : 'var(--text-secondary)',
                                    }}
                                >
                                    Needs Info (C)
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => setScoreFilter('incomplete')}
                                    style={{
                                        border: scoreFilter === 'incomplete' ? '1px solid rgba(239,68,68,0.6)' : '1px solid var(--border)',
                                        background: scoreFilter === 'incomplete' ? 'rgba(239,68,68,0.16)' : 'rgba(255,255,255,0.02)',
                                        color: scoreFilter === 'incomplete' ? '#fca5a5' : 'var(--text-secondary)',
                                    }}
                                >
                                    Incomplete (D)
                                </button>
                            </div>

                            {scoreFilter === 'all' && (
                                <div
                                    style={{
                                        fontSize: 12,
                                        border: '1px solid rgba(245,158,11,0.35)',
                                        background: 'rgba(245,158,11,0.08)',
                                        color: '#fcd34d',
                                        borderRadius: 8,
                                        padding: '8px 10px',
                                    }}
                                >
                                    💡 Tip: Filter to &#39;Ready&#39; tickets for the best documentation results. C and D grade tickets will trigger the Q&amp;A flow.
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <button className="btn btn-secondary btn-sm" onClick={handleSelectAllFiltered} disabled={filteredIssues.length === 0}>
                                    Select All Filtered
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={handleSelectAllReady} disabled={readyFilteredKeys.length === 0}>
                                    ✓ Select All Ready (A+B)
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => void handleAiRateAllVisible()}
                                    disabled={visibleRatableKeys.length === 0 || aiRateAllLoading}
                                    title="Rate all visible tickets with AI in one batch"
                                >
                                    {aiRateAllLoading ? '🤖 Rating…' : '🤖 AI Rate All Visible'}
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={clearDocTicketSelection} disabled={selectedDocTickets.length === 0}>
                                    Clear Selection
                                </button>
                            </div>

                            {aiRateProgress && (
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    Rating {aiRateProgress.processed} / {aiRateProgress.total} tickets...
                                </div>
                            )}

                            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                                <div style={{ maxHeight: 430, overflowY: 'auto', overflowX: 'auto' }}>
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '20px minmax(82px,auto) minmax(220px,1fr) minmax(100px,auto) minmax(94px,auto) minmax(120px,auto) minmax(120px,auto) minmax(54px,auto) minmax(80px,auto)',
                                            gap: 8,
                                            padding: '8px 12px',
                                            borderBottom: '1px solid var(--border)',
                                            background: 'var(--bg-elevated)',
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.4,
                                            position: 'sticky',
                                            top: 0,
                                            zIndex: 1,
                                            minWidth: 980,
                                        }}
                                    >
                                        <span />
                                        <span>Key</span>
                                        <span>Summary</span>
                                        <span>Status</span>
                                        <span>Type</span>
                                        <span>📋 Doc Score</span>
                                        <span>Assignee</span>
                                        <span>Age</span>
                                        <span>AI</span>
                                    </div>

                                    {filteredIssues.length > 0 ? filteredIssues.map((issue) => {
                                        const checked = selectedTicketSet.has(issue.key);
                                        const statusBadgeStyle = getStatusBadgeStyle(issue.status);
                                        const readiness = getTicketDocScore(issue);
                                        const badgeStyle = getDocBadgeStyle(readiness.grade);
                                        const typeMeta = getIssueTypeMeta(issue.issueType);
                                        const rating = aiRatingByTicket[issue.key] || issue.docAiRating || null;
                                        const expanded = Boolean(expandedSummaryByTicket[issue.key]);
                                        const isFocused = focusedRowKey === issue.key;

                                        return (
                                            <div
                                                key={issue.key}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '20px minmax(82px,auto) minmax(220px,1fr) minmax(100px,auto) minmax(94px,auto) minmax(120px,auto) minmax(120px,auto) minmax(54px,auto) minmax(80px,auto)',
                                                    alignItems: expanded ? 'flex-start' : 'center',
                                                    gap: 8,
                                                    padding: '10px 12px',
                                                    borderBottom: '1px solid var(--border)',
                                                    background: checked ? 'rgba(16,185,129,0.08)' : 'transparent',
                                                    cursor: 'pointer',
                                                    minWidth: 980,
                                                    outline: isFocused ? '1px solid rgba(59,130,246,0.5)' : 'none',
                                                    outlineOffset: -1,
                                                }}
                                                onClick={() => toggleDocTicket(issue.key)}
                                                tabIndex={0}
                                                onFocus={() => setFocusedRowKey(issue.key)}
                                                onBlur={() => setFocusedRowKey((current) => (current === issue.key ? null : current))}
                                                onKeyDown={(event) => {
                                                    if (event.key === ' ') {
                                                        event.preventDefault();
                                                        toggleDocTicket(issue.key);
                                                    }
                                                    if (event.key === 'Enter') {
                                                        event.preventDefault();
                                                        setDrawerIssue(issue);
                                                    }
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onClick={(event) => event.stopPropagation()}
                                                    onChange={() => toggleDocTicket(issue.key)}
                                                />

                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setDrawerIssue(issue);
                                                    }}
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color: '#4C9AFF',
                                                        fontFamily: 'monospace',
                                                        textDecoration: 'none',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        padding: 0,
                                                        textAlign: 'left',
                                                        cursor: 'pointer',
                                                    }}
                                                    title="Open ticket preview"
                                                >
                                                    {issue.key}
                                                </button>

                                                <div style={{ display: 'flex', alignItems: expanded ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 8 }}>
                                                    <span
                                                        style={{
                                                            fontSize: 12,
                                                            color: 'var(--text-primary)',
                                                            lineHeight: 1.35,
                                                            whiteSpace: expanded ? 'normal' : 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                        }}
                                                    >
                                                        {expanded ? issue.summary : truncateSummary(issue.summary)}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            toggleSummaryRow(issue.key);
                                                        }}
                                                        title={expanded ? 'Collapse summary' : 'Expand summary'}
                                                        style={{ padding: '2px 6px', lineHeight: 1, flexShrink: 0 }}
                                                    >
                                                        {expanded ? '▾' : '▸'}
                                                    </button>
                                                </div>

                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        borderRadius: 999,
                                                        padding: '2px 8px',
                                                        textAlign: 'center',
                                                        ...statusBadgeStyle,
                                                    }}
                                                >
                                                    {issue.status}
                                                </span>

                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        borderRadius: 999,
                                                        padding: '2px 8px',
                                                        textAlign: 'center',
                                                        ...typeMeta.style,
                                                    }}
                                                >
                                                    {typeMeta.emoji} {typeMeta.label}
                                                </span>

                                                <span
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        borderRadius: 999,
                                                        padding: '2px 8px',
                                                        textAlign: 'center',
                                                        ...badgeStyle,
                                                    }}
                                                    title={getDocTooltip(issue)}
                                                >
                                                    [{readiness.grade}]
                                                </span>

                                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                                    {issue.assignee?.displayName || 'Unassigned'}
                                                </span>

                                                <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                                                    {issue.age}d
                                                </span>

                                                <span
                                                    style={{
                                                        fontSize: 14,
                                                        color: rating ? '#fbbf24' : 'var(--text-muted)',
                                                        whiteSpace: 'nowrap',
                                                        justifySelf: 'end',
                                                        fontWeight: 700,
                                                        letterSpacing: 1,
                                                    }}
                                                    title={getAiRatingTooltip(rating)}
                                                >
                                                    {rating ? `${renderStars(rating)} (${Math.round(rating.overallScore)}/5)` : '—'}
                                                </span>
                                            </div>
                                        );
                                    }) : (
                                        <div style={{ padding: 14, fontSize: 12, color: 'var(--text-muted)' }}>
                                            {isLoading ? 'Loading tickets...' : 'No tickets match the current filters.'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {selectedDocTickets.length} tickets selected
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    Select one or more targets:
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {DOC_AUDIENCES.map((audience) => {
                                        const selected = selectedDocAudiences.includes(audience.id);
                                        return (
                                            <button
                                                key={audience.id}
                                                type="button"
                                                onClick={() => toggleDocAudience(audience.id)}
                                                className="btn btn-sm"
                                                style={{
                                                    border: selected ? '1px solid rgba(16,185,129,0.65)' : '1px solid var(--border)',
                                                    background: selected ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.02)',
                                                    color: selected ? '#6ee7b7' : 'var(--text-secondary)',
                                                }}
                                            >
                                                <span>{selected ? '[x]' : '[ ]'}</span>
                                                <span>{audience.label} ({audienceNoteCounts[audience.id] || 0})</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Mode:</span>
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => setGenerateMode('replace')}
                                    style={{
                                        border: generateMode === 'replace' ? '1px solid rgba(59,130,246,0.6)' : '1px solid var(--border)',
                                        background: generateMode === 'replace' ? 'rgba(59,130,246,0.16)' : 'rgba(255,255,255,0.02)',
                                        color: generateMode === 'replace' ? '#93c5fd' : 'var(--text-secondary)',
                                    }}
                                >
                                    Replace
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => setGenerateMode('add')}
                                    style={{
                                        border: generateMode === 'add' ? '1px solid rgba(16,185,129,0.65)' : '1px solid var(--border)',
                                        background: generateMode === 'add' ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.02)',
                                        color: generateMode === 'add' ? '#6ee7b7' : 'var(--text-secondary)',
                                    }}
                                >
                                    Add
                                </button>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {generateMode === 'replace' ? 'Mode: Replace existing' : 'Mode: Add to existing'}
                                </span>
                            </div>

                            <button
                                type="button"
                                className="btn"
                                onClick={() => void handleGenerateAll()}
                                disabled={!canGenerate || generating}
                                title={canGenerate ? 'Generate documentation for selected tickets' : 'Select at least one ticket and one audience'}
                                style={{
                                    alignSelf: 'flex-start',
                                    background: canGenerate ? '#16a34a' : 'rgba(148,163,184,0.2)',
                                    border: canGenerate ? '1px solid #22c55e' : '1px solid var(--border)',
                                    color: canGenerate ? '#ecfdf5' : 'var(--text-muted)',
                                    cursor: canGenerate ? 'pointer' : 'not-allowed',
                                    opacity: generating ? 0.8 : 1,
                                }}
                            >
                                {generating ? 'Generating…' : 'Generate Documentation →'}
                            </button>

                            {!canGenerate && selectedDocTickets.length > 0 && selectedDocAudiences.length === 0 && (
                                <div style={{ fontSize: 11, color: '#fbbf24' }}>
                                    Select at least one audience to enable generation.
                                </div>
                            )}

                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Space to select · Enter to preview
                            </div>
                        </div>
                    </div>

                    {!isNarrowLayout && (
                        <div
                            onMouseDown={startResize}
                            title="Drag to resize panels"
                            style={{
                                width: 12,
                                cursor: 'col-resize',
                                display: 'flex',
                                alignItems: 'stretch',
                                justifyContent: 'center',
                                padding: '0 2px',
                            }}
                        >
                            <div
                                style={{
                                    width: 2,
                                    borderRadius: 999,
                                    background: 'rgba(148,163,184,0.35)',
                                    position: 'relative',
                                }}
                            >
                                <span
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        fontSize: 10,
                                        color: 'var(--text-muted)',
                                        userSelect: 'none',
                                    }}
                                >
                                    ↔
                                </span>
                            </div>
                        </div>
                    )}

                    <div
                        className="card"
                        style={{
                            flex: isNarrowLayout ? '1 1 auto' : `0 0 ${100 - leftPanelRatio}%`,
                            minWidth: isNarrowLayout ? 0 : 360,
                            maxWidth: isNarrowLayout ? '100%' : `${100 - leftPanelRatio}%`,
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                            <div className="chart-title" style={{ marginBottom: 0 }}>Generated Documentation Preview</div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                {activeDocs && (
                                    <>
                                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Export All Documentation</span>
                                        <select
                                            className="input"
                                            style={{ maxWidth: 230 }}
                                            value={exportMode}
                                            onChange={(event) => setExportMode(event.target.value as ExportMode)}
                                        >
                                            <option value="plain">Copy All as Plain Text</option>
                                            <option value="confluence">Copy for Confluence</option>
                                            <option value="notion">Copy for Notion</option>
                                            <option value="download">Download as .txt</option>
                                        </select>
                                        <button className="btn btn-secondary btn-sm" onClick={() => void exportAll()}>
                                            Export
                                        </button>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                                            <input
                                                type="checkbox"
                                                checked={includeAssigneeNames}
                                                onChange={(event) => setIncludeAssigneeNames(event.target.checked)}
                                            />
                                            Include assignee names
                                        </label>
                                    </>
                                )}
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={clearAllCards}
                                    disabled={generatedDocs.length === 0 && incompleteTickets.length === 0 && ticketErrors.length === 0}
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>

                        {generationSummary && (
                            <div
                                style={{
                                    border: '1px solid var(--border)',
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    marginBottom: 14,
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 8,
                                    alignItems: 'center',
                                    background: 'rgba(255,255,255,0.02)',
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        const key = generationSummary.generatedKeys[0];
                                        if (key) scrollToTicket(key);
                                    }}
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: '#86efac' }}
                                >
                                    ✅ Generated docs for {generationSummary.generatedCount} ticket{generationSummary.generatedCount === 1 ? '' : 's'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const key = generationSummary.clarificationKeys[0];
                                        if (key) scrollToTicket(key);
                                    }}
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: '#fcd34d' }}
                                >
                                    🤔 {generationSummary.clarificationCount} ticket{generationSummary.clarificationCount === 1 ? '' : 's'} have AI questions
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const key = generationSummary.lowQualityKeys[0];
                                        if (key) scrollToTicket(key);
                                    }}
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: '#fca5a5' }}
                                >
                                    ⚠️ {generationSummary.lowQualityCount} ticket{generationSummary.lowQualityCount === 1 ? '' : 's'} had low data quality
                                </button>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {generatingPlaceholders.map((ticketKey) => (
                                <div
                                    key={`skeleton-${ticketKey}`}
                                    style={{
                                        border: '1px solid rgba(148,163,184,0.35)',
                                        borderRadius: 10,
                                        padding: 14,
                                        background: 'rgba(148,163,184,0.06)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                                        <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 999, border: '2px solid rgba(148,163,184,0.35)', borderTopColor: '#93c5fd', animation: 'spin 1s linear infinite' }} />
                                        ⏳ Generating docs for {ticketKey}...
                                    </div>
                                    <div style={{ marginTop: 10, height: 8, borderRadius: 8, background: 'rgba(148,163,184,0.2)' }} />
                                    <div style={{ marginTop: 8, height: 8, width: '80%', borderRadius: 8, background: 'rgba(148,163,184,0.2)' }} />
                                </div>
                            ))}

                            {incompleteTickets.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>
                                        Tickets Needing PM Input Before Generation
                                    </div>
                                    {incompleteTickets.map((entry) => (
                                        <div
                                            key={`incomplete-${entry.ticketKey}`}
                                            ref={(node) => {
                                                incompleteRefs.current[entry.ticketKey] = node;
                                            }}
                                            style={{ border: '1px solid rgba(251,191,36,0.35)', borderRadius: 10, padding: 12 }}
                                        >
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {entry.ticket.key} — {entry.ticket.summary}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                                                Completeness score: {entry.completenessScore}/100
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                                                {entry.questions.map((question) => (
                                                    <div key={`${entry.ticketKey}-${question.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                            {question.question}
                                                        </label>
                                                        <textarea
                                                            className="input"
                                                            rows={3}
                                                            value={qaAnswers[entry.ticketKey]?.[question.id] || ''}
                                                            onChange={(event) => updateQaAnswer(entry.ticketKey, question.id, event.target.value)}
                                                            placeholder="Add your answer..."
                                                            style={{ resize: 'vertical' }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>

                                            <div style={{ marginTop: 10 }}>
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => void handleSingleTicketGenerate(entry.ticketKey)}
                                                    disabled={Boolean(ticketGenerating[entry.ticketKey]) || selectedDocAudiences.length === 0}
                                                >
                                                    {ticketGenerating[entry.ticketKey] ? 'Generating…' : 'Complete & Generate'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {ticketErrors.length > 0 && (
                                <div style={{ border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, padding: 12 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fca5a5', marginBottom: 8 }}>Generation Errors</div>
                                    {ticketErrors.map((entry, index) => (
                                        <div key={`error-${entry.ticketKey}-${index}`} style={{ fontSize: 12, color: '#fecaca', marginBottom: 4 }}>
                                            {entry.ticketKey}: {entry.error}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {generatedDocs.map((card) => {
                                const activeAudience = activeAudienceByTicket[card.ticketKey] || null;
                                const statusStyle = getStatusBadgeStyle(card.ticket.status);
                                const typeMeta = getIssueTypeMeta(card.ticket.type);
                                const activeAudienceNote = activeAudience ? card.doc.audienceNotes[activeAudience] : null;
                                const activeRewrite = activeAudience ? card.rewrites?.[activeAudience] : undefined;
                                const displayDoc = activeRewrite || card.doc;

                                return (
                                    <div
                                        key={`doc-${card.ticketKey}`}
                                        ref={(node) => {
                                            cardRefs.current[card.ticketKey] = node;
                                        }}
                                        style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}
                                    >
                                        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                                                        {card.ticket.key} — {card.ticket.summary}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                                                        <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 8px', ...statusStyle }}>
                                                            {card.ticket.status}
                                                        </span>
                                                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', ...typeMeta.style }}>
                                                            {typeMeta.emoji} {typeMeta.label}
                                                        </span>
                                                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{card.ticket.assignee || 'Unassigned'}</span>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => void copyCard(card)}>
                                                        Copy this card
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => void handleSingleTicketGenerate(card.ticketKey, { audiencesOverride: card.audiences })}
                                                        disabled={Boolean(ticketGenerating[card.ticketKey])}
                                                    >
                                                        {ticketGenerating[card.ticketKey] ? 'Regenerating…' : 'Regenerate'}
                                                    </button>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => removeCard(card.ticketKey)}
                                                        title="Remove card from preview"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {activeAudience && activeRewrite && (
                                                <div style={{ fontSize: 12, color: '#93c5fd' }}>
                                                    ✏️ Viewing {AUDIENCE_BY_ID[activeAudience].shortLabel} version —{' '}
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveAudienceByTicket((current) => ({ ...current, [card.ticketKey]: null }))}
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: '#93c5fd',
                                                            textDecoration: 'underline',
                                                            cursor: 'pointer',
                                                            padding: 0,
                                                        }}
                                                    >
                                                        Reset to original
                                                    </button>
                                                </div>
                                            )}

                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>📋 Summary</div>
                                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{normalizeText(displayDoc.summary)}</div>
                                            </div>

                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>📝 Short Description</div>
                                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{normalizeText(displayDoc.shortDescription)}</div>
                                            </div>

                                            {displayDoc.howToUse && (
                                                <div>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>🔧 How to Use / What Changed</div>
                                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{normalizeText(displayDoc.howToUse)}</div>
                                                </div>
                                            )}

                                            {displayDoc.impact && (
                                                <div>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>💡 Impact</div>
                                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{normalizeText(displayDoc.impact)}</div>
                                                </div>
                                            )}
                                        </div>

                                        {card.clarificationNeeded && card.clarificationNeeded.length > 0 && (
                                            <div style={{ borderTop: '1px solid rgba(251,191,36,0.35)', padding: 12, background: 'rgba(245,158,11,0.08)' }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#fcd34d', marginBottom: 8 }}>
                                                    🤔 The AI has questions that could improve this doc:
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    {card.clarificationNeeded.map((question, index) => (
                                                        <div key={`${card.ticketKey}-clarification-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{question}</label>
                                                            <input
                                                                className="input"
                                                                value={clarificationAnswers[card.ticketKey]?.[String(index)] || ''}
                                                                onChange={(event) => updateClarificationAnswer(card.ticketKey, index, event.target.value)}
                                                                placeholder="Add clarification..."
                                                            />
                                                        </div>
                                                    ))}
                                                </div>

                                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => void refineWithClarificationAnswers(card)}
                                                        disabled={Boolean(ticketGenerating[card.ticketKey])}
                                                    >
                                                        {ticketGenerating[card.ticketKey] ? 'Refining…' : 'Refine with Answers →'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => dismissClarificationQuestions(card.ticketKey)}
                                                    >
                                                        Skip — looks good
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {card.audiences.length > 0 && (
                                            <div style={{ borderTop: '1px solid var(--border)', padding: 12 }}>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                                    {card.audiences.map((audience) => {
                                                        const selected = audience === activeAudience;
                                                        return (
                                                            <button
                                                                key={`${card.ticketKey}-${audience}`}
                                                                type="button"
                                                                className="btn btn-sm"
                                                                onClick={() => setActiveAudienceByTicket((current) => ({
                                                                    ...current,
                                                                    [card.ticketKey]: current[card.ticketKey] === audience ? null : audience,
                                                                }))}
                                                                style={{
                                                                    border: selected ? '1px solid rgba(16,185,129,0.65)' : '1px solid var(--border)',
                                                                    background: selected ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.02)',
                                                                    color: selected ? '#6ee7b7' : 'var(--text-secondary)',
                                                                }}
                                                            >
                                                                {AUDIENCE_BY_ID[audience].shortLabel}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => void handleRewriteCard(card)}
                                                        disabled={!activeAudience || Boolean(rewriteLoadingByTicket[card.ticketKey])}
                                                    >
                                                        {rewriteLoadingByTicket[card.ticketKey]
                                                            ? 'Rewriting…'
                                                            : `Rewrite for ${activeAudience ? AUDIENCE_BY_ID[activeAudience].shortLabel : 'Audience'}`}
                                                    </button>
                                                    {rewriteErrorByTicket[card.ticketKey] && (
                                                        <span style={{ fontSize: 11, color: '#fca5a5' }}>{rewriteErrorByTicket[card.ticketKey]}</span>
                                                    )}
                                                </div>

                                                {activeAudience ? (
                                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                        {normalizeText(activeAudienceNote || null)}
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                        Select an audience tab to preview audience notes and rewrite options.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {!activeDocs && generatingPlaceholders.length === 0 && incompleteTickets.length === 0 && ticketErrors.length === 0 && (
                                <div
                                    style={{
                                        minHeight: 640,
                                        border: '1px dashed var(--border)',
                                        borderRadius: 10,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 20,
                                        textAlign: 'center',
                                    }}
                                >
                                    <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 440 }}>
                                        Select tickets on the left and click
                                        <br />
                                        Generate Documentation to create internal docs.
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', marginTop: 18, paddingTop: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                                Documentation History
                            </div>

                            {historyLoading ? (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading history...</div>
                            ) : history.length === 0 ? (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No previous documentation generated yet.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                                    {history.map((entry) => (
                                        <div
                                            key={`history-${entry.id}`}
                                            style={{
                                                border: '1px solid var(--border)',
                                                borderRadius: 8,
                                                padding: '8px 10px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: 8,
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                                                    {entry.ticketKey}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    {new Date(entry.generatedAt).toLocaleString()}
                                                </div>
                                            </div>
                                            <button className="btn btn-ghost btn-sm" onClick={() => viewHistoryDoc(entry)}>
                                                View
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {drawerIssue && (
                <IssueDrawer issue={drawerIssue} onClose={() => setDrawerIssue(null)} />
            )}

            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
