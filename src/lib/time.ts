const SQLITE_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const ISO_NO_ZONE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
const HAS_TZ_RE = /(Z|[+-]\d{2}:\d{2})$/;

export const DISPLAY_TIME_ZONE =
    process.env.NEXT_PUBLIC_DISPLAY_TIME_ZONE || 'America/Toronto';

export function normalizeUtcTimestamp(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (HAS_TZ_RE.test(trimmed)) return trimmed;
    if (SQLITE_DATETIME_RE.test(trimmed)) return `${trimmed.replace(' ', 'T')}Z`;
    if (ISO_NO_ZONE_RE.test(trimmed)) return `${trimmed}Z`;
    return trimmed;
}

export function parseTimestamp(value: string | null | undefined): Date | null {
    const normalized = normalizeUtcTimestamp(value);
    if (!normalized) return null;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimeForDisplay(
    value: string | null | undefined,
    options?: { includeZone?: boolean; timeZone?: string }
): string {
    const date = parseTimestamp(value);
    if (!date) return '--';
    const timeZone = options?.timeZone || DISPLAY_TIME_ZONE;
    return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        ...(options?.includeZone ? { timeZoneName: 'short' as const } : {}),
        timeZone,
    }).format(date);
}
