import getDb from './db';
import { JiraIssue, DashboardFilters, Sprint } from '@/types';
import { CLOSED_STATUSES } from './workflow';
import { isAtRiskIssue } from './filters';
import { normalizeUtcTimestamp } from './time';
import { buildGroupWhereClause } from './analytics';

function normalizeText(value: string | null | undefined): string {
    return (value || '').trim();
}

function isJiraKeyLike(value: string | null | undefined): boolean {
    return /^[A-Z][A-Z0-9]+-\d+$/.test(normalizeText(value));
}

// ─── Save issues to DB ─────────────────────────────────────────────────────────

export function upsertIssues(issues: JiraIssue[]): void {
    const db = getDb();
    const upsert = db.prepare(`
    INSERT INTO issues (
      id, key, summary, description, issue_type, status, priority,
      assignee_id, assignee_name, assignee_email, reporter_id, reporter_name,
      labels, components, parent_key, parent_summary, epic_key, epic_summary,
      sprint_id, sprint_name, sprint_state, sprint_start, sprint_end,
      story_points, created, updated, resolved, comments_count,
      linked_issues, project, work_type, squad, url, changelog, synced_at, raw_json
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?
    )
    ON CONFLICT(id) DO UPDATE SET
      key = excluded.key,
      summary = excluded.summary,
      description = excluded.description,
      issue_type = excluded.issue_type,
      status = excluded.status,
      priority = excluded.priority,
      assignee_id = excluded.assignee_id,
      assignee_name = excluded.assignee_name,
      assignee_email = excluded.assignee_email,
      reporter_id = excluded.reporter_id,
      reporter_name = excluded.reporter_name,
      labels = excluded.labels,
      components = excluded.components,
      parent_key = excluded.parent_key,
      parent_summary = excluded.parent_summary,
      epic_key = excluded.epic_key,
      epic_summary = excluded.epic_summary,
      sprint_id = excluded.sprint_id,
      sprint_name = excluded.sprint_name,
      sprint_state = excluded.sprint_state,
      sprint_start = excluded.sprint_start,
      sprint_end = excluded.sprint_end,
      story_points = excluded.story_points,
      created = excluded.created,
      updated = excluded.updated,
      resolved = excluded.resolved,
      comments_count = excluded.comments_count,
      linked_issues = excluded.linked_issues,
      project = excluded.project,
      work_type = excluded.work_type,
      squad = excluded.squad,
      url = excluded.url,
      changelog = excluded.changelog,
      synced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
      raw_json = excluded.raw_json
  `);
    const upsertEpic = db.prepare(`
    INSERT INTO epics (key, summary, updated_at, source)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      summary = excluded.summary,
      updated_at = excluded.updated_at,
      source = excluded.source
    WHERE epics.updated_at IS NULL OR excluded.updated_at >= epics.updated_at
  `);

    const insertMany = db.transaction((issues: JiraIssue[]) => {
        for (const iss of issues) {
            upsert.run(
                iss.id, iss.key, iss.summary, iss.description, iss.issueType, iss.status, iss.priority,
                iss.assignee?.accountId || null, iss.assignee?.displayName || null, iss.assignee?.emailAddress || null,
                iss.reporter?.accountId || null, iss.reporter?.displayName || null,
                JSON.stringify(iss.labels), JSON.stringify(iss.components),
                iss.parentKey, iss.parentSummary, iss.epicKey, iss.epicSummary,
                iss.sprint?.id || null, iss.sprint?.name || null, iss.sprint?.state || null,
                iss.sprint?.startDate || null, iss.sprint?.endDate || null,
                iss.storyPoints, iss.created, iss.updated, iss.resolved, iss.commentsCount,
                JSON.stringify(iss.linkedIssues), iss.project, iss.workType, iss.squad, iss.url,
                JSON.stringify(iss.changelog), JSON.stringify(iss),
            );

            const issueType = normalizeText(iss.issueType).toLowerCase();
            const issueSummary = normalizeText(iss.summary);
            if (issueType === 'epic' && issueSummary && !isJiraKeyLike(issueSummary)) {
                upsertEpic.run(iss.key, issueSummary, iss.updated, 'epic_issue');
            }

            const epicKey = normalizeText(iss.epicKey);
            const epicSummary = normalizeText(iss.epicSummary);
            if (epicKey && epicSummary && !isJiraKeyLike(epicSummary)) {
                upsertEpic.run(epicKey, epicSummary, iss.updated, 'linked_issue');
            }
        }
    });

    insertMany(issues);
}

// ─── Query issues from DB ─────────────────────────────────────────────────────

export function queryIssues(filters: DashboardFilters = {}): JiraIssue[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    if (filters.status?.length) {
        conditions.push(`i.status IN (${filters.status.map(() => '?').join(',')})`);
        params.push(...filters.status);
    }
    if (filters.groupFilter?.length) {
        const groupWhereClause = buildGroupWhereClause(filters.groupFilter);
        if (groupWhereClause) {
            conditions.push(groupWhereClause.replace(/^AND\s+/, ''));
        }
    }
    if (filters.issueType?.length) {
        conditions.push(`i.issue_type IN (${filters.issueType.map(() => '?').join(',')})`);
        params.push(...filters.issueType);
    }
    if (filters.assignee?.length) {
        conditions.push(`i.assignee_id IN (${filters.assignee.map(() => '?').join(',')})`);
        params.push(...filters.assignee);
    }
    if (filters.priority?.length) {
        conditions.push(`i.priority IN (${filters.priority.map(() => '?').join(',')})`);
        params.push(...filters.priority);
    }
    if (filters.sprintId) {
        conditions.push('i.sprint_id = ?');
        params.push(filters.sprintId);
    } else if (filters.sprint === 'current') {
        conditions.push("i.sprint_state = 'active'");
    } else if (filters.sprint === 'previous') {
        conditions.push("i.sprint_state = 'closed'");
    } else if (filters.sprint) {
        conditions.push('i.sprint_name = ?');
        params.push(filters.sprint);
    }
    if (filters.blockedOnly) {
        conditions.push("i.status = 'Blocked'");
    }
    if (filters.bugsOnly) {
        conditions.push("i.issue_type = 'Bug'");
    }
    if (filters.unresolvedOnly) {
        conditions.push('i.resolved IS NULL');
    }
    if (filters.dateFrom) {
        conditions.push('i.created >= ?');
        params.push(
            filters.dateFrom.length === 10
                ? `${filters.dateFrom}T00:00:00.000Z`
                : filters.dateFrom
        );
    }
    if (filters.dateTo) {
        conditions.push('i.created <= ?');
        params.push(
            filters.dateTo.length === 10
                ? `${filters.dateTo}T23:59:59.999Z`
                : filters.dateTo
        );
    }
    if (filters.project?.length) {
        conditions.push(`i.project IN (${filters.project.map(() => '?').join(',')})`);
        params.push(...filters.project);
    }
    if (filters.label?.length) {
        conditions.push(
            `(${filters.label.map(() => `i.labels LIKE '%' || ? || '%'`).join(' OR ')})`
        );
        params.push(...filters.label);
    }
    if (filters.squad?.length) {
        conditions.push(`i.squad IN (${filters.squad.map(() => '?').join(',')})`);
        params.push(...filters.squad);
    }
    if (filters.epicKey?.length) {
        conditions.push(`i.epic_key IN (${filters.epicKey.map(() => '?').join(',')})`);
        params.push(...filters.epicKey);
    }
    if (filters.epicPresence === 'with') {
        conditions.push('(i.epic_key IS NOT NULL OR i.epic_summary IS NOT NULL)');
    }
    if (filters.epicPresence === 'without') {
        conditions.push('(i.epic_key IS NULL AND i.epic_summary IS NULL)');
    }
    if (filters.selectedKeys?.length) {
        conditions.push(`i.key IN (${filters.selectedKeys.map(() => '?').join(',')})`);
        params.push(...filters.selectedKeys);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`
    SELECT
      i.raw_json as raw_json,
      i.epic_key as epic_key,
      i.epic_summary as epic_summary,
      e.summary as resolved_epic_summary
    FROM issues i
    LEFT JOIN epics e ON i.epic_key = e.key
    ${where}
    ORDER BY i.updated DESC
  `).all(...params) as {
        raw_json: string;
        epic_key: string | null;
        epic_summary: string | null;
        resolved_epic_summary: string | null;
    }[];
    const parsed = rows.map((row) => {
        const issue = JSON.parse(row.raw_json) as JiraIssue & { dueDate?: string | null };
        const currentEpicSummary = normalizeText(issue.epicSummary);
        const resolvedEpicSummary = normalizeText(row.resolved_epic_summary);
        const shouldUseResolvedSummary =
            issue.epicKey &&
            resolvedEpicSummary &&
            (!currentEpicSummary || currentEpicSummary === normalizeText(issue.epicKey) || isJiraKeyLike(currentEpicSummary));

        return {
            ...issue,
            epicSummary: shouldUseResolvedSummary ? resolvedEpicSummary : issue.epicSummary,
            dueDate: issue.dueDate ?? null,
        };
    });

    if (filters.atRiskOnly) {
        return parsed.filter((issue) => isAtRiskIssue(issue));
    }

    return parsed;
}

// ─── Sprint queries ────────────────────────────────────────────────────────────

export function getActiveSprints(): Sprint[] {
    const db = getDb();
    const rows = db.prepare(`
    SELECT DISTINCT sprint_id as id, sprint_name as name, sprint_state as state,
      sprint_start as startDate, sprint_end as endDate
    FROM issues
    WHERE sprint_id IS NOT NULL
    ORDER BY sprint_id DESC
    LIMIT 10
  `).all() as Sprint[];
    return rows;
}

export function getActiveSprintEndDate(): string | null {
    const db = getDb();

    const sprintRow = db.prepare(`
    SELECT end_date as endDate
    FROM sprints
    WHERE state = 'active' AND end_date IS NOT NULL
    ORDER BY end_date DESC
    LIMIT 1
  `).get() as { endDate: string | null } | undefined;

    if (sprintRow?.endDate) return sprintRow.endDate;

    const issueRow = db.prepare(`
    SELECT sprint_end as endDate
    FROM issues
    WHERE sprint_state = 'active' AND sprint_end IS NOT NULL
    ORDER BY sprint_end DESC
    LIMIT 1
  `).get() as { endDate: string | null } | undefined;

    return issueRow?.endDate || null;
}

export function getSprintIssues(sprintId: number): JiraIssue[] {
    return queryIssues({ sprintId });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getStatusCounts(): Record<string, number> {
    const db = getDb();
    const rows = db.prepare('SELECT status, COUNT(*) as count FROM issues GROUP BY status').all() as { status: string; count: number }[];
    return Object.fromEntries(rows.map(r => [r.status, r.count]));
}

export function getTotalIssues(): number {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as c FROM issues').get() as { c: number };
    return row.c;
}

export function getLastSyncedAt(): string | null {
    const db = getDb();
    const row = db.prepare('SELECT MAX(synced_at) as t FROM issues').get() as { t: string | null };
    return normalizeUtcTimestamp(row.t);
}

export function getIssueByKey(key: string): JiraIssue | null {
    const db = getDb();
    const row = db.prepare('SELECT raw_json FROM issues WHERE key = ?').get(key) as { raw_json: string } | undefined;
    if (!row) return null;
    const issue = JSON.parse(row.raw_json) as JiraIssue & { dueDate?: string | null };
    return {
        ...issue,
        dueDate: issue.dueDate ?? null,
    };
}

export { CLOSED_STATUSES };
