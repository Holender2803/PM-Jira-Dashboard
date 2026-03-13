'use client';

import { InitiativeRecord, StakeholderRecord } from '@/types/pm-os';

interface StakeholderCardProps {
    stakeholder: StakeholderRecord;
    initiativesById: Map<string, InitiativeRecord>;
    onEdit?: (stakeholder: StakeholderRecord) => void;
    onLogInteraction?: (stakeholder: StakeholderRecord) => void;
    onDelete?: (stakeholder: StakeholderRecord) => void;
    deleting?: boolean;
}

export default function StakeholderCard({
    stakeholder,
    initiativesById,
    onEdit,
    onLogInteraction,
    onDelete,
    deleting = false,
}: StakeholderCardProps) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: 16 }}>{stakeholder.name}</h3>
                        <span className="badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.3)' }}>
                            {stakeholder.relationshipType.replace(/_/g, ' ')}
                        </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                        {[stakeholder.role, stakeholder.organization].filter(Boolean).join(' · ') || 'No role or organization yet'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {onLogInteraction && (
                        <button className="btn btn-primary btn-sm" onClick={() => onLogInteraction(stakeholder)}>
                            Log Interaction
                        </button>
                    )}
                    {onEdit && (
                        <button className="btn btn-secondary btn-sm" onClick={() => onEdit(stakeholder)}>
                            Edit
                        </button>
                    )}
                    {onDelete && (
                        <button className="btn btn-danger btn-sm" onClick={() => onDelete(stakeholder)} disabled={deleting}>
                            {deleting ? 'Deleting…' : 'Delete'}
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.28)' }}>
                    {stakeholder.interactionCount} interaction{stakeholder.interactionCount === 1 ? '' : 's'}
                </span>
                {stakeholder.latestInteractionAt && (
                    <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.28)' }}>
                        Last touch: {stakeholder.latestInteractionAt}
                    </span>
                )}
            </div>

            {stakeholder.notes && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    {stakeholder.notes}
                </div>
            )}

            {stakeholder.linkedInitiativeIds.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {stakeholder.linkedInitiativeIds.map((initiativeId) => {
                        const initiative = initiativesById.get(initiativeId);
                        return (
                            <span
                                key={initiativeId}
                                className="badge"
                                style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.28)' }}
                            >
                                {initiative?.title || initiativeId}
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
