'use client';
import { CSSProperties, useMemo, useState } from 'react';
import { useAppStore, useFilteredIssues } from '@/store/app-store';
import FilterBar from '@/components/filters/FilterBar';
import { StatCard, StatusBadge } from '@/components/ui/Badges';
import PmGuideTooltip from '@/components/PmGuideTooltip';
import IssueTable from '@/components/tables/IssueTable';
import IssueKeyButton from '@/components/tables/IssueKeyButton';
import {
    calculateWorkflowMetrics,
    getCycleLeadTimeDistribution,
    CycleLeadMetric,
    getStatusTransitionFlow,
    StatusTransitionView,
} from '@/lib/analytics';
import CycleTimeChart from '@/components/charts/CycleTimeChart';
import SankeyChart from '@/components/charts/SankeyChart';
import { ChevronDown, ExternalLink } from 'lucide-react';
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
import {
    GROUP_COLORS,
    WORKFLOW_ACTIVE_ONLY_GROUPS,
    WORKFLOW_GROUP_ORDER,
    resolveWorkflowGroup,
    getStageIndexByGroup,
} from '@/lib/statusGroups';
import { JiraIssue, WorkflowGroup } from '@/types';

type WorkflowTab = 'flow_analysis' | 'quality_signals';

interface BounceBackIssueDetail {
    issue: JiraIssue;
    backwardTransitions: number;
}

function hasStatusField(field: string | null | undefined): boolean {
    return Boolean(field && field.toLowerCase().includes('status'));
}

function countBackwardTransitions(issue: JiraIssue): number {
    const statusChanges = issue.changelog
        .filter((entry) => hasStatusField(entry.field))
        .sort((a, b) => a.created.localeCompare(b.created));

    let backwardTransitions = 0;

    for (const change of statusChanges) {
        const fromGroup = resolveWorkflowGroup(change.fromString);
        const toGroup = resolveWorkflowGroup(change.toString);
        if (!fromGroup || !toGroup || fromGroup === toGroup) continue;

        const fromStageIndex = getStageIndexByGroup(fromGroup);
        const toStageIndex = getStageIndexByGroup(toGroup);
        if (toStageIndex < fromStageIndex) {
            backwardTransitions += 1;
        }
    }

    return backwardTransitions;
}

function getBounceRateTheme(ratePercent: number): {
    accent: string;
    background: string;
    border: string;
} {
    if (ratePercent > 40) {
        return {
            accent: '#ef4444',
            background: 'rgba(239,68,68,0.16)',
            border: 'rgba(239,68,68,0.42)',
        };
    }

    if (ratePercent >= 20) {
        return {
            accent: '#f59e0b',
            background: 'rgba(245,158,11,0.16)',
            border: 'rgba(245,158,11,0.42)',
        };
    }

    return {
        accent: '#10b981',
        background: 'rgba(16,185,129,0.16)',
        border: 'rgba(16,185,129,0.42)',
    };
}

function getWorkflowGroupFilterChipStyle(group: WorkflowGroup, active: boolean): CSSProperties {
    const palette = GROUP_COLORS[group];
    return {
        background: active ? palette.bg : 'rgba(15, 23, 42, 0.45)',
        borderColor: palette.border,
        color: palette.text,
    };
}

export default function WorkflowPage() {
    const filtered = useFilteredIssues();
    const workflowGroupFilter = useAppStore((state) => state.workflowGroupFilter);
    const setWorkflowGroupFilter = useAppStore((state) => state.setWorkflowGroupFilter);
    const metrics = useMemo(() => calculateWorkflowMetrics(filtered), [filtered]);

    const [activeTab, setActiveTab] = useState<WorkflowTab>('flow_analysis');
    const [timeMode, setTimeMode] = useState<CycleLeadMetric>('cycle');
    const [selectedIssueType, setSelectedIssueType] = useState<'all' | 'Story' | 'Bug' | 'Task' | 'Subtask'>('all');
    const [showTimeDistribution, setShowTimeDistribution] = useState(true);
    const [transitionView, setTransitionView] = useState<StatusTransitionView>('all');
    const [minTransitions, setMinTransitions] = useState(3);

    const cycleLeadDistribution = useMemo(
        () =>
            getCycleLeadTimeDistribution(filtered, {
                metric: timeMode,
                issueTypes: selectedIssueType === 'all' ? undefined : [selectedIssueType],
                groupFilter: workflowGroupFilter,
            }),
        [filtered, selectedIssueType, timeMode, workflowGroupFilter]
    );

    const statusTransitionFlow = useMemo(
        () =>
            getStatusTransitionFlow(filtered, {
                view: transitionView,
                groupFilter: workflowGroupFilter,
            }),
        [filtered, transitionView, workflowGroupFilter]
    );

    const bounceBackDetails = useMemo(() => {
        return filtered
            .map((issue) => ({
                issue,
                backwardTransitions: countBackwardTransitions(issue),
            }))
            .filter((item) => item.backwardTransitions > 0)
            .sort((a, b) => {
                if (b.backwardTransitions !== a.backwardTransitions) {
                    return b.backwardTransitions - a.backwardTransitions;
                }
                return b.issue.timeInCurrentStatus - a.issue.timeInCurrentStatus;
            });
    }, [filtered]);

    const bounceBackTicketCount = bounceBackDetails.length;
    const bounceRatePercent = filtered.length > 0 ? Math.round((bounceBackTicketCount / filtered.length) * 100) : 0;
    const bounceRateTheme = getBounceRateTheme(bounceRatePercent);
    const worstOffender: BounceBackIssueDetail | null = bounceBackDetails[0] || null;

    const toggleWorkflowGroup = (group: WorkflowGroup) => {
        if (workflowGroupFilter.includes(group)) {
            if (workflowGroupFilter.length === 1) return;
            setWorkflowGroupFilter(workflowGroupFilter.filter((item) => item !== group));
            return;
        }
        setWorkflowGroupFilter([...workflowGroupFilter, group]);
    };

    const avgTimeData = Object.entries(metrics.avgTimeByStatus)
        .filter(([, avg]) => avg > 0)
        .map(([status, avgDays]) => ({ status, avgDays }))
        .sort((a, b) => b.avgDays - a.avgDays);

    const issueTypeSegments: { label: string; value: 'all' | 'Story' | 'Bug' | 'Task' | 'Subtask' }[] = [
        { label: 'All', value: 'all' },
        { label: 'Story', value: 'Story' },
        { label: 'Bug', value: 'Bug' },
        { label: 'Task', value: 'Task' },
        { label: 'Sub-task', value: 'Subtask' },
    ];

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">🛠 Workflow Funnel Dashboard</h1>
                    <p className="page-subtitle">
                        Flow analysis and quality signals for bottlenecks, rework, and delivery consistency
                    </p>
                </div>
            </div>

            <FilterBar />

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="dashboard-grid grid-4">
                    <StatCard label="Total Tickets" value={filtered.length} color="#6366f1" />
                    <StatCard label="Blocked" value={metrics.blockedAging.length} color="#ef4444" />
                    <StatCard label="Reopens" value={metrics.reopenTotal} color="#f59e0b" />
                    <StatCard
                        label={
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                Bounce Back Tickets
                                <PmGuideTooltip metric="bounce_rate" />
                            </span>
                        }
                        value={`${bounceBackTicketCount} tickets (${bounceRatePercent}%)`}
                        color={bounceRateTheme.accent}
                        style={{
                            background: bounceRateTheme.background,
                            borderColor: bounceRateTheme.border,
                        }}
                    />
                </div>

                <div className="tab-bar">
                    <button
                        type="button"
                        className={`tab ${activeTab === 'flow_analysis' ? 'active' : ''}`}
                        onClick={() => setActiveTab('flow_analysis')}
                    >
                        Flow Analysis
                    </button>
                    <button
                        type="button"
                        className={`tab ${activeTab === 'quality_signals' ? 'active' : ''}`}
                        onClick={() => setActiveTab('quality_signals')}
                    >
                        Quality Signals
                    </button>
                </div>

                {activeTab === 'flow_analysis' ? (
                    <>
                        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 10,
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                                        🔀 Status Flow Sankey
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                        Transition paths across workflow statuses, including backward rework loops
                                    </div>
                                </div>
                                <div className="tab-bar">
                                    <button
                                        type="button"
                                        className={`tab ${transitionView === 'all' ? 'active' : ''}`}
                                        onClick={() => setTransitionView('all')}
                                    >
                                        All transitions
                                    </button>
                                    <button
                                        type="button"
                                        className={`tab ${transitionView === 'bottleneck' ? 'active' : ''}`}
                                        onClick={() => setTransitionView('bottleneck')}
                                    >
                                        Bottleneck view
                                    </button>
                                </div>
                            </div>

                            {transitionView === 'bottleneck' && (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Bottlenecks are statuses with average time greater than 2× median
                                    {statusTransitionFlow.bottleneckStatuses.length > 0
                                        ? ` · ${statusTransitionFlow.bottleneckStatuses.join(', ')}`
                                        : ' · none in current scope'}
                                </div>
                            )}

                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: 8,
                                    border: '1px solid var(--border)',
                                    borderRadius: 10,
                                    background: 'var(--bg-elevated)',
                                    padding: '10px 12px',
                                }}
                            >
                                {WORKFLOW_GROUP_ORDER.map((group) => {
                                    const active = workflowGroupFilter.includes(group);
                                    return (
                                        <button
                                            key={group}
                                            type="button"
                                            className="filter-chip"
                                            style={getWorkflowGroupFilterChipStyle(group, active)}
                                            onClick={() => toggleWorkflowGroup(group)}
                                            title={active ? `Hide ${group}` : `Show ${group}`}
                                        >
                                            {group}
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    className="filter-chip is-neutral"
                                    onClick={() => setWorkflowGroupFilter([...WORKFLOW_GROUP_ORDER])}
                                >
                                    All
                                </button>
                                <button
                                    type="button"
                                    className="filter-chip is-neutral"
                                    onClick={() => setWorkflowGroupFilter([...WORKFLOW_ACTIVE_ONLY_GROUPS])}
                                >
                                    Active only
                                </button>

                                <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                        Min transitions to show: <strong>{minTransitions}</strong>
                                    </label>
                                    <input
                                        type="range"
                                        min={1}
                                        max={20}
                                        value={minTransitions}
                                        onChange={(event) => setMinTransitions(Number(event.target.value))}
                                        style={{ width: 180 }}
                                    />
                                </div>
                            </div>

                            <SankeyChart
                                flow={statusTransitionFlow}
                                minTransitions={minTransitions}
                                selectedGroups={workflowGroupFilter}
                                bottleneckMode={transitionView === 'bottleneck'}
                            />
                        </div>

                        <div className="dashboard-grid grid-2">
                            <div className="chart-container">
                                <div className="chart-title">Average Time in Status (days)</div>
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={avgTimeData} layout="vertical" margin={{ left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                        <YAxis
                                            type="category"
                                            dataKey="status"
                                            width={120}
                                            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'var(--bg-elevated)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 8,
                                                color: 'var(--text-primary)',
                                            }}
                                        />
                                        <Bar dataKey="avgDays" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="chart-container">
                                <div className="chart-title">Cumulative Flow Snapshot (last 14 days)</div>
                                <ResponsiveContainer width="100%" height={280}>
                                    <LineChart data={metrics.cumulativeFlow}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
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
                                        <Line type="monotone" dataKey="open" stroke="#6366f1" strokeWidth={2} dot={false} name="Open" />
                                        <Line type="monotone" dataKey="blocked" stroke="#ef4444" strokeWidth={2} dot={false} name="Blocked" />
                                        <Line type="monotone" dataKey="closed" stroke="#10b981" strokeWidth={2} dot={false} name="Closed" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="card">
                            <div className="chart-title">Grouped Stage Bottlenecks</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {metrics.byStage.map((stage) => (
                                    <div key={stage.stage} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span style={{ color: stage.color, fontWeight: 600, fontSize: 12 }}>{stage.label}</span>
                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{stage.count} tickets</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            Avg {stage.avgDaysInStage}d in stage · oldest {stage.oldestDays}d
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="card">
                            <button
                                type="button"
                                onClick={() => setShowTimeDistribution((current) => !current)}
                                style={{
                                    width: '100%',
                                    background: 'transparent',
                                    border: 0,
                                    padding: 0,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                                        ⏱ Cycle/Lead Time Distribution
                                    </div>
                                    <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-secondary)' }}>
                                        Histogram with p50 / p75 / p95 percentiles based on resolved tickets
                                    </div>
                                </div>
                                <ChevronDown
                                    size={16}
                                    style={{
                                        color: 'var(--text-secondary)',
                                        transform: showTimeDistribution ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.15s ease',
                                    }}
                                />
                            </button>

                            {showTimeDistribution && (
                                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center' }}>
                                            Cycle Time Distribution
                                            <PmGuideTooltip metric="cycle_time" />
                                        </div>
                                        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-secondary)' }}>
                                            Current view: {timeMode === 'cycle' ? 'Cycle Time' : 'Lead Time'}
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 10,
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div className="tab-bar">
                                            {[
                                                { label: 'Cycle Time', value: 'cycle' as const },
                                                { label: 'Lead Time', value: 'lead' as const },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    className={`tab ${timeMode === option.value ? 'active' : ''}`}
                                                    onClick={() => setTimeMode(option.value)}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="tab-bar">
                                            {issueTypeSegments.map((segment) => (
                                                <button
                                                    key={segment.value}
                                                    type="button"
                                                    className={`tab ${selectedIssueType === segment.value ? 'active' : ''}`}
                                                    onClick={() => setSelectedIssueType(segment.value)}
                                                >
                                                    {segment.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            border: '1px solid var(--border)',
                                            borderRadius: 10,
                                            background: 'var(--bg-elevated)',
                                            padding: '12px 14px',
                                            display: 'grid',
                                            gap: 8,
                                        }}
                                    >
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                                            How to read this chart
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            <strong>Lead Time</strong> = Created to Resolved.{' '}
                                            <strong>Cycle Time</strong> = first move to <em>In Progress</em> to Resolved.
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            <strong>Histogram:</strong> X-axis shows day buckets (for example 0-4d, 5-9d); Y-axis shows how many tickets finished in each bucket.
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            <strong>Percentiles:</strong> P50 is the typical completion time, P75 is slower-tail behavior, and P95 highlights outliers/risk.
                                            A widening gap between P50 and P95 usually means inconsistent flow or blocked/stuck work.
                                        </div>
                                    </div>

                                    <CycleTimeChart distribution={cycleLeadDistribution} mode={timeMode} />
                                </div>
                            )}
                        </div>

                        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                                ↩️ Bounce Back Tickets
                            </div>

                            <div
                                style={{
                                    borderRadius: 10,
                                    padding: '12px 14px',
                                    border: bounceRatePercent > 30 ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border)',
                                    background: bounceRatePercent > 30 ? 'rgba(239,68,68,0.14)' : 'var(--bg-elevated)',
                                    color: bounceRatePercent > 30 ? '#fecaca' : 'var(--text-secondary)',
                                    fontSize: 13,
                                    fontWeight: 500,
                                }}
                            >
                                {bounceRatePercent > 30
                                    ? `⚠️ ${bounceRatePercent}% of tickets bounced backward at least once — this indicates rework or unclear acceptance criteria.`
                                    : `${bounceRatePercent}% of tickets bounced backward at least once.`}
                            </div>

                            {worstOffender ? (
                                <div
                                    className="card"
                                    style={{
                                        borderLeft: '4px solid var(--danger)',
                                        background: 'rgba(239,68,68,0.08)',
                                        padding: '14px 16px',
                                    }}
                                >
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                                        Worst Offender
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
                                            <div style={{ fontSize: 12, color: 'var(--danger)', fontFamily: 'monospace', fontWeight: 700 }}>
                                                <IssueKeyButton
                                                    issue={worstOffender.issue}
                                                    className="btn btn-ghost btn-sm"
                                                    style={{
                                                        padding: 0,
                                                        fontSize: 12,
                                                        fontFamily: 'monospace',
                                                        fontWeight: 700,
                                                        color: 'var(--danger)',
                                                    }}
                                                >
                                                    {worstOffender.issue.key}
                                                </IssueKeyButton>
                                            </div>
                                            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                                                {worstOffender.issue.summary}
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                                                <span>
                                                    Assignee: {worstOffender.issue.assignee?.displayName || 'Unassigned'}
                                                </span>
                                                <span>
                                                    Bounce count: <strong style={{ color: 'var(--danger)' }}>{worstOffender.backwardTransitions}</strong>
                                                </span>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                    Current status:
                                                    <StatusBadge status={worstOffender.issue.status} size="sm" />
                                                </span>
                                            </div>
                                        </div>
                                        <a
                                            href={worstOffender.issue.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-secondary btn-sm"
                                        >
                                            Jira <ExternalLink size={12} />
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    No backward transitions in the current filter scope.
                                </div>
                            )}

                            <IssueTable issues={bounceBackDetails.map((item) => item.issue)} compact maxRows={10} />
                        </div>

                        <div className="dashboard-grid grid-2">
                            <div className="card">
                                <div className="chart-title">Longest Aging by Status</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {Object.entries(metrics.longestAgingByStatus)
                                        .filter(([, issues]) => issues.length > 0)
                                        .slice(0, 8)
                                        .map(([status, issues]) => (
                                            <div key={status} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{status}</div>
                                                {issues.slice(0, 2).map((issue) => (
                                                    <div key={issue.key} style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                                                            <IssueKeyButton
                                                                issue={issue}
                                                                className="btn btn-ghost btn-sm"
                                                                style={{
                                                                    padding: 0,
                                                                    fontSize: 12,
                                                                    fontFamily: 'monospace',
                                                                    color: 'var(--accent-light)',
                                                                    display: 'inline',
                                                                }}
                                                            >
                                                                {issue.key}
                                                            </IssueKeyButton>
                                                            {' · '}
                                                            {issue.summary}
                                                        </span>
                                                        <span style={{ color: 'var(--warning)' }}>{issue.timeInCurrentStatus}d</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                </div>
                            </div>

                            <div className="card">
                                <div className="chart-title">🚧 Blocked Aging</div>
                                <IssueTable issues={metrics.blockedAging} compact maxRows={10} />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
