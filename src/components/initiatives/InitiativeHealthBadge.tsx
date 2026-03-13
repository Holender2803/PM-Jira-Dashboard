'use client';

import { InitiativeHealth } from '@/types/pm-os';

export default function InitiativeHealthBadge({ health }: { health: InitiativeHealth }) {
    return (
        <span
            className="badge"
            style={{
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.28)',
                color: '#34d399',
            }}
        >
            {health.completionRate}% complete · {health.doneLinkedIssues}/{health.totalLinkedIssues || 0} done
        </span>
    );
}
