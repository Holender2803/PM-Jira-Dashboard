'use client';

import { PAGE_GUIDES } from '@/lib/page-guides';

export default function InfoPage() {
    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">ℹ️ Dashboard Guide</h1>
                    <p className="page-subtitle">
                        What each page does, when to use it, and how to get the best PM story out of it
                    </p>
                </div>
            </div>

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {PAGE_GUIDES.map((page) => (
                    <div key={page.path} className="card" style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
                            <h2 style={{ fontSize: 15, margin: 0 }}>{page.name}</h2>
                            <a href={page.path} className="btn btn-secondary btn-sm">Open {page.name}</a>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                            {page.purpose}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
                            How To Use
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {page.howToUse.map((tip) => (
                                <li key={tip} style={{ fontSize: 13, color: 'var(--text-primary)' }}>{tip}</li>
                            ))}
                        </ul>
                        <details style={{ marginTop: 12 }}>
                            <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--accent-light)', fontWeight: 600 }}>
                                Show Example
                            </summary>
                            <div style={{ marginTop: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{page.example.title}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.55 }}>
                                    {page.example.summary}
                                </div>
                                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {page.example.steps.map((step) => (
                                        <li key={step} style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{step}</li>
                                    ))}
                                </ul>
                            </div>
                        </details>
                    </div>
                ))}
            </div>
        </div>
    );
}
