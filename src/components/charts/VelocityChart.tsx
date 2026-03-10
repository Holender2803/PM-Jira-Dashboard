'use client';

import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { VelocityTrendPoint } from '@/lib/analytics';

interface VelocityChartProps {
    data: VelocityTrendPoint[];
}

export default function VelocityChart({ data }: VelocityChartProps) {
    if (data.length === 0) {
        return (
            <div className="chart-container">
                <div className="chart-title">Velocity Trend</div>
                <div
                    style={{
                        minHeight: 220,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        fontSize: 13,
                        textAlign: 'center',
                    }}
                >
                    No completed sprint data yet. Sync Jira and complete sprint work to see velocity.
                </div>
            </div>
        );
    }

    return (
        <div className="chart-container">
            <div className="chart-title">Velocity Trend (Completed Story Points)</div>
            <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                        dataKey="sprintName"
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
                        labelFormatter={(label, payload) => {
                            const sprintEndDate = payload?.[0]?.payload?.sprintEndDate;
                            return sprintEndDate ? `${label} · End ${sprintEndDate}` : String(label);
                        }}
                        formatter={(value, name) => {
                            if (name === 'Completed Points' || name === '3-Sprint Rolling Avg') {
                                return [`${value} pts`, name];
                            }
                            return [value, name];
                        }}
                        contentStyle={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            color: 'var(--text-primary)',
                        }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                        dataKey="completedPoints"
                        name="Completed Points"
                        fill="#6366f1"
                        radius={[4, 4, 0, 0]}
                    />
                    <Line
                        type="monotone"
                        dataKey="rollingAvg3Sprint"
                        name="3-Sprint Rolling Avg"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
