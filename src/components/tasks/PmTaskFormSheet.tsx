'use client';

import { useEffect, useMemo, useState } from 'react';
import InitiativeSelect from '@/components/shared/InitiativeSelect';
import JiraIssueMultiSelect from '@/components/shared/JiraIssueMultiSelect';
import PmWritingPrompts from '@/components/shared/PmWritingPrompts';
import { taskNotesPrompts } from '@/lib/pm-writing';
import { useAppStore } from '@/store/app-store';
import { InitiativeRecord, PmTaskCategory, PmTaskInput, PmTaskRecord, PmTaskStatus } from '@/types/pm-os';

interface PmTaskFormSheetProps {
    open: boolean;
    task?: PmTaskRecord | null;
    initiatives: InitiativeRecord[];
    onClose: () => void;
    onSave: (input: PmTaskInput, id?: string) => Promise<void>;
}

const CATEGORIES: PmTaskCategory[] = ['Discovery', 'Delivery', 'Stakeholder', 'Strategy', 'Operations'];
const STATUSES: PmTaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];

const EMPTY_FORM: PmTaskInput = {
    title: '',
    category: 'Discovery',
    status: 'todo',
    ownerName: null,
    dueDate: null,
    initiativeId: null,
    meetingParticipants: [],
    notes: null,
    linkedIssueKeys: [],
};

const TASK_TEMPLATES: Array<{
    label: string;
    title: string;
    category: PmTaskCategory;
    notes: string;
}> = [
    {
        label: 'Sprint Review',
        title: 'Prepare sprint review',
        category: 'Delivery',
        notes: 'Pull delivery highlights, blockers, carry-over items, and talking points for the review.',
    },
    {
        label: 'Stakeholder Update',
        title: 'Send stakeholder update',
        category: 'Stakeholder',
        notes: 'Summarize what shipped, what moved, top risks, and the next product decision to make.',
    },
    {
        label: 'Discovery Session',
        title: 'Run discovery session',
        category: 'Discovery',
        notes: 'Clarify the customer problem, key assumptions, and the evidence needed before committing roadmap time.',
    },
    {
        label: 'Roadmap Review',
        title: 'Review roadmap priorities',
        category: 'Strategy',
        notes: 'Re-check priority scores, delivery confidence, and open product decisions before the next planning cycle.',
    },
];

export default function PmTaskFormSheet({
    open,
    task,
    initiatives,
    onClose,
    onSave,
}: PmTaskFormSheetProps) {
    const [form, setForm] = useState<PmTaskInput>(EMPTY_FORM);
    const [participantsText, setParticipantsText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const issues = useAppStore((state) => state.issues);
    const selectedKeys = useAppStore((state) => state.selectedKeys);

    const selectedIssueKeys = useMemo(() => Array.from(selectedKeys), [selectedKeys]);
    const initiativesById = useMemo(
        () => new Map(initiatives.map((initiative) => [initiative.id, initiative])),
        [initiatives]
    );
    const selectedInitiative = form.initiativeId ? initiativesById.get(form.initiativeId) || null : null;
    const selectedIssueLabel = useMemo(() => {
        if (selectedIssueKeys.length !== 1) return null;
        const issue = issues.find((item) => item.key === selectedIssueKeys[0]);
        return issue ? `${issue.key} · ${issue.summary}` : null;
    }, [issues, selectedIssueKeys]);

    useEffect(() => {
        if (!open) return;
        if (task) {
            setForm({
                title: task.title,
                category: task.category,
                status: task.status,
                ownerName: task.ownerName,
                dueDate: task.dueDate,
                initiativeId: task.initiativeId,
                meetingParticipants: task.meetingParticipants,
                notes: task.notes,
                linkedIssueKeys: task.linkedIssueKeys,
            });
            setParticipantsText(task.meetingParticipants.join(', '));
            return;
        }
        setForm({
            ...EMPTY_FORM,
            linkedIssueKeys: selectedIssueKeys,
        });
        setParticipantsText('');
        setError(null);
    }, [open, selectedIssueKeys, task]);

    useEffect(() => {
        if (!form.initiativeId) return;
        if (form.linkedIssueKeys.length > 0) return;

        const initiative = initiativesById.get(form.initiativeId);
        if (!initiative || initiative.linkedIssueKeys.length === 0) return;

        setForm((current) => ({
            ...current,
            linkedIssueKeys: initiative.linkedIssueKeys,
        }));
    }, [form.initiativeId, form.linkedIssueKeys.length, initiativesById]);

    if (!open) return null;

    return (
        <div className="sheet-overlay" onClick={onClose}>
            <div className="sheet-panel" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-header">
                    <div>
                        <h2>{task ? 'Edit PM Task' : 'New PM Task'}</h2>
                        <p>Track PM work that sits outside engineering tickets.</p>
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
                            await onSave({
                                ...form,
                                meetingParticipants: participantsText
                                    .split(',')
                                    .map((value) => value.trim())
                                    .filter(Boolean),
                            }, task?.id);
                            onClose();
                        } catch (saveError) {
                            setError(String(saveError));
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    {!task && (
                        <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                Quick Start
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {TASK_TEMPLATES.map((template) => (
                                    <button
                                        key={template.label}
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setForm((current) => ({
                                            ...current,
                                            title: template.title,
                                            category: template.category,
                                            notes: template.notes,
                                        }))}
                                    >
                                        {template.label}
                                    </button>
                                ))}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {selectedIssueKeys.length > 0
                                    ? `This task will start with ${selectedIssueKeys.length} selected Jira ticket${selectedIssueKeys.length === 1 ? '' : 's'} linked.`
                                    : 'Select Jira tickets in the dashboard first if you want this task pre-linked.'}
                            </div>
                        </div>
                    )}

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Title</span>
                        <input className="input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
                    </label>

                    <div className="sheet-grid">
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Category</span>
                            <select className="input" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as PmTaskCategory }))}>
                                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                            </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Status</span>
                            <select className="input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PmTaskStatus }))}>
                                {STATUSES.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
                            </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Owner</span>
                            <input className="input" value={form.ownerName || ''} onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value || null }))} />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span className="sheet-label">Due Date</span>
                            <input className="input" type="date" value={form.dueDate || ''} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value || null }))} />
                        </label>
                    </div>

                    <InitiativeSelect initiatives={initiatives} value={form.initiativeId} onChange={(initiativeId) => setForm((current) => ({ ...current, initiativeId }))} />

                    {selectedInitiative && selectedInitiative.linkedIssueKeys.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                Reuse {selectedInitiative.linkedIssueKeys.length} Jira links from <strong>{selectedInitiative.title}</strong>.
                            </div>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setForm((current) => ({
                                    ...current,
                                    linkedIssueKeys: Array.from(new Set([...selectedInitiative.linkedIssueKeys, ...current.linkedIssueKeys])),
                                }))}
                            >
                                Pull initiative links
                            </button>
                        </div>
                    )}

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Meeting Participants</span>
                        <input className="input" value={participantsText} onChange={(event) => setParticipantsText(event.target.value)} placeholder="Comma-separated names" />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="sheet-label">Notes</span>
                        <textarea className="input" rows={4} value={form.notes || ''} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value || null }))} />
                    </label>
                    <PmWritingPrompts
                        value={form.notes}
                        onChange={(notes) => setForm((current) => ({ ...current, notes }))}
                        prompts={taskNotesPrompts}
                        title="Task Note Starters"
                        description="Use these for PM follow-through language so tasks explain purpose, dependency, and done state."
                    />

                    <JiraIssueMultiSelect
                        value={form.linkedIssueKeys}
                        onChange={(linkedIssueKeys) => setForm((current) => ({ ...current, linkedIssueKeys }))}
                        helperText={selectedIssueLabel
                            ? `Selected Jira context: ${selectedIssueLabel}`
                            : 'Link the Jira tickets this PM task depends on or follows up on.'}
                    />

                    {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

                    <div className="sheet-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? 'Saving…' : task ? 'Save Task' : 'Create Task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
