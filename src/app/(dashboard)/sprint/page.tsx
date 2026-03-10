'use client';
import { useMemo, useState } from 'react';
import { useAppStore, useFilteredIssues } from '@/store/app-store';
import { CLOSED_STATUSES } from '@/lib/workflow';
import { StatCard, ProgressBar } from '@/components/ui/Badges';
import FilterBar from '@/components/filters/FilterBar';
import IssueTable from '@/components/tables/IssueTable';
import { SprintProgressChart, AssigneeChart } from '@/components/charts/DashboardCharts';
import VelocityChart from '@/components/charts/VelocityChart';
import CapacityPlanner from '@/components/CapacityPlanner';
import { getCapacityData, getVelocityTrend } from '@/lib/analytics';
import { ChevronDown } from 'lucide-react';

export default function SprintPage() {
    const filteredIssues = useFilteredIssues();
    const setFilters = useAppStore((state) => state.setFilters);
    const selectedProject = useAppStore((state) => state.filters.project?.[0]);
    const [showCapacityPlanner, setShowCapacityPlanner] = useState(true);

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

    const activeSprint = sprints.find((sprint) => sprint.state === 'active') || null;
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

    // Status breakdown
    const byStatus: Record<string, number> = {};
    sprintIssues.forEach((issue) => {
        byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;
    });

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

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Sprint progress bar */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>Sprint Completion</div>
                            {activeSprint?.endDate && (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                    Ends {new Date(activeSprint.endDate).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: completionRate >= 70 ? 'var(--success)' : 'var(--warning)' }}>
                            {completionRate}%
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
                    <StatCard label="Committed" value={committed} color="#6366f1" />
                    <StatCard label="Completed" value={completed} color="#10b981" change={prevRate > 0 ? completionRate - prevRate : undefined} />
                    <StatCard
                        label="Story Points Done"
                        value={committedPts > 0 ? `${completedPts}/${committedPts}` : completedPts}
                        color="#8b5cf6"
                    />
                    <StatCard label="Carry-over Risk" value={notDone.length - inProgress.length - inReview.length - inQA.length} color={blocked.length > 0 ? '#ef4444' : '#64748b'} />
                </div>

                <VelocityChart data={velocityTrend} />

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
                    <IssueTable issues={sprintIssues} />
                </div>
            </div>
        </div>
    );
}
