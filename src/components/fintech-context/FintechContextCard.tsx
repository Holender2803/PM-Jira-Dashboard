'use client';

import { FintechContextItemRecord } from '@/types/pm-os';

interface FintechContextCardProps {
    item: FintechContextItemRecord;
    onEdit?: (item: FintechContextItemRecord) => void;
}

export default function FintechContextCard({ item, onEdit }: FintechContextCardProps) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: 16 }}>{item.name}</h3>
                        <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.3)' }}>
                            {item.contextType.replace(/_/g, ' ')}
                        </span>
                    </div>
                    {item.description && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 6 }}>
                            {item.description}
                        </div>
                    )}
                </div>
                {onEdit && (
                    <button className="btn btn-secondary btn-sm" onClick={() => onEdit(item)}>
                        Edit
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {item.systemName && <span className="badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.28)' }}>{item.systemName}</span>}
                {item.sourceOfTruth && <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.28)' }}>Source: {item.sourceOfTruth}</span>}
                {item.manualStepFlag && <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.28)' }}>Manual step</span>}
                {item.reconciliationRiskFlag && <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.28)' }}>Reconciliation risk</span>}
                {item.ownerStakeholderName && <span className="badge" style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--text-secondary)', border: '1px solid rgba(148,163,184,0.24)' }}>Owner: {item.ownerStakeholderName}</span>}
                {item.linkedInitiativeTitle && <span className="badge" style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.28)' }}>{item.linkedInitiativeTitle}</span>}
            </div>

            {item.complianceNote && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    <strong>Compliance:</strong> {item.complianceNote}
                </div>
            )}
        </div>
    );
}
