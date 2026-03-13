'use client';

import { OnboardingStepRecord } from '@/types/pm-os';

interface OnboardingTimelineProps {
    steps: OnboardingStepRecord[];
    onToggle: (step: OnboardingStepRecord, completed: boolean) => Promise<void>;
}

const STAGES = [
    { id: '0-30', title: 'First 30 Days', min: 0, max: 30 },
    { id: '31-60', title: 'Days 31-60', min: 31, max: 60 },
    { id: '61-90', title: 'Days 61-90', min: 61, max: 90 },
];

export default function OnboardingTimeline({ steps, onToggle }: OnboardingTimelineProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {STAGES.map((stage) => {
                const stageSteps = steps.filter((step) => step.dayStart >= stage.min && step.dayEnd <= stage.max);
                return (
                    <div key={stage.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <div>
                                <h2 style={{ fontSize: 16 }}>{stage.title}</h2>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                    {stageSteps.filter((step) => step.completedAt).length}/{stageSteps.length} completed
                                </div>
                            </div>
                        </div>

                        {stageSteps.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                No steps configured for this stage.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {stageSteps.map((step) => (
                                    <div key={step.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <h3 style={{ fontSize: 14 }}>{step.title}</h3>
                                                    <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.28)' }}>
                                                        {step.category}
                                                    </span>
                                                    {step.completedAt && (
                                                        <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.28)' }}>
                                                            Done
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 6 }}>
                                                    {step.description}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className={step.completedAt ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
                                                onClick={() => void onToggle(step, !step.completedAt)}
                                            >
                                                {step.completedAt ? 'Mark Incomplete' : 'Mark Complete'}
                                            </button>
                                        </div>

                                        {step.successCriteria && (
                                            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                                <strong>Success criteria:</strong> {step.successCriteria}
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                Day {step.dayStart}-{step.dayEnd}
                                            </div>
                                            {step.linkedPath && (
                                                <a href={step.linkedPath} className="btn btn-ghost btn-sm">
                                                    Open linked page
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
