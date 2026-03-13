'use client';

import { StrategyRiskAlert } from '@/types/pm-os';

interface RiskAlertCardProps {
    alert: StrategyRiskAlert;
}

const STYLES = {
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

export default function RiskAlertCard({ alert }: RiskAlertCardProps) {
    const severityStyle = STYLES[alert.severity];

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{alert.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {alert.entityTitle}
                    </div>
                </div>
                <span className="badge" style={severityStyle}>
                    {alert.severity}
                </span>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {alert.description}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {alert.recommendation}
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {alert.type.replace(/_/g, ' ')}
            </div>
        </div>
    );
}
