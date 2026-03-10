'use client';

import { CSSProperties, ReactNode, useMemo, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { JiraIssue } from '@/types';
import IssueDrawer from './IssueDrawer';

interface IssueKeyButtonProps {
    issue?: JiraIssue | null;
    issueKey?: string | null;
    jiraUrl?: string | null;
    children?: ReactNode;
    className?: string;
    style?: CSSProperties;
    title?: string;
    stopPropagation?: boolean;
}

export default function IssueKeyButton({
    issue = null,
    issueKey = null,
    jiraUrl = null,
    children,
    className = 'btn btn-ghost btn-sm',
    style,
    title,
    stopPropagation = true,
}: IssueKeyButtonProps) {
    const issues = useAppStore((state) => state.issues);
    const [drawerIssue, setDrawerIssue] = useState<JiraIssue | null>(null);

    const resolvedIssue = useMemo(() => {
        if (issue) return issue;
        if (!issueKey) return null;
        return issues.find((candidate) => candidate.key === issueKey) || null;
    }, [issue, issueKey, issues]);

    const label = children || resolvedIssue?.key || issueKey || '—';
    const keyLabel = resolvedIssue?.key || issueKey || '';

    if (!resolvedIssue) {
        if (jiraUrl) {
            return (
                <a
                    href={jiraUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                    style={style}
                    title={title || `Open ${keyLabel} in Jira`}
                >
                    {label}
                </a>
            );
        }
        return (
            <span className={className} style={style}>
                {label}
            </span>
        );
    }

    return (
        <>
            <button
                type="button"
                className={className}
                style={style}
                title={title || `Open ${resolvedIssue.key} details`}
                onClick={(event) => {
                    if (stopPropagation) event.stopPropagation();
                    setDrawerIssue(resolvedIssue);
                }}
            >
                {label}
            </button>
            {drawerIssue && (
                <IssueDrawer issue={drawerIssue} onClose={() => setDrawerIssue(null)} />
            )}
        </>
    );
}
