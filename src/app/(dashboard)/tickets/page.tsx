'use client';
import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore, useFilteredIssues } from '@/store/app-store';
import FilterBar from '@/components/filters/FilterBar';
import IssueTable from '@/components/tables/IssueTable';
import IssueDrawer from '@/components/tables/IssueDrawer';
import SLAHeatRow from '@/components/SLAHeatRow';
import { extractDescriptionText, formatEpicLabel } from '@/lib/issue-format';
import { getSLAAssigneeBreach, getSLAStatus, getSLATrend } from '@/lib/analytics';
import { JiraIssue } from '@/types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Line,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

function toCsvValue(value: unknown): string {
    const text = value === null || value === undefined ? '' : String(value);
    const escaped = text.replace(/"/g, '""');
    return `"${escaped}"`;
}

type SLASortKey = 'key' | 'summary' | 'assignee' | 'status' | 'dueDate' | 'urgency';

export default function TicketsPage() {
    const router = useRouter();
    const {
        filters,
        setFilters,
        savedViews,
        setSavedViews,
        selectedKeys,
        clearSelection,
        workflowGroupFilter,
    } = useAppStore();
    const filtered = useFilteredIssues();

    const [search, setSearch] = useState('');
    const [viewName, setViewName] = useState('');
    const [viewDescription, setViewDescription] = useState('');
    const [savingView, setSavingView] = useState(false);
    const [slaSortKey, setSlaSortKey] = useState<SLASortKey>('dueDate');
    const [slaSortAsc, setSlaSortAsc] = useState(true);
    const [slaDrawerIssue, setSlaDrawerIssue] = useState<JiraIssue | null>(null);

    const visibleIssues = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return filtered;

        return filtered.filter((issue) => {
            const epicLabel = formatEpicLabel(issue, '');
            return (
                issue.key.toLowerCase().includes(term) ||
                issue.summary.toLowerCase().includes(term) ||
                extractDescriptionText(issue.description).toLowerCase().includes(term) ||
                issue.assignee?.displayName.toLowerCase().includes(term) ||
                epicLabel.toLowerCase().includes(term) ||
                issue.labels.some((label) => label.toLowerCase().includes(term))
            );
        });
    }, [filtered, search]);

    const slaStatus = useMemo(
        () => getSLAStatus(filtered, { groupFilter: workflowGroupFilter }),
        [filtered, workflowGroupFilter]
    );
    const slaTrend = useMemo(
        () => getSLATrend(filtered, { days: 28, groupFilter: workflowGroupFilter }),
        [filtered, workflowGroupFilter]
    );
    const slaByAssignee = useMemo(
        () => getSLAAssigneeBreach(filtered, { groupFilter: workflowGroupFilter }).slice(0, 10),
        [filtered, workflowGroupFilter]
    );

    const atRiskIssues = useMemo(() => {
        const sorted = [...slaStatus.atRisk];
        sorted.sort((left, right) => {
            let compare = 0;

            if (slaSortKey === 'key') {
                compare = left.issue.key.localeCompare(right.issue.key);
            } else if (slaSortKey === 'summary') {
                compare = left.issue.summary.localeCompare(right.issue.summary);
            } else if (slaSortKey === 'assignee') {
                compare = (left.issue.assignee?.displayName || 'Unassigned')
                    .localeCompare(right.issue.assignee?.displayName || 'Unassigned');
            } else if (slaSortKey === 'status') {
                compare = left.issue.status.localeCompare(right.issue.status);
            } else if (slaSortKey === 'urgency') {
                compare = left.urgencyRank - right.urgencyRank;
            } else {
                const leftTime = Date.parse(left.dueDate);
                const rightTime = Date.parse(right.dueDate);
                compare = leftTime - rightTime;
            }

            if (compare === 0) {
                compare = right.issue.updated.localeCompare(left.issue.updated);
            }
            return slaSortAsc ? compare : -compare;
        });
        return sorted;
    }, [slaSortAsc, slaSortKey, slaStatus.atRisk]);

    const handleSlaSort = (key: SLASortKey) => {
        if (slaSortKey === key) {
            setSlaSortAsc((current) => !current);
            return;
        }
        setSlaSortKey(key);
        setSlaSortAsc(true);
    };

    const exportCsv = () => {
        const headers = [
            'Key',
            'Summary',
            'Issue Type',
            'Status',
            'Priority',
            'Assignee',
            'Sprint',
            'Story Points',
            'Due Date',
            'Created',
            'Updated',
            'Resolved',
            'Epic',
            'Project',
            'Squad',
        ];

        const rows = visibleIssues.map((issue) => [
            issue.key,
            issue.summary,
            issue.issueType,
            issue.status,
            issue.priority || '',
            issue.assignee?.displayName || '',
            issue.sprint?.name || '',
            issue.storyPoints ?? '',
            issue.dueDate || '',
            issue.created,
            issue.updated,
            issue.resolved || '',
            formatEpicLabel(issue, ''),
            issue.project,
            issue.squad || '',
        ]);

        const csv = [
            headers.map(toCsvValue).join(','),
            ...rows.map((row) => row.map(toCsvValue).join(',')),
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const datePart = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `jira-tickets-${datePart}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const reloadViews = async () => {
        const res = await fetch('/api/saved-views', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) setSavedViews(data);
    };

    const saveView = async () => {
        if (!viewName.trim()) return;
        setSavingView(true);
        try {
            await fetch('/api/saved-views', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: viewName.trim(),
                    description: viewDescription.trim() || undefined,
                    filters,
                }),
            });
            setViewName('');
            setViewDescription('');
            await reloadViews();
        } finally {
            setSavingView(false);
        }
    };

    const deleteView = async (id: string) => {
        await fetch(`/api/saved-views?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        await reloadViews();
    };

    const renderSlaSortIcon = (key: SLASortKey) => {
        if (slaSortKey !== key) return null;
        return slaSortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
    };

    const slaHeaderStyle: CSSProperties = {
        cursor: 'pointer',
        userSelect: 'none',
    };

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                    <div>
                        <h1 className="page-title">🗂 Ticket Explorer</h1>
                        <p className="page-subtitle">
                            Searchable ticket table, multi-select for AI summaries, saved views, and CSV export
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={exportCsv}>
                            Export CSV
                        </button>
                        <button
                            className="btn btn-primary btn-sm"
                            disabled={selectedKeys.size === 0}
                            onClick={() => {
                                setFilters({ selectedKeys: Array.from(selectedKeys), selectedOnly: true });
                                router.push('/ai-reports');
                            }}
                        >
                            AI Summary ({selectedKeys.size})
                        </button>
                        {selectedKeys.size > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={clearSelection}>
                                Clear Selection
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <FilterBar />

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        className="input"
                        placeholder="Search key, summary, description, assignee, labels..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        style={{ maxWidth: 420 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {visibleIssues.length} matching tickets
                    </span>
                </div>

                <div className="dashboard-grid grid-2">
                    <div className="chart-container">
                        <div className="chart-title">At-Risk SLA Trend (Last 4 Weeks)</div>
                        {slaTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <ComposedChart data={slaTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
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
                                    <Bar dataKey="overdue" stackId="risk" fill="#ef4444" name="Overdue" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="dueToday" stackId="risk" fill="#f97316" name="Due Today" radius={[4, 4, 0, 0]} />
                                    <Line type="monotone" dataKey="atRisk" stroke="#f59e0b" strokeWidth={2} dot={false} name="At Risk Total" />
                                    <Line type="monotone" dataKey="totalTracked" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Tracked with Due Date" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No due-date trend data available.</div>
                        )}
                    </div>

                    <div className="chart-container">
                        <div className="chart-title">Assignee SLA Breach Rate</div>
                        {slaByAssignee.length > 0 ? (
                            <ResponsiveContainer width="100%" height={260}>
                                <ComposedChart
                                    data={slaByAssignee.map((row) => ({
                                        ...row,
                                        assigneeLabel: row.assignee.length > 14
                                            ? `${row.assignee.slice(0, 14)}…`
                                            : row.assignee,
                                    }))}
                                    layout="vertical"
                                    margin={{ left: 14 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                    <YAxis
                                        type="category"
                                        dataKey="assigneeLabel"
                                        width={120}
                                        tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--bg-elevated)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 8,
                                            color: 'var(--text-primary)',
                                        }}
                                    />
                                    <Legend />
                                    <Bar dataKey="breachRate" fill="#f59e0b" name="Breach Rate" radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="atRisk" fill="#ef4444" name="At Risk Count" radius={[0, 4, 4, 0]} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No assignee SLA data available.</div>
                        )}
                    </div>
                </div>

                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div
                        style={{
                            padding: '16px 18px 12px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 16,
                            flexWrap: 'wrap',
                        }}
                    >
                        <div>
                            <div className="chart-title" style={{ marginBottom: 4 }}>
                                SLA / Due-Date Risk
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                At-risk tickets are <strong>Overdue</strong> or <strong>Due Today</strong>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(Object.entries(slaStatus.byUrgency) as [keyof typeof slaStatus.byUrgency, number][])
                                .map(([urgency, count]) => (
                                    <span
                                        key={urgency}
                                        className="badge"
                                        style={{
                                            background: 'var(--bg-elevated)',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid var(--border)',
                                        }}
                                    >
                                        {urgency}: {count}
                                    </span>
                                ))}
                        </div>
                    </div>

                    {atRiskIssues.length > 0 ? (
                        <div className="table-wrapper" style={{ border: 0, borderRadius: 0 }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSlaSort('key')} style={slaHeaderStyle}>
                                            Key {renderSlaSortIcon('key')}
                                        </th>
                                        <th onClick={() => handleSlaSort('summary')} style={slaHeaderStyle}>
                                            Summary {renderSlaSortIcon('summary')}
                                        </th>
                                        <th onClick={() => handleSlaSort('assignee')} style={slaHeaderStyle}>
                                            Assignee {renderSlaSortIcon('assignee')}
                                        </th>
                                        <th onClick={() => handleSlaSort('status')} style={slaHeaderStyle}>
                                            Status {renderSlaSortIcon('status')}
                                        </th>
                                        <th onClick={() => handleSlaSort('dueDate')} style={slaHeaderStyle}>
                                            Due Date {renderSlaSortIcon('dueDate')}
                                        </th>
                                        <th onClick={() => handleSlaSort('urgency')} style={slaHeaderStyle}>
                                            Urgency {renderSlaSortIcon('urgency')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {atRiskIssues.map((row) => (
                                        <SLAHeatRow
                                            key={row.issue.key}
                                            row={row}
                                            onOpenIssue={setSlaDrawerIssue}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ padding: '18px 20px', fontSize: 12, color: 'var(--text-muted)' }}>
                            No at-risk tickets in the current filter scope.
                        </div>
                    )}
                </div>

                <div className="dashboard-grid grid-2">
                    <div className="card">
                        <div className="chart-title" style={{ marginBottom: 10 }}>Save Current View</div>
                        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                            <input
                                className="input"
                                placeholder="View name (e.g., My Team Weekly Review)"
                                value={viewName}
                                onChange={(event) => setViewName(event.target.value)}
                            />
                            <input
                                className="input"
                                placeholder="Short description (optional)"
                                value={viewDescription}
                                onChange={(event) => setViewDescription(event.target.value)}
                            />
                            <button className="btn btn-primary btn-sm" disabled={!viewName.trim() || savingView} onClick={saveView}>
                                {savingView ? 'Saving…' : 'Save View'}
                            </button>
                        </div>
                    </div>

                    <div className="card">
                        <div className="chart-title" style={{ marginBottom: 10 }}>Saved Views</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                            {savedViews.map((view) => (
                                <div key={view.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                                    <div>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            style={{ padding: 0, color: 'var(--text-primary)' }}
                                            onClick={() => setFilters(view.filters)}
                                        >
                                            {view.name}
                                        </button>
                                        {view.description && (
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{view.description}</div>
                                        )}
                                    </div>
                                    {!view.isDefault && (
                                        <button className="btn btn-ghost btn-sm" onClick={() => deleteView(view.id)}>
                                            Delete
                                        </button>
                                    )}
                                </div>
                            ))}
                            {savedViews.length === 0 && (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No saved views yet.</div>
                            )}
                        </div>
                    </div>
                </div>

                <IssueTable issues={visibleIssues} />
            </div>

            {slaDrawerIssue && (
                <IssueDrawer issue={slaDrawerIssue} onClose={() => setSlaDrawerIssue(null)} />
            )}
        </div>
    );
}
