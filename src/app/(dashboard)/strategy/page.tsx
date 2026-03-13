'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, LoadingSpinner, StatCard } from '@/components/ui/Badges';
import KpiFormSheet from '@/components/strategy/KpiFormSheet';
import KpiMeasurementForm from '@/components/strategy/KpiMeasurementForm';
import ObjectiveFormSheet from '@/components/strategy/ObjectiveFormSheet';
import ObjectiveTreeCard from '@/components/strategy/ObjectiveTreeCard';
import OutcomeFormSheet from '@/components/strategy/OutcomeFormSheet';
import {
    KpiInput,
    KpiMeasurementInput,
    KpiRecord,
    ObjectiveInput,
    ObjectiveRecord,
    ObjectiveWithChildren,
    OutcomeInput,
    OutcomeRecord,
} from '@/types/pm-os';
import { ShieldAlert, Target, TrendingUp, BarChart3 } from 'lucide-react';

export default function StrategyPage() {
    const router = useRouter();
    const [tree, setTree] = useState<ObjectiveWithChildren[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [objectiveSheetOpen, setObjectiveSheetOpen] = useState(false);
    const [outcomeSheetOpen, setOutcomeSheetOpen] = useState(false);
    const [kpiSheetOpen, setKpiSheetOpen] = useState(false);
    const [measurementSheetOpen, setMeasurementSheetOpen] = useState(false);

    const [activeObjective, setActiveObjective] = useState<ObjectiveRecord | null>(null);
    const [activeOutcome, setActiveOutcome] = useState<OutcomeRecord | null>(null);
    const [activeKpi, setActiveKpi] = useState<KpiRecord | null>(null);

    const [defaultObjectiveId, setDefaultObjectiveId] = useState<string | null>(null);
    const [defaultOutcomeId, setDefaultOutcomeId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/objectives?includeChildren=true', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Failed to load strategy tree (${response.status})`);
            }
            setTree(await response.json() as ObjectiveWithChildren[]);
        } catch (loadError) {
            setError(String(loadError));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const objectives = useMemo(
        () => tree.map((objective) => ({
            id: objective.id,
            title: objective.title,
            description: objective.description,
            status: objective.status,
            ownerName: objective.ownerName,
            startDate: objective.startDate,
            targetDate: objective.targetDate,
            createdAt: objective.createdAt,
            updatedAt: objective.updatedAt,
        })),
        [tree]
    );

    const outcomes = useMemo(
        () => tree.flatMap((objective) => objective.outcomes.map((outcome) => ({
            id: outcome.id,
            objectiveId: outcome.objectiveId,
            objectiveTitle: outcome.objectiveTitle,
            title: outcome.title,
            description: outcome.description,
            baselineText: outcome.baselineText,
            targetText: outcome.targetText,
            status: outcome.status,
            createdAt: outcome.createdAt,
            updatedAt: outcome.updatedAt,
        }))),
        [tree]
    );

    const counts = useMemo(() => {
        const objectiveCount = tree.length;
        const outcomeCount = tree.reduce((sum, objective) => sum + objective.outcomes.length, 0);
        const kpiCount = tree.reduce(
            (sum, objective) => sum + objective.outcomes.reduce((inner, outcome) => inner + outcome.kpis.length, 0),
            0
        );
        const atRiskObjectives = tree.filter((objective) => objective.status === 'at_risk').length;
        return { objectiveCount, outcomeCount, kpiCount, atRiskObjectives };
    }, [tree]);

    const handleSaveObjective = async (input: ObjectiveInput, id?: string) => {
        const response = await fetch(id ? `/api/objectives/${id}` : '/api/objectives', {
            method: id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to save objective.');
        }
        await loadData();
    };

    const handleSaveOutcome = async (input: OutcomeInput, id?: string) => {
        const response = await fetch(id ? `/api/outcomes/${id}` : '/api/outcomes', {
            method: id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to save outcome.');
        }
        await loadData();
    };

    const handleSaveKpi = async (input: KpiInput, id?: string) => {
        const response = await fetch(id ? `/api/kpis/${id}` : '/api/kpis', {
            method: id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to save KPI.');
        }
        await loadData();
    };

    const handleSaveMeasurement = async (input: KpiMeasurementInput) => {
        const response = await fetch('/api/kpis/measurements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to log KPI measurement.');
        }
        await loadData();
    };

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 16 }}>
                    <div>
                        <h1 className="page-title">🎯 Strategy</h1>
                        <p className="page-subtitle">Connect objectives, measurable outcomes, KPIs, and initiatives in one operating view.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary" onClick={() => router.push('/risks')}>
                            Strategy Risks
                        </button>
                        <button className="btn btn-primary" onClick={() => { setActiveObjective(null); setObjectiveSheetOpen(true); }}>
                            New Objective
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="dashboard-grid grid-4">
                    <StatCard label="Objectives" value={counts.objectiveCount} color="#10b981" icon={<Target size={16} />} />
                    <StatCard label="Outcomes" value={counts.outcomeCount} color="#06b6d4" icon={<TrendingUp size={16} />} />
                    <StatCard label="KPIs" value={counts.kpiCount} color="#6366f1" icon={<BarChart3 size={16} />} />
                    <StatCard label="At Risk" value={counts.atRiskObjectives} color="#ef4444" icon={<ShieldAlert size={16} />} />
                </div>

                {loading ? (
                    <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <div className="card">
                        <EmptyState message={error} icon="⚠️" />
                    </div>
                ) : tree.length === 0 ? (
                    <div className="card">
                        <EmptyState message="No objectives yet. Create the first objective to start mapping strategy." icon="🎯" />
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {tree.map((objective) => (
                            <ObjectiveTreeCard
                                key={objective.id}
                                objective={objective}
                                onEditObjective={(id) => {
                                    const found = objectives.find((item) => item.id === id) || null;
                                    setActiveObjective(found);
                                    setObjectiveSheetOpen(true);
                                }}
                                onAddOutcome={(objectiveId) => {
                                    setActiveOutcome(null);
                                    setDefaultObjectiveId(objectiveId);
                                    setOutcomeSheetOpen(true);
                                }}
                                onEditOutcome={(outcome) => {
                                    setActiveOutcome(outcome);
                                    setDefaultObjectiveId(outcome.objectiveId);
                                    setOutcomeSheetOpen(true);
                                }}
                                onAddKpi={(outcomeId) => {
                                    setActiveKpi(null);
                                    setDefaultOutcomeId(outcomeId);
                                    setKpiSheetOpen(true);
                                }}
                                onEditKpi={(kpi) => {
                                    setActiveKpi(kpi);
                                    setDefaultOutcomeId(kpi.outcomeId);
                                    setKpiSheetOpen(true);
                                }}
                                onAddMeasurement={(kpi) => {
                                    setActiveKpi(kpi);
                                    setMeasurementSheetOpen(true);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            <ObjectiveFormSheet
                open={objectiveSheetOpen}
                objective={activeObjective}
                onClose={() => setObjectiveSheetOpen(false)}
                onSave={handleSaveObjective}
            />

            <OutcomeFormSheet
                open={outcomeSheetOpen}
                outcome={activeOutcome}
                objectives={objectives}
                defaultObjectiveId={defaultObjectiveId}
                onClose={() => setOutcomeSheetOpen(false)}
                onSave={handleSaveOutcome}
            />

            <KpiFormSheet
                open={kpiSheetOpen}
                kpi={activeKpi}
                outcomes={outcomes}
                defaultOutcomeId={defaultOutcomeId}
                onClose={() => setKpiSheetOpen(false)}
                onSave={handleSaveKpi}
            />

            <KpiMeasurementForm
                open={measurementSheetOpen}
                kpi={activeKpi}
                onClose={() => setMeasurementSheetOpen(false)}
                onSave={handleSaveMeasurement}
            />
        </div>
    );
}
