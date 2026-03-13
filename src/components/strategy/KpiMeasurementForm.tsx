'use client';

import { useEffect, useState } from 'react';
import PmWritingPrompts from '@/components/shared/PmWritingPrompts';
import { kpiMeasurementNotePrompts } from '@/lib/pm-writing';
import { KpiMeasurementInput, KpiRecord } from '@/types/pm-os';

interface KpiMeasurementFormProps {
    open: boolean;
    kpi?: KpiRecord | null;
    onClose: () => void;
    onSave: (input: KpiMeasurementInput) => Promise<void>;
}

const EMPTY_FORM: KpiMeasurementInput = {
    kpiId: '',
    measuredAt: new Date().toISOString().slice(0, 10),
    value: 0,
    note: null,
};

export default function KpiMeasurementForm({
    open,
    kpi,
    onClose,
    onSave,
}: KpiMeasurementFormProps) {
    const [form, setForm] = useState<KpiMeasurementInput>(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !kpi) return;
        setForm({
            kpiId: kpi.id,
            measuredAt: new Date().toISOString().slice(0, 10),
            value: kpi.currentValue ?? 0,
            note: null,
        });
        setError(null);
    }, [kpi, open]);

    if (!open || !kpi) return null;

    return (
        <div className="sheet-overlay" onClick={onClose}>
            <div className="sheet-panel" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-header">
                    <div>
                        <h2>Log KPI Measurement</h2>
                        <p>{kpi.name}</p>
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
                            await onSave(form);
                            onClose();
                        } catch (saveError) {
                            setError(String(saveError));
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <div className="sheet-grid">
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Measurement Date</span>
                            <input className="input" type="date" value={form.measuredAt} onChange={(event) => setForm((current) => ({ ...current, measuredAt: event.target.value }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Value</span>
                            <input className="input" type="number" step="0.01" value={form.value} onChange={(event) => setForm((current) => ({ ...current, value: Number(event.target.value) }))} />
                        </label>
                    </div>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Note</span>
                        <textarea className="input" rows={4} value={form.note || ''} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value || null }))} />
                    </label>
                    <PmWritingPrompts
                        value={form.note}
                        onChange={(note) => setForm((current) => ({ ...current, note }))}
                        prompts={kpiMeasurementNotePrompts}
                        title="Measurement Note Starters"
                        description="Explain why the KPI moved and how much confidence to place in this reading."
                    />

                    {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

                    <div className="sheet-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? 'Saving…' : 'Log Measurement'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
