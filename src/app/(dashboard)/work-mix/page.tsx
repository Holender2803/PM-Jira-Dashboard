'use client';
import { useMemo } from 'react';
import { useFilteredIssues, useAppStore } from '@/store/app-store';
import FilterBar from '@/components/filters/FilterBar';
import { StatCard } from '@/components/ui/Badges';
import PmGuideTooltip from '@/components/PmGuideTooltip';
import { calculateWorkMixMetrics, WorkMixBucket } from '@/lib/analytics';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend,
    Cell,
    AreaChart,
    Area,
} from 'recharts';

const BUCKET_COLORS: Record<WorkMixBucket, string> = {
    'Bug': '#ef4444',
    'Feature Request': '#6366f1',
    'Developer Request': '#ec4899',
    'Technical Task': '#06b6d4',
    'Spike': '#a855f7',
    'Chore / Maintenance': '#64748b',
    'Support / Implementation': '#22c55e',
    'Other': '#94a3b8',
};

export default function WorkMixPage() {
    const filtered = useFilteredIssues();
    const { setFilters } = useAppStore();

    const metrics = useMemo(() => calculateWorkMixMetrics(filtered), [filtered]);

    const totalPoints = metrics.rows.reduce((sum, row) => sum + row.storyPoints, 0);

    const barData = metrics.rows.map((row) => ({
        bucket: row.bucket,
        count: row.count,
        color: BUCKET_COLORS[row.bucket],
    }));

    const statusMixData = metrics.rows.map((row) => ({
        bucket: row.bucket,
        open: row.open,
        inProgress: row.inProgress,
        closed: row.closed,
    }));

    const sprintMixData = metrics.sprintOverSprint;

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">🧩 Work Mix Dashboard</h1>
                    <p className="page-subtitle">
                        Composition of work across bugs, features, developer requests, and technical investment
                    </p>
                </div>
            </div>

            <FilterBar />

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="dashboard-grid grid-4">
                    <StatCard label="Total Tickets" value={metrics.total} color="#6366f1" />
                    <StatCard label="Total Story Points" value={totalPoints} color="#8b5cf6" />
                    <StatCard
                        label={
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                Bug : Feature Ratio
                                <PmGuideTooltip metric="bug_ratio" />
                            </span>
                        }
                        value={metrics.bugToFeatureRatio.toFixed(2)}
                        color="#ef4444"
                    />
                    <StatCard label="Dev Request Share" value={`${Math.round(metrics.developerRequestRatio * 100)}%`} color="#ec4899" />
                </div>

                <div className="dashboard-grid grid-2">
                    <div className="chart-container">
                        <div className="chart-title">Count by Work Bucket</div>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={barData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--bg-elevated)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        color: 'var(--text-primary)',
                                    }}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {barData.map((row) => (
                                        <Cell key={row.bucket} fill={row.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="chart-container">
                        <div className="chart-title">Open vs In Progress vs Closed by Bucket</div>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={statusMixData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
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
                                <Bar dataKey="open" stackId="a" fill="#64748b" name="Open" />
                                <Bar dataKey="inProgress" stackId="a" fill="#3b82f6" name="In Progress" />
                                <Bar dataKey="closed" stackId="a" fill="#10b981" name="Closed" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-container">
                    <div className="chart-title">Sprint-over-Sprint Mix Change</div>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={sprintMixData}>
                            <defs>
                                <linearGradient id="mixBugs" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="mixFeatures" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="sprintName" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
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
                            <Area type="monotone" dataKey="bugs" stroke="#ef4444" fill="url(#mixBugs)" strokeWidth={2} name="Bugs" />
                            <Area type="monotone" dataKey="features" stroke="#6366f1" fill="url(#mixFeatures)" strokeWidth={2} name="Features" />
                            <Area type="monotone" dataKey="devRequests" stroke="#ec4899" fill="none" strokeWidth={2} name="Developer Requests" />
                            <Area type="monotone" dataKey="tasks" stroke="#06b6d4" fill="none" strokeWidth={2} name="Tasks/Other" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="card">
                    <div className="chart-title">Engineering Investment Allocation</div>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Bucket</th>
                                    <th>Count</th>
                                    <th>Story Points</th>
                                    <th>Open</th>
                                    <th>In Progress</th>
                                    <th>Closed</th>
                                    <th>Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metrics.rows.map((row) => {
                                    const share = metrics.total > 0 ? Math.round((row.count / metrics.total) * 100) : 0;
                                    return (
                                        <tr key={row.bucket}>
                                            <td>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ color: BUCKET_COLORS[row.bucket], padding: 0 }}
                                                    onClick={() => setFilters({ bugsOnly: row.bucket === 'Bug' ? true : false })}
                                                >
                                                    {row.bucket}
                                                </button>
                                            </td>
                                            <td>{row.count}</td>
                                            <td>{row.storyPoints}</td>
                                            <td>{row.open}</td>
                                            <td>{row.inProgress}</td>
                                            <td>{row.closed}</td>
                                            <td>{share}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
