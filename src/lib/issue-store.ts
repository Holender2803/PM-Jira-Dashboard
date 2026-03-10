import getDb from './db';
import { JiraIssue, DashboardFilters, Sprint } from '@/types';
import { CLOSED_STATUSES } from './workflow';
import { isAtRiskIssue } from './filters';
import { normalizeUtcTimestamp } from './time';
import {
    getResolvedStatusesForGroups,
    isAllWorkflowGroupsSelected,
} from './workflow-groups';

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
        conditions.push(`status IN (${filters.status.map(() => '?').join(',')})`);
        params.push(...filters.status);
    }
    if (filters.groupFilter?.length && !isAllWorkflowGroupsSelected(filters.groupFilter)) {
        const groupedStatuses = getResolvedStatusesForGroups(filters.groupFilter).map((status) =>
            status.toLowerCase()
        );
        if (groupedStatuses.length > 0) {
            conditions.push(`LOWER(status) IN (${groupedStatuses.map(() => '?').join(',')})`);
            params.push(...groupedStatuses);
        }
    }
    if (filters.issueType?.length) {
        conditions.push(`issue_type IN (${filters.issueType.map(() => '?').join(',')})`);
        params.push(...filters.issueType);
    }
    if (filters.assignee?.length) {
        conditions.push(`assignee_id IN (${filters.assignee.map(() => '?').join(',')})`);
        params.push(...filters.assignee);
    }
    if (filters.priority?.length) {
        conditions.push(`priority IN (${filters.priority.map(() => '?').join(',')})`);
        params.push(...filters.priority);
    }
    if (filters.sprintId) {
        conditions.push('sprint_id = ?');
        params.push(filters.sprintId);
    } else if (filters.sprint === 'current') {
        conditions.push("sprint_state = 'active'");
    } else if (filters.sprint === 'previous') {
        conditions.push("sprint_state = 'closed'");
    } else if (filters.sprint) {
        conditions.push('sprint_name = ?');
        params.push(filters.sprint);
    }
    if (filters.blockedOnly) {
        conditions.push("status = 'Blocked'");
    }
    if (filters.bugsOnly) {
        conditions.push("issue_type = 'Bug'");
    }
    if (filters.unresolvedOnly) {
        conditions.push('resolved IS NULL');
    }
    if (filters.dateFrom) {
        conditions.push('created >= ?');
        params.push(
            filters.dateFrom.length === 10
                ? `${filters.dateFrom}T00:00:00.000Z`
                : filters.dateFrom
        );
    }
    if (filters.dateTo) {
        conditions.push('created <= ?');
        params.push(
            filters.dateTo.length === 10
                ? `${filters.dateTo}T23:59:59.999Z`
                : filters.dateTo
        );
    }
    if (filters.project?.length) {
        conditions.push(`project IN (${filters.project.map(() => '?').join(',')})`);
        params.push(...filters.project);
    }
    if (filters.label?.length) {
        conditions.push(
            `(${filters.label.map(() => `labels LIKE '%' || ? || '%'`).join(' OR ')})`
        );
        params.push(...filters.label);
    }
    if (filters.squad?.length) {
        conditions.push(`squad IN (${filters.squad.map(() => '?').join(',')})`);
        params.push(...filters.squad);
    }
    if (filters.epicKey?.length) {
        conditions.push(`epic_key IN (${filters.epicKey.map(() => '?').join(',')})`);
        params.push(...filters.epicKey);
    }
    if (filters.epicPresence === 'with') {
        conditions.push('(epic_key IS NOT NULL OR epic_summary IS NOT NULL)');
    }
    if (filters.epicPresence === 'without') {
        conditions.push('(epic_key IS NULL AND epic_summary IS NULL)');
    }
    if (filters.selectedKeys?.length) {
        conditions.push(`key IN (${filters.selectedKeys.map(() => '?').join(',')})`);
        params.push(...filters.selectedKeys);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT raw_json FROM issues ${where} ORDER BY updated DESC`).all(...params) as { raw_json: string }[];
    const parsed = rows.map((row) => {
        const issue = JSON.parse(row.raw_json) as JiraIssue & { dueDate?: string | null };
        return {
            ...issue,
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
