'use client';

import { ExternalLink, Info, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { ReopenRateMetrics } from '@/lib/analytics';
import IssueKeyButton from '@/components/tables/IssueKeyButton';
import PmGuideTooltip from '@/components/PmGuideTooltip';

interface ReopenRateCardProps {
    data: ReopenRateMetrics;
}

export default function ReopenRateCard({ data }: ReopenRateCardProps) {
    const trend = data.trendVsPrior30Day;
    const trendDirection = trend === null ? 'none' : trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat';

    const trendColor =
        trendDirection === 'up'
            ? 'var(--danger)'
            : trendDirection === 'down'
                ? 'var(--success)'
                : 'var(--text-secondary)';

    const trendLabel =
        trend === null
            ? `No prior ${data.windowDays}-day baseline`
            : `${Math.abs(trend).toFixed(1)}pp ${trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat'} vs prior ${data.windowDays}d`;

    return (
        <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        Re-open Rate
                        <PmGuideTooltip metric="reopen_rate" />
                    </span>
                </div>
                <span
                    title={data.methodology}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        cursor: 'help',
                    }}
                >
                    <Info size={12} />
                </span>
            </div>

            <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}>
                {data.reopenRate.toFixed(1)}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {data.reopenedCount} reopened / {data.totalBugs} total bugs
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: trendColor, fontSize: 12, fontWeight: 600 }}>
                {trendDirection === 'up' && <TrendingUp size={13} />}
                {trendDirection === 'down' && <TrendingDown size={13} />}
                {(trendDirection === 'none' || trendDirection === 'flat') && <Minus size={13} />}
                <span>{trendLabel}</span>
            </div>

            <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                    Top Reopened Tickets
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {data.topReopenedTickets.length === 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No reopened bugs in current scope.</div>
                    )}
                    {data.topReopenedTickets.map((ticket) => (
                        <div
                            key={ticket.key}
                            style={{
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                padding: '6px 8px',
                                background: 'var(--bg-elevated)',
                                display: 'grid',
                                gridTemplateColumns: '1fr auto',
                                gap: 8,
                                alignItems: 'center',
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <IssueKeyButton
                                        issueKey={ticket.key}
                                        jiraUrl={ticket.url}
                                        className="btn btn-ghost btn-sm"
                                        style={{
                                            padding: 0,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: 'var(--accent-light)',
                                            fontFamily: 'monospace',
                                        }}
                                    >
                                        {ticket.key}
                                    </IssueKeyButton>
                                    <a
                                        href={ticket.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: 'var(--text-muted)', display: 'inline-flex' }}
                                        aria-label={`Open ${ticket.key} in Jira`}
                                        title="Open in Jira"
                                    >
                                        <ExternalLink size={12} />
                                    </a>
                                </div>
                                <div
                                    style={{
                                        marginTop: 2,
                                        fontSize: 11,
                                        color: 'var(--text-secondary)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        maxWidth: 260,
                                    }}
                                    title={ticket.summary}
                                >
                                    {ticket.summary}
                                </div>
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: 'var(--danger)',
                                    padding: '3px 8px',
                                    borderRadius: 999,
                                    border: '1px solid rgba(239,68,68,0.35)',
                                    background: 'rgba(239,68,68,0.12)',
                                }}
                            >
                                {ticket.reopenCount}x
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
