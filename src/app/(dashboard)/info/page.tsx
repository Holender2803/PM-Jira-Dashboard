'use client';

const PAGE_GUIDE = [
    {
        name: 'Overview',
        path: '/',
        purpose: 'Single PM cockpit snapshot for sprint health, blockers, QA/release readiness, and attention-needed items.',
        howToUse: [
            'Start here for weekly narrative prep.',
            'Use top filters to scope by sprint, assignee, team, or epic.',
            'Click metric cards to jump into deeper dashboards.',
        ],
    },
    {
        name: 'Sprint',
        path: '/sprint',
        purpose: 'Execution-focused sprint board with committed/completed counts, points, and carryover risk.',
        howToUse: [
            'Check completion trend and status breakdown.',
            'Use stage cards to quickly isolate in-progress/review/QA/blocked tickets.',
            'Use Sprint Window quick filter to align date analysis to sprint dates.',
        ],
    },
    {
        name: 'Focus',
        path: '/focus',
        purpose: 'Shows what the team is actively working on now and where work is getting stuck.',
        howToUse: [
            'Review blocked cards first; click ticket key or summary to open details.',
            'Use Jira link for direct handoff into Jira.',
            'Use Active Epics section to identify current capacity concentration.',
        ],
    },
    {
        name: 'Work Mix',
        path: '/work-mix',
        purpose: 'Explains capacity allocation across bugs, features, developer requests, and maintenance.',
        howToUse: [
            'Track bugs vs features ratio sprint-over-sprint.',
            'Use this page in stakeholder conversations about tradeoffs.',
            'Combine with squad/epic filters to explain investment by theme.',
        ],
    },
    {
        name: 'Workflow',
        path: '/workflow',
        purpose: 'Workflow bottleneck and flow diagnostics by status/stage aging and bounce-back behavior.',
        howToUse: [
            'Use this when delivery feels slow and you need root-cause evidence.',
            'Check average time by status and blocked aging first.',
            'Use cumulative flow to explain where throughput is constrained.',
            'Use Cycle vs Lead toggle: Lead = Created→Resolved, Cycle = first In Progress→Resolved.',
            'Read histogram buckets as completion-time distribution and use P50/P75/P95 to explain typical flow vs outliers.',
        ],
    },
    {
        name: 'Bugs',
        path: '/bugs',
        purpose: 'Dedicated quality monitoring page: bug load, severity, ownership, and closure trend.',
        howToUse: [
            'Track whether bug arrival is outpacing closures.',
            'Use oldest unresolved bugs table for risk review.',
            'Use area/component grouping to identify systemic quality hotspots.',
        ],
    },
    {
        name: 'Aging',
        path: '/aging',
        purpose: 'Finds neglected/stale work and highlights unresolved aging risk by status/owner/type.',
        howToUse: [
            'Use This Week + Unresolved quick filters for weekly cleanup.',
            'Prioritize stale blocked tickets for escalation.',
            'Track aging bucket movement over time.',
        ],
    },
    {
        name: 'Epics',
        path: '/epics',
        purpose: 'Dedicated epic portfolio screen showing epic progress, blocked child work, and epic-less tickets.',
        howToUse: [
            'Use this as the core story layer for product themes and initiatives.',
            'Use Epic Info filter to compare work with epic linkage vs work without epic context.',
            'Click an epic to inspect child-ticket execution in detail.',
        ],
    },
    {
        name: 'Tickets',
        path: '/tickets',
        purpose: 'Master explorer table with selection, saved views, and CSV export.',
        howToUse: [
            'Use epic/label search filters to build custom PM views quickly.',
            'Select tickets and send to AI Reports for summary drafting.',
            'Save recurring review views (e.g., weekly review, release-ready, blockers).',
        ],
    },
    {
        name: 'AI Reports',
        path: '/ai-reports',
        purpose: 'Generates PM-ready updates from selected tickets in Confluence-friendly structure.',
        howToUse: [
            'Pick report type + tone, generate, then use Copy Full Report.',
            'Use selected tickets for focused narratives, or filtered tickets for broad updates.',
            'Reuse report history to compare narrative week-over-week.',
        ],
    },
    {
        name: 'Settings',
        path: '/settings',
        purpose: 'Connection and sync control center for Jira and AI provider behavior.',
        howToUse: [
            'Run connection checks before syncing.',
            'Use incremental sync by default; switch to full sync when needed.',
            'Keep demo mode off for live Jira data.',
        ],
    },
];

export default function InfoPage() {
    return (
        <div>
            <div className="page-header" style={{ paddingBottom: 20 }}>
                <div style={{ paddingBottom: 16 }}>
                    <h1 className="page-title">ℹ️ Dashboard Guide</h1>
                    <p className="page-subtitle">
                        What each page does, when to use it, and how to get the best PM story out of it
                    </p>
                </div>
            </div>

            <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {PAGE_GUIDE.map((page) => (
                    <div key={page.path} className="card" style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
                            <h2 style={{ fontSize: 15, margin: 0 }}>{page.name}</h2>
                            <a href={page.path} className="btn btn-secondary btn-sm">Open {page.name}</a>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                            {page.purpose}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
                            How To Use
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {page.howToUse.map((tip) => (
                                <li key={tip} style={{ fontSize: 13, color: 'var(--text-primary)' }}>{tip}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}
