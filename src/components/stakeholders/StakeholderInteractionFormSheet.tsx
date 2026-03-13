'use client';

import { useEffect, useState } from 'react';
import InitiativeSelect from '@/components/shared/InitiativeSelect';
import JiraIssueMultiSelect from '@/components/shared/JiraIssueMultiSelect';
import PmWritingPrompts from '@/components/shared/PmWritingPrompts';
import StakeholderSelect from '@/components/shared/StakeholderSelect';
import { interactionNotesPrompts } from '@/lib/pm-writing';
import {
    InitiativeRecord,
    StakeholderInteractionInput,
    StakeholderInteractionRecord,
    StakeholderRecord,
} from '@/types/pm-os';

interface StakeholderInteractionFormSheetProps {
    open: boolean;
    interaction?: StakeholderInteractionRecord | null;
    stakeholders: StakeholderRecord[];
    initiatives: InitiativeRecord[];
    defaultStakeholderId?: string | null;
    onClose: () => void;
    onSave: (input: StakeholderInteractionInput, id?: string) => Promise<void>;
}

const EMPTY_FORM: StakeholderInteractionInput = {
    stakeholderId: '',
    interactionDate: new Date().toISOString().slice(0, 10),
    title: '',
    notes: null,
    initiativeId: null,
    linkedIssueKeys: [],
};

export default function StakeholderInteractionFormSheet({
    open,
    interaction,
    stakeholders,
    initiatives,
    defaultStakeholderId,
    onClose,
    onSave,
}: StakeholderInteractionFormSheetProps) {
    const [form, setForm] = useState<StakeholderInteractionInput>(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (interaction) {
            setForm({
                stakeholderId: interaction.stakeholderId,
                interactionDate: interaction.interactionDate,
                title: interaction.title,
                notes: interaction.notes,
                initiativeId: interaction.initiativeId,
                linkedIssueKeys: interaction.linkedIssueKeys,
            });
            setError(null);
            return;
        }

        setForm({
            ...EMPTY_FORM,
            stakeholderId: defaultStakeholderId || '',
        });
        setError(null);
    }, [defaultStakeholderId, interaction, open]);

    if (!open) return null;

    return (
        <div className="sheet-overlay" onClick={onClose}>
            <div className="sheet-panel" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-header">
                    <div>
                        <h2>{interaction ? 'Edit Interaction' : 'Log Interaction'}</h2>
                        <p>Keep a short record of conversations, follow-ups, and context that matter later.</p>
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
                            await onSave(form, interaction?.id);
                            onClose();
                        } catch (saveError) {
                            setError(String(saveError));
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <div className="sheet-grid">
                        <StakeholderSelect
                            stakeholders={stakeholders}
                            value={form.stakeholderId || null}
                            onChange={(stakeholderId) => setForm((current) => ({ ...current, stakeholderId: stakeholderId || '' }))}
                            label="Stakeholder"
                            allowEmpty={false}
                        />
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Interaction Date</span>
                            <input className="input" type="date" value={form.interactionDate} onChange={(event) => setForm((current) => ({ ...current, interactionDate: event.target.value }))} />
                        </label>
                    </div>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Title</span>
                        <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
                    </label>

                    <InitiativeSelect
                        initiatives={initiatives}
                        value={form.initiativeId}
                        onChange={(initiativeId) => setForm((current) => ({ ...current, initiativeId }))}
                        label="Linked Initiative"
                    />

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Notes</span>
                        <textarea className="input" rows={5} value={form.notes || ''} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value || null }))} />
                    </label>
                    <PmWritingPrompts
                        value={form.notes}
                        onChange={(notes) => setForm((current) => ({ ...current, notes }))}
                        prompts={interactionNotesPrompts}
                        title="Interaction Note Starters"
                        description="Use these to log key points, commitments, and follow-ups right after the conversation."
                    />

                    <JiraIssueMultiSelect value={form.linkedIssueKeys} onChange={(linkedIssueKeys) => setForm((current) => ({ ...current, linkedIssueKeys }))} />

                    {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

                    <div className="sheet-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? 'Saving…' : interaction ? 'Save Interaction' : 'Create Interaction'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
