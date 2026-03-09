'use client';
import { useMemo } from 'react';
import { useFilteredIssues } from '@/store/app-store';
import FilterBar from '@/components/filters/FilterBar';
import { StatCard } from '@/components/ui/Badges';
import IssueTable from '@/components/tables/IssueTable';
import { calculateWorkflowMetrics } from '@/lib/analytics';
import { StatusChart, WorkflowFunnelChart } from '@/components/charts/DashboardCharts';
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

export default function WorkflowPage() {
    const filtered = useFilteredIssues();
    const metrics = useMemo(() => calculateWorkflowMetrics(filtered), [filtered]);

    const avgTimeData = Object.entries(metrics.avgTimeByStatus)
        .filter(([, avg]) => avg > 0)
        .map(([status, avgDays]) => ({ status, avgDays }))
        .sort((a, b) => b.avgDays - a.avgDays);

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">🛠 Workflow Funnel Dashboard</h1>
                    <p className="page-subtitle">
                        Stage distribution, bottlenecks, bounce backs, and cumulative flow behavior
                    </p>
                </div>
            </div>

            <FilterBar />

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="dashboard-grid grid-4">
                    <StatCard label="Total Tickets" value={filtered.length} color="#6366f1" />
                    <StatCard label="Blocked" value={metrics.blockedAging.length} color="#ef4444" />
                    <StatCard label="Reopens" value={metrics.reopenTotal} color="#f59e0b" />
                    <StatCard label="Bounce Back Tickets" value={metrics.bounceBackIssues.length} color="#ec4899" />
                </div>

                <div className="dashboard-grid grid-2">
                    <StatusChart issues={filtered} />
                    <WorkflowFunnelChart issues={filtered} />
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
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{issue.key} · {issue.summary}</span>
                                                <span style={{ color: 'var(--warning)' }}>{issue.timeInCurrentStatus}d</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
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
                </div>

                <div>
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>🚧 Blocked Aging</h2>
                    <IssueTable issues={metrics.blockedAging} compact maxRows={10} />
                </div>

                <div>
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>↩️ Tickets Bouncing Backward</h2>
                    <IssueTable issues={metrics.bounceBackIssues} compact maxRows={10} />
                </div>
            </div>
        </div>
    );
}
