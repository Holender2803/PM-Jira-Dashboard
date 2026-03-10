'use client';
import { useState } from 'react';
import { JiraIssue } from '@/types';
import { CLOSED_STATUSES, ACTIVE_STATUSES, ISSUE_TYPE_COLORS, STAGE_COLORS, STAGE_LABELS } from '@/lib/workflow';
import {
    WORKFLOW_GROUP_ORDER,
    WORKFLOW_GROUP_COLORS,
    WORKFLOW_GROUP_DISPLAY_LABELS,
    resolveWorkflowGroup,
    type WorkflowGroupName,
} from '@/lib/statusGroups';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, AreaChart, Area, CartesianGrid,
} from 'recharts';

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill?: string }[]; label?: string }) => {
    if (active && payload?.length) {
        return (
            <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 12, color: 'var(--text-primary)',
            }}>
                {label && <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</p>}
                {payload.map((p, i) => (
                    <p key={i} style={{ color: p.fill || 'var(--accent-light)' }}>
                        {p.name}: <strong>{p.value}</strong>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

function pluralizeIssueType(type: string): string {
    if (type === 'Bug') return 'Bugs';
    if (type.endsWith('y')) return `${type.slice(0, -1)}ies`;
    if (type.endsWith('s')) return type;
    return `${type}s`;
}

interface WorkflowFunnelDatum {
    stage: string;
    stageKey: string;
    count: number;
    percent: number;
    relativePercent: number;
    fill: string;
}

function formatPercent(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function WorkflowFunnelTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: Array<{ payload?: WorkflowFunnelDatum; value?: number }>;
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    const point = payload.find((entry) => typeof entry?.value === 'number' && entry.value !== null)?.payload;
    if (!point) return null;

    return (
        <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 14px',
            fontSize: 12, color: 'var(--text-primary)',
        }}>
            {label && <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</p>}
            <p>
                {point.count} tickets ({formatPercent(point.percent)}% of total)
            </p>
        </div>
    );
}

// ─── Status distribution bar chart ────────────────────────────────────────────
export function StatusChart({
    issues,
    showIncludeDoneToggle = false,
}: {
    issues: JiraIssue[];
    showIncludeDoneToggle?: boolean;
}) {
    const [includeDone, setIncludeDone] = useState(false);

    const counts = WORKFLOW_GROUP_ORDER.reduce((acc, group) => {
        acc[group] = 0;
        return acc;
    }, {} as Record<WorkflowGroupName, number>);

    issues.forEach((issue) => {
        const group = resolveWorkflowGroup(issue.status) || 'Backlog';
        counts[group] += 1;
    });

    const doneCount = counts.Done;
    const doneIncluded = showIncludeDoneToggle ? includeDone : true;
    const groupsToShow = doneIncluded
        ? WORKFLOW_GROUP_ORDER
        : WORKFLOW_GROUP_ORDER.filter((group) => group !== 'Done');

    const data = groupsToShow.map((group) => ({
        group,
        label: WORKFLOW_GROUP_DISPLAY_LABELS[group],
        count: counts[group],
        fill: WORKFLOW_GROUP_COLORS[group],
    }));

    return (
        <div className="chart-container">
            <div className="chart-title">Issues by Status Group</div>
            {showIncludeDoneToggle && (
                <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={includeDone}
                            onChange={(event) => setIncludeDone(event.target.checked)}
                        />
                        Include Done
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {doneIncluded
                            ? `Done (${doneCount} tickets) included`
                            : `Done (${doneCount} tickets) hidden for readability`}
                    </span>
                </div>
            )}
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                    <Bar dataKey="count" name="Tickets" radius={[0, 4, 4, 0]}>
                        {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── Issue type pie chart ──────────────────────────────────────────────────────
export function IssueTypePieChart({ issues }: { issues: JiraIssue[] }) {
    const counts: Record<string, number> = {};
    issues.forEach(i => { counts[i.issueType] = (counts[i.issueType] || 0) + 1; });
    const total = issues.length;

    const protectedTypes = new Set(['Bug', 'Feature Request', 'Technical Task']);
    const sorted = Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const keptSlices: Array<{ name: string; value: number }> = [];
    let otherValue = 0;

    sorted.forEach((slice) => {
        const percent = total > 0 ? (slice.value / total) * 100 : 0;
        const shouldMerge = percent < 3 && !protectedTypes.has(slice.name);

        if (shouldMerge) {
            otherValue += slice.value;
            return;
        }
        keptSlices.push(slice);
    });

    const namedSlices = keptSlices.slice(0, 6);
    otherValue += keptSlices.slice(6).reduce((sum, slice) => sum + slice.value, 0);

    const data = [
        ...namedSlices.map(({ name, value }) => ({
            name,
            value,
            fill: ISSUE_TYPE_COLORS[name] || '#64748b',
        })),
        ...(otherValue > 0 ? [{ name: 'Other', value: otherValue, fill: '#64748b' }] : []),
    ];

    const dominant = sorted[0];
    const dominantPercent = dominant ? Math.round((dominant.value / Math.max(total, 1)) * 100) : 0;
    const dominantLabel = dominant ? `${pluralizeIssueType(dominant.name)} ${dominantPercent}%` : 'No tickets';

    return (
        <div className="chart-container">
            <div className="chart-title">Work Mix by Type</div>
            <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                    <Pie
                        data={data} cx="40%" cy="50%" innerRadius={55} outerRadius={85}
                        dataKey="value" paddingAngle={3}
                    >
                        {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip
                        formatter={(v, name) => {
                            const numericValue = Number(v || 0);
                            const percent = Math.round((numericValue / Math.max(total, 1)) * 100);
                            return [`${numericValue} tickets (${percent}% of total)`, String(name ?? '')];
                        }}
                        contentStyle={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: 8, fontSize: 12, color: 'var(--text-primary)',
                        }}
                    />
                    <Legend
                        iconType="circle" iconSize={8}
                        formatter={(v) => <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v}</span>}
                    />
                    <text x="40%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fontWeight: 600, fill: 'var(--text-primary)' }}>
                        {dominantLabel}
                    </text>
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── Sprint burndown-style completion ─────────────────────────────────────────
export function SprintProgressChart({ issues }: { issues: JiraIssue[] }) {
    const total = issues.length;
    const done = issues.filter((issue) => CLOSED_STATUSES.includes(issue.status)).length;
    const inProgress = issues.filter((issue) => issue.status === 'In Progress').length;
    const inReview = issues.filter((issue) => ['In Review', 'Reviewed'].includes(issue.status)).length;
    const inQA = issues.filter((issue) => ['Ready for QA', 'In QA'].includes(issue.status)).length;
    const waiting = issues.filter((issue) => ['Ready for Acceptance', 'Ready for Release'].includes(issue.status)).length;
    const blocked = issues.filter((issue) => issue.status === 'Blocked').length;
    const notStarted = Math.max(0, total - done - inProgress - inReview - inQA - waiting - blocked);

    const data = [
        { name: 'Done', value: done, fill: '#10b981' },
        { name: 'In Progress', value: inProgress, fill: '#3b82f6' },
        { name: 'In Review', value: inReview, fill: '#8b5cf6' },
        { name: 'In QA', value: inQA, fill: '#14b8a6' },
        { name: 'Waiting', value: waiting, fill: '#f59e0b' },
        { name: 'Blocked', value: blocked, fill: '#ef4444' },
        { name: 'Not Started', value: notStarted, fill: '#64748b' },
    ];

    const allZero = data.every((slice) => slice.value === 0);

    if (allZero) {
        return (
            <div className="chart-container">
                <div className="chart-title">Sprint Completion Mix</div>
                <div
                    style={{
                        minHeight: 220,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        fontSize: 13,
                        textAlign: 'center',
                    }}
                >
                    No sprint data available
                </div>
            </div>
        );
    }

    return (
        <div className="chart-container">
            <div className="chart-title">Sprint Completion Mix</div>
            <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                    <Pie data={data} cx="40%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                        {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip
                        formatter={(v, name) => [`${v ?? 0} tickets`, String(name ?? '')]}
                        contentStyle={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: 8, fontSize: 12, color: 'var(--text-primary)',
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
                {data.map((slice) => (
                    <div key={slice.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: slice.fill, flexShrink: 0 }} />
                        <span>{slice.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Workflow funnel stages ────────────────────────────────────────────────────
export function WorkflowFunnelChart({
    issues,
    activeOnlyView = false,
}: {
    issues: JiraIssue[];
    activeOnlyView?: boolean;
}) {
    const stageCounts: Record<string, number> = {};
    issues.forEach(i => {
        const stage = i.workflowStage;
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });

    const total = issues.length;
    const closedCount = stageCounts.closed || 0;
    const closedPercent = total > 0 ? Number(((closedCount / total) * 100).toFixed(1)) : 0;

    const activeStages = ['intake', 'discovery', 'delivery', 'review', 'qa', 'release'] as const;
    const maxActiveCount = activeStages.reduce((max, stage) => Math.max(max, stageCounts[stage] || 0), 0);

    const activeData: WorkflowFunnelDatum[] = activeStages.map((stage) => {
        const count = stageCounts[stage] || 0;
        const percent = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
        const relativePercent = maxActiveCount > 0 ? Number(((count / maxActiveCount) * 100).toFixed(1)) : 0;

        return {
            stage: STAGE_LABELS[stage],
            stageKey: stage,
            count,
            percent,
            relativePercent,
            fill: STAGE_COLORS[stage],
        };
    });

    const allStageData: WorkflowFunnelDatum[] = Object.entries(STAGE_LABELS).map(([stage, label]) => {
        const count = stageCounts[stage] || 0;
        const percent = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;

        return {
            stage: label,
            stageKey: stage,
            count,
            percent,
            relativePercent: percent,
            fill: STAGE_COLORS[stage as keyof typeof STAGE_COLORS],
        };
    });

    const data = activeOnlyView ? activeData : allStageData;

    return (
        <div className="chart-container">
            <div className="chart-title">Workflow Funnel</div>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 4 }}>
                    <XAxis dataKey="stage" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                        tickFormatter={(value) => `${value}%`}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip content={<WorkflowFunnelTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                    <Bar dataKey="relativePercent" radius={[4, 4, 0, 0]}>
                        {data.map((d, i) => <Cell key={`funnel-${d.stageKey}-${i}`} fill={d.fill} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            {activeOnlyView && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                    ✅ {closedCount} tickets closed ({formatPercent(closedPercent)}% of all time total)
                </div>
            )}
        </div>
    );
}

// ─── Assignee workload ─────────────────────────────────────────────────────────
export function AssigneeChart({ issues }: { issues: JiraIssue[] }) {
    const byAssignee: Record<string, { active: number; done: number; total: number }> = {};
    issues.forEach(i => {
        const name = i.assignee?.displayName || 'Unassigned';
        if (!byAssignee[name]) byAssignee[name] = { active: 0, done: 0, total: 0 };
        byAssignee[name].total++;
        if (CLOSED_STATUSES.includes(i.status)) byAssignee[name].done++;
        else if (ACTIVE_STATUSES.includes(i.status)) byAssignee[name].active++;
    });

    const data = Object.entries(byAssignee)
        .filter(([n]) => n !== 'Unassigned')
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 8)
        .map(([name, v]) => ({ name: name.split(' ')[0], ...v }));

    return (
        <div className="chart-container">
            <div className="chart-title">Workload by Assignee</div>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 4 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                    <Bar dataKey="active" name="Active" fill="#6366f1" radius={[2, 2, 0, 0]} stackId="a" />
                    <Bar dataKey="done" name="Done" fill="#10b981" radius={[2, 2, 0, 0]} stackId="a" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── Area chart for aging ──────────────────────────────────────────────────────
export function AgingAreaChart({ issues }: { issues: JiraIssue[] }) {
    const unresolvedByAge = issues
        .filter(i => !i.resolved)
        .reduce((acc: Record<string, number>, i) => {
            const bucket = i.age < 7 ? '0-7d' : i.age < 14 ? '8-14d' : i.age < 30 ? '15-30d' : '30d+';
            acc[bucket] = (acc[bucket] || 0) + 1;
            return acc;
        }, {});

    const data = [
        { bucket: '0–7d', count: unresolvedByAge['0-7d'] || 0 },
        { bucket: '8–14d', count: unresolvedByAge['8-14d'] || 0 },
        { bucket: '15–30d', count: unresolvedByAge['15-30d'] || 0 },
        { bucket: '30d+', count: unresolvedByAge['30d+'] || 0 },
    ];

    return (
        <div className="chart-container">
            <div className="chart-title">Ticket Aging (Unresolved)</div>
            <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="agingGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="count" name="Tickets" stroke="#6366f1" fill="url(#agingGrad)" strokeWidth={2} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── Bug trend line ────────────────────────────────────────────────────────────
export function BugPriorityChart({
    issues,
    onPriorityClick,
}: {
    issues: JiraIssue[];
    onPriorityClick?: (priority: 'Emergency' | 'High' | 'Medium' | 'Low' | 'None') => void;
}) {
    const bugs = issues.filter(i => i.issueType === 'Bug');
    const byPriority: Record<string, number> = {
        Emergency: 0,
        High: 0,
        Medium: 0,
        Low: 0,
        None: 0,
    };

    const toPriorityBucket = (priority: string | null | undefined): 'Emergency' | 'High' | 'Medium' | 'Low' | 'None' => {
        const normalized = (priority || '').trim().toLowerCase();
        if (!normalized) return 'None';
        if (
            normalized.includes('emergency') ||
            normalized.includes('critical') ||
            normalized.includes('blocker') ||
            normalized.includes('highest')
        ) {
            return 'Emergency';
        }
        if (normalized.includes('high')) return 'High';
        if (normalized.includes('medium')) return 'Medium';
        if (normalized.includes('low') || normalized.includes('lowest')) return 'Low';
        return 'None';
    };

    bugs.forEach(i => {
        const p = toPriorityBucket(i.priority);
        byPriority[p] = (byPriority[p] || 0) + 1;
    });

    const PRIORITY_ORDER = ['Emergency', 'High', 'Medium', 'Low', 'None'];
    const PRIORITY_COLORS_MAP: Record<string, string> = {
        Emergency: '#ef4444',
        High: '#f97316',
        Medium: '#eab308',
        Low: '#3b82f6',
        None: '#64748b',
    };

    const data = PRIORITY_ORDER
        .map(p => ({ name: p, count: byPriority[p], fill: PRIORITY_COLORS_MAP[p] }));

    return (
        <div className="chart-container">
            <div className="chart-title">Bugs by Priority</div>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 4 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                    <Bar
                        dataKey="count"
                        radius={[4, 4, 0, 0]}
                        onClick={(entry) => {
                            const priority = entry?.name as 'Emergency' | 'High' | 'Medium' | 'Low' | 'None' | undefined;
                            if (!priority || !onPriorityClick) return;
                            onPriorityClick(priority);
                        }}
                        style={onPriorityClick ? { cursor: 'pointer' } : undefined}
                    >
                        {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
