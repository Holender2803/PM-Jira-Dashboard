'use client';
import { JiraIssue } from '@/types';
import { CLOSED_STATUSES, ACTIVE_STATUSES, STATUS_COLORS, ISSUE_TYPE_COLORS, STAGE_COLORS, STAGE_LABELS } from '@/lib/workflow';
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

// ─── Status distribution bar chart ────────────────────────────────────────────
export function StatusChart({ issues }: { issues: JiraIssue[] }) {
    const counts: Record<string, number> = {};
    issues.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    const data = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => ({ status, count, fill: STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#64748b' }));

    return (
        <div className="chart-container">
            <div className="chart-title">Issues by Status</div>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="status" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
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
    const data = Object.entries(counts).map(([name, value]) => ({
        name, value,
        fill: ISSUE_TYPE_COLORS[name] || '#64748b',
    }));

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
                        formatter={(v, name) => [`${v ?? 0} tickets`, String(name ?? '')]}
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
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── Sprint burndown-style completion ─────────────────────────────────────────
export function SprintProgressChart({ issues }: { issues: JiraIssue[] }) {
    const total = issues.length;
    const done = issues.filter(i => CLOSED_STATUSES.includes(i.status)).length;
    const active = issues.filter(i => ACTIVE_STATUSES.includes(i.status)).length;
    const intake = total - done - active;

    const data = [
        { name: 'Done', value: done, fill: '#10b981' },
        { name: 'Active', value: active, fill: '#6366f1' },
        { name: 'Waiting', value: intake, fill: '#475569' },
    ];

    return (
        <div className="chart-container">
            <div className="chart-title">Sprint Completion</div>
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
                    <Legend
                        iconType="circle" iconSize={8}
                        formatter={(v) => <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v}</span>}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── Workflow funnel stages ────────────────────────────────────────────────────
export function WorkflowFunnelChart({ issues }: { issues: JiraIssue[] }) {
    const stageCounts: Record<string, number> = {};
    issues.forEach(i => {
        const stage = i.workflowStage;
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });

    const data = Object.entries(STAGE_LABELS).map(([stage, label]) => ({
        stage: label,
        count: stageCounts[stage] || 0,
        fill: STAGE_COLORS[stage as keyof typeof STAGE_COLORS],
    }));

    return (
        <div className="chart-container">
            <div className="chart-title">Workflow Funnel</div>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 4 }}>
                    <XAxis dataKey="stage" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
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
export function BugPriorityChart({ issues }: { issues: JiraIssue[] }) {
    const bugs = issues.filter(i => i.issueType === 'Bug');
    const byPriority: Record<string, number> = {};
    bugs.forEach(i => {
        const p = i.priority || 'Unknown';
        byPriority[p] = (byPriority[p] || 0) + 1;
    });

    const PRIORITY_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
    const PRIORITY_COLORS_MAP: Record<string, string> = {
        Highest: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#22c55e', Lowest: '#64748b',
    };

    const data = PRIORITY_ORDER
        .filter(p => byPriority[p])
        .map(p => ({ name: p, count: byPriority[p], fill: PRIORITY_COLORS_MAP[p] }));

    return (
        <div className="chart-container">
            <div className="chart-title">Bugs by Priority</div>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 4 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
