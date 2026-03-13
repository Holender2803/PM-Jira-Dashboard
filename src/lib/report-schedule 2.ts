import getDb from '@/lib/db';
import {
    createStatusReport,
    normalizeReportAudience,
    type ReportAudience,
    type StatusReportRecord,
} from '@/lib/status-reports';

type DayOfWeek =
    | 'Sunday'
    | 'Monday'
    | 'Tuesday'
    | 'Wednesday'
    | 'Thursday'
    | 'Friday'
    | 'Saturday';

interface ReportScheduleRow {
    enabled: number | null;
    day_of_week: string | null;
    time: string | null;
    audience: string | null;
    last_run_at: string | null;
    next_run_at: string | null;
}

export interface ReportSchedule {
    enabled: boolean;
    dayOfWeek: DayOfWeek;
    time: string;
    audience: ReportAudience;
    lastRunAt: string | null;
    nextRunAt: string | null;
}

interface ReportScheduleInput {
    enabled?: unknown;
    dayOfWeek?: unknown;
    time?: unknown;
    audience?: unknown;
}

export interface ScheduledReportCheckResult {
    triggered: boolean;
    report: StatusReportRecord | null;
}

const DAYS: DayOfWeek[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

export const DEFAULT_REPORT_SCHEDULE: ReportSchedule = {
    enabled: false,
    dayOfWeek: 'Friday',
    time: '09:00',
    audience: 'executive',
    lastRunAt: null,
    nextRunAt: null,
};

function normalizeDayOfWeek(value: unknown): DayOfWeek {
    if (typeof value !== 'string') return DEFAULT_REPORT_SCHEDULE.dayOfWeek;
    const normalized = value.trim().toLowerCase();
    const match = DAYS.find((day) => day.toLowerCase() === normalized);
    return match || DEFAULT_REPORT_SCHEDULE.dayOfWeek;
}

function normalizeTime(value: unknown): string {
    if (typeof value !== 'string') return DEFAULT_REPORT_SCHEDULE.time;
    const trimmed = value.trim();
    if (!/^\d{2}:\d{2}$/.test(trimmed)) return DEFAULT_REPORT_SCHEDULE.time;

    const [hourRaw, minuteRaw] = trimmed.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return DEFAULT_REPORT_SCHEDULE.time;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return DEFAULT_REPORT_SCHEDULE.time;

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function toDateOrNull(value: string | null | undefined): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ensureReportScheduleTable() {
    const db = getDb();
    db.exec(`
    CREATE TABLE IF NOT EXISTS report_schedule (
      id INTEGER PRIMARY KEY DEFAULT 1,
      enabled INTEGER DEFAULT 0,
      day_of_week TEXT DEFAULT 'Friday',
      time TEXT DEFAULT '09:00',
      audience TEXT DEFAULT 'executive',
      last_run_at TEXT,
      next_run_at TEXT
    )
  `);
}

function rowToSchedule(row?: ReportScheduleRow): ReportSchedule {
    if (!row) return { ...DEFAULT_REPORT_SCHEDULE };
    return {
        enabled: Boolean(row.enabled),
        dayOfWeek: normalizeDayOfWeek(row.day_of_week),
        time: normalizeTime(row.time),
        audience: normalizeReportAudience(row.audience),
        lastRunAt: row.last_run_at || null,
        nextRunAt: row.next_run_at || null,
    };
}

function getScheduleRow(): ReportScheduleRow | undefined {
    ensureReportScheduleTable();
    const db = getDb();
    return db.prepare(`
      SELECT enabled, day_of_week, time, audience, last_run_at, next_run_at
      FROM report_schedule
      WHERE id = 1
    `).get() as ReportScheduleRow | undefined;
}

function upsertSchedule(schedule: ReportSchedule) {
    ensureReportScheduleTable();
    const db = getDb();
    db.prepare(`
      INSERT INTO report_schedule (id, enabled, day_of_week, time, audience, last_run_at, next_run_at)
      VALUES (1, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        enabled = excluded.enabled,
        day_of_week = excluded.day_of_week,
        time = excluded.time,
        audience = excluded.audience,
        last_run_at = excluded.last_run_at,
        next_run_at = excluded.next_run_at
    `).run(
        schedule.enabled ? 1 : 0,
        schedule.dayOfWeek,
        schedule.time,
        schedule.audience,
        schedule.lastRunAt,
        schedule.nextRunAt
    );
}

export function getReportSchedule(): ReportSchedule {
    return rowToSchedule(getScheduleRow());
}

export function computeNextRunAt(dayOfWeek: DayOfWeek, time: string, now = new Date()): string {
    const dayIndex = DAYS.indexOf(dayOfWeek);
    const [hourRaw, minuteRaw] = normalizeTime(time).split(':');
    const targetHour = Number(hourRaw);
    const targetMinute = Number(minuteRaw);

    const nextRun = new Date(now);
    nextRun.setSeconds(0, 0);
    nextRun.setHours(targetHour, targetMinute, 0, 0);

    let dayDiff = dayIndex - nextRun.getDay();
    if (dayDiff < 0) dayDiff += 7;
    nextRun.setDate(nextRun.getDate() + dayDiff);

    if (nextRun.getTime() <= now.getTime()) {
        nextRun.setDate(nextRun.getDate() + 7);
    }

    return nextRun.toISOString();
}

export function saveReportSchedule(input: unknown): ReportSchedule {
    const existing = getReportSchedule();
    const candidate = (input && typeof input === 'object') ? (input as ReportScheduleInput) : {};

    const enabled = Boolean(candidate.enabled);
    const dayOfWeek = normalizeDayOfWeek(candidate.dayOfWeek);
    const time = normalizeTime(candidate.time);
    const audience = normalizeReportAudience(candidate.audience);

    const nextRunAt = enabled
        ? computeNextRunAt(dayOfWeek, time)
        : null;

    const schedule: ReportSchedule = {
        enabled,
        dayOfWeek,
        time,
        audience,
        lastRunAt: existing.lastRunAt,
        nextRunAt,
    };

    upsertSchedule(schedule);
    return schedule;
}

export function updateReportScheduleRun(lastRunAt: string, nextRunAt: string): ReportSchedule {
    const current = getReportSchedule();
    const schedule: ReportSchedule = {
        ...current,
        enabled: current.enabled,
        lastRunAt,
        nextRunAt,
    };
    upsertSchedule(schedule);
    return schedule;
}

export async function runScheduledStatusReportIfDue(now = new Date()): Promise<ScheduledReportCheckResult> {
    const schedule = getReportSchedule();
    if (!schedule.enabled) {
        return { triggered: false, report: null };
    }

    let nextRun = toDateOrNull(schedule.nextRunAt);
    if (!nextRun) {
        const computedNext = computeNextRunAt(schedule.dayOfWeek, schedule.time, now);
        upsertSchedule({
            ...schedule,
            nextRunAt: computedNext,
        });
        return { triggered: false, report: null };
    }

    if (nextRun.getTime() > now.getTime()) {
        return { triggered: false, report: null };
    }

    const report = await createStatusReport({
        audience: schedule.audience,
        isAuto: true,
    });

    const runAt = new Date();
    const nextRunAt = computeNextRunAt(schedule.dayOfWeek, schedule.time, runAt);
    updateReportScheduleRun(runAt.toISOString(), nextRunAt);

    nextRun = new Date(nextRunAt);
    if (Number.isNaN(nextRun.getTime())) {
        // Keep schedule resilient with default fallback if parsing unexpectedly fails.
        updateReportScheduleRun(runAt.toISOString(), computeNextRunAt(DEFAULT_REPORT_SCHEDULE.dayOfWeek, DEFAULT_REPORT_SCHEDULE.time, runAt));
    }

    return { triggered: true, report };
}
