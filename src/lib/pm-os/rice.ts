export interface RiceScoreInput {
    reach: number;
    impact: number;
    confidence: number;
    effort: number;
}

export const RICE_REACH_OPTIONS = [1, 5, 10, 25, 50, 100, 250, 500, 1000] as const;
export const RICE_IMPACT_OPTIONS = [0.25, 0.5, 1, 2, 3] as const;
export const RICE_CONFIDENCE_OPTIONS = [50, 80, 100] as const;
export const RICE_EFFORT_OPTIONS = [0.5, 1, 2, 3, 5, 8, 13] as const;

export const RICE_IMPACT_LABELS: Record<number, string> = {
    0.25: 'Minimal',
    0.5: 'Low',
    1: 'Medium',
    2: 'High',
    3: 'Massive',
};

function clampConfidence(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
}

export function calculateRiceScore(input: RiceScoreInput): number {
    const effort = Number.isFinite(input.effort) && input.effort > 0 ? input.effort : 1;
    const reach = Number.isFinite(input.reach) ? input.reach : 0;
    const impact = Number.isFinite(input.impact) ? input.impact : 0;
    const confidence = clampConfidence(input.confidence);
    const score = (reach * impact * (confidence / 100)) / effort;
    return Number(score.toFixed(2));
}
