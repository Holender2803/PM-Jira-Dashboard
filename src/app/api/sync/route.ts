import { NextResponse } from 'next/server';
import { fetchAllIssues, testConnection, DEFAULT_JQL } from '@/lib/jira-client';
import { upsertIssues } from '@/lib/issue-store';
import getDb from '@/lib/db';

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
                    `updated >= "${formatJqlDate(from)}"`
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

            upsertIssues(issues);
            synced = issues.length;

            db.prepare(
                `UPDATE sync_log SET completed_at = datetime('now'), issues_synced = ?, status = 'done' WHERE id = ?`
            ).run(synced, syncId);

            return NextResponse.json({
                ok: true,
                synced,
                total: totalFound,
                incremental: Boolean(incremental),
                completedAt: new Date().toISOString(),
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
