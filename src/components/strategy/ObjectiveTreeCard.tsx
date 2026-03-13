'use client';

import InitiativeHealthBadge from '@/components/initiatives/InitiativeHealthBadge';
import { KpiRecord, ObjectiveWithChildren, OutcomeRecord } from '@/types/pm-os';

interface ObjectiveTreeCardProps {
    objective: ObjectiveWithChildren;
    onEditObjective: (id: string) => void;
    onAddOutcome: (objectiveId: string) => void;
    onEditOutcome: (outcome: OutcomeRecord) => void;
    onAddKpi: (outcomeId: string) => void;
    onEditKpi: (kpi: KpiRecord) => void;
    onAddMeasurement: (kpi: KpiRecord) => void;
}

function formatNumber(value: number | null): string {
    if (value === null || value === undefined) return '—';
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export default function ObjectiveTreeCard({
    objective,
    onEditObjective,
    onAddOutcome,
    onEditOutcome,
    onAddKpi,
    onEditKpi,
    onAddMeasurement,
}: ObjectiveTreeCardProps) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: 18 }}>{objective.title}</h2>
                        <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
                            {objective.status.replace(/_/g, ' ')}
                        </span>
                        {objective.ownerName && (
                            <span className="badge" style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--text-secondary)', border: '1px solid rgba(148,163,184,0.24)' }}>
                                {objective.ownerName}
                            </span>
                        )}
                    </div>
                    {objective.description && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {objective.description}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {objective.startDate && <span className="badge" style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.3)' }}>Started {objective.startDate}</span>}
                        {objective.targetDate && <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.28)' }}>Target {objective.targetDate}</span>}
                        <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.28)' }}>
                            {objective.outcomes.length} outcomes
                        </span>
                        <span className="badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.28)' }}>
                            {objective.linkedInitiatives.length} linked initiatives
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => onEditObjective(objective.id)}>Edit</button>
                    <button className="btn btn-primary btn-sm" onClick={() => onAddOutcome(objective.id)}>Add Outcome</button>
                </div>
            </div>

            {objective.linkedInitiatives.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {objective.linkedInitiatives.slice(0, 6).map((initiative) => (
                        <div key={initiative.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600 }}>{initiative.title}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{initiative.status.replace(/_/g, ' ')}</div>
                            </div>
                            <InitiativeHealthBadge health={initiative.health} />
                        </div>
                    ))}
                </div>
            )}

            {objective.outcomes.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    No outcomes yet. Add at least one measurable outcome before linking KPIs.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {objective.outcomes.map((outcome) => (
                        <div key={outcome.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                <div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <h3 style={{ fontSize: 15 }}>{outcome.title}</h3>
                                        <span className="badge" style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.28)' }}>
                                            {outcome.status.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    {outcome.description && (
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 6 }}>
                                            {outcome.description}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                                        {outcome.baselineText && <span className="badge" style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--text-secondary)', border: '1px solid rgba(148,163,184,0.24)' }}>Baseline: {outcome.baselineText}</span>}
                                        {outcome.targetText && <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.28)' }}>Target: {outcome.targetText}</span>}
                                        <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.28)' }}>
                                            {outcome.linkedInitiatives.length} initiatives
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => onEditOutcome(outcome)}>Edit</button>
                                    <button className="btn btn-primary btn-sm" onClick={() => onAddKpi(outcome.id)}>Add KPI</button>
                                </div>
                            </div>

                            {outcome.linkedInitiatives.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {outcome.linkedInitiatives.map((initiative) => (
                                        <span key={initiative.id} className="badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.28)' }}>
                                            {initiative.title}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {outcome.kpis.length === 0 ? (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    No KPIs yet for this outcome.
                                </div>
                            ) : (
                                <div className="dashboard-grid grid-3">
                                    {outcome.kpis.map((kpi) => (
                                        <div key={kpi.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'rgba(10,10,20,0.4)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{kpi.name}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                                        {kpi.metricType.replace(/_/g, ' ')} · {kpi.measurementFrequency}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => onEditKpi(kpi)}>Edit</button>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => onAddMeasurement(kpi)}>Log</button>
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                                                <div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Baseline</div>
                                                    <div style={{ fontSize: 14 }}>{formatNumber(kpi.baselineValue)}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current</div>
                                                    <div style={{ fontSize: 14 }}>{formatNumber(kpi.currentValue)}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target</div>
                                                    <div style={{ fontSize: 14 }}>{formatNumber(kpi.targetValue)}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                                                <span>{kpi.sourceType}</span>
                                                <span>{kpi.lastMeasuredAt ? `Updated ${kpi.lastMeasuredAt}` : 'No measurements yet'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
