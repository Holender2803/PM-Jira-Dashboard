'use client';

import { useEffect, useMemo, useState } from 'react';
import JiraIssueMultiSelect from '@/components/shared/JiraIssueMultiSelect';
import PmWritingPrompts from '@/components/shared/PmWritingPrompts';
import { initiativeNotesPrompts, initiativeSummaryPrompts } from '@/lib/pm-writing';
import { useAppStore } from '@/store/app-store';
import {
    InitiativeInput,
    InitiativeStatus,
    InitiativeWithHealth,
    ObjectiveRecord,
    OutcomeRecord,
} from '@/types/pm-os';

interface InitiativeFormSheetProps {
    open: boolean;
    initiative?: InitiativeWithHealth | null;
    objectives: ObjectiveRecord[];
    outcomes: OutcomeRecord[];
    onClose: () => void;
    onSave: (input: InitiativeInput, id?: string) => Promise<void>;
}

const STATUSES: InitiativeStatus[] = [
    'proposed',
    'discovery',
    'planned',
    'in_progress',
    'launched',
    'done',
    'on_hold',
    'archived',
];

const EMPTY_FORM: InitiativeInput = {
    title: '',
    summary: null,
    status: 'proposed',
    ownerName: null,
    theme: null,
    targetDate: null,
    notes: null,
    linkedIssueKeys: [],
    objectiveId: null,
    outcomeId: null,
};

export default function InitiativeFormSheet({
    open,
    initiative,
    objectives,
    outcomes,
    onClose,
    onSave,
}: InitiativeFormSheetProps) {
    const [form, setForm] = useState<InitiativeInput>(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const issues = useAppStore((state) => state.issues);
    const selectedKeys = useAppStore((state) => state.selectedKeys);

    const selectedIssueKeys = useMemo(() => Array.from(selectedKeys), [selectedKeys]);
    const singleSelectedIssue = useMemo(() => {
        if (selectedIssueKeys.length !== 1) return null;
        return issues.find((issue) => issue.key === selectedIssueKeys[0]) || null;
    }, [issues, selectedIssueKeys]);

    useEffect(() => {
        if (!open) return;
        if (initiative) {
            setForm({
                title: initiative.title,
                summary: initiative.summary,
                status: initiative.status,
                ownerName: initiative.ownerName,
                theme: initiative.theme,
                targetDate: initiative.targetDate,
                notes: initiative.notes,
                linkedIssueKeys: initiative.linkedIssueKeys,
                objectiveId: initiative.objectiveId,
                outcomeId: initiative.outcomeId,
            });
            return;
        }
        setForm({
            ...EMPTY_FORM,
            linkedIssueKeys: selectedIssueKeys,
            title: singleSelectedIssue?.issueType === 'Epic' ? singleSelectedIssue.summary : '',
            summary: singleSelectedIssue?.issueType === 'Epic'
                ? `Initiative seeded from ${singleSelectedIssue.key}.`
                : null,
        });
        setError(null);
    }, [initiative, open, selectedIssueKeys, singleSelectedIssue]);

    const availableOutcomes = useMemo(() => {
        if (!form.objectiveId) return outcomes;
        return outcomes.filter((outcome) => outcome.objectiveId === form.objectiveId);
    }, [form.objectiveId, outcomes]);

    if (!open) return null;

    return (
        <div className="sheet-overlay" onClick={onClose}>
            <div className="sheet-panel" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-header">
                    <div>
                        <h2>{initiative ? 'Edit Initiative' : 'New Initiative'}</h2>
                        <p>Capture a PM initiative and connect it to Jira work.</p>
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
                            await onSave(form, initiative?.id);
                            onClose();
                        } catch (saveError) {
                            setError(String(saveError));
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    {!initiative && (
                        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                Quick Fill
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    disabled={selectedIssueKeys.length === 0}
                                    onClick={() => setForm((current) => ({
                                        ...current,
                                        linkedIssueKeys: selectedIssueKeys,
                                        title: current.title || (singleSelectedIssue?.issueType === 'Epic' ? singleSelectedIssue.summary : current.title),
                                        summary: current.summary || (singleSelectedIssue?.issueType === 'Epic'
                                            ? `Initiative seeded from ${singleSelectedIssue.key}.`
                                            : current.summary),
                                    }))}
                                >
                                    Use current Jira selection{selectedIssueKeys.length > 0 ? ` (${selectedIssueKeys.length})` : ''}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setForm({
                                        ...EMPTY_FORM,
                                        linkedIssueKeys: selectedIssueKeys,
                                        title: 'Roadmap initiative',
                                        status: 'proposed',
                                        notes: 'Add the customer problem, expected outcome, and decision criteria before planning.',
                                        objectiveId: form.objectiveId,
                                        outcomeId: form.outcomeId,
                                    })}
                                >
                                    Start from roadmap template
                                </button>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                New initiatives can inherit the Jira tickets you already selected elsewhere in the dashboard.
                            </div>
                        </div>
                    )}

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Title</span>
                        <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Summary</span>
                        <textarea className="input" rows={3} value={form.summary || ''} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value || null }))} />
                    </label>
                    <PmWritingPrompts
                        value={form.summary}
                        onChange={(summary) => setForm((current) => ({ ...current, summary }))}
                        prompts={initiativeSummaryPrompts}
                        title="Initiative Summary Starters"
                        description="Use these to describe the problem, scope, and success condition in PM language."
                    />

                    <div className="sheet-grid">
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Status</span>
                            <select className="input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as InitiativeStatus }))}>
                                {STATUSES.map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
                            </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Owner</span>
                            <input className="input" value={form.ownerName || ''} onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value || null }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Theme</span>
                            <input className="input" value={form.theme || ''} onChange={(event) => setForm((current) => ({ ...current, theme: event.target.value || null }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Target Date</span>
                            <input className="input" type="date" value={form.targetDate || ''} onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value || null }))} />
                        </label>
                    </div>

                    <div className="sheet-grid">
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Objective</span>
                            <select
                                className="input"
                                value={form.objectiveId || ''}
                                onChange={(event) => {
                                    const objectiveId = event.target.value || null;
                                    setForm((current) => ({
                                        ...current,
                                        objectiveId,
                                        outcomeId: objectiveId && current.outcomeId && !outcomes.some((outcome) => outcome.id === current.outcomeId && outcome.objectiveId === objectiveId)
                                            ? null
                                            : current.outcomeId,
                                    }));
                                }}
                            >
                                <option value="">No objective link</option>
                                {objectives.map((objective) => (
                                    <option key={objective.id} value={objective.id}>
                                        {objective.title}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Outcome</span>
                            <select
                                className="input"
                                value={form.outcomeId || ''}
                                onChange={(event) => {
                                    const outcomeId = event.target.value || null;
                                    const selectedOutcome = outcomes.find((outcome) => outcome.id === outcomeId) || null;
                                    setForm((current) => ({
                                        ...current,
                                        outcomeId,
                                        objectiveId: selectedOutcome?.objectiveId || current.objectiveId,
                                    }));
                                }}
                            >
                                <option value="">No outcome link</option>
                                {availableOutcomes.map((outcome) => (
                                    <option key={outcome.id} value={outcome.id}>
                                        {outcome.title}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Notes</span>
                        <textarea className="input" rows={4} value={form.notes || ''} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value || null }))} />
                    </label>
                    <PmWritingPrompts
                        value={form.notes}
                        onChange={(notes) => setForm((current) => ({ ...current, notes }))}
                        prompts={initiativeNotesPrompts}
                        title="Initiative Notes Starters"
                        description="Capture evidence, open questions, and risks without rewriting the same PM phrases each time."
                    />

                    <JiraIssueMultiSelect
                        value={form.linkedIssueKeys}
                        onChange={(linkedIssueKeys) => setForm((current) => ({ ...current, linkedIssueKeys }))}
                        helperText={singleSelectedIssue
                            ? `Selected Jira context available from ${singleSelectedIssue.key}.`
                            : 'Link the Jira issues that best represent this initiative.'}
                    />

                    {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

                    <div className="sheet-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? 'Saving…' : initiative ? 'Save Initiative' : 'Create Initiative'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
