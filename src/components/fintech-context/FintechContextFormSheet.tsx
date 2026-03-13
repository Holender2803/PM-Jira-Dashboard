'use client';

import { useEffect, useState } from 'react';
import InitiativeSelect from '@/components/shared/InitiativeSelect';
import PmWritingPrompts from '@/components/shared/PmWritingPrompts';
import StakeholderSelect from '@/components/shared/StakeholderSelect';
import { fintechCompliancePrompts, fintechDescriptionPrompts } from '@/lib/pm-writing';
import {
    FintechContextItemInput,
    FintechContextItemRecord,
    FintechContextType,
    InitiativeRecord,
    StakeholderRecord,
} from '@/types/pm-os';

interface FintechContextFormSheetProps {
    open: boolean;
    item?: FintechContextItemRecord | null;
    stakeholders: StakeholderRecord[];
    initiatives: InitiativeRecord[];
    onClose: () => void;
    onSave: (input: FintechContextItemInput, id?: string) => Promise<void>;
}

const CONTEXT_TYPES: FintechContextType[] = ['data_source', 'reporting_pipeline', 'compliance_constraint', 'reconciliation_point', 'system_integration', 'workflow_friction', 'source_of_truth'];

const EMPTY_FORM: FintechContextItemInput = {
    contextType: 'workflow_friction',
    name: '',
    description: null,
    systemName: null,
    sourceOfTruth: null,
    manualStepFlag: false,
    reconciliationRiskFlag: false,
    complianceNote: null,
    ownerStakeholderId: null,
    linkedInitiativeId: null,
};

export default function FintechContextFormSheet({
    open,
    item,
    stakeholders,
    initiatives,
    onClose,
    onSave,
}: FintechContextFormSheetProps) {
    const [form, setForm] = useState<FintechContextItemInput>(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (item) {
            setForm({
                contextType: item.contextType,
                name: item.name,
                description: item.description,
                systemName: item.systemName,
                sourceOfTruth: item.sourceOfTruth,
                manualStepFlag: item.manualStepFlag,
                reconciliationRiskFlag: item.reconciliationRiskFlag,
                complianceNote: item.complianceNote,
                ownerStakeholderId: item.ownerStakeholderId,
                linkedInitiativeId: item.linkedInitiativeId,
            });
            setError(null);
            return;
        }

        setForm(EMPTY_FORM);
        setError(null);
    }, [item, open]);

    if (!open) return null;

    return (
        <div className="sheet-overlay" onClick={onClose}>
            <div className="sheet-panel" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-header">
                    <div>
                        <h2>{item ? 'Edit Fintech Context' : 'New Fintech Context Item'}</h2>
                        <p>Map data sources, manual work, reconciliation risk, and compliance constraints in one place.</p>
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
                            await onSave(form, item?.id);
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
                            <span className="sheet-label">Context Type</span>
                            <select className="input" value={form.contextType} onChange={(event) => setForm((current) => ({ ...current, contextType: event.target.value as FintechContextType }))}>
                                {CONTEXT_TYPES.map((contextType) => (
                                    <option key={contextType} value={contextType}>{contextType.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Name</span>
                            <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">System Name</span>
                            <input className="input" value={form.systemName || ''} onChange={(event) => setForm((current) => ({ ...current, systemName: event.target.value || null }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Source of Truth</span>
                            <input className="input" value={form.sourceOfTruth || ''} onChange={(event) => setForm((current) => ({ ...current, sourceOfTruth: event.target.value || null }))} />
                        </label>
                    </div>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Description</span>
                        <textarea className="input" rows={4} value={form.description || ''} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value || null }))} />
                    </label>
                    <PmWritingPrompts
                        value={form.description}
                        onChange={(description) => setForm((current) => ({ ...current, description }))}
                        prompts={fintechDescriptionPrompts}
                        title="Context Description Starters"
                        description="Use these to describe sources of truth, manual work, and reconciliation risk in fintech-specific language."
                    />

                    <div className="sheet-grid">
                        <StakeholderSelect
                            stakeholders={stakeholders}
                            value={form.ownerStakeholderId}
                            onChange={(ownerStakeholderId) => setForm((current) => ({ ...current, ownerStakeholderId }))}
                            label="Owner Stakeholder"
                        />
                        <InitiativeSelect
                            initiatives={initiatives}
                            value={form.linkedInitiativeId}
                            onChange={(linkedInitiativeId) => setForm((current) => ({ ...current, linkedInitiativeId }))}
                            label="Linked Initiative"
                        />
                    </div>

                    <div className="sheet-grid">
                        <label className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.manualStepFlag} onChange={() => setForm((current) => ({ ...current, manualStepFlag: !current.manualStepFlag }))} />
                            Manual step exists
                        </label>
                        <label className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.reconciliationRiskFlag} onChange={() => setForm((current) => ({ ...current, reconciliationRiskFlag: !current.reconciliationRiskFlag }))} />
                            Reconciliation risk exists
                        </label>
                    </div>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Compliance Note</span>
                        <textarea className="input" rows={4} value={form.complianceNote || ''} onChange={(event) => setForm((current) => ({ ...current, complianceNote: event.target.value || null }))} />
                    </label>
                    <PmWritingPrompts
                        value={form.complianceNote}
                        onChange={(complianceNote) => setForm((current) => ({ ...current, complianceNote }))}
                        prompts={fintechCompliancePrompts}
                        title="Compliance Note Starters"
                        description="Describe the constraint, reviewer, or control instead of leaving compliance concerns implicit."
                    />

                    {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

                    <div className="sheet-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? 'Saving…' : item ? 'Save Context Item' : 'Create Context Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
