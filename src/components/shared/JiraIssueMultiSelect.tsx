'use client';

import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/app-store';

interface JiraIssueMultiSelectProps {
    value: string[];
    onChange: (next: string[]) => void;
    label?: string;
    helperText?: string;
}

export default function JiraIssueMultiSelect({
    value,
    onChange,
    label = 'Linked Jira Tickets',
    helperText,
}: JiraIssueMultiSelectProps) {
    const issues = useAppStore((state) => state.issues);
    const globallySelected = useAppStore((state) => state.selectedKeys);
    const [query, setQuery] = useState('');

    const selectedKeys = useMemo(() => new Set(value), [value]);
    const quickAddKeys = useMemo(
        () => Array.from(globallySelected).filter((key) => !selectedKeys.has(key)),
        [globallySelected, selectedKeys]
    );
    const filteredIssues = useMemo(() => {
        const term = query.trim().toLowerCase();
        const scoped = issues
            .filter((issue) => !selectedKeys.has(issue.key))
            .slice()
            .sort((left, right) => right.updated.localeCompare(left.updated));

        if (!term) return scoped.slice(0, 12);
        return scoped
            .filter((issue) =>
                issue.key.toLowerCase().includes(term) ||
                issue.summary.toLowerCase().includes(term)
            )
            .slice(0, 12);
    }, [issues, query, selectedKeys]);

    const selectedIssues = useMemo(
        () => value
            .map((key) => issues.find((issue) => issue.key === key))
            .filter((issue): issue is NonNullable<typeof issue> => Boolean(issue)),
        [issues, value]
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {label}
            </label>
            <input
                className="input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Jira issues by key or summary"
            />
            {helperText && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{helperText}</div>
            )}
            {quickAddKeys.length > 0 && (
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onChange([...value, ...quickAddKeys])}
                    style={{ width: 'fit-content' }}
                >
                    Add current Jira selection ({quickAddKeys.length})
                </button>
            )}

            {selectedIssues.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedIssues.map((issue) => (
                        <button
                            key={issue.key}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onChange(value.filter((key) => key !== issue.key))}
                            style={{ maxWidth: '100%' }}
                            title={issue.summary}
                        >
                            <span style={{ fontFamily: 'monospace' }}>{issue.key}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                                {issue.summary}
                            </span>
                            <span style={{ color: 'var(--danger)' }}>×</span>
                        </button>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {filteredIssues.map((issue) => (
                    <button
                        key={issue.key}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => onChange([...value, issue.key])}
                        style={{ justifyContent: 'space-between', border: '1px solid var(--border)' }}
                    >
                        <span style={{ fontFamily: 'monospace', color: 'var(--accent-light)', flexShrink: 0 }}>
                            {issue.key}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', flex: 1 }}>
                            {issue.summary}
                        </span>
                    </button>
                ))}
                {filteredIssues.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {issues.length === 0 ? 'Jira issues will appear here after dashboard data loads.' : 'No matching Jira issues.'}
                    </div>
                )}
            </div>
        </div>
    );
}
