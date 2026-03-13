'use client';

import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/app-store';

interface PmGuideTooltipProps {
    metric: string;
}

interface MetricGuideContent {
    means: string;
    healthy: string;
    ifOutsideRange: string;
    talkingPoint: string;
}

const PM_GUIDE_CONTENT: Record<string, MetricGuideContent> = {
    velocity: {
        means: 'Story points or tickets your team completes per sprint. Your baseline for planning.',
        healthy: 'Consistent or slowly rising trend',
        ifOutsideRange: 'Ask the team: are we over-committing, hitting blockers, or dealing with scope creep?',
        talkingPoint: 'Our team averages X points per sprint. This sprint we are tracking at Y.',
    },
    bounce_rate: {
        means: '% of tickets that moved backward in workflow, e.g. from QA back to In Progress.',
        healthy: 'Under 20%',
        ifOutsideRange: 'Tickets may be leaving QA too early. Review acceptance criteria with the team.',
        talkingPoint: 'X% of our tickets needed rework this sprint, above our 20% target.',
    },
    carry_over: {
        means: 'Tickets committed to this sprint that will not finish before it ends.',
        healthy: '0-2 tickets',
        ifOutsideRange: 'Consider descoping lowest-priority tickets or splitting large ones before sprint ends.',
        talkingPoint: 'We have X tickets at risk of carrying over, representing ~$Y of sprint investment.',
    },
    cycle_time: {
        means: 'How long a ticket takes from first In Progress to Done. Your team\'s actual delivery speed.',
        healthy: 'Consistent p50. Below 14 days is strong.',
        ifOutsideRange: 'Look for tickets stuck in Review or QA - that is usually the bottleneck.',
        talkingPoint: 'Our median ticket takes X days to complete. P95 is Y days for complex work.',
    },
    bug_ratio: {
        means: 'What share of the team\'s work is fixing bugs vs building new features.',
        healthy: 'Under 1.0 (more features than bugs)',
        ifOutsideRange: 'Consider a dedicated bug-bash sprint or add QA earlier in the process.',
        talkingPoint: 'Currently X% of our capacity goes to bug fixes vs new development.',
    },
    reopen_rate: {
        means: '% of resolved tickets that were reopened because the fix was incomplete.',
        healthy: 'Under 5%',
        ifOutsideRange: 'QA process or acceptance criteria need tightening. Review definition of done with team.',
        talkingPoint: 'Our re-open rate is X%, which means Y% of fixes ship correctly the first time.',
    },
};

export default function PmGuideTooltip({ metric }: PmGuideTooltipProps) {
    const isPmGuideEnabled = useAppStore((state) => state.isPmGuideEnabled);
    const [open, setOpen] = useState(false);
    const content = useMemo(() => PM_GUIDE_CONTENT[metric], [metric]);

    if (!isPmGuideEnabled || !content) return null;

    return (
        <span
            style={{ position: 'relative', display: 'inline-flex', marginLeft: 6, verticalAlign: 'middle' }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            <button
                type="button"
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                aria-label={`PM guide: ${metric}`}
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: '1px solid rgba(148,163,184,0.45)',
                    background: 'rgba(148,163,184,0.16)',
                    color: '#e2e8f0',
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1,
                    cursor: 'help',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                }}
            >
                ?
            </button>

            {open && (
                <div
                    role="tooltip"
                    style={{
                        position: 'absolute',
                        top: 24,
                        right: 0,
                        width: 320,
                        maxWidth: 'calc(100vw - 32px)',
                        border: '1px solid rgba(148,163,184,0.35)',
                        background: 'rgba(15,23,42,0.97)',
                        color: '#e2e8f0',
                        borderRadius: 10,
                        padding: '10px 12px',
                        zIndex: 80,
                        boxShadow: '0 16px 36px rgba(2,6,23,0.5)',
                        display: 'grid',
                        gap: 8,
                        fontSize: 12,
                        lineHeight: 1.45,
                    }}
                >
                    <div>
                        <strong>📖 What this means:</strong> {content.means}
                    </div>
                    <div>
                        <strong>✅ Healthy range:</strong> {content.healthy}
                    </div>
                    <div>
                        <strong>⚠️ If outside range:</strong> {content.ifOutsideRange}
                    </div>
                    <div>
                        <strong>💬 Talking point:</strong> {content.talkingPoint}
                    </div>
                </div>
            )}
        </span>
    );
}
