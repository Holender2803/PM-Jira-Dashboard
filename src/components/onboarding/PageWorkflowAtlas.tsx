'use client';

import { getPageWorkflowGuide, PAGE_GUIDES, PAGE_SETUP_SEQUENCE } from '@/lib/page-guides';

const CADENCE_LABELS: Record<string, string> = {
    setup: 'Setup',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    as_needed: 'As Needed',
};

const CADENCE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    setup: {
        bg: 'rgba(99,102,241,0.12)',
        color: '#a5b4fc',
        border: '1px solid rgba(99,102,241,0.28)',
    },
    daily: {
        bg: 'rgba(239,68,68,0.12)',
        color: '#fca5a5',
        border: '1px solid rgba(239,68,68,0.28)',
    },
    weekly: {
        bg: 'rgba(245,158,11,0.12)',
        color: '#fcd34d',
        border: '1px solid rgba(245,158,11,0.28)',
    },
    monthly: {
        bg: 'rgba(6,182,212,0.12)',
        color: '#67e8f9',
        border: '1px solid rgba(6,182,212,0.28)',
    },
    as_needed: {
        bg: 'rgba(148,163,184,0.12)',
        color: '#cbd5e1',
        border: '1px solid rgba(148,163,184,0.24)',
    },
};

function setupOrderForPath(path: string): number | null {
    return PAGE_SETUP_SEQUENCE.find((item) => item.path === path)?.order || null;
}

export default function PageWorkflowAtlas() {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
                <h2 style={{ fontSize: 16 }}>Page-By-Page Fill Guide</h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    This is the answer to “what belongs on each page, and what should I review first when I open it?”
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {PAGE_GUIDES.map((guide) => {
                    const workflow = getPageWorkflowGuide(guide.path);
                    const setupOrder = setupOrderForPath(guide.path);

                    return (
                        <div key={guide.path} className="card" style={{ padding: 18, background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <h3 style={{ fontSize: 15 }}>{guide.name}</h3>
                                        {setupOrder ? (
                                            <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.28)' }}>
                                                Setup order #{setupOrder}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.55 }}>
                                        {guide.purpose}
                                    </div>
                                </div>
                                <a href={guide.path} className="btn btn-secondary btn-sm">
                                    Open {guide.name}
                                </a>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {workflow.cadence.map((cadence) => (
                                    <span
                                        key={cadence}
                                        className="badge"
                                        style={CADENCE_COLORS[cadence]}
                                    >
                                        {CADENCE_LABELS[cadence]}
                                    </span>
                                ))}
                            </div>

                            <div className="dashboard-grid grid-2" style={{ alignItems: 'start' }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700, marginBottom: 8 }}>
                                        What To Fill
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {workflow.fillChecklist.map((item) => (
                                            <div key={item} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700, marginBottom: 8 }}>
                                        What To Look At First
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {workflow.lookAtFirst.map((item) => (
                                            <div key={item} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
