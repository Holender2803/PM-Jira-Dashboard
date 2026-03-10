'use client';
import { useState } from 'react';
import { JiraIssue } from '@/types';
import { useAppStore } from '@/store/app-store';
import { StatusBadge, PriorityBadge, IssueTypeBadge, Avatar } from '@/components/ui/Badges';
import { ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import IssueDrawer from './IssueDrawer';
import { formatEpicLabel, isEpicIssue } from '@/lib/issue-format';

type SortKey =
    | 'key'
    | 'summary'
    | 'issueType'
    | 'status'
    | 'assignee'
    | 'priority'
    | 'age'
    | 'updated'
    | 'storyPoints'
    | 'dueDate'
    | 'resolution';

interface IssueTableProps {
    issues: JiraIssue[];
    selectable?: boolean;
    maxRows?: number;
    compact?: boolean;
    showStoryPoints?: boolean;
    showDueDate?: boolean;
    showResolution?: boolean;
}

export default function IssueTable({
    issues,
    selectable = true,
    maxRows,
    compact = false,
    showStoryPoints,
    showDueDate = false,
    showResolution = false,
}: IssueTableProps) {
    const { selectedKeys, toggleSelected } = useAppStore();
    const [sortKey, setSortKey] = useState<SortKey>('updated');
    const [sortAsc, setSortAsc] = useState(false);
    const [drawerIssue, setDrawerIssue] = useState<JiraIssue | null>(null);
    const displayStoryPoints = showStoryPoints ?? !compact;

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else { setSortKey(key); setSortAsc(true); }
    };

    const sorted = [...issues].sort((a, b) => {
        let va: string | number = '', vb: string | number = '';
        if (sortKey === 'key') { va = a.key; vb = b.key; }
        else if (sortKey === 'summary') { va = a.summary; vb = b.summary; }
        else if (sortKey === 'issueType') { va = a.issueType || ''; vb = b.issueType || ''; }
        else if (sortKey === 'status') { va = a.status; vb = b.status; }
        else if (sortKey === 'assignee') { va = a.assignee?.displayName || ''; vb = b.assignee?.displayName || ''; }
        else if (sortKey === 'priority') { va = a.priority || ''; vb = b.priority || ''; }
        else if (sortKey === 'age') { va = a.age; vb = b.age; }
        else if (sortKey === 'updated') { va = a.updated; vb = b.updated; }
        else if (sortKey === 'storyPoints') { va = a.storyPoints || 0; vb = b.storyPoints || 0; }
        else if (sortKey === 'dueDate') {
            va = a.dueDate ? new Date(a.dueDate).getTime() : -1;
            vb = b.dueDate ? new Date(b.dueDate).getTime() : -1;
        } else if (sortKey === 'resolution') {
            va = a.resolution || '';
            vb = b.resolution || '';
        }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortAsc ? cmp : -cmp;
    });

    const displayed = maxRows ? sorted.slice(0, maxRows) : sorted;

    const renderSortIcon = (k: SortKey) => {
        if (sortKey !== k) return null;
        return sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
    };

    const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none' };

    return (
        <>
            <div className="table-wrapper animate-fade-in">
                <table>
                    <thead>
                        <tr>
                            {selectable && <th style={{ width: 40 }}></th>}
                            <th onClick={() => handleSort('key')} style={thStyle}>
                                KEY {renderSortIcon('key')}
                            </th>
                            <th onClick={() => handleSort('summary')} style={thStyle}>
                                SUMMARY {renderSortIcon('summary')}
                            </th>
                            {!compact && (
                                <th onClick={() => handleSort('issueType')} style={thStyle}>
                                    TYPE {renderSortIcon('issueType')}
                                </th>
                            )}
                            <th onClick={() => handleSort('status')} style={thStyle}>
                                STATUS {renderSortIcon('status')}
                            </th>
                            <th onClick={() => handleSort('priority')} style={thStyle}>
                                PRIORITY {renderSortIcon('priority')}
                            </th>
                            <th onClick={() => handleSort('assignee')} style={thStyle}>
                                ASSIGNEE {renderSortIcon('assignee')}
                            </th>
                            {displayStoryPoints && (
                                <th onClick={() => handleSort('storyPoints')} style={thStyle}>
                                    STORY POINTS {renderSortIcon('storyPoints')}
                                </th>
                            )}
                            {showDueDate && (
                                <th onClick={() => handleSort('dueDate')} style={thStyle}>
                                    DUE DATE {renderSortIcon('dueDate')}
                                </th>
                            )}
                            {showResolution && (
                                <th onClick={() => handleSort('resolution')} style={thStyle}>
                                    RESOLUTION {renderSortIcon('resolution')}
                                </th>
                            )}
                            <th onClick={() => handleSort('age')} style={thStyle}>
                                AGE {renderSortIcon('age')}
                            </th>
                            <th style={{ width: 60 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayed.map(issue => (
                            <tr
                                key={issue.key}
                                style={{
                                    cursor: 'pointer',
                                    background: selectedKeys.has(issue.key)
                                        ? 'rgba(99,102,241,0.08)'
                                        : undefined,
                                }}
                            >
                                {selectable && (
                                    <td onClick={e => { e.stopPropagation(); toggleSelected(issue.key); }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedKeys.has(issue.key)}
                                            onChange={() => toggleSelected(issue.key)}
                                            style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                                        />
                                    </td>
                                )}
                                <td
                                    onClick={() => setDrawerIssue(issue)}
                                    style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent-light)', fontWeight: 600, whiteSpace: 'nowrap' }}
                                >
                                    {issue.key}
                                    {isEpicIssue(issue) && (
                                        <span
                                            className="badge"
                                            style={{ marginLeft: 6, background: 'rgba(245,158,11,0.14)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' }}
                                        >
                                            EPIC
                                        </span>
                                    )}
                                </td>
                                <td onClick={() => setDrawerIssue(issue)} style={{ maxWidth: 320 }}>
                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                                        {issue.summary}
                                    </div>
                                    {issue.epicKey && (
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                            📦 {formatEpicLabel(issue)}
                                        </div>
                                    )}
                                </td>
                                {!compact && (
                                    <td onClick={() => setDrawerIssue(issue)}>
                                        <IssueTypeBadge type={issue.issueType} />
                                    </td>
                                )}
                                <td onClick={() => setDrawerIssue(issue)}>
                                    <StatusBadge status={issue.status} size="sm" />
                                </td>
                                <td onClick={() => setDrawerIssue(issue)}>
                                    <PriorityBadge priority={issue.priority} />
                                </td>
                                <td onClick={() => setDrawerIssue(issue)}>
                                    {issue.assignee ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Avatar name={issue.assignee.displayName} size={22} />
                                            <span style={{ fontSize: 12 }}>{issue.assignee.displayName.split(' ')[0]}</span>
                                        </div>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                                    )}
                                </td>
                                {displayStoryPoints && (
                                    <td onClick={() => setDrawerIssue(issue)} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        {issue.storyPoints ?? '—'}
                                    </td>
                                )}
                                {showDueDate && (
                                    <td onClick={() => setDrawerIssue(issue)} style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                        {issue.dueDate
                                            ? new Date(issue.dueDate).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })
                                            : '—'}
                                    </td>
                                )}
                                {showResolution && (
                                    <td onClick={() => setDrawerIssue(issue)} style={{ color: 'var(--text-secondary)', maxWidth: 200 }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '100%' }}>
                                            {issue.resolution || '—'}
                                        </span>
                                    </td>
                                )}
                                <td onClick={() => setDrawerIssue(issue)}>
                                    <span style={{
                                        fontSize: 11,
                                        color: issue.age > 30 ? 'var(--danger)' : issue.age > 14 ? 'var(--warning)' : 'var(--text-muted)',
                                        fontWeight: issue.age > 30 ? 600 : 400,
                                    }}>
                                        {issue.age}d
                                    </span>
                                </td>
                                <td>
                                    <a
                                        href={issue.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        style={{ color: 'var(--text-muted)', display: 'inline-flex', padding: 4 }}
                                    >
                                        <ExternalLink size={13} />
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {displayed.length === 0 && (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No issues match the current filters
                    </div>
                )}
            </div>

            {drawerIssue && (
                <IssueDrawer issue={drawerIssue} onClose={() => setDrawerIssue(null)} />
            )}
        </>
    );
}
