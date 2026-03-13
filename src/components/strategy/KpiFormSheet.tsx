'use client';

import { useEffect, useState } from 'react';
import PmWritingPrompts from '@/components/shared/PmWritingPrompts';
import { kpiSourceNotesPrompts } from '@/lib/pm-writing';
import {
    KpiInput,
    KpiMetricType,
    KpiRecord,
    KpiSourceType,
    MeasurementFrequency,
    OutcomeRecord,
} from '@/types/pm-os';

interface KpiFormSheetProps {
    open: boolean;
    kpi?: KpiRecord | null;
    outcomes: OutcomeRecord[];
    defaultOutcomeId?: string | null;
    onClose: () => void;
    onSave: (input: KpiInput, id?: string) => Promise<void>;
}

const METRIC_TYPES: KpiMetricType[] = ['numeric', 'percentage', 'currency', 'duration_days', 'count'];
const FREQUENCIES: MeasurementFrequency[] = ['weekly', 'monthly', 'quarterly', 'manual'];
const SOURCE_TYPES: KpiSourceType[] = ['manual', 'jira', 'derived', 'other'];

const EMPTY_FORM: KpiInput = {
    outcomeId: '',
    name: '',
    metricType: 'numeric',
    unit: null,
    baselineValue: null,
    currentValue: null,
    targetValue: null,
    measurementFrequency: 'monthly',
    sourceType: 'manual',
    sourceNotes: null,
};

function parseNullableNumber(value: string): number | null {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export default function KpiFormSheet({
    open,
    kpi,
    outcomes,
    defaultOutcomeId,
    onClose,
    onSave,
}: KpiFormSheetProps) {
    const [form, setForm] = useState<KpiInput>(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (kpi) {
            setForm({
                outcomeId: kpi.outcomeId,
                name: kpi.name,
                metricType: kpi.metricType,
                unit: kpi.unit,
                baselineValue: kpi.baselineValue,
                currentValue: kpi.currentValue,
                targetValue: kpi.targetValue,
                measurementFrequency: kpi.measurementFrequency,
                sourceType: kpi.sourceType,
                sourceNotes: kpi.sourceNotes,
            });
            setError(null);
            return;
        }

        setForm({
            ...EMPTY_FORM,
            outcomeId: defaultOutcomeId || '',
        });
        setError(null);
    }, [defaultOutcomeId, kpi, open]);

    if (!open) return null;

    return (
        <div className="sheet-overlay" onClick={onClose}>
            <div className="sheet-panel" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-header">
                    <div>
                        <h2>{kpi ? 'Edit KPI' : 'New KPI'}</h2>
                        <p>Attach a measurable KPI to the outcome and keep the expected movement explicit.</p>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
                </div>

                <form
                    className="sheet-body"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        setBusy(true);
                        setError(null);
                        try {
                            await onSave(form, kpi?.id);
                            onClose();
                        } catch (saveError) {
                            setError(String(saveError));
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Outcome</span>
                        <select className="input" value={form.outcomeId} onChange={(event) => setForm((current) => ({ ...current, outcomeId: event.target.value }))}>
                            <option value="">Select outcome</option>
                            {outcomes.map((outcome) => (
                                <option key={outcome.id} value={outcome.id}>{outcome.title}</option>
                            ))}
                        </select>
                    </label>

                    <div className="sheet-grid">
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Name</span>
                            <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Metric Type</span>
                            <select className="input" value={form.metricType} onChange={(event) => setForm((current) => ({ ...current, metricType: event.target.value as KpiMetricType }))}>
                                {METRIC_TYPES.map((metricType) => (
                                    <option key={metricType} value={metricType}>{metricType.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Unit</span>
                            <input className="input" value={form.unit || ''} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value || null }))} placeholder="days, %, $, count" />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Frequency</span>
                            <select className="input" value={form.measurementFrequency} onChange={(event) => setForm((current) => ({ ...current, measurementFrequency: event.target.value as MeasurementFrequency }))}>
                                {FREQUENCIES.map((frequency) => (
                                    <option key={frequency} value={frequency}>{frequency}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="sheet-grid">
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Baseline Value</span>
                            <input className="input" value={form.baselineValue ?? ''} onChange={(event) => setForm((current) => ({ ...current, baselineValue: parseNullableNumber(event.target.value) }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Current Value</span>
                            <input className="input" value={form.currentValue ?? ''} onChange={(event) => setForm((current) => ({ ...current, currentValue: parseNullableNumber(event.target.value) }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Target Value</span>
                            <input className="input" value={form.targetValue ?? ''} onChange={(event) => setForm((current) => ({ ...current, targetValue: parseNullableNumber(event.target.value) }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Source Type</span>
                            <select className="input" value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value as KpiSourceType }))}>
                                {SOURCE_TYPES.map((sourceType) => (
                                    <option key={sourceType} value={sourceType}>{sourceType}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Source Notes</span>
                        <textarea className="input" rows={3} value={form.sourceNotes || ''} onChange={(event) => setForm((current) => ({ ...current, sourceNotes: event.target.value || null }))} />
                    </label>
                    <PmWritingPrompts
                        value={form.sourceNotes}
                        onChange={(sourceNotes) => setForm((current) => ({ ...current, sourceNotes }))}
                        prompts={kpiSourceNotesPrompts}
                        title="KPI Source Note Starters"
                        description="Document how this KPI is measured and where the data is imperfect."
                    />

                    {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

                    <div className="sheet-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? 'Saving…' : kpi ? 'Save KPI' : 'Create KPI'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
