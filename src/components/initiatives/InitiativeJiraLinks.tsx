'use client';

import { InitiativeHealth } from '@/types/pm-os';

export default function InitiativeJiraLinks({ health }: { health: InitiativeHealth }) {
    if (health.linkedIssues.length === 0) {
        return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No linked Jira issues yet.</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {health.linkedIssues.slice(0, 4).map((issue) => (
                <a
                    key={issue.key}
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    style={{ justifyContent: 'space-between', border: '1px solid var(--border)' }}
                >
                    <span style={{ fontFamily: 'monospace', color: 'var(--accent-light)', flexShrink: 0 }}>
                        {issue.key}
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                        {issue.summary}
                    </span>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{issue.status}</span>
                </a>
            ))}
            {health.linkedIssues.length > 4 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    +{health.linkedIssues.length - 4} more linked issues
                </div>
            )}
        </div>
    );
}
