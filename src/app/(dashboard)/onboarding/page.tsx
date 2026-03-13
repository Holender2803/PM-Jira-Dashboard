'use client';

import { useCallback, useEffect, useState } from 'react';
import OperatingRhythm from '@/components/onboarding/OperatingRhythm';
import OnboardingTimeline from '@/components/onboarding/OnboardingTimeline';
import PageWorkflowAtlas from '@/components/onboarding/PageWorkflowAtlas';
import WorkspaceCompass from '@/components/onboarding/WorkspaceCompass';
import WorkspaceSetupOrder from '@/components/onboarding/WorkspaceSetupOrder';
import { EmptyState, LoadingSpinner, ProgressBar, StatCard } from '@/components/ui/Badges';
import { OnboardingPlaybookView, OnboardingStepRecord } from '@/types/pm-os';
import { BookOpen, CheckCircle, Clock } from 'lucide-react';

export default function OnboardingPage() {
    const [playbook, setPlaybook] = useState<OnboardingPlaybookView | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/onboarding/playbook', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Failed to load onboarding playbook (${response.status})`);
            }
            setPlaybook(await response.json() as OnboardingPlaybookView);
        } catch (loadError) {
            setError(String(loadError));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleToggle = async (step: OnboardingStepRecord, completed: boolean) => {
        const response = await fetch('/api/onboarding/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stepId: step.id,
                completed,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to update onboarding progress.');
        }
        await loadData();
    };

    const completionRate = playbook && playbook.totalCount > 0
        ? Math.round((playbook.completedCount / playbook.totalCount) * 100)
        : 0;

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">🧭 Onboarding</h1>
                    <p className="page-subtitle">Use this page as the operating manual for the whole workspace: what to set up first, what to review daily, and what each page is for.</p>
                </div>
            </div>

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'linear-gradient(180deg, rgba(99,102,241,0.08), rgba(15,23,42,0.35))' }}>
                    <div style={{ fontSize: 12, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>
                        Use This Page First
                    </div>
                    <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                        You do not need every screen every day. Set the workspace up in order, use the daily / weekly / monthly rhythm below, and treat the page atlas as the answer to “what belongs where?”
                    </div>
                </div>

                <WorkspaceCompass />

                {loading ? (
                    <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <div className="card">
                        <EmptyState message={error} icon="⚠️" />
                    </div>
                ) : !playbook ? (
                    <div className="card">
                        <EmptyState message="No onboarding playbook found." icon="🧭" />
                    </div>
                ) : (
                    <>
                        <div className="dashboard-grid grid-3">
                            <StatCard label="Playbook" value={playbook.name} color="#6366f1" icon={<BookOpen size={16} />} />
                            <StatCard label="Completed" value={playbook.completedCount} color="#10b981" icon={<CheckCircle size={16} />} />
                            <StatCard label="Remaining" value={playbook.totalCount - playbook.completedCount} color="#f59e0b" icon={<Clock size={16} />} />
                        </div>

                        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                <div>
                                    <h2 style={{ fontSize: 16 }}>Progress</h2>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                        {playbook.completedCount}/{playbook.totalCount} steps completed
                                    </div>
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{completionRate}%</div>
                            </div>
                            <ProgressBar value={completionRate} color="#10b981" height={10} />
                        </div>

                        <WorkspaceSetupOrder />

                        <OperatingRhythm />

                        <PageWorkflowAtlas />

                        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <h2 style={{ fontSize: 16 }}>30 / 60 / 90 Day Playbook</h2>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                    Use the checklist below after the workspace setup and operating rhythm above are clear.
                                </div>
                            </div>
                            <OnboardingTimeline steps={playbook.steps} onToggle={handleToggle} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
