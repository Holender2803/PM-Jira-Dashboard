'use client';

import { GuidanceRecommendation } from '@/types/pm-os';

interface RecommendationCardProps {
    recommendation: GuidanceRecommendation;
}

const PRIORITY_STYLE = {
    high: {
        background: 'rgba(239,68,68,0.12)',
        border: '1px solid rgba(239,68,68,0.28)',
        color: '#fca5a5',
    },
    medium: {
        background: 'rgba(245,158,11,0.12)',
        border: '1px solid rgba(245,158,11,0.28)',
        color: '#fbbf24',
    },
    low: {
        background: 'rgba(56,189,248,0.12)',
        border: '1px solid rgba(56,189,248,0.28)',
        color: '#7dd3fc',
    },
} as const;

export default function RecommendationCard({ recommendation }: RecommendationCardProps) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{recommendation.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {recommendation.cadence} cadence
                    </div>
                </div>
                <span className="badge" style={PRIORITY_STYLE[recommendation.priority]}>
                    {recommendation.priority}
                </span>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {recommendation.summary}
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>
                {recommendation.action}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                <strong>Mentor note:</strong> {recommendation.mentorNote}
            </div>

            {recommendation.signals.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {recommendation.signals.map((signal) => (
                        <span
                            key={signal}
                            className="badge"
                            style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--text-secondary)', border: '1px solid rgba(148,163,184,0.24)' }}
                        >
                            {signal}
                        </span>
                    ))}
                </div>
            )}

            {recommendation.linkHref && recommendation.linkLabel && (
                <div>
                    <a href={recommendation.linkHref} className="btn btn-secondary btn-sm">
                        {recommendation.linkLabel}
                    </a>
                </div>
            )}
        </div>
    );
}
