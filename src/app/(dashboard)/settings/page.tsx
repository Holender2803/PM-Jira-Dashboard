'use client';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { DEFAULT_BUG_TRACKING_CONFIG } from '@/lib/bug-tracking';
import { DEFAULT_TEAM_CONFIG, type TeamConfig } from '@/lib/team-config';

const DEFAULT_JQL = `(project = Engineering AND "Team/Squad[Select List (cascading)]" IN ("MDFM", "Legacy MDFM") and "Team/Squad[Select List (cascading)]" not IN ("Backoffice/OBT") AND worktype != Initiative and "Team[Team]" in (5d9f2497-c05d-466c-aac5-e05183bb3c2c-cfc65711, f5437b0c-2973-42f7-896c-2e34bcc829df)) or (project != Engineering and "Team[Team]" in (5d9f2497-c05d-466c-aac5-e05183bb3c2c-cfc65711, f5437b0c-2973-42f7-896c-2e34bcc829df)) ORDER BY status DESC, Rank ASC`;

type ConnectionState = {
    configured: boolean;
    ok: boolean;
    user?: string;
    error?: string;
};

type ReportScheduleAudience = 'team' | 'executive' | 'client';

interface ReportScheduleConfig {
    enabled: boolean;
    dayOfWeek: string;
    time: string;
    audience: ReportScheduleAudience;
    lastRunAt: string | null;
    nextRunAt: string | null;
}

interface StatusReportSummary {
    id: string;
    generatedAt: string;
    audience: ReportScheduleAudience;
    sprintName: string;
    content: string;
    isAuto: boolean;
}

const LOCAL_STORAGE_KEY = 'jira_dashboard_manual_credentials';
const USD_FORMATTER = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
});
const DEFAULT_REPORT_SCHEDULE: ReportScheduleConfig = {
    enabled: false,
    dayOfWeek: 'Friday',
    time: '09:00',
    audience: 'executive',
    lastRunAt: null,
    nextRunAt: null,
};
const REPORT_WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toPositiveInteger(value: number, fallback: number): number {
    if (!Number.isFinite(value)) return fallback;
    const rounded = Math.round(value);
    return rounded > 0 ? rounded : fallback;
}

function formatUsd(value: number): string {
    return USD_FORMATTER.format(value);
}

export default function SettingsPage() {
    const { demoMode } = useAppStore();
    const [hydrated, setHydrated] = useState(false);

    const [baseUrl, setBaseUrl] = useState('');
    const [email, setEmail] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [jql, setJql] = useState(DEFAULT_JQL);
    const [incremental, setIncremental] = useState(true);

    const [connection, setConnection] = useState<ConnectionState | null>(null);
    const [busy, setBusy] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);

    const [bugSourceLabel, setBugSourceLabel] = useState(DEFAULT_BUG_TRACKING_CONFIG.bugSourceLabel);
    const [productionSourceKeywords, setProductionSourceKeywords] = useState(DEFAULT_BUG_TRACKING_CONFIG.productionKeywords);
    const [qaSourceKeywords, setQaSourceKeywords] = useState(DEFAULT_BUG_TRACKING_CONFIG.qaKeywords);
    const [bugTrackingConfigured, setBugTrackingConfigured] = useState(false);
    const [bugTrackingBusy, setBugTrackingBusy] = useState(false);
    const [bugTrackingResult, setBugTrackingResult] = useState<string | null>(null);

    const [teamName, setTeamName] = useState(DEFAULT_TEAM_CONFIG.teamName);
    const [activeEngineers, setActiveEngineers] = useState(DEFAULT_TEAM_CONFIG.activeEngineers);
    const [hourlyRate, setHourlyRate] = useState(DEFAULT_TEAM_CONFIG.hourlyRate);
    const [productiveHoursPerSprint, setProductiveHoursPerSprint] = useState(DEFAULT_TEAM_CONFIG.productiveHoursPerSprint);
    const [sprintLengthWeeks, setSprintLengthWeeks] = useState(DEFAULT_TEAM_CONFIG.sprintLengthWeeks);
    const [teamConfigBusy, setTeamConfigBusy] = useState(false);
    const [teamConfigResult, setTeamConfigResult] = useState<string | null>(null);
    const [teamConfigToast, setTeamConfigToast] = useState<string | null>(null);

    const [reportScheduleEnabled, setReportScheduleEnabled] = useState(DEFAULT_REPORT_SCHEDULE.enabled);
    const [reportScheduleDayOfWeek, setReportScheduleDayOfWeek] = useState(DEFAULT_REPORT_SCHEDULE.dayOfWeek);
    const [reportScheduleTime, setReportScheduleTime] = useState(DEFAULT_REPORT_SCHEDULE.time);
    const [reportScheduleAudience, setReportScheduleAudience] = useState<ReportScheduleAudience>(DEFAULT_REPORT_SCHEDULE.audience);
    const [reportScheduleLastRunAt, setReportScheduleLastRunAt] = useState<string | null>(DEFAULT_REPORT_SCHEDULE.lastRunAt);
    const [reportScheduleNextRunAt, setReportScheduleNextRunAt] = useState<string | null>(DEFAULT_REPORT_SCHEDULE.nextRunAt);
    const [reportScheduleBusy, setReportScheduleBusy] = useState(false);
    const [reportScheduleResult, setReportScheduleResult] = useState<string | null>(null);
    const [reportRunBusy, setReportRunBusy] = useState(false);
    const [recentStatusReports, setRecentStatusReports] = useState<StatusReportSummary[]>([]);

    useEffect(() => {
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!teamConfigToast) return;

        const timeoutId = window.setTimeout(() => {
            setTeamConfigToast(null);
        }, 2400);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [teamConfigToast]);

    useEffect(() => {
        const load = async () => {
            const res = await fetch('/api/sync', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            setConnection(data);
        };

        const loadBugTrackingConfig = async () => {
            try {
                const res = await fetch('/api/bug-tracking-config', { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json() as {
                    bugSourceLabel: string;
                    productionKeywords: string;
                    qaKeywords: string;
                    configured: boolean;
                };

                setBugSourceLabel(data.bugSourceLabel || DEFAULT_BUG_TRACKING_CONFIG.bugSourceLabel);
                setProductionSourceKeywords(data.productionKeywords || DEFAULT_BUG_TRACKING_CONFIG.productionKeywords);
                setQaSourceKeywords(data.qaKeywords || DEFAULT_BUG_TRACKING_CONFIG.qaKeywords);
                setBugTrackingConfigured(Boolean(data.configured));
            } catch {
                // Keep defaults when config is unavailable.
            }
        };

        const loadTeamConfig = async () => {
            try {
                const res = await fetch('/api/team-config', { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json() as TeamConfig;

                setTeamName((data.teamName || '').trim() || DEFAULT_TEAM_CONFIG.teamName);
                setActiveEngineers(toPositiveInteger(data.activeEngineers, DEFAULT_TEAM_CONFIG.activeEngineers));
                setHourlyRate(toPositiveInteger(data.hourlyRate, DEFAULT_TEAM_CONFIG.hourlyRate));
                setProductiveHoursPerSprint(
                    toPositiveInteger(
                        data.productiveHoursPerSprint,
                        DEFAULT_TEAM_CONFIG.productiveHoursPerSprint
                    )
                );
                setSprintLengthWeeks(toPositiveInteger(data.sprintLengthWeeks, DEFAULT_TEAM_CONFIG.sprintLengthWeeks));
            } catch {
                // Keep defaults when config is unavailable.
            }
        };

        const loadReportSchedule = async () => {
            try {
                const res = await fetch('/api/report-schedule', { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json() as ReportScheduleConfig;

                setReportScheduleEnabled(Boolean(data.enabled));
                setReportScheduleDayOfWeek(data.dayOfWeek || DEFAULT_REPORT_SCHEDULE.dayOfWeek);
                setReportScheduleTime(data.time || DEFAULT_REPORT_SCHEDULE.time);
                setReportScheduleAudience(
                    data.audience === 'team' || data.audience === 'client' || data.audience === 'executive'
                        ? data.audience
                        : DEFAULT_REPORT_SCHEDULE.audience
                );
                setReportScheduleLastRunAt(data.lastRunAt || null);
                setReportScheduleNextRunAt(data.nextRunAt || null);
            } catch {
                // Keep defaults when schedule config is unavailable.
            }
        };

        const loadStatusReports = async () => {
            try {
                const res = await fetch('/api/reports/status', { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json() as StatusReportSummary[];
                setRecentStatusReports(Array.isArray(data) ? data : []);
            } catch {
                // Keep status report list empty if unavailable.
            }
        };

        load();
        loadBugTrackingConfig();
        loadTeamConfig();
        loadReportSchedule();
        loadStatusReports();

        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as {
                    baseUrl?: string;
                    email?: string;
                    apiToken?: string;
                    jql?: string;
                };
                setBaseUrl(parsed.baseUrl || '');
                setEmail(parsed.email || '');
                setApiToken(parsed.apiToken || '');
                if (parsed.jql) setJql(parsed.jql);
            } catch {
                // Ignore invalid local storage payload.
            }
        }
    }, []);

    if (!hydrated) {
        return (
            <div>
                <div className="page-header" style={{ paddingBottom: 20 }}>
                    <div style={{ paddingBottom: 16 }}>
                        <h1 className="page-title">⚙️ Settings</h1>
                        <p className="page-subtitle">Loading settings...</p>
                    </div>
                </div>
            </div>
        );
    }

    const saveLocalCredentials = () => {
        localStorage.setItem(
            LOCAL_STORAGE_KEY,
            JSON.stringify({ baseUrl, email, apiToken, jql })
        );
    };

    const testManualConnection = async () => {
        setBusy(true);
        setSyncResult(null);
        try {
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseUrl,
                    email,
                    apiToken,
                    testOnly: true,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                setSyncResult(`Connection failed: ${data.error || 'Unknown error'}`);
            } else {
                setSyncResult(`Connection successful as ${data.user || 'Jira user'}.`);
            }
        } catch (error) {
            setSyncResult(`Connection failed: ${String(error)}`);
        } finally {
            setBusy(false);
        }
    };

    const runManualSync = async () => {
        setBusy(true);
        setSyncResult(null);
        try {
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseUrl: baseUrl || undefined,
                    email: email || undefined,
                    apiToken: apiToken || undefined,
                    jql,
                    incremental,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                setSyncResult(`Sync failed: ${data.error || 'Unknown error'}`);
            } else {
                setSyncResult(`Sync complete: ${data.synced} issues (${data.incremental ? 'incremental' : 'full'}).`);
            }
        } catch (error) {
            setSyncResult(`Sync failed: ${String(error)}`);
        } finally {
            setBusy(false);
        }
    };

    const runServerSync = async () => {
        setBusy(true);
        setSyncResult(null);
        try {
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ incremental }),
            });
            const data = await response.json();
            if (!response.ok) {
                setSyncResult(`Server sync failed: ${data.error || 'Unknown error'}`);
            } else {
                setSyncResult(`Server sync complete: ${data.synced} issues (${data.incremental ? 'incremental' : 'full'}).`);
            }
        } catch (error) {
            setSyncResult(`Server sync failed: ${String(error)}`);
        } finally {
            setBusy(false);
        }
    };

    const saveBugTrackingConfig = async () => {
        setBugTrackingBusy(true);
        setBugTrackingResult(null);

        try {
            const response = await fetch('/api/bug-tracking-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bugSourceLabel,
                    productionKeywords: productionSourceKeywords,
                    qaKeywords: qaSourceKeywords,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                setBugTrackingResult(`Save failed: ${data.error || 'Unknown error'}`);
            } else {
                setBugTrackingConfigured(true);
                setBugTrackingResult('Bug tracking settings saved.');
            }
        } catch (error) {
            setBugTrackingResult(`Save failed: ${String(error)}`);
        } finally {
            setBugTrackingBusy(false);
        }
    };

    const safeActiveEngineers = toPositiveInteger(activeEngineers, DEFAULT_TEAM_CONFIG.activeEngineers);
    const safeHourlyRate = toPositiveInteger(hourlyRate, DEFAULT_TEAM_CONFIG.hourlyRate);
    const safeProductiveHoursPerSprint = toPositiveInteger(
        productiveHoursPerSprint,
        DEFAULT_TEAM_CONFIG.productiveHoursPerSprint
    );
    const safeSprintLengthWeeks = toPositiveInteger(sprintLengthWeeks, DEFAULT_TEAM_CONFIG.sprintLengthWeeks);

    const oneDeveloperSprintCost = safeProductiveHoursPerSprint * safeHourlyRate;
    const fullTeamSprintCost = oneDeveloperSprintCost * safeActiveEngineers;
    const annualSprints = 46 / safeSprintLengthWeeks;
    const annualTeamCost = fullTeamSprintCost * annualSprints;
    const annualSprintsLabel = Number.isInteger(annualSprints)
        ? String(annualSprints)
        : annualSprints.toFixed(1);

    const saveTeamConfig = async () => {
        setTeamConfigBusy(true);
        setTeamConfigResult(null);

        try {
            const response = await fetch('/api/team-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamName: (teamName || '').trim() || DEFAULT_TEAM_CONFIG.teamName,
                    activeEngineers: safeActiveEngineers,
                    hourlyRate: safeHourlyRate,
                    productiveHoursPerSprint: safeProductiveHoursPerSprint,
                    sprintLengthWeeks: safeSprintLengthWeeks,
                }),
            });
            const data = await response.json() as {
                error?: string;
                config?: TeamConfig;
            };

            if (!response.ok) {
                setTeamConfigResult(`Save failed: ${data.error || 'Unknown error'}`);
                return;
            }

            const config = data.config;
            if (config) {
                setTeamName((config.teamName || '').trim() || DEFAULT_TEAM_CONFIG.teamName);
                setActiveEngineers(toPositiveInteger(config.activeEngineers, DEFAULT_TEAM_CONFIG.activeEngineers));
                setHourlyRate(toPositiveInteger(config.hourlyRate, DEFAULT_TEAM_CONFIG.hourlyRate));
                setProductiveHoursPerSprint(
                    toPositiveInteger(
                        config.productiveHoursPerSprint,
                        DEFAULT_TEAM_CONFIG.productiveHoursPerSprint
                    )
                );
                setSprintLengthWeeks(toPositiveInteger(config.sprintLengthWeeks, DEFAULT_TEAM_CONFIG.sprintLengthWeeks));
            }

            setTeamConfigToast('Team configuration saved ✓');
        } catch (error) {
            setTeamConfigResult(`Save failed: ${String(error)}`);
        } finally {
            setTeamConfigBusy(false);
        }
    };

    const saveReportSchedule = async () => {
        setReportScheduleBusy(true);
        setReportScheduleResult(null);

        try {
            const response = await fetch('/api/report-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: reportScheduleEnabled,
                    dayOfWeek: reportScheduleDayOfWeek,
                    time: reportScheduleTime,
                    audience: reportScheduleAudience,
                }),
            });

            const data = await response.json() as {
                error?: string;
                schedule?: ReportScheduleConfig;
            };

            if (!response.ok || !data.schedule) {
                setReportScheduleResult(`Save failed: ${data.error || 'Unknown error'}`);
                return;
            }

            const schedule = data.schedule;
            setReportScheduleEnabled(Boolean(schedule.enabled));
            setReportScheduleDayOfWeek(schedule.dayOfWeek || DEFAULT_REPORT_SCHEDULE.dayOfWeek);
            setReportScheduleTime(schedule.time || DEFAULT_REPORT_SCHEDULE.time);
            setReportScheduleAudience(
                schedule.audience === 'team' || schedule.audience === 'client' || schedule.audience === 'executive'
                    ? schedule.audience
                    : DEFAULT_REPORT_SCHEDULE.audience
            );
            setReportScheduleLastRunAt(schedule.lastRunAt || null);
            setReportScheduleNextRunAt(schedule.nextRunAt || null);
            setReportScheduleResult('Scheduled report settings saved.');
        } catch (error) {
            setReportScheduleResult(`Save failed: ${String(error)}`);
        } finally {
            setReportScheduleBusy(false);
        }
    };

    const runStatusReportNow = async () => {
        setReportRunBusy(true);
        setReportScheduleResult(null);

        try {
            const response = await fetch('/api/reports/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audience: reportScheduleAudience,
                    isAuto: false,
                }),
            });

            const data = await response.json() as StatusReportSummary & { error?: string };
            if (!response.ok || !data.id) {
                setReportScheduleResult(`Generate failed: ${data.error || 'Unknown error'}`);
                return;
            }

            setRecentStatusReports((current) => [data, ...current.filter((report) => report.id !== data.id)].slice(0, 10));
            setReportScheduleResult(`Generated a ${data.audience} report for ${data.sprintName}.`);
        } catch (error) {
            setReportScheduleResult(`Generate failed: ${String(error)}`);
        } finally {
            setReportRunBusy(false);
        }
    };

    const scheduleLastRunLabel = reportScheduleLastRunAt
        ? new Date(reportScheduleLastRunAt).toLocaleString()
        : 'Not run yet';
    const scheduleNextRunLabel = reportScheduleNextRunAt
        ? new Date(reportScheduleNextRunAt).toLocaleString()
        : 'Not scheduled';
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">⚙️ Settings</h1>
                    <p className="page-subtitle">
                        Configure Jira connection behavior, sync options, and PM dashboard data scope
                    </p>
                </div>
            </div>

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {demoMode && (
                    <div className="demo-banner" style={{ borderRadius: 10 }}>
                        <span>Demo mode is enabled. Live Jira sync will only run when `NEXT_PUBLIC_DEMO_MODE=false`.</span>
                    </div>
                )}

                <div className="dashboard-grid grid-2">
                    <div className="card">
                        <div className="chart-title" style={{ marginBottom: 10 }}>Server Environment Status</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                            <div>Configured: <strong>{connection?.configured ? 'Yes' : 'No'}</strong></div>
                            <div>Connection: <strong style={{ color: connection?.ok ? 'var(--success)' : 'var(--warning)' }}>{connection?.ok ? 'Healthy' : 'Not tested / failed'}</strong></div>
                            {connection?.user && <div>Authenticated user: {connection.user}</div>}
                            {connection?.error && <div style={{ color: 'var(--danger)' }}>{connection.error}</div>}
                        </div>
                        <div style={{ marginTop: 12 }}>
                            <button className="btn btn-secondary btn-sm" onClick={runServerSync} disabled={busy}>
                                Run Sync with Server Env
                            </button>
                        </div>
                    </div>

                    <div className="card">
                        <div className="chart-title" style={{ marginBottom: 10 }}>Sync Options</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                            <input
                                type="checkbox"
                                checked={incremental}
                                onChange={(event) => setIncremental(event.target.checked)}
                                style={{ accentColor: 'var(--accent)' }}
                            />
                            Incremental sync (fetch recently updated issues)
                        </label>
                        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                            Disable this to force a full sync of all matching Jira issues.
                        </p>
                    </div>
                </div>

                <div className="card">
                    <div className="chart-title" style={{ marginBottom: 10 }}>Manual Jira Credentials (kept in browser local storage)</div>
                    <div className="dashboard-grid grid-3">
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Jira Base URL</label>
                            <input className="input" placeholder="https://yourcompany.atlassian.net" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>User Email</label>
                            <input className="input" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>API Token</label>
                            <input className="input" type="password" placeholder="Atlassian API token" value={apiToken} onChange={(event) => setApiToken(event.target.value)} />
                        </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>JQL Scope</label>
                        <textarea className="input" rows={6} value={jql} onChange={(event) => setJql(event.target.value)} style={{ resize: 'vertical' }} />
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" disabled={busy || !baseUrl || !email || !apiToken} onClick={testManualConnection}>
                            Test Manual Connection
                        </button>
                        <button className="btn btn-primary btn-sm" disabled={busy} onClick={runManualSync}>
                            Run Manual Sync
                        </button>
                        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={saveLocalCredentials}>
                            Save in Browser
                        </button>
                    </div>
                </div>

                <div id="team-configuration" className="card" style={{ scrollMarginTop: 90 }}>
                    <div className="chart-title" style={{ marginBottom: 10 }}>💰 Team Configuration</div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                        Baseline capacity and cost assumptions used across dashboard calculations.
                    </p>

                    <div className="dashboard-grid grid-2">
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                Team name
                            </label>
                            <input
                                className="input"
                                value={teamName}
                                onChange={(event) => setTeamName(event.target.value)}
                                placeholder="Engineering Team"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                Number of active engineers
                            </label>
                            <input
                                className="input"
                                type="number"
                                min={1}
                                step={1}
                                value={activeEngineers}
                                onChange={(event) => setActiveEngineers(toPositiveInteger(Number(event.target.value), activeEngineers))}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                Assumed hourly rate in USD
                            </label>
                            <input
                                className="input"
                                type="number"
                                min={1}
                                step={1}
                                value={hourlyRate}
                                onChange={(event) => setHourlyRate(toPositiveInteger(Number(event.target.value), hourlyRate))}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                Productive hours per sprint per developer
                            </label>
                            <input
                                className="input"
                                type="number"
                                min={1}
                                step={1}
                                value={productiveHoursPerSprint}
                                onChange={(event) => setProductiveHoursPerSprint(toPositiveInteger(Number(event.target.value), productiveHoursPerSprint))}
                            />
                            <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                                Typical range: 40-60 hours after meetings and code reviews
                            </p>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                Sprint length in weeks
                            </label>
                            <input
                                className="input"
                                type="number"
                                min={1}
                                step={1}
                                value={sprintLengthWeeks}
                                onChange={(event) => setSprintLengthWeeks(toPositiveInteger(Number(event.target.value), sprintLengthWeeks))}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-elevated)', padding: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            Based on your config:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                            <div>• 1 developer sprint ≈ {formatUsd(oneDeveloperSprintCost)}</div>
                            <div>• Full team sprint ≈ {formatUsd(fullTeamSprintCost)}</div>
                            <div>• Annual capacity: ~{annualSprintsLabel} sprints per year</div>
                            <div>• Annual team cost: ~{formatUsd(annualTeamCost)}</div>
                        </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" onClick={saveTeamConfig} disabled={teamConfigBusy}>
                            {teamConfigBusy ? 'Saving...' : 'Save Team Configuration'}
                        </button>
                    </div>

                    {teamConfigResult && (
                        <div style={{ marginTop: 8, fontSize: 12, color: teamConfigResult.startsWith('Save failed') ? 'var(--danger)' : 'var(--text-secondary)' }}>
                            {teamConfigResult}
                        </div>
                    )}
                </div>

                <div id="scheduled-reports" className="card" style={{ scrollMarginTop: 90 }}>
                    <div className="chart-title" style={{ marginBottom: 10 }}>📅 Scheduled Reports</div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                        Configure automatic weekly status report generation during sync refresh.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                            <input
                                type="checkbox"
                                checked={reportScheduleEnabled}
                                onChange={(event) => setReportScheduleEnabled(event.target.checked)}
                                style={{ accentColor: 'var(--accent)' }}
                            />
                            Enable weekly report
                        </label>

                        <div className="dashboard-grid grid-3">
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                    Day of week
                                </label>
                                <select
                                    className="input"
                                    value={reportScheduleDayOfWeek}
                                    onChange={(event) => setReportScheduleDayOfWeek(event.target.value)}
                                    disabled={!reportScheduleEnabled}
                                >
                                    {REPORT_WEEK_DAYS.map((day) => (
                                        <option key={day} value={day}>{day}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                    Time
                                </label>
                                <input
                                    className="input"
                                    type="time"
                                    value={reportScheduleTime}
                                    onChange={(event) => setReportScheduleTime(event.target.value || DEFAULT_REPORT_SCHEDULE.time)}
                                    disabled={!reportScheduleEnabled}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                    Default audience
                                </label>
                                <select
                                    className="input"
                                    value={reportScheduleAudience}
                                    onChange={(event) => setReportScheduleAudience(event.target.value as ReportScheduleAudience)}
                                    disabled={!reportScheduleEnabled}
                                >
                                    <option value="team">Team</option>
                                    <option value="executive">Executive</option>
                                    <option value="client">Client</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                            <div>Last run: {scheduleLastRunLabel}</div>
                            <div>Next run: {scheduleNextRunLabel}</div>
                            <div>Timezone: {browserTimeZone}</div>
                            <div>Trigger: reports are generated when the app performs a sync after the scheduled time.</div>
                        </div>

                        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Schedule Preview</div>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                                {reportScheduleEnabled
                                    ? `${reportScheduleAudience.charAt(0).toUpperCase()}${reportScheduleAudience.slice(1)} report every ${reportScheduleDayOfWeek} at ${reportScheduleTime}.`
                                    : 'Scheduled reporting is currently disabled.'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Use “Generate now” to validate the prompt quality and delivery format before relying on the weekly schedule.
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <button className="btn btn-primary btn-sm" onClick={saveReportSchedule} disabled={reportScheduleBusy}>
                                {reportScheduleBusy ? 'Saving...' : 'Save Scheduled Reports'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={runStatusReportNow} disabled={reportRunBusy}>
                                {reportRunBusy ? 'Generating...' : 'Generate Now'}
                            </button>
                        </div>

                        {reportScheduleResult && (
                            <div style={{ fontSize: 12, color: reportScheduleResult.startsWith('Save failed') || reportScheduleResult.startsWith('Generate failed') ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                {reportScheduleResult}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Recent Reports</div>
                            {recentStatusReports.length === 0 ? (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    No status reports generated yet.
                                </div>
                            ) : recentStatusReports.slice(0, 4).map((report) => (
                                <div key={report.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'rgba(15,23,42,0.35)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{report.sprintName}</div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span className="badge" style={{ background: 'rgba(99,102,241,0.14)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.28)' }}>
                                                {report.audience}
                                            </span>
                                            <span className="badge" style={{ background: report.isAuto ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.14)', color: report.isAuto ? '#10b981' : '#fbbf24', border: `1px solid ${report.isAuto ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                                                {report.isAuto ? 'Auto' : 'Manual'}
                                            </span>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {new Date(report.generatedAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                        {report.content.slice(0, 220)}{report.content.length > 220 ? '…' : ''}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div id="bug-tracking" className="card" style={{ scrollMarginTop: 90 }}>
                    <div className="chart-title" style={{ marginBottom: 10 }}>Bug Tracking</div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                        Configure how bug source labels are interpreted for escape-rate tracking.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                Bug Source Label
                            </label>
                            <input
                                className="input"
                                value={bugSourceLabel}
                                onChange={(event) => setBugSourceLabel(event.target.value)}
                                placeholder="source"
                            />
                            <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                                The Jira label used to tag where bugs were found. Example: add label &apos;source:production&apos; or &apos;source:qa&apos; to bugs in Jira.
                            </p>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                Production source keywords
                            </label>
                            <input
                                className="input"
                                value={productionSourceKeywords}
                                onChange={(event) => setProductionSourceKeywords(event.target.value)}
                                placeholder="production, prod, client-reported, escaped"
                            />
                            <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                                Comma-separated label values that indicate a bug was found in production.
                            </p>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                QA source keywords
                            </label>
                            <input
                                className="input"
                                value={qaSourceKeywords}
                                onChange={(event) => setQaSourceKeywords(event.target.value)}
                                placeholder="qa, testing, internal, caught-in-qa"
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" onClick={saveBugTrackingConfig} disabled={bugTrackingBusy}>
                            Save Bug Tracking Settings
                        </button>
                        {bugTrackingConfigured && (
                            <span className="badge" style={{ background: 'rgba(16,185,129,0.14)', color: '#10b981', border: '1px solid rgba(16,185,129,0.35)' }}>
                                Configured
                            </span>
                        )}
                    </div>

                    {bugTrackingResult && (
                        <div style={{ marginTop: 8, fontSize: 12, color: bugTrackingResult.startsWith('Save failed') ? 'var(--danger)' : 'var(--text-secondary)' }}>
                            {bugTrackingResult}
                        </div>
                    )}
                </div>

                {syncResult && (
                    <div className="card" style={{ padding: 14, fontSize: 13 }}>
                        {syncResult}
                    </div>
                )}

                <div className="card" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Security note: Jira secrets are used server-side for API calls and are never exposed in dashboard responses. Manual credentials entered here are stored only in your browser local storage and posted to `/api/sync` when you trigger actions.
                </div>
            </div>

            {teamConfigToast && (
                <div
                    role="status"
                    aria-live="polite"
                    style={{
                        position: 'fixed',
                        right: 24,
                        bottom: 24,
                        background: 'rgba(16,185,129,0.14)',
                        border: '1px solid rgba(16,185,129,0.35)',
                        color: '#6ee7b7',
                        borderRadius: 10,
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        zIndex: 50,
                    }}
                >
                    {teamConfigToast}
                </div>
            )}
        </div>
    );
}
