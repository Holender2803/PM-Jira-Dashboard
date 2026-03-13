'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/store/app-store';
import { getPageWorkflowGuide, matchPageGuide } from '@/lib/page-guides';
import PageExamplePreview from './PageExamplePreview';
import { BookOpen, Lightbulb, X } from 'lucide-react';

const CADENCE_LABELS: Record<string, string> = {
    setup: 'Setup',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    as_needed: 'As Needed',
};

export default function PageGuideDock() {
    const pathname = usePathname();
    const isPmGuideEnabled = useAppStore((state) => state.isPmGuideEnabled);
    const guide = matchPageGuide(pathname);
    const [manualOpenPath, setManualOpenPath] = useState<string | null>(null);
    const [dismissedPath, setDismissedPath] = useState<string | null>(null);
    const [examplePath, setExamplePath] = useState<string | null>(null);

    if (!guide) return null;

    const workflow = getPageWorkflowGuide(guide.path);
    const open = (isPmGuideEnabled && dismissedPath !== pathname) || manualOpenPath === pathname;
    const showExample = examplePath === pathname;

    return (
        <>
            {!open && (
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                        setDismissedPath(null);
                        setManualOpenPath(pathname);
                    }}
                    style={{
                        position: 'fixed',
                        right: 20,
                        bottom: 20,
                        zIndex: 1100,
                        boxShadow: '0 12px 32px rgba(2,6,23,0.35)',
                    }}
                >
                    <BookOpen size={15} />
                    Guide
                </button>
            )}

            {open && (
                <div
                    className="card"
                    style={{
                        position: 'fixed',
                        right: 20,
                        bottom: 20,
                        width: 'min(360px, calc(100vw - 32px))',
                        zIndex: 1100,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        boxShadow: '0 18px 42px rgba(2,6,23,0.45)',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>
                                Page Guide
                            </div>
                            <h2 style={{ fontSize: 16, marginTop: 4 }}>{guide.name}</h2>
                        </div>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                                setManualOpenPath(null);
                                setDismissedPath(pathname);
                            }}
                        >
                            <X size={14} />
                        </button>
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                        {guide.purpose}
                    </div>

                    <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700, marginBottom: 6 }}>
                            When To Use
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {workflow.cadence.map((cadence) => (
                                <span
                                    key={cadence}
                                    className="badge"
                                    style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.28)' }}
                                >
                                    {CADENCE_LABELS[cadence]}
                                </span>
                            ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700, marginBottom: 6 }}>
                            How To Use
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {guide.howToUse.map((tip) => (
                                <div key={tip} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                    {tip}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="dashboard-grid grid-2" style={{ gap: 10 }}>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700, marginBottom: 6 }}>
                                Fill First
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {workflow.fillChecklist.slice(0, 2).map((item) => (
                                    <div key={item} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700, marginBottom: 6 }}>
                                Look At First
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {workflow.lookAtFirst.slice(0, 3).map((item) => (
                                    <div key={item} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setExamplePath(pathname)}>
                            <Lightbulb size={14} />
                            Show Example
                        </button>
                        <a href="/info" className="btn btn-ghost btn-sm">
                            Open Full Guide
                        </a>
                    </div>
                </div>
            )}

            {showExample && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(2,6,23,0.76)',
                        zIndex: 1300,
                        padding: 24,
                        overflowY: 'auto',
                    }}
                    onClick={() => setExamplePath(null)}
                >
                    <div
                        className="card"
                        style={{
                            width: 'min(920px, 100%)',
                            margin: '0 auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 18,
                            padding: 24,
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>
                                    Example Workflow
                                </div>
                                <h2 style={{ fontSize: 22, marginTop: 4 }}>{guide.example.title}</h2>
                                <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    {guide.example.summary}
                                </div>
                            </div>
                            <button type="button" className="btn btn-ghost" onClick={() => setExamplePath(null)}>
                                Close Example
                            </button>
                        </div>

                        <div className="dashboard-grid grid-2" style={{ alignItems: 'start' }}>
                            <div className="card" style={{ padding: 18, background: 'var(--bg-elevated)' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700, marginBottom: 8 }}>
                                    What To Fill
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {workflow.fillChecklist.map((item) => (
                                        <div key={item} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="card" style={{ padding: 18, background: 'var(--bg-elevated)' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700, marginBottom: 8 }}>
                                    What To Look At First
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {workflow.lookAtFirst.map((tip) => (
                                        <div key={tip} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                            {tip}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <PageExamplePreview path={guide.path} />

                        <div className="card" style={{ padding: 20, background: 'linear-gradient(180deg, rgba(99,102,241,0.08), rgba(15,23,42,0.35))' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700, marginBottom: 10 }}>
                                How To Read This Example
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {guide.example.steps.map((step, index) => (
                                    <div key={step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                        <div
                                            style={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: '50%',
                                                background: 'rgba(99,102,241,0.18)',
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
                                        <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                            {step}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
