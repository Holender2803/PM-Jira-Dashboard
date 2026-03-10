export interface TeamConfig {
    teamName: string;
    activeEngineers: number;
    hourlyRate: number;
    productiveHoursPerSprint: number;
    sprintLengthWeeks: number;
    updatedAt: string | null;
}

export const DEFAULT_TEAM_CONFIG: TeamConfig = {
    teamName: 'Engineering Team',
    activeEngineers: 3,
    hourlyRate: 100,
    productiveHoursPerSprint: 50,
    sprintLengthWeeks: 2,
    updatedAt: null,
};

interface TeamConfigInput {
    teamName?: unknown;
    activeEngineers?: unknown;
    hourlyRate?: unknown;
    productiveHoursPerSprint?: unknown;
    sprintLengthWeeks?: unknown;
}

function sanitizeTeamName(value: unknown): string {
    if (typeof value !== 'string') return DEFAULT_TEAM_CONFIG.teamName;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : DEFAULT_TEAM_CONFIG.teamName;
}

function sanitizeInteger(value: unknown, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const rounded = Math.round(parsed);
    return rounded > 0 ? rounded : fallback;
}

export function normalizeTeamConfigInput(input: unknown): Omit<TeamConfig, 'updatedAt'> {
    const candidate = (input && typeof input === 'object')
        ? (input as TeamConfigInput)
        : {};

    return {
        teamName: sanitizeTeamName(candidate.teamName),
        activeEngineers: sanitizeInteger(candidate.activeEngineers, DEFAULT_TEAM_CONFIG.activeEngineers),
        hourlyRate: sanitizeInteger(candidate.hourlyRate, DEFAULT_TEAM_CONFIG.hourlyRate),
        productiveHoursPerSprint: sanitizeInteger(
            candidate.productiveHoursPerSprint,
            DEFAULT_TEAM_CONFIG.productiveHoursPerSprint
        ),
        sprintLengthWeeks: sanitizeInteger(candidate.sprintLengthWeeks, DEFAULT_TEAM_CONFIG.sprintLengthWeeks),
    };
}
