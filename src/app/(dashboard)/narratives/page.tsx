'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import FilterBar from '@/components/filters/FilterBar';
import { EmptyState, LoadingSpinner } from '@/components/ui/Badges';
import { useAppStore, useFilteredIssues } from '@/store/app-store';
import {
    DecisionRecord,
    InitiativeRecord,
    NarrativeAudience,
    NarrativeRecord,
    NarrativeReportType,
    ObjectiveRecord,
} from '@/types/pm-os';

const REPORT_TYPES: { value: NarrativeReportType; label: string }[] = [
    { value: 'stakeholder_brief', label: 'Stakeholder Brief' },
    { value: 'roadmap_narrative', label: 'Roadmap Narrative' },
    { value: 'objective_review', label: 'Objective Review' },
    { value: 'decision_brief', label: 'Decision Brief' },
    { value: 'risk_digest', label: 'Risk Digest' },
    { value: 'daily_pm_plan', label: 'Daily PM Plan' },
];

const AUDIENCES: { value: NarrativeAudience; label: string }[] = [
    { value: 'pm_internal', label: 'PM Internal' },
    { value: 'stakeholder', label: 'Stakeholder' },
    { value: 'executive', label: 'Executive' },
    { value: 'junior_pm', label: 'Junior PM / Mentor Mode' },
];

function toggleValue(values: string[], next: string): string[] {
    return values.includes(next)
        ? values.filter((value) => value !== next)
        : [...values, next];
}

export default function NarrativesPage() {
    const { selectedKeys } = useAppStore();
    const filteredIssues = useFilteredIssues();

    const [history, setHistory] = useState<NarrativeRecord[]>([]);
    const [initiatives, setInitiatives] = useState<InitiativeRecord[]>([]);
    const [objectives, setObjectives] = useState<ObjectiveRecord[]>([]);
    const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
    const [activeReport, setActiveReport] = useState<NarrativeRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [type, setType] = useState<NarrativeReportType>('stakeholder_brief');
    const [audience, setAudience] = useState<NarrativeAudience>('pm_internal');
    const [customInstructions, setCustomInstructions] = useState('');
    const [includeRisks, setIncludeRisks] = useState(true);
    const [includeTasks, setIncludeTasks] = useState(true);
    const [selectedInitiativeIds, setSelectedInitiativeIds] = useState<string[]>([]);
    const [selectedObjectiveIds, setSelectedObjectiveIds] = useState<string[]>([]);
    const [selectedDecisionIds, setSelectedDecisionIds] = useState<string[]>([]);

    const sourceIssueKeys = useMemo(() => {
        if (selectedKeys.size > 0) {
            return Array.from(selectedKeys);
        }
        return filteredIssues.slice(0, 20).map((issue) => issue.key);
    }, [filteredIssues, selectedKeys]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [historyResponse, initiativeResponse, objectiveResponse, decisionResponse] = await Promise.all([
                fetch('/api/narratives', { cache: 'no-store' }),
                fetch('/api/initiatives', { cache: 'no-store' }),
                fetch('/api/objectives', { cache: 'no-store' }),
                fetch('/api/decisions', { cache: 'no-store' }),
            ]);

            if (!historyResponse.ok || !initiativeResponse.ok || !objectiveResponse.ok || !decisionResponse.ok) {
                throw new Error('Failed to load narrative builder data.');
            }

            const historyData = await historyResponse.json() as NarrativeRecord[];
            setHistory(historyData);
            setInitiatives(await initiativeResponse.json() as InitiativeRecord[]);
            setObjectives(await objectiveResponse.json() as ObjectiveRecord[]);
            setDecisions(await decisionResponse.json() as DecisionRecord[]);
            setActiveReport((current) => current || historyData[0] || null);
        } catch (loadError) {
            setError(String(loadError));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const generateNarrative = async () => {
        setGenerating(true);
        setError(null);
        try {
            const response = await fetch('/api/narratives', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    audience,
                    issueKeys: sourceIssueKeys,
                    initiativeIds: selectedInitiativeIds,
                    objectiveIds: selectedObjectiveIds,
                    decisionIds: selectedDecisionIds,
                    includeRisks,
                    includeTasks,
                    customInstructions: customInstructions.trim() || null,
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to generate narrative.');
            }

            const report = data as NarrativeRecord;
            setHistory((current) => [report, ...current]);
            setActiveReport(report);
        } catch (generateError) {
            setError(String(generateError));
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">🧾 Narratives</h1>
                    <p className="page-subtitle">Turn delivery data, strategy, risks, and decisions into stakeholder-ready product stories.</p>
                </div>
            </div>

            <FilterBar />

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {loading ? (
                    <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                        <LoadingSpinner />
                    </div>
                ) : (
                    <>
                        <div className="dashboard-grid grid-2">
                            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <h2 style={{ fontSize: 15 }}>Narrative Builder</h2>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                        Using {sourceIssueKeys.length} Jira issue source{sourceIssueKeys.length === 1 ? '' : 's'} from your current selection/filter context.
                                    </div>
                                </div>

                                <div className="sheet-grid">
                                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <span className="sheet-label">Narrative Type</span>
                                        <select className="input" value={type} onChange={(event) => setType(event.target.value as NarrativeReportType)}>
                                            {REPORT_TYPES.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <span className="sheet-label">Audience</span>
                                        <select className="input" value={audience} onChange={(event) => setAudience(event.target.value as NarrativeAudience)}>
                                            {AUDIENCES.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className="sheet-grid">
                                    <label className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={includeRisks} onChange={() => setIncludeRisks((current) => !current)} />
                                        Include risk radar
                                    </label>
                                    <label className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={includeTasks} onChange={() => setIncludeTasks((current) => !current)} />
                                        Include PM tasks
                                    </label>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <div className="sheet-label" style={{ marginBottom: 8 }}>Initiatives</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {initiatives.slice(0, 10).map((initiative) => {
                                                const checked = selectedInitiativeIds.includes(initiative.id);
                                                return (
                                                    <button
                                                        key={initiative.id}
                                                        type="button"
                                                        className={checked ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                                                        onClick={() => setSelectedInitiativeIds((current) => toggleValue(current, initiative.id))}
                                                    >
                                                        {initiative.title}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="sheet-label" style={{ marginBottom: 8 }}>Objectives</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {objectives.slice(0, 10).map((objective) => {
                                                const checked = selectedObjectiveIds.includes(objective.id);
                                                return (
                                                    <button
                                                        key={objective.id}
                                                        type="button"
                                                        className={checked ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                                                        onClick={() => setSelectedObjectiveIds((current) => toggleValue(current, objective.id))}
                                                    >
                                                        {objective.title}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="sheet-label" style={{ marginBottom: 8 }}>Decisions</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {decisions.slice(0, 10).map((decision) => {
                                                const checked = selectedDecisionIds.includes(decision.id);
                                                return (
                                                    <button
                                                        key={decision.id}
                                                        type="button"
                                                        className={checked ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                                                        onClick={() => setSelectedDecisionIds((current) => toggleValue(current, decision.id))}
                                                    >
                                                        {decision.title}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <span className="sheet-label">Custom Instructions</span>
                                    <textarea
                                        className="input"
                                        rows={4}
                                        value={customInstructions}
                                        onChange={(event) => setCustomInstructions(event.target.value)}
                                        placeholder="Example: Emphasize customer impact and call out where strategic confidence is weak."
                                    />
                                </label>

                                {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-primary" onClick={() => void generateNarrative()} disabled={generating}>
                                        {generating ? 'Generating…' : 'Generate Narrative'}
                                    </button>
                                </div>
                            </div>

                            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div>
                                    <h2 style={{ fontSize: 15 }}>Current Narrative</h2>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                        {activeReport ? `${activeReport.title} · ${new Date(activeReport.generatedAt).toLocaleString()}` : 'Generate a narrative to start.'}
                                    </div>
                                </div>

                                {!activeReport ? (
                                    <EmptyState message="No narrative selected yet." icon="🧾" />
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.28)' }}>
                                                {activeReport.type.replace(/_/g, ' ')}
                                            </span>
                                            <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.28)' }}>
                                                {activeReport.audience.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                            {activeReport.summary}
                                        </div>
                                        <textarea className="input" readOnly rows={18} value={activeReport.content} />
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                <h2 style={{ fontSize: 15 }}>Narrative History</h2>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {history.length} stored narrative{history.length === 1 ? '' : 's'}
                                </div>
                            </div>
                            {history.length === 0 ? (
                                <EmptyState message="No narrative history yet." icon="📚" />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {history.map((report) => (
                                        <button
                                            key={report.id}
                                            type="button"
                                            className="btn btn-ghost"
                                            onClick={() => setActiveReport(report)}
                                            style={{ justifyContent: 'space-between', border: '1px solid var(--border)', padding: 14 }}
                                        >
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontSize: 13, fontWeight: 600 }}>{report.title}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{report.summary}</div>
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {new Date(report.generatedAt).toLocaleDateString()}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
