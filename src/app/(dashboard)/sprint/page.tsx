'use client';
import { useEffect, useMemo, useState } from 'react';
import { JiraIssue } from '@/types';
import { useAppStore, useFilteredIssues } from '@/store/app-store';
import { CLOSED_STATUSES } from '@/lib/workflow';
import { PriorityBadge, StatCard, ProgressBar, StatusBadge } from '@/components/ui/Badges';
import FilterBar from '@/components/filters/FilterBar';
import IssueTable from '@/components/tables/IssueTable';
import IssueKeyButton from '@/components/tables/IssueKeyButton';
import { SprintProgressChart, AssigneeChart } from '@/components/charts/DashboardCharts';
import VelocityChart from '@/components/charts/VelocityChart';
import BurndownMiniChart, { BurndownMiniPoint } from '@/components/charts/BurndownMiniChart';
import CapacityPlanner from '@/components/CapacityPlanner';
import { getCapacityData, getVelocityTrend, hasStoryPointsCoverage } from '@/lib/analytics';
import { resolveWorkflowGroup } from '@/lib/statusGroups';
import { ChevronDown, ExternalLink, Filter, X } from 'lucide-react';

interface SyncHistoryRow {
    completedAt: string;
    issuesSynced: number;
}

interface DaysRemainingInfo {
    value: number | null;
    display: string;
    color: string;
    note?: string;
}

type SprintTicketView = 'open' | 'in_progress' | 'in_review' | 'done';

interface SprintTicketModalState {
    title: string;
    subtitle: string;
    issues: JiraIssue[];
}

function toValidDate(value?: string | null): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isSubTicket(issue: JiraIssue): boolean {
    const normalizedType = (issue.issueType || '')
        .toLowerCase()
        .replace(/[\s_-]+/g, '');
    return normalizedType.includes('subtask');
}

function isTestSubTask(issue: JiraIssue): boolean {
    const normalizedType = (issue.issueType || '')
        .toLowerCase()
        .replace(/[\s_-]+/g, '');
    return normalizedType.includes('testsubtask');
}

function issueMatchesView(issue: JiraIssue, view: SprintTicketView): boolean {
    const workflowGroup = resolveWorkflowGroup(issue.status);

    switch (view) {
        case 'open':
            return workflowGroup === 'Backlog' || workflowGroup === 'Planning';
        case 'in_progress':
            return workflowGroup === 'In Progress';
        case 'in_review':
            return workflowGroup === 'Review/QA';
        case 'done':
            return workflowGroup === 'Done';
        default:
            return true;
    }
}

export default function SprintPage() {
    const filteredIssues = useFilteredIssues();
    const setFilters = useAppStore((state) => state.setFilters);
    const selectedProject = useAppStore((state) => state.filters.project?.[0]);
    const activeSprints = useAppStore((state) => state.activeSprints);
    const storyPointsWarningDismissed = useAppStore((state) => state.storyPointsWarningDismissed);
    const dismissStoryPointsWarning = useAppStore((state) => state.dismissStoryPointsWarning);
    const demoMode = useAppStore((state) => state.demoMode);
    const [showCapacityPlanner, setShowCapacityPlanner] = useState(true);
    const [syncHistory, setSyncHistory] = useState<SyncHistoryRow[]>([]);
    const [excludeSubTickets, setExcludeSubTickets] = useState(false);
    const [selectedTicketViews, setSelectedTicketViews] = useState<SprintTicketView[]>([]);
    const [activeSprintTicketModal, setActiveSprintTicketModal] = useState<SprintTicketModalState | null>(null);
    const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

    const sprints = useMemo(
        () =>
            Array.from(
                new Map(
                    filteredIssues
                        .filter((issue) => issue.sprint)
                        .map((issue) => [issue.sprint!.id, issue.sprint!])
                ).values()
            ).sort((a, b) => (b.id || 0) - (a.id || 0)),
        [filteredIssues]
    );

    const activeSprintFromFiltered = sprints.find((sprint) => sprint.state === 'active') || null;
    const activeSprintFromStore = activeSprints.find((sprint) => sprint.state === 'active') || null;
    const activeSprint = useMemo(() => {
        if (!activeSprintFromFiltered) return activeSprintFromStore;
        if (!activeSprintFromFiltered.endDate && activeSprintFromStore?.endDate) {
            return { ...activeSprintFromFiltered, endDate: activeSprintFromStore.endDate };
        }
        return activeSprintFromFiltered;
    }, [activeSprintFromFiltered, activeSprintFromStore]);

    const prevSprint =
        sprints.find(
            (sprint) => sprint.state === 'closed' && sprint.id !== activeSprint?.id
        ) || null;

    const sprintIssues = useMemo(
        () =>
            activeSprint
                ? filteredIssues.filter((issue) => issue.sprint?.id === activeSprint.id)
                : [],
        [activeSprint, filteredIssues]
    );
    const prevSprintIssues = useMemo(
        () =>
            prevSprint
                ? filteredIssues.filter((issue) => issue.sprint?.id === prevSprint.id)
                : [],
        [filteredIssues, prevSprint]
    );

    const done = sprintIssues.filter((issue) => CLOSED_STATUSES.includes(issue.status));
    const notDone = sprintIssues.filter((issue) => !CLOSED_STATUSES.includes(issue.status));
    const blocked = sprintIssues.filter((issue) => issue.status === 'Blocked');
    const inProgress = sprintIssues.filter((issue) => issue.status === 'In Progress');
    const inReview = sprintIssues.filter((issue) => ['In Review', 'Reviewed'].includes(issue.status));
    const inQA = sprintIssues.filter((issue) => ['Ready for QA', 'In QA'].includes(issue.status));

    const committed = sprintIssues.length;
    const completed = done.length;
    const completionRate = committed > 0 ? Math.round((completed / committed) * 100) : 0;

    const committedPts = sprintIssues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
    const completedPts = done.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);

    const prevDone = prevSprintIssues.filter((issue) => CLOSED_STATUSES.includes(issue.status));
    const prevRate = prevSprintIssues.length > 0 ? Math.round((prevDone.length / prevSprintIssues.length) * 100) : 0;
    const velocityTrend = useMemo(
        () => getVelocityTrend(filteredIssues, selectedProject),
        [filteredIssues, selectedProject]
    );
    const capacityData = useMemo(
        () =>
            getCapacityData({
                issues: filteredIssues,
                sprintId: activeSprint?.id,
            }),
        [filteredIssues, activeSprint?.id]
    );

    const storyPointsCoverage = useMemo(
        () => hasStoryPointsCoverage(sprintIssues.filter((issue) => !isTestSubTask(issue))),
        [sprintIssues]
    );
    const missingPointsPercent = Math.max(0, 100 - storyPointsCoverage.coveragePercent);
    const showStoryPointsWarning =
        storyPointsCoverage.coveragePercent < 50 && !storyPointsWarningDismissed;

    const sprintStartDate = toValidDate(activeSprint?.startDate);
    const sprintEndDate = toValidDate(activeSprint?.endDate);
    const dayMs = 1000 * 60 * 60 * 24;

    const daysRemainingInfo = useMemo<DaysRemainingInfo>(() => {
        if (!sprintEndDate) {
            return { value: null, display: 'End date not set', color: '#64748b' };
        }

        const daysRemaining = Math.max(
            0,
            Math.ceil((sprintEndDate.getTime() - nowTimestamp) / dayMs)
        );

        if (daysRemaining > 5) return { value: daysRemaining, display: `${daysRemaining}`, color: '#10b981' };
        if (daysRemaining >= 2) return { value: daysRemaining, display: `${daysRemaining}`, color: '#f59e0b' };
        return { value: daysRemaining, display: `${daysRemaining}`, color: '#ef4444' };
    }, [dayMs, nowTimestamp, sprintEndDate]);

    useEffect(() => {
        if (demoMode) return;
        let cancelled = false;

        async function loadSyncHistory() {
            try {
                const response = await fetch('/api/sync/history', { cache: 'no-store' });
                if (!response.ok) return;
                const data = await response.json();
                if (!cancelled && Array.isArray(data)) {
                    setSyncHistory(data);
                }
            } catch {
                if (!cancelled) setSyncHistory([]);
            }
        }

        void loadSyncHistory();
        return () => {
            cancelled = true;
        };
    }, [demoMode]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setNowTimestamp(Date.now());
        }, 60_000);
        return () => window.clearInterval(timer);
    }, []);

    const burndown = useMemo(() => {
        if (!activeSprint || !sprintStartDate || !sprintEndDate || committed === 0) {
            return { points: [] as BurndownMiniPoint[], hasData: false };
        }

        const sprintLengthDays = Math.max(
            2,
            Math.ceil((sprintEndDate.getTime() - sprintStartDate.getTime()) / dayMs) + 1
        );

        const sprintWindowEnd = new Date(Math.min(nowTimestamp, sprintEndDate.getTime()));
        const snapshotDays = new Map<number, Date>();
        for (const row of syncHistory) {
            const syncDate = toValidDate(row.completedAt);
            if (!syncDate) continue;
            if (syncDate < sprintStartDate || syncDate > sprintWindowEnd) continue;
            const dayIndex = Math.floor((syncDate.getTime() - sprintStartDate.getTime()) / dayMs) + 1;
            if (dayIndex < 1 || dayIndex > sprintLengthDays) continue;
            const existing = snapshotDays.get(dayIndex);
            if (!existing || syncDate > existing) snapshotDays.set(dayIndex, syncDate);
        }

        if (snapshotDays.size < 2) {
            return { points: [] as BurndownMiniPoint[], hasData: false };
        }

        const resolvedDates = sprintIssues
            .filter((issue) => issue.resolved && CLOSED_STATUSES.includes(issue.status))
            .map((issue) => toValidDate(issue.resolved))
            .filter((value): value is Date => !!value);

        const points: BurndownMiniPoint[] = [];
        for (let day = 1; day <= sprintLengthDays; day += 1) {
            const idealRemaining =
                sprintLengthDays > 1
                    ? Math.max(0, Number((committed - ((committed * (day - 1)) / (sprintLengthDays - 1))).toFixed(1)))
                    : committed;

            const snapshotDate = snapshotDays.get(day);
            let actualRemaining: number | null = null;

            if (snapshotDate) {
                const snapshotEnd = new Date(snapshotDate);
                snapshotEnd.setHours(23, 59, 59, 999);
                const doneBySnapshot = resolvedDates.filter((date) => date <= snapshotEnd).length;
                actualRemaining = Math.max(0, committed - doneBySnapshot);
            }

            points.push({
                day,
                label: `Day ${day}`,
                idealRemaining,
                actualRemaining,
            });
        }

        return { points, hasData: true };
    }, [activeSprint, committed, dayMs, nowTimestamp, sprintEndDate, sprintIssues, sprintStartDate, syncHistory]);

    const carryOverPrediction = useMemo(() => {
        if (!sprintStartDate || !sprintEndDate) {
            return {
                rows: [] as typeof sprintIssues,
                sprintLengthDays: 0,
                daysElapsed: 0,
                threshold: 0,
            };
        }

        const sprintLengthDays = Math.max(
            1,
            Math.ceil((sprintEndDate.getTime() - sprintStartDate.getTime()) / dayMs)
        );
        const daysElapsed = Math.max(
            0,
            Math.min(
                sprintLengthDays,
                Math.ceil((nowTimestamp - sprintStartDate.getTime()) / dayMs)
            )
        );
        const threshold = Math.max(0, sprintLengthDays - daysElapsed);

        const rows = sprintIssues
            .filter((issue) => !CLOSED_STATUSES.includes(issue.status))
            .filter((issue) => issue.status === 'In Progress' || issue.status === 'Open')
            .filter((issue) => issue.age > threshold)
            .sort((a, b) => b.age - a.age);

        return { rows, sprintLengthDays, daysElapsed, threshold };
    }, [dayMs, nowTimestamp, sprintEndDate, sprintIssues, sprintStartDate]);

    // Status breakdown
    const byStatus: Record<string, number> = {};
    sprintIssues.forEach((issue) => {
        byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;
    });

    const ticketViewCounts = useMemo(() => {
        const source = excludeSubTickets
            ? sprintIssues.filter((issue) => !isSubTicket(issue))
            : sprintIssues;
        return {
            all: source.length,
            open: source.filter((issue) => issueMatchesView(issue, 'open')).length,
            inProgress: source.filter((issue) => issueMatchesView(issue, 'in_progress')).length,
            inReview: source.filter((issue) => issueMatchesView(issue, 'in_review')).length,
            done: source.filter((issue) => issueMatchesView(issue, 'done')).length,
        };
    }, [excludeSubTickets, sprintIssues]);

    const selectedViewSet = useMemo(
        () => new Set(selectedTicketViews),
        [selectedTicketViews]
    );

    const allTicketsSelected = selectedTicketViews.length === 0;

    const tableIssues = useMemo(
        () => {
            let scoped = sprintIssues;

            if (excludeSubTickets) {
                scoped = scoped.filter((issue) => !isSubTicket(issue));
            }

            if (selectedTicketViews.length === 0) {
                return scoped;
            }

            return scoped.filter((issue) =>
                selectedTicketViews.some((view) => issueMatchesView(issue, view))
            );
        },
        [excludeSubTickets, selectedTicketViews, sprintIssues]
    );

    const carryOverRiskIssues = useMemo(
        () =>
            notDone.filter(
                (issue) =>
                    issue.status !== 'In Progress'
                    && !['In Review', 'Reviewed'].includes(issue.status)
                    && !['Ready for QA', 'In QA'].includes(issue.status)
            ),
        [notDone]
    );
    const carryOverRiskCount = carryOverRiskIssues.length;

    const openSprintTicketModal = (title: string, issues: JiraIssue[], sortByResolvedDate = false) => {
        const sortedIssues = [...issues].sort((a, b) => {
            if (sortByResolvedDate) {
                return (b.resolved || b.updated).localeCompare(a.resolved || a.updated);
            }
            return b.age - a.age;
        });
        setActiveSprintTicketModal({
            title,
            subtitle: `${sortedIssues.length} ticket${sortedIssues.length === 1 ? '' : 's'}${activeSprint ? ` · ${activeSprint.name}` : ''}`,
            issues: sortedIssues,
        });
    };

    useEffect(() => {
        if (!activeSprintTicketModal) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setActiveSprintTicketModal(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [activeSprintTicketModal]);

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16 }}>
                    <div>
                        <h1 className="page-title">⚡ Sprint Dashboard</h1>
                        <p className="page-subtitle">
                            {activeSprint ? activeSprint.name : 'No active sprint'} ·{' '}
                            2-week cadence · {committed} tickets committed
                        </p>
                    </div>
                    {prevSprint && (
                        <div className="card" style={{ padding: '8px 16px', fontSize: 12 }}>
                            <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Previous: {prevSprint.name}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>
                                Completion: <strong style={{ color: prevRate >= completionRate ? 'var(--success)' : 'var(--warning)' }}>{prevRate}%</strong>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <FilterBar showSprintFilter={false} />

            {showStoryPointsWarning && (
                <div
                    style={{
                        margin: '12px 32px 0',
                        border: '1px solid rgba(245, 158, 11, 0.45)',
                        background: 'rgba(120, 53, 15, 0.28)',
                        borderRadius: 10,
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 12,
                    }}
                >
                    <div style={{ color: '#fbbf24', fontSize: 13, lineHeight: 1.4 }}>
                        ⚠️ Story points are missing on {missingPointsPercent}% of tickets — velocity and capacity charts may be incomplete. Test Sub-task tickets are excluded from this check.
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={dismissStoryPointsWarning} style={{ padding: 4 }}>
                        <X size={14} />
                    </button>
                </div>
            )}

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Sprint progress bar */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 16 }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>Sprint Completion</div>
                            {activeSprint?.endDate && (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                    Ends {new Date(activeSprint.endDate).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: completionRate >= 70 ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center' }}>
                                {completionRate}%
                            </div>
                            <div
                                style={{
                                    minWidth: 130,
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 10,
                                    padding: '8px 10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                }}
                            >
                                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)' }}>
                                    Days Remaining
                                </div>
                                <div style={{ fontSize: daysRemainingInfo.value === null ? 13 : 22, fontWeight: 700, color: daysRemainingInfo.color, lineHeight: 1.1 }}>
                                    {daysRemainingInfo.display}
                                </div>
                            </div>
                        </div>
                    </div>
                    <ProgressBar value={completed} max={committed} color={completionRate >= 70 ? '#10b981' : '#f59e0b'} height={10} showLabel />
                    <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span>✅ {completed} done</span>
                        <span>🔄 {inProgress.length} in progress</span>
                        <span>🔍 {inReview.length} in review</span>
                        <span>🧪 {inQA.length} in QA</span>
                        <span>🚧 {blocked.length} blocked</span>
                    </div>
                </div>

                {/* Key metrics */}
                <div className="dashboard-grid grid-4">
                    <StatCard
                        label="Committed"
                        value={committed}
                        color="#6366f1"
                        onClick={() => openSprintTicketModal('Committed Tickets', sprintIssues)}
                    />
                    <StatCard
                        label="Completed"
                        value={completed}
                        color="#10b981"
                        change={prevRate > 0 ? completionRate - prevRate : undefined}
                        onClick={() => openSprintTicketModal('Completed Tickets', done, true)}
                    />
                    <StatCard
                        label="Story Points Done"
                        value={committedPts > 0 ? `${completedPts}/${committedPts}` : completedPts}
                        color="#8b5cf6"
                        onClick={() => openSprintTicketModal('Story Points Done Tickets', done)}
                    />
                    <StatCard
                        label="Carry-over Risk"
                        value={carryOverRiskCount}
                        color={blocked.length > 0 ? '#ef4444' : '#64748b'}
                        onClick={() => openSprintTicketModal('Carry-over Risk Tickets', carryOverRiskIssues)}
                    />
                </div>

                <VelocityChart data={velocityTrend} />
                <BurndownMiniChart
                    data={burndown.points}
                    hasData={burndown.hasData}
                    placeholder="Burndown requires daily syncs — enable auto-sync in Settings."
                />

                <div className="card">
                    <button
                        type="button"
                        onClick={() => setShowCapacityPlanner((current) => !current)}
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
                                📈 Capacity Planning
                            </div>
                            <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-secondary)' }}>
                                Rolling forecast, sprint capacity delta, and what-if planning
                            </div>
                        </div>
                        <ChevronDown
                            size={16}
                            style={{
                                color: 'var(--text-secondary)',
                                transform: showCapacityPlanner ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.15s ease',
                            }}
                        />
                    </button>

                    {showCapacityPlanner && (
                        <div style={{ marginTop: 16 }}>
                            <CapacityPlanner data={capacityData} />
                        </div>
                    )}
                </div>

                <div className="card">
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Carry-over Prediction</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                        Based on current progress, {carryOverPrediction.rows.length} tickets are unlikely to complete this sprint.
                    </div>

                    {carryOverPrediction.rows.length === 0 ? (
                        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                            No at-risk tickets in the current sprint scope.
                        </div>
                    ) : (
                        <div className="table-wrapper" style={{ marginTop: 12 }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ width: 110 }}>Key</th>
                                        <th>Summary</th>
                                        <th style={{ width: 150 }}>Assignee</th>
                                        <th style={{ width: 130 }}>Current Status</th>
                                        <th style={{ width: 120 }}>Days Active</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {carryOverPrediction.rows.slice(0, 20).map((issue) => (
                                        <tr key={issue.key}>
                                            <td>
                                                <IssueKeyButton
                                                    issue={issue}
                                                    className="btn btn-ghost btn-sm"
                                                    style={{
                                                        padding: 0,
                                                        color: 'var(--accent-light)',
                                                        fontWeight: 600,
                                                        fontFamily: 'monospace',
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {issue.key}
                                                </IssueKeyButton>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420 }}>
                                                        {issue.summary}
                                                    </span>
                                                    <span
                                                        style={{
                                                            border: '1px solid rgba(245, 158, 11, 0.45)',
                                                            background: 'rgba(245, 158, 11, 0.2)',
                                                            color: '#fbbf24',
                                                            borderRadius: 999,
                                                            fontSize: 10,
                                                            padding: '2px 7px',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: 0.4,
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        At Risk
                                                    </span>
                                                </div>
                                            </td>
                                            <td>{issue.assignee?.displayName || 'Unassigned'}</td>
                                            <td>{issue.status}</td>
                                            <td>{issue.age}d</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Stage breakdown cards */}
                <div className="dashboard-grid grid-4">
                    {[
                        { label: 'In Progress', count: inProgress.length, color: '#3b82f6', icon: '🔄', onClick: () => setFilters({ status: ['In Progress'] }) },
                        { label: 'In Review', count: inReview.length, color: '#f59e0b', icon: '🔍', onClick: () => setFilters({ status: ['In Review', 'Reviewed'] }) },
                        { label: 'In QA', count: inQA.length, color: '#10b981', icon: '🧪', onClick: () => setFilters({ status: ['Ready for QA', 'In QA'] }) },
                        { label: 'Blocked', count: blocked.length, color: '#ef4444', icon: '🚧', onClick: () => setFilters({ status: ['Blocked'] }) },
                    ].map(({ label, count, color, icon, onClick }) => (
                        <div
                            key={label}
                            className="card"
                            onClick={onClick}
                            style={{ cursor: 'pointer', borderTop: `2px solid ${color}`, padding: '16px 20px' }}
                        >
                            <div style={{ fontSize: 24, fontWeight: 700, color }}>{count}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{icon} {label}</div>
                        </div>
                    ))}
                </div>

                {/* Charts */}
                <div className="dashboard-grid grid-2">
                    <SprintProgressChart issues={sprintIssues} />
                    <AssigneeChart issues={sprintIssues} />
                </div>

                {/* Status breakdown table */}
                <div className="card">
                    <div className="chart-title" style={{ marginBottom: 12 }}>Status Breakdown</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                        {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                            <div
                                key={status}
                                style={{
                                    background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px',
                                    cursor: 'pointer', border: '1px solid var(--border)',
                                }}
                                onClick={() => setFilters({ status: [status as never], sprint: 'current' })}
                            >
                                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{count}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{status}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tickets table */}
                <div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Sprint Tickets</div>

                    <div className="filter-bar-panel" style={{ marginBottom: 12 }}>
                        <div className="filter-panel-heading">
                            <Filter size={13} />
                            <span>Views to Filter</span>
                        </div>
                        <div className="filter-chip-group" style={{ borderLeft: 0, paddingLeft: 0, marginLeft: 0 }}>
                            <label className={`filter-chip ${allTicketsSelected ? 'is-active is-accent' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={allTicketsSelected}
                                    onChange={() => setSelectedTicketViews([])}
                                    style={{ accentColor: 'var(--accent)' }}
                                />
                                All Tickets ({ticketViewCounts.all})
                            </label>
                            <label className={`filter-chip ${selectedViewSet.has('open') ? 'is-active is-accent' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={selectedViewSet.has('open')}
                                    onChange={() => {
                                        setSelectedTicketViews((current) =>
                                            current.includes('open')
                                                ? current.filter((item) => item !== 'open')
                                                : [...current, 'open']
                                        );
                                    }}
                                    style={{ accentColor: 'var(--accent)' }}
                                />
                                Open Tickets ({ticketViewCounts.open})
                            </label>
                            <label className={`filter-chip ${selectedViewSet.has('in_progress') ? 'is-active is-accent' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={selectedViewSet.has('in_progress')}
                                    onChange={() => {
                                        setSelectedTicketViews((current) =>
                                            current.includes('in_progress')
                                                ? current.filter((item) => item !== 'in_progress')
                                                : [...current, 'in_progress']
                                        );
                                    }}
                                    style={{ accentColor: 'var(--accent)' }}
                                />
                                In Progress Tickets ({ticketViewCounts.inProgress})
                            </label>
                            <label className={`filter-chip ${selectedViewSet.has('in_review') ? 'is-active is-accent' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={selectedViewSet.has('in_review')}
                                    onChange={() => {
                                        setSelectedTicketViews((current) =>
                                            current.includes('in_review')
                                                ? current.filter((item) => item !== 'in_review')
                                                : [...current, 'in_review']
                                        );
                                    }}
                                    style={{ accentColor: 'var(--accent)' }}
                                />
                                In Review ({ticketViewCounts.inReview})
                            </label>
                            <label className={`filter-chip ${selectedViewSet.has('done') ? 'is-active is-accent' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={selectedViewSet.has('done')}
                                    onChange={() => {
                                        setSelectedTicketViews((current) =>
                                            current.includes('done')
                                                ? current.filter((item) => item !== 'done')
                                                : [...current, 'done']
                                        );
                                    }}
                                    style={{ accentColor: 'var(--accent)' }}
                                />
                                Done ({ticketViewCounts.done})
                            </label>
                        </div>
                        <label className={`filter-chip ${excludeSubTickets ? 'is-active is-warning' : ''}`}>
                            <input
                                type="checkbox"
                                checked={excludeSubTickets}
                                onChange={(event) => setExcludeSubTickets(event.target.checked)}
                                style={{ accentColor: 'var(--accent)' }}
                            />
                            Exclude Sub Tickets: <strong>{excludeSubTickets ? 'True' : 'False'}</strong>
                        </label>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                            Excludes tickets where issue type contains &quot;Sub-task&quot; (for example, Test Sub-task).
                        </div>
                    </div>
                    <IssueTable issues={tableIssues} showStoryPoints showDueDate showResolution />
                </div>
            </div>

            {activeSprintTicketModal && (
                <div
                    className="drawer-overlay"
                    style={{ zIndex: 1200 }}
                    onClick={() => setActiveSprintTicketModal(null)}
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
                                    {activeSprintTicketModal.title}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                    {activeSprintTicketModal.subtitle}
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setActiveSprintTicketModal(null)}
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
                                        {activeSprintTicketModal.issues.map((issue) => (
                                            <tr key={`${activeSprintTicketModal.title}-${issue.key}`}>
                                                <td
                                                    style={{
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
                                                    <span
                                                        style={{
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            display: 'block',
                                                        }}
                                                    >
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
                                                    <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>
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
                                        ))}
                                    </tbody>
                                </table>

                                {activeSprintTicketModal.issues.length === 0 && (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No tickets in this slice for the current sprint scope.
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
