'use client';
import { format, parseISO } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import type { CSSProperties } from 'react';
import { StatusBadge } from '@/components/ui/Badges';
import { SLAIssueRow } from '@/lib/analytics';
import { JiraIssue } from '@/types';

interface SLAHeatRowProps {
    row: SLAIssueRow;
    onOpenIssue?: (issue: JiraIssue) => void;
}

function formatDueDate(value: string): string {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, 'MMM d, yyyy');
}

function getUrgencyChipStyle(urgency: SLAIssueRow['urgency']): CSSProperties {
    if (urgency === 'Overdue') {
        return {
            color: '#fecaca',
            background: 'rgba(239, 68, 68, 0.18)',
            border: '1px solid rgba(239, 68, 68, 0.45)',
        };
    }
    if (urgency === 'Due Today') {
        return {
            color: '#fdba74',
            background: 'rgba(249, 115, 22, 0.18)',
            border: '1px solid rgba(249, 115, 22, 0.45)',
        };
    }
    if (urgency === 'Due This Week') {
        return {
            color: '#fde68a',
            background: 'rgba(245, 158, 11, 0.16)',
            border: '1px solid rgba(245, 158, 11, 0.45)',
        };
    }
    if (urgency === 'Due Soon') {
        return {
            color: '#93c5fd',
            background: 'rgba(59, 130, 246, 0.14)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
        };
    }
    return {
        color: '#cbd5e1',
        background: 'rgba(100, 116, 139, 0.16)',
        border: '1px solid rgba(100, 116, 139, 0.35)',
    };
}

function getDaysLabel(daysUntilDue: number): string {
    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)}d overdue`;
    if (daysUntilDue === 0) return 'Due today';
    return `In ${daysUntilDue}d`;
}

export default function SLAHeatRow({ row, onOpenIssue }: SLAHeatRowProps) {
    const assignee = row.issue.assignee?.displayName || 'Unassigned';

    return (
        <tr>
            <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent-light)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {onOpenIssue ? (
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => onOpenIssue(row.issue)}
                        style={{ padding: 0, fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit' }}
                    >
                        {row.issue.key}
                    </button>
                ) : (
                    row.issue.key
                )}
                <a
                    href={row.issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'inline-flex',
                        marginLeft: 6,
                        color: 'var(--text-muted)',
                        verticalAlign: 'middle',
                    }}
                    aria-label={`Open ${row.issue.key} in Jira`}
                >
                    <ExternalLink size={12} />
                </a>
            </td>
            <td style={{ maxWidth: 380 }}>
                {onOpenIssue ? (
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => onOpenIssue(row.issue)}
                        style={{
                            padding: 0,
                            fontSize: 12,
                            color: 'var(--text-primary)',
                            textAlign: 'left',
                            width: '100%',
                            justifyContent: 'flex-start',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {row.issue.summary}
                    </button>
                ) : (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {row.issue.summary}
                    </span>
                )}
            </td>
            <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{assignee}</td>
            <td>
                <StatusBadge status={row.issue.status} size="sm" />
            </td>
            <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{formatDueDate(row.dueDate)}</span>
                    <span style={{ fontSize: 11, color: row.daysUntilDue <= 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {getDaysLabel(row.daysUntilDue)}
                    </span>
                </div>
            </td>
            <td>
                <span className="badge" style={getUrgencyChipStyle(row.urgency)}>
                    {row.urgency}
                </span>
            </td>
        </tr>
    );
}
