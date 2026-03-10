'use client';
import { useMemo } from 'react';
import { useFilteredIssues } from '@/store/app-store';
import FilterBar from '@/components/filters/FilterBar';
import { StatCard } from '@/components/ui/Badges';
import IssueTable from '@/components/tables/IssueTable';
import { calculateBugMetrics, getReopenRates } from '@/lib/analytics';
import { BugPriorityChart } from '@/components/charts/DashboardCharts';
import ReopenRateCard from '@/components/ReopenRateCard';
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

export default function BugsPage() {
    const filtered = useFilteredIssues();
    const metrics = useMemo(() => calculateBugMetrics(filtered), [filtered]);
    const reopenRates = useMemo(() => getReopenRates(filtered), [filtered]);

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
                <div
                    className="dashboard-grid"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}
                >
                    <StatCard label="Total Bugs" value={metrics.total} color="#ef4444" />
                    <StatCard label="Open Bugs" value={metrics.open} color="#f97316" />
                    <StatCard label="In Progress Bugs" value={metrics.inProgress} color="#3b82f6" />
                    <StatCard label="Closed Bugs" value={metrics.closed} color="#10b981" />
                    <ReopenRateCard data={reopenRates} />
                </div>

                <div className="dashboard-grid grid-2">
                    <BugPriorityChart issues={filtered} />
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
                                <Line type="monotone" dataKey="opened" stroke="#ef4444" strokeWidth={2} name="Opened" />
                                <Line type="monotone" dataKey="closed" stroke="#10b981" strokeWidth={2} name="Closed" />
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
                            <BarChart data={metrics.byArea.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                <YAxis type="category" dataKey="area" width={140} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
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
                        <div className="chart-title">Bug Breakdown by Priority</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {metrics.byPriority.map((row) => (
                                <div key={row.priority} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{row.priority}</span>
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
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Oldest Unresolved Bugs</h2>
                    <IssueTable issues={metrics.oldestUnresolved} compact />
                </div>
            </div>
        </div>
    );
}
