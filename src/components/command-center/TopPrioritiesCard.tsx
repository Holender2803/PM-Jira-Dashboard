'use client';

import { PrioritizationScoreView } from '@/types/pm-os';
import ScoreBadge from '@/components/prioritization/ScoreBadge';

export default function TopPrioritiesCard({ rows }: { rows: PrioritizationScoreView[] }) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
                <h3 style={{ fontSize: 15 }}>Top Priorities</h3>
                <p style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                    Highest-ranked initiatives and Jira work based on saved RICE scores.
                </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.slice(0, 5).map((row, index) => (
                    <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rank #{index + 1}</div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{row.targetTitle}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                                    {row.initiativeTitle || row.targetType}
                                </div>
                            </div>
                            <ScoreBadge score={row.score} />
                        </div>
                    </div>
                ))}
                {rows.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No saved RICE scores yet.</div>}
            </div>
        </div>
    );
}
