'use client';

import { useEffect, useMemo, useState } from 'react';
import InitiativeSelect from '@/components/shared/InitiativeSelect';
import JiraIssueMultiSelect from '@/components/shared/JiraIssueMultiSelect';
import PmWritingPrompts from '@/components/shared/PmWritingPrompts';
import { decisionContextPrompts, decisionExpectedOutcomePrompts, decisionFinalPrompts } from '@/lib/pm-writing';
import { useAppStore } from '@/store/app-store';
import {
    DecisionInput,
    DecisionOptionInput,
    DecisionStatus,
    DecisionWithOptions,
    InitiativeRecord,
} from '@/types/pm-os';
import DecisionOptionsEditor from './DecisionOptionsEditor';

interface DecisionFormSheetProps {
    open: boolean;
    decision?: DecisionWithOptions | null;
    initiatives: InitiativeRecord[];
    onClose: () => void;
    onSave: (input: DecisionInput, id?: string) => Promise<void>;
}

const STATUSES: DecisionStatus[] = ['draft', 'decided', 'revisited', 'superseded'];

const EMPTY_OPTIONS: DecisionOptionInput[] = [
    {
        optionTitle: '',
        pros: null,
        cons: null,
        sortOrder: 0,
        isSelected: true,
    },
];

const DECISION_TEMPLATES: Array<{
    label: string;
    title: string;
    problemContext: string;
    expectedOutcome: string;
}> = [
    {
        label: 'Scope Tradeoff',
        title: 'Decide scope tradeoff',
        problemContext: 'The delivery team cannot carry the full requested scope in the desired timeline. Clarify what should be cut, deferred, or protected.',
        expectedOutcome: 'A clear scope boundary that protects the highest-value customer or business outcome.',
    },
    {
        label: 'Launch Readiness',
        title: 'Decide launch readiness',
        problemContext: 'The team needs a go / no-go decision based on product quality, dependencies, and stakeholder readiness.',
        expectedOutcome: 'A launch decision with explicit risk acceptance and follow-up owners.',
    },
    {
        label: 'Sequencing',
        title: 'Decide roadmap sequencing',
        problemContext: 'Multiple opportunities are competing for the same engineering capacity. Clarify which item should move first and why.',
        expectedOutcome: 'A sequencing decision tied to impact, confidence, and delivery constraints.',
    },
    {
        label: 'Customer Commitment',
        title: 'Decide customer commitment',
        problemContext: 'A customer-facing promise or dependency needs a product decision before the team can communicate externally.',
        expectedOutcome: 'A clear external commitment and an internal execution path.',
    },
];

function createEmptyDecisionInput(linkedIssueKeys: string[] = []): DecisionInput {
    return {
        title: '',
        problemContext: '',
        finalDecision: null,
        expectedOutcome: null,
        ownerName: null,
        decisionDate: new Date().toISOString().slice(0, 10),
        status: 'draft',
        primaryInitiativeId: null,
        linkedInitiativeIds: [],
        linkedIssueKeys,
        options: EMPTY_OPTIONS.map((option) => ({ ...option })),
    };
}

export default function DecisionFormSheet({
    open,
    decision,
    initiatives,
    onClose,
    onSave,
}: DecisionFormSheetProps) {
    const [form, setForm] = useState<DecisionInput>(createEmptyDecisionInput());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const issues = useAppStore((state) => state.issues);
    const selectedKeys = useAppStore((state) => state.selectedKeys);

    const selectedIssueKeys = useMemo(() => Array.from(selectedKeys), [selectedKeys]);
    const initiativesById = useMemo(
        () => new Map(initiatives.map((initiative) => [initiative.id, initiative])),
        [initiatives]
    );
    const selectedIssueLabel = useMemo(() => {
        if (selectedIssueKeys.length !== 1) return null;
        const issue = issues.find((item) => item.key === selectedIssueKeys[0]);
        return issue ? `${issue.key} · ${issue.summary}` : null;
    }, [issues, selectedIssueKeys]);

    useEffect(() => {
        if (!open) return;
        if (decision) {
            setForm({
                title: decision.title,
                problemContext: decision.problemContext,
                finalDecision: decision.finalDecision,
                expectedOutcome: decision.expectedOutcome,
                ownerName: decision.ownerName,
                decisionDate: decision.decisionDate,
                status: decision.status,
                primaryInitiativeId: decision.primaryInitiativeId,
                linkedInitiativeIds: decision.linkedInitiativeIds,
                linkedIssueKeys: decision.linkedIssueKeys,
                options: decision.options.map((option) => ({
                    optionTitle: option.optionTitle,
                    pros: option.pros,
                    cons: option.cons,
                    sortOrder: option.sortOrder,
                    isSelected: option.isSelected,
                })),
            });
            setError(null);
            return;
        }
        setForm(createEmptyDecisionInput(selectedIssueKeys));
        setError(null);
    }, [decision, open, selectedIssueKeys]);

    useEffect(() => {
        if (!form.primaryInitiativeId) return;

        const initiative = initiativesById.get(form.primaryInitiativeId);
        if (!initiative) return;

        setForm((current) => {
            const linkedInitiativeIds = current.linkedInitiativeIds.includes(initiative.id)
                ? current.linkedInitiativeIds
                : [...current.linkedInitiativeIds, initiative.id];
            const linkedIssueKeys = current.linkedIssueKeys.length > 0
                ? current.linkedIssueKeys
                : initiative.linkedIssueKeys;

            return {
                ...current,
                linkedInitiativeIds,
                linkedIssueKeys,
            };
        });
    }, [form.primaryInitiativeId, initiativesById]);

    if (!open) return null;

    return (
        <div className="sheet-overlay" onClick={onClose}>
            <div className="sheet-panel" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-header">
                    <div>
                        <h2>{decision ? 'Edit Decision' : 'New Decision'}</h2>
                        <p>Record the context, options, and final call for product decisions.</p>
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
                            await onSave(form, decision?.id);
                            onClose();
                        } catch (saveError) {
                            setError(String(saveError));
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    {!decision && (
                        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                Decision Templates
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {DECISION_TEMPLATES.map((template) => (
                                    <button
                                        key={template.label}
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setForm((current) => ({
                                            ...current,
                                            title: template.title,
                                            problemContext: template.problemContext,
                                            expectedOutcome: template.expectedOutcome,
                                        }))}
                                    >
                                        {template.label}
                                    </button>
                                ))}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {selectedIssueKeys.length > 0
                                    ? `This decision will start linked to ${selectedIssueKeys.length} selected Jira ticket${selectedIssueKeys.length === 1 ? '' : 's'}.`
                                    : 'Select Jira tickets first if you want the decision log pre-linked to active delivery work.'}
                            </div>
                        </div>
                    )}

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Title</span>
                        <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Problem Context</span>
                        <textarea className="input" rows={4} value={form.problemContext} onChange={(event) => setForm((current) => ({ ...current, problemContext: event.target.value }))} required />
                    </label>
                    <PmWritingPrompts
                        value={form.problemContext}
                        onChange={(problemContext) => setForm((current) => ({ ...current, problemContext }))}
                        prompts={decisionContextPrompts}
                        title="Problem Context Starters"
                        description="Start with the tradeoff and constraint so future readers understand why the decision existed."
                    />

                    <div className="sheet-grid">
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Decision Date</span>
                            <input className="input" type="date" value={form.decisionDate} onChange={(event) => setForm((current) => ({ ...current, decisionDate: event.target.value }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Status</span>
                            <select className="input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as DecisionStatus }))}>
                                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Owner</span>
                            <input className="input" value={form.ownerName || ''} onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value || null }))} />
                        </label>
                        <InitiativeSelect initiatives={initiatives} value={form.primaryInitiativeId} onChange={(primaryInitiativeId) => setForm((current) => ({ ...current, primaryInitiativeId }))} label="Primary Initiative" />
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

                    {form.primaryInitiativeId && initiativesById.get(form.primaryInitiativeId)?.linkedIssueKeys.length ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                Reuse Jira delivery context from <strong>{initiativesById.get(form.primaryInitiativeId)?.title}</strong>.
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                    const initiative = initiativesById.get(form.primaryInitiativeId || '');
                                    if (!initiative) return;
                                    setForm((current) => ({
                                        ...current,
                                        linkedIssueKeys: Array.from(new Set([...initiative.linkedIssueKeys, ...current.linkedIssueKeys])),
                                    }));
                                }}
                            >
                                Pull initiative links
                            </button>
                        </div>
                    ) : null}

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Final Decision</span>
                        <textarea className="input" rows={3} value={form.finalDecision || ''} onChange={(event) => setForm((current) => ({ ...current, finalDecision: event.target.value || null }))} />
                    </label>
                    <PmWritingPrompts
                        value={form.finalDecision}
                        onChange={(finalDecision) => setForm((current) => ({ ...current, finalDecision }))}
                        prompts={decisionFinalPrompts}
                        title="Final Decision Starters"
                        description="Use clear product language so the chosen path is explicit."
                    />

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Expected Outcome</span>
                        <textarea className="input" rows={3} value={form.expectedOutcome || ''} onChange={(event) => setForm((current) => ({ ...current, expectedOutcome: event.target.value || null }))} />
                    </label>
                    <PmWritingPrompts
                        value={form.expectedOutcome}
                        onChange={(expectedOutcome) => setForm((current) => ({ ...current, expectedOutcome }))}
                        prompts={decisionExpectedOutcomePrompts}
                        title="Expected Outcome Starters"
                        description="Frame what should improve and how you will recognize success."
                    />

                    <DecisionOptionsEditor options={form.options} onChange={(options) => setForm((current) => ({ ...current, options }))} />

                    <JiraIssueMultiSelect
                        value={form.linkedIssueKeys}
                        onChange={(linkedIssueKeys) => setForm((current) => ({ ...current, linkedIssueKeys }))}
                        helperText={selectedIssueLabel
                            ? `Selected Jira context: ${selectedIssueLabel}`
                            : 'Link the Jira work that created or is affected by this decision.'}
                    />

                    {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

                    <div className="sheet-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? 'Saving…' : decision ? 'Save Decision' : 'Create Decision'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
