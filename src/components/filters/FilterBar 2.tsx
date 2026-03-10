/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import { useEffect, useState } from 'react';
import { endOfWeek, format, parseISO, startOfWeek, differenceInCalendarDays } from 'date-fns';
import { useAppStore } from '@/store/app-store';
import { DashboardFilters, IssueStatus, IssueType, Priority } from '@/types';
import { ALL_STATUSES } from '@/lib/workflow';
import { X, Filter } from 'lucide-react';

const TYPES: IssueType[] = ['Bug', 'Story', 'Task', 'Feature', 'Technical Task', 'Spike', 'Developer Request', 'Support', 'Chore'];
const PRIORITIES: Priority[] = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

interface FilterBarProps {
    showSprintFilter?: boolean;
}

export default function FilterBar({ showSprintFilter = true }: FilterBarProps) {
    const { filters, setFilters, resetFilters, issues, selectedKeys } = useAppStore();

    const assignees = Array.from(
        new Map(
            issues
                .filter((issue) => issue.assignee)
                .map((issue) => [issue.assignee!.accountId, issue.assignee!])
        ).values()
    );

    const sprints = Array.from(
        new Map(
            issues
                .filter((issue) => issue.sprint)
                .map((issue) => [issue.sprint!.id, issue.sprint!])
        ).values()
    ).sort((a, b) => (b.id || 0) - (a.id || 0));

    const activeSprint = sprints.find((sprint) => sprint.state === 'active');
    const activeSprintStart = activeSprint?.startDate ? parseISO(activeSprint.startDate) : null;
    const activeSprintEnd = activeSprint?.endDate ? parseISO(activeSprint.endDate) : null;
    const activeSprintDuration =
        activeSprintStart && activeSprintEnd
            ? differenceInCalendarDays(activeSprintEnd, activeSprintStart) + 1
            : null;

    const projects = [...new Set(issues.map((issue) => issue.project).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const squads = [...new Set(issues.map((issue) => issue.squad).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));

    const epics = Array.from(
        new Map(
            issues
                .filter((issue) => issue.epicKey)
                .map((issue) => [
                    issue.epicKey!,
                    {
                        key: issue.epicKey!,
                        summary: issue.epicSummary || issue.epicKey!,
                        label: `${issue.epicKey!} — ${issue.epicSummary || issue.epicKey!}`,
                    },
                ])
        ).values()
    ).sort((a, b) => a.label.localeCompare(b.label));

    const labels = [...new Set(issues.flatMap((issue) => issue.labels))]
        .sort((a, b) => a.localeCompare(b));

    const [epicSearch, setEpicSearch] = useState('');
    const [labelSearch, setLabelSearch] = useState('');

    useEffect(() => {
        const selectedEpicKey = filters.epicKey?.[0];
        if (!selectedEpicKey) {
            setEpicSearch('');
            return;
        }
        const selectedEpic = epics.find((epic) => epic.key === selectedEpicKey);
        setEpicSearch(selectedEpic?.label || selectedEpicKey);
    }, [epics, filters.epicKey]);

    useEffect(() => {
        setLabelSearch(filters.label?.[0] || '');
    }, [filters.label]);

    const hasFilters = Object.keys(filters).some((key) => {
        const value = filters[key as keyof DashboardFilters];
        return value !== undefined && value !== false && (Array.isArray(value) ? value.length > 0 : true);
    });

    const applyCurrentWeek = () => {
        const start = startOfWeek(new Date(), { weekStartsOn: 1 });
        const end = endOfWeek(new Date(), { weekStartsOn: 1 });
        setFilters({
            dateFrom: format(start, 'yyyy-MM-dd'),
            dateTo: format(end, 'yyyy-MM-dd'),
        });
    };

    const applyActiveSprintRange = () => {
        if (!activeSprintStart || !activeSprintEnd) return;
        setFilters({
            sprint: 'current',
            dateFrom: format(activeSprintStart, 'yyyy-MM-dd'),
            dateTo: format(activeSprintEnd, 'yyyy-MM-dd'),
        });
    };

    const onEpicSearchChange = (value: string) => {
        setEpicSearch(value);
        if (!value.trim()) {
            setFilters({ epicKey: undefined });
            return;
        }

        const normalized = value.trim().toLowerCase();
        const exactMatch = epics.find(
            (epic) => epic.key.toLowerCase() === normalized || epic.label.toLowerCase() === normalized
        );
        if (exactMatch) {
            setFilters({ epicKey: [exactMatch.key] });
        }
    };

    const onEpicSearchBlur = () => {
        if (!epicSearch.trim()) {
            setFilters({ epicKey: undefined });
            return;
        }
        const normalized = epicSearch.trim().toLowerCase();
        const match = epics.find(
            (epic) => epic.key.toLowerCase().includes(normalized) || epic.label.toLowerCase().includes(normalized)
        );
        if (match) {
            setEpicSearch(match.label);
            setFilters({ epicKey: [match.key] });
        } else {
            setFilters({ epicKey: undefined });
        }
    };

    const onLabelSearchChange = (value: string) => {
        setLabelSearch(value);
        if (!value.trim()) {
            setFilters({ label: undefined });
            return;
        }

        const exactMatch = labels.find((label) => label.toLowerCase() === value.trim().toLowerCase());
        if (exactMatch) {
            setFilters({ label: [exactMatch] });
        }
    };

    const onLabelSearchBlur = () => {
        if (!labelSearch.trim()) {
            setFilters({ label: undefined });
            return;
        }
        const normalized = labelSearch.trim().toLowerCase();
        const match = labels.find((label) => label.toLowerCase().includes(normalized));
        if (match) {
            setLabelSearch(match);
            setFilters({ label: [match] });
        } else {
            setFilters({ label: undefined });
        }
    };

    return (
        <div className="filter-bar">
            <Filter size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

            {showSprintFilter && (
                <select
                    className="input"
                    style={{ width: 190 }}
                    value={filters.sprint || ''}
                    onChange={(event) => setFilters({ sprint: event.target.value || undefined })}
                >
                    <option value="">All Sprints</option>
                    <option value="current">Current Sprint</option>
                    <option value="previous">Previous Sprint</option>
                    {sprints.map((sprint) => (
                        <option key={sprint.id} value={sprint.name}>{sprint.name}</option>
                    ))}
                </select>
            )}

            <select
                className="input"
                style={{ width: 160 }}
                value={filters.status?.[0] || ''}
                onChange={(event) => setFilters({ status: event.target.value ? [event.target.value as IssueStatus] : undefined })}
            >
                <option value="">All Statuses</option>
                {ALL_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                ))}
            </select>

            <select
                className="input"
                style={{ width: 160 }}
                value={filters.issueType?.[0] || ''}
                onChange={(event) => setFilters({ issueType: event.target.value ? [event.target.value as IssueType] : undefined })}
            >
                <option value="">All Types</option>
                {TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                ))}
            </select>

            <select
                className="input"
                style={{ width: 160 }}
                value={filters.assignee?.[0] || ''}
                onChange={(event) => setFilters({ assignee: event.target.value ? [event.target.value] : undefined })}
            >
                <option value="">All Assignees</option>
                {assignees.map((assignee) => (
                    <option key={assignee.accountId} value={assignee.accountId}>{assignee.displayName}</option>
                ))}
            </select>

            <select
                className="input"
                style={{ width: 130 }}
                value={filters.priority?.[0] || ''}
                onChange={(event) => setFilters({ priority: event.target.value ? [event.target.value as Priority] : undefined })}
            >
                <option value="">All Priorities</option>
                {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                ))}
            </select>

            <select
                className="input"
                style={{ width: 150 }}
                value={filters.project?.[0] || ''}
                onChange={(event) => setFilters({ project: event.target.value ? [event.target.value] : undefined })}
            >
                <option value="">All Projects</option>
                {projects.map((project) => (
                    <option key={project} value={project}>{project}</option>
                ))}
            </select>

            <select
                className="input"
                style={{ width: 150 }}
                value={filters.squad?.[0] || ''}
                onChange={(event) => setFilters({ squad: event.target.value ? [event.target.value] : undefined })}
            >
                <option value="">All Squads</option>
                {squads.map((squad) => (
                    <option key={squad} value={squad}>{squad}</option>
                ))}
            </select>

            <input
                list="epic-search-list"
                className="input"
                style={{ width: 230 }}
                placeholder="Search epic (key or summary)"
                value={epicSearch}
                onChange={(event) => onEpicSearchChange(event.target.value)}
                onBlur={onEpicSearchBlur}
            />
            <datalist id="epic-search-list">
                {epics.map((epic) => (
                    <option key={epic.key} value={epic.label} />
                ))}
            </datalist>

            <input
                list="label-search-list"
                className="input"
                style={{ width: 200 }}
                placeholder="Search label"
                value={labelSearch}
                onChange={(event) => onLabelSearchChange(event.target.value)}
                onBlur={onLabelSearchBlur}
            />
            <datalist id="label-search-list">
                {labels.map((label) => (
                    <option key={label} value={label} />
                ))}
            </datalist>

            <input
                type="date"
                className="input"
                style={{ width: 150 }}
                value={filters.dateFrom || ''}
                onChange={(event) => setFilters({ dateFrom: event.target.value || undefined })}
                title="Created from"
            />
            <input
                type="date"
                className="input"
                style={{ width: 150 }}
                value={filters.dateTo || ''}
                onChange={(event) => setFilters({ dateTo: event.target.value || undefined })}
                title="Created to"
            />

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                    className={`btn btn-sm ${filters.blockedOnly ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => setFilters({ blockedOnly: !filters.blockedOnly })}
                >
                    🚧 Blocked
                </button>
                <button
                    className={`btn btn-sm ${filters.bugsOnly ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => setFilters({ bugsOnly: !filters.bugsOnly })}
                >
                    🐛 Bugs
                </button>
                <button
                    className={`btn btn-sm ${filters.unresolvedOnly ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFilters({ unresolvedOnly: !filters.unresolvedOnly })}
                >
                    Unresolved
                </button>
                <button
                    className={`btn btn-sm ${filters.selectedOnly ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFilters({
                        selectedOnly: !filters.selectedOnly,
                        selectedKeys: selectedKeys.size > 0 ? Array.from(selectedKeys) : undefined,
                    })}
                    disabled={selectedKeys.size === 0}
                    title={selectedKeys.size === 0 ? 'Select tickets first' : undefined}
                >
                    Selected ({selectedKeys.size})
                </button>
                <button className="btn btn-secondary btn-sm" onClick={applyCurrentWeek}>
                    This Week
                </button>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={applyActiveSprintRange}
                    disabled={!activeSprintStart || !activeSprintEnd}
                    title={!activeSprintStart || !activeSprintEnd ? 'No active sprint dates found' : undefined}
                >
                    Sprint Window{activeSprintDuration ? ` (${activeSprintDuration}d)` : ''}
                </button>
            </div>

            {hasFilters && (
                <button className="btn btn-ghost btn-sm" onClick={resetFilters} style={{ marginLeft: 'auto' }}>
                    <X size={12} /> Clear
                </button>
            )}
        </div>
    );
}
