'use client';

import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { CycleLeadTimeDistribution } from '@/lib/analytics';

interface CycleTimeChartProps {
    distribution: CycleLeadTimeDistribution;
    mode: 'cycle' | 'lead';
}

function formatIssueTypeLabel(issueType: string): string {
    if (issueType === 'Subtask') return 'Sub-task';
    return issueType;
}

export default function CycleTimeChart({ distribution, mode }: CycleTimeChartProps) {
    const metricLabel = mode === 'cycle' ? 'Cycle Time' : 'Lead Time';
    const metricColor = mode === 'cycle' ? '#06b6d4' : '#8b5cf6';
    const histogramData = distribution.histogram.map((bin) => ({
        bucket: bin.bucket,
        count: bin.count,
    }));

    if (distribution.totalPoints === 0) {
        return (
            <div
                style={{
                    minHeight: 240,
                    border: '1px dashed var(--border)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                }}
            >
                No resolved tickets with {metricLabel.toLowerCase()} data for this selection.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: 8,
                }}
            >
                {[
                    { label: 'Sample Size', value: `${distribution.totalPoints}` },
                    { label: 'P50', value: `${distribution.percentiles.p50}d` },
                    { label: 'P75', value: `${distribution.percentiles.p75}d` },
                    { label: 'P95', value: `${distribution.percentiles.p95}d` },
                ].map((item) => (
                    <div
                        key={item.label}
                        style={{
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            background: 'var(--bg-elevated)',
                            padding: '8px 10px',
                        }}
                    >
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {item.label}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                            {item.value}
                        </div>
                    </div>
                ))}
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={histogramData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                        dataKey="bucket"
                        tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                    />
                    <Tooltip
                        formatter={(value) => [`${value} tickets`, 'Count']}
                        labelFormatter={(label) => `${metricLabel}: ${label}`}
                        contentStyle={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            color: 'var(--text-primary)',
                        }}
                    />
                    <Bar dataKey="count" fill={metricColor} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>

            {distribution.byIssueType.length > 1 && (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Issue Type</th>
                                <th>Count</th>
                                <th>P50</th>
                                <th>P75</th>
                                <th>P95</th>
                            </tr>
                        </thead>
                        <tbody>
                            {distribution.byIssueType.map((group) => (
                                <tr key={group.issueType}>
                                    <td>{formatIssueTypeLabel(group.issueType)}</td>
                                    <td>{group.rawData.length}</td>
                                    <td>{group.percentiles.p50}d</td>
                                    <td>{group.percentiles.p75}d</td>
                                    <td>{group.percentiles.p95}d</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
