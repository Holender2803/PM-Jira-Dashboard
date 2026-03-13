'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, LoadingSpinner } from '@/components/ui/Badges';
import PrioritizationRankTable from '@/components/prioritization/PrioritizationRankTable';
import PrioritizationTargetPicker from '@/components/prioritization/PrioritizationTargetPicker';
import RiceScoreEditor from '@/components/prioritization/RiceScoreEditor';
import {
    InitiativeRecord,
    PrioritizationCandidate,
    PrioritizationInput,
    PrioritizationScoreView,
} from '@/types/pm-os';

export default function PrioritizationPage() {
    const [initiatives, setInitiatives] = useState<InitiativeRecord[]>([]);
    const [candidates, setCandidates] = useState<PrioritizationCandidate[]>([]);
    const [scores, setScores] = useState<PrioritizationScoreView[]>([]);
    const [selectedCandidate, setSelectedCandidate] = useState<PrioritizationCandidate | null>(null);
    const [selectedScore, setSelectedScore] = useState<PrioritizationScoreView | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const selectedKey = selectedScore
        ? `${selectedScore.targetType}:${selectedScore.targetId}`
        : selectedCandidate
            ? `${selectedCandidate.targetType}:${selectedCandidate.targetId}`
            : null;

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [initiativeResponse, candidateResponse, scoreResponse] = await Promise.all([
                fetch('/api/initiatives', { cache: 'no-store' }),
                fetch('/api/prioritization/candidates', { cache: 'no-store' }),
                fetch('/api/prioritization/scores', { cache: 'no-store' }),
            ]);

            if (!initiativeResponse.ok || !candidateResponse.ok || !scoreResponse.ok) {
                throw new Error('Failed to load prioritization data.');
            }

            setInitiatives(await initiativeResponse.json() as InitiativeRecord[]);
            const nextCandidates = await candidateResponse.json() as PrioritizationCandidate[];
            const nextScores = await scoreResponse.json() as PrioritizationScoreView[];
            setCandidates(nextCandidates);
            setScores(nextScores);
            setSelectedCandidate((current) => current || nextCandidates[0] || null);
        } catch (loadError) {
            setError(String(loadError));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const candidateForScore = useMemo(
        () => selectedScore
            ? candidates.find((candidate) => candidate.targetType === selectedScore.targetType && candidate.targetId === selectedScore.targetId) || null
            : selectedCandidate,
        [candidates, selectedCandidate, selectedScore]
    );

    const handleSave = async (input: PrioritizationInput, id?: string) => {
        const response = await fetch(id ? `/api/prioritization/scores/${id}` : '/api/prioritization/scores', {
            method: id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to save RICE score.');
        }
        await loadData();
    };

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">📈 Prioritization</h1>
                    <p className="page-subtitle">Score initiatives and Jira work using bounded RICE buckets so comparisons stay consistent: (Reach × Impact × Confidence) / Effort.</p>
                </div>
            </div>

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {loading ? (
                    <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>
                ) : error ? (
                    <div className="card"><EmptyState message={error} icon="⚠️" /></div>
                ) : (
                    <>
                        <div className="dashboard-grid grid-2">
                            <PrioritizationTargetPicker
                                candidates={candidates}
                                selectedKey={selectedKey}
                                onSelect={(candidate) => {
                                    setSelectedCandidate(candidate);
                                    setSelectedScore(null);
                                }}
                            />
                            <RiceScoreEditor
                                candidate={candidateForScore}
                                score={selectedScore}
                                initiatives={initiatives}
                                onSave={handleSave}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ fontSize: 14, fontWeight: 600 }}>Ranked Backlog</h2>
                                <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedScore(null); setSelectedCandidate(candidates[0] || null); }}>
                                    Clear selection
                                </button>
                            </div>
                            <PrioritizationRankTable
                                rows={scores}
                                onSelect={(row) => {
                                    setSelectedScore(row);
                                    setSelectedCandidate(null);
                                }}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
