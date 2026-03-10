'use client';

import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

export interface BurndownMiniPoint {
    day: number;
    label: string;
    idealRemaining: number;
    actualRemaining: number | null;
}

interface BurndownMiniChartProps {
    data: BurndownMiniPoint[];
    hasData: boolean;
    placeholder?: string;
}

export default function BurndownMiniChart({
    data,
    hasData,
    placeholder = 'Burndown requires daily syncs — enable auto-sync in Settings.',
}: BurndownMiniChartProps) {
    if (!hasData) {
        return (
            <div className="chart-container">
                <div className="chart-title">Burndown (Mini)</div>
                <div
                    style={{
                        minHeight: 180,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        fontSize: 13,
                        textAlign: 'center',
                        padding: '0 20px',
                    }}
                >
                    {placeholder}
                </div>
            </div>
        );
    }

    return (
        <div className="chart-container">
            <div className="chart-title">Burndown (Mini)</div>
            <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                        dataKey="label"
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
                        formatter={(value, name) => {
                            if (name === 'Ideal Burndown') return [`${value} tickets`, name];
                            if (name === 'Actual Remaining') {
                                return [value === null ? 'No snapshot' : `${value} tickets`, name];
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
                    <Line
                        type="monotone"
                        dataKey="idealRemaining"
                        name="Ideal Burndown"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        dot={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="actualRemaining"
                        name="Actual Remaining"
                        stroke="#6366f1"
                        strokeWidth={2}
                        connectNulls
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
