import getDb from '@/lib/db';

export const APP_CONFIG_KEYS = {
    syncBriefingUnread: 'sync_briefing_unread',
} as const;

export function getAppConfigValue(key: string): string | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT value
      FROM app_config
      WHERE key = ?
      LIMIT 1
    `).get(key) as { value: string | null } | undefined;

    return row?.value ?? null;
}

export function setAppConfigValue(key: string, value: string): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO app_config (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
}

export function getAppConfigBoolean(key: string): boolean {
    const value = getAppConfigValue(key);
    return value === '1' || value === 'true';
}

export function setAppConfigBoolean(key: string, enabled: boolean): void {
    setAppConfigValue(key, enabled ? '1' : '0');
}
