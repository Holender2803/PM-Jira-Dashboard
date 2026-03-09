'use client';
import { useMemo } from 'react';
import { useFilteredIssues } from '@/store/app-store';
import FilterBar from '@/components/filters/FilterBar';
import { StatCard } from '@/components/ui/Badges';
import IssueTable from '@/components/tables/IssueTable';
import { calculateAgingMetrics } from '@/lib/analytics';
import { AgingAreaChart } from '@/components/charts/DashboardCharts';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from 'recharts';

export default function AgingPage() {
    const filtered = useFilteredIssues();
    const metrics = useMemo(() => calculateAgingMetrics(filtered, 7), [filtered]);

    const oldest = metrics.oldestUnresolved[0];

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">⏳ Ticket Aging Dashboard</h1>
                    <p className="page-subtitle">
                        Track neglected work, stale blocked tickets, and oldest unresolved items
                    </p>
                </div>
            </div>

            <FilterBar />

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="dashboard-grid grid-4">
                    <StatCard label="Unresolved" value={metrics.unresolvedCount} color="#6366f1" />
                    <StatCard label="Stale 7d+" value={metrics.stale.length} color="#f59e0b" />
                    <StatCard label="Stale Blocked" value={metrics.staleBlocked.length} color="#ef4444" />
                    <StatCard label="Oldest Age" value={oldest ? `${oldest.age}d` : '0d'} color="#8b5cf6" />
                </div>

                <div className="dashboard-grid grid-2">
                    <AgingAreaChart issues={filtered} />
                    <div className="chart-container">
                        <div className="chart-title">Aging by Status</div>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={metrics.byStatus.slice(0, 12)} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                <YAxis type="category" dataKey="status" width={120} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--bg-elevated)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        color: 'var(--text-primary)',
                                    }}
                                />
                                <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="dashboard-grid grid-2">
                    <div className="card">
                        <div className="chart-title">Aging Buckets</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                            {metrics.buckets.map((bucket) => (
                                <div key={bucket.label} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                                    <div style={{ fontSize: 18, fontWeight: 700 }}>{bucket.count}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{bucket.label} days</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card">
                        <div className="chart-title">Aging by Assignee</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {metrics.byAssignee.slice(0, 10).map((row) => (
                                <div key={row.assignee} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{row.assignee}</span>
                                    <span style={{ fontWeight: 600, fontSize: 12 }}>{row.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Stale Tickets (7d+ no movement)</h2>
                    <IssueTable issues={metrics.stale} compact maxRows={12} />
                </div>

                <div>
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Oldest Unresolved Tickets</h2>
                    <IssueTable issues={metrics.oldestUnresolved} compact />
                </div>
            </div>
        </div>
    );
}
