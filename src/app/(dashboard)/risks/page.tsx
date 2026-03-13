'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, LoadingSpinner, StatCard } from '@/components/ui/Badges';
import RiskAlertCard from '@/components/risks/RiskAlertCard';
import { StrategyRiskAlert, StrategyRiskSeverity } from '@/types/pm-os';
import { AlertTriangle, ShieldAlert, TriangleAlert } from 'lucide-react';

export default function RisksPage() {
    const [alerts, setAlerts] = useState<StrategyRiskAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [severity, setSeverity] = useState<'all' | StrategyRiskSeverity>('all');
    const [query, setQuery] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/risks/alerts', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Failed to load risks (${response.status})`);
            }
            setAlerts(await response.json() as StrategyRiskAlert[]);
        } catch (loadError) {
            setError(String(loadError));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const filtered = useMemo(() => {
        const term = query.trim().toLowerCase();
        return alerts.filter((alert) => {
            if (severity !== 'all' && alert.severity !== severity) return false;
            if (!term) return true;
            return [
                alert.title,
                alert.description,
                alert.entityTitle,
                alert.recommendation,
                alert.type,
            ].some((value) => value.toLowerCase().includes(term));
        });
    }, [alerts, query, severity]);

    const counts = useMemo(() => ({
        total: alerts.length,
        high: alerts.filter((alert) => alert.severity === 'high').length,
        medium: alerts.filter((alert) => alert.severity === 'medium').length,
        low: alerts.filter((alert) => alert.severity === 'low').length,
    }), [alerts]);

    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">🚨 Risks</h1>
                    <p className="page-subtitle">Deterministic strategy alignment alerts: missing links, stale KPIs, and Jira work with no initiative context.</p>
                </div>
            </div>

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="dashboard-grid grid-4">
                    <StatCard label="Total Alerts" value={counts.total} color="#6366f1" icon={<AlertTriangle size={16} />} />
                    <StatCard label="High" value={counts.high} color="#ef4444" icon={<ShieldAlert size={16} />} />
                    <StatCard label="Medium" value={counts.medium} color="#f59e0b" icon={<TriangleAlert size={16} />} />
                    <StatCard label="Low" value={counts.low} color="#06b6d4" icon={<AlertTriangle size={16} />} />
                </div>

                <div className="card" style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr' }}>
                    <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search risks by title, entity, recommendation, or risk type" />
                    <select className="input" value={severity} onChange={(event) => setSeverity(event.target.value as 'all' | StrategyRiskSeverity)}>
                        <option value="all">All severities</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>

                {loading ? (
                    <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <div className="card">
                        <EmptyState message={error} icon="⚠️" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="card">
                        <EmptyState message="No risks match the current filters." icon="✅" />
                    </div>
                ) : (
                    <div className="dashboard-grid grid-3">
                        {filtered.map((alert) => (
                            <RiskAlertCard key={alert.id} alert={alert} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
