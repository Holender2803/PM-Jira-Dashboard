'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmptyState, LoadingSpinner } from '@/components/ui/Badges';
import InitiativeCard from '@/components/initiatives/InitiativeCard';
import InitiativeFormSheet from '@/components/initiatives/InitiativeFormSheet';
import {
    InitiativeInput,
    InitiativeWithHealth,
    InitiativeStatus,
    ObjectiveRecord,
    OutcomeRecord,
} from '@/types/pm-os';

const STATUSES: Array<InitiativeStatus | 'all'> = [
    'all',
    'proposed',
    'discovery',
    'planned',
    'in_progress',
    'launched',
    'done',
    'on_hold',
    'archived',
];

export default function InitiativesPage() {
    const [initiatives, setInitiatives] = useState<InitiativeWithHealth[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<InitiativeStatus | 'all'>('all');
    const [owner, setOwner] = useState('');
    const [objectives, setObjectives] = useState<ObjectiveRecord[]>([]);
    const [outcomes, setOutcomes] = useState<OutcomeRecord[]>([]);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [activeInitiative, setActiveInitiative] = useState<InitiativeWithHealth | null>(null);

    const loadInitiatives = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set('search', search.trim());
            if (status !== 'all') params.set('status', status);
            if (owner.trim()) params.set('owner', owner.trim());

            const [initiativeResponse, objectiveResponse, outcomeResponse] = await Promise.all([
                fetch(`/api/initiatives?${params.toString()}`, { cache: 'no-store' }),
                fetch('/api/objectives', { cache: 'no-store' }),
                fetch('/api/outcomes', { cache: 'no-store' }),
            ]);

            if (!initiativeResponse.ok || !objectiveResponse.ok || !outcomeResponse.ok) {
                throw new Error(
                    `Failed to load initiatives (${initiativeResponse.status}/${objectiveResponse.status}/${outcomeResponse.status})`
                );
            }

            setInitiatives(await initiativeResponse.json() as InitiativeWithHealth[]);
            setObjectives(await objectiveResponse.json() as ObjectiveRecord[]);
            setOutcomes(await outcomeResponse.json() as OutcomeRecord[]);
        } catch (loadError) {
            setError(String(loadError));
        } finally {
            setLoading(false);
        }
    }, [owner, search, status]);

    useEffect(() => {
        void loadInitiatives();
    }, [loadInitiatives]);

    const handleSave = async (input: InitiativeInput, id?: string) => {
        const response = await fetch(id ? `/api/initiatives/${id}` : '/api/initiatives', {
            method: id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to save initiative.');
        }
        await loadInitiatives();
    };

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 16 }}>
                    <div>
                        <h1 className="page-title">🗺 Initiatives</h1>
                        <p className="page-subtitle">Manual PM initiatives linked to Jira work and delivery progress.</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => { setActiveInitiative(null); setSheetOpen(true); }}>
                        New Initiative
                    </button>
                </div>
            </div>

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="card" style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr 1fr' }}>
                    <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search initiatives by title, summary, or theme" />
                    <select className="input" value={status} onChange={(event) => setStatus(event.target.value as InitiativeStatus | 'all')}>
                        {STATUSES.map((option) => (
                            <option key={option} value={option}>
                                {option === 'all' ? 'All statuses' : option.replace(/_/g, ' ')}
                            </option>
                        ))}
                    </select>
                    <input className="input" value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Filter by owner" />
                </div>

                {loading ? (
                    <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <div className="card"><EmptyState message={error} icon="⚠️" /></div>
                ) : initiatives.length === 0 ? (
                    <div className="card"><EmptyState message="No initiatives match the current filters." icon="🗺" /></div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {initiatives.map((initiative) => (
                            <InitiativeCard
                                key={initiative.id}
                                initiative={initiative}
                                onEdit={(next) => {
                                    setActiveInitiative(next);
                                    setSheetOpen(true);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            <InitiativeFormSheet
                open={sheetOpen}
                initiative={activeInitiative}
                objectives={objectives}
                outcomes={outcomes}
                onClose={() => setSheetOpen(false)}
                onSave={handleSave}
            />
        </div>
    );
}
