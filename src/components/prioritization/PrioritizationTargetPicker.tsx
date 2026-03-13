'use client';

import { useMemo, useState } from 'react';
import { PrioritizationCandidate } from '@/types/pm-os';

interface PrioritizationTargetPickerProps {
    candidates: PrioritizationCandidate[];
    selectedKey: string | null;
    onSelect: (candidate: PrioritizationCandidate) => void;
}

export default function PrioritizationTargetPicker({
    candidates,
    selectedKey,
    onSelect,
}: PrioritizationTargetPickerProps) {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return candidates.slice(0, 30);
        return candidates.filter((candidate) =>
            candidate.title.toLowerCase().includes(term) ||
            (candidate.summary || '').toLowerCase().includes(term) ||
            candidate.targetId.toLowerCase().includes(term)
        ).slice(0, 30);
    }, [candidates, query]);

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Score Targets</div>
            <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issues or initiatives" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
                {filtered.map((candidate) => {
                    const candidateKey = `${candidate.targetType}:${candidate.targetId}`;
                    return (
                        <button
                            key={candidateKey}
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => onSelect(candidate)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                border: '1px solid var(--border)',
                                background: selectedKey === candidateKey ? 'rgba(99,102,241,0.12)' : undefined,
                            }}
                        >
                            <span style={{ fontSize: 11, color: 'var(--accent-light)', textTransform: 'uppercase' }}>
                                {candidate.targetType === 'initiative' ? 'Initiative' : candidate.issueType || 'Jira issue'}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'left' }}>
                                {candidate.title}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'left' }}>
                                {candidate.targetType === 'jira_issue' ? candidate.targetId : candidate.summary || 'Manual initiative'}
                            </span>
                        </button>
                    );
                })}
                {filtered.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No candidates found.</div>}
            </div>
        </div>
    );
}
