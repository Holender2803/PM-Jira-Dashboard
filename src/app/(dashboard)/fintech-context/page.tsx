'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import FintechContextCard from '@/components/fintech-context/FintechContextCard';
import FintechContextFormSheet from '@/components/fintech-context/FintechContextFormSheet';
import { EmptyState, LoadingSpinner, StatCard } from '@/components/ui/Badges';
import {
    FintechContextItemInput,
    FintechContextItemRecord,
    FintechContextType,
    InitiativeRecord,
    StakeholderRecord,
} from '@/types/pm-os';
import { Building2, Database, FileWarning, HandCoins } from 'lucide-react';

const CONTEXT_FILTERS: Array<FintechContextType | 'all'> = [
    'all',
    'data_source',
    'reporting_pipeline',
    'compliance_constraint',
    'reconciliation_point',
    'system_integration',
    'workflow_friction',
    'source_of_truth',
];

export default function FintechContextPage() {
    const [items, setItems] = useState<FintechContextItemRecord[]>([]);
    const [stakeholders, setStakeholders] = useState<StakeholderRecord[]>([]);
    const [initiatives, setInitiatives] = useState<InitiativeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [contextType, setContextType] = useState<FintechContextType | 'all'>('all');
    const [manualOnly, setManualOnly] = useState(false);
    const [reconciliationOnly, setReconciliationOnly] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [activeItem, setActiveItem] = useState<FintechContextItemRecord | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set('search', search.trim());
            if (contextType !== 'all') params.set('contextType', contextType);
            if (manualOnly) params.set('manualOnly', 'true');
            if (reconciliationOnly) params.set('reconciliationOnly', 'true');

            const [itemResponse, stakeholderResponse, initiativeResponse] = await Promise.all([
                fetch(`/api/fintech-context?${params.toString()}`, { cache: 'no-store' }),
                fetch('/api/stakeholders', { cache: 'no-store' }),
                fetch('/api/initiatives', { cache: 'no-store' }),
            ]);

            if (!itemResponse.ok || !stakeholderResponse.ok || !initiativeResponse.ok) {
                throw new Error('Failed to load fintech context workspace.');
            }

            setItems(await itemResponse.json() as FintechContextItemRecord[]);
            setStakeholders(await stakeholderResponse.json() as StakeholderRecord[]);
            setInitiatives(await initiativeResponse.json() as InitiativeRecord[]);
        } catch (loadError) {
            setError(String(loadError));
        } finally {
            setLoading(false);
        }
    }, [contextType, manualOnly, reconciliationOnly, search]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const stats = useMemo(() => ({
        total: items.length,
        manual: items.filter((item) => item.manualStepFlag).length,
        risk: items.filter((item) => item.reconciliationRiskFlag).length,
        missingSource: items.filter((item) => !item.sourceOfTruth).length,
    }), [items]);

    const handleSave = async (input: FintechContextItemInput, id?: string) => {
        const response = await fetch(id ? `/api/fintech-context/${id}` : '/api/fintech-context', {
            method: id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to save fintech context item.');
        }
        await loadData();
    };

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 16 }}>
                    <div>
                        <h1 className="page-title">🏦 Fintech Context</h1>
                        <p className="page-subtitle">Map sources of truth, reporting pipelines, manual steps, reconciliation risk, and compliance constraints.</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => { setActiveItem(null); setSheetOpen(true); }}>
                        New Context Item
                    </button>
                </div>
            </div>

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="dashboard-grid grid-4">
                    <StatCard label="Context Items" value={stats.total} color="#6366f1" icon={<Database size={16} />} />
                    <StatCard label="Manual Steps" value={stats.manual} color="#f59e0b" icon={<HandCoins size={16} />} />
                    <StatCard label="Reconciliation Risks" value={stats.risk} color="#ef4444" icon={<FileWarning size={16} />} />
                    <StatCard label="Missing Source of Truth" value={stats.missingSource} color="#06b6d4" icon={<Building2 size={16} />} />
                </div>

                <div className="card" style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr 1fr' }}>
                    <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search systems, context, source of truth, or compliance note" />
                    <select className="input" value={contextType} onChange={(event) => setContextType(event.target.value as FintechContextType | 'all')}>
                        {CONTEXT_FILTERS.map((filter) => (
                            <option key={filter} value={filter}>
                                {filter === 'all' ? 'All context types' : filter.replace(/_/g, ' ')}
                            </option>
                        ))}
                    </select>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                            <input type="checkbox" checked={manualOnly} onChange={() => setManualOnly((current) => !current)} />
                            Manual only
                        </label>
                        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                            <input type="checkbox" checked={reconciliationOnly} onChange={() => setReconciliationOnly((current) => !current)} />
                            Reconciliation only
                        </label>
                    </div>
                </div>

                {loading ? (
                    <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner /></div>
                ) : error ? (
                    <div className="card"><EmptyState message={error} icon="⚠️" /></div>
                ) : items.length === 0 ? (
                    <div className="card"><EmptyState message="No fintech context items match the current filters." icon="🏦" /></div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {items.map((item) => (
                            <FintechContextCard
                                key={item.id}
                                item={item}
                                onEdit={(next) => {
                                    setActiveItem(next);
                                    setSheetOpen(true);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            <FintechContextFormSheet
                open={sheetOpen}
                item={activeItem}
                stakeholders={stakeholders}
                initiatives={initiatives}
                onClose={() => setSheetOpen(false)}
                onSave={handleSave}
            />
        </div>
    );
}
