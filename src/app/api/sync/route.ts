import { NextResponse } from 'next/server';
import { fetchAllIssues, testConnection, DEFAULT_JQL } from '@/lib/jira-client';
import { refreshAllDocScores, upsertIssues } from '@/lib/issue-store';
import getDb from '@/lib/db';
import { runScheduledStatusReportIfDue } from '@/lib/report-schedule';
import { getGroupForStatus } from '@/lib/statusGroups';
import { APP_CONFIG_KEYS, setAppConfigBoolean } from '@/lib/app-config';
import { POST as generateAIReport } from '@/app/api/ai/report/route';

interface IssueSnapshot {
    key: string;
    status: string | null;
}

interface SyncStatusChange {
    key: string;
    from: string;
    to: string;
}

interface SyncDiffRecord {
    id: string;
    syncedAt: string;
    sprintName: string | null;
    newlyBlocked: string[];
    newlyResolved: string[];
    statusChanges: SyncStatusChange[];
    newTickets: string[];
    removedFromSprint: string[];
}

function makeSyncDiffId(): string {
    const now = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    return `sync-diff-${now}-${random}`;
}

function normalizeStatus(value: string | null | undefined): string {
    return (value || '').trim();
}

function isBlockedStatus(status: string | null | undefined): boolean {
    const normalized = normalizeStatus(status);
    if (!normalized) return false;
    return getGroupForStatus(normalized) === 'Blocked/Hold';
}

function isResolvedStatus(status: string | null | undefined): boolean {
    const normalized = normalizeStatus(status);
    if (!normalized) return false;
    return getGroupForStatus(normalized) === 'Done';
}

function toSortedValues(values: Iterable<string>): string[] {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function getIssueSnapshotsByKey(db: ReturnType<typeof getDb>): Map<string, IssueSnapshot> {
    const rows = db.prepare(`
      SELECT key, status
      FROM issues
    `).all() as { key: string; status: string | null }[];

    return new Map(rows.map((row) => [row.key, { key: row.key, status: row.status }]));
}

function getActiveSprintKeys(db: ReturnType<typeof getDb>): Set<string> {
    const rows = db.prepare(`
      SELECT key
      FROM issues
      WHERE sprint_state = 'active'
    `).all() as { key: string }[];

    return new Set(rows.map((row) => row.key));
}

function getCurrentSprintName(db: ReturnType<typeof getDb>): string | null {
    const row = db.prepare(`
      SELECT sprint_name AS sprintName
      FROM issues
      WHERE sprint_state = 'active'
        AND sprint_name IS NOT NULL
        AND TRIM(sprint_name) <> ''
      ORDER BY updated DESC
      LIMIT 1
    `).get() as { sprintName: string | null } | undefined;

    return row?.sprintName || null;
}

function buildSyncDiffPromptSummary(diff: SyncDiffRecord): string {
    const statusChangeLines = diff.statusChanges.length > 0
        ? diff.statusChanges.map((change) => `${change.key}: ${change.from} -> ${change.to}`).join('\n')
        : 'None';

    const formatList = (values: string[]) => (values.length > 0 ? values.join(', ') : 'None');

    return [
        'Sync diff summary (computed fields only):',
        `Synced at: ${diff.syncedAt}`,
        `Sprint: ${diff.sprintName || 'No active sprint detected'}`,
        `Newly blocked (${diff.newlyBlocked.length}): ${formatList(diff.newlyBlocked)}`,
        `Newly resolved (${diff.newlyResolved.length}): ${formatList(diff.newlyResolved)}`,
        `New tickets (${diff.newTickets.length}): ${formatList(diff.newTickets)}`,
        `Removed from active sprint (${diff.removedFromSprint.length}): ${formatList(diff.removedFromSprint)}`,
        `Status changes (${diff.statusChanges.length}):`,
        statusChangeLines,
    ].join('\n');
}

async function generateSyncBriefing(request: Request, diff: SyncDiffRecord): Promise<{ generated: boolean; id?: string; error?: string; }> {
    try {
        const aiRequest = new Request(new URL('/api/ai/report', request.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'sync_briefing',
                tone: 'pm_internal',
                issueKeys: [],
                sprintName: diff.sprintName || undefined,
                customInstructions: buildSyncDiffPromptSummary(diff),
            }),
        });

        const response = await generateAIReport(aiRequest);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.error || `Failed to generate sync briefing (${response.status})`);
        }

        setAppConfigBoolean(APP_CONFIG_KEYS.syncBriefingUnread, true);
        return {
            generated: true,
            id: typeof payload?.id === 'string' ? payload.id : undefined,
        };
    } catch (error) {
        return {
            generated: false,
            error: String(error),
        };
    }
}

function formatJqlDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function appendJqlClause(baseJql: string, clause: string): string {
    const orderByMatch = baseJql.match(/\border\s+by\b/i);
    if (!orderByMatch || orderByMatch.index === undefined) {
        return `(${baseJql}) AND (${clause})`;
    }

    const idx = orderByMatch.index;
    const beforeOrder = baseJql.slice(0, idx).trim();
    const orderBy = baseJql.slice(idx).trim();
    return `(${beforeOrder}) AND (${clause}) ${orderBy}`;
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const {
            baseUrl = process.env.JIRA_BASE_URL,
            email = process.env.JIRA_USER_EMAIL,
            apiToken = process.env.JIRA_API_TOKEN,
            jql = process.env.JIRA_JQL || DEFAULT_JQL,
            incremental = true,
            testOnly = false,
            dateFrom,
            dateTo,
        } = body || {};

        if (!baseUrl || !email || !apiToken) {
            return NextResponse.json(
                { error: 'Missing Jira credentials. Please configure Settings.' },
                { status: 400 }
            );
        }

        if (testOnly) {
            const result = await testConnection({ baseUrl, email, apiToken });
            if (!result.ok) {
                return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
            }
            return NextResponse.json({ ok: true, user: result.user });
        }

        const db = getDb();
        let effectiveJql = jql;

        if (dateFrom) {
            effectiveJql = appendJqlClause(
                effectiveJql,
                `created >= "${dateFrom}"`
            );
        }
        if (dateTo) {
            effectiveJql = appendJqlClause(
                effectiveJql,
                `created <= "${dateTo}"`
            );
        }

        if (incremental) {
            const row = db.prepare('SELECT MAX(updated) as lastUpdated FROM issues').get() as { lastUpdated: string | null };
            if (row.lastUpdated) {
                const lastUpdated = new Date(row.lastUpdated);
                const from = new Date(lastUpdated.getTime() - 6 * 60 * 60 * 1000);
                effectiveJql = appendJqlClause(
                    effectiveJql,
                    `updated >= "${formatJqlDate(from)}" OR sprint in openSprints()`
                );
            }
        }

        const syncId = db.prepare(
            `INSERT INTO sync_log (started_at, status) VALUES (datetime('now'), 'running')`
        ).run().lastInsertRowid;

        let synced = 0;
        let totalFound = 0;

        try {
            const issues = await fetchAllIssues(
                { baseUrl, email, apiToken, jql: effectiveJql },
                (fetched, total) => {
                    synced = fetched;
                    totalFound = total;
                }
            );

            const previousSnapshotByKey = getIssueSnapshotsByKey(db);
            const activeSprintKeysBefore = getActiveSprintKeys(db);

            upsertIssues(issues);
            // Keep cached doc readiness fields current for all rows, including untouched
            // issues during incremental sync runs.
            refreshAllDocScores();
            synced = issues.length;

            const activeSprintKeysAfter = getActiveSprintKeys(db);
            const statusChanges: SyncStatusChange[] = [];
            const newlyBlocked = new Set<string>();
            const newlyResolved = new Set<string>();
            const newTickets = new Set<string>();

            for (const issue of issues) {
                const previous = previousSnapshotByKey.get(issue.key);
                const currentStatus = normalizeStatus(issue.status);
                if (!previous) {
                    newTickets.add(issue.key);
                    continue;
                }

                const previousStatus = normalizeStatus(previous.status);
                if (previousStatus !== currentStatus) {
                    statusChanges.push({
                        key: issue.key,
                        from: previousStatus || 'Unknown',
                        to: currentStatus || 'Unknown',
                    });

                    if (!isBlockedStatus(previousStatus) && isBlockedStatus(currentStatus)) {
                        newlyBlocked.add(issue.key);
                    }

                    if (!isResolvedStatus(previousStatus) && isResolvedStatus(currentStatus)) {
                        newlyResolved.add(issue.key);
                    }
                }
            }

            const removedFromSprint = [...activeSprintKeysBefore]
                .filter((key) => !activeSprintKeysAfter.has(key))
                .sort((a, b) => a.localeCompare(b));

            const syncedAt = new Date().toISOString();
            const syncDiff: SyncDiffRecord = {
                id: makeSyncDiffId(),
                syncedAt,
                sprintName: getCurrentSprintName(db),
                newlyBlocked: toSortedValues(newlyBlocked),
                newlyResolved: toSortedValues(newlyResolved),
                statusChanges: statusChanges.sort((a, b) => a.key.localeCompare(b.key)),
                newTickets: toSortedValues(newTickets),
                removedFromSprint,
            };

            db.prepare(`
              INSERT INTO sync_diffs (
                id, synced_at, newly_blocked, newly_resolved, status_changes, new_tickets, removed_from_sprint, sprint_name
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                syncDiff.id,
                syncDiff.syncedAt,
                JSON.stringify(syncDiff.newlyBlocked),
                JSON.stringify(syncDiff.newlyResolved),
                JSON.stringify(syncDiff.statusChanges),
                JSON.stringify(syncDiff.newTickets),
                JSON.stringify(syncDiff.removedFromSprint),
                syncDiff.sprintName
            );

            db.prepare(
                `UPDATE sync_log SET completed_at = datetime('now'), issues_synced = ?, status = 'done' WHERE id = ?`
            ).run(synced, syncId);

            const syncBriefing = await generateSyncBriefing(request, syncDiff);

            let scheduledReport: {
                triggered: boolean;
                id?: string;
                audience?: string;
                error?: string;
            } | null = null;

            try {
                const scheduledResult = await runScheduledStatusReportIfDue();
                if (scheduledResult.triggered && scheduledResult.report) {
                    scheduledReport = {
                        triggered: true,
                        id: scheduledResult.report.id,
                        audience: scheduledResult.report.audience,
                    };
                } else {
                    scheduledReport = { triggered: false };
                }
            } catch (scheduleError) {
                scheduledReport = {
                    triggered: false,
                    error: String(scheduleError),
                };
            }

            return NextResponse.json({
                ok: true,
                synced,
                total: totalFound,
                incremental: Boolean(incremental),
                completedAt: new Date().toISOString(),
                syncDiff: {
                    id: syncDiff.id,
                    sprintName: syncDiff.sprintName,
                    newlyBlocked: syncDiff.newlyBlocked.length,
                    newlyResolved: syncDiff.newlyResolved.length,
                    statusChanges: syncDiff.statusChanges.length,
                    newTickets: syncDiff.newTickets.length,
                    removedFromSprint: syncDiff.removedFromSprint.length,
                },
                syncBriefing,
                scheduledReport,
            });
        } catch (fetchError) {
            db.prepare(
                `UPDATE sync_log SET completed_at = datetime('now'), status = 'error', error = ? WHERE id = ?`
            ).run(String(fetchError), syncId);
            throw fetchError;
        }
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function GET() {
    const baseUrl = process.env.JIRA_BASE_URL;
    const email = process.env.JIRA_USER_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;

    if (!baseUrl || !email || !apiToken) {
        return NextResponse.json({ ok: false, configured: false });
    }

    const result = await testConnection({ baseUrl, email, apiToken });
    return NextResponse.json({ ...result, configured: true });
}
