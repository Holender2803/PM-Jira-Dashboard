'use client';
import { useState } from 'react';
import { useFilteredIssues } from '@/store/app-store';
import { ACTIVE_STATUSES } from '@/lib/workflow';
import { StatCard } from '@/components/ui/Badges';
import FilterBar from '@/components/filters/FilterBar';
import IssueTable from '@/components/tables/IssueTable';
import IssueDrawer from '@/components/tables/IssueDrawer';
import { StatusBadge, Avatar } from '@/components/ui/Badges';
import { AlertTriangle, Clock, Users, Layers, ExternalLink } from 'lucide-react';
import { JiraIssue } from '@/types';
import { formatEpicLabel, isEpicIssue } from '@/lib/issue-format';

export default function FocusPage() {
    const issues = useFilteredIssues();
    const [drawerIssue, setDrawerIssue] = useState<JiraIssue | null>(null);

    const activeIssues = issues.filter((issue) => ACTIVE_STATUSES.includes(issue.status));
    const inProgress = issues.filter((issue) => issue.status === 'In Progress');
    const inReview = issues.filter((issue) => ['In Review', 'Reviewed'].includes(issue.status));
    const inQA = issues.filter((issue) => ['Ready for QA', 'In QA'].includes(issue.status));
    const blocked = issues.filter((issue) => issue.status === 'Blocked');
    const releaseReady = issues.filter((issue) => ['Ready for Acceptance', 'Ready for Release'].includes(issue.status));

    const byAssignee: Record<string, typeof issues> = {};
    activeIssues.forEach((issue) => {
        const name = issue.assignee?.displayName || 'Unassigned';
        if (!byAssignee[name]) byAssignee[name] = [];
        byAssignee[name].push(issue);
    });

    const byEpic: Record<string, { count: number; issues: typeof issues }> = {};
    activeIssues.forEach((issue) => {
        const epicLabel = formatEpicLabel(issue);
        if (!byEpic[epicLabel]) byEpic[epicLabel] = { count: 0, issues: [] };
        byEpic[epicLabel].count++;
        byEpic[epicLabel].issues.push(issue);
    });

    const stale = activeIssues.filter((issue) => issue.timeInCurrentStatus >= 7);

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">🎯 Current Focus</h1>
                    <p className="page-subtitle">
                        What the team is working on right now · {activeIssues.length} active tickets
                    </p>
                </div>
            </div>

            <FilterBar showSprintFilter={false} />

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="dashboard-grid grid-4">
                    <StatCard label="In Progress" value={inProgress.length} color="#3b82f6" icon={<Clock size={16} />} />
                    <StatCard label="In Review" value={inReview.length} color="#f59e0b" icon={<Layers size={16} />} />
                    <StatCard label="In QA" value={inQA.length} color="#10b981" icon={<Layers size={16} />} />
                    <StatCard label="Blocked" value={blocked.length} color="#ef4444" icon={<AlertTriangle size={16} />} />
                </div>

                {blocked.length > 0 && (
                    <div>
                        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--danger)' }}>
                            <AlertTriangle size={16} /> Blocked Tickets ({blocked.length})
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {blocked.map((issue) => (
                                <div key={issue.key} className="card" style={{ borderLeft: '3px solid var(--danger)', padding: '14px 18px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ padding: 0, fontFamily: 'monospace', fontSize: 11, color: 'var(--accent-light)' }}
                                                    onClick={() => setDrawerIssue(issue)}
                                                >
                                                    {issue.key}
                                                </button>
                                                {isEpicIssue(issue) && (
                                                    <span
                                                        className="badge"
                                                        style={{ background: 'rgba(245,158,11,0.14)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' }}
                                                    >
                                                        EPIC
                                                    </span>
                                                )}
                                                <StatusBadge status={issue.status} size="sm" />
                                                <a
                                                    href={issue.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ padding: '1px 6px', fontSize: 11 }}
                                                >
                                                    Jira <ExternalLink size={11} />
                                                </a>
                                            </div>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                style={{ padding: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'left' }}
                                                onClick={() => setDrawerIssue(issue)}
                                            >
                                                {issue.summary}
                                            </button>
                                            {issue.epicKey && (
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                                    📦 {formatEpicLabel(issue)}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                                            {issue.assignee && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 4 }}>
                                                    <Avatar name={issue.assignee.displayName} size={20} />
                                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{issue.assignee.displayName.split(' ')[0]}</span>
                                                </div>
                                            )}
                                            <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>
                                                Blocked {issue.timeInCurrentStatus}d
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Users size={16} style={{ color: 'var(--accent)' }} /> Active Work by Assignee
                    </h2>
                    <div className="dashboard-grid grid-3">
                        {Object.entries(byAssignee)
                            .sort((a, b) => b[1].length - a[1].length)
                            .map(([name, userIssues]) => (
                                <div key={name} className="card">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                        {name !== 'Unassigned' && <Avatar name={name} size={28} />}
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{userIssues.length} active</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {userIssues.slice(0, 4).map((issue) => (
                                            <div key={issue.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                                                <StatusBadge status={issue.status} size="sm" />
                                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                    {issue.summary}
                                                </span>
                                            </div>
                                        ))}
                                        {userIssues.length > 4 && (
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 4 }}>
                                                +{userIssues.length - 4} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

                <div>
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Layers size={16} style={{ color: 'var(--accent)' }} /> Active Epics
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {Object.entries(byEpic)
                            .sort((a, b) => b[1].count - a[1].count)
                            .slice(0, 6)
                            .map(([epic, data]) => (
                                <div key={epic} className="card" style={{ padding: '12px 18px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 500 }}>📦 {epic}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                {data.issues.filter((issue) => issue.status === 'In Progress').length} in progress ·{' '}
                                                {data.issues.filter((issue) => issue.status === 'Blocked').length > 0 && (
                                                    <span style={{ color: 'var(--danger)' }}>
                                                        {data.issues.filter((issue) => issue.status === 'Blocked').length} blocked ·{' '}
                                                    </span>
                                                )}
                                                {data.count} total active
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{data.count}</div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>

                {stale.length > 0 && (
                    <div>
                        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--warning)', display: 'flex', gap: 8 }}>
                            <Clock size={16} /> Stale Active Tickets (7d+ no update)
                        </h2>
                        <IssueTable issues={stale} compact maxRows={5} />
                    </div>
                )}

                {releaseReady.length > 0 && (
                    <div>
                        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>🚀 Release Ready</h2>
                        <IssueTable issues={releaseReady} compact />
                    </div>
                )}

                <div>
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>All Active Tickets</h2>
                    <IssueTable issues={activeIssues} />
                </div>
            </div>

            {drawerIssue && <IssueDrawer issue={drawerIssue} onClose={() => setDrawerIssue(null)} />}
        </div>
    );
}
