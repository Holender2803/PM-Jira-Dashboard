'use client';

import { useEffect, useState } from 'react';
import { CommandCenterSummary as CommandCenterSummaryData } from '@/types/pm-os';
import RecommendationCard from '@/components/coach/RecommendationCard';
import { EmptyState, LoadingSpinner } from '@/components/ui/Badges';
import InitiativeHealthBadge from '@/components/initiatives/InitiativeHealthBadge';
import RiskAlertCard from '@/components/risks/RiskAlertCard';
import TodayPmWorkCard from './TodayPmWorkCard';
import TopPrioritiesCard from './TopPrioritiesCard';
import DecisionInboxCard from './DecisionInboxCard';

export default function CommandCenterSummary() {
    const [summary, setSummary] = useState<CommandCenterSummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch('/api/command-center/summary', { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`Failed to load command center summary (${response.status})`);
                }
                const data = await response.json() as CommandCenterSummaryData;
                setSummary(data);
            } catch (loadError) {
                setError(String(loadError));
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, []);

    if (loading) {
        return (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
                <LoadingSpinner />
            </div>
        );
    }

    if (!summary || error) {
        return (
            <div className="card">
                <EmptyState message={error || 'Command center summary unavailable.'} icon="🧭" />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                    PM Command Center
                </h2>
                <div className="dashboard-grid grid-3">
                    <TodayPmWorkCard tasks={summary.tasks} />
                    <TopPrioritiesCard rows={summary.topPriorities} />
                    <DecisionInboxCard decisions={summary.decisions} />
                </div>
            </div>

            <div>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                    PM Coach
                </h2>
                <div className="dashboard-grid grid-3">
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Onboarding Progress</div>
                        <div style={{ fontSize: 26, fontWeight: 700 }}>
                            {summary.coach.onboardingCompletedCount}/{summary.coach.onboardingTotalCount}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                            {summary.coach.nextOnboardingSteps.length > 0
                                ? `Next up: ${summary.coach.nextOnboardingSteps.map((step) => step.title).join(', ')}`
                                : 'Onboarding playbook is fully completed.'}
                        </div>
                    </div>

                    {summary.coach.recommendations.slice(0, 2).map((recommendation) => (
                        <RecommendationCard key={recommendation.id} recommendation={recommendation} />
                    ))}
                </div>
            </div>

            <div>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                    Stakeholder And Fintech Context
                </h2>
                <div className="dashboard-grid grid-2">
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>Stakeholder Memory</div>
                            <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.28)' }}>
                                {summary.stakeholders.totalCount} contacts
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.28)' }}>
                                {summary.stakeholders.externalCount} external
                            </span>
                            <span className="badge" style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.28)' }}>
                                {summary.stakeholders.recentInteractions.length} recent interactions
                            </span>
                        </div>
                        {summary.stakeholders.recentInteractions.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                No stakeholder notes logged yet.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {summary.stakeholders.recentInteractions.slice(0, 4).map((interaction) => (
                                    <div key={interaction.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg-elevated)' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{interaction.title}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                            {interaction.stakeholderName || 'Unknown stakeholder'} · {interaction.interactionDate}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>Fintech Operating Context</div>
                            <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.28)' }}>
                                {summary.fintech.totalCount} mapped items
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.28)' }}>
                                {summary.fintech.manualStepCount} manual steps
                            </span>
                            <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.28)' }}>
                                {summary.fintech.reconciliationRiskCount} reconciliation risks
                            </span>
                            <span className="badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.28)' }}>
                                {summary.fintech.missingSourceOfTruthCount} missing source of truth
                            </span>
                        </div>
                        {summary.fintech.flaggedItems.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                No high-signal fintech context items flagged yet.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {summary.fintech.flaggedItems.slice(0, 4).map((item) => (
                                    <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg-elevated)' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                            {item.contextType.replace(/_/g, ' ')}
                                            {item.sourceOfTruth ? ` · Source: ${item.sourceOfTruth}` : ' · No source of truth'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                    Strategy Alignment
                </h2>
                <div className="dashboard-grid grid-3">
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Objective Coverage</div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.28)' }}>
                                {summary.strategy.activeObjectivesCount} active objectives
                            </span>
                            <span className="badge" style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.28)' }}>
                                {summary.strategy.activeOutcomesCount} active outcomes
                            </span>
                            <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.28)' }}>
                                {summary.strategy.activeKpisCount} tracked KPIs
                            </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                            Strategy is healthy when each objective has measurable outcomes and linked initiatives driving delivery.
                        </div>
                    </div>

                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Attention Needed</div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.28)' }}>
                                {summary.strategy.objectivesAtRiskCount} at-risk objectives
                            </span>
                            <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.28)' }}>
                                {summary.strategy.staleKpisCount} stale KPIs
                            </span>
                            <span className="badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.28)' }}>
                                {summary.strategy.unlinkedInitiativesCount} unlinked initiatives
                            </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                            These are the gaps most likely to break the chain between strategy, delivery, and measurable outcomes.
                        </div>
                    </div>

                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Recommended Review</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                            Review the strategy page weekly to confirm every active initiative is tied to an objective and outcome, then log KPI measurements before monthly roadmap updates.
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                    Active Initiatives
                </h2>
                {summary.initiatives.length === 0 ? (
                    <div className="card">
                        <EmptyState message="No active initiatives yet." icon="🗺" />
                    </div>
                ) : (
                    <div className="dashboard-grid grid-3">
                        {summary.initiatives.slice(0, 6).map((initiative) => (
                            <div key={initiative.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 600 }}>{initiative.title}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                            {initiative.status.replace(/_/g, ' ')}
                                        </div>
                                    </div>
                                    <InitiativeHealthBadge health={initiative.health} />
                                </div>
                                {initiative.summary && (
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        {initiative.summary}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {initiative.ownerName && <span className="badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.3)' }}>{initiative.ownerName}</span>}
                                    {initiative.targetDate && <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.28)' }}>{initiative.targetDate}</span>}
                                    {initiative.objectiveTitle && <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.28)' }}>{initiative.objectiveTitle}</span>}
                                    {initiative.outcomeTitle && <span className="badge" style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.28)' }}>{initiative.outcomeTitle}</span>}
                                    <span className="badge" style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--text-secondary)', border: '1px solid rgba(148,163,184,0.24)' }}>
                                        {initiative.health.totalLinkedIssues} Jira links
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                    Top Strategy Risks
                </h2>
                {summary.risks.length === 0 ? (
                    <div className="card">
                        <EmptyState message="No strategy risks detected right now." icon="✅" />
                    </div>
                ) : (
                    <div className="dashboard-grid grid-3">
                        {summary.risks.map((alert) => (
                            <RiskAlertCard key={alert.id} alert={alert} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
