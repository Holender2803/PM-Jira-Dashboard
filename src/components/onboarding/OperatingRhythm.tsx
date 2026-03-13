'use client';

import { OPERATING_RHYTHM, PAGE_GUIDES } from '@/lib/page-guides';

function labelForPath(path: string): string {
    return PAGE_GUIDES.find((guide) => guide.path === path)?.name || path;
}

export default function OperatingRhythm() {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
                <h2 style={{ fontSize: 16 }}>PM Operating Rhythm</h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Use this as the answer to “what do I look at, and when?”
                </div>
            </div>

            <div className="dashboard-grid grid-3">
                {OPERATING_RHYTHM.map((item) => (
                    <div key={item.cadence} className="card" style={{ padding: 18, background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>
                                {item.cadence}
                            </div>
                            <h3 style={{ fontSize: 15, marginTop: 4 }}>{item.title}</h3>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.55 }}>
                                {item.summary}
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700, marginBottom: 6 }}>
                                Pages
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {item.paths.map((path) => (
                                    <a key={path} href={path} className="btn btn-secondary btn-sm">
                                        {labelForPath(path)}
                                    </a>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700, marginBottom: 6 }}>
                                Questions To Answer
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {item.questions.map((question) => (
                                    <div key={question} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                        {question}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
