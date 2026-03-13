'use client';

import { useEffect, useState } from 'react';
import PmWritingPrompts from '@/components/shared/PmWritingPrompts';
import { objectiveDescriptionPrompts } from '@/lib/pm-writing';
import { ObjectiveInput, ObjectiveRecord, ObjectiveStatus } from '@/types/pm-os';

interface ObjectiveFormSheetProps {
    open: boolean;
    objective?: ObjectiveRecord | null;
    onClose: () => void;
    onSave: (input: ObjectiveInput, id?: string) => Promise<void>;
}

const STATUSES: ObjectiveStatus[] = ['draft', 'active', 'at_risk', 'done', 'archived'];

const EMPTY_FORM: ObjectiveInput = {
    title: '',
    description: null,
    status: 'draft',
    ownerName: null,
    startDate: null,
    targetDate: null,
};

export default function ObjectiveFormSheet({
    open,
    objective,
    onClose,
    onSave,
}: ObjectiveFormSheetProps) {
    const [form, setForm] = useState<ObjectiveInput>(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (objective) {
            setForm({
                title: objective.title,
                description: objective.description,
                status: objective.status,
                ownerName: objective.ownerName,
                startDate: objective.startDate,
                targetDate: objective.targetDate,
            });
            setError(null);
            return;
        }
        setForm(EMPTY_FORM);
        setError(null);
    }, [objective, open]);

    if (!open) return null;

    return (
        <div className="sheet-overlay" onClick={onClose}>
            <div className="sheet-panel" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-header">
                    <div>
                        <h2>{objective ? 'Edit Objective' : 'New Objective'}</h2>
                        <p>Define the product objective that initiatives and outcomes should support.</p>
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
                            await onSave(form, objective?.id);
                            onClose();
                        } catch (saveError) {
                            setError(String(saveError));
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Title</span>
                        <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Description</span>
                        <textarea className="input" rows={4} value={form.description || ''} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value || null }))} />
                    </label>
                    <PmWritingPrompts
                        value={form.description}
                        onChange={(description) => setForm((current) => ({ ...current, description }))}
                        prompts={objectiveDescriptionPrompts}
                        title="Objective Description Starters"
                        description="Frame the objective around customer or business movement, not a feature list."
                    />

                    <div className="sheet-grid">
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Status</span>
                            <select className="input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ObjectiveStatus }))}>
                                {STATUSES.map((status) => (
                                    <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Owner</span>
                            <input className="input" value={form.ownerName || ''} onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value || null }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Start Date</span>
                            <input className="input" type="date" value={form.startDate || ''} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value || null }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Target Date</span>
                            <input className="input" type="date" value={form.targetDate || ''} onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value || null }))} />
                        </label>
                    </div>

                    {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

                    <div className="sheet-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? 'Saving…' : objective ? 'Save Objective' : 'Create Objective'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
