'use client';
import { useEffect, useMemo, useState } from 'react';
import { addDays, endOfDay, format, startOfWeek, subDays, subWeeks } from 'date-fns';
import { useAppStore, useFilteredIssues } from '@/store/app-store';
import FilterBar from '@/components/filters/FilterBar';
import { PriorityBadge, StatCard, StatusBadge } from '@/components/ui/Badges';
import IssueKeyButton from '@/components/tables/IssueKeyButton';
import { calculateBugMetrics, getReopenRates } from '@/lib/analytics';
import { ACTIVE_STATUSES, CLOSED_STATUSES } from '@/lib/workflow';
import { BugPriorityChart } from '@/components/charts/DashboardCharts';
import ReopenRateCard from '@/components/ReopenRateCard';
import {
    calculateBugEscapeRate,
    DEFAULT_BUG_TRACKING_CONFIG,
    type BugTrackingConfig,
} from '@/lib/bug-tracking';
import { Check, Copy, ExternalLink, Info, X } from 'lucide-react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend,
    BarChart,
    Bar,
} from 'recharts';

type OldestSortOrder = 'age_desc' | 'age_asc';
type CopyState = 'idle' | 'copied' | 'error';
type MttrWindow = '30d' | '90d' | 'all';
type BugCardModalKind = 'open' | 'in_progress' | 'closed' | 'total';
type BugPriorityBucket = 'Emergency' | 'High' | 'Medium' | 'Low' | 'None';

interface AreaTooltipPayload {
    area: string;
    areaFull: string;
    tooltip: string;
    epicKey: string | null;
    count: number;
}

interface MttrRow {
    resolvedAt: Date;
    resolutionDays: number;
}

interface BugTicketSliceModalData {
    title: string;
    subtitle: string;
    issues: ReturnType<typeof useFilteredIssues>;
}

function AreaChartTooltip({
    active,
    payload,
}: {
    active?: boolean;
    payload?: Array<{ payload?: AreaTooltipPayload; value?: number }>;
}) {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload;
    if (!point) return null;

    return (
        <div
            style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12,
                color: 'var(--text-primary)',
            }}
        >
            <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{point.tooltip}</div>
            {point.epicKey && (
                <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>
                    Key: <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{point.epicKey}</span>
                </div>
            )}
            <div>
                Bugs: <strong>{point.count}</strong>
            </div>
        </div>
    );
}

function getAgeRowVisual(age: number): {
    borderColor: string | null;
    badge: string | null;
    badgeStyle: React.CSSProperties;
    ageColor: string;
} {
    if (age > 365) {
        return {
            borderColor: '#ef4444',
            badge: 'Critical Age',
            badgeStyle: {
                background: 'rgba(239,68,68,0.16)',
                border: '1px solid rgba(239,68,68,0.38)',
                color: '#ef4444',
            },
            ageColor: '#ef4444',
        };
    }

    if (age >= 180) {
        return {
            borderColor: '#f97316',
            badge: 'Overdue',
            badgeStyle: {
                background: 'rgba(249,115,22,0.16)',
                border: '1px solid rgba(249,115,22,0.38)',
                color: '#f97316',
            },
            ageColor: '#f97316',
        };
    }

    if (age >= 90) {
        return {
            borderColor: '#eab308',
            badge: null,
            badgeStyle: {},
            ageColor: '#eab308',
        };
    }

    return {
        borderColor: null,
        badge: null,
        badgeStyle: {},
        ageColor: 'var(--text-muted)',
    };
}

function safeParseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function getResolutionDays(created: string, resolved: string): number {
    const createdDate = new Date(created);
    const resolvedDate = new Date(resolved);
    const diffMs = resolvedDate.getTime() - createdDate.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function calculateAverage(values: number[]): number | null {
    if (values.length === 0) return null;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function calculateMedian(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return Number((((sorted[mid - 1] + sorted[mid]) / 2)).toFixed(1));
    }
    return Number(sorted[mid].toFixed(1));
}

function formatDays(value: number | null): string {
    if (value === null) return '—';
    if (Number.isInteger(value)) return `${value}`;
    return value.toFixed(1);
}

function getMttrWindowDays(window: MttrWindow): number | null {
    if (window === '30d') return 30;
    if (window === '90d') return 90;
    return null;
}

export default function BugsPage() {
    const filtered = useFilteredIssues();
    const filters = useAppStore((state) => state.filters);
    const workflowGroupFilter = useAppStore((state) => state.workflowGroupFilter);
    const metrics = useMemo(() => calculateBugMetrics(filtered), [filtered]);
    const reopenRates = useMemo(
        () => getReopenRates(filtered, { groupFilter: workflowGroupFilter }),
        [filtered, workflowGroupFilter]
    );

    const [oldestSortOrder, setOldestSortOrder] = useState<OldestSortOrder>('age_desc');
    const [copyState, setCopyState] = useState<CopyState>('idle');
    const [mttrWindow, setMttrWindow] = useState<MttrWindow>('30d');
    const [bugTrackingConfig, setBugTrackingConfig] = useState<BugTrackingConfig | null>(null);
    const [bugTrackingConfigLoading, setBugTrackingConfigLoading] = useState(true);
    const [activeBugModal, setActiveBugModal] = useState<BugTicketSliceModalData | null>(null);

    useEffect(() => {
        const loadBugTrackingConfig = async () => {
            try {
                const response = await fetch('/api/bug-tracking-config', { cache: 'no-store' });
                if (!response.ok) {
                    setBugTrackingConfig({ ...DEFAULT_BUG_TRACKING_CONFIG });
                    return;
                }
                const data = await response.json() as BugTrackingConfig;
                setBugTrackingConfig(data);
            } catch {
                setBugTrackingConfig({ ...DEFAULT_BUG_TRACKING_CONFIG });
            } finally {
                setBugTrackingConfigLoading(false);
            }
        };

        loadBugTrackingConfig();
    }, []);

    const sortedOldestUnresolved = useMemo(() => {
        return [...metrics.oldestUnresolved].sort((a, b) =>
            oldestSortOrder === 'age_desc' ? b.age - a.age : a.age - b.age
        );
    }, [metrics.oldestUnresolved, oldestSortOrder]);

    const bugIssues = useMemo(
        () => filtered.filter((issue) => issue.issueType === 'Bug'),
        [filtered]
    );

    const bugTimelineLabel = useMemo(() => {
        if (filters.dateFrom && filters.dateTo) {
            return `${filters.dateFrom} → ${filters.dateTo}`;
        }
        if (filters.dateFrom) {
            return `Since ${filters.dateFrom}`;
        }
        if (filters.dateTo) {
            return `Up to ${filters.dateTo}`;
        }
        return 'All time';
    }, [filters.dateFrom, filters.dateTo]);

    const mttrRows = useMemo<MttrRow[]>(() => {
        return filtered
            .filter((issue) => issue.issueType === 'Bug' && issue.resolved)
            .map((issue) => {
                const resolvedAt = safeParseDate(issue.resolved);
                if (!resolvedAt) return null;
                return {
                    resolvedAt,
                    resolutionDays: getResolutionDays(issue.created, issue.resolved as string),
                };
            })
            .filter((row): row is MttrRow => row !== null);
    }, [filtered]);

    const mttrStats = useMemo(() => {
        const now = new Date();
        const windowDays = getMttrWindowDays(mttrWindow);

        const currentRows = windowDays === null
            ? mttrRows
            : mttrRows.filter((row) => row.resolvedAt >= subDays(now, windowDays) && row.resolvedAt <= now);
        const currentDurations = currentRows.map((row) => row.resolutionDays);

        const average = calculateAverage(currentDurations);
        const median = calculateMedian(currentDurations);

        let priorCount = 0;
        let priorAverage: number | null = null;

        if (windowDays !== null) {
            const priorWindowStart = subDays(now, windowDays * 2);
            const priorWindowEnd = subDays(now, windowDays);
            const priorRows = mttrRows.filter(
                (row) => row.resolvedAt >= priorWindowStart && row.resolvedAt < priorWindowEnd
            );
            const priorDurations = priorRows.map((row) => row.resolutionDays);
            priorCount = priorDurations.length;
            priorAverage = calculateAverage(priorDurations);
        }

        const trendAvailable =
            windowDays !== null &&
            currentDurations.length >= 5 &&
            priorCount >= 5 &&
            average !== null &&
            priorAverage !== null;

        const trendDelta = trendAvailable
            ? Number((average - (priorAverage as number)).toFixed(1))
            : null;

        return {
            average,
            median,
            count: currentDurations.length,
            priorCount,
            windowDays,
            trendAvailable,
            trendDelta,
        };
    }, [mttrRows, mttrWindow]);

    const mttrTrendText = mttrStats.trendAvailable
        ? `${mttrStats.trendDelta === 0 ? '→' : mttrStats.trendDelta && mttrStats.trendDelta > 0 ? '↑' : '↓'} ${mttrStats.trendDelta && mttrStats.trendDelta > 0 ? '+' : ''}${formatDays(mttrStats.trendDelta)}d vs prior ${mttrStats.windowDays}d`
        : 'Not enough data for trend comparison';
    const mttrTrendColor = mttrStats.trendAvailable
        ? (mttrStats.trendDelta && mttrStats.trendDelta > 0 ? 'var(--danger)' : mttrStats.trendDelta && mttrStats.trendDelta < 0 ? 'var(--success)' : 'var(--text-secondary)')
        : 'var(--text-muted)';

    const showMedianVsAverageTooltip =
        mttrStats.average !== null &&
        mttrStats.median !== null &&
        mttrStats.average > mttrStats.median * 1.4;

    const bugCardModalData = useMemo<Record<BugCardModalKind, BugTicketSliceModalData>>(() => {
        const open = bugIssues
            .filter((bug) => !CLOSED_STATUSES.includes(bug.status) && !ACTIVE_STATUSES.includes(bug.status))
            .sort((a, b) => b.age - a.age);
        const inProgress = bugIssues
            .filter((bug) => ACTIVE_STATUSES.includes(bug.status))
            .sort((a, b) => b.timeInCurrentStatus - a.timeInCurrentStatus);
        const closed = bugIssues
            .filter((bug) => CLOSED_STATUSES.includes(bug.status))
            .sort((a, b) => (b.resolved || b.updated).localeCompare(a.resolved || a.updated));
        const total = [...bugIssues].sort((a, b) => b.updated.localeCompare(a.updated));

        return {
            open: {
                title: 'Open Bugs',
                subtitle: `${open.length} ticket${open.length === 1 ? '' : 's'} · ${bugTimelineLabel}`,
                issues: open,
            },
            in_progress: {
                title: 'In Progress Bugs',
                subtitle: `${inProgress.length} ticket${inProgress.length === 1 ? '' : 's'} · ${bugTimelineLabel}`,
                issues: inProgress,
            },
            closed: {
                title: 'Closed Bugs',
                subtitle: `${closed.length} ticket${closed.length === 1 ? '' : 's'} · ${bugTimelineLabel}`,
                issues: closed,
            },
            total: {
                title: 'Total Bugs',
                subtitle: `${total.length} ticket${total.length === 1 ? '' : 's'} · ${bugTimelineLabel}`,
                issues: total,
            },
        };
    }, [bugIssues, bugTimelineLabel]);

    const arrivalVsClosureWeeks = useMemo(() => {
        return Array.from({ length: 8 }, (_, index) => {
            const weekOffset = 7 - index;
            const start = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
            const end = endOfDay(addDays(start, 6));
            return {
                label: format(start, 'MMM d'),
                start,
                end,
            };
        });
    }, []);

    const getPriorityBucket = (priority: string | null | undefined): BugPriorityBucket => {
        const normalized = (priority || '').trim().toLowerCase();
        if (!normalized) return 'None';
        if (
            normalized.includes('emergency')
            || normalized.includes('critical')
            || normalized.includes('blocker')
            || normalized.includes('highest')
        ) {
            return 'Emergency';
        }
        if (normalized.includes('high')) return 'High';
        if (normalized.includes('medium')) return 'Medium';
        if (normalized.includes('low') || normalized.includes('lowest')) return 'Low';
        return 'None';
    };

    const openPriorityTicketsModal = (priority: BugPriorityBucket) => {
        const priorityIssues = bugIssues
            .filter((issue) => getPriorityBucket(issue.priority) === priority)
            .sort((a, b) => b.age - a.age);
        setActiveBugModal({
            title: `Bugs by Priority — ${priority}`,
            subtitle: `${priorityIssues.length} ticket${priorityIssues.length === 1 ? '' : 's'} · ${bugTimelineLabel}`,
            issues: priorityIssues,
        });
    };

    const openArrivalVsClosureTicketsModal = (metric: 'opened' | 'closed', weekLabel?: string) => {
        if (!weekLabel) return;
        const selectedWeek = arrivalVsClosureWeeks.find((row) => row.label === weekLabel);
        if (!selectedWeek) return;

        const matchingIssues = bugIssues
            .filter((issue) => {
                const dateToCheck = metric === 'opened'
                    ? safeParseDate(issue.created)
                    : safeParseDate(issue.resolved);
                return dateToCheck ? dateToCheck >= selectedWeek.start && dateToCheck <= selectedWeek.end : false;
            })
            .sort((a, b) => {
                const aDate = metric === 'opened'
                    ? safeParseDate(a.created)?.getTime() ?? 0
                    : safeParseDate(a.resolved)?.getTime() ?? 0;
                const bDate = metric === 'opened'
                    ? safeParseDate(b.created)?.getTime() ?? 0
                    : safeParseDate(b.resolved)?.getTime() ?? 0;
                return bDate - aDate;
            });

        setActiveBugModal({
            title: metric === 'opened' ? `Bugs Opened — Week of ${weekLabel}` : `Bugs Closed — Week of ${weekLabel}`,
            subtitle: `${matchingIssues.length} ticket${matchingIssues.length === 1 ? '' : 's'} · ${format(selectedWeek.start, 'MMM d')} - ${format(selectedWeek.end, 'MMM d')}`,
            issues: matchingIssues,
        });
    };

    const activeBugTrackingConfig = bugTrackingConfig || DEFAULT_BUG_TRACKING_CONFIG;
    const bugEscapeMetrics = useMemo(
        () => calculateBugEscapeRate(filtered, activeBugTrackingConfig),
        [filtered, activeBugTrackingConfig]
    );

    const handleCopyForStandup = async () => {
        const top5Oldest = [...metrics.oldestUnresolved]
            .sort((a, b) => b.age - a.age)
            .slice(0, 5);

        const plainText = top5Oldest
            .map((bug) => `🐛 ${bug.key} — ${bug.summary} (${bug.age}d old, ${bug.assignee?.displayName || 'Unassigned'})`)
            .join('\n');

        try {
            await navigator.clipboard.writeText(plainText);
            setCopyState('copied');
            window.setTimeout(() => setCopyState('idle'), 1800);
        } catch {
            setCopyState('error');
            window.setTimeout(() => setCopyState('idle'), 2200);
        }
    };

    useEffect(() => {
        if (!activeBugModal) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setActiveBugModal(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [activeBugModal]);

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">🐛 Bugs Dashboard</h1>
                    <p className="page-subtitle">
                        Bug load, severity distribution, ownership, and arrival vs closure trends
                    </p>
                </div>
            </div>

            <FilterBar />

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span
                        className="badge"
                        style={{
                            border: '1px solid var(--border)',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        Timeline Scope: {bugTimelineLabel}
                    </span>
                </div>
                <div
                    className="dashboard-grid"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}
                >
                    <StatCard
                        label="Open Bugs"
                        value={metrics.open}
                        color="#f97316"
                        onClick={() => setActiveBugModal(bugCardModalData.open)}
                    />
                    <StatCard
                        label="In Progress Bugs"
                        value={metrics.inProgress}
                        color="#3b82f6"
                        onClick={() => setActiveBugModal(bugCardModalData.in_progress)}
                    />
                    <StatCard
                        label="Closed Bugs"
                        value={metrics.closed}
                        color="#10b981"
                        onClick={() => setActiveBugModal(bugCardModalData.closed)}
                    />
                    <StatCard
                        label="Total Bugs"
                        value={metrics.total}
                        color="#ef4444"
                        onClick={() => setActiveBugModal(bugCardModalData.total)}
                    />
                    <ReopenRateCard data={reopenRates} />

                    <div className="stat-card" style={{ '--stat-color': '#06b6d4' } as React.CSSProperties}>
                        <div className="stat-label">MTTR</div>
                        <div className="tab-bar" style={{ marginTop: 6 }}>
                            <button type="button" className={`tab ${mttrWindow === '30d' ? 'active' : ''}`} onClick={() => setMttrWindow('30d')}>
                                Last 30d
                            </button>
                            <button type="button" className={`tab ${mttrWindow === '90d' ? 'active' : ''}`} onClick={() => setMttrWindow('90d')}>
                                Last 90d
                            </button>
                            <button type="button" className={`tab ${mttrWindow === 'all' ? 'active' : ''}`} onClick={() => setMttrWindow('all')}>
                                All time
                            </button>
                        </div>
                        <div className="stat-value" style={{ fontSize: 24 }}>
                            {mttrStats.average !== null ? `${formatDays(mttrStats.average)}d` : '—'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>Avg: {mttrStats.average !== null ? `${formatDays(mttrStats.average)}d` : '—'}</span>
                            <span>|</span>
                            <span>Median: {mttrStats.median !== null ? `${formatDays(mttrStats.median)}d` : '—'}</span>
                            {showMedianVsAverageTooltip && (
                                <span
                                    title="Median is lower than average — a few very old bugs are pulling the average up."
                                    style={{ display: 'inline-flex', color: 'var(--warning)' }}
                                >
                                    <Info size={12} />
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: 12, color: mttrTrendColor }}>{mttrTrendText}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {mttrStats.count} closed bugs in current window
                        </div>
                        {mttrStats.average !== null && mttrStats.average > 90 && (
                            <div style={{ marginTop: 2, fontSize: 11, color: 'var(--warning)' }}>
                                High average may include aged backlog bugs. Filter by date to see recent trends.
                            </div>
                        )}
                    </div>

                    {!bugTrackingConfigLoading && activeBugTrackingConfig.configured && (
                        <div
                            className="stat-card"
                            style={{ '--stat-color': '#64748b' } as React.CSSProperties}
                            title="Healthy escape rate: < 10%. Above 20% means bugs are regularly reaching clients before QA catches them."
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="stat-label">Bug Escape Rate</div>
                                <Info size={14} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                {(bugEscapeMetrics.escapeRate ?? 0)}% escape rate — {bugEscapeMetrics.productionBugs} production / {bugEscapeMetrics.qaBugs} QA
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Classified bugs: {bugEscapeMetrics.totalClassified}
                            </div>
                        </div>
                    )}
                </div>

                <div className="dashboard-grid grid-2">
                    <BugPriorityChart issues={filtered} onPriorityClick={openPriorityTicketsModal} />
                    <div className="chart-container">
                        <div className="chart-title">Bug Arrival vs Closure (8 weeks)</div>
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={metrics.arrivalVsClosureTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--bg-elevated)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        color: 'var(--text-primary)',
                                    }}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="opened"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    name="Opened"
                                    dot={{ r: 3, strokeWidth: 2, style: { cursor: 'pointer' } }}
                                    onClick={(lineData: unknown) => {
                                        const weekLabel = (lineData as { payload?: { week?: string } })?.payload?.week;
                                        openArrivalVsClosureTicketsModal('opened', weekLabel);
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="closed"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    name="Closed"
                                    dot={{ r: 3, strokeWidth: 2, style: { cursor: 'pointer' } }}
                                    onClick={(lineData: unknown) => {
                                        const weekLabel = (lineData as { payload?: { week?: string } })?.payload?.week;
                                        openArrivalVsClosureTicketsModal('closed', weekLabel);
                                    }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="dashboard-grid grid-2">
                    <div className="chart-container">
                        <div className="chart-title">Bugs by Assignee</div>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={metrics.byAssignee.slice(0, 10)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="assignee" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--bg-elevated)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        color: 'var(--text-primary)',
                                    }}
                                />
                                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="chart-container">
                        <div className="chart-title">Bugs by Area (Component/Epic)</div>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={metrics.byArea.slice(0, 10)} layout="vertical" margin={{ left: 20, right: 12 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                <YAxis type="category" dataKey="area" width={180} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                                <Tooltip content={<AreaChartTooltip />} />
                                <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="dashboard-grid grid-2">
                    <div className="card">
                        <div className="chart-title">Bug Breakdown by Priority</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {metrics.byPriority.map((row) => (
                                <div key={row.priority} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                                    <span style={{ color: row.color, fontSize: 12, fontWeight: 600 }}>{row.priority}</span>
                                    <span style={{ fontWeight: 600, fontSize: 12 }}>{row.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card">
                        <div className="chart-title">Bugs by Sprint</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {metrics.bySprint.slice(0, 10).map((row) => (
                                <div key={row.sprint} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{row.sprint}</span>
                                    <span style={{ fontWeight: 600, fontSize: 12 }}>{row.count}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                            Avg bug resolution time: <strong style={{ color: 'var(--text-primary)' }}>{metrics.avgResolutionDays} days</strong>
                        </div>
                    </div>
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: 14, fontWeight: 600 }}>Oldest Unresolved Bugs</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <label htmlFor="oldest-bugs-sort" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                Sort
                            </label>
                            <select
                                id="oldest-bugs-sort"
                                className="input"
                                style={{ width: 200, padding: '6px 10px' }}
                                value={oldestSortOrder}
                                onChange={(event) => setOldestSortOrder(event.target.value as OldestSortOrder)}
                            >
                                <option value="age_desc">Age (oldest first)</option>
                                <option value="age_asc">Age (newest first)</option>
                            </select>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyForStandup}>
                                {copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
                                {copyState === 'copied'
                                    ? 'Copied'
                                    : copyState === 'error'
                                        ? 'Copy failed'
                                        : 'Copy for standup'}
                            </button>
                        </div>
                    </div>

                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Summary</th>
                                    <th>Assignee</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Age</th>
                                    <th style={{ width: 60 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedOldestUnresolved.map((issue) => {
                                    const ageVisual = getAgeRowVisual(issue.age);
                                    return (
                                        <tr key={issue.key}>
                                            <td
                                                style={{
                                                    borderLeft: ageVisual.borderColor ? `4px solid ${ageVisual.borderColor}` : undefined,
                                                    paddingLeft: ageVisual.borderColor ? 10 : 14,
                                                    fontFamily: 'monospace',
                                                    fontSize: 12,
                                                    color: 'var(--accent-light)',
                                                    fontWeight: 600,
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                <IssueKeyButton
                                                    issue={issue}
                                                    className="btn btn-ghost btn-sm"
                                                    style={{
                                                        padding: 0,
                                                        fontFamily: 'monospace',
                                                        fontSize: 12,
                                                        color: 'var(--accent-light)',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {issue.key}
                                                </IssueKeyButton>
                                            </td>
                                            <td style={{ maxWidth: 420 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {issue.summary}
                                                    </span>
                                                    {ageVisual.badge && (
                                                        <span className="badge" style={{ ...ageVisual.badgeStyle, flexShrink: 0 }}>
                                                            {ageVisual.badge}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                    {issue.assignee?.displayName || 'Unassigned'}
                                                </span>
                                            </td>
                                            <td>
                                                <PriorityBadge priority={issue.priority} />
                                            </td>
                                            <td>
                                                <StatusBadge status={issue.status} size="sm" />
                                            </td>
                                            <td>
                                                <span style={{ color: ageVisual.ageColor, fontWeight: 600, fontSize: 12 }}>
                                                    {issue.age}d
                                                </span>
                                            </td>
                                            <td>
                                                <a
                                                    href={issue.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: 'var(--text-muted)', display: 'inline-flex', padding: 4 }}
                                                >
                                                    <ExternalLink size={13} />
                                                </a>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {sortedOldestUnresolved.length === 0 && (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No unresolved bugs in the current filter scope.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {activeBugModal && (
                <div
                    className="drawer-overlay"
                    style={{ zIndex: 1200 }}
                    onClick={() => setActiveBugModal(null)}
                >
                    <div
                        className="card"
                        style={{
                            width: 'min(1120px, calc(100vw - 64px))',
                            maxHeight: 'min(82vh, 820px)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            margin: '0 auto',
                            marginTop: '9vh',
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: '1px solid var(--border)',
                                padding: '14px 18px',
                            }}
                        >
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {activeBugModal.title}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                    {activeBugModal.subtitle}
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setActiveBugModal(null)}
                                aria-label="Close modal"
                                title="Close"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <div style={{ overflow: 'auto' }}>
                            <div className="table-wrapper" style={{ border: 0, borderRadius: 0 }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Key</th>
                                            <th>Summary</th>
                                            <th>Assignee</th>
                                            <th>Priority</th>
                                            <th>Status</th>
                                            <th>Age</th>
                                            <th style={{ width: 60 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeBugModal.issues.map((issue) => {
                                            const ageVisual = getAgeRowVisual(issue.age);
                                            return (
                                                <tr key={`${activeBugModal.title}-${issue.key}`}>
                                                    <td
                                                        style={{
                                                            borderLeft: ageVisual.borderColor ? `4px solid ${ageVisual.borderColor}` : undefined,
                                                            paddingLeft: ageVisual.borderColor ? 10 : 14,
                                                            fontFamily: 'monospace',
                                                            fontSize: 12,
                                                            color: 'var(--accent-light)',
                                                            fontWeight: 600,
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        <IssueKeyButton
                                                            issue={issue}
                                                            className="btn btn-ghost btn-sm"
                                                            style={{
                                                                padding: 0,
                                                                fontFamily: 'monospace',
                                                                fontSize: 12,
                                                                color: 'var(--accent-light)',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {issue.key}
                                                        </IssueKeyButton>
                                                    </td>
                                                    <td style={{ maxWidth: 520 }}>
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                                            {issue.summary}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                            {issue.assignee?.displayName || 'Unassigned'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <PriorityBadge priority={issue.priority} />
                                                    </td>
                                                    <td>
                                                        <StatusBadge status={issue.status} size="sm" />
                                                    </td>
                                                    <td>
                                                        <span style={{ color: ageVisual.ageColor, fontWeight: 600, fontSize: 12 }}>
                                                            {issue.age}d
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <a
                                                            href={issue.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ color: 'var(--text-muted)', display: 'inline-flex', padding: 4 }}
                                                        >
                                                            <ExternalLink size={13} />
                                                        </a>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {activeBugModal.issues.length === 0 && (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No bugs in this slice for the selected timeline/filter scope.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
