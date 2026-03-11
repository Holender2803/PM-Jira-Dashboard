'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AIReportResponse, AIReportTone, AIReportType } from '@/types';
import { useAppStore, useFilteredIssues } from '@/store/app-store';
import FilterBar from '@/components/filters/FilterBar';
import IssueKeyButton from '@/components/tables/IssueKeyButton';

const REPORT_TYPES: { value: AIReportType; label: string }[] = [
    { value: 'sprint_summary', label: 'Sprint Summary' },
    { value: 'stakeholder_update', label: 'Stakeholder Update' },
    { value: 'executive_summary', label: 'Executive Summary' },
    { value: 'pm_weekly', label: 'PM Weekly Update' },
    { value: 'release_notes', label: 'Release Notes Draft' },
    { value: 'blockers_summary', label: 'Risk / Blockers Summary' },
    { value: 'selected_tickets', label: 'Selected Tickets Summary' },
];

const REPORT_TONES: { value: AIReportTone; label: string }[] = [
    { value: 'executive', label: 'Executive' },
    { value: 'pm_internal', label: 'PM Internal' },
    { value: 'engineering', label: 'Engineering' },
    { value: 'slack', label: 'Concise Slack Update' },
    { value: 'polished', label: 'Polished Status Report' },
];

type CopyState = 'idle' | 'copied' | 'failed';

interface LatestSyncBriefingResponse {
    report: AIReportResponse | null;
    syncedAt: string | null;
    hasUnread: boolean;
}

interface SyncBriefingSections {
    dev: string[];
    stakeholder: string[];
}

function normalizeBullet(line: string): string {
    const stripped = line.replace(/^[\-•*]\s*/, '').trim();
    if (!stripped) return '';
    return `• ${stripped}`;
}

function toBulletLines(block: string): string[] {
    return block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map(normalizeBullet)
        .filter(Boolean);
}

function parseSyncBriefingSections(content: string): SyncBriefingSections {
    if (!content.trim()) {
        return { dev: [], stakeholder: [] };
    }

    const blocks = content
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean);

    if (blocks.length >= 2) {
        const dev = toBulletLines(blocks[0]);
        const stakeholder = toBulletLines(blocks.slice(1).join('\n\n'));
        if (dev.length > 0 || stakeholder.length > 0) {
            return { dev, stakeholder };
        }
    }

    const allBullets = toBulletLines(content);
    if (allBullets.length === 0) {
        return { dev: [], stakeholder: [] };
    }

    if (allBullets.length <= 3) {
        return { dev: allBullets, stakeholder: [] };
    }

    const stakeholderCount = allBullets.length >= 6 ? 3 : 2;
    return {
        dev: allBullets.slice(0, Math.max(1, allBullets.length - stakeholderCount)),
        stakeholder: allBullets.slice(Math.max(1, allBullets.length - stakeholderCount)),
    };
}

function formatSyncTimestamp(syncAt: string | null, generatedAt: string | null): string {
    const source = syncAt || generatedAt;
    if (!source) return 'Generated after sync recently';

    const date = new Date(source);
    if (Number.isNaN(date.getTime())) {
        return 'Generated after sync recently';
    }

    return `Generated after sync at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export default function AIReportsPage() {
    const { selectedKeys, addAIReport, aiReports, setHasUnreadSyncBriefing } = useAppStore();
    const filtered = useFilteredIssues();

    const [type, setType] = useState<AIReportType>('selected_tickets');
    const [tone, setTone] = useState<AIReportTone>('pm_internal');
    const [customInstructions, setCustomInstructions] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<AIReportResponse[]>([]);
    const [activeReport, setActiveReport] = useState<AIReportResponse | null>(null);
    const [copyState, setCopyState] = useState<CopyState>('idle');

    const [latestSyncBriefing, setLatestSyncBriefing] = useState<AIReportResponse | null>(null);
    const [latestSyncAt, setLatestSyncAt] = useState<string | null>(null);
    const [syncBriefingLoading, setSyncBriefingLoading] = useState(false);
    const [syncBriefingError, setSyncBriefingError] = useState<string | null>(null);
    const [syncRegenerating, setSyncRegenerating] = useState(false);
    const [devCopyState, setDevCopyState] = useState<CopyState>('idle');
    const [stakeholderCopyState, setStakeholderCopyState] = useState<CopyState>('idle');

    const selectedIssues = useMemo(
        () => filtered.filter((issue) => selectedKeys.has(issue.key)),
        [filtered, selectedKeys]
    );
    const combinedHistory = useMemo(() => {
        const map = new Map<string, AIReportResponse>();
        for (const report of [...aiReports, ...history]) {
            map.set(report.id, report);
        }
        return [...map.values()].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    }, [aiReports, history]);

    const syncSections = useMemo(
        () => parseSyncBriefingSections(latestSyncBriefing?.content || ''),
        [latestSyncBriefing]
    );

    const loadLatestSyncBriefing = useCallback(async (markRead = false) => {
        setSyncBriefingLoading(true);
        setSyncBriefingError(null);

        try {
            const params = new URLSearchParams({ syncBriefing: 'latest' });
            if (markRead) params.set('markRead', 'true');

            const response = await fetch(`/api/ai/report?${params.toString()}`, {
                cache: 'no-store',
            });
            if (!response.ok) {
                throw new Error('Failed to load latest sync briefing.');
            }

            const payload = await response.json() as LatestSyncBriefingResponse;
            setLatestSyncBriefing(payload.report || null);
            setLatestSyncAt(payload.syncedAt || null);
            setHasUnreadSyncBriefing(Boolean(payload.hasUnread));
        } catch (err) {
            setSyncBriefingError(String(err));
        } finally {
            setSyncBriefingLoading(false);
        }
    }, [setHasUnreadSyncBriefing]);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const res = await fetch('/api/ai/report', { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();
                if (Array.isArray(data)) setHistory(data);
            } catch {
                // Non-critical for UI.
            }
        };

        loadHistory();
        void loadLatestSyncBriefing(true);
    }, [loadLatestSyncBriefing]);

    const generateReport = async () => {
        setError(null);
        setLoading(true);

        try {
            const issueKeys = selectedKeys.size > 0
                ? Array.from(selectedKeys)
                : filtered.slice(0, 30).map((issue) => issue.key);

            const response = await fetch('/api/ai/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    tone,
                    issueKeys,
                    customInstructions: customInstructions.trim() || undefined,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate report.');
            }

            addAIReport(data);
            setHistory((current) => [data, ...current]);
            setActiveReport(data);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    const regenerateSyncBriefing = async () => {
        setSyncRegenerating(true);
        setSyncBriefingError(null);

        try {
            const response = await fetch('/api/ai/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'sync_briefing',
                    tone: 'pm_internal',
                    issueKeys: [],
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to regenerate sync briefing.');
            }

            addAIReport(data);
            setHistory((current) => [data, ...current]);
            setLatestSyncBriefing(data);
            setHasUnreadSyncBriefing(false);
            await loadLatestSyncBriefing(true);
        } catch (err) {
            setSyncBriefingError(String(err));
        } finally {
            setSyncRegenerating(false);
        }
    };

    const copyReport = async () => {
        if (!activeReport) return;
        try {
            const fullReport = `${activeReport.summary}\nGenerated: ${new Date(activeReport.generatedAt).toLocaleString()}\n\n${activeReport.content}`;
            await navigator.clipboard.writeText(fullReport);
            setCopyState('copied');
            setTimeout(() => setCopyState('idle'), 2000);
        } catch {
            setCopyState('failed');
            setTimeout(() => setCopyState('idle'), 2000);
        }
    };

    const copySyncSection = async (section: 'dev' | 'stakeholder') => {
        const lines = section === 'dev' ? syncSections.dev : syncSections.stakeholder;
        if (lines.length === 0) return;

        const setState = section === 'dev' ? setDevCopyState : setStakeholderCopyState;

        try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setState('copied');
            setTimeout(() => setState('idle'), 2000);
        } catch {
            setState('failed');
            setTimeout(() => setState('idle'), 2000);
        }
    };

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">✨ AI Reports</h1>
                    <p className="page-subtitle">
                        Generate sprint updates, stakeholder summaries, and PM reports from selected tickets
                    </p>
                </div>
            </div>

            <FilterBar />

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div className="chart-title" style={{ marginBottom: 0 }}>🔄 Latest Sync Briefing</div>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={regenerateSyncBriefing}
                            disabled={syncRegenerating || syncBriefingLoading}
                        >
                            {syncRegenerating ? 'Regenerating…' : 'Regenerate'}
                        </button>
                    </div>

                    {syncBriefingLoading ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading latest sync briefing…</div>
                    ) : latestSyncBriefing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {formatSyncTimestamp(latestSyncAt, latestSyncBriefing.generatedAt)}
                            </div>

                            <div className="dashboard-grid grid-2" style={{ gap: 14 }}>
                                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>👨‍💻 For Dev Standup</div>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => void copySyncSection('dev')}
                                            disabled={syncSections.dev.length === 0}
                                        >
                                            {devCopyState === 'copied' ? 'Copied' : devCopyState === 'failed' ? 'Copy failed' : 'Copy Dev Notes'}
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {syncSections.dev.length > 0 ? syncSections.dev.map((line, index) => (
                                            <div key={`dev-${index}`} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                                {line}
                                            </div>
                                        )) : (
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                No dev standup notes were generated yet.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>📢 For Stakeholders</div>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => void copySyncSection('stakeholder')}
                                            disabled={syncSections.stakeholder.length === 0}
                                        >
                                            {stakeholderCopyState === 'copied' ? 'Copied' : stakeholderCopyState === 'failed' ? 'Copy failed' : 'Copy Stakeholder Notes'}
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {syncSections.stakeholder.length > 0 ? syncSections.stakeholder.map((line, index) => (
                                            <div key={`stakeholder-${index}`} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                                {line}
                                            </div>
                                        )) : (
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                No stakeholder notes were generated yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {latestSyncAt
                                ? 'A sync completed, but no automatic briefing is available yet. Click Regenerate to create one.'
                                : 'Sync your Jira data to generate an automatic briefing.'}
                        </div>
                    )}

                    {syncBriefingError && (
                        <div style={{ marginTop: 10, color: 'var(--danger)', fontSize: 12 }}>
                            {syncBriefingError}
                        </div>
                    )}
                </div>

                <div className="dashboard-grid grid-2">
                    <div className="card">
                        <div className="chart-title" style={{ marginBottom: 10 }}>Generate New Report</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Report Type</label>
                            <select className="input" value={type} onChange={(event) => setType(event.target.value as AIReportType)}>
                                {REPORT_TYPES.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>

                            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Tone</label>
                            <select className="input" value={tone} onChange={(event) => setTone(event.target.value as AIReportTone)}>
                                {REPORT_TONES.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>

                            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Additional Instructions (optional)</label>
                            <textarea
                                className="input"
                                rows={4}
                                placeholder="Example: Focus on customer impact and release risks."
                                value={customInstructions}
                                onChange={(event) => setCustomInstructions(event.target.value)}
                                style={{ resize: 'vertical' }}
                            />

                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Using {selectedKeys.size > 0 ? selectedKeys.size : Math.min(filtered.length, 30)} ticket(s)
                                {selectedKeys.size === 0 && ' from current filters'}.
                            </div>

                            <button className="btn btn-primary" onClick={generateReport} disabled={loading || filtered.length === 0}>
                                {loading ? 'Generating…' : 'Generate Report'}
                            </button>

                            {error && (
                                <div style={{ color: 'var(--danger)', fontSize: 12 }}>
                                    {error}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <div className="chart-title" style={{ marginBottom: 10 }}>Selected Tickets</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                            {selectedIssues.length > 0 ? selectedIssues.map((issue) => (
                                <div key={issue.key} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                                    <IssueKeyButton
                                        issue={issue}
                                        className="btn btn-ghost btn-sm"
                                        style={{
                                            padding: 0,
                                            fontSize: 12,
                                            color: 'var(--accent-light)',
                                            fontFamily: 'monospace',
                                            fontWeight: 600,
                                        }}
                                    >
                                        {issue.key}
                                    </IssueKeyButton>
                                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{issue.summary}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {issue.status} · {issue.assignee?.displayName || 'Unassigned'}
                                    </div>
                                </div>
                            )) : (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    No explicit ticket selection yet. The report will use filtered tickets.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="dashboard-grid grid-2">
                    <div className="card">
                        <div className="chart-title" style={{ marginBottom: 10 }}>Report History</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                            {combinedHistory.slice(0, 25).map((report) => (
                                <button
                                    key={report.id}
                                    className="btn btn-ghost"
                                    style={{ justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 8 }}
                                    onClick={() => setActiveReport(report)}
                                >
                                    <span style={{ textAlign: 'left' }}>
                                        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-primary)' }}>{report.summary}</span>
                                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                                            {new Date(report.generatedAt).toLocaleString()} · {report.issueKeys.length} tickets
                                        </span>
                                    </span>
                                </button>
                            ))}
                            {combinedHistory.length === 0 && (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No reports generated yet.</div>
                            )}
                        </div>
                    </div>

                    <div className="card" style={{ minHeight: 360 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div className="chart-title" style={{ marginBottom: 0 }}>Generated Content</div>
                            {activeReport && (
                                <button className="btn btn-secondary btn-sm" onClick={copyReport}>
                                    {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy Full Report'}
                                </button>
                            )}
                        </div>
                        {activeReport ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {activeReport.type} · {activeReport.tone} · Confluence-friendly format
                                </div>
                                <pre
                                    style={{
                                        whiteSpace: 'pre-wrap',
                                        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
                                        fontSize: 13,
                                        color: 'var(--text-primary)',
                                        lineHeight: 1.75,
                                        maxHeight: 420,
                                        overflowY: 'auto',
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        padding: 14,
                                    }}
                                >
                                    {activeReport.content}
                                </pre>
                            </div>
                        ) : (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Generate or select a report to preview content.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
