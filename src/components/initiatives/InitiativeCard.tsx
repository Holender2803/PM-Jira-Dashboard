'use client';

import { InitiativeWithHealth } from '@/types/pm-os';
import InitiativeHealthBadge from './InitiativeHealthBadge';
import InitiativeJiraLinks from './InitiativeJiraLinks';

interface InitiativeCardProps {
    initiative: InitiativeWithHealth;
    onEdit?: (initiative: InitiativeWithHealth) => void;
}

export default function InitiativeCard({ initiative, onEdit }: InitiativeCardProps) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: 16 }}>{initiative.title}</h3>
                        <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.3)' }}>
                            {initiative.status.replace(/_/g, ' ')}
                        </span>
                    </div>
                    {initiative.summary && (
                        <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {initiative.summary}
                        </p>
                    )}
                </div>
                {onEdit && (
                    <button className="btn btn-secondary btn-sm" onClick={() => onEdit(initiative)}>
                        Edit
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <InitiativeHealthBadge health={initiative.health} />
                {initiative.theme && <span className="badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.3)' }}>{initiative.theme}</span>}
                {initiative.ownerName && <span className="badge" style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--text-secondary)', border: '1px solid rgba(148,163,184,0.24)' }}>{initiative.ownerName}</span>}
                {initiative.targetDate && <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.28)' }}>Target {initiative.targetDate}</span>}
                {initiative.objectiveTitle && (
                    <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.28)' }}>
                        Objective: {initiative.objectiveTitle}
                    </span>
                )}
                {initiative.outcomeTitle && (
                    <span className="badge" style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.28)' }}>
                        Outcome: {initiative.outcomeTitle}
                    </span>
                )}
                {initiative.health.blockedLinkedIssues > 0 && (
                    <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
                        {initiative.health.blockedLinkedIssues} blocked
                    </span>
                )}
            </div>

            {initiative.notes && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {initiative.notes}
                </div>
            )}

            <InitiativeJiraLinks health={initiative.health} />
        </div>
    );
}
