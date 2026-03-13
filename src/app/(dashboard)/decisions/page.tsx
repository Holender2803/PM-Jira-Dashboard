'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmptyState, LoadingSpinner } from '@/components/ui/Badges';
import DecisionCard from '@/components/decisions/DecisionCard';
import DecisionFormSheet from '@/components/decisions/DecisionFormSheet';
import { DecisionInput, DecisionRecord, DecisionWithOptions, InitiativeRecord } from '@/types/pm-os';

export default function DecisionsPage() {
    const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
    const [initiatives, setInitiatives] = useState<InitiativeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState('all');
    const [search, setSearch] = useState('');
    const [initiativeId, setInitiativeId] = useState('');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [activeDecision, setActiveDecision] = useState<DecisionWithOptions | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const initiativeResponse = await fetch('/api/initiatives', { cache: 'no-store' });
            const initiativeData = await initiativeResponse.json() as InitiativeRecord[];
            setInitiatives(initiativeData);

            const params = new URLSearchParams();
            if (status !== 'all') params.set('status', status);
            if (search.trim()) params.set('search', search.trim());
            if (initiativeId) params.set('initiativeId', initiativeId);

            const decisionResponse = await fetch(`/api/decisions?${params.toString()}`, { cache: 'no-store' });
            if (!decisionResponse.ok) {
                throw new Error(`Failed to load decisions (${decisionResponse.status})`);
            }
            setDecisions(await decisionResponse.json() as DecisionRecord[]);
        } catch (loadError) {
            setError(String(loadError));
        } finally {
            setLoading(false);
        }
    }, [initiativeId, search, status]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleSave = async (input: DecisionInput, id?: string) => {
        const response = await fetch(id ? `/api/decisions/${id}` : '/api/decisions', {
            method: id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to save decision.');
        }
        await loadData();
    };

    const openDecision = async (decision: DecisionRecord) => {
        const response = await fetch(`/api/decisions/${decision.id}`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            setError(data?.error || 'Failed to load decision details.');
            return;
        }
        setActiveDecision(data as DecisionWithOptions);
        setSheetOpen(true);
    };

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 16 }}>
                    <div>
                        <h1 className="page-title">🧠 Decisions</h1>
                        <p className="page-subtitle">Track the reasoning behind product decisions and the options that were considered.</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => { setActiveDecision(null); setSheetOpen(true); }}>
                        New Decision
                    </button>
                </div>
            </div>

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="card" style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr 1fr' }}>
                    <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search decisions by title or context" />
                    <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
                        <option value="all">All statuses</option>
                        <option value="draft">Draft</option>
                        <option value="decided">Decided</option>
                        <option value="revisited">Revisited</option>
                        <option value="superseded">Superseded</option>
                    </select>
                    <select className="input" value={initiativeId} onChange={(event) => setInitiativeId(event.target.value)}>
                        <option value="">All initiatives</option>
                        {initiatives.map((initiative) => (
                            <option key={initiative.id} value={initiative.id}>{initiative.title}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>
                ) : error ? (
                    <div className="card"><EmptyState message={error} icon="⚠️" /></div>
                ) : decisions.length === 0 ? (
                    <div className="card"><EmptyState message="No decisions match the current filters." icon="🧠" /></div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {decisions.map((decision) => (
                            <DecisionCard key={decision.id} decision={decision} onEdit={(item) => void openDecision(item)} />
                        ))}
                    </div>
                )}
            </div>

            <DecisionFormSheet
                open={sheetOpen}
                decision={activeDecision}
                initiatives={initiatives}
                onClose={() => setSheetOpen(false)}
                onSave={handleSave}
            />
        </div>
    );
}
