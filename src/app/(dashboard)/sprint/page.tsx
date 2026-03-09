'use client';
import { useAppStore } from '@/store/app-store';
import { CLOSED_STATUSES } from '@/lib/workflow';
import { StatCard, ProgressBar } from '@/components/ui/Badges';
import FilterBar from '@/components/filters/FilterBar';
import IssueTable from '@/components/tables/IssueTable';
import { SprintProgressChart, AssigneeChart } from '@/components/charts/DashboardCharts';

export default function SprintPage() {
    const { issues, setFilters } = useAppStore();

    const activeSprint = issues.find(i => i.sprint?.state === 'active')?.sprint;
    const prevSprint = issues.find(i => i.sprint?.state === 'closed')?.sprint;

    const sprintIssues = issues.filter(i => i.sprint?.state === 'active');
    const prevSprintIssues = issues.filter(i => i.sprint?.state === 'closed');

    const done = sprintIssues.filter(i => CLOSED_STATUSES.includes(i.status));
    const notDone = sprintIssues.filter(i => !CLOSED_STATUSES.includes(i.status));
    const blocked = sprintIssues.filter(i => i.status === 'Blocked');
    const inProgress = sprintIssues.filter(i => i.status === 'In Progress');
    const inReview = sprintIssues.filter(i => ['In Review', 'Reviewed'].includes(i.status));
    const inQA = sprintIssues.filter(i => ['Ready for QA', 'In QA'].includes(i.status));

    const committed = sprintIssues.length;
    const completed = done.length;
    const completionRate = committed > 0 ? Math.round((completed / committed) * 100) : 0;

    const committedPts = sprintIssues.reduce((s, i) => s + (i.storyPoints || 0), 0);
    const completedPts = done.reduce((s, i) => s + (i.storyPoints || 0), 0);

    const prevDone = prevSprintIssues.filter(i => CLOSED_STATUSES.includes(i.status));
    const prevRate = prevSprintIssues.length > 0 ? Math.round((prevDone.length / prevSprintIssues.length) * 100) : 0;

    // Status breakdown
    const byStatus: Record<string, number> = {};
    sprintIssues.forEach(i => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });

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
