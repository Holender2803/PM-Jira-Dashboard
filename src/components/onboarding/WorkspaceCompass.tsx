'use client';

import { PAGE_GUIDES, START_DAY_FOCUS, WORKSPACE_LANES } from '@/lib/page-guides';

function labelForPath(path: string): string {
    return PAGE_GUIDES.find((guide) => guide.path === path)?.name || path;
}

interface WorkspaceCompassProps {
    compact?: boolean;
}

export default function WorkspaceCompass({ compact = false }: WorkspaceCompassProps) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
                <h2 style={{ fontSize: 16 }}>{compact ? 'Start Today' : 'Simplified Workspace Map'}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {compact
                        ? 'You do not need every screen every day. Start with this sequence and treat the rest as evidence or specialist workspaces.'
                        : 'Use this when the workspace feels too large. Start with the daily flow, then open other groups only when the question in front of you actually requires them.'}
                </div>
            </div>

            <div className="dashboard-grid grid-3" style={{ alignItems: 'start' }}>
                {START_DAY_FOCUS.map((step, index) => (
                    <div
                        key={step.path}
                        className="card"
                        style={{
                            padding: 16,
                            background: 'var(--bg-elevated)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    background: 'rgba(99,102,241,0.16)',
                                    border: '1px solid rgba(99,102,241,0.35)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--accent-light)',
                                    fontWeight: 700,
                                    flexShrink: 0,
                                }}
                            >
                                {index + 1}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{labelForPath(step.path)}</div>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                            {step.why}
                        </div>
                        <a href={step.path} className="btn btn-secondary btn-sm" style={{ width: 'fit-content' }}>
                            Open {labelForPath(step.path)}
                        </a>
                    </div>
                ))}
            </div>

            <div
                className="card"
                style={{
                    padding: 16,
                    background: 'linear-gradient(180deg, rgba(99,102,241,0.08), rgba(15,23,42,0.28))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }}
            >
                <div style={{ fontSize: 12, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>
                    Rule Of Thumb
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    Command Center tells you where to intervene. PM Tasks tells you what you personally need to do.
                    Sprint and Focus tell you if delivery is drifting. Coach turns that into actions.
                    Everything else should be opened because you have a specific question, not because you feel obligated to review every screen.
                </div>
            </div>

            {!compact && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {WORKSPACE_LANES.map((lane) => (
                        <div
                            key={lane.id}
                            className="card"
                            style={{
                                padding: 18,
                                background: 'var(--bg-elevated)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                            }}
                        >
                            <div>
                                <h3 style={{ fontSize: 15 }}>{lane.title}</h3>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.55 }}>
                                    {lane.summary}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {lane.paths.map((path) => (
                                    <a key={path} href={path} className="btn btn-secondary btn-sm">
                                        {labelForPath(path)}
                                    </a>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
