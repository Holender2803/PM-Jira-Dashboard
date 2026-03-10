'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore, useFilteredIssues } from '@/store/app-store';
import { CLOSED_STATUSES, ACTIVE_STATUSES } from '@/lib/workflow';
import { StatCard, ProgressBar } from '@/components/ui/Badges';
import FilterBar from '@/components/filters/FilterBar';
import {
    StatusChart, IssueTypePieChart, WorkflowFunnelChart, AssigneeChart
} from '@/components/charts/DashboardCharts';
import IssueTable from '@/components/tables/IssueTable';
import { CheckCircle, AlertTriangle, TrendingUp, Zap, Bug, Clock, Layers, RefreshCw, Minimize2, Maximize2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatTimeForDisplay } from '@/lib/time';

interface BriefingTopBlocker {
    key: string;
    summary: string;
    daysBlocked: number;
}

interface BriefingInput {
    completionRate: number;
    daysRemaining: number;
    sprintHasEnded: boolean;
    blockedCount: number;
    carryOverRisk: number;
    topBlockers: BriefingTopBlocker[];
}

function truncateText(value: string, maxChars: number): { text: string; truncated: boolean } {
    if (value.length <= maxChars) {
        return { text: value, truncated: false };
    }
    const safe = Math.max(0, maxChars - 3);
    return {
        text: `${value.slice(0, safe).trimEnd()}...`,
        truncated: true,
    };
}

function sanitizeBriefingText(content: string): string {
    if (!content) return '';

    const normalized = content
        .split('\n')
        .map((line) =>
            line
                .replace(/^\s*[-*•]\s*/, '')
                .replace(/^\s*\d+\.\s*/, '')
                .replace(/^#+\s*/, '')
                .trim()
        )
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) return '';

    const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
    return sentences.slice(0, 3).join(' ').trim();
}

function buildFallbackBriefing({
    completionRate,
    daysRemaining,
    sprintHasEnded,
    blockedCount,
    carryOverRisk,
    topBlockers,
}: BriefingInput): string {
    const remainingText = sprintHasEnded
        ? 'sprint has ended'
        : daysRemaining > 0
        ? `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`
        : 'sprint end date not configured';
    const riskLabel = carryOverRisk === 1 ? 'ticket' : 'tickets';
    const topPriority = topBlockers[0]
        ? `Top priority today: unblock ${topBlockers[0].key} before end of day.`
        : 'Top priority today: close active in-flight items and protect scope.';

    const blockerSentence = blockedCount > 0 && topBlockers[0]
        ? `${carryOverRisk} ${riskLabel} are at carry-over risk and ${blockedCount} blocked, with ${topBlockers[0].key} blocked for ${topBlockers[0].daysBlocked} days.`
        : `${carryOverRisk} ${riskLabel} are at carry-over risk and there are no blocked tickets.`;

    return [
        `Sprint is ${completionRate}% complete with ${remainingText}.`,
        blockerSentence,
        topPriority,
    ].join(' ');
}

export default function OverviewPage() {
    const { issues, isLoading, demoMode, lastSynced, activeSprints } = useAppStore();
    const filtered = useFilteredIssues();
    const router = useRouter();

    const [briefing, setBriefing] = useState('');
    const [briefingLoading, setBriefingLoading] = useState(false);
    const [briefingCollapsed, setBriefingCollapsed] = useState(false);
    const [briefingExpanded, setBriefingExpanded] = useState(false);
    const [briefingError, setBriefingError] = useState<string | null>(null);

    const sprintIssues = useMemo(
        () => issues.filter((issue) => issue.sprint?.state === 'active'),
        [issues]
    );
    const activeSprintFromIssues = sprintIssues[0]?.sprint || null;
    const activeSprintFromStore = useMemo(
        () => activeSprints.find((sprint) => sprint.state === 'active') || null,
        [activeSprints]
    );
    const activeSprint = useMemo(
        () => {
            if (activeSprintFromIssues?.endDate) return activeSprintFromIssues;
            if (activeSprintFromStore) return activeSprintFromStore;
            return activeSprintFromIssues;
        },
        [activeSprintFromIssues, activeSprintFromStore]
    );
    const prevSprintIssues = useMemo(
        () => issues.filter((issue) => issue.sprint?.state === 'closed'),
        [issues]
    );

    const done = useMemo(
        () => sprintIssues.filter((issue) => CLOSED_STATUSES.includes(issue.status)),
        [sprintIssues]
    );
    const active = useMemo(
        () => sprintIssues.filter((issue) => ACTIVE_STATUSES.includes(issue.status)),
        [sprintIssues]
    );
    const bugs = useMemo(
        () => issues.filter((issue) => issue.issueType === 'Bug' && !CLOSED_STATUSES.includes(issue.status)),
        [issues]
    );

    const sprintInProgress = useMemo(
        () => sprintIssues.filter((issue) => issue.status === 'In Progress'),
        [sprintIssues]
    );
    const sprintInReview = useMemo(
        () => sprintIssues.filter((issue) => ['In Review', 'Reviewed'].includes(issue.status)),
        [sprintIssues]
    );
    const sprintInQA = useMemo(
        () => sprintIssues.filter((issue) => ['Ready for QA', 'In QA'].includes(issue.status)),
        [sprintIssues]
    );
    const sprintNotDone = useMemo(
        () => sprintIssues.filter((issue) => !CLOSED_STATUSES.includes(issue.status)),
        [sprintIssues]
    );

    const completionRate = sprintIssues.length > 0 ? Math.round((done.length / sprintIssues.length) * 100) : 0;
    const carryOverRisk = Math.max(
        0,
        sprintNotDone.length - sprintInProgress.length - sprintInReview.length - sprintInQA.length
    );

    const prevDone = useMemo(
        () => prevSprintIssues.filter((issue) => CLOSED_STATUSES.includes(issue.status)),
        [prevSprintIssues]
    );
    const prevRate = prevSprintIssues.length > 0 ? Math.round((prevDone.length / prevSprintIssues.length) * 100) : 0;
    const rateChange = prevRate > 0 ? Math.round(completionRate - prevRate) : undefined;

    const blockers = useMemo(
        () => issues.filter((issue) => issue.status === 'Blocked'),
        [issues]
    );
    const releaseReady = useMemo(
        () => issues.filter((issue) => ['Ready for Release', 'Ready for Acceptance'].includes(issue.status)),
        [issues]
    );
    const inQA = useMemo(
        () => issues.filter((issue) => ['Ready for QA', 'In QA'].includes(issue.status)),
        [issues]
    );

    const daysRemainingInfo = useMemo(() => {
        const endDateRaw = activeSprint?.endDate;
        if (!endDateRaw) {
            return { value: 0, hasEnded: false, configured: false };
        }

        const endDate = new Date(endDateRaw);
        if (Number.isNaN(endDate.getTime())) {
            return { value: 0, hasEnded: false, configured: false };
        }

        const msPerDay = 1000 * 60 * 60 * 24;
        const days = Math.ceil((endDate.getTime() - new Date().getTime()) / msPerDay);
        if (days < 0) {
            return { value: 0, hasEnded: true, configured: true };
        }

        return { value: days, hasEnded: false, configured: true };
    }, [activeSprint?.endDate]);

    const sprintName = activeSprint?.name || 'Current Sprint';

    useEffect(() => {
        console.log('Sprint object:', activeSprint);
    }, [activeSprint]);

    const topBlockers = useMemo<BriefingTopBlocker[]>(
        () =>
            [...blockers]
                .sort((a, b) => b.timeInCurrentStatus - a.timeInCurrentStatus)
                .slice(0, 2)
                .map((issue) => ({
                    key: issue.key,
                    summary: issue.summary,
                    daysBlocked: issue.timeInCurrentStatus,
                })),
        [blockers]
    );

    const fallbackBriefing = useMemo(
        () =>
            buildFallbackBriefing({
                completionRate,
                daysRemaining: daysRemainingInfo.value,
                sprintHasEnded: daysRemainingInfo.hasEnded,
                blockedCount: blockers.length,
                carryOverRisk,
                topBlockers,
            }),
        [
            blockers.length,
            carryOverRisk,
            completionRate,
            daysRemainingInfo.hasEnded,
            daysRemainingInfo.value,
            topBlockers,
        ]
    );

    const longestBlocked = topBlockers[0];
    const daysRemainingForPrompt = daysRemainingInfo.hasEnded
        ? 'sprint has ended'
        : daysRemainingInfo.configured
            ? String(daysRemainingInfo.value)
            : 'sprint end date not configured';

    const briefingPrompt = useMemo(
        () => `
Sprint: ${sprintName}
Completion: ${completionRate}%
Days remaining: ${daysRemainingForPrompt}
Blocked tickets: ${blockers.length}
Carry-over risk: ${carryOverRisk} tickets
Longest blocked: ${longestBlocked?.key || 'None'} at ${longestBlocked?.daysBlocked || 0} days

Write the 3-sentence morning briefing now.
No lists, no headers, plain sentences only.
`.trim(),
        [
            blockers.length,
            carryOverRisk,
            completionRate,
            daysRemainingForPrompt,
            longestBlocked?.daysBlocked,
            longestBlocked?.key,
            sprintName,
        ]
    );

    const generateBriefing = useCallback(async () => {
        if (isLoading) return;
        setBriefingLoading(true);
        setBriefingError(null);

        try {
            const response = await fetch('/api/ai/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'morning_briefing',
                    tone: 'executive',
                    issueKeys: [],
                    sprintName,
                    customInstructions: briefingPrompt,
                }),
            });

            if (!response.ok) {
                throw new Error(`AI briefing request failed (${response.status})`);
            }

            const data = await response.json();
            const cleaned = sanitizeBriefingText(data?.content || '');
            setBriefing(cleaned || fallbackBriefing);
            setBriefingExpanded(false);
        } catch {
            setBriefing(fallbackBriefing);
            setBriefingExpanded(false);
            setBriefingError('Live AI briefing is unavailable. Showing a metrics-based fallback.');
        } finally {
            setBriefingLoading(false);
        }
    }, [briefingPrompt, fallbackBriefing, isLoading, sprintName]);

    useEffect(() => {
        void generateBriefing();
    }, [generateBriefing]);

    const briefingSummary = useMemo(() => {
        const source = briefing || fallbackBriefing;
        const firstSentence = source.split(/(?<=[.!?])\s+/)[0] || source;
        return firstSentence.length > 180 ? `${firstSentence.slice(0, 177)}...` : firstSentence;
    }, [briefing, fallbackBriefing]);

    const fullBriefing = briefing || fallbackBriefing;
    const briefingTruncate = useMemo(() => truncateText(fullBriefing, 500), [fullBriefing]);
    const displayedBriefing = briefingExpanded ? fullBriefing : briefingTruncate.text;
    const isBriefingTruncated = briefingTruncate.truncated;

    const carryOverCardColor = carryOverRisk > 5 ? '#ef4444' : carryOverRisk > 0 ? '#f59e0b' : '#10b981';
    const carryOverCardStyle = carryOverRisk > 5
        ? { background: 'rgba(127, 29, 29, 0.28)', border: '1px solid rgba(239, 68, 68, 0.45)' }
        : carryOverRisk > 0
            ? { background: 'rgba(120, 53, 15, 0.28)', border: '1px solid rgba(245, 158, 11, 0.4)' }
            : { background: 'rgba(6, 78, 59, 0.28)', border: '1px solid rgba(16, 185, 129, 0.42)' };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
                <div style={{ width: 40, height: 40 }}>
                    <svg viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite', width: '100%' }}>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        <circle cx="12" cy="12" r="10" stroke="rgba(99,102,241,0.2)" strokeWidth="3" fill="none" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" fill="none" />
                    </svg>
                </div>
                <p style={{ color: 'var(--text-secondary)' }}>Loading MDFM Analytics…</p>
            </div>
        );
    }

    return (
        <div>
            {/* Demo banner */}
            {demoMode && (
                <div className="demo-banner">
                    <span>⚡</span>
                    <span><strong>Demo Mode</strong> — Showing sample MDFM team data. Connect your Jira in Settings to see real data.</span>
                </div>
            )}

            {/* Page Header */}
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16 }}>
                    <div>
                        <h1 className="page-title">📊 PM Overview</h1>
                        <p className="page-subtitle">
                            {activeSprint ? `${activeSprint.name} · ` : ''}{sprintIssues.length} sprint tickets
                            {lastSynced && <span style={{ marginLeft: 8, opacity: 0.6 }}>· Updated {formatTimeForDisplay(lastSynced, { includeZone: true })}</span>}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => router.push('/ai-reports')}>
                            ✨ AI Summary
                        </button>
                    </div>
                </div>
            </div>

            <FilterBar />

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div
                    className="card"
                    style={{
                        padding: '18px 20px',
                        borderColor: 'rgba(99, 102, 241, 0.35)',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.16), rgba(22,22,42,0.92))',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Today&apos;s Briefing</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                                Generated from current sprint momentum, blockers, and carry-over risk.
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => void generateBriefing()}
                                disabled={briefingLoading}
                                title="Regenerate briefing"
                                style={{ padding: 6 }}
                            >
                                <RefreshCw size={14} style={{ animation: briefingLoading ? 'spin 0.8s linear infinite' : undefined }} />
                            </button>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setBriefingCollapsed((value) => !value)}
                                style={{ padding: '5px 8px' }}
                            >
                                {briefingCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                                {briefingCollapsed ? 'Expand' : 'Minimize'}
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                        {briefingLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div className="briefing-skeleton-line" style={{ width: '94%' }} />
                                <div className="briefing-skeleton-line" style={{ width: '88%' }} />
                                <div className="briefing-skeleton-line" style={{ width: '76%' }} />
                            </div>
                        ) : (
                            <p
                                style={{
                                    fontSize: 14,
                                    lineHeight: 1.55,
                                    color: 'var(--text-primary)',
                                    whiteSpace: briefingCollapsed ? 'nowrap' : 'normal',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                                title={isBriefingTruncated ? fullBriefing : undefined}
                            >
                                {briefingCollapsed ? briefingSummary : displayedBriefing}
                            </p>
                        )}
                        {!briefingLoading && !briefingCollapsed && isBriefingTruncated && (
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setBriefingExpanded((value) => !value)}
                                style={{ marginTop: 8, padding: 0 }}
                                title={briefingExpanded ? undefined : fullBriefing}
                            >
                                {briefingExpanded ? 'Show less' : 'Show full'}
                            </button>
                        )}
                        {briefingError && !briefingLoading && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{briefingError}</div>
                        )}
                    </div>
                </div>

                {/* Sprint Health Metrics */}
                {activeSprint && (
                    <div>
                        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                            Sprint Health — {activeSprint.name}
                        </h2>
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Completion Rate</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: completionRate > 60 ? 'var(--success)' : 'var(--warning)' }}>
                                    {completionRate}%
                                </span>
                            </div>
                            <ProgressBar value={completionRate} color={completionRate > 60 ? '#10b981' : '#f59e0b'} height={8} />
                        </div>
                        <div className="dashboard-grid grid-4">
                            <StatCard label="Committed" value={sprintIssues.length} color="#6366f1" icon={<Layers size={16} />} onClick={() => router.push('/sprint')} />
                            <StatCard
                                label="Carry-over Risk"
                                value={carryOverRisk}
                                color={carryOverCardColor}
                                icon={carryOverRisk > 0 ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                                style={carryOverCardStyle}
                                onClick={() => router.push('/sprint')}
                            />
                            <StatCard label="Done" value={done.length} color="#10b981" change={rateChange} icon={<CheckCircle size={16} />} onClick={() => router.push('/sprint')} />
                            <StatCard label="Active" value={active.length} color="#3b82f6" icon={<Zap size={16} />} onClick={() => router.push('/focus')} />
                        </div>
                    </div>
                )}

                {/* Key Numbers */}
                <div>
                    <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                        Team Snapshot
                    </h2>
                    <div className="dashboard-grid grid-4">
                        <StatCard label="Open Bugs" value={bugs.length} color="#ef4444" icon={<Bug size={16} />} onClick={() => router.push('/bugs')} />
                        <StatCard label="Blockers" value={blockers.length} color="#f97316" icon={<AlertTriangle size={16} />} onClick={() => router.push('/focus')} />
                        <StatCard label="In QA" value={inQA.length} color="#22c55e" icon={<CheckCircle size={16} />} onClick={() => router.push('/workflow')} />
                        <StatCard label="Release Ready" value={releaseReady.length} color="#06b6d4" icon={<TrendingUp size={16} />} onClick={() => router.push('/workflow')} />
                    </div>
                </div>

                {/* Charts */}
                <div className="dashboard-grid grid-2">
                    <StatusChart issues={filtered} showIncludeDoneToggle />
                    <WorkflowFunnelChart issues={issues} activeOnlyView />
                </div>

                <div className="dashboard-grid grid-2">
                    <IssueTypePieChart issues={filtered} />
                    <AssigneeChart issues={issues} />
                </div>

                {/* Attention needed */}
                <div>
                    <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
                        Needs Attention
                    </h2>
                    <div className="dashboard-grid grid-3">
                        {/* Blocked */}
                        <div className="card">
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 10 }}>🚧 Blocked ({blockers.length})</div>
                            {blockers.slice(0, 4).map(i => (
                                <div key={i.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{i.summary}</span>
                                    <span style={{ color: 'var(--danger)', fontSize: 11, flexShrink: 0 }}>{i.timeInCurrentStatus}d</span>
                                </div>
                            ))}
                            {blockers.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>✅ No blockers!</p>}
                        </div>

                        {/* Aging */}
                        <div className="card">
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 10 }}>
                                ⏰ Aging 30d+ ({issues.filter(i => i.age > 30 && !CLOSED_STATUSES.includes(i.status)).length})
                            </div>
                            {issues.filter(i => i.age > 30 && !CLOSED_STATUSES.includes(i.status)).slice(0, 4).map(i => (
                                <div key={i.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{i.summary}</span>
                                    <span style={{ color: 'var(--warning)', fontSize: 11, flexShrink: 0 }}>{i.age}d</span>
                                </div>
                            ))}
                        </div>

                        {/* Release Ready */}
                        <div className="card">
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#06b6d4', marginBottom: 10 }}>🚀 Release Ready ({releaseReady.length})</div>
                            {releaseReady.slice(0, 4).map(i => (
                                <div key={i.key} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                                    <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.summary}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{i.key}</div>
                                </div>
                            ))}
                            {releaseReady.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No release-ready tickets yet</p>}
                        </div>
                    </div>
                </div>

                {/* Recent table */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                            <Clock size={14} style={{ display: 'inline', marginRight: 6 }} />
                            Recently Updated
                        </h2>
                        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/tickets')}>
                            View all →
                        </button>
                    </div>
                    <IssueTable issues={filtered} maxRows={8} compact />
                </div>
            </div>
        </div>
    );
}
