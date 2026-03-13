'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import RecommendationCard from '@/components/coach/RecommendationCard';
import { EmptyState, LoadingSpinner, StatCard } from '@/components/ui/Badges';
import { GuidanceRecommendation } from '@/types/pm-os';
import { CalendarRange, CalendarSync, CalendarDays } from 'lucide-react';

export default function CoachPage() {
    const [recommendations, setRecommendations] = useState<GuidanceRecommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/coach/recommendations', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Failed to load coaching recommendations (${response.status})`);
            }
            setRecommendations(await response.json() as GuidanceRecommendation[]);
        } catch (loadError) {
            setError(String(loadError));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const grouped = useMemo(() => ({
        daily: recommendations.filter((recommendation) => recommendation.cadence === 'daily'),
        weekly: recommendations.filter((recommendation) => recommendation.cadence === 'weekly'),
        monthly: recommendations.filter((recommendation) => recommendation.cadence === 'monthly'),
    }), [recommendations]);

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">🎓 Coach</h1>
                    <p className="page-subtitle">Deterministic PM guidance that turns delivery, strategy, and decision signals into concrete next actions.</p>
                </div>
            </div>

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="dashboard-grid grid-3">
                    <StatCard label="Daily Actions" value={grouped.daily.length} color="#ef4444" icon={<CalendarDays size={16} />} />
                    <StatCard label="Weekly Reviews" value={grouped.weekly.length} color="#f59e0b" icon={<CalendarSync size={16} />} />
                    <StatCard label="Monthly Cadence" value={grouped.monthly.length} color="#06b6d4" icon={<CalendarRange size={16} />} />
                </div>

                {loading ? (
                    <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <div className="card">
                        <EmptyState message={error} icon="⚠️" />
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                        {(['daily', 'weekly', 'monthly'] as const).map((cadence) => (
                            <div key={cadence}>
                                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                                    {cadence} recommendations
                                </h2>
                                {grouped[cadence].length === 0 ? (
                                    <div className="card">
                                        <EmptyState message={`No ${cadence} recommendations right now.`} icon="✅" />
                                    </div>
                                ) : (
                                    <div className="dashboard-grid grid-3">
                                        {grouped[cadence].map((recommendation) => (
                                            <RecommendationCard key={recommendation.id} recommendation={recommendation} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
