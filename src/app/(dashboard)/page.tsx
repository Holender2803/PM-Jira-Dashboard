'use client';
import { useAppStore, useFilteredIssues } from '@/store/app-store';
import { CLOSED_STATUSES, ACTIVE_STATUSES } from '@/lib/workflow';
import { StatCard, ProgressBar } from '@/components/ui/Badges';
import FilterBar from '@/components/filters/FilterBar';
import {
    StatusChart, IssueTypePieChart, WorkflowFunnelChart, AssigneeChart
} from '@/components/charts/DashboardCharts';
import IssueTable from '@/components/tables/IssueTable';
import { CheckCircle, AlertTriangle, TrendingUp, Zap, Bug, Clock, Layers } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatTimeForDisplay } from '@/lib/time';

export default function OverviewPage() {
    const { issues, isLoading, demoMode, lastSynced } = useAppStore();
    const filtered = useFilteredIssues();
    const router = useRouter();

    const activeSprint = issues.find(i => i.sprint?.state === 'active')?.sprint;
    const sprintIssues = issues.filter(i => i.sprint?.state === 'active');
    const prevSprintIssues = issues.filter(i => i.sprint?.state === 'closed');

    const done = sprintIssues.filter(i => CLOSED_STATUSES.includes(i.status));
    const active = sprintIssues.filter(i => ACTIVE_STATUSES.includes(i.status));
    const blocked = sprintIssues.filter(i => i.status === 'Blocked');
    const bugs = issues.filter(i => i.issueType === 'Bug' && !CLOSED_STATUSES.includes(i.status));
    const completionRate = sprintIssues.length > 0 ? Math.round((done.length / sprintIssues.length) * 100) : 0;

    const prevDone = prevSprintIssues.filter(i => CLOSED_STATUSES.includes(i.status));
    const prevRate = prevSprintIssues.length > 0 ? Math.round((prevDone.length / prevSprintIssues.length) * 100) : 0;
    const rateChange = prevRate > 0 ? Math.round(completionRate - prevRate) : undefined;

    const blockers = issues.filter(i => i.status === 'Blocked');
    const releaseReady = issues.filter(i => ['Ready for Release', 'Ready for Acceptance'].includes(i.status));
    const inQA = issues.filter(i => ['Ready for QA', 'In QA'].includes(i.status));

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
                            <StatCard label="Done" value={done.length} color="#10b981" change={rateChange} icon={<CheckCircle size={16} />} onClick={() => router.push('/sprint')} />
                            <StatCard label="Active" value={active.length} color="#3b82f6" icon={<Zap size={16} />} onClick={() => router.push('/focus')} />
                            <StatCard label="Blocked" value={blocked.length} color="#ef4444" icon={<AlertTriangle size={16} />} onClick={() => router.push('/focus')} />
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
                    <StatusChart issues={filtered} />
                    <WorkflowFunnelChart issues={issues} />
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
