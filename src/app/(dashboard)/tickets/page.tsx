'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore, useFilteredIssues } from '@/store/app-store';
import FilterBar from '@/components/filters/FilterBar';
import IssueTable from '@/components/tables/IssueTable';
import { extractDescriptionText, formatEpicLabel } from '@/lib/issue-format';

function toCsvValue(value: unknown): string {
    const text = value === null || value === undefined ? '' : String(value);
    const escaped = text.replace(/"/g, '""');
    return `"${escaped}"`;
}

export default function TicketsPage() {
    const router = useRouter();
    const {
        filters,
        setFilters,
        savedViews,
        setSavedViews,
        selectedKeys,
        clearSelection,
    } = useAppStore();
    const filtered = useFilteredIssues();

    const [search, setSearch] = useState('');
    const [viewName, setViewName] = useState('');
    const [viewDescription, setViewDescription] = useState('');
    const [savingView, setSavingView] = useState(false);

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
        </div>
    );
}
