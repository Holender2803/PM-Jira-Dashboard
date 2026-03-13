'use client';

import { useEffect, useState } from 'react';
import PmWritingPrompts from '@/components/shared/PmWritingPrompts';
import { outcomeDescriptionPrompts } from '@/lib/pm-writing';
import {
    ObjectiveRecord,
    OutcomeInput,
    OutcomeRecord,
    OutcomeStatus,
} from '@/types/pm-os';

interface OutcomeFormSheetProps {
    open: boolean;
    outcome?: OutcomeRecord | null;
    objectives: ObjectiveRecord[];
    defaultObjectiveId?: string | null;
    onClose: () => void;
    onSave: (input: OutcomeInput, id?: string) => Promise<void>;
}

const STATUSES: OutcomeStatus[] = ['draft', 'active', 'at_risk', 'done', 'archived'];

const EMPTY_FORM: OutcomeInput = {
    objectiveId: '',
    title: '',
    description: null,
    baselineText: null,
    targetText: null,
    status: 'draft',
};

export default function OutcomeFormSheet({
    open,
    outcome,
    objectives,
    defaultObjectiveId,
    onClose,
    onSave,
}: OutcomeFormSheetProps) {
    const [form, setForm] = useState<OutcomeInput>(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (outcome) {
            setForm({
                objectiveId: outcome.objectiveId,
                title: outcome.title,
                description: outcome.description,
                baselineText: outcome.baselineText,
                targetText: outcome.targetText,
                status: outcome.status,
            });
            setError(null);
            return;
        }

        setForm({
            ...EMPTY_FORM,
            objectiveId: defaultObjectiveId || '',
        });
        setError(null);
    }, [defaultObjectiveId, open, outcome]);

    if (!open) return null;

    return (
        <div className="sheet-overlay" onClick={onClose}>
            <div className="sheet-panel" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-header">
                    <div>
                        <h2>{outcome ? 'Edit Outcome' : 'New Outcome'}</h2>
                        <p>Make the objective measurable by defining the business or product outcome.</p>
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
                            await onSave(form, outcome?.id);
                            onClose();
                        } catch (saveError) {
                            setError(String(saveError));
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Objective</span>
                        <select className="input" value={form.objectiveId} onChange={(event) => setForm((current) => ({ ...current, objectiveId: event.target.value }))}>
                            <option value="">Select objective</option>
                            {objectives.map((objective) => (
                                <option key={objective.id} value={objective.id}>{objective.title}</option>
                            ))}
                        </select>
                    </label>

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
                        prompts={outcomeDescriptionPrompts}
                        title="Outcome Description Starters"
                        description="Describe the movement from current state to target state in concrete PM language."
                    />

                    <div className="sheet-grid">
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Baseline</span>
                            <input className="input" value={form.baselineText || ''} onChange={(event) => setForm((current) => ({ ...current, baselineText: event.target.value || null }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Target</span>
                            <input className="input" value={form.targetText || ''} onChange={(event) => setForm((current) => ({ ...current, targetText: event.target.value || null }))} />
                        </label>
                    </div>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Status</span>
                        <select className="input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as OutcomeStatus }))}>
                            {STATUSES.map((status) => (
                                <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                    </label>

                    {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

                    <div className="sheet-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? 'Saving…' : outcome ? 'Save Outcome' : 'Create Outcome'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
