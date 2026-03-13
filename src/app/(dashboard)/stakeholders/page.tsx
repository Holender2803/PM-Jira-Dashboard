'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, LoadingSpinner, StatCard } from '@/components/ui/Badges';
import StakeholderCard from '@/components/stakeholders/StakeholderCard';
import StakeholderFormSheet from '@/components/stakeholders/StakeholderFormSheet';
import StakeholderInteractionFormSheet from '@/components/stakeholders/StakeholderInteractionFormSheet';
import {
    InitiativeRecord,
    StakeholderInput,
    StakeholderInteractionInput,
    StakeholderInteractionRecord,
    StakeholderRecord,
    StakeholderRelationshipType,
} from '@/types/pm-os';
import { Building2, Handshake, MessagesSquare, Users } from 'lucide-react';

const RELATIONSHIP_FILTERS: Array<StakeholderRelationshipType | 'all'> = [
    'all',
    'sales',
    'client',
    'engineering',
    'design',
    'support',
    'executive',
    'partner',
    'compliance',
    'operations',
];

export default function StakeholdersPage() {
    const [stakeholders, setStakeholders] = useState<StakeholderRecord[]>([]);
    const [interactions, setInteractions] = useState<StakeholderInteractionRecord[]>([]);
    const [initiatives, setInitiatives] = useState<InitiativeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [relationshipType, setRelationshipType] = useState<StakeholderRelationshipType | 'all'>('all');
    const [organization, setOrganization] = useState('');

    const [stakeholderSheetOpen, setStakeholderSheetOpen] = useState(false);
    const [interactionSheetOpen, setInteractionSheetOpen] = useState(false);
    const [activeStakeholder, setActiveStakeholder] = useState<StakeholderRecord | null>(null);
    const [activeInteraction, setActiveInteraction] = useState<StakeholderInteractionRecord | null>(null);
    const [defaultStakeholderId, setDefaultStakeholderId] = useState<string | null>(null);
    const [deletingStakeholderId, setDeletingStakeholderId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set('search', search.trim());
            if (relationshipType !== 'all') params.set('relationshipType', relationshipType);
            if (organization.trim()) params.set('organization', organization.trim());

            const [stakeholderResponse, interactionResponse, initiativeResponse] = await Promise.all([
                fetch(`/api/stakeholders?${params.toString()}`, { cache: 'no-store' }),
                fetch('/api/stakeholders/interactions', { cache: 'no-store' }),
                fetch('/api/initiatives', { cache: 'no-store' }),
            ]);

            if (!stakeholderResponse.ok || !interactionResponse.ok || !initiativeResponse.ok) {
                throw new Error('Failed to load stakeholder workspace.');
            }

            setStakeholders(await stakeholderResponse.json() as StakeholderRecord[]);
            setInteractions(await interactionResponse.json() as StakeholderInteractionRecord[]);
            setInitiatives(await initiativeResponse.json() as InitiativeRecord[]);
        } catch (loadError) {
            setError(String(loadError));
        } finally {
            setLoading(false);
        }
    }, [organization, relationshipType, search]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const initiativesById = useMemo(
        () => new Map<string, InitiativeRecord>(initiatives.map((initiative) => [initiative.id, initiative])),
        [initiatives]
    );

    const stats = useMemo(() => ({
        total: stakeholders.length,
        external: stakeholders.filter((stakeholder) => ['sales', 'client', 'partner'].includes(stakeholder.relationshipType)).length,
        orgs: new Set(stakeholders.map((stakeholder) => stakeholder.organization).filter(Boolean)).size,
        interactions: interactions.length,
    }), [interactions.length, stakeholders]);

    const handleSaveStakeholder = async (input: StakeholderInput, id?: string) => {
        const response = await fetch(id ? `/api/stakeholders/${id}` : '/api/stakeholders', {
            method: id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to save stakeholder.');
        }
        await loadData();
    };

    const handleSaveInteraction = async (input: StakeholderInteractionInput, id?: string) => {
        const response = await fetch(id ? `/api/stakeholders/interactions/${id}` : '/api/stakeholders/interactions', {
            method: id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to save stakeholder interaction.');
        }
        await loadData();
    };

    const handleDeleteStakeholder = async (stakeholder: StakeholderRecord) => {
        const interactionLabel = stakeholder.interactionCount > 0
            ? ` This will also remove ${stakeholder.interactionCount} logged interaction${stakeholder.interactionCount === 1 ? '' : 's'}.`
            : '';
        const confirmed = window.confirm(
            `Delete stakeholder "${stakeholder.name}"?${interactionLabel}`
        );

        if (!confirmed) return;

        setDeletingStakeholderId(stakeholder.id);
        try {
            const response = await fetch(`/api/stakeholders/${stakeholder.id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to delete stakeholder.');
            }

            if (activeStakeholder?.id === stakeholder.id) {
                setStakeholderSheetOpen(false);
                setActiveStakeholder(null);
            }
            if (activeInteraction?.stakeholderId === stakeholder.id) {
                setInteractionSheetOpen(false);
                setActiveInteraction(null);
            }
            if (defaultStakeholderId === stakeholder.id) {
                setDefaultStakeholderId(null);
            }
            await loadData();
        } finally {
            setDeletingStakeholderId(null);
        }
    };

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 16 }}>
                    <div>
                        <h1 className="page-title">🤝 Stakeholders</h1>
                        <p className="page-subtitle">Keep the PM’s contact memory: who matters, recent conversations, and where relationships tie into product work.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary" onClick={() => { setActiveInteraction(null); setDefaultStakeholderId(null); setInteractionSheetOpen(true); }}>
                            Log Interaction
                        </button>
                        <button className="btn btn-primary" onClick={() => { setActiveStakeholder(null); setStakeholderSheetOpen(true); }}>
                            New Stakeholder
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="dashboard-grid grid-4">
                    <StatCard label="Stakeholders" value={stats.total} color="#6366f1" icon={<Users size={16} />} />
                    <StatCard label="External" value={stats.external} color="#10b981" icon={<Handshake size={16} />} />
                    <StatCard label="Organizations" value={stats.orgs} color="#06b6d4" icon={<Building2 size={16} />} />
                    <StatCard label="Interactions" value={stats.interactions} color="#f59e0b" icon={<MessagesSquare size={16} />} />
                </div>

                <div className="card" style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr 1fr' }}>
                    <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, role, organization, or notes" />
                    <select className="input" value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as StakeholderRelationshipType | 'all')}>
                        {RELATIONSHIP_FILTERS.map((filter) => (
                            <option key={filter} value={filter}>
                                {filter === 'all' ? 'All relationship types' : filter.replace(/_/g, ' ')}
                            </option>
                        ))}
                    </select>
                    <input className="input" value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Filter by organization" />
                </div>

                {loading ? (
                    <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>
                ) : error ? (
                    <div className="card"><EmptyState message={error} icon="⚠️" /></div>
                ) : (
                    <div className="dashboard-grid grid-2">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {stakeholders.length === 0 ? (
                                <div className="card"><EmptyState message="No stakeholders match the current filters." icon="🤝" /></div>
                            ) : stakeholders.map((stakeholder) => (
                                <StakeholderCard
                                    key={stakeholder.id}
                                    stakeholder={stakeholder}
                                    initiativesById={initiativesById}
                                    deleting={deletingStakeholderId === stakeholder.id}
                                    onEdit={(item) => {
                                        setActiveStakeholder(item);
                                        setStakeholderSheetOpen(true);
                                    }}
                                    onLogInteraction={(item) => {
                                        setActiveInteraction(null);
                                        setDefaultStakeholderId(item.id);
                                        setInteractionSheetOpen(true);
                                    }}
                                    onDelete={(item) => {
                                        void handleDeleteStakeholder(item);
                                    }}
                                />
                            ))}
                        </div>

                        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                <h2 style={{ fontSize: 15 }}>Recent Interactions</h2>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{interactions.length} total</span>
                            </div>

                            {interactions.length === 0 ? (
                                <EmptyState message="No interactions logged yet." icon="📝" />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {interactions.slice(0, 12).map((interaction) => (
                                        <button
                                            key={interaction.id}
                                            type="button"
                                            className="btn btn-ghost"
                                            onClick={() => {
                                                setActiveInteraction(interaction);
                                                setInteractionSheetOpen(true);
                                            }}
                                            style={{ justifyContent: 'space-between', alignItems: 'flex-start', border: '1px solid var(--border)', padding: 14 }}
                                        >
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontSize: 13, fontWeight: 600 }}>{interaction.title}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                                    {interaction.stakeholderName || 'Unknown stakeholder'} · {interaction.interactionDate}
                                                </div>
                                                {interaction.initiativeTitle && (
                                                    <div style={{ fontSize: 11, color: 'var(--accent-light)', marginTop: 4 }}>
                                                        {interaction.initiativeTitle}
                                                    </div>
                                                )}
                                                {interaction.notes && (
                                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                                                        {interaction.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <StakeholderFormSheet
                open={stakeholderSheetOpen}
                stakeholder={activeStakeholder}
                initiatives={initiatives}
                onClose={() => setStakeholderSheetOpen(false)}
                onSave={handleSaveStakeholder}
            />

            <StakeholderInteractionFormSheet
                open={interactionSheetOpen}
                interaction={activeInteraction}
                stakeholders={stakeholders}
                initiatives={initiatives}
                defaultStakeholderId={defaultStakeholderId}
                onClose={() => setInteractionSheetOpen(false)}
                onSave={handleSaveInteraction}
            />
        </div>
    );
}
