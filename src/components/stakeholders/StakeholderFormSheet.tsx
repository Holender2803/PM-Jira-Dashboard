'use client';

import { useEffect, useState } from 'react';
import PmWritingPrompts from '@/components/shared/PmWritingPrompts';
import { stakeholderNotesPrompts } from '@/lib/pm-writing';
import { InitiativeRecord, StakeholderInput, StakeholderRecord, StakeholderRelationshipType } from '@/types/pm-os';

interface StakeholderFormSheetProps {
    open: boolean;
    stakeholder?: StakeholderRecord | null;
    initiatives: InitiativeRecord[];
    onClose: () => void;
    onSave: (input: StakeholderInput, id?: string) => Promise<void>;
}

const RELATIONSHIP_TYPES: StakeholderRelationshipType[] = ['sales', 'client', 'engineering', 'design', 'support', 'executive', 'partner', 'compliance', 'operations'];

const EMPTY_FORM: StakeholderInput = {
    name: '',
    role: null,
    organization: null,
    relationshipType: 'engineering',
    linkedInitiativeIds: [],
    notes: null,
};

export default function StakeholderFormSheet({
    open,
    stakeholder,
    initiatives,
    onClose,
    onSave,
}: StakeholderFormSheetProps) {
    const [form, setForm] = useState<StakeholderInput>(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (stakeholder) {
            setForm({
                name: stakeholder.name,
                role: stakeholder.role,
                organization: stakeholder.organization,
                relationshipType: stakeholder.relationshipType,
                linkedInitiativeIds: stakeholder.linkedInitiativeIds,
                notes: stakeholder.notes,
            });
            setError(null);
            return;
        }

        setForm(EMPTY_FORM);
        setError(null);
    }, [open, stakeholder]);

    if (!open) return null;

    return (
        <div className="sheet-overlay" onClick={onClose}>
            <div className="sheet-panel" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-header">
                    <div>
                        <h2>{stakeholder ? 'Edit Stakeholder' : 'New Stakeholder'}</h2>
                        <p>Capture who matters, how they relate to Product, and which initiatives they influence.</p>
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
                            await onSave(form, stakeholder?.id);
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
                            <span className="sheet-label">Name</span>
                            <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Relationship Type</span>
                            <select className="input" value={form.relationshipType} onChange={(event) => setForm((current) => ({ ...current, relationshipType: event.target.value as StakeholderRelationshipType }))}>
                                {RELATIONSHIP_TYPES.map((relationshipType) => (
                                    <option key={relationshipType} value={relationshipType}>{relationshipType.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Role</span>
                            <input className="input" value={form.role || ''} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value || null }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Organization</span>
                            <input className="input" value={form.organization || ''} onChange={(event) => setForm((current) => ({ ...current, organization: event.target.value || null }))} />
                        </label>
                    </div>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Linked Initiatives</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {initiatives.map((initiative) => {
                                const checked = form.linkedInitiativeIds.includes(initiative.id);
                                return (
                                    <label key={initiative.id} className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => setForm((current) => ({
                                                ...current,
                                                linkedInitiativeIds: checked
                                                    ? current.linkedInitiativeIds.filter((id) => id !== initiative.id)
                                                    : [...current.linkedInitiativeIds, initiative.id],
                                            }))}
                                        />
                                        {initiative.title}
                                    </label>
                                );
                            })}
                        </div>
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Notes</span>
                        <textarea className="input" rows={5} value={form.notes || ''} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value || null }))} />
                    </label>
                    <PmWritingPrompts
                        value={form.notes}
                        onChange={(notes) => setForm((current) => ({ ...current, notes }))}
                        prompts={stakeholderNotesPrompts}
                        title="Stakeholder Note Starters"
                        description="Capture influence, concerns, and working style in consistent PM language."
                    />

                    {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

                    <div className="sheet-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? 'Saving…' : stakeholder ? 'Save Stakeholder' : 'Create Stakeholder'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
