import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import {
    DEFAULT_TEAM_CONFIG,
    normalizeTeamConfigInput,
    type TeamConfig,
} from '@/lib/team-config';

interface TeamConfigRow {
    team_name: string | null;
    active_engineers: number | null;
    hourly_rate: number | null;
    productive_hours_per_sprint: number | null;
    sprint_length_weeks: number | null;
    updated_at: string | null;
}

function toPositiveInteger(value: number | null | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    const rounded = Math.round(value);
    return rounded > 0 ? rounded : fallback;
}

function rowToConfig(row?: TeamConfigRow): TeamConfig {
    if (!row) {
        return { ...DEFAULT_TEAM_CONFIG };
    }

    return {
        teamName: (row.team_name || '').trim() || DEFAULT_TEAM_CONFIG.teamName,
        activeEngineers: toPositiveInteger(row.active_engineers, DEFAULT_TEAM_CONFIG.activeEngineers),
        hourlyRate: toPositiveInteger(row.hourly_rate, DEFAULT_TEAM_CONFIG.hourlyRate),
        productiveHoursPerSprint: toPositiveInteger(
            row.productive_hours_per_sprint,
            DEFAULT_TEAM_CONFIG.productiveHoursPerSprint
        ),
        sprintLengthWeeks: toPositiveInteger(row.sprint_length_weeks, DEFAULT_TEAM_CONFIG.sprintLengthWeeks),
        updatedAt: row.updated_at || null,
    };
}

export async function GET() {
    try {
        const db = getDb();
        const row = db.prepare(`
      SELECT team_name, active_engineers, hourly_rate, productive_hours_per_sprint, sprint_length_weeks, updated_at
      FROM team_config
      WHERE id = 1
    `).get() as TeamConfigRow | undefined;

        return NextResponse.json(rowToConfig(row));
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const payload = normalizeTeamConfigInput(body);

        const db = getDb();
        db.prepare(`
      INSERT INTO team_config (
        id,
        team_name,
        active_engineers,
        hourly_rate,
        productive_hours_per_sprint,
        sprint_length_weeks,
        updated_at
      )
      VALUES (1, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(id) DO UPDATE SET
        team_name = excluded.team_name,
        active_engineers = excluded.active_engineers,
        hourly_rate = excluded.hourly_rate,
        productive_hours_per_sprint = excluded.productive_hours_per_sprint,
        sprint_length_weeks = excluded.sprint_length_weeks,
        updated_at = excluded.updated_at
    `).run(
            payload.teamName,
            payload.activeEngineers,
            payload.hourlyRate,
            payload.productiveHoursPerSprint,
            payload.sprintLengthWeeks
        );

        const row = db.prepare(`
      SELECT team_name, active_engineers, hourly_rate, productive_hours_per_sprint, sprint_length_weeks, updated_at
      FROM team_config
      WHERE id = 1
    `).get() as TeamConfigRow | undefined;

        return NextResponse.json({ ok: true, config: rowToConfig(row) });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
