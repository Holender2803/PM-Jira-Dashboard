import { JiraIssue, Sprint, ChangelogEntry, JiraUser } from '@/types';
import { computeIssueMetrics, WORKFLOW_STAGES } from './workflow';
import { enrichIssuesWithEpicSummaries } from './issue-format';

const DEFAULT_JQL = `(project = Engineering AND "Team/Squad[Select List (cascading)]" IN ("MDFM", "Legacy MDFM") and "Team/Squad[Select List (cascading)]" not IN ("Backoffice/OBT") AND worktype != Initiative and "Team[Team]" in (5d9f2497-c05d-466c-aac5-e05183bb3c2c-cfc65711, f5437b0c-2973-42f7-896c-2e34bcc829df)) or (project != Engineering and "Team[Team]" in (5d9f2497-c05d-466c-aac5-e05183bb3c2c-cfc65711, f5437b0c-2973-42f7-896c-2e34bcc829df)) ORDER BY status DESC, Rank ASC`;

interface JiraClientConfig {
    baseUrl: string;
    email: string;
    apiToken: string;
    jql?: string;
}

function makeAuthHeader(email: string, apiToken: string): string {
    return 'Basic ' + Buffer.from(`${email}:${apiToken}`).toString('base64');
}

async function jiraFetch(
    config: JiraClientConfig,
    path: string,
    options?: {
        method?: 'GET' | 'POST';
        params?: Record<string, string | string[] | undefined>;
        body?: unknown;
    }
) {
    const method = options?.method || 'GET';
    const url = new URL(`${config.baseUrl}/rest/api/3${path}`);
    if (options?.params) {
        Object.entries(options.params).forEach(([k, v]) => {
            if (v === undefined) return;
            if (Array.isArray(v)) {
                for (const item of v) url.searchParams.append(k, item);
            } else {
                url.searchParams.set(k, v);
            }
        });
    }
    const res = await fetch(url.toString(), {
        method,
        headers: {
            Authorization: makeAuthHeader(config.email, config.apiToken),
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        cache: 'no-store',
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Jira API error ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
}

async function hydrateMissingEpicSummaries(
    config: JiraClientConfig,
    issues: JiraIssue[]
): Promise<JiraIssue[]> {
    const keysNeedingSummary = new Set<string>();

    for (const issue of issues) {
        if (!issue.epicKey) continue;
        if (!issue.epicSummary || issue.epicSummary === issue.epicKey) {
            keysNeedingSummary.add(issue.epicKey);
        }
    }

    if (keysNeedingSummary.size === 0) return issues;

    const summaryByKey = new Map<string, string>();
    const batches: string[][] = [];
    const keys = [...keysNeedingSummary];
    for (let i = 0; i < keys.length; i += 50) {
        batches.push(keys.slice(i, i + 50));
    }

    for (const batch of batches) {
        const jql = `key in (${batch.map((key) => `"${key}"`).join(', ')})`;
        try {
            const data = await jiraFetch(config, '/search/jql', {
                method: 'GET',
                params: {
                    jql,
                    fields: ['summary'],
                    maxResults: String(batch.length),
                },
            });
            const matched = Array.isArray(data.issues) ? data.issues : [];
            for (const raw of matched) {
                const key = typeof raw.key === 'string' ? raw.key : '';
                const summary =
                    raw.fields && typeof raw.fields.summary === 'string'
                        ? raw.fields.summary
                        : '';
                if (key && summary) summaryByKey.set(key, summary);
            }
        } catch {
            // Non-fatal: we still return the original issues if enrichment fails.
        }
    }

    if (summaryByKey.size === 0) return issues;

    let changed = false;
    const enriched = issues.map((issue) => {
        if (!issue.epicKey) return issue;
        const mapped = summaryByKey.get(issue.epicKey);
        if (!mapped) return issue;
        if (issue.epicSummary && issue.epicSummary !== issue.epicKey) return issue;
        changed = true;
        return {
            ...issue,
            epicSummary: mapped,
        };
    });

    return changed ? enriched : issues;
}

// ─── Parse raw Jira issue into our normalized format ─────────────────────────

function parseUser(user: Record<string, unknown> | null): JiraUser | null {
    if (!user) return null;
    return {
        accountId: user.accountId as string,
        displayName: user.displayName as string,
        emailAddress: user.emailAddress as string | undefined,
        avatarUrl: user.avatarUrls
            ? (user.avatarUrls as Record<string, string>)['48x48']
            : undefined,
    };
}

function parseChangelog(changelog: Record<string, unknown>[]): ChangelogEntry[] {
    if (!changelog) return [];
    const entries: ChangelogEntry[] = [];
    for (const hist of changelog) {
        const items = hist.items as Record<string, unknown>[];
        for (const item of items) {
            entries.push({
                id: hist.id as string,
                created: hist.created as string,
                author: parseUser(hist.author as Record<string, unknown>) || { accountId: '', displayName: 'System' },
                field: item.field as string,
                fromString: item['fromString'] as string | null,
                toString: item['toString'] as string | null,
            });
        }
    }
    return entries;
}

function parseSprint(sprintField: unknown): Sprint | null {
    if (!sprintField) return null;
    const sprints = Array.isArray(sprintField) ? sprintField : [sprintField];
    const active = sprints.find((s: Record<string, unknown>) => s.state === 'active') || sprints[sprints.length - 1];
    if (!active) return null;
    return {
        id: active.id,
        name: active.name,
        state: active.state,
        startDate: active.startDate,
        endDate: active.endDate,
        completeDate: active.completeDate,
        goal: active.goal,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseIssue(raw: any, baseUrl: string): JiraIssue {
    const fields = raw.fields;
    const changelog = parseChangelog(raw.changelog?.histories || []);

    const status = fields.status?.name || 'Unknown';
    const issueType = fields.issuetype?.name || 'Task';
    const sprint = parseSprint(
        fields['customfield_10020'] || fields['sprint'] || null
    );
    const storyPoints =
        fields['customfield_10016'] ||
        fields['customfield_10028'] ||
        fields['story_points'] ||
        null;

    const squad =
        fields['customfield_10023']?.child?.value ||
        fields['customfield_10023']?.value ||
        null;

    const workType =
        fields['customfield_10087']?.value ||
        fields['worktype']?.value ||
        null;

    const epicKey = fields.epic?.key || fields['customfield_10014'] || null;
    const epicSummary =
        fields.epic?.fields?.summary ||
        fields['customfield_10011'] ||
        null;

    const metrics = computeIssueMetrics({
        created: fields.created,
        status,
        resolved: fields.resolutiondate || null,
        changelog,
    });

    return {
        id: raw.id,
        key: raw.key,
        summary: fields.summary || '',
        description: fields.description
            ? typeof fields.description === 'string'
                ? fields.description
                : JSON.stringify(fields.description)
            : null,
        issueType,
        status,
        priority: fields.priority?.name || null,
        assignee: parseUser(fields.assignee),
        reporter: parseUser(fields.reporter),
        labels: fields.labels || [],
        components: (fields.components || []).map((c: { name: string }) => c.name),
        parentKey: fields.parent?.key || null,
        parentSummary: fields.parent?.fields?.summary || null,
        epicKey,
        epicSummary,
        sprint,
        storyPoints: storyPoints ? Number(storyPoints) : null,
        created: fields.created,
        updated: fields.updated,
        resolved: fields.resolutiondate || null,
        dueDate: fields.duedate || null,
        changelog,
        commentsCount: fields.comment?.total || 0,
        linkedIssues: (fields.issuelinks || []).map((l: { inwardIssue?: { key: string }; outwardIssue?: { key: string } }) =>
            l.inwardIssue?.key || l.outwardIssue?.key || ''
        ).filter(Boolean),
        project: fields.project?.key || '',
        workType,
        squad,
        url: `${baseUrl}/browse/${raw.key}`,
        ...metrics,
        workflowStage: WORKFLOW_STAGES[status as keyof typeof WORKFLOW_STAGES] || 'intake',
    };
}

// ─── Fetch all issues with pagination ────────────────────────────────────────

export async function fetchAllIssues(
    config: JiraClientConfig,
    onProgress?: (fetched: number, total: number) => void
): Promise<JiraIssue[]> {
    const jql = config.jql || DEFAULT_JQL;
    const fields = [
        'summary', 'description', 'status', 'issuetype', 'priority',
        'assignee', 'reporter', 'labels', 'components', 'parent',
        'customfield_10011', 'customfield_10014', 'customfield_10016', 'customfield_10020',
        'customfield_10023', 'customfield_10028', 'customfield_10087',
        'sprint', 'story_points', 'created', 'updated', 'resolutiondate', 'duedate',
        'comment', 'issuelinks', 'project', 'epic', 'worktype',
    ];
    const expand = ['changelog'];
    const maxResults = 100;
    let nextPageToken: string | undefined;
    const seenTokens = new Set<string>();
    const seenIssueIds = new Set<string>();
    let total = 0;
    const allIssues: JiraIssue[] = [];

    // Jira Cloud removed /rest/api/3/search. Use enhanced search API.
    for (let page = 0; page < 1000; page++) {
        const params: Record<string, string | string[] | undefined> = {
            jql,
            fields,
            expand,
            maxResults: String(maxResults),
            nextPageToken,
        };

        let data;
        try {
            data = await jiraFetch(config, '/search/jql', {
                method: 'GET',
                params,
            });
        } catch (error) {
            const message = String(error);
            if (!message.includes('Jira API error 400')) throw error;

            // Retry with a minimal parameter set for Jira instances that reject
            // optional enhanced-search params.
            data = await jiraFetch(config, '/search/jql', {
                method: 'GET',
                params: {
                    jql,
                    maxResults: String(maxResults),
                    nextPageToken,
                },
            });
        }

        const issues = Array.isArray(data.issues) ? data.issues : [];
        let addedThisPage = 0;

        for (const raw of issues) {
            const issueId = String(raw.id || raw.key || '');
            if (issueId && seenIssueIds.has(issueId)) continue;
            if (issueId) seenIssueIds.add(issueId);
            allIssues.push(parseIssue(raw, config.baseUrl));
            addedThisPage += 1;
        }

        if (typeof data.total === 'number') {
            total = data.total;
        } else {
            total = Math.max(total, allIssues.length);
        }

        onProgress?.(allIssues.length, Math.max(total, allIssues.length));

        const responseToken =
            typeof data.nextPageToken === 'string' && data.nextPageToken.length > 0
                ? data.nextPageToken
                : undefined;
        const isLast = data.isLast === true || !responseToken || issues.length === 0;

        if (isLast || addedThisPage === 0) break;

        if (responseToken && seenTokens.has(responseToken)) break;
        if (responseToken) seenTokens.add(responseToken);
        nextPageToken = responseToken;
    }

    const withHydratedEpics = await hydrateMissingEpicSummaries(config, allIssues);
    return enrichIssuesWithEpicSummaries(withHydratedEpics);
}

// ─── Fetch single issue ───────────────────────────────────────────────────────

export async function fetchIssue(config: JiraClientConfig, key: string): Promise<JiraIssue> {
    const data = await jiraFetch(config, `/issue/${key}`, {
        params: {
            fields: '*all',
            expand: 'changelog',
        },
    });
    return enrichIssuesWithEpicSummaries([parseIssue(data, config.baseUrl)])[0];
}

// ─── Test connection ──────────────────────────────────────────────────────────

export async function testConnection(config: JiraClientConfig): Promise<{ ok: boolean; user?: string; error?: string }> {
    try {
        const data = await jiraFetch(config, '/myself');
        return { ok: true, user: data.displayName };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}

export { DEFAULT_JQL };
