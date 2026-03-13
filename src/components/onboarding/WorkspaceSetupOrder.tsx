'use client';

import { PAGE_SETUP_SEQUENCE } from '@/lib/page-guides';

export default function WorkspaceSetupOrder() {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
                <h2 style={{ fontSize: 16 }}>Start Here: Workspace Setup Order</h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    If the system feels chaotic, do this in order. The later screens depend on the earlier ones being real.
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {PAGE_SETUP_SEQUENCE.map((step) => (
                    <div key={step.path} className="card" style={{ padding: 16, background: 'var(--bg-elevated)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <div
                            style={{
                                width: 30,
                                height: 30,
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
                            {step.order}
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                <h3 style={{ fontSize: 15 }}>{step.title}</h3>
                                <a href={step.path} className="btn btn-secondary btn-sm">
                                    Open
                                </a>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                                {step.reason}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
