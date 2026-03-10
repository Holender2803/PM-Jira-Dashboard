'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Slide from '@/components/slideshow/Slide';
import {
    calculateWorkMixMetrics,
    calculateWorkflowMetrics,
    getCycleLeadTimeDistribution,
    getReopenRates,
} from '@/lib/analytics';
import type { TeamConfig } from '@/lib/team-config';
import { formatEpicLabelFromParts } from '@/lib/issue-format';
import { resolveWorkflowGroup } from '@/lib/statusGroups';
import { CLOSED_STATUSES } from '@/lib/workflow';
import { useAppStore, useFilteredIssues } from '@/store/app-store';
import type { AIReportTone, Sprint } from '@/types';

type AudienceOption = '👥 Team Standup' | '👔 Executive Review' | '🤝 Client Update';
type StatusReportAudience = 'team' | 'executive' | 'client';
type ReportModalPhase = 'setup' | 'result';

interface StatusReportResponse {
    id: string;
    generatedAt: string;
    audience: StatusReportAudience;
    sprintName: string;
    content: string;
    isAuto: boolean;
}

interface EpicSlideRow {
    key: string;
    label: string;
    active: number;
    done: number;
    total: number;
    progressPct: number;
}

interface AssigneeLoadRow {
    key: string;
    name: string;
    initial: string;
    ticketCount: number;
    storyPoints: number;
}

interface SlideDefinition {
    slideNumber: number;
    title: string;
    accentColor: string;
    canRegenerate: boolean;
    content: ReactNode;
}

const AUDIENCE_OPTIONS: AudienceOption[] = [
    '👥 Team Standup',
    '👔 Executive Review',
    '🤝 Client Update',
];

const AUDIENCE_MODAL_OPTIONS: Array<{ value: AudienceOption; label: string }> = [
    { value: '👥 Team Standup', label: '👥 Team' },
    { value: '👔 Executive Review', label: '👔 Executive' },
    { value: '🤝 Client Update', label: '🤝 Client' },
];

const REPORT_AUDIENCE_BY_OPTION: Record<AudienceOption, StatusReportAudience> = {
    '👥 Team Standup': 'team',
    '👔 Executive Review': 'executive',
    '🤝 Client Update': 'client',
};

const AUDIENCE_BADGE_LABEL: Record<StatusReportAudience, string> = {
    team: 'Team',
    executive: 'Executive',
    client: 'Client',
};

const TOTAL_SLIDES = 8;
const DAY_MS = 1000 * 60 * 60 * 24;

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
});

const TONE_BY_AUDIENCE: Record<AudienceOption, AIReportTone> = {
    '👥 Team Standup': 'engineering',
    '👔 Executive Review': 'executive',
    '🤝 Client Update': 'polished',
};

function toValidDate(value?: string | null): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function sanitizeSpeakerNotes(content: string): string {
    if (!content) return '';

    return content
        .replace(/^#+\s*/gm, '')
        .replace(/^\s*[-*]\s*/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function formatDaysLabel(days: number): string {
    return `${days} ${days === 1 ? 'day' : 'days'}`;
}

function formatUsd(value: number): string {
    return USD_FORMATTER.format(Math.round(value));
}

function formatUsdCompact(value: number): string {
    if (value >= 1000) {
        return `~$${(value / 1000).toFixed(1)}k`;
    }
    return `~${formatUsd(value)}`;
}

function extractRecommendedFocus(notes: string): string | null {
    const match = notes.match(/recommended focus:\s*(.+)/i);
    if (match?.[1]) return match[1].trim();

    const line = notes
        .split('\n')
        .map((item) => item.trim())
        .find(Boolean);

    return line || null;
}

function priorityScore(priority: string | null): number {
    const normalized = (priority || '').toLowerCase();
    if (normalized === 'highest') return 5;
    if (normalized === 'high') return 4;
    if (normalized === 'medium') return 3;
    if (normalized === 'low') return 2;
    if (normalized === 'lowest') return 1;
    return 0;
}

function normalizeMarkdownHeading(value: string): string {
    return value.replace(/^[^A-Za-z0-9]+/, '').trim();
}

function renderInlineMarkdown(value: string): ReactNode[] {
    const parts = value.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
        }
        return <span key={`text-${index}`}>{part}</span>;
    });
}

function renderMarkdownPreview(content: string): ReactNode {
    const lines = content.split('\n');
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lines.map((line, index) => {
                const trimmed = line.trim();
                if (!trimmed) {
                    return <div key={`spacer-${index}`} style={{ height: 6 }} />;
                }

                if (trimmed.startsWith('## ')) {
                    return (
                        <h3
                            key={`h2-${index}`}
                            style={{ color: '#e2e8f0', margin: 0, fontSize: 18, fontWeight: 800 }}
                        >
                            {renderInlineMarkdown(trimmed.slice(3))}
                        </h3>
                    );
                }

                if (trimmed.startsWith('### ')) {
                    return (
                        <h4
                            key={`h3-${index}`}
                            style={{ color: '#cbd5e1', margin: 0, fontSize: 15, fontWeight: 700 }}
                        >
                            {renderInlineMarkdown(trimmed.slice(4))}
                        </h4>
                    );
                }

                if (/^[-*]\s+/.test(trimmed)) {
                    return (
                        <div
                            key={`li-${index}`}
                            style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6, paddingLeft: 4 }}
                        >
                            • {renderInlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}
                        </div>
                    );
                }

                return (
                    <p key={`p-${index}`} style={{ margin: 0, color: '#cbd5e1', fontSize: 13, lineHeight: 1.7 }}>
                        {renderInlineMarkdown(trimmed)}
                    </p>
                );
            })}
        </div>
    );
}

function toPlainTextReport(content: string): string {
    return content
        .replace(/[#__*]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function toConfluenceReport(content: string): string {
    return content
        .split('\n')
        .map((line) => {
            if (line.startsWith('### ')) return `h3. ${line.slice(4)}`;
            if (line.startsWith('## ')) return `h2. ${line.slice(3)}`;
            return line.replace(/\*/g, '•');
        })
        .join('\n');
}

function toSlackReport(content: string): string {
    const emojiBySection: Record<string, string> = {
        'Executive Summary': '🎯',
        'Sprint Investment': '💰',
        'Resolved This Period': '✅',
        'In Progress': '🔄',
        'Risks & Blockers': '⚠️',
        'Next Steps': '📋',
    };

    return content
        .split('\n')
        .map((line) => {
            if (line.startsWith('## ')) {
                return `📊 *${line.slice(3).trim()}*`;
            }
            if (line.startsWith('### ')) {
                const heading = normalizeMarkdownHeading(line.slice(4));
                const emoji = emojiBySection[heading] || '📝';
                return `${emoji} *${heading}*`;
            }
            if (/^[-*]\s+/.test(line)) {
                return `• ${line.replace(/^[-*]\s+/, '')}`;
            }
            return line;
        })
        .join('\n');
}

function formatReportTimestamp(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown time';

    const datePart = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
    const timePart = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);

    return `${datePart} — ${timePart}`;
}

export default function SlideshowPage() {
    const filteredIssues = useFilteredIssues();
    const activeSprints = useAppStore((state) => state.activeSprints);
    const setSidebarHidden = useAppStore((state) => state.setSidebarHidden);
    const isPmGuideEnabled = useAppStore((state) => state.isPmGuideEnabled);
    const togglePmGuide = useAppStore((state) => state.togglePmGuide);

    const [audience, setAudience] = useState<AudienceOption>('👥 Team Standup');
    const [presentMode, setPresentMode] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(1);
    const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
    const [showPlanningRealityCheck, setShowPlanningRealityCheck] = useState(true);
    const [slide7Suggestion, setSlide7Suggestion] = useState('');
    const [teamConfig, setTeamConfig] = useState<TeamConfig | null>(null);
    const [teamConfigLoading, setTeamConfigLoading] = useState(true);
    const [regeneratingBySlide, setRegeneratingBySlide] = useState<Record<number, boolean>>({});
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportModalPhase, setReportModalPhase] = useState<ReportModalPhase>('setup');
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [generatedReport, setGeneratedReport] = useState<StatusReportResponse | null>(null);
    const [copyToast, setCopyToast] = useState<string | null>(null);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [reportHistory, setReportHistory] = useState<StatusReportResponse[]>([]);
    const [reportHistoryLoading, setReportHistoryLoading] = useState(false);
    const [reportHistoryError, setReportHistoryError] = useState<string | null>(null);
    const [slideNotes, setSlideNotes] = useState<Record<number, string>>({
        1: '',
        2: '',
        3: '',
        4: '',
        5: '',
        6: '',
        7: '',
        8: '',
    });

    const slideshowRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setNowTimestamp(Date.now());
        }, 60_000);

        return () => {
            window.clearInterval(timer);
        };
    }, []);

    useEffect(() => {
        setSidebarHidden(presentMode);
        return () => {
            setSidebarHidden(false);
        };
    }, [presentMode, setSidebarHidden]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setPresentMode(false);
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function loadTeamConfig() {
            setTeamConfigLoading(true);
            try {
                const response = await fetch('/api/team-config', { cache: 'no-store' });
                if (!response.ok) throw new Error('Failed to fetch team config');

                const data = await response.json() as TeamConfig;
                if (!cancelled) setTeamConfig(data);
            } catch {
                if (!cancelled) setTeamConfig(null);
            } finally {
                if (!cancelled) setTeamConfigLoading(false);
            }
        }

        void loadTeamConfig();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!copyToast) return;
        const timeout = window.setTimeout(() => setCopyToast(null), 2000);
        return () => {
            window.clearTimeout(timeout);
        };
    }, [copyToast]);

    const activeSprintFromIssues = useMemo(
        () => filteredIssues.find((issue) => issue.sprint?.state === 'active')?.sprint || null,
        [filteredIssues]
    );

    const activeSprintFromStore = useMemo(
        () => activeSprints.find((sprint) => sprint.state === 'active') || null,
        [activeSprints]
    );

    const activeSprint = useMemo<Sprint | null>(() => {
        if (!activeSprintFromIssues) return activeSprintFromStore;

        if (!activeSprintFromIssues.endDate && activeSprintFromStore?.endDate) {
            return {
                ...activeSprintFromIssues,
                endDate: activeSprintFromStore.endDate,
            };
        }

        return activeSprintFromIssues;
    }, [activeSprintFromIssues, activeSprintFromStore]);

    const sprintIssues = useMemo(
        () =>
            activeSprint
                ? filteredIssues.filter((issue) => issue.sprint?.id === activeSprint.id)
                : [],
        [activeSprint, filteredIssues]
    );

    const committedCount = sprintIssues.length;
    const sprintName = activeSprint?.name || 'Current Sprint';
    const doneIssues = sprintIssues.filter((issue) => CLOSED_STATUSES.includes(issue.status));
    const doneCount = doneIssues.length;
    const inProgressCount = sprintIssues.filter((issue) => issue.status === 'In Progress').length;
    const activeSprintOpenIssues = sprintIssues.filter((issue) => !CLOSED_STATUSES.includes(issue.status));

    const blockedTickets = useMemo(
        () => sprintIssues
            .filter((issue) => issue.status === 'Blocked')
            .sort((a, b) => b.timeInCurrentStatus - a.timeInCurrentStatus),
        [sprintIssues]
    );
    const blockedCount = blockedTickets.length;

    const completionPct = committedCount > 0
        ? Math.round((doneCount / committedCount) * 100)
        : 0;

    const daysRemaining = useMemo(() => {
        const sprintEndDate = toValidDate(activeSprint?.endDate);
        if (!sprintEndDate) return 0;

        return Math.max(0, Math.ceil((sprintEndDate.getTime() - nowTimestamp) / DAY_MS));
    }, [activeSprint?.endDate, nowTimestamp]);

    const sprintStartDate = toValidDate(activeSprint?.startDate);
    const sprintEndDate = toValidDate(activeSprint?.endDate);

    const carryOverRiskCount = useMemo(() => {
        if (!sprintStartDate || !sprintEndDate) {
            return sprintIssues
                .filter((issue) => !CLOSED_STATUSES.includes(issue.status))
                .filter((issue) => issue.status === 'In Progress' || issue.status === 'Open')
                .length;
        }

        const sprintLengthDays = Math.max(
            1,
            Math.ceil((sprintEndDate.getTime() - sprintStartDate.getTime()) / DAY_MS)
        );

        const daysElapsed = clamp(
            Math.ceil((nowTimestamp - sprintStartDate.getTime()) / DAY_MS),
            0,
            sprintLengthDays
        );

        const threshold = Math.max(0, sprintLengthDays - daysElapsed);

        return sprintIssues
            .filter((issue) => !CLOSED_STATUSES.includes(issue.status))
            .filter((issue) => issue.status === 'In Progress' || issue.status === 'Open')
            .filter((issue) => issue.age > threshold)
            .length;
    }, [nowTimestamp, sprintEndDate, sprintIssues, sprintStartDate]);

    const epicSummaryByKey = useMemo(() => {
        const map = new Map<string, string>();

        for (const issue of filteredIssues) {
            if (issue.issueType.toLowerCase() === 'epic' && issue.key && issue.summary) {
                map.set(issue.key, issue.summary);
            }

            if (
                issue.epicKey &&
                issue.epicSummary &&
                issue.epicSummary.trim().length > 0 &&
                issue.epicSummary !== issue.epicKey
            ) {
                map.set(issue.epicKey, issue.epicSummary);
            }
        }

        return map;
    }, [filteredIssues]);

    const topEpics = useMemo<EpicSlideRow[]>(() => {
        const map = new Map<string, Omit<EpicSlideRow, 'progressPct'>>();

        for (const issue of sprintIssues) {
            if (!issue.epicKey) continue;

            const key = issue.epicKey;
            const summary = epicSummaryByKey.get(key) || issue.epicSummary || key;
            const label = formatEpicLabelFromParts(key, summary, key);
            const row = map.get(key) || {
                key,
                label,
                active: 0,
                done: 0,
                total: 0,
            };

            row.total += 1;
            if (CLOSED_STATUSES.includes(issue.status)) {
                row.done += 1;
            } else {
                row.active += 1;
            }

            map.set(key, row);
        }

        return [...map.values()]
            .sort((a, b) => {
                if (b.active !== a.active) return b.active - a.active;
                if (b.total !== a.total) return b.total - a.total;
                return a.label.localeCompare(b.label);
            })
            .slice(0, 3)
            .map((row) => ({
                ...row,
                progressPct: row.total > 0 ? Math.round((row.done / row.total) * 100) : 0,
            }));
    }, [epicSummaryByKey, sprintIssues]);

    const dominantWorkType = useMemo(() => {
        const metrics = calculateWorkMixMetrics(sprintIssues);
        const [dominant] = [...metrics.rows].sort((a, b) => b.count - a.count);
        return dominant?.bucket || null;
    }, [sprintIssues]);

    const primaryFocus = dominantWorkType || topEpics[0]?.label || 'No dominant focus identified';

    const longBlockedCount = blockedTickets.filter((issue) => issue.timeInCurrentStatus > 30).length;

    const assigneeLoadRows = useMemo<AssigneeLoadRow[]>(() => {
        const map = new Map<string, AssigneeLoadRow>();

        for (const issue of activeSprintOpenIssues) {
            const assigneeName = issue.assignee?.displayName || 'Unassigned';
            const key = issue.assignee?.accountId || `unassigned:${assigneeName}`;
            const initial = assigneeName.charAt(0).toUpperCase() || '?';
            const row = map.get(key) || {
                key,
                name: assigneeName,
                initial,
                ticketCount: 0,
                storyPoints: 0,
            };

            row.ticketCount += 1;
            row.storyPoints += issue.storyPoints || 0;
            map.set(key, row);
        }

        return [...map.values()].sort((a, b) => {
            if (b.storyPoints !== a.storyPoints) return b.storyPoints - a.storyPoints;
            if (b.ticketCount !== a.ticketCount) return b.ticketCount - a.ticketCount;
            return a.name.localeCompare(b.name);
        });
    }, [activeSprintOpenIssues]);

    const maxAssigneePoints = Math.max(...assigneeLoadRows.map((row) => row.storyPoints), 1);
    const overloadedAssignees = assigneeLoadRows.filter((row) => row.storyPoints > 13);
    const totalActiveTickets = activeSprintOpenIssues.length;
    const assigneeCount = assigneeLoadRows.length;

    const workstreamCount = useMemo(() => {
        const streamSet = new Set<string>();

        for (const issue of activeSprintOpenIssues) {
            if (issue.epicKey) {
                streamSet.add(issue.epicKey);
                continue;
            }
            if (issue.workType) {
                streamSet.add(issue.workType);
                continue;
            }
            streamSet.add(issue.issueType);
        }

        return streamSet.size;
    }, [activeSprintOpenIssues]);

    const openBugsCount = activeSprintOpenIssues.filter((issue) => issue.issueType === 'Bug').length;
    const reopenMetrics = useMemo(() => getReopenRates(sprintIssues), [sprintIssues]);
    const reopenRate = reopenMetrics.reopenRate;

    const workflowMetrics = useMemo(
        () => calculateWorkflowMetrics(sprintIssues),
        [sprintIssues]
    );

    const bounceRate = sprintIssues.length > 0
        ? Number(((workflowMetrics.bounceBackIssues.length / sprintIssues.length) * 100).toFixed(1))
        : 0;

    const cycleDistribution = useMemo(
        () => getCycleLeadTimeDistribution({ issues: sprintIssues, metric: 'cycle' }),
        [sprintIssues]
    );

    const hasCycleData = cycleDistribution.totalPoints > 0;
    const cycleP50 = cycleDistribution.percentiles.p50;

    const qualityFlags = {
        openBugs: openBugsCount < 20,
        reopenRate: reopenRate < 5,
        bounceRate: bounceRate < 20,
        cycleTime: hasCycleData && cycleP50 < 14,
    };

    const qualityOutsideCount = Object.values(qualityFlags).filter((inRange) => !inRange).length;

    const qualityTrafficLight = qualityOutsideCount >= 3
        ? { icon: '🔴', label: 'Action needed: 3+ metrics outside range', color: '#fecaca', border: 'rgba(239,68,68,0.45)', bg: 'rgba(127,29,29,0.28)' }
        : qualityOutsideCount >= 1
            ? { icon: '🟡', label: 'Watch: 1-2 metrics need attention', color: '#fef08a', border: 'rgba(245,158,11,0.45)', bg: 'rgba(120,53,15,0.24)' }
            : { icon: '🟢', label: 'Healthy: all metrics in range', color: '#bbf7d0', border: 'rgba(16,185,129,0.45)', bg: 'rgba(6,78,59,0.24)' };

    const resolvedLast30Days = useMemo(() => {
        const cutoff = nowTimestamp - (30 * DAY_MS);

        return filteredIssues
            .filter((issue) => {
                const resolvedDate = toValidDate(issue.resolved);
                return (
                    resolvedDate !== null &&
                    resolvedDate.getTime() >= cutoff &&
                    CLOSED_STATUSES.includes(issue.status)
                );
            })
            .sort((a, b) => {
                const aResolved = toValidDate(a.resolved)?.getTime() || 0;
                const bResolved = toValidDate(b.resolved)?.getTime() || 0;
                return bResolved - aResolved;
            });
    }, [filteredIssues, nowTimestamp]);

    const resolvedCount = resolvedLast30Days.length;
    const resolvedBugCount = resolvedLast30Days.filter((issue) => issue.issueType === 'Bug').length;
    const resolvedFeatureCount = resolvedLast30Days.filter((issue) => issue.issueType === 'Feature' || issue.issueType === 'Story').length;
    const resolvedTaskCount = Math.max(0, resolvedCount - resolvedBugCount - resolvedFeatureCount);
    const topResolved = resolvedLast30Days.slice(0, 5);

    const hideResolvedKeys = audience === '👔 Executive Review' || audience === '🤝 Client Update';

    const backlogCandidates = useMemo(() => {
        return filteredIssues.filter((issue) => {
            if (CLOSED_STATUSES.includes(issue.status)) return false;
            if (issue.sprint?.state === 'active') return false;
            return true;
        });
    }, [filteredIssues]);

    const sprintReadyTickets = useMemo(() => {
        return backlogCandidates.filter((issue) => {
            const group = resolveWorkflowGroup(issue.status);
            return group === 'Backlog' || group === 'Planning' || group === 'Awaiting';
        });
    }, [backlogCandidates]);

    const sprintReadyCount = sprintReadyTickets.length;
    const sprintReadyPointsTotal = sprintReadyTickets.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
    const hasSprintReadyPoints = sprintReadyTickets.some((issue) => issue.storyPoints !== null);

    const upcomingTopItems = useMemo(() => {
        return [...sprintReadyTickets]
            .sort((a, b) => {
                const priorityDiff = priorityScore(b.priority) - priorityScore(a.priority);
                if (priorityDiff !== 0) return priorityDiff;
                return b.updated.localeCompare(a.updated);
            })
            .slice(0, 3);
    }, [sprintReadyTickets]);

    const donePointsCurrentSprint = doneIssues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);

    const rawEstimateSprints = useMemo(() => {
        if (sprintReadyCount === 0) return 0;

        if (hasSprintReadyPoints && donePointsCurrentSprint > 0) {
            return Number((sprintReadyPointsTotal / donePointsCurrentSprint).toFixed(1));
        }

        return Number((sprintReadyCount / Math.max(doneCount, 1)).toFixed(1));
    }, [doneCount, donePointsCurrentSprint, hasSprintReadyPoints, sprintReadyCount, sprintReadyPointsTotal]);

    const realisticEstimateLow = Number((rawEstimateSprints * 2).toFixed(1));
    const realisticEstimateHigh = Number((rawEstimateSprints * 3).toFixed(1));

    const slide7SuggestionFallback = useMemo(() => {
        if (upcomingTopItems[0]) {
            return `Prioritize ${upcomingTopItems[0].summary}`;
        }

        if (sprintReadyCount > 0) {
            return 'Tighten next-sprint scope and prioritize highest-impact backlog items.';
        }

        return 'Refine backlog quality and promote more tickets to sprint-ready status.';
    }, [sprintReadyCount, upcomingTopItems]);

    useEffect(() => {
        setSlide7Suggestion((prev) => prev || slide7SuggestionFallback);
    }, [slide7SuggestionFallback]);

    const isTeamConfigSet = Boolean(teamConfig?.updatedAt);

    const sprintInvestment = isTeamConfigSet && teamConfig
        ? teamConfig.activeEngineers * teamConfig.productiveHoursPerSprint * teamConfig.hourlyRate
        : 0;

    const costPerResolved = doneCount > 0
        ? sprintInvestment / doneCount
        : null;

    const deliveryEfficiency = committedCount > 0
        ? Number(((doneCount / committedCount) * 100).toFixed(1))
        : 0;

    const carryOverCost = committedCount > 0
        ? carryOverRiskCount * (sprintInvestment / committedCount)
        : 0;

    const deliveryEfficiencyColor = deliveryEfficiency > 80
        ? '#10b981'
        : deliveryEfficiency >= 60
            ? '#f59e0b'
            : '#ef4444';

    const slide1NotesFallback = useMemo(() => {
        const caption = daysRemaining > 0
            ? `The sprint has ${formatDaysLabel(daysRemaining)} remaining.`
            : 'The sprint end date is not configured, so timeline confidence is lower.';

        return [
            `${sprintName} is ${completionPct}% complete with ${doneCount} done, ${inProgressCount} in progress, and ${blockedCount} blocked.`,
            caption,
            audience === '👥 Team Standup'
                ? 'Ask owners of blocked work for immediate dependency updates before standup ends.'
                : 'Emphasize execution confidence and the single highest-leverage unblock action.',
        ].join(' ');
    }, [audience, blockedCount, completionPct, daysRemaining, doneCount, inProgressCount, sprintName]);

    const slide2NotesFallback = useMemo(() => {
        const epicsSummary = topEpics.length > 0
            ? topEpics.map((epic) => `${epic.label} (${epic.active} active)`).join('; ')
            : 'No active epics detected in the current sprint scope.';

        return [
            `Current focus is concentrated around ${primaryFocus}.`,
            `Top epics by active work: ${epicsSummary}.`,
            audience === '👔 Executive Review' || audience === '🤝 Client Update'
                ? 'Translate this into business outcomes, not implementation detail.'
                : 'Clarify why each epic matters this sprint and what gets deprioritized.',
        ].join(' ');
    }, [audience, primaryFocus, topEpics]);

    const slide3NotesFallback = useMemo(() => {
        if (blockedCount === 0) {
            return `There are currently no blocked tickets. The carry-over forecast is ${carryOverRiskCount} tickets at current pace, so keep focus on in-progress flow and fast QA handoffs.`;
        }

        const topBlockersText = blockedTickets
            .slice(0, 3)
            .map((issue) => `${issue.key} (${issue.timeInCurrentStatus}d)`)
            .join(', ');

        return [
            `${blockedCount} tickets are blocked; key blockers are ${topBlockersText}.`,
            `${longBlockedCount > 0 ? `${longBlockedCount} blockers exceed 30 days and need escalation. ` : ''}Carry-over risk is ${carryOverRiskCount} tickets at current pace.`,
            audience === '👥 Team Standup'
                ? 'Assign one owner per blocker and timebox next-action updates today.'
                : 'Frame blocker themes in plain language and end with clear escalation asks.',
        ].join(' ');
    }, [audience, blockedCount, blockedTickets, carryOverRiskCount, longBlockedCount]);

    const slide4NotesFallback = useMemo(() => {
        if (audience === '👔 Executive Review' || audience === '🤝 Client Update') {
            return `The team is actively distributed across ${workstreamCount} workstreams.`;
        }

        const overloadedNames = overloadedAssignees.map((row) => row.name).join(', ');
        return overloadedAssignees.length > 0
            ? `Team load is spread across ${assigneeCount} people with ${totalActiveTickets} active tickets. Overloaded assignees: ${overloadedNames}.`
            : `Team load is spread across ${assigneeCount} people with ${totalActiveTickets} active tickets and no overloaded assignees above 13 points.`;
    }, [assigneeCount, audience, overloadedAssignees, totalActiveTickets, workstreamCount]);

    const slide5NotesFallback = useMemo(() => {
        const cycleLabel = hasCycleData ? `${cycleP50} days` : 'not enough cycle-time data yet';
        return `${qualityTrafficLight.icon} ${qualityTrafficLight.label}. Open bugs ${openBugsCount}, reopen rate ${reopenRate}%, bounce rate ${bounceRate}%, cycle time p50 ${cycleLabel}.`;
    }, [bounceRate, cycleP50, hasCycleData, openBugsCount, qualityTrafficLight.icon, qualityTrafficLight.label, reopenRate]);

    const slide6NotesFallback = useMemo(() => {
        if (audience === '🤝 Client Update') {
            return `We resolved ${resolvedCount} customer-facing issues and completed ${resolvedTaskCount} infrastructure improvements.`;
        }

        return `In the last 30 days, the team resolved ${resolvedCount} issues (${resolvedBugCount} bugs, ${resolvedFeatureCount} features, ${resolvedTaskCount} tasks). Keep the framing positive and emphasize shipped outcomes.`;
    }, [audience, resolvedBugCount, resolvedCount, resolvedFeatureCount, resolvedTaskCount]);

    const slide7NotesFallback = useMemo(() => {
        return `Next sprint has ${sprintReadyCount} ready tickets${hasSprintReadyPoints ? ` worth ${sprintReadyPointsTotal} points` : ''}. Recommended focus: ${slide7SuggestionFallback}.`;
    }, [hasSprintReadyPoints, slide7SuggestionFallback, sprintReadyCount, sprintReadyPointsTotal]);

    const slide8NotesFallback = useMemo(() => {
        if (!isTeamConfigSet) {
            return 'Configure team size in Settings to unlock cost estimates and business-impact commentary.';
        }

        if (audience === '👔 Executive Review') {
            return `This sprint represented ${formatUsdCompact(sprintInvestment)} of engineering investment. We delivered ${deliveryEfficiency}% of committed scope.`;
        }

        if (audience === '🤝 Client Update') {
            return `Our team dedicated two full weeks and successfully delivered ${doneCount} improvements.`;
        }

        return `Sprint cost ${formatUsdCompact(sprintInvestment)}. We hit ${deliveryEfficiency}% of our commitment. ${carryOverRiskCount} tickets roll into next sprint.`;
    }, [audience, carryOverRiskCount, deliveryEfficiency, doneCount, isTeamConfigSet, sprintInvestment]);

    const fallbackNotesBySlide = useMemo<Record<number, string>>(() => ({
        1: slide1NotesFallback,
        2: slide2NotesFallback,
        3: slide3NotesFallback,
        4: slide4NotesFallback,
        5: slide5NotesFallback,
        6: slide6NotesFallback,
        7: slide7NotesFallback,
        8: slide8NotesFallback,
    }), [
        slide1NotesFallback,
        slide2NotesFallback,
        slide3NotesFallback,
        slide4NotesFallback,
        slide5NotesFallback,
        slide6NotesFallback,
        slide7NotesFallback,
        slide8NotesFallback,
    ]);

    useEffect(() => {
        setSlideNotes((prev) => ({
            ...prev,
            1: prev[1] || fallbackNotesBySlide[1],
            2: prev[2] || fallbackNotesBySlide[2],
            3: prev[3] || fallbackNotesBySlide[3],
            4: prev[4] || fallbackNotesBySlide[4],
            5: prev[5] || fallbackNotesBySlide[5],
            6: prev[6] || fallbackNotesBySlide[6],
            7: prev[7] || fallbackNotesBySlide[7],
            8: prev[8] || fallbackNotesBySlide[8],
        }));
    }, [fallbackNotesBySlide]);

    const regenerateSpeakerNotes = useCallback(async (slideNumber: number) => {
        setRegeneratingBySlide((prev) => ({ ...prev, [slideNumber]: true }));

        try {
            let customInstructions = '';
            let issueKeys: string[] = [];

            if (slideNumber === 1) {
                customInstructions = [
                    'Slide: Where We Are',
                    `Audience: ${audience}`,
                    'Use this exact data:',
                    `- sprintName: ${sprintName}`,
                    `- completionPct: ${completionPct}`,
                    `- done: ${doneCount}`,
                    `- inProgress: ${inProgressCount}`,
                    `- blocked: ${blockedCount}`,
                    `- daysRemaining: ${daysRemaining}`,
                    'Write concise speaking notes (3-5 short sentences).',
                ].join('\n');
                issueKeys = sprintIssues.map((issue) => issue.key);
            } else if (slideNumber === 2) {
                const epicLines = topEpics.length > 0
                    ? topEpics.map((epic) => `- ${epic.label}: ${epic.active} active, ${epic.progressPct}% complete`).join('\n')
                    : '- No active epics in current sprint scope.';

                customInstructions = [
                    'Slide: What We\'re Focusing On',
                    `Audience: ${audience}`,
                    `Dominant work type: ${dominantWorkType || 'N/A'}`,
                    'Top 3 epics by active ticket count:',
                    epicLines,
                    `Primary focus callout: ${primaryFocus}`,
                    'Explain what this focus means in plain English for this audience.',
                ].join('\n');
                issueKeys = sprintIssues.map((issue) => issue.key);
            } else if (slideNumber === 3) {
                const blockerLines = blockedTickets.length > 0
                    ? blockedTickets
                        .slice(0, 10)
                        .map((issue) => `- ${issue.key}: ${issue.summary} (Blocked ${issue.timeInCurrentStatus}d, Owner: ${issue.assignee?.displayName || 'Unassigned'})`)
                        .join('\n')
                    : '- No blocked tickets.';

                customInstructions = [
                    'Slide: Risks & Blockers',
                    `Audience: ${audience}`,
                    `Blocked count: ${blockedCount}`,
                    `Tickets blocked over 30 days: ${longBlockedCount}`,
                    `Carry-over risk count: ${carryOverRiskCount}`,
                    'Blocked ticket details:',
                    blockerLines,
                    audience === '👔 Executive Review' || audience === '🤝 Client Update'
                        ? 'Do not include Jira ticket keys. Use plain English only.'
                        : 'Recommend one concrete action per blocker.',
                ].join('\n');
                issueKeys = blockedTickets.map((issue) => issue.key);
            } else if (slideNumber === 4) {
                const loadLines = assigneeLoadRows.length > 0
                    ? assigneeLoadRows.map((row) => `- ${row.name}: ${row.ticketCount} tickets, ${row.storyPoints} points`).join('\n')
                    : '- No active assignees in current sprint scope.';

                const overloadedLine = overloadedAssignees.length > 0
                    ? overloadedAssignees.map((row) => row.name).join(', ')
                    : 'None';

                customInstructions = [
                    'Slide: Team Load',
                    `Audience: ${audience}`,
                    `Total active tickets: ${totalActiveTickets}`,
                    `Assignee count: ${assigneeCount}`,
                    `Workstream count: ${workstreamCount}`,
                    `Overloaded assignees (>13 points): ${overloadedLine}`,
                    'Assignee load breakdown:',
                    loadLines,
                    audience === '👔 Executive Review' || audience === '🤝 Client Update'
                        ? `Use this sentence exactly once: "The team is actively distributed across ${workstreamCount} workstreams."`
                        : 'Call out overloaded assignees by name and suggest a balancing action.',
                ].join('\n');

                issueKeys = activeSprintOpenIssues.map((issue) => issue.key);
            } else if (slideNumber === 5) {
                customInstructions = [
                    'Slide: Quality & Health',
                    `Audience: ${audience}`,
                    `Open bugs: ${openBugsCount}`,
                    `Re-open rate: ${reopenRate}%`,
                    `Bounce rate: ${bounceRate}%`,
                    `Cycle time p50: ${hasCycleData ? `${cycleP50} days` : 'N/A'}`,
                    `Traffic light state: ${qualityTrafficLight.icon} ${qualityTrafficLight.label}`,
                    'Explain the traffic light in plain English using the actual values.',
                ].join('\n');

                issueKeys = sprintIssues.map((issue) => issue.key);
            } else if (slideNumber === 6) {
                const resolvedLines = topResolved.length > 0
                    ? topResolved
                        .map((issue) => `- ${issue.key}: ${issue.summary}`)
                        .join('\n')
                    : '- No resolved tickets in last 30 days.';

                customInstructions = [
                    'Slide: What We Delivered',
                    `Audience: ${audience}`,
                    `Resolved in last 30 days: ${resolvedCount}`,
                    `Bug fixes: ${resolvedBugCount}`,
                    `Features: ${resolvedFeatureCount}`,
                    `Tasks: ${resolvedTaskCount}`,
                    'Recent resolved tickets:',
                    resolvedLines,
                    'Write a positive "here\'s what we shipped" narrative.',
                    audience === '🤝 Client Update'
                        ? 'Do not use Jira keys, internal names, or technical terms. Write as: "We resolved X customer-facing issues and completed Y infrastructure improvements."'
                        : 'Keep it upbeat and customer-impact oriented.',
                ].join('\n');

                issueKeys = resolvedLast30Days.map((issue) => issue.key);
            } else if (slideNumber === 7) {
                const upcomingLines = upcomingTopItems.length > 0
                    ? upcomingTopItems.map((issue) => `- ${issue.summary}`).join('\n')
                    : '- No sprint-ready items currently.';

                customInstructions = [
                    'Slide: What\'s Coming Next',
                    `Audience: ${audience}`,
                    `Sprint-ready tickets: ${sprintReadyCount}`,
                    `Sprint-ready story points: ${hasSprintReadyPoints ? sprintReadyPointsTotal : 'N/A'}`,
                    `Raw estimate (sprints): ${rawEstimateSprints}`,
                    `Realistic estimate range (sprints): ${realisticEstimateLow} to ${realisticEstimateHigh}`,
                    'Top 3 upcoming items:',
                    upcomingLines,
                    'Start with one line in this exact format: "Recommended focus: ..."',
                    'Then provide short supporting speaker notes.',
                ].join('\n');

                issueKeys = sprintReadyTickets.map((issue) => issue.key);
            } else if (slideNumber === 8) {
                if (!isTeamConfigSet || !teamConfig) {
                    customInstructions = [
                        'Slide: Business Impact & Cost',
                        `Audience: ${audience}`,
                        'Team configuration is missing.',
                        'Write speaker notes that instruct configuring Settings -> Team Configuration to unlock cost estimates.',
                    ].join('\n');
                } else {
                    customInstructions = [
                        'Slide: Business Impact & Cost',
                        `Audience: ${audience}`,
                        `Estimated sprint investment: ${formatUsd(sprintInvestment)}`,
                        `Cost per resolved ticket: ${costPerResolved !== null ? formatUsd(costPerResolved) : 'No tickets resolved yet'}`,
                        `Delivery efficiency: ${deliveryEfficiency}%`,
                        `Carry-over cost: ${formatUsd(carryOverCost)}`,
                        `Committed tickets: ${committedCount}`,
                        `Resolved tickets: ${doneCount}`,
                        audience === '👔 Executive Review'
                            ? `Use this framing: "This sprint represented ${formatUsdCompact(sprintInvestment)} of engineering investment. We delivered ${deliveryEfficiency}% of committed scope."`
                            : audience === '🤝 Client Update'
                                ? `Use this framing: "Our team dedicated two full weeks and successfully delivered ${doneCount} improvements."`
                                : `Use this framing: "Sprint cost ${formatUsdCompact(sprintInvestment)}. We hit ${deliveryEfficiency}% of our commitment. ${carryOverRiskCount} tickets roll into next sprint."`,
                    ].join('\n');
                }

                issueKeys = sprintIssues.map((issue) => issue.key);
            } else {
                setSlideNotes((prev) => ({
                    ...prev,
                    [slideNumber]: fallbackNotesBySlide[slideNumber] || 'Slide notes unavailable.',
                }));
                return;
            }

            if (isPmGuideEnabled) {
                customInstructions = `${customInstructions}\nAlso add a one-sentence coaching tip for a new PM presenting this slide for the first time.`;
            }

            const response = await fetch('/api/ai/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'slide_speaker_notes',
                    tone: TONE_BY_AUDIENCE[audience],
                    issueKeys,
                    sprintName,
                    customInstructions,
                }),
            });

            const data = await response.json() as { content?: string; error?: string };
            if (!response.ok) {
                throw new Error(data.error || `Request failed (${response.status})`);
            }

            const content = sanitizeSpeakerNotes(data.content || '');
            setSlideNotes((prev) => ({
                ...prev,
                [slideNumber]: content || fallbackNotesBySlide[slideNumber],
            }));

            if (slideNumber === 7) {
                const suggestion = extractRecommendedFocus(content);
                if (suggestion) {
                    setSlide7Suggestion(suggestion);
                }
            }
        } catch {
            setSlideNotes((prev) => ({
                ...prev,
                [slideNumber]: fallbackNotesBySlide[slideNumber],
            }));

            if (slideNumber === 7) {
                setSlide7Suggestion(slide7SuggestionFallback);
            }
        } finally {
            setRegeneratingBySlide((prev) => ({ ...prev, [slideNumber]: false }));
        }
    }, [
        activeSprintOpenIssues,
        assigneeCount,
        assigneeLoadRows,
        audience,
        blockedCount,
        blockedTickets,
        bounceRate,
        carryOverCost,
        carryOverRiskCount,
        dominantWorkType,
        committedCount,
        completionPct,
        costPerResolved,
        cycleP50,
        daysRemaining,
        deliveryEfficiency,
        doneCount,
        fallbackNotesBySlide,
        hasCycleData,
        hasSprintReadyPoints,
        inProgressCount,
        isTeamConfigSet,
        isPmGuideEnabled,
        longBlockedCount,
        openBugsCount,
        overloadedAssignees,
        primaryFocus,
        qualityTrafficLight.icon,
        qualityTrafficLight.label,
        rawEstimateSprints,
        realisticEstimateHigh,
        realisticEstimateLow,
        reopenRate,
        resolvedBugCount,
        resolvedCount,
        resolvedFeatureCount,
        resolvedLast30Days,
        resolvedTaskCount,
        slide7SuggestionFallback,
        sprintInvestment,
        sprintIssues,
        sprintName,
        sprintReadyCount,
        sprintReadyPointsTotal,
        sprintReadyTickets,
        teamConfig,
        topEpics,
        topResolved,
        totalActiveTickets,
        upcomingTopItems,
        workstreamCount,
    ]);

    const enterPresentMode = useCallback(async () => {
        setPresentMode(true);
        setCurrentSlide((prev) => clamp(prev, 1, TOTAL_SLIDES));

        const fullscreenTarget = slideshowRef.current || document.documentElement;
        if (fullscreenTarget.requestFullscreen) {
            try {
                await fullscreenTarget.requestFullscreen();
            } catch {
                setPresentMode(false);
            }
        }
    }, []);

    const exitPresentMode = useCallback(async () => {
        setPresentMode(false);
        if (document.fullscreenElement) {
            try {
                await document.exitFullscreen();
            } catch {
                // no-op
            }
        }
    }, []);

    useEffect(() => {
        if (!presentMode) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowRight') {
                setCurrentSlide((prev) => clamp(prev + 1, 1, TOTAL_SLIDES));
            }

            if (event.key === 'ArrowLeft') {
                setCurrentSlide((prev) => clamp(prev - 1, 1, TOTAL_SLIDES));
            }

            if (event.key === 'Escape') {
                void exitPresentMode();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [exitPresentMode, presentMode]);

    const loadReportHistory = useCallback(async () => {
        setReportHistoryLoading(true);
        setReportHistoryError(null);

        try {
            const response = await fetch('/api/reports/status', { cache: 'no-store' });
            const data = await response.json() as Array<StatusReportResponse & { isAuto?: boolean }> | { error?: string };
            if (!response.ok || !Array.isArray(data)) {
                throw new Error(
                    !Array.isArray(data) && data.error
                        ? data.error
                        : `Failed to load report history (${response.status})`
                );
            }

            const normalized = data.map((report) => ({
                ...report,
                isAuto: Boolean(report.isAuto),
            }));

            setReportHistory(normalized);
        } catch (error) {
            setReportHistoryError(
                error instanceof Error ? error.message : 'Failed to load report history.'
            );
        } finally {
            setReportHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadReportHistory();
    }, [loadReportHistory]);

    const openReportModal = useCallback(() => {
        setReportError(null);
        setReportModalPhase('setup');
        setReportModalOpen(true);
    }, []);

    const openHistoryModal = useCallback(() => {
        setHistoryModalOpen(true);
        void loadReportHistory();
    }, [loadReportHistory]);

    const closeHistoryModal = useCallback(() => {
        setHistoryModalOpen(false);
    }, []);

    const closeReportModal = useCallback(() => {
        if (reportLoading) return;
        setReportModalOpen(false);
        setReportError(null);
    }, [reportLoading]);

    const generateStatusReport = useCallback(async () => {
        setReportError(null);
        setReportLoading(true);

        try {
            const response = await fetch('/api/reports/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audience: REPORT_AUDIENCE_BY_OPTION[audience],
                }),
            });

            const data = await response.json() as StatusReportResponse & { error?: string };
            if (!response.ok) {
                throw new Error(data.error || `Request failed (${response.status})`);
            }

            const normalizedReport: StatusReportResponse = {
                ...data,
                isAuto: Boolean(data.isAuto),
            };

            setGeneratedReport(normalizedReport);
            setReportHistory((current) => [
                normalizedReport,
                ...current.filter((report) => report.id !== normalizedReport.id),
            ]);
            setReportModalPhase('result');
        } catch (error) {
            setReportError(
                error instanceof Error
                    ? error.message
                    : 'Failed to generate status report.'
            );
        } finally {
            setReportLoading(false);
        }
    }, [audience]);

    const exportReport = useCallback(async (format: 'markdown' | 'plain' | 'confluence' | 'slack' | 'download') => {
        if (!generatedReport) return;

        try {
            const markdown = generatedReport.content;
            let output = markdown;

            if (format === 'plain') output = toPlainTextReport(markdown);
            if (format === 'confluence') output = toConfluenceReport(markdown);
            if (format === 'slack') output = toSlackReport(markdown);

            if (format === 'download') {
                const filenameSprint = generatedReport.sprintName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
                const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${filenameSprint || 'status-report'}-${generatedReport.audience}.txt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                setCopyToast('Copied! ✓');
                return;
            }

            await navigator.clipboard.writeText(output);
            setCopyToast('Copied! ✓');
        } catch {
            setCopyToast('Copy failed');
        }
    }, [generatedReport]);

    const openHistoryReport = useCallback((report: StatusReportResponse) => {
        setHistoryModalOpen(false);
        setGeneratedReport(report);
        setReportError(null);
        setReportModalPhase('result');
        setReportModalOpen(true);
    }, []);

    const copyHistoryReport = useCallback(async (report: StatusReportResponse) => {
        try {
            await navigator.clipboard.writeText(toPlainTextReport(report.content));
            setCopyToast('Copied! ✓');
        } catch {
            setCopyToast('Copy failed');
        }
    }, []);

    const progressRadius = 92;
    const progressCircumference = 2 * Math.PI * progressRadius;
    const progressOffset = progressCircumference * (1 - clamp(completionPct, 0, 100) / 100);

    const slides = useMemo<SlideDefinition[]>(() => {
        return [
            {
                slideNumber: 1,
                title: `Sprint ${sprintName} — ${completionPct}% Complete`,
                accentColor: '#3B82F6',
                canRegenerate: true,
                content: (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
                            <div style={{ width: 260, display: 'flex', justifyContent: 'center' }}>
                                <div style={{ position: 'relative', width: 220, height: 220 }}>
                                    <svg width="220" height="220" viewBox="0 0 220 220">
                                        <circle
                                            cx="110"
                                            cy="110"
                                            r={progressRadius}
                                            fill="none"
                                            stroke="rgba(148,163,184,0.22)"
                                            strokeWidth="14"
                                        />
                                        <circle
                                            cx="110"
                                            cy="110"
                                            r={progressRadius}
                                            fill="none"
                                            stroke="#3B82F6"
                                            strokeWidth="14"
                                            strokeLinecap="round"
                                            strokeDasharray={progressCircumference}
                                            strokeDashoffset={progressOffset}
                                            transform="rotate(-90 110 110)"
                                        />
                                    </svg>
                                    <div
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'column',
                                        }}
                                    >
                                        <div style={{ color: '#f8fafc', fontSize: 38, fontWeight: 800 }}>{completionPct}%</div>
                                        <div style={{ color: '#93c5fd', fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                            Complete
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{
                                    border: '1px solid rgba(59,130,246,0.34)',
                                    borderRadius: 10,
                                    padding: '12px 14px',
                                    background: 'rgba(59,130,246,0.12)',
                                    fontSize: 20,
                                    color: '#dbeafe',
                                    fontWeight: 700,
                                }}>
                                    ✅ {doneCount} tickets completed
                                </div>

                                <div style={{
                                    border: '1px solid rgba(99,102,241,0.34)',
                                    borderRadius: 10,
                                    padding: '12px 14px',
                                    background: 'rgba(99,102,241,0.12)',
                                    fontSize: 20,
                                    color: '#e0e7ff',
                                    fontWeight: 700,
                                }}>
                                    🔄 {inProgressCount} in progress
                                </div>

                                <div style={{
                                    border: '1px solid rgba(239,68,68,0.34)',
                                    borderRadius: 10,
                                    padding: '12px 14px',
                                    background: 'rgba(239,68,68,0.12)',
                                    fontSize: 20,
                                    color: '#fecaca',
                                    fontWeight: 700,
                                }}>
                                    ⚠️ {blockedCount} blocked
                                </div>

                                <div style={{ color: '#94a3b8', fontSize: 15, marginTop: 6 }}>
                                    {daysRemaining === 0
                                        ? 'Sprint end date not configured'
                                        : `Sprint ends in ${daysRemaining} days`}
                                </div>
                            </div>
                        </div>
                    </>
                ),
            },
            {
                slideNumber: 2,
                title: 'Current Sprint Focus',
                accentColor: '#8B5CF6',
                canRegenerate: true,
                content: (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {topEpics.length === 0 && (
                                <div
                                    style={{
                                        border: '1px dashed rgba(148,163,184,0.35)',
                                        borderRadius: 10,
                                        padding: '14px 16px',
                                        color: '#94a3b8',
                                        fontSize: 15,
                                    }}
                                >
                                    No active epics in current sprint scope.
                                </div>
                            )}

                            {topEpics.map((epic) => (
                                <div key={epic.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 1.2fr auto', gap: 12, alignItems: 'center' }}>
                                    <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 600 }}>
                                        {epic.label}
                                    </div>
                                    <div style={{ height: 12, background: 'rgba(148,163,184,0.2)', borderRadius: 999, overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                width: `${epic.progressPct}%`,
                                                height: '100%',
                                                borderRadius: 999,
                                                background: 'linear-gradient(90deg, rgba(139,92,246,0.7), rgba(167,139,250,0.95))',
                                            }}
                                        />
                                    </div>
                                    <div style={{ color: '#ddd6fe', fontSize: 13, whiteSpace: 'nowrap' }}>
                                        {epic.active} active tickets
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div
                            style={{
                                marginTop: 8,
                                border: '1px solid rgba(139,92,246,0.4)',
                                borderRadius: 10,
                                background: 'rgba(139,92,246,0.14)',
                                color: '#ede9fe',
                                padding: '14px 16px',
                                fontSize: 18,
                                fontWeight: 700,
                            }}
                        >
                            Primary focus: {primaryFocus}
                        </div>
                    </>
                ),
            },
            {
                slideNumber: 3,
                title: 'Blockers That Need Attention',
                accentColor: '#EF4444',
                canRegenerate: true,
                content: (
                    <>
                        {blockedCount === 0 && (
                            <div
                                style={{
                                    border: '1px solid rgba(16,185,129,0.42)',
                                    borderRadius: 10,
                                    background: 'rgba(16,185,129,0.14)',
                                    color: '#86efac',
                                    padding: '12px 14px',
                                    fontSize: 18,
                                    fontWeight: 700,
                                }}
                            >
                                ✅ No blockers!
                            </div>
                        )}

                        {blockedCount > 0 && longBlockedCount > 0 && (
                            <div
                                style={{
                                    border: '1px solid rgba(239,68,68,0.46)',
                                    borderRadius: 10,
                                    background: 'rgba(127,29,29,0.32)',
                                    color: '#fecaca',
                                    padding: '12px 14px',
                                    fontSize: 16,
                                    fontWeight: 700,
                                }}
                            >
                                ⚠️ {longBlockedCount} tickets blocked over 30 days
                            </div>
                        )}

                        {blockedCount > 0 && (
                            <div style={{ border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#94a3b8', letterSpacing: 0.4, textTransform: 'uppercase', background: 'rgba(15,23,42,0.5)' }}>Key</th>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#94a3b8', letterSpacing: 0.4, textTransform: 'uppercase', background: 'rgba(15,23,42,0.5)' }}>Summary</th>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#94a3b8', letterSpacing: 0.4, textTransform: 'uppercase', background: 'rgba(15,23,42,0.5)' }}>Blocked</th>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: '#94a3b8', letterSpacing: 0.4, textTransform: 'uppercase', background: 'rgba(15,23,42,0.5)' }}>Owner</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {blockedTickets.slice(0, 12).map((issue) => (
                                            <tr key={issue.key}>
                                                <td style={{ padding: '10px 12px', borderTop: '1px solid rgba(148,163,184,0.12)', color: '#fca5a5', fontWeight: 700 }}>{issue.key}</td>
                                                <td style={{ padding: '10px 12px', borderTop: '1px solid rgba(148,163,184,0.12)', color: '#e2e8f0' }}>{issue.summary}</td>
                                                <td style={{ padding: '10px 12px', borderTop: '1px solid rgba(148,163,184,0.12)', color: '#fecaca' }}>Blocked {issue.timeInCurrentStatus}d</td>
                                                <td style={{ padding: '10px 12px', borderTop: '1px solid rgba(148,163,184,0.12)', color: '#cbd5e1' }}>{issue.assignee?.displayName || 'Unassigned'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ marginTop: 4, color: '#fca5a5', fontSize: 16, fontWeight: 700 }}>
                            At current pace, {carryOverRiskCount} tickets may not finish this sprint
                        </div>
                    </>
                ),
            },
            {
                slideNumber: 4,
                title: 'Who\'s Working on What',
                accentColor: '#14B8A6',
                canRegenerate: true,
                content: (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {assigneeLoadRows.length === 0 && (
                                <div style={{ border: '1px dashed rgba(148,163,184,0.35)', borderRadius: 10, padding: '12px 14px', color: '#94a3b8' }}>
                                    No active assignee load in current sprint scope.
                                </div>
                            )}

                            {assigneeLoadRows.map((row) => {
                                const widthPct = clamp(Math.round((row.storyPoints / maxAssigneePoints) * 100), 4, 100);
                                const overloaded = row.storyPoints > 13;
                                return (
                                    <div
                                        key={row.key}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '36px minmax(140px, 220px) 1fr auto',
                                            alignItems: 'center',
                                            gap: 10,
                                            border: overloaded ? '1px solid rgba(245,158,11,0.46)' : '1px solid rgba(148,163,184,0.22)',
                                            background: overloaded ? 'rgba(120,53,15,0.24)' : 'rgba(15,23,42,0.35)',
                                            borderRadius: 10,
                                            padding: '10px 12px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: '50%',
                                                background: 'rgba(20,184,166,0.25)',
                                                border: '1px solid rgba(20,184,166,0.45)',
                                                color: '#99f6e4',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 12,
                                                fontWeight: 700,
                                            }}
                                        >
                                            {row.initial}
                                        </div>
                                        <div style={{ color: '#f0fdfa', fontWeight: 600, fontSize: 13 }}>{row.name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ flex: 1, height: 10, borderRadius: 999, background: 'rgba(148,163,184,0.2)', overflow: 'hidden' }}>
                                                <div
                                                    style={{
                                                        width: `${widthPct}%`,
                                                        height: '100%',
                                                        borderRadius: 999,
                                                        background: overloaded
                                                            ? 'linear-gradient(90deg, rgba(245,158,11,0.78), rgba(251,191,36,0.95))'
                                                            : 'linear-gradient(90deg, rgba(20,184,166,0.72), rgba(45,212,191,0.95))',
                                                    }}
                                                />
                                            </div>
                                            <div style={{ color: '#99f6e4', fontSize: 12, minWidth: 56, textAlign: 'right' }}>
                                                {row.storyPoints} pts
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                border: '1px solid rgba(20,184,166,0.4)',
                                                color: '#99f6e4',
                                                borderRadius: 999,
                                                padding: '4px 10px',
                                                fontSize: 12,
                                                fontWeight: 700,
                                                background: 'rgba(20,184,166,0.14)',
                                            }}
                                        >
                                            {row.ticketCount}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: 6, color: '#99f6e4', fontSize: 15, fontWeight: 600 }}>
                            Team has {totalActiveTickets} active tickets across {assigneeCount} people
                        </div>
                    </>
                ),
            },
            {
                slideNumber: 5,
                title: 'Code Quality Signals',
                accentColor: '#10B981',
                canRegenerate: true,
                content: (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                            {[
                                { label: 'Open Bugs', value: String(openBugsCount), inRange: qualityFlags.openBugs },
                                { label: 'Re-open Rate', value: `${reopenRate}%`, inRange: qualityFlags.reopenRate },
                                { label: 'Bounce Rate', value: `${bounceRate}%`, inRange: qualityFlags.bounceRate },
                                { label: 'Cycle Time p50', value: hasCycleData ? `${cycleP50}d` : 'N/A', inRange: qualityFlags.cycleTime },
                            ].map((tile) => (
                                <div
                                    key={tile.label}
                                    style={{
                                        border: tile.inRange ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(245,158,11,0.45)',
                                        background: tile.inRange ? 'rgba(6,78,59,0.2)' : 'rgba(120,53,15,0.2)',
                                        borderRadius: 10,
                                        padding: '12px 14px',
                                    }}
                                >
                                    <div style={{ color: '#94a3b8', fontSize: 12 }}>{tile.label}</div>
                                    <div style={{ color: '#f8fafc', fontSize: 28, fontWeight: 800, marginTop: 2 }}>{tile.value}</div>
                                </div>
                            ))}
                        </div>

                        <div
                            style={{
                                marginTop: 10,
                                border: `1px solid ${qualityTrafficLight.border}`,
                                background: qualityTrafficLight.bg,
                                borderRadius: 10,
                                padding: '12px 14px',
                                color: qualityTrafficLight.color,
                                fontWeight: 700,
                            }}
                        >
                            {qualityTrafficLight.icon} {qualityTrafficLight.label}
                        </div>
                    </>
                ),
            },
            {
                slideNumber: 6,
                title: 'Resolved in the Last 30 Days',
                accentColor: '#22C55E',
                canRegenerate: true,
                content: (
                    <>
                        <div style={{ color: '#dcfce7', fontSize: 46, fontWeight: 800, lineHeight: 1 }}>
                            {resolvedCount} issues resolved
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(127,29,29,0.24)', color: '#fecaca', borderRadius: 999, padding: '6px 12px', fontWeight: 700, fontSize: 13 }}>
                                🐛 {resolvedBugCount} Bugs Fixed
                            </div>
                            <div style={{ border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(6,78,59,0.24)', color: '#bbf7d0', borderRadius: 999, padding: '6px 12px', fontWeight: 700, fontSize: 13 }}>
                                ✨ {resolvedFeatureCount} Features
                            </div>
                            <div style={{ border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(30,58,138,0.24)', color: '#bfdbfe', borderRadius: 999, padding: '6px 12px', fontWeight: 700, fontSize: 13 }}>
                                🔧 {resolvedTaskCount} Tasks
                            </div>
                        </div>

                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {topResolved.length === 0 && (
                                <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No resolved tickets in the last 30 days.</div>
                            )}

                            {topResolved.map((issue) => (
                                <div
                                    key={issue.key}
                                    style={{
                                        border: '1px solid rgba(34,197,94,0.3)',
                                        borderRadius: 10,
                                        background: 'rgba(6,78,59,0.18)',
                                        padding: '10px 12px',
                                        color: '#dcfce7',
                                        fontSize: 14,
                                    }}
                                >
                                    {hideResolvedKeys ? issue.summary : `${issue.key} — ${issue.summary}`}
                                </div>
                            ))}
                        </div>
                    </>
                ),
            },
            {
                slideNumber: 7,
                title: 'Next Sprint Preview',
                accentColor: '#6366F1',
                canRegenerate: true,
                content: (
                    <>
                        <div style={{ color: '#e0e7ff', fontSize: 34, fontWeight: 800 }}>
                            {sprintReadyCount} tickets ready for next sprint
                        </div>

                        <div style={{ color: '#a5b4fc', fontSize: 14 }}>
                            {hasSprintReadyPoints
                                ? `${sprintReadyPointsTotal} story points in sprint-ready scope`
                                : 'Story points unavailable for sprint-ready scope'}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                            {upcomingTopItems.length === 0 && (
                                <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                    No upcoming sprint-ready items found.
                                </div>
                            )}
                            {upcomingTopItems.map((issue) => (
                                <div key={issue.key} style={{ border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(55,48,163,0.2)', borderRadius: 10, padding: '10px 12px', color: '#e0e7ff' }}>
                                    {issue.summary}
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: 8, border: '1px solid rgba(99,102,241,0.45)', background: 'rgba(99,102,241,0.16)', borderRadius: 10, padding: '12px 14px', color: '#c7d2fe', fontWeight: 700 }}>
                            Recommended focus: {slide7Suggestion || slide7SuggestionFallback}
                        </div>

                        {isPmGuideEnabled && (
                            <div style={{ marginTop: 6 }}>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setShowPlanningRealityCheck((prev) => !prev)}
                                >
                                    {showPlanningRealityCheck ? 'Hide' : 'Show'} 📐 Planning Reality Check
                                </button>

                                {showPlanningRealityCheck && (
                                    <div style={{ marginTop: 8, border: '1px solid rgba(148,163,184,0.35)', background: 'rgba(15,23,42,0.42)', borderRadius: 10, padding: '12px 14px', color: '#cbd5e1', fontSize: 13 }}>
                                        <div style={{ fontWeight: 700, marginBottom: 6 }}>📐 Planning Reality Check</div>
                                        <div>Raw estimate: {rawEstimateSprints} sprints</div>
                                        <div>Realistic delivery: {realisticEstimateLow}-{realisticEstimateHigh} sprints</div>
                                        <div style={{ color: '#94a3b8', marginTop: 4 }}>(includes QA, iteration, integration time)</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ),
            },
            {
                slideNumber: 8,
                title: 'What This Sprint Cost & Delivered',
                accentColor: '#F59E0B',
                canRegenerate: true,
                content: (
                    <>
                        {teamConfigLoading && (
                            <div style={{ border: '1px dashed rgba(148,163,184,0.35)', borderRadius: 10, padding: '12px 14px', color: '#94a3b8' }}>
                                Loading team configuration...
                            </div>
                        )}

                        {!teamConfigLoading && !isTeamConfigSet && (
                            <div style={{ border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(120,53,15,0.24)', borderRadius: 10, padding: '14px 16px', color: '#fcd34d', fontWeight: 600 }}>
                                Configure team size in Settings -&gt; Team Configuration to unlock cost estimates.{' '}
                                <Link href="/settings#team-configuration" style={{ color: '#fde68a', textDecoration: 'underline' }}>
                                    Go to Settings
                                </Link>
                            </div>
                        )}

                        {!teamConfigLoading && isTeamConfigSet && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                                <div style={{ border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(120,53,15,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                                    <div style={{ color: '#fbbf24', fontSize: 12 }}>Estimated Sprint Investment <span title="Based on your team config settings" style={{ cursor: 'help' }}>(i)</span></div>
                                    <div style={{ color: '#fef3c7', fontSize: 30, fontWeight: 800 }}>{formatUsdCompact(sprintInvestment)}</div>
                                </div>

                                <div style={{ border: '1px solid rgba(148,163,184,0.35)', background: 'rgba(15,23,42,0.45)', borderRadius: 10, padding: '12px 14px' }}>
                                    <div style={{ color: '#94a3b8', fontSize: 12 }}>Cost per resolved ticket</div>
                                    <div style={{ color: '#f8fafc', fontSize: 24, fontWeight: 800 }}>
                                        {costPerResolved === null ? 'No tickets resolved yet' : formatUsd(costPerResolved)}
                                    </div>
                                </div>

                                <div style={{ border: `1px solid ${deliveryEfficiencyColor}55`, background: 'rgba(15,23,42,0.45)', borderRadius: 10, padding: '12px 14px' }}>
                                    <div style={{ color: '#94a3b8', fontSize: 12 }}>Delivery efficiency</div>
                                    <div style={{ color: deliveryEfficiencyColor, fontSize: 30, fontWeight: 800 }}>
                                        {deliveryEfficiency}%
                                    </div>
                                </div>

                                <div style={{ border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(127,29,29,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                                    <div style={{ color: '#fca5a5', fontSize: 12 }}>Carry-over cost</div>
                                    <div style={{ color: '#fecaca', fontSize: 24, fontWeight: 800 }}>{formatUsd(carryOverCost)}</div>
                                </div>
                            </div>
                        )}
                    </>
                ),
            },
        ];
    }, [
        assigneeCount,
        assigneeLoadRows,
        blockedCount,
        blockedTickets,
        carryOverCost,
        carryOverRiskCount,
        completionPct,
        costPerResolved,
        daysRemaining,
        deliveryEfficiency,
        deliveryEfficiencyColor,
        doneCount,
        hasSprintReadyPoints,
        hideResolvedKeys,
        inProgressCount,
        isTeamConfigSet,
        longBlockedCount,
        maxAssigneePoints,
        openBugsCount,
        isPmGuideEnabled,
        primaryFocus,
        progressCircumference,
        progressOffset,
        qualityFlags.bounceRate,
        qualityFlags.cycleTime,
        qualityFlags.openBugs,
        qualityFlags.reopenRate,
        qualityTrafficLight.bg,
        qualityTrafficLight.border,
        qualityTrafficLight.color,
        qualityTrafficLight.icon,
        qualityTrafficLight.label,
        rawEstimateSprints,
        realisticEstimateHigh,
        realisticEstimateLow,
        reopenRate,
        resolvedBugCount,
        resolvedCount,
        resolvedFeatureCount,
        resolvedTaskCount,
        showPlanningRealityCheck,
        slide7Suggestion,
        slide7SuggestionFallback,
        sprintInvestment,
        sprintName,
        sprintReadyCount,
        sprintReadyPointsTotal,
        teamConfigLoading,
        topEpics,
        topResolved,
        totalActiveTickets,
        upcomingTopItems,
        bounceRate,
        cycleP50,
        hasCycleData,
    ]);

    const currentSlideDefinition = slides[currentSlide - 1];

    return (
        <div ref={slideshowRef} style={{ minHeight: '100%', background: presentMode ? '#060E1E' : 'transparent' }}>
            {!presentMode && (
                <div className="page-header" style={{ paddingBottom: 20 }}>
                    <div style={{ paddingBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                            <h1 className="page-title">📊 PM Slideshow</h1>
                            <p className="page-subtitle">Edit mode shows all slides and speaker notes. Present mode shows one slide at a time.</p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 12 }}>
                                <input
                                    type="checkbox"
                                    checked={isPmGuideEnabled}
                                    onChange={togglePmGuide}
                                    style={{ accentColor: 'var(--accent)' }}
                                />
                                PM Guide
                            </label>

                            <select
                                className="input"
                                value={audience}
                                onChange={(event) => setAudience(event.target.value as AudienceOption)}
                                style={{ minWidth: 200 }}
                            >
                                {AUDIENCE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>

                            <button className="btn btn-secondary" onClick={openReportModal}>
                                📄 Generate Report
                            </button>

                            <button className="btn btn-secondary" onClick={openHistoryModal} aria-label="Open report history">
                                🔔
                            </button>

                            <button className="btn btn-primary" onClick={() => { void enterPresentMode(); }}>
                                <Maximize2 size={15} />
                                Present Mode
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isPmGuideEnabled && (
                <div style={{ padding: presentMode ? '0 22px' : '0 32px' }}>
                    <div
                        style={{
                            border: '1px solid rgba(245,158,11,0.5)',
                            background: 'rgba(245,158,11,0.16)',
                            color: '#fcd34d',
                            borderRadius: 10,
                            padding: '10px 14px',
                            fontSize: 13,
                            fontWeight: 600,
                            marginBottom: 10,
                        }}
                    >
                        🎓 PM Guide is ON - speaker notes include coaching context and talking points for each slide.
                    </div>
                </div>
            )}

            <div style={{ padding: presentMode ? '18px 22px' : '24px 32px' }}>
                {presentMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setCurrentSlide((prev) => clamp(prev - 1, 1, TOTAL_SLIDES))}
                                    disabled={currentSlide <= 1}
                                >
                                    <ChevronLeft size={16} />
                                </button>

                                <div style={{
                                    border: '1px solid rgba(148,163,184,0.35)',
                                    borderRadius: 999,
                                    padding: '6px 12px',
                                    color: '#cbd5e1',
                                    fontSize: 13,
                                    fontWeight: 700,
                                }}>
                                    {currentSlide} / {TOTAL_SLIDES}
                                </div>

                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setCurrentSlide((prev) => clamp(prev + 1, 1, TOTAL_SLIDES))}
                                    disabled={currentSlide >= TOTAL_SLIDES}
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#cbd5e1', fontSize: 12 }}>
                                    <input
                                        type="checkbox"
                                        checked={isPmGuideEnabled}
                                        onChange={togglePmGuide}
                                        style={{ accentColor: '#6366f1' }}
                                    />
                                    PM Guide
                                </label>

                                <select
                                    className="input"
                                    value={audience}
                                    onChange={(event) => setAudience(event.target.value as AudienceOption)}
                                    style={{ minWidth: 210 }}
                                >
                                    {AUDIENCE_OPTIONS.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>

                                <button className="btn btn-secondary" onClick={() => { void exitPresentMode(); }}>
                                    <Minimize2 size={15} />
                                    Exit Present
                                </button>
                            </div>
                        </div>

                        {currentSlideDefinition && (
                            <Slide
                                slideNumber={currentSlideDefinition.slideNumber}
                                title={currentSlideDefinition.title}
                                accentColor={currentSlideDefinition.accentColor}
                                speakerNotes={slideNotes[currentSlideDefinition.slideNumber] || ''}
                                audience={audience}
                                editMode={false}
                            >
                                {currentSlideDefinition.content}
                            </Slide>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {slides.map((slide) => (
                            <Slide
                                key={slide.slideNumber}
                                slideNumber={slide.slideNumber}
                                title={slide.title}
                                accentColor={slide.accentColor}
                                speakerNotes={slideNotes[slide.slideNumber] || ''}
                                audience={audience}
                                onSpeakerNotesChange={(value) => {
                                    setSlideNotes((prev) => ({ ...prev, [slide.slideNumber]: value }));
                                }}
                                onRegenerate={slide.canRegenerate
                                    ? () => regenerateSpeakerNotes(slide.slideNumber)
                                    : undefined}
                                regenerating={Boolean(regeneratingBySlide[slide.slideNumber])}
                                editMode
                            >
                                {slide.content}
                            </Slide>
                        ))}
                    </div>
                )}
            </div>

            {reportModalOpen && !presentMode && (
                <div
                    role="dialog"
                    aria-modal="true"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(2,6,23,0.72)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                        zIndex: 1200,
                    }}
                    onClick={closeReportModal}
                >
                    <div
                        style={{
                            width: 'min(980px, 100%)',
                            maxHeight: '90vh',
                            overflow: 'hidden',
                            borderRadius: 14,
                            border: '1px solid rgba(148,163,184,0.35)',
                            background: '#0b1222',
                            boxShadow: '0 28px 60px rgba(2,6,23,0.55)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div
                            style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid rgba(148,163,184,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                            }}
                        >
                            <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 16 }}>
                                {reportModalPhase === 'setup' ? '📄 Generate Status Report' : '📄 Status Report Preview'}
                            </div>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={closeReportModal}
                                disabled={reportLoading}
                                aria-label="Close report modal"
                            >
                                ✕
                            </button>
                        </div>

                        {reportModalPhase === 'setup' ? (
                            <div style={{ padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
                                    Generate an audience-specific markdown status report from current sprint metrics, quality signals,
                                    delivery progress, blockers, and team configuration cost estimates.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ color: '#cbd5e1', fontSize: 12 }}>Audience</label>
                                    <select
                                        className="input"
                                        value={audience}
                                        onChange={(event) => setAudience(event.target.value as AudienceOption)}
                                        style={{ maxWidth: 240 }}
                                    >
                                        {AUDIENCE_MODAL_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {reportError && (
                                    <div style={{ color: '#fca5a5', fontSize: 12 }}>
                                        {reportError}
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={closeReportModal}
                                        disabled={reportLoading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => { void generateStatusReport(); }}
                                        disabled={reportLoading}
                                    >
                                        {reportLoading ? 'Generating…' : 'Generate'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                <div style={{ padding: '14px 18px 10px', color: '#94a3b8', fontSize: 12 }}>
                                    {generatedReport
                                        ? `Audience: ${generatedReport.audience} • Generated: ${new Date(generatedReport.generatedAt).toLocaleString()}`
                                        : 'No report generated.'}
                                </div>

                                <div style={{ padding: '0 18px 12px' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => { void exportReport('markdown'); }}
                                            disabled={!generatedReport}
                                        >
                                            Copy Markdown
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => { void exportReport('plain'); }}
                                            disabled={!generatedReport}
                                        >
                                            Copy Plain Text
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => { void exportReport('confluence'); }}
                                            disabled={!generatedReport}
                                        >
                                            Copy for Confluence
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => { void exportReport('slack'); }}
                                            disabled={!generatedReport}
                                        >
                                            Copy for Slack
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => { void exportReport('download'); }}
                                            disabled={!generatedReport}
                                        >
                                            Download .txt
                                        </button>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        margin: '0 18px 18px',
                                        border: '1px solid rgba(148,163,184,0.25)',
                                        borderRadius: 10,
                                        background: 'rgba(15,23,42,0.45)',
                                        padding: '14px 14px',
                                        overflowY: 'auto',
                                        minHeight: 220,
                                        maxHeight: '58vh',
                                    }}
                                >
                                    {generatedReport
                                        ? renderMarkdownPreview(generatedReport.content)
                                        : <div style={{ color: '#94a3b8', fontSize: 13 }}>No report content.</div>}
                                </div>

                                <div
                                    style={{
                                        borderTop: '1px solid rgba(148,163,184,0.2)',
                                        padding: '12px 18px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        gap: 8,
                                    }}
                                >
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            setReportError(null);
                                            setReportModalPhase('setup');
                                        }}
                                        disabled={reportLoading}
                                    >
                                        Back
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={closeReportModal}
                                        disabled={reportLoading}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {historyModalOpen && !presentMode && (
                <div
                    role="dialog"
                    aria-modal="true"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(2,6,23,0.72)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                        zIndex: 1190,
                    }}
                    onClick={closeHistoryModal}
                >
                    <div
                        style={{
                            width: 'min(980px, 100%)',
                            maxHeight: '90vh',
                            overflow: 'hidden',
                            borderRadius: 14,
                            border: '1px solid rgba(148,163,184,0.35)',
                            background: '#0b1222',
                            boxShadow: '0 28px 60px rgba(2,6,23,0.55)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div
                            style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid rgba(148,163,184,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                            }}
                        >
                            <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 16 }}>
                                📋 Report History
                            </div>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={closeHistoryModal}
                                aria-label="Close report history modal"
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ padding: 16, overflowY: 'auto', maxHeight: '80vh' }}>
                            {reportHistoryLoading && (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                    Loading recent reports...
                                </div>
                            )}

                            {!reportHistoryLoading && reportHistoryError && (
                                <div style={{ fontSize: 13, color: 'var(--danger)' }}>
                                    {reportHistoryError}
                                </div>
                            )}

                            {!reportHistoryLoading && !reportHistoryError && reportHistory.length === 0 && (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                    No status reports generated yet.
                                </div>
                            )}

                            {!reportHistoryLoading && !reportHistoryError && reportHistory.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {reportHistory.slice(0, 5).map((report) => {
                                        const plain = toPlainTextReport(report.content);
                                        const preview = plain.length > 100 ? `${plain.slice(0, 100)}...` : plain;

                                        return (
                                            <div
                                                key={report.id}
                                                style={{
                                                    border: '1px solid rgba(148,163,184,0.2)',
                                                    background: 'rgba(15,23,42,0.3)',
                                                    borderRadius: 10,
                                                    padding: '12px 14px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: 8,
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                                    <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700 }}>
                                                        {formatReportTimestamp(report.generatedAt)}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                        <span
                                                            style={{
                                                                border: '1px solid rgba(59,130,246,0.45)',
                                                                background: 'rgba(30,64,175,0.22)',
                                                                color: '#bfdbfe',
                                                                borderRadius: 999,
                                                                padding: '3px 10px',
                                                                fontSize: 11,
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {AUDIENCE_BADGE_LABEL[report.audience]}
                                                        </span>
                                                        {report.isAuto && (
                                                            <span
                                                                style={{
                                                                    border: '1px solid rgba(34,197,94,0.45)',
                                                                    background: 'rgba(6,78,59,0.25)',
                                                                    color: '#bbf7d0',
                                                                    borderRadius: 999,
                                                                    padding: '3px 10px',
                                                                    fontSize: 11,
                                                                    fontWeight: 700,
                                                                }}
                                                            >
                                                                🤖 Auto
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div style={{ color: '#cbd5e1', fontSize: 12 }}>
                                                    Sprint: <strong>{report.sprintName}</strong>
                                                </div>

                                                <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>
                                                    {preview || 'No preview available.'}
                                                </div>

                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => openHistoryReport(report)}
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => { void copyHistoryReport(report); }}
                                                    >
                                                        Copy
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {copyToast && (
                <div
                    style={{
                        position: 'fixed',
                        right: 18,
                        bottom: 18,
                        zIndex: 1300,
                        borderRadius: 8,
                        border: '1px solid rgba(16,185,129,0.4)',
                        background: 'rgba(6,78,59,0.95)',
                        color: '#bbf7d0',
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '8px 10px',
                    }}
                >
                    {copyToast}
                </div>
            )}
        </div>
    );
}
