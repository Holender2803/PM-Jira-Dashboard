'use client';
import { ChangeEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Avatar } from '@/components/ui/Badges';
import { AssigneeWorkloadRow } from '@/lib/analytics';
import type { CSSProperties } from 'react';

interface WorkloadGridProps {
    rows: AssigneeWorkloadRow[];
    threshold: number;
    activeAssigneeId?: string;
    onThresholdChange: (value: number) => void;
    onSelectAssignee: (assigneeId: string | null) => void;
}

function formatPoints(value: number): string {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(1);
}

function warningBadgeStyle(color: 'amber' | 'red' | 'orange'): CSSProperties {
    if (color === 'red') {
        return {
            border: '1px solid rgba(248, 113, 113, 0.45)',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#fecaca',
        };
    }
    if (color === 'orange') {
        return {
            border: '1px solid rgba(251, 146, 60, 0.45)',
            background: 'rgba(249, 115, 22, 0.15)',
            color: '#fdba74',
        };
    }
    return {
        border: '1px solid rgba(251, 191, 36, 0.45)',
        background: 'rgba(245, 158, 11, 0.15)',
        color: '#fde68a',
    };
}

export default function WorkloadGrid({
    rows,
    threshold,
    activeAssigneeId,
    onThresholdChange,
    onSelectAssignee,
}: WorkloadGridProps) {
    const handleThresholdChange = (event: ChangeEvent<HTMLInputElement>) => {
        const raw = Number(event.target.value);
        if (Number.isNaN(raw)) return;
        onThresholdChange(Math.max(1, raw));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
                className="card"
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    gap: 12,
                }}
            >
                <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Assignee Workload</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                        Story-point split between In Progress (blue) and Open (gray). Click a card to filter by assignee.
                    </div>
                </div>
                <label
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                    }}
                >
                    Threshold
                    <input
                        className="input"
                        type="number"
                        min={1}
                        value={threshold}
                        onChange={handleThresholdChange}
                        style={{ width: 96, padding: '6px 8px', textAlign: 'right' }}
                    />
                    pts
                </label>
            </div>

            {rows.length === 0 ? (
                <div className="card" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    No assignee workload in current filter scope.
                </div>
            ) : (
                <div className="dashboard-grid grid-3">
                    {rows.map((row) => {
                        const totalPoints = Math.max(row.totalPoints, 1);
                        const inProgressWidth = Math.round((row.inProgressPoints / totalPoints) * 100);
                        const openWidth = Math.max(0, 100 - inProgressWidth);
                        const isSelected = row.accountId !== null && row.accountId === activeAssigneeId;
                        const isClickable = row.accountId !== null;

                        return (
                            <button
                                key={`${row.accountId || 'unassigned'}-${row.displayName}`}
                                type="button"
                                className="card"
                                style={{
                                    textAlign: 'left',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10,
                                    cursor: isClickable ? 'pointer' : 'default',
                                    borderColor: row.overloaded
                                        ? 'rgba(251,191,36,0.55)'
                                        : isSelected
                                            ? 'var(--accent)'
                                            : 'var(--border)',
                                    background: isSelected ? 'rgba(99,102,241,0.08)' : 'var(--bg-card)',
                                    boxShadow: row.overloaded
                                        ? '0 0 0 1px rgba(251,191,36,0.2)'
                                        : undefined,
                                    opacity: isClickable ? 1 : 0.9,
                                }}
                                onClick={() => isClickable && onSelectAssignee(row.accountId)}
                                disabled={!isClickable}
                                title={isClickable ? `Filter by ${row.displayName}` : 'Unassigned tickets cannot be filtered by account'}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                        {row.avatarUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={row.avatarUrl}
                                                alt={row.displayName}
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: '50%',
                                                    objectFit: 'cover',
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    flexShrink: 0,
                                                }}
                                            />
                                        ) : (
                                            <Avatar name={row.displayName} size={36} />
                                        )}
                                        <div style={{ minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    color: 'var(--text-primary)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {row.displayName}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {row.inProgressTickets + row.openTickets} open tickets
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {formatPoints(row.totalPoints)} pts
                                        </div>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        height: 8,
                                        width: '100%',
                                        borderRadius: 999,
                                        background: 'rgba(71, 85, 105, 0.45)',
                                        overflow: 'hidden',
                                        display: 'flex',
                                    }}
                                >
                                    <div style={{ width: `${inProgressWidth}%`, background: '#3b82f6' }} />
                                    <div style={{ width: `${openWidth}%`, background: 'rgba(148, 163, 184, 0.75)' }} />
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 10,
                                        fontSize: 11,
                                        color: 'var(--text-secondary)',
                                    }}
                                >
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                                        In Progress: {formatPoints(row.inProgressPoints)}
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(148, 163, 184, 0.85)' }} />
                                        Open: {formatPoints(row.openPoints)}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {row.overloaded && (
                                        <span
                                            className="badge"
                                            style={warningBadgeStyle('amber')}
                                        >
                                            <AlertTriangle size={11} /> Over {threshold} pts
                                        </span>
                                    )}
                                    {row.blockedCount > 0 && (
                                        <span className="badge" style={warningBadgeStyle('red')}>
                                            {row.blockedCount} blocked
                                        </span>
                                    )}
                                    {row.overdueCount > 0 && (
                                        <span className="badge" style={warningBadgeStyle('orange')}>
                                            {row.overdueCount} overdue
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
