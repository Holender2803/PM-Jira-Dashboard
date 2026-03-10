'use client';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { DEFAULT_BUG_TRACKING_CONFIG } from '@/lib/bug-tracking';

const DEFAULT_JQL = `(project = Engineering AND "Team/Squad[Select List (cascading)]" IN ("MDFM", "Legacy MDFM") and "Team/Squad[Select List (cascading)]" not IN ("Backoffice/OBT") AND worktype != Initiative and "Team[Team]" in (5d9f2497-c05d-466c-aac5-e05183bb3c2c-cfc65711, f5437b0c-2973-42f7-896c-2e34bcc829df)) or (project != Engineering and "Team[Team]" in (5d9f2497-c05d-466c-aac5-e05183bb3c2c-cfc65711, f5437b0c-2973-42f7-896c-2e34bcc829df)) ORDER BY status DESC, Rank ASC`;

type ConnectionState = {
    configured: boolean;
    ok: boolean;
    user?: string;
    error?: string;
};

const LOCAL_STORAGE_KEY = 'jira_dashboard_manual_credentials';

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

    useEffect(() => {
        setHydrated(true);
    }, []);

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

        load();
        loadBugTrackingConfig();

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
                                The Jira label used to tag where bugs were found. Example: add label 'source:production' or 'source:qa' to bugs in Jira.
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
        </div>
    );
}
