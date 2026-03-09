'use client';
import { useMemo, useState } from 'react';
import { useFilteredIssues } from '@/store/app-store';
import { ACTIVE_STATUSES, CLOSED_STATUSES } from '@/lib/workflow';
import FilterBar from '@/components/filters/FilterBar';
import IssueTable from '@/components/tables/IssueTable';
import { StatCard } from '@/components/ui/Badges';
import { JiraIssue } from '@/types';
import { formatEpicLabel, isEpicIssue } from '@/lib/issue-format';

type EpicRow = {
    key: string;
    summary: string;
    label: string;
    epicIssue: JiraIssue | null;
    children: JiraIssue[];
    total: number;
    active: number;
    done: number;
    blocked: number;
    stale: number;
    lastUpdated: string;
};

export default function EpicsPage() {
    const filtered = useFilteredIssues();
    const [activeEpicKey, setActiveEpicKey] = useState<string | null>(null);

    const {
        epicRows,
        ticketsWithoutEpic,
        blockedChildrenTotal,
    } = useMemo(() => {
        const summaryByKey = new Map<string, string>();
        for (const issue of filtered) {
            if (isEpicIssue(issue)) summaryByKey.set(issue.key, issue.summary);
            if (issue.epicKey && issue.epicSummary && issue.epicSummary !== issue.epicKey) {
                summaryByKey.set(issue.epicKey, issue.epicSummary);
            }
        }

        const map = new Map<string, EpicRow>();
        for (const issue of filtered) {
            if (isEpicIssue(issue)) {
                const key = issue.key;
                const row = map.get(key) || {
                    key,
                    summary: summaryByKey.get(key) || issue.summary,
                    label: key,
                    epicIssue: null,
                    children: [],
                    total: 0,
                    active: 0,
                    done: 0,
                    blocked: 0,
                    stale: 0,
                    lastUpdated: issue.updated,
                };
                row.epicIssue = issue;
                row.summary = summaryByKey.get(key) || issue.summary;
                row.label = formatEpicLabel({ epicKey: key, epicSummary: row.summary });
                row.lastUpdated = row.lastUpdated > issue.updated ? row.lastUpdated : issue.updated;
                map.set(key, row);
            }

            if (!issue.epicKey) continue;

            const key = issue.epicKey;
            const row = map.get(key) || {
                key,
                summary: summaryByKey.get(key) || issue.epicSummary || key,
                label: key,
                epicIssue: null,
                children: [],
                total: 0,
                active: 0,
                done: 0,
                blocked: 0,
                stale: 0,
                lastUpdated: issue.updated,
            };

            row.summary = summaryByKey.get(key) || issue.epicSummary || row.summary || key;
            row.label = formatEpicLabel({ epicKey: key, epicSummary: row.summary });
            row.children.push(issue);
            row.total += 1;
            if (ACTIVE_STATUSES.includes(issue.status)) row.active += 1;
            if (CLOSED_STATUSES.includes(issue.status)) row.done += 1;
            if (issue.status === 'Blocked') row.blocked += 1;
            if (issue.timeInCurrentStatus >= 7) row.stale += 1;
            row.lastUpdated = row.lastUpdated > issue.updated ? row.lastUpdated : issue.updated;
            map.set(key, row);
        }

        const rows = [...map.values()].sort((a, b) => {
            if (b.active !== a.active) return b.active - a.active;
            if (b.total !== a.total) return b.total - a.total;
            return a.label.localeCompare(b.label);
        });

        return {
            epicRows: rows,
            ticketsWithoutEpic: filtered.filter((issue) => !isEpicIssue(issue) && !issue.epicKey),
            blockedChildrenTotal: rows.reduce((sum, row) => sum + row.blocked, 0),
        };
    }, [filtered]);

    const selectedEpicKey = activeEpicKey || epicRows[0]?.key || null;
    const selectedEpic = epicRows.find((row) => row.key === selectedEpicKey) || null;
    const selectedEpicIssues = selectedEpic
        ? [...selectedEpic.children].sort((a, b) => b.updated.localeCompare(a.updated))
        : [];

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">📚 Epics</h1>
                    <p className="page-subtitle">
                        Track epic progress with child-ticket flow, blockers, and stale work
                    </p>
                </div>
            </div>

            <FilterBar />

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="dashboard-grid grid-4">
                    <StatCard label="Epics in Scope" value={epicRows.length} color="#6366f1" />
                    <StatCard label="Active Epics" value={epicRows.filter((row) => row.active > 0).length} color="#3b82f6" />
                    <StatCard label="Blocked Child Tickets" value={blockedChildrenTotal} color="#ef4444" />
                    <StatCard label="Tickets Without Epic" value={ticketsWithoutEpic.length} color="#f59e0b" />
                </div>

                <div className="card">
                    <div className="chart-title" style={{ marginBottom: 12 }}>Epic Portfolio</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
                        {epicRows.map((epic) => {
                            const progress = epic.total > 0 ? Math.round((epic.done / epic.total) * 100) : 0;
                            const selected = selectedEpicKey === epic.key;
                            return (
                                <button
                                    key={epic.key}
                                    className="btn btn-ghost"
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        border: '1px solid var(--border)',
                                        borderColor: selected ? 'var(--accent)' : 'var(--border)',
                                        background: selected ? 'rgba(99,102,241,0.08)' : 'transparent',
                                        borderRadius: 8,
                                        padding: '10px 12px',
                                    }}
                                    onClick={() => setActiveEpicKey(epic.key)}
                                >
                                    <span style={{ textAlign: 'left', maxWidth: '70%' }}>
                                        <span style={{ display: 'block', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                                            {epic.label}
                                        </span>
                                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                                            {epic.active} active · {epic.blocked} blocked · {epic.stale} stale
                                        </span>
                                    </span>
                                    <span style={{ textAlign: 'right' }}>
                                        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>
                                            {epic.done}/{epic.total} done
                                        </span>
                                        <span style={{ display: 'block', fontSize: 12, color: 'var(--accent-light)', fontWeight: 600 }}>
                                            {progress}%
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                        {epicRows.length === 0 && (
                            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                No epics match the current filters.
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                        {selectedEpic ? `${selectedEpic.label} · Child Tickets` : 'Epic Child Tickets'}
                    </h2>
                    <IssueTable issues={selectedEpicIssues} />
                </div>

                <div>
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                        Tickets Without Epic ({ticketsWithoutEpic.length})
                    </h2>
                    <IssueTable issues={ticketsWithoutEpic} compact maxRows={12} />
                </div>
            </div>
        </div>
    );
}
