'use client';

import { CommandCenterSummary } from '@/types/pm-os';

export default function DecisionInboxCard({ decisions }: { decisions: CommandCenterSummary['decisions'] }) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
                <h3 style={{ fontSize: 15 }}>Decision Inbox</h3>
                <p style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Draft decisions that need closure and the most recent calls on record.
                </p>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Drafts</div>
                    {decisions.drafts.slice(0, 4).map((decision) => (
                        <div key={decision.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{decision.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{decision.decisionDate}</div>
                        </div>
                    ))}
                    {decisions.drafts.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No draft decisions.</div>}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Recent</div>
                    {decisions.recent.slice(0, 4).map((decision) => (
                        <div key={decision.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{decision.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{decision.status} · {decision.decisionDate}</div>
                        </div>
                    ))}
                    {decisions.recent.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No decisions recorded yet.</div>}
                </div>
            </div>
        </div>
    );
}
