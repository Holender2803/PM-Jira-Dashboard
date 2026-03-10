'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { endOfWeek, format, parseISO, startOfWeek, differenceInCalendarDays } from 'date-fns';
import { useAppStore } from '@/store/app-store';
import {
    DashboardFilters,
    IssueStatus,
    IssueType,
    Priority,
    WorkflowGroup,
} from '@/types';
import { ALL_STATUSES } from '@/lib/workflow';
import { X, Filter, ChevronDown, Search, ExternalLink } from 'lucide-react';
import { formatEpicLabelFromParts, isEpicIssue } from '@/lib/issue-format';
import {
    isAllWorkflowGroupsSelected,
    WORKFLOW_ACTIVE_ONLY_GROUPS,
    WORKFLOW_GROUP_ORDER,
} from '@/lib/workflow-groups';

const TYPES: IssueType[] = ['Bug', 'Story', 'Task', 'Feature', 'Technical Task', 'Spike', 'Developer Request', 'Support', 'Chore'];
const PRIORITIES: Priority[] = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

interface FilterBarProps {
    showSprintFilter?: boolean;
}

interface SearchOption {
    value: string;
    label: string;
}

interface FilterDropdownProps {
    id: string;
    width: number;
    placeholder: string;
    allLabel: string;
    options: SearchOption[];
    value?: string;
    onSelect: (value?: string) => void;
}

function FilterDropdown({
    id,
    width,
    placeholder,
    allLabel,
    options,
    value,
    onSelect,
}: FilterDropdownProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootRef = useRef<HTMLDivElement>(null);

    const uniqueOptions = useMemo(() => {
        const seen = new Set<string>();
        const deduped: SearchOption[] = [];
        for (const option of options) {
            const signature = `${option.value}::${option.label}`;
            if (seen.has(signature)) continue;
            seen.add(signature);
            deduped.push(option);
        }
        return deduped;
    }, [options]);

    const selected = useMemo(
        () => uniqueOptions.find((option) => option.value === (value || '')),
        [uniqueOptions, value]
    );

    const filteredOptions = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return uniqueOptions.slice(0, 200);
        return uniqueOptions
            .filter((option) =>
                option.label.toLowerCase().includes(needle) ||
                option.value.toLowerCase().includes(needle)
            )
            .slice(0, 200);
    }, [query, uniqueOptions]);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(event.target as Node)) {
                setQuery('');
                setOpen(false);
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    return (
        <div
            ref={rootRef}
            className="filter-dropdown"
            style={{ width }}
        >
            <button
                type="button"
                className={`filter-dropdown-trigger ${open ? 'open' : ''}`}
                onClick={() => {
                    setOpen((current) => {
                        const next = !current;
                        if (!next) setQuery('');
                        return next;
                    });
                }}
            >
                <span className={`filter-dropdown-value ${selected ? '' : 'muted'}`}>
                    {selected?.label || placeholder}
                </span>
                <span className="filter-dropdown-trigger-actions">
                    {selected && (
                        <span
                            role="button"
                            tabIndex={0}
                            className="filter-dropdown-selected-clear"
                            onClick={(event) => {
                                event.stopPropagation();
                                onSelect(undefined);
                                setQuery('');
                                setOpen(false);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onSelect(undefined);
                                    setQuery('');
                                    setOpen(false);
                                }
                            }}
                            aria-label={`Clear ${placeholder} filter`}
                            title={`Clear ${placeholder}`}
                        >
                            <X size={11} />
                        </span>
                    )}
                    <ChevronDown size={14} className={`filter-dropdown-caret ${open ? 'open' : ''}`} />
                </span>
            </button>

            {open && (
                <div className="filter-dropdown-menu">
                    <div className="filter-dropdown-search">
                        <Search size={12} />
                        <input
                            className="filter-dropdown-search-input"
                            placeholder={`Search ${allLabel.toLowerCase()}...`}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            autoFocus
                        />
                        <button
                            type="button"
                            className={`filter-dropdown-search-clear ${query ? '' : 'disabled'}`}
                            onClick={() => setQuery('')}
                            aria-label="Clear search"
                            title="Clear search"
                            disabled={!query}
                        >
                            <X size={11} />
                        </button>
                    </div>
                    <div className="filter-dropdown-list">
                        <button
                            type="button"
                            className={`filter-dropdown-item ${!value ? 'active' : ''}`}
                            onClick={() => {
                                onSelect(undefined);
                                setQuery('');
                                setOpen(false);
                            }}
                        >
                            {allLabel}
                        </button>
                        {filteredOptions.map((option, index) => (
                            <button
                                key={`${id}-${option.value}-${index}`}
                                type="button"
                                className={`filter-dropdown-item ${value === option.value ? 'active' : ''}`}
                                onClick={() => {
                                    onSelect(option.value);
                                    setQuery('');
                                    setOpen(false);
                                }}
                            >
                                {option.label}
                            </button>
                        ))}
                        {filteredOptions.length === 0 && (
                            <div className="filter-dropdown-empty">No matches</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function FilterBar({ showSprintFilter = true }: FilterBarProps) {
    const {
        filters,
        setFilters,
        resetFilters,
        issues,
        selectedKeys,
        workflowGroupFilter,
        setWorkflowGroupFilter,
    } = useAppStore();

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

    const epics = useMemo(() => {
        const epicMap = new Map<string, { key: string; summary?: string; childSummary?: string }>();

        for (const issue of issues) {
            if (isEpicIssue(issue)) {
                const current = epicMap.get(issue.key) || { key: issue.key };
                if (issue.summary) current.summary = issue.summary;
                epicMap.set(issue.key, current);
            }

            if (!issue.epicKey && !issue.epicSummary) continue;
            const key = issue.epicKey || issue.epicSummary!;
            const current = epicMap.get(key) || { key };
            if (!current.summary && issue.epicSummary && issue.epicSummary !== key) {
                current.summary = issue.epicSummary;
            }
            if (!current.childSummary && issue.summary) {
                current.childSummary = issue.summary;
            }
            epicMap.set(key, current);
        }

        return [...epicMap.values()]
            .map((epic) => ({
                key: epic.key,
                label: formatEpicLabelFromParts(
                    epic.key,
                    epic.summary || epic.childSummary || null
                ),
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [issues]);

    const labels = [...new Set(issues.flatMap((issue) => issue.labels))]
        .sort((a, b) => a.localeCompare(b));

    const hasFilters = Object.entries(filters).some(([key, rawValue]) => {
        if (key === 'groupFilter') {
            return !isAllWorkflowGroupsSelected(rawValue as string[] | undefined);
        }
        const value = rawValue as DashboardFilters[keyof DashboardFilters];
        return value !== undefined && value !== false && (Array.isArray(value) ? value.length > 0 : true);
    });
    const allGroupsSelected = isAllWorkflowGroupsSelected(workflowGroupFilter);

    const toggleWorkflowGroup = (group: WorkflowGroup) => {
        if (workflowGroupFilter.includes(group)) {
            if (workflowGroupFilter.length === 1) return;
            setWorkflowGroupFilter(workflowGroupFilter.filter((item) => item !== group));
            return;
        }
        setWorkflowGroupFilter([...workflowGroupFilter, group]);
    };

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
            sprintId: undefined,
            dateFrom: format(activeSprintStart, 'yyyy-MM-dd'),
            dateTo: format(activeSprintEnd, 'yyyy-MM-dd'),
        });
    };

    const sprintOptions: SearchOption[] = [
        { value: 'current', label: 'Current Sprint' },
        { value: 'previous', label: 'Previous Sprint' },
        ...sprints.map((sprint) => ({
            value: `id:${sprint.id}`,
            label: `${sprint.name}${sprint.state === 'active' ? ' (Active)' : ''}`,
        })),
    ];

    const selectedSprintValue = (() => {
        if (filters.sprint === 'current' || filters.sprint === 'previous') return filters.sprint;
        if (filters.sprintId !== undefined) return `id:${filters.sprintId}`;
        if (filters.sprint) {
            const exact = sprintOptions.find((option) => option.label === filters.sprint);
            if (exact) return exact.value;
            const startsWith = sprintOptions.find((option) => option.label.startsWith(`${filters.sprint} (`));
            if (startsWith) return startsWith.value;
        }
        return undefined;
    })();

    const statusOptions: SearchOption[] = ALL_STATUSES.map((status) => ({ value: status, label: status }));
    const typeOptions: SearchOption[] = TYPES.map((type) => ({ value: type, label: type }));
    const assigneeOptions: SearchOption[] = assignees.map((assignee) => ({ value: assignee.accountId, label: assignee.displayName }));
    const priorityOptions: SearchOption[] = PRIORITIES.map((priority) => ({ value: priority, label: priority }));
    const projectOptions: SearchOption[] = projects.map((project) => ({ value: project, label: project }));
    const squadOptions: SearchOption[] = squads.map((squad) => ({ value: squad, label: squad }));
    const epicOptions: SearchOption[] = epics.map((epic) => ({ value: epic.key, label: epic.label }));
    const labelOptions: SearchOption[] = labels.map((label) => ({ value: label, label }));
    const epicPresenceOptions: SearchOption[] = [
        { value: 'with', label: 'With Epic' },
        { value: 'without', label: 'Without Epic' },
    ];
    const selectedEpicKey = filters.epicKey?.[0];
    const selectedEpicJiraUrl = useMemo(() => {
        if (!selectedEpicKey) return null;

        const directEpicIssue = issues.find((issue) => issue.key === selectedEpicKey && issue.url);
        if (directEpicIssue?.url) return directEpicIssue.url;

        const linkedIssue = issues.find((issue) => issue.epicKey === selectedEpicKey && issue.url);
        if (!linkedIssue?.url) return null;

        if (linkedIssue.url.includes('/browse/')) {
            const base = linkedIssue.url.split('/browse/')[0];
            return `${base}/browse/${selectedEpicKey}`;
        }

        return linkedIssue.url;
    }, [issues, selectedEpicKey]);

    return (
        <div className="filter-bar">
            <div className="filter-bar-panel">
                <div className="filter-panel-heading">
                    <Filter size={13} />
                    <span>Filters</span>
                </div>

                {showSprintFilter && (
                    <FilterDropdown
                        id="filter-sprint"
                        width={200}
                        placeholder="Sprint"
                        allLabel="All Sprints"
                        options={sprintOptions}
                        value={selectedSprintValue}
                        onSelect={(value) => {
                            if (!value) {
                                setFilters({ sprint: undefined, sprintId: undefined });
                                return;
                            }
                            if (value === 'current' || value === 'previous') {
                                setFilters({ sprint: value, sprintId: undefined });
                                return;
                            }
                            if (value.startsWith('id:')) {
                                const sprintId = Number(value.replace('id:', ''));
                                const sprint = sprints.find((item) => item.id === sprintId);
                                setFilters({ sprintId, sprint: sprint?.name });
                            }
                        }}
                    />
                )}

                <FilterDropdown
                    id="filter-status"
                    width={170}
                    placeholder="Status"
                    allLabel="All Statuses"
                    options={statusOptions}
                    value={filters.status?.[0]}
                    onSelect={(value) => setFilters({ status: value ? [value as IssueStatus] : undefined })}
                />

                <FilterDropdown
                    id="filter-issue-type"
                    width={170}
                    placeholder="Issue Type"
                    allLabel="All Types"
                    options={typeOptions}
                    value={filters.issueType?.[0]}
                    onSelect={(value) => setFilters({ issueType: value ? [value as IssueType] : undefined })}
                />

                <FilterDropdown
                    id="filter-assignee"
                    width={190}
                    placeholder="Assignee"
                    allLabel="All Assignees"
                    options={assigneeOptions}
                    value={filters.assignee?.[0]}
                    onSelect={(value) => setFilters({ assignee: value ? [value] : undefined })}
                />

                <FilterDropdown
                    id="filter-priority"
                    width={150}
                    placeholder="Priority"
                    allLabel="All Priorities"
                    options={priorityOptions}
                    value={filters.priority?.[0]}
                    onSelect={(value) => setFilters({ priority: value ? [value as Priority] : undefined })}
                />

                <FilterDropdown
                    id="filter-project"
                    width={150}
                    placeholder="Project"
                    allLabel="All Projects"
                    options={projectOptions}
                    value={filters.project?.[0]}
                    onSelect={(value) => setFilters({ project: value ? [value] : undefined })}
                />

                <FilterDropdown
                    id="filter-squad"
                    width={170}
                    placeholder="Squad"
                    allLabel="All Squads"
                    options={squadOptions}
                    value={filters.squad?.[0]}
                    onSelect={(value) => setFilters({ squad: value ? [value] : undefined })}
                />

                <div className="filter-epic-control">
                    <FilterDropdown
                        id="filter-epic"
                        width={260}
                        placeholder="Epic"
                        allLabel="All Epics"
                        options={epicOptions}
                        value={filters.epicKey?.[0]}
                        onSelect={(value) => setFilters({ epicKey: value ? [value] : undefined })}
                    />
                    <a
                        href={selectedEpicJiraUrl || '#'}
                        className={`filter-epic-link ${selectedEpicJiraUrl ? '' : 'disabled'}`}
                        target={selectedEpicJiraUrl ? '_blank' : undefined}
                        rel={selectedEpicJiraUrl ? 'noopener noreferrer' : undefined}
                        onClick={(event) => {
                            if (!selectedEpicJiraUrl) event.preventDefault();
                        }}
                        title={selectedEpicJiraUrl ? `Open ${selectedEpicKey} in Jira` : 'Select an epic to open in Jira'}
                        aria-disabled={!selectedEpicJiraUrl}
                    >
                        <ExternalLink size={12} />
                    </a>
                </div>

                <FilterDropdown
                    id="filter-epic-presence"
                    width={170}
                    placeholder="Epic Info"
                    allLabel="All Epic States"
                    options={epicPresenceOptions}
                    value={filters.epicPresence}
                    onSelect={(value) => setFilters({ epicPresence: value as 'with' | 'without' | undefined })}
                />

                <FilterDropdown
                    id="filter-label"
                    width={220}
                    placeholder="Label"
                    allLabel="All Labels"
                    options={labelOptions}
                    value={filters.label?.[0]}
                    onSelect={(value) => setFilters({ label: value ? [value] : undefined })}
                />

                <input
                    type="date"
                    className="input filter-date-input"
                    style={{ width: 150 }}
                    value={filters.dateFrom || ''}
                    onChange={(event) => setFilters({ dateFrom: event.target.value || undefined })}
                    title="Created from"
                />
                <input
                    type="date"
                    className="input filter-date-input"
                    style={{ width: 150 }}
                    value={filters.dateTo || ''}
                    onChange={(event) => setFilters({ dateTo: event.target.value || undefined })}
                    title="Created to"
                />

                <div className="filter-chip-group">
                    <button
                        className={`filter-chip ${filters.blockedOnly ? 'is-active is-danger' : ''}`}
                        onClick={() => setFilters({ blockedOnly: !filters.blockedOnly })}
                    >
                        🚧 Blocked
                    </button>
                    <button
                        className={`filter-chip ${filters.bugsOnly ? 'is-active is-danger' : ''}`}
                        onClick={() => setFilters({ bugsOnly: !filters.bugsOnly })}
                    >
                        🐛 Bugs
                    </button>
                    <button
                        className={`filter-chip ${filters.unresolvedOnly ? 'is-active is-accent' : ''}`}
                        onClick={() => setFilters({ unresolvedOnly: !filters.unresolvedOnly })}
                    >
                        Unresolved
                    </button>
                    <button
                        className={`filter-chip ${filters.atRiskOnly ? 'is-active is-warning' : ''}`}
                        onClick={() => setFilters({ atRiskOnly: !filters.atRiskOnly })}
                    >
                        At Risk
                    </button>
                    <button
                        className={`filter-chip ${filters.selectedOnly ? 'is-active is-accent' : ''}`}
                        onClick={() => setFilters({
                            selectedOnly: !filters.selectedOnly,
                            selectedKeys: selectedKeys.size > 0 ? Array.from(selectedKeys) : undefined,
                        })}
                        disabled={selectedKeys.size === 0}
                        title={selectedKeys.size === 0 ? 'Select tickets first' : undefined}
                    >
                        Selected ({selectedKeys.size})
                    </button>
                    <button className="filter-chip is-neutral" onClick={applyCurrentWeek}>
                        This Week
                    </button>
                    <button
                        className="filter-chip is-neutral"
                        onClick={applyActiveSprintRange}
                        disabled={!activeSprintStart || !activeSprintEnd}
                        title={!activeSprintStart || !activeSprintEnd ? 'No active sprint dates found' : undefined}
                    >
                        Sprint Window{activeSprintDuration ? ` (${activeSprintDuration}d)` : ''}
                    </button>
                </div>

                <div className="workflow-group-chip-row">
                    <span className="workflow-group-chip-label">Groups</span>
                    {WORKFLOW_GROUP_ORDER.map((group) => {
                        const active = workflowGroupFilter.includes(group);
                        return (
                            <button
                                key={group}
                                className={`workflow-group-chip ${active ? 'is-active' : ''}`}
                                onClick={() => toggleWorkflowGroup(group)}
                                title={active ? `Hide ${group}` : `Show ${group}`}
                            >
                                {group}
                            </button>
                        );
                    })}
                    <div className="workflow-group-chip-shortcuts">
                        <button
                            className="workflow-group-shortcut"
                            onClick={() => setWorkflowGroupFilter([...WORKFLOW_GROUP_ORDER])}
                        >
                            All
                        </button>
                        <button
                            className="workflow-group-shortcut"
                            onClick={() => setWorkflowGroupFilter([...WORKFLOW_ACTIVE_ONLY_GROUPS])}
                        >
                            Active only
                        </button>
                    </div>
                </div>

                {hasFilters && (
                    <button className="filter-clear-btn" onClick={resetFilters}>
                        <X size={12} /> Clear
                    </button>
                )}
            </div>

            {!allGroupsSelected && (
                <div className="filter-summary-row">
                    <span className="filter-summary-label">Active Filters</span>
                    <button
                        className="filter-summary-tag"
                        onClick={() => setWorkflowGroupFilter([...WORKFLOW_GROUP_ORDER])}
                        title="Clear group filter"
                    >
                        Groups: {workflowGroupFilter.join(', ')}
                        <X size={11} />
                    </button>
                </div>
            )}
        </div>
    );
}
