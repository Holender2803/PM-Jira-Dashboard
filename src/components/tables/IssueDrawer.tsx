'use client';
import { useMemo } from 'react';
import { JiraIssue } from '@/types';
import { StatusBadge, PriorityBadge, IssueTypeBadge, Avatar } from '@/components/ui/Badges';
import { X, ExternalLink, Clock, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import JiraRichText from './JiraRichText';
import { formatEpicLabel, isEpicIssue } from '@/lib/issue-format';

interface IssueDrawerProps {
    issue: JiraIssue;
    onClose: () => void;
}

function formatDuration(from: string, to: string): string {
    const fromDate = parseISO(from);
    const toDate = parseISO(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return '—';
    const diffMs = Math.max(0, toDate.getTime() - fromDate.getTime());
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export default function IssueDrawer({ issue, onClose }: IssueDrawerProps) {
    const { toggleSelected, selectedKeys } = useAppStore();
    const router = useRouter();

    const fmt = (d: string | null) => d ? format(parseISO(d), 'MMM d, yyyy') : '—';
    const fmtShort = (d: string) => {
        const parsed = parseISO(d);
        return Number.isNaN(parsed.getTime()) ? '—' : format(parsed, 'MMM d');
    };

    const statusHistory = issue.changelog
        .filter(c => c.field === 'status')
        .sort((a, b) => b.created.localeCompare(a.created))
        .slice(0, 10);

    const statusDurations = useMemo(() => {
        const transitions = issue.changelog
            .filter((entry) => entry.field === 'status')
            .sort((a, b) => a.created.localeCompare(b.created));
        const rows: { status: string; from: string; to: string; duration: string }[] = [];

        let periodStart = issue.created;
        let currentStatus = transitions[0]?.fromString || issue.status;

        for (const transition of transitions) {
            const periodEnd = transition.created;
            rows.push({
                status: currentStatus || 'Unknown',
                from: periodStart,
                to: periodEnd,
                duration: formatDuration(periodStart, periodEnd),
            });
            currentStatus = transition.toString || currentStatus;
            periodStart = transition.created;
        }

        const finalEnd = issue.resolved || issue.updated || new Date().toISOString();
        rows.push({
            status: currentStatus || issue.status || 'Unknown',
            from: periodStart,
            to: finalEnd,
            duration: formatDuration(periodStart, finalEnd),
        });

        return rows.reverse().slice(0, 12);
    }, [issue]);

    const metadata: { label: string; value: React.ReactNode }[] = [
        ['Assignee', issue.assignee ? (
            <div key="assignee-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Avatar name={issue.assignee.displayName} size={20} />
                {issue.assignee.displayName}
            </div>
        ) : '—'],
        ['Priority', <PriorityBadge key="priority-value" priority={issue.priority} />],
        ['Sprint', issue.sprint?.name || '—'],
        ['Story Points', issue.storyPoints ?? '—'],
        ['Epic', issue.epicKey || issue.epicSummary ? formatEpicLabel(issue, '—') : '—'],
        ['Reporter', issue.reporter?.displayName || '—'],
        ['Created', fmt(issue.created)],
        ['Updated', fmt(issue.updated)],
        ['Resolved', fmt(issue.resolved)],
        ['Age', `${issue.age} days`],
        ['Cycle Time', issue.cycleTime !== null ? `${issue.cycleTime} days` : '—'],
        ['Time in Status', `${issue.timeInCurrentStatus} days`],
    ].map(([label, value]) => ({ label: String(label), value }));

    return (
        <>
            <div className="drawer-overlay" onClick={onClose} />
            <div className="drawer">
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent-light)', fontWeight: 600 }}>
                                {issue.key}
                            </span>
                            {isEpicIssue(issue) && (
                                <span
                                    className="badge"
                                    style={{ background: 'rgba(245,158,11,0.14)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' }}
                                >
                                    EPIC
                                </span>
                            )}
                            <IssueTypeBadge type={issue.issueType} />
                            <StatusBadge status={issue.status} />
                        </div>
                        <h2 style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4, color: 'var(--text-primary)' }}>
                            {issue.summary}
                        </h2>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6, flexShrink: 0 }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Actions */}
                <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                    <button
                        className={`btn btn-sm ${selectedKeys.has(issue.key) ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => toggleSelected(issue.key)}
                    >
                        {selectedKeys.has(issue.key) ? '✓ Selected for AI' : '+ Select for AI'}
                    </button>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { router.push('/ai-reports'); onClose(); }}
                    >
                        <Sparkles size={12} /> AI Summary
                    </button>
                    <a href={issue.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                        <ExternalLink size={12} /> Open in Jira
                    </a>
                </div>

                {/* Content */}
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Metadata grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {metadata.map(({ label, value }) => (
                            <div key={label}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {label}
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                                    {value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Labels */}
                    {issue.labels.length > 0 && (
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Labels</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {issue.labels.map(l => (
                                    <span key={l} className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                                        {l}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {issue.description && (
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                Description
                            </div>
                            <div style={{
                                fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
                                background: 'var(--bg-elevated)', borderRadius: 8, padding: 12,
                                maxHeight: 240, overflowY: 'auto',
                            }}>
                                <JiraRichText value={issue.description} />
                            </div>
                        </div>
                    )}

                    {/* Status History */}
                    {statusHistory.length > 0 && (
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                                <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
                                Status History
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {statusHistory.map((entry, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 80, whiteSpace: 'nowrap' }}>
                                            {format(parseISO(entry.created), 'MMM d')}
                                        </div>
                                        <div style={{ fontSize: 12 }}>
                                            <span style={{ color: 'var(--text-muted)' }}>{entry.fromString}</span>
                                            <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
                                            <span style={{ color: 'var(--accent-light)', fontWeight: 500 }}>{entry.toString}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            by {entry.author.displayName}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {statusDurations.length > 0 && (
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                                Time In Status
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {statusDurations.map((row, index) => (
                                    <div key={`${row.status}-${row.from}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                                        <div>
                                            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                                                {row.status}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {fmtShort(row.from)} → {fmtShort(row.to)}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--accent-light)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                            {row.duration}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
