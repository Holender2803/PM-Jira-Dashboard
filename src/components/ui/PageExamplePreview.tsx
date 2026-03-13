'use client';

interface ExampleStat {
    label: string;
    value: string;
    tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info';
}

interface ExampleSection {
    title: string;
    description?: string;
    items: string[];
}

interface ExampleTable {
    headers: string[];
    rows: string[][];
}

interface ExamplePreview {
    title: string;
    subtitle: string;
    chips?: string[];
    stats: ExampleStat[];
    sections: ExampleSection[];
    table?: ExampleTable;
}

const TONE_STYLES: Record<NonNullable<ExampleStat['tone']>, { border: string; background: string; color: string }> = {
    accent: {
        border: 'rgba(99,102,241,0.35)',
        background: 'rgba(99,102,241,0.12)',
        color: '#c7d2fe',
    },
    success: {
        border: 'rgba(16,185,129,0.35)',
        background: 'rgba(16,185,129,0.12)',
        color: '#6ee7b7',
    },
    warning: {
        border: 'rgba(245,158,11,0.35)',
        background: 'rgba(245,158,11,0.12)',
        color: '#fcd34d',
    },
    danger: {
        border: 'rgba(239,68,68,0.35)',
        background: 'rgba(239,68,68,0.12)',
        color: '#fca5a5',
    },
    info: {
        border: 'rgba(6,182,212,0.35)',
        background: 'rgba(6,182,212,0.12)',
        color: '#67e8f9',
    },
};

const DEFAULT_PREVIEW: ExamplePreview = {
    title: 'Example workspace view',
    subtitle: 'This is a filled example showing the kind of information this page should contain once the workspace is in use.',
    chips: ['Filled example', 'Guide mode'],
    stats: [
        { label: 'Items In View', value: '12', tone: 'accent' },
        { label: 'Needs Attention', value: '3', tone: 'warning' },
        { label: 'Healthy', value: '7', tone: 'success' },
        { label: 'Follow-Ups', value: '2', tone: 'info' },
    ],
    sections: [
        {
            title: 'Primary working area',
            items: [
                'Example records appear here with real titles, owners, status, and dates.',
                'Use the guide checklist above to understand which fields should be filled first.',
            ],
        },
        {
            title: 'What a healthy page looks like',
            items: [
                'Records are linked to the surrounding Jira, initiative, or strategy context.',
                'Free-text notes explain why something matters, not just what exists.',
            ],
        },
    ],
};

const PREVIEW_BY_PATH: Record<string, ExamplePreview> = {
    '/': {
        title: 'Monday command center snapshot',
        subtitle: 'A PM starts here to decide what needs intervention before diving into any single workspace.',
        chips: ['Today', 'Needs action first', 'Cross-workspace summary'],
        stats: [
            { label: 'Overdue PM Work', value: '3', tone: 'danger' },
            { label: 'Active Initiatives', value: '6', tone: 'accent' },
            { label: 'Top Priorities', value: '5', tone: 'success' },
            { label: 'Open Decisions', value: '2', tone: 'warning' },
        ],
        sections: [
            {
                title: 'Today’s PM Work',
                items: [
                    'Follow up with engineering on blocked ACH reconciliation story.',
                    'Send stakeholder update for onboarding activation initiative.',
                    'Prepare launch readiness review for self-serve bank linking.',
                ],
            },
            {
                title: 'Active Initiatives',
                items: [
                    'Improve onboarding activation: 68% of linked Jira scope complete, one blocker in QA.',
                    'Reduce manual reconciliation: discovery complete, engineering start next sprint.',
                    'Executive reporting refresh: on hold pending finance data-source decision.',
                ],
            },
            {
                title: 'Decision Inbox',
                items: [
                    'Draft: decide whether to gate self-serve onboarding behind KYC completion.',
                    'Recent: scope tradeoff approved for reconciliation exports.',
                ],
            },
            {
                title: 'Signals worth attention',
                items: [
                    'Velocity is stable, but blocked tickets rose from 2 to 5.',
                    'One top-priority initiative has no KPI movement logged this month.',
                ],
            },
        ],
        table: {
            headers: ['Priority', 'Type', 'Score', 'Why It Is High'],
            rows: [
                ['Improve onboarding activation', 'Initiative', '96.0', 'High reach and fast time-to-value'],
                ['FIN-284 tighten reconciliation alerts', 'Jira Epic', '72.0', 'Reduces operational risk'],
                ['FIN-311 client onboarding exports', 'Story', '45.0', 'Supports sales commitment'],
            ],
        },
    },
    '/initiatives': {
        title: 'Filled initiative portfolio',
        subtitle: 'Use this page when you want initiative context that Jira alone does not capture cleanly.',
        chips: ['Portfolio view', 'Linked Jira progress', 'Owner + outcome context'],
        stats: [
            { label: 'Active', value: '4', tone: 'accent' },
            { label: 'At Risk', value: '1', tone: 'warning' },
            { label: 'Done', value: '2', tone: 'success' },
            { label: 'Without Objective', value: '1', tone: 'danger' },
        ],
        sections: [
            {
                title: 'Example initiative card',
                items: [
                    'Title: Improve onboarding activation',
                    'Summary: Reduce first-value time for new finance customers by simplifying data connection steps.',
                    'Notes: Evidence points to drop-off after initial data mapping and unclear success criteria.',
                ],
            },
            {
                title: 'Example linked context',
                items: [
                    'Objective: Improve onboarding success rate',
                    'Outcome: Reduce onboarding time from 4 weeks to 2 weeks',
                    'Linked Jira: FIN-120, FIN-184, FIN-221, FIN-244',
                ],
            },
            {
                title: 'What to review first',
                items: [
                    'Status should match delivery reality, not roadmap aspiration.',
                    'Notes should explain the problem, evidence, and major risks in plain language.',
                ],
            },
            {
                title: 'Why this saves time',
                items: [
                    'You can review progress, ownership, and context in one place instead of piecing it together from Jira and separate docs.',
                ],
            },
        ],
        table: {
            headers: ['Initiative', 'Status', 'Owner', 'Linked Jira', 'Progress'],
            rows: [
                ['Improve onboarding activation', 'in progress', 'Guila', '4', '68%'],
                ['Reduce manual reconciliation', 'discovery', 'Guila', '2', '15%'],
                ['Executive reporting refresh', 'on hold', 'Finance PM', '3', '21%'],
            ],
        },
    },
    '/tasks': {
        title: 'Filled PM task manager',
        subtitle: 'This page should look like an operational checklist for PM work that Jira does not track well.',
        chips: ['Operational work', 'Due-date driven', 'Linked to delivery when useful'],
        stats: [
            { label: 'Overdue', value: '2', tone: 'danger' },
            { label: 'Due Today', value: '4', tone: 'warning' },
            { label: 'Upcoming', value: '6', tone: 'accent' },
            { label: 'Done This Week', value: '7', tone: 'success' },
        ],
        sections: [
            {
                title: 'Overdue',
                items: [
                    'Follow up with compliance on KYC exception handling.',
                    'Close open customer commitments from sales escalation review.',
                ],
            },
            {
                title: 'Today',
                items: [
                    'Prepare sprint review talking points.',
                    'Review roadmap priorities with engineering lead.',
                    'Draft weekly stakeholder update.',
                ],
            },
            {
                title: 'Upcoming',
                items: [
                    'Schedule discovery session on reconciliation workflow.',
                    'Write PRD outline for self-serve onboarding export improvements.',
                ],
            },
            {
                title: 'Example note',
                items: [
                    'The purpose of this PM task is to unblock the delivery team on launch readiness and clarify the next stakeholder communication.',
                ],
            },
        ],
        table: {
            headers: ['Task', 'Category', 'Due', 'Linked Initiative', 'Status'],
            rows: [
                ['Prepare sprint review', 'Delivery', 'Today', 'Improve onboarding activation', 'todo'],
                ['Send stakeholder update', 'Stakeholder', 'Tomorrow', 'Reduce manual reconciliation', 'in progress'],
                ['Discovery with finance ops', 'Discovery', 'Mar 18', 'Reconciliation workflow', 'todo'],
            ],
        },
    },
    '/prioritization': {
        title: 'Filled RICE comparison',
        subtitle: 'Use this page for a small set of competing bets, not the entire backlog at once.',
        chips: ['Bounded RICE', 'Ranked comparison', 'Decision support'],
        stats: [
            { label: 'Candidates Scored', value: '8', tone: 'accent' },
            { label: 'Needs Re-Scoring', value: '2', tone: 'warning' },
            { label: 'High Confidence Bets', value: '3', tone: 'success' },
            { label: 'Low Confidence Bets', value: '1', tone: 'danger' },
        ],
        sections: [
            {
                title: 'Example rationale',
                items: [
                    'Improve onboarding activation ranks first because it touches the largest set of new accounts and has the clearest KPI linkage.',
                    'Confidence is only medium on reconciliation export automation because manual workflow volume is still estimated.',
                ],
            },
            {
                title: 'What to fill',
                items: [
                    'Reach should reflect a bounded audience or workflow volume.',
                    'Impact should describe the likely value if it works.',
                    'Confidence should reflect evidence quality, not optimism.',
                    'Effort should represent the delivery cost relative to other items.',
                ],
            },
            {
                title: 'How to use the output',
                items: [
                    'Use the ranking during roadmap and sprint-scope tradeoffs.',
                    'Keep the rationale so later changes can be audited instead of re-argued.',
                ],
            },
            {
                title: 'Red-flag pattern',
                items: [
                    'A very high reach score with very low effort and 100% confidence usually means the assumptions need review.',
                ],
            },
        ],
        table: {
            headers: ['Candidate', 'Reach', 'Impact', 'Confidence', 'Effort', 'Score'],
            rows: [
                ['Improve onboarding activation', '500', '3', '80%', '5', '240.0'],
                ['FIN-284 tighten reconciliation alerts', '250', '2', '100%', '5', '100.0'],
                ['Self-serve export controls', '100', '2', '50%', '3', '33.3'],
            ],
        },
    },
    '/decisions': {
        title: 'Filled decision log',
        subtitle: 'A good decision record preserves the tradeoff, the chosen option, and the expected impact.',
        chips: ['Context first', 'Options compared', 'Traceable to Jira'],
        stats: [
            { label: 'Draft', value: '2', tone: 'warning' },
            { label: 'Decided', value: '9', tone: 'success' },
            { label: 'Revisited', value: '1', tone: 'info' },
            { label: 'Superseded', value: '1', tone: 'accent' },
        ],
        sections: [
            {
                title: 'Example decision',
                items: [
                    'Title: Decide launch readiness for self-serve onboarding',
                    'Problem context: We need to decide between a soft launch and a full rollout because QA found defects in edge-case bank connection flows.',
                    'Final decision: Launch to a limited customer cohort first while monitoring operational exceptions.',
                ],
            },
            {
                title: 'Options considered',
                items: [
                    'Soft launch to selected accounts',
                    'Delay launch by one sprint',
                    'Launch broadly and accept higher support load',
                ],
            },
            {
                title: 'Expected outcome',
                items: [
                    'We expect this to reduce rollout risk while still learning from real traffic within two weeks.',
                ],
            },
            {
                title: 'Linked context',
                items: [
                    'Primary initiative: Improve onboarding activation',
                    'Affected Jira: FIN-244, FIN-257, FIN-266',
                ],
            },
        ],
        table: {
            headers: ['Decision', 'Status', 'Owner', 'Date', 'Primary Initiative'],
            rows: [
                ['Launch readiness for self-serve onboarding', 'draft', 'Guila', '2026-03-10', 'Improve onboarding activation'],
                ['Scope tradeoff for exports', 'decided', 'Guila', '2026-03-04', 'Executive reporting refresh'],
            ],
        },
    },
    '/stakeholders': {
        title: 'Filled stakeholder map',
        subtitle: 'This page becomes valuable when stakeholder memory is captured consistently after meaningful conversations.',
        chips: ['People context', 'Meeting memory', 'Influence map'],
        stats: [
            { label: 'Active Stakeholders', value: '14', tone: 'accent' },
            { label: 'Recent Interactions', value: '6', tone: 'info' },
            { label: 'Needs Follow-Up', value: '3', tone: 'warning' },
            { label: 'Linked Initiatives', value: '9', tone: 'success' },
        ],
        sections: [
            {
                title: 'Example stakeholder',
                items: [
                    'Name: Maya Cohen',
                    'Role: Director of Sales Engineering',
                    'Notes: Cares most about onboarding speed for enterprise prospects and wants concise weekly updates.',
                ],
            },
            {
                title: 'Recent interaction',
                items: [
                    'Title: Escalation review for onboarding delays',
                    'Key points raised: manual data mapping is slowing deals and sales wants clearer launch commitments.',
                    'Follow-up: share timeline options after decision review on Friday.',
                ],
            },
            {
                title: 'What to capture',
                items: [
                    'What this person influences',
                    'What they care about most',
                    'Any promises or sensitivities that should not live only in personal notes',
                ],
            },
            {
                title: 'Why this helps',
                items: [
                    'It prevents rediscovery and keeps customer, sales, and exec context attached to product work.',
                ],
            },
        ],
        table: {
            headers: ['Stakeholder', 'Type', 'Organization', 'Recent Note', 'Linked Initiatives'],
            rows: [
                ['Maya Cohen', 'sales', 'Internal', 'Needs launch timeline confidence', '2'],
                ['Acme Treasury Team', 'client', 'Acme Bank', 'Complaints about manual onboarding steps', '1'],
                ['Noam Levi', 'engineering', 'Internal', 'Concerned about QA capacity for rollout', '3'],
            ],
        },
    },
    '/strategy': {
        title: 'Filled strategy tree',
        subtitle: 'A healthy strategy page shows measurable outcomes and active initiative links, not only planning language.',
        chips: ['Objective → Outcome → KPI', 'Measured regularly', 'Linked to delivery'],
        stats: [
            { label: 'Objectives', value: '3', tone: 'accent' },
            { label: 'Outcomes', value: '5', tone: 'info' },
            { label: 'KPIs On Track', value: '4', tone: 'success' },
            { label: 'Stale KPIs', value: '1', tone: 'warning' },
        ],
        sections: [
            {
                title: 'Objective example',
                items: [
                    'Improve onboarding success rate for new finance customers.',
                    'Why now: activation delays are affecting pipeline conversion and implementation cost.',
                ],
            },
            {
                title: 'Outcome example',
                items: [
                    'Reduce onboarding time from 4 weeks to 2 weeks.',
                    'Baseline: manual setup and data reconciliation create avoidable delays.',
                    'Target: new customers reach reporting-ready state within 10 business days.',
                ],
            },
            {
                title: 'KPI example',
                items: [
                    'Average onboarding completion time',
                    'Baseline: 28 days',
                    'Current: 19 days',
                    'Target: 10 days',
                ],
            },
            {
                title: 'Linked execution',
                items: [
                    'Improve onboarding activation',
                    'Reduce manual reconciliation',
                ],
            },
        ],
        table: {
            headers: ['KPI', 'Baseline', 'Current', 'Target', 'Frequency'],
            rows: [
                ['Average onboarding completion time', '28', '19', '10', 'monthly'],
                ['% of accounts reaching first report in 14 days', '42', '61', '80', 'monthly'],
            ],
        },
    },
    '/risks': {
        title: 'Filled risk radar',
        subtitle: 'This page should surface broken links, stale metrics, and delivery warning signs before reviews become uncomfortable.',
        chips: ['Deterministic alerts', 'Strategy + delivery', 'Actionable cleanup'],
        stats: [
            { label: 'High Severity', value: '2', tone: 'danger' },
            { label: 'Medium Severity', value: '4', tone: 'warning' },
            { label: 'Resolved This Month', value: '5', tone: 'success' },
            { label: 'Recurring Risk Themes', value: '2', tone: 'info' },
        ],
        sections: [
            {
                title: 'High-severity alerts',
                items: [
                    'Active initiative with no linked objective or KPI.',
                    'Blocked Jira work on a top-ranked priority for more than 5 days.',
                ],
            },
            {
                title: 'Strategy risks',
                items: [
                    'Outcome has no KPI update this month.',
                    'Two active tickets are not linked to an initiative.',
                ],
            },
            {
                title: 'Delivery risks',
                items: [
                    'Large story is in progress with no update in 7 days.',
                    'Blocked tickets rose significantly this sprint.',
                ],
            },
            {
                title: 'Recommended response',
                items: [
                    'Fix missing links first, then review blocked work and stale measurements.',
                ],
            },
        ],
        table: {
            headers: ['Alert', 'Severity', 'Entity', 'Recommended Action'],
            rows: [
                ['Initiative has no objective link', 'high', 'Reduce manual reconciliation', 'Link objective or mark as intentional'],
                ['KPI measurement stale', 'medium', 'Average onboarding completion time', 'Log latest measurement'],
            ],
        },
    },
    '/narratives': {
        title: 'Filled narrative draft',
        subtitle: 'The best narrative drafts combine Jira movement with strategy and decision context before stakeholder language is added.',
        chips: ['Problem', 'Evidence', 'Solution', 'Impact'],
        stats: [
            { label: 'Sources Selected', value: '7', tone: 'accent' },
            { label: 'Initiatives Included', value: '2', tone: 'info' },
            { label: 'Decisions Referenced', value: '1', tone: 'warning' },
            { label: 'Narrative Drafts', value: '4', tone: 'success' },
        ],
        sections: [
            {
                title: 'Problem',
                items: [
                    'New finance customers are taking too long to reach first-value because onboarding still depends on manual mapping and reconciliation checks.',
                ],
            },
            {
                title: 'Evidence',
                items: [
                    'Jira shows repeated work on onboarding setup tickets and decision logs show launch risk concerns.',
                    'Recent stakeholder notes show sales escalations tied to delayed onboarding.',
                ],
            },
            {
                title: 'Solution',
                items: [
                    'We are prioritizing onboarding activation improvements and a limited self-serve rollout to reduce time-to-value while controlling launch risk.',
                ],
            },
            {
                title: 'Impact',
                items: [
                    'We expect onboarding duration to keep trending down and customer-facing commitments to become more reliable.',
                ],
            },
        ],
    },
    '/coach': {
        title: 'Filled coaching view',
        subtitle: 'This page should narrow the PM role into a manageable set of next actions instead of leaving signal interpretation to memory.',
        chips: ['Daily', 'Weekly', 'Monthly'],
        stats: [
            { label: 'Daily Actions', value: '3', tone: 'danger' },
            { label: 'Weekly Actions', value: '4', tone: 'warning' },
            { label: 'Monthly Actions', value: '2', tone: 'accent' },
            { label: 'Completed This Week', value: '5', tone: 'success' },
        ],
        sections: [
            {
                title: 'Daily recommendations',
                items: [
                    'Follow up on blocked onboarding tickets.',
                    'Close overdue stakeholder update task.',
                    'Review launch-readiness decision draft before standup.',
                ],
            },
            {
                title: 'Weekly recommendations',
                items: [
                    'Re-score the top backlog items before roadmap review.',
                    'Review stale KPI measurements and strategy risks.',
                ],
            },
            {
                title: 'Monthly recommendations',
                items: [
                    'Check whether active initiatives still map to the current objective tree.',
                    'Review fintech context items with the most manual work and reconciliation risk.',
                ],
            },
            {
                title: 'What good looks like',
                items: [
                    'You should be able to turn guidance into a task, decision, or narrative quickly.',
                ],
            },
        ],
    },
    '/onboarding': {
        title: 'Filled onboarding workspace',
        subtitle: 'This page should tell a new PM where to start, what to learn next, and what “done” looks like.',
        chips: ['Setup order', '30 / 60 / 90', 'Operating rhythm'],
        stats: [
            { label: 'Setup Steps Complete', value: '6/8', tone: 'accent' },
            { label: '30-Day Tasks Done', value: '8/12', tone: 'info' },
            { label: 'Needs Review', value: '2', tone: 'warning' },
            { label: 'Linked Pages', value: '9', tone: 'success' },
        ],
        sections: [
            {
                title: 'Workspace setup order',
                items: [
                    '1. Sync Jira and validate delivery views.',
                    '2. Create core initiatives.',
                    '3. Link objectives and outcomes.',
                    '4. Add top stakeholders and active PM tasks.',
                ],
            },
            {
                title: '30-day focus',
                items: [
                    'Learn the product surface area.',
                    'Read Jira history for major themes.',
                    'Meet engineering, sales, and support leads.',
                ],
            },
            {
                title: '60-day focus',
                items: [
                    'Start scoring priorities and logging decisions.',
                    'Identify delivery or onboarding friction patterns.',
                ],
            },
            {
                title: '90-day focus',
                items: [
                    'Lead a strategy review with measurable outcomes and a clear priority stack.',
                ],
            },
        ],
    },
    '/fintech-context': {
        title: 'Filled fintech operating map',
        subtitle: 'Use this page to document real data flow, manual work, reconciliation risk, and compliance constraints.',
        chips: ['Source of truth', 'Manual steps', 'Reconciliation risk'],
        stats: [
            { label: 'Context Items', value: '11', tone: 'accent' },
            { label: 'Manual Steps', value: '4', tone: 'warning' },
            { label: 'Reconciliation Risks', value: '3', tone: 'danger' },
            { label: 'Linked Initiatives', value: '5', tone: 'success' },
        ],
        sections: [
            {
                title: 'Example context item',
                items: [
                    'Name: Daily transaction reconciliation',
                    'System: Finance Data Pipeline',
                    'Source of truth: Cleared ledger snapshot in warehouse',
                ],
            },
            {
                title: 'Operational notes',
                items: [
                    'Manual intervention happens when bank ingestion fails or mapping rules do not match.',
                    'The main reconciliation risk is a timing mismatch between the warehouse load and downstream export run.',
                ],
            },
            {
                title: 'Compliance note',
                items: [
                    'Ops review is required before changes to exception-handling rules go live because reporting outputs are customer-facing.',
                ],
            },
            {
                title: 'Roadmap link',
                items: [
                    'Linked initiative: Reduce manual reconciliation',
                ],
            },
        ],
        table: {
            headers: ['Item', 'Type', 'Manual Step', 'Risk', 'Owner'],
            rows: [
                ['Daily transaction reconciliation', 'reconciliation point', 'Yes', 'High', 'Finance Ops'],
                ['Customer data import', 'source of truth', 'No', 'Medium', 'Data Platform'],
                ['Exception export review', 'workflow friction', 'Yes', 'Medium', 'Compliance'],
            ],
        },
    },
    '/sprint': {
        title: 'Filled sprint review view',
        subtitle: 'Use this page as evidence of sprint health, carry-over risk, and blocked execution.',
        chips: ['Committed vs completed', 'Blocked work', 'Carry-over risk'],
        stats: [
            { label: 'Committed', value: '42 pts', tone: 'accent' },
            { label: 'Done', value: '29 pts', tone: 'success' },
            { label: 'Blocked', value: '5', tone: 'danger' },
            { label: 'Carry-Over Risk', value: '8 pts', tone: 'warning' },
        ],
        sections: [
            {
                title: 'Healthy interpretation',
                items: [
                    'Look at blocked work and likely carry-over before celebrating completed points.',
                ],
            },
            {
                title: 'Example signal',
                items: [
                    'Completion is acceptable, but QA concentration suggests end-of-sprint risk.',
                ],
            },
        ],
        table: {
            headers: ['Item', 'Status', 'Points', 'Risk'],
            rows: [
                ['FIN-244 onboarding exceptions', 'In QA', '8', 'medium'],
                ['FIN-266 bank link retry handling', 'Blocked', '5', 'high'],
            ],
        },
    },
    '/focus': {
        title: 'Filled focus view',
        subtitle: 'This page should show active execution load and where current work is getting stuck.',
        chips: ['Active work', 'Blocked first', 'WIP awareness'],
        stats: [
            { label: 'In Progress', value: '14', tone: 'accent' },
            { label: 'Blocked', value: '4', tone: 'danger' },
            { label: 'In Review', value: '6', tone: 'warning' },
            { label: 'Active Epics', value: '3', tone: 'success' },
        ],
        sections: [
            { title: 'Example read', items: ['Most active work is concentrated under onboarding activation, with two blocked items in QA and one dependency on compliance.'] },
            { title: 'How to use it', items: ['Check blocked work and active epic concentration before asking the team to pull in more scope.'] },
        ],
    },
    '/work-mix': {
        title: 'Filled work-mix view',
        subtitle: 'Use this page to understand how delivery effort is split across bug fixing, features, chores, and operational work.',
        chips: ['Portfolio balance', 'Delivery mix', 'Trend review'],
        stats: [
            { label: 'Feature Work', value: '58%', tone: 'accent' },
            { label: 'Bugs', value: '18%', tone: 'warning' },
            { label: 'Tech Debt', value: '14%', tone: 'info' },
            { label: 'Ops / Other', value: '10%', tone: 'success' },
        ],
        sections: [
            { title: 'Example interpretation', items: ['Bug share is climbing, which may explain why roadmap throughput is flattening.'] },
            { title: 'Review question', items: ['Is the mix aligned to what leadership thinks the team is spending time on?'] },
        ],
    },
    '/workflow': {
        title: 'Filled workflow view',
        subtitle: 'This page shows where work is piling up in the delivery process and how long it stays there.',
        chips: ['Status distribution', 'Flow efficiency', 'Stuck stages'],
        stats: [
            { label: 'In Review', value: '7', tone: 'warning' },
            { label: 'QA Queue', value: '5', tone: 'danger' },
            { label: 'Cycle Time', value: '11.2d', tone: 'accent' },
            { label: 'Reopened', value: '3', tone: 'info' },
        ],
        sections: [
            { title: 'Example signal', items: ['QA is the visible bottleneck this week, with multiple items sitting longer than engineering expected.'] },
            { title: 'What to do next', items: ['Use this page to support a conversation about workflow constraints, not only ticket-level blame.'] },
        ],
    },
    '/bugs': {
        title: 'Filled bugs view',
        subtitle: 'Use this page to understand bug load, concentration, and whether quality risk is threatening roadmap work.',
        chips: ['Defect load', 'Hot spots', 'Severity patterns'],
        stats: [
            { label: 'Open Bugs', value: '17', tone: 'danger' },
            { label: 'High Severity', value: '3', tone: 'warning' },
            { label: 'Closed This Sprint', value: '9', tone: 'success' },
            { label: 'Affected Themes', value: '4', tone: 'accent' },
        ],
        sections: [
            { title: 'Example read', items: ['Onboarding and reconciliation flows account for most active bugs, which supports prioritizing quality work over new scope this week.'] },
            { title: 'What to watch', items: ['Recurring bugs in the same feature usually signal product or architecture debt, not isolated incidents.'] },
        ],
    },
    '/aging': {
        title: 'Filled aging view',
        subtitle: 'This page highlights work that has been open too long and is likely hiding execution or prioritization debt.',
        chips: ['Stale work', 'Long-lived issues', 'Cleanup needed'],
        stats: [
            { label: 'Older Than 30d', value: '11', tone: 'danger' },
            { label: 'Older Than 14d', value: '18', tone: 'warning' },
            { label: 'Recently Updated', value: '7', tone: 'success' },
            { label: 'Need PM Review', value: '5', tone: 'accent' },
        ],
        sections: [
            { title: 'Example signal', items: ['Several old tickets are still nominally in progress, which usually means they need a real scope or ownership decision.'] },
            { title: 'PM response', items: ['Use aging to decide whether to descale, close, split, or re-prioritize lingering work.'] },
        ],
    },
    '/epics': {
        title: 'Filled epics view',
        subtitle: 'This page should show epic-level delivery progress and where large bodies of work are drifting.',
        chips: ['Epic health', 'Scope drift', 'Progress rollup'],
        stats: [
            { label: 'Active Epics', value: '9', tone: 'accent' },
            { label: 'Blocked Epics', value: '2', tone: 'danger' },
            { label: 'Near Done', value: '3', tone: 'success' },
            { label: 'Needs PM Review', value: '2', tone: 'warning' },
        ],
        sections: [
            { title: 'Example interpretation', items: ['One epic is absorbing a lot of in-flight work without proportional done movement, which suggests scope creep.'] },
            { title: 'What to capture elsewhere', items: ['If the epic matters strategically, mirror it in Initiatives so the why is not lost.'] },
        ],
    },
    '/tickets': {
        title: 'Filled tickets explorer',
        subtitle: 'Use this page for evidence and investigation, not as the place where PM reasoning should live.',
        chips: ['Evidence page', 'Selection-driven', 'Use with context pages'],
        stats: [
            { label: 'Visible Tickets', value: '126', tone: 'accent' },
            { label: 'Selected', value: '4', tone: 'info' },
            { label: 'Blocked', value: '6', tone: 'danger' },
            { label: 'Needs Context', value: '9', tone: 'warning' },
        ],
        sections: [
            { title: 'What good looks like', items: ['Use ticket selection here to seed tasks, initiatives, narratives, or decisions elsewhere in the app.'] },
            { title: 'Example behavior', items: ['Select a small set of relevant tickets, then move into the PM workspace that needs context or action.'] },
        ],
    },
    '/ai-reports': {
        title: 'Filled AI reports view',
        subtitle: 'This page should show the report history, the latest briefing, and which source context was used.',
        chips: ['Generated output', 'History', 'Audience-specific'],
        stats: [
            { label: 'Reports This Week', value: '6', tone: 'accent' },
            { label: 'Scheduled', value: '2', tone: 'info' },
            { label: 'Unread Briefings', value: '1', tone: 'warning' },
            { label: 'Reusable Drafts', value: '4', tone: 'success' },
        ],
        sections: [
            { title: 'Example report', items: ['Executive weekly update generated from sprint health, active initiatives, and current risks.'] },
            { title: 'Review before sending', items: ['Check audience fit, promises, and any implied commitments before sharing externally.'] },
        ],
    },
    '/docs': {
        title: 'Filled ticket docs view',
        subtitle: 'Use this page to inspect or improve ticket documentation quality across the backlog.',
        chips: ['Documentation quality', 'Ticket-level', 'Improvement surface'],
        stats: [
            { label: 'Docs Reviewed', value: '24', tone: 'accent' },
            { label: 'Needs Rewrite', value: '7', tone: 'warning' },
            { label: 'High Quality', value: '10', tone: 'success' },
            { label: 'Low Context', value: '4', tone: 'danger' },
        ],
        sections: [
            { title: 'Example insight', items: ['Several top-priority tickets still lack clear customer problem framing or acceptance criteria.'] },
            { title: 'How PM should use this', items: ['Treat this as a quality aid for Jira tickets, not as the home for product reasoning.'] },
        ],
    },
    '/slideshow': {
        title: 'Filled slideshow view',
        subtitle: 'This page should look like a prepared review deck backed by current dashboard data.',
        chips: ['Presentation mode', 'Review-ready', 'Use current data'],
        stats: [
            { label: 'Slides', value: '12', tone: 'accent' },
            { label: 'Updated Today', value: 'Yes', tone: 'success' },
            { label: 'Audience', value: 'Exec', tone: 'info' },
            { label: 'Needs Manual Edit', value: '2', tone: 'warning' },
        ],
        sections: [
            { title: 'Example slide flow', items: ['Delivery health → top priorities → risks → decisions needed → strategy movement.'] },
            { title: 'Use case', items: ['This is for telling the story live after the Command Center and narrative pages are already current.'] },
        ],
    },
    '/settings': {
        title: 'Filled settings view',
        subtitle: 'This page should confirm data freshness, scheduling, and report automation settings rather than require frequent PM time.',
        chips: ['Sync', 'Scheduling', 'AI configuration'],
        stats: [
            { label: 'Last Sync', value: '8 min ago', tone: 'success' },
            { label: 'Schedule', value: 'Weekly Fri 9:00', tone: 'accent' },
            { label: 'Timezone', value: 'America/Toronto', tone: 'info' },
            { label: 'Attention Needed', value: '1', tone: 'warning' },
        ],
        sections: [
            { title: 'What to confirm', items: ['Jira sync is healthy, report schedules are correct, and AI output has the right audience defaults.'] },
            { title: 'Example use', items: ['Use Generate Now to preview a report before changing a schedule.'] },
        ],
    },
};

function ExampleStatCard({ stat }: { stat: ExampleStat }) {
    const tone = TONE_STYLES[stat.tone || 'accent'];

    return (
        <div
            style={{
                padding: 14,
                borderRadius: 12,
                border: `1px solid ${tone.border}`,
                background: tone.background,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
            }}
        >
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>
                {stat.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: tone.color }}>
                {stat.value}
            </div>
        </div>
    );
}

function ExampleSectionCard({ section }: { section: ExampleSection }) {
    return (
        <div className="card" style={{ padding: 18, background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{section.title}</div>
                {section.description ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                        {section.description}
                    </div>
                ) : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {section.items.map((item) => (
                    <div
                        key={item}
                        style={{
                            fontSize: 13,
                            color: 'var(--text-primary)',
                            lineHeight: 1.55,
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: 'rgba(15,23,42,0.32)',
                            border: '1px solid rgba(99,102,241,0.12)',
                        }}
                    >
                        {item}
                    </div>
                ))}
            </div>
        </div>
    );
}

function ExampleTableCard({ table }: { table: ExampleTable }) {
    return (
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>
                Example Rows
            </div>
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            {table.headers.map((header) => (
                                <th key={header}>{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, index) => (
                            <tr key={`${row.join('-')}-${index}`}>
                                {row.map((cell, cellIndex) => (
                                    <td key={`${cell}-${cellIndex}`}>{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function PageExamplePreview({ path }: { path: string }) {
    const preview = PREVIEW_BY_PATH[path] || DEFAULT_PREVIEW;

    return (
        <div
            className="card"
            style={{
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                background: 'linear-gradient(180deg, rgba(99,102,241,0.08), rgba(10,10,20,0.94))',
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: 11, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>
                            Filled Page Example
                        </div>
                        <h3 style={{ fontSize: 22, marginTop: 4 }}>{preview.title}</h3>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 6 }}>
                            {preview.subtitle}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(preview.chips || []).map((chip) => (
                            <span
                                key={chip}
                                className="badge"
                                style={{
                                    background: 'rgba(99,102,241,0.12)',
                                    color: '#c7d2fe',
                                    border: '1px solid rgba(99,102,241,0.25)',
                                }}
                            >
                                {chip}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="dashboard-grid grid-4" style={{ gap: 12 }}>
                {preview.stats.map((stat) => (
                    <ExampleStatCard key={`${stat.label}-${stat.value}`} stat={stat} />
                ))}
            </div>

            <div className="dashboard-grid grid-2" style={{ alignItems: 'start' }}>
                {preview.sections.map((section) => (
                    <ExampleSectionCard key={section.title} section={section} />
                ))}
            </div>

            {preview.table ? <ExampleTableCard table={preview.table} /> : null}
        </div>
    );
}
