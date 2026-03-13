'use client';

import { DecisionRecord } from '@/types/pm-os';

interface DecisionCardProps {
    decision: DecisionRecord;
    onEdit: (decision: DecisionRecord) => void;
}

export default function DecisionCard({ decision, onEdit }: DecisionCardProps) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: 15 }}>{decision.title}</h3>
                        <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.3)' }}>
                            {decision.status}
                        </span>
                    </div>
                    <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {decision.problemContext}
                    </p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => onEdit(decision)}>
                    Edit
                </button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--text-secondary)', border: '1px solid rgba(148,163,184,0.24)' }}>
                    {decision.decisionDate}
                </span>
                {decision.ownerName && <span className="badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.3)' }}>{decision.ownerName}</span>}
                {decision.primaryInitiativeTitle && <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>{decision.primaryInitiativeTitle}</span>}
                {decision.linkedIssueKeys.length > 0 && <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.28)' }}>{decision.linkedIssueKeys.length} Jira links</span>}
            </div>

            {decision.finalDecision && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Final decision:</strong> {decision.finalDecision}
                </div>
            )}
        </div>
    );
}
