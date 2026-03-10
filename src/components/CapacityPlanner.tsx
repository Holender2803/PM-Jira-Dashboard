'use client';

import { useMemo, useState } from 'react';
import {
    Bar,
    ComposedChart,
    CartesianGrid,
    ErrorBar,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { CapacityData } from '@/lib/analytics';

interface CapacityPlannerProps {
    data: CapacityData;
}

function clampNumber(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, value);
}

function shortSprintName(value: string): string {
    return value.length > 18 ? `${value.slice(0, 15)}...` : value;
}

export default function CapacityPlanner({ data }: CapacityPlannerProps) {
    const [targetPointsInput, setTargetPointsInput] = useState(
        data.committed > 0 ? String(Math.round(data.committed)) : '0'
    );

    const targetPoints = clampNumber(Number(targetPointsInput) || 0);
    const rollingRate = data.rollingAvgCompletionRate / 100;
    const projectedCompleted = clampNumber(targetPoints * rollingRate);

    const lowRate =
        data.committed > 0
            ? data.forecastConfidenceLow / data.committed
            : rollingRate;
    const highRate =
        data.committed > 0
            ? data.forecastConfidenceHigh / data.committed
            : rollingRate;

    const projectedLow = clampNumber(targetPoints * lowRate);
    const projectedHigh = clampNumber(targetPoints * highRate);
    const projectedCarryOver = clampNumber(targetPoints - projectedCompleted);

    const chartData = useMemo(() => {
        type ChartRow = {
            sprintName: string;
            fullSprintName: string;
            committed: number;
            completed: number;
            remaining: number;
            overrun: number;
            forecast?: number;
            confidence?: [number, number];
        };

        const rows: ChartRow[] = data.bySprint.map((row) => {
            const completed = clampNumber(row.completed);
            const committed = clampNumber(row.committed);
            const remaining = Math.max(0, committed - completed);
            const overrun = Math.max(0, completed - committed);
            return {
                sprintName: shortSprintName(row.sprintName),
                fullSprintName: row.sprintName,
                committed,
                completed: Math.min(completed, committed),
                remaining,
                overrun,
                forecast: undefined,
                confidence: undefined as [number, number] | undefined,
            };
        });

        const forecastCenter = clampNumber(data.forecast3Sprint);
        const forecastLow = clampNumber(data.forecastConfidenceLow);
        const forecastHigh = clampNumber(data.forecastConfidenceHigh);

        rows.push({
            sprintName: 'Forecast',
            fullSprintName: `Forecast (${data.targetSprintName})`,
            committed: data.committed,
            completed: 0,
            remaining: 0,
            overrun: 0,
            forecast: forecastCenter,
            confidence: [
                Math.max(0, forecastCenter - forecastLow),
                Math.max(0, forecastHigh - forecastCenter),
            ],
        });

        return rows;
    }, [data.bySprint, data.committed, data.forecast3Sprint, data.forecastConfidenceHigh, data.forecastConfidenceLow, data.targetSprintName]);

    if (data.bySprint.length === 0) {
        return (
            <div
                style={{
                    minHeight: 220,
                    border: '1px dashed var(--border)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    textAlign: 'center',
                    padding: 20,
                }}
            >
                No sprint point data available yet. Sync Jira and ensure story points are populated.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="dashboard-grid grid-3">
                <div className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Sprint Committed</div>
                    <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{data.committed} pts</div>
                </div>
                <div className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Sprint Completed</div>
                    <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{data.completed} pts</div>
                </div>
                <div className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Forecast (3 Sprint Avg)</div>
                    <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{data.forecast3Sprint} pts</div>
                </div>
            </div>

            <div
                style={{
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    borderRadius: 10,
                    padding: '12px 14px',
                }}
            >
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4, fontWeight: 600 }}>
                    Based on last 3 sprints, team completes ~{Math.round(data.rollingAvgCompletionRate)}% of committed work.
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Capacity delta vs current commitment: {data.teamCapacityDelta} pts{' '}
                    <span style={{ color: data.teamCapacityDelta >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        ({data.teamCapacityDelta >= 0 ? 'under-capacity / room to add' : 'over-capacity / likely carryover'})
                    </span>
                </div>
            </div>

            <div className="chart-container" style={{ padding: 16 }}>
                <div className="chart-title" style={{ marginBottom: 10 }}>
                    Capacity History (Last 6 Sprints) + Forecast
                </div>
                <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={chartData}>
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
                                const full = payload?.[0]?.payload?.fullSprintName;
                                return full || String(label);
                            }}
                            formatter={(value, name) => {
                                if (value === undefined || value === null || value === 0) return null;
                                const n = Number(value);
                                if (name === 'Committed') return [`${n} pts`, 'Committed'];
                                if (name === 'Completed') return [`${n} pts`, 'Completed'];
                                if (name === 'Uncompleted') return [`${n} pts`, 'Uncompleted'];
                                if (name === 'Scope Overrun') return [`${n} pts`, 'Scope Overrun'];
                                if (name === 'Forecast') return [`${n} pts`, 'Forecast'];
                                return [`${n} pts`, String(name)];
                            }}
                            contentStyle={{
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                color: 'var(--text-primary)',
                            }}
                        />
                        <Legend />
                        <Bar dataKey="committed" name="Committed" fill="rgba(148,163,184,0.15)" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="completed" stackId="capacity" name="Completed" fill="#10b981" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="remaining" stackId="capacity" name="Uncompleted" fill="#334155" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="overrun" stackId="capacity" name="Scope Overrun" fill="#f97316" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="forecast" name="Forecast" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                            <ErrorBar
                                dataKey="confidence"
                                width={6}
                                strokeWidth={1.5}
                                stroke="#c4b5fd"
                            />
                        </Bar>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>What-if Capacity</div>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, alignItems: 'start' }}>
                    <div>
                        <label htmlFor="whatif-target-points" style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                            Target Committed Points
                        </label>
                        <input
                            id="whatif-target-points"
                            type="number"
                            min={0}
                            className="input"
                            value={targetPointsInput}
                            onChange={(event) => setTargetPointsInput(event.target.value)}
                        />
                    </div>
                    <div
                        style={{
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            background: 'var(--bg-elevated)',
                            padding: '10px 12px',
                        }}
                    >
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            Projected completion at ~{Math.round(data.rollingAvgCompletionRate)}%:
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                            {projectedCompleted.toFixed(1)} pts
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                            Confidence range: {projectedLow.toFixed(1)} - {projectedHigh.toFixed(1)} pts
                        </div>
                        <div style={{ fontSize: 12, color: projectedCarryOver > 0 ? 'var(--warning)' : 'var(--success)', marginTop: 2 }}>
                            Expected carryover: {projectedCarryOver.toFixed(1)} pts
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
