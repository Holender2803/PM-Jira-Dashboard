'use client';

import { useEffect, useMemo, useState } from 'react';
import InitiativeSelect from '@/components/shared/InitiativeSelect';
import PmWritingPrompts from '@/components/shared/PmWritingPrompts';
import { prioritizationRationalePrompts } from '@/lib/pm-writing';
import {
    calculateRiceScore,
    RICE_CONFIDENCE_OPTIONS,
    RICE_EFFORT_OPTIONS,
    RICE_IMPACT_LABELS,
    RICE_IMPACT_OPTIONS,
    RICE_REACH_OPTIONS,
} from '@/lib/pm-os/rice';
import {
    InitiativeRecord,
    PrioritizationCandidate,
    PrioritizationInput,
    PrioritizationScoreView,
} from '@/types/pm-os';
import ScoreBadge from './ScoreBadge';

interface RiceScoreEditorProps {
    candidate: PrioritizationCandidate | null;
    score: PrioritizationScoreView | null;
    initiatives: InitiativeRecord[];
    onSave: (input: PrioritizationInput, id?: string) => Promise<void>;
}

function coerceOption<T extends readonly number[]>(value: number, options: T, fallback: T[number]): T[number] {
    return options.includes(value as T[number]) ? (value as T[number]) : fallback;
}

export default function RiceScoreEditor({
    candidate,
    score,
    initiatives,
    onSave,
}: RiceScoreEditorProps) {
    const [form, setForm] = useState<PrioritizationInput | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (score) {
            setForm({
                targetType: score.targetType,
                targetId: score.targetId,
                initiativeId: score.initiativeId,
                reach: coerceOption(score.reach, RICE_REACH_OPTIONS, RICE_REACH_OPTIONS[2]),
                impact: coerceOption(score.impact, RICE_IMPACT_OPTIONS, RICE_IMPACT_OPTIONS[2]),
                confidence: coerceOption(score.confidence, RICE_CONFIDENCE_OPTIONS, RICE_CONFIDENCE_OPTIONS[1]),
                effort: coerceOption(score.effort, RICE_EFFORT_OPTIONS, RICE_EFFORT_OPTIONS[2]),
                rationale: score.rationale,
            });
            setError(null);
            return;
        }

        if (candidate) {
            setForm({
                targetType: candidate.targetType,
                targetId: candidate.targetId,
                initiativeId: candidate.initiativeId,
                reach: RICE_REACH_OPTIONS[2],
                impact: RICE_IMPACT_OPTIONS[2],
                confidence: RICE_CONFIDENCE_OPTIONS[1],
                effort: RICE_EFFORT_OPTIONS[2],
                rationale: null,
            });
            setError(null);
            return;
        }

        setForm(null);
    }, [candidate, score]);

    const liveScore = useMemo(
        () => form ? calculateRiceScore(form) : 0,
        [form]
    );

    if (!form) {
        return (
            <div className="card" style={{ minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Select an initiative or Jira issue to start scoring.
            </div>
        );
    }

    return (
        <form
            className="card"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setError(null);
                try {
                    await onSave(form, score?.id);
                } catch (saveError) {
                    setError(String(saveError));
                } finally {
                    setBusy(false);
                }
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                    <div style={{ fontSize: 11, color: 'var(--accent-light)', textTransform: 'uppercase' }}>
                        {form.targetType === 'initiative' ? 'Initiative' : 'Jira Issue'}
                    </div>
                    <h2 style={{ fontSize: 18 }}>{candidate?.title || score?.targetTitle || form.targetId}</h2>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {form.targetType === 'jira_issue' ? form.targetId : 'Manual initiative'}
                    </div>
                </div>
                <ScoreBadge score={liveScore} />
            </div>

            <div className="sheet-grid">
                <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span className="sheet-label">Reach</span>
                    <select
                        className="input"
                        value={form.reach}
                        onChange={(event) => setForm((current) => current ? { ...current, reach: Number(event.target.value) } : current)}
                    >
                        {RICE_REACH_OPTIONS.map((value) => (
                            <option key={value} value={value}>
                                {value}
                            </option>
                        ))}
                    </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span className="sheet-label">Impact</span>
                    <select
                        className="input"
                        value={form.impact}
                        onChange={(event) => setForm((current) => current ? { ...current, impact: Number(event.target.value) } : current)}
                    >
                        {RICE_IMPACT_OPTIONS.map((value) => (
                            <option key={value} value={value}>
                                {value} · {RICE_IMPACT_LABELS[value]}
                            </option>
                        ))}
                    </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span className="sheet-label">Confidence (%)</span>
                    <select
                        className="input"
                        value={form.confidence}
                        onChange={(event) => setForm((current) => current ? { ...current, confidence: Number(event.target.value) } : current)}
                    >
                        {RICE_CONFIDENCE_OPTIONS.map((value) => (
                            <option key={value} value={value}>
                                {value}%{value === 50 ? ' · Low' : value === 80 ? ' · Medium' : ' · High'}
                            </option>
                        ))}
                    </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span className="sheet-label">Effort</span>
                    <select
                        className="input"
                        value={form.effort}
                        onChange={(event) => setForm((current) => current ? { ...current, effort: Number(event.target.value) } : current)}
                    >
                        {RICE_EFFORT_OPTIONS.map((value) => (
                            <option key={value} value={value}>
                                {value}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                RICE is intentionally bounded here so scores stay comparable across teams and review cycles.
            </div>

            <InitiativeSelect
                initiatives={initiatives}
                value={form.initiativeId}
                onChange={(initiativeId) => setForm((current) => current ? { ...current, initiativeId } : current)}
                label="Linked Initiative"
            />

            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="sheet-label">Rationale</span>
                <textarea className="input" rows={4} value={form.rationale || ''} onChange={(event) => setForm((current) => current ? { ...current, rationale: event.target.value || null } : current)} />
            </label>
            <PmWritingPrompts
                value={form.rationale}
                onChange={(rationale) => setForm((current) => current ? { ...current, rationale } : current)}
                prompts={prioritizationRationalePrompts}
                title="RICE Rationale Starters"
                description="Use consistent PM language for why this item should rise or fall in the ranking."
            />

            {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                    {busy ? 'Saving…' : score ? 'Update Score' : 'Save Score'}
                </button>
            </div>
        </form>
    );
}
