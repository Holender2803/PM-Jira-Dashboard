'use client';
import { useEffect, useMemo, useState } from 'react';
import { AIReportResponse, AIReportTone, AIReportType } from '@/types';
import { useAppStore, useFilteredIssues } from '@/store/app-store';
import FilterBar from '@/components/filters/FilterBar';

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

export default function AIReportsPage() {
    const { selectedKeys, addAIReport, aiReports } = useAppStore();
    const filtered = useFilteredIssues();

    const [type, setType] = useState<AIReportType>('selected_tickets');
    const [tone, setTone] = useState<AIReportTone>('pm_internal');
    const [customInstructions, setCustomInstructions] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<AIReportResponse[]>([]);
    const [activeReport, setActiveReport] = useState<AIReportResponse | null>(null);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

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
    }, []);

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
                                    <div style={{ fontSize: 12, color: 'var(--accent-light)', fontFamily: 'monospace' }}>{issue.key}</div>
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
