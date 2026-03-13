export interface PageGuideExample {
    title: string;
    summary: string;
    steps: string[];
}

export interface PageGuide {
    name: string;
    path: string;
    purpose: string;
    howToUse: string[];
    example: PageGuideExample;
}

export type PageCadence = 'setup' | 'daily' | 'weekly' | 'monthly' | 'as_needed';

export interface PageWorkflowGuide {
    cadence: PageCadence[];
    fillChecklist: string[];
    lookAtFirst: string[];
}

export interface SetupSequenceStep {
    order: number;
    path: string;
    title: string;
    reason: string;
}

export interface CadenceGuide {
    cadence: Exclude<PageCadence, 'setup' | 'as_needed'>;
    title: string;
    summary: string;
    paths: string[];
    questions: string[];
}

export interface StartDayStep {
    path: string;
    why: string;
}

export interface WorkspaceLane {
    id: string;
    title: string;
    summary: string;
    paths: string[];
}

export const PAGE_GUIDES: PageGuide[] = [
    {
        name: 'Command Center',
        path: '/',
        purpose: 'Single PM cockpit snapshot combining Jira delivery health with PM tasks, active initiatives, priorities, and open decisions.',
        howToUse: [
            'Start here every day before drilling into specialty pages.',
            'Scan overdue PM work, top priorities, and open decisions before reading deep Jira details.',
            'Use this page to decide where you need to intervene next, not to do all detailed editing here.',
        ],
        example: {
            title: 'Monday morning PM triage',
            summary: 'Use the command center to decide what needs intervention in the next 30 minutes.',
            steps: [
                'Refresh sync so the delivery snapshot is current.',
                'Check Today’s PM Work and clear overdue follow-ups first.',
                'Review Active Initiatives for blocked or low-progress work.',
                'Look at Top Priorities and Decision Inbox to see whether execution and decisions still line up.',
            ],
        },
    },
    {
        name: 'Initiatives',
        path: '/initiatives',
        purpose: 'Manual PM initiative workspace linking strategic work to Jira delivery progress.',
        howToUse: [
            'Create initiatives for product work that is broader than a single Jira issue.',
            'Link the Jira tickets that actually represent execution for that initiative.',
            'Use initiative status plus linked Jira health to tell whether the work is moving or just planned.',
        ],
        example: {
            title: 'Create an onboarding initiative',
            summary: 'Map a product theme to real delivery work without relying on Jira structure alone.',
            steps: [
                'Create an initiative called Improve onboarding activation.',
                'Link the main epic and supporting stories from Jira.',
                'Add notes describing the user problem and expected business effect.',
                'Use the linked Jira rollup to review progress without reopening multiple Jira views.',
            ],
        },
    },
    {
        name: 'PM Tasks',
        path: '/tasks',
        purpose: 'Operational PM task manager for work that does not belong in Jira engineering tickets.',
        howToUse: [
            'Track discovery, stakeholder follow-ups, launch prep, PRD work, and planning tasks here.',
            'Review Overdue and Today first because those are usually where PM follow-through slips.',
            'Link tasks to initiatives and Jira work when the task exists to unblock delivery or strategy.',
        ],
        example: {
            title: 'Prepare for sprint review',
            summary: 'Use PM Tasks for operational work that supports the sprint but is not an engineering ticket.',
            steps: [
                'Create a task from the Sprint Review template.',
                'Link the initiative and Jira tickets that will be discussed in review.',
                'Add meeting participants and talking points in notes.',
                'Mark it done after the review instead of leaving the work hidden in personal notes.',
            ],
        },
    },
    {
        name: 'Prioritization',
        path: '/prioritization',
        purpose: 'RICE scoring workspace for Jira items and manual initiatives.',
        howToUse: [
            'Score comparable backlog candidates, not everything in the backlog.',
            'Use bounded Reach, Impact, Confidence, and Effort values so scores stay consistent.',
            'Review the ranked backlog before roadmap or sprint-scope tradeoff conversations.',
        ],
        example: {
            title: 'Prioritize two competing bets',
            summary: 'Use RICE to compare work with the same capacity cost but different impact profiles.',
            steps: [
                'Pick one initiative and one Jira epic that are competing for the same sprint capacity.',
                'Score both using the bounded RICE values.',
                'Write the rationale so the score is auditable later.',
                'Use the ranked view during planning instead of rebuilding the comparison in a spreadsheet.',
            ],
        },
    },
    {
        name: 'Decisions',
        path: '/decisions',
        purpose: 'Decision log for capturing product reasoning, options considered, and final calls.',
        howToUse: [
            'Write the problem context before the decision outcome so future readers understand the setup.',
            'List realistic options and mark the chosen one explicitly.',
            'Link the decision to related initiatives and Jira work so the why stays attached to the what.',
        ],
        example: {
            title: 'Document a scope tradeoff',
            summary: 'Capture why a team cut scope so the conversation does not have to be recreated later.',
            steps: [
                'Create a decision from the Scope Tradeoff template.',
                'List the options: cut reporting, cut self-serve setup, or slip the launch.',
                'Record the final choice and expected outcome.',
                'Link the delivery tickets affected so stakeholders can trace the downstream impact.',
            ],
        },
    },
    {
        name: 'Stakeholders',
        path: '/stakeholders',
        purpose: 'PM relationship memory for sales, clients, engineering, design, executives, and other key contacts.',
        howToUse: [
            'Track who matters, what they care about, and how they influence product work.',
            'Log short notes after important meetings so context does not disappear into private docs.',
            'Use recent interactions to prepare for follow-ups and avoid repeating discovery conversations.',
        ],
        example: {
            title: 'Preserve a customer escalation thread',
            summary: 'Use Stakeholders to turn meeting memory into searchable team context.',
            steps: [
                'Create the customer stakeholder record with role, company, and related initiatives.',
                'Log the interaction after the meeting with the actual pain point and commitment made.',
                'Link the initiative or Jira issue affected by the discussion.',
                'Review recent interactions before the next customer or exec update.',
            ],
        },
    },
    {
        name: 'Strategy',
        path: '/strategy',
        purpose: 'Objective to Outcome to KPI workspace connecting delivery work to measurable product strategy.',
        howToUse: [
            'Create objectives first, then add outcomes and KPIs beneath them.',
            'Keep initiatives linked so strategy reviews are connected to real delivery motion.',
            'Use measurements regularly or strategy will become a static planning artifact.',
        ],
        example: {
            title: 'Build a measurable objective',
            summary: 'Turn a strategic idea into an operating tree the team can review every month.',
            steps: [
                'Create an objective such as Improve onboarding success.',
                'Add an outcome like Reduce onboarding time from four weeks to two.',
                'Attach a KPI with baseline and target values.',
                'Link active initiatives so roadmap work can be evaluated against that outcome.',
            ],
        },
    },
    {
        name: 'Risks',
        path: '/risks',
        purpose: 'Deterministic risk radar for missing strategy links, stale KPIs, and unlinked Jira work.',
        howToUse: [
            'Review high-severity items first because they usually indicate broken strategy or delivery alignment.',
            'Use alerts to clean up missing links before major reviews.',
            'Treat repeated low-severity risks as process debt, not noise.',
        ],
        example: {
            title: 'Run a strategy hygiene review',
            summary: 'Use Risks before a leadership review so you catch broken linkage early.',
            steps: [
                'Open the page and sort attention to the top high-severity items.',
                'Fix initiatives with no objective or outcome first.',
                'Check stale KPI alerts and update measurements where needed.',
                'Review active Jira work with no initiative context and decide whether it is intentional.',
            ],
        },
    },
    {
        name: 'Narratives',
        path: '/narratives',
        purpose: 'Narrative builder that turns Jira delivery, strategy, PM tasks, decisions, and risks into stakeholder-ready product stories.',
        howToUse: [
            'Use current Jira selection or filters as the delivery source context.',
            'Add initiatives, objectives, decisions, tasks, or risks when the story needs more than ticket summaries.',
            'Generate a draft, then edit it for audience and commitment level before sending.',
        ],
        example: {
            title: 'Draft a stakeholder roadmap update',
            summary: 'Combine delivery signals with strategy context instead of rewriting updates from scratch.',
            steps: [
                'Filter or select the delivery tickets that matter this week.',
                'Add the supporting initiative and objective context.',
                'Generate a Stakeholder Brief or Roadmap Narrative.',
                'Review the draft for language and commitments before sharing externally.',
            ],
        },
    },
    {
        name: 'Coach',
        path: '/coach',
        purpose: 'Daily, weekly, and monthly PM guidance generated from actual delivery and strategy signals.',
        howToUse: [
            'Start with daily recommendations for urgent action items.',
            'Use weekly items for backlog, strategy, and stakeholder cadence hygiene.',
            'Treat monthly items as operating-system maintenance for the PM role.',
        ],
        example: {
            title: 'Use the coach for weekly PM cadence',
            summary: 'Convert system signals into a small number of focused PM actions.',
            steps: [
                'Open daily recommendations first to catch blocked work or overdue PM follow-ups.',
                'Review weekly items to refresh priorities and KPI discipline.',
                'Use the monthly section when preparing roadmap or executive review material.',
                'Turn useful guidance items into PM tasks or decisions when they require tracking.',
            ],
        },
    },
    {
        name: 'Onboarding',
        path: '/onboarding',
        purpose: 'Built-in 30/60/90 PM playbook with saved progress tracking.',
        howToUse: [
            'Use this as a structured learning plan for new PMs or a reset checklist for role transitions.',
            'Complete steps when the success criteria are genuinely met.',
            'Jump into linked pages directly from the playbook when a step requires real system use.',
        ],
        example: {
            title: 'Guide a new PM through the first month',
            summary: 'Use onboarding as a persistent checklist instead of scattered docs and manager notes.',
            steps: [
                'Start with the 30-day section and review product, team, and history context.',
                'Mark steps complete only after the PM has actually done the work.',
                'Use the linked dashboard pages during each step.',
                'Review remaining gaps during weekly check-ins.',
            ],
        },
    },
    {
        name: 'Fintech Context',
        path: '/fintech-context',
        purpose: 'Operating map for sources of truth, reporting pipelines, reconciliation risk, manual steps, and compliance constraints.',
        howToUse: [
            'Document real operating constraints, not aspirational architecture.',
            'Flag manual work, reconciliation risk, and compliance-sensitive flows clearly.',
            'Link context items to initiatives when roadmap work is meant to remove friction or risk.',
        ],
        example: {
            title: 'Map a fragile reconciliation workflow',
            summary: 'Use Fintech Context to make operational pain concrete before prioritization.',
            steps: [
                'Add the system or pipeline that owns the source data.',
                'Mark where manual intervention still happens.',
                'Flag reconciliation risk and note the current owner.',
                'Link the context item to an initiative designed to reduce operational friction.',
            ],
        },
    },
    {
        name: 'Sprint',
        path: '/sprint',
        purpose: 'Execution-focused sprint board with committed and completed counts, points, and carry-over risk.',
        howToUse: [
            'Use this page to understand whether the sprint is landing, slipping, or hiding risk.',
            'Check completion trend, blockers, and carry-over first.',
            'Use it with the command center rather than instead of it.',
        ],
        example: {
            title: 'Prep for daily standup',
            summary: 'Use Sprint to translate Jira movement into sprint-level signal quickly.',
            steps: [
                'Open Sprint and review completion rate plus blocked count.',
                'Check in-progress, review, and QA concentrations.',
                'Spot likely carry-over risk before the team meeting.',
                'Use the page as evidence when asking for descoping or unblock help.',
            ],
        },
    },
    {
        name: 'Focus',
        path: '/focus',
        purpose: 'Shows what the team is actively working on now and where work is getting stuck.',
        howToUse: [
            'Use this page when you want active work, not the whole backlog.',
            'Review blocked work and active epics first.',
            'Use it to understand current execution focus before asking the team to pull in more work.',
        ],
        example: {
            title: 'Check active execution load',
            summary: 'Use Focus when the team feels busy and you need to see why.',
            steps: [
                'Review blocked cards first.',
                'Check whether in-flight work is concentrated under one epic or theme.',
                'Open the ticket details for items that appear stalled.',
                'Use that evidence before changing sprint scope or asking for updates.',
            ],
        },
    },
    {
        name: 'Work Mix',
        path: '/work-mix',
        purpose: 'Explains capacity allocation across bugs, features, developer requests, and maintenance.',
        howToUse: [
            'Use this page in planning and stakeholder conversations about tradeoffs.',
            'Compare bugs versus features over time instead of relying on feeling.',
            'Filter by squad or theme when a stakeholder asks where capacity is going.',
        ],
        example: {
            title: 'Explain why roadmap work slowed',
            summary: 'Use Work Mix to show how capacity was diverted instead of hand-waving it.',
            steps: [
                'Open Work Mix for the relevant sprint window.',
                'Compare feature work against bug and maintenance load.',
                'Use the chart to show whether capacity shifted into quality or support work.',
                'Bring that evidence into prioritization or stakeholder updates.',
            ],
        },
    },
    {
        name: 'Workflow',
        path: '/workflow',
        purpose: 'Workflow bottleneck and flow diagnostics by status, stage aging, and bounce-back behavior.',
        howToUse: [
            'Use Workflow when delivery feels slow and you need the bottleneck, not just the symptom.',
            'Check aging by stage and bounce-back patterns first.',
            'Use this page to improve flow policy, not just to inspect tickets one by one.',
        ],
        example: {
            title: 'Find the actual bottleneck',
            summary: 'Use Workflow when work seems to move slowly but the team cannot agree why.',
            steps: [
                'Review the longest stages and biggest queue concentrations.',
                'Check whether tickets are bouncing back from QA or review.',
                'Compare lead time and cycle time patterns.',
                'Turn the finding into a process change or a short-term escalation.',
            ],
        },
    },
    {
        name: 'Bugs',
        path: '/bugs',
        purpose: 'Dedicated quality monitoring page for bug load, ownership, and closure trend.',
        howToUse: [
            'Track whether bugs are arriving faster than the team can close them.',
            'Use oldest unresolved bugs to guide quality escalation.',
            'Combine with Work Mix when quality is consuming roadmap capacity.',
        ],
        example: {
            title: 'Run a quality review',
            summary: 'Use Bugs to spot quality pressure before it derails roadmap work.',
            steps: [
                'Check the open bug trend and unresolved inventory.',
                'Review the oldest unresolved bugs for customer or operational risk.',
                'Look for concentration by area or component.',
                'Use the result to decide whether bug work needs dedicated capacity.',
            ],
        },
    },
    {
        name: 'Aging',
        path: '/aging',
        purpose: 'Finds neglected work and highlights unresolved aging risk by status, owner, and type.',
        howToUse: [
            'Use Aging for weekly cleanup and escalation reviews.',
            'Prioritize stale blocked tickets and old in-progress work.',
            'Treat high-age items as signal that workflow ownership may be unclear.',
        ],
        example: {
            title: 'Run a stale-work cleanup',
            summary: 'Use Aging to find neglected items before they quietly become delivery debt.',
            steps: [
                'Filter to unresolved work in the current period.',
                'Review the oldest blocked or in-progress tickets first.',
                'Check whether ownership, scope, or dependency clarity is missing.',
                'Escalate, split, or close the work instead of letting it remain invisible.',
            ],
        },
    },
    {
        name: 'Epics',
        path: '/epics',
        purpose: 'Dedicated epic portfolio screen showing epic progress, blocked child work, and epic-less tickets.',
        howToUse: [
            'Use Epics to review delivery grouped by theme rather than by individual issue.',
            'Watch for epics with many blocked or stalled child tickets.',
            'Use epic-less work as a prompt to improve story context and organization.',
        ],
        example: {
            title: 'Review a theme before stakeholder update',
            summary: 'Use Epics to see how a product theme is progressing without scanning raw tickets.',
            steps: [
                'Open the relevant epic and inspect child-ticket movement.',
                'Check blocked or aging child work first.',
                'Review whether the epic is still the right container for the current work.',
                'Use the summary as input for initiative or narrative updates.',
            ],
        },
    },
    {
        name: 'Tickets',
        path: '/tickets',
        purpose: 'Master explorer table with selection, saved views, and CSV export.',
        howToUse: [
            'Use Ticket Explorer when you need the raw operating table.',
            'Build recurring PM views and save them instead of reapplying filters each time.',
            'Use selection as the source context for AI reports, narratives, or decision prep.',
        ],
        example: {
            title: 'Build a weekly PM review view',
            summary: 'Use Tickets to create a repeatable working set for your operating cadence.',
            steps: [
                'Filter to blocked, review, QA, or release-ready work.',
                'Select the tickets you want to summarize or discuss.',
                'Save the filter set as a recurring PM view.',
                'Reuse that view every week instead of rebuilding the slice manually.',
            ],
        },
    },
    {
        name: 'AI Reports',
        path: '/ai-reports',
        purpose: 'Generates PM-ready updates from selected tickets in a structured format.',
        howToUse: [
            'Use selected tickets for focused reports and filtered tickets for broader updates.',
            'Choose tone and report type based on audience, not preference.',
            'Always review the generated text before sharing externally.',
        ],
        example: {
            title: 'Draft a weekly stakeholder update',
            summary: 'Use AI Reports to speed up first-draft writing from real Jira context.',
            steps: [
                'Select the tickets that represent this week’s real story.',
                'Choose Stakeholder Update or Executive Summary.',
                'Generate the draft and copy it into your working doc or message.',
                'Edit commitments, dates, and language before sending.',
            ],
        },
    },
    {
        name: 'Ticket Docs',
        path: '/docs',
        purpose: 'Internal documentation helper for explaining tickets to non-engineering audiences.',
        howToUse: [
            'Use this page when implementation work needs better product-facing explanation.',
            'Generate documentation from selected tickets and requested audiences.',
            'Treat output as internal enablement copy, not final external release messaging.',
        ],
        example: {
            title: 'Prepare support-facing ticket notes',
            summary: 'Use Ticket Docs when support or sales needs a clearer explanation of shipped work.',
            steps: [
                'Select the relevant tickets.',
                'Choose the audience set you need to support.',
                'Generate the documentation payload.',
                'Review it for customer-facing language before reuse.',
            ],
        },
    },
    {
        name: 'Slideshow',
        path: '/slideshow',
        purpose: 'Presentation mode for communicating delivery and PM operating context in meeting format.',
        howToUse: [
            'Use this page when you need a meeting-ready presentation view instead of dashboards.',
            'Switch between edit and present modes depending on the audience.',
            'Use speaker notes to keep the PM narrative tight during live reviews.',
        ],
        example: {
            title: 'Run a leadership review',
            summary: 'Use Slideshow to present a curated PM story instead of live-navigating multiple pages.',
            steps: [
                'Prepare the slides and notes before the meeting.',
                'Turn on present mode for the live review.',
                'Use concise speaker notes to keep the narrative consistent.',
                'Return to dashboard pages only when the audience needs deeper evidence.',
            ],
        },
    },
    {
        name: 'Settings',
        path: '/settings',
        purpose: 'Connection and sync control center for Jira, scheduling, and AI-related system behavior.',
        howToUse: [
            'Use Settings to keep sync, schedule, and operating assumptions sane.',
            'Validate connections before large sync changes.',
            'Generate a sample scheduled report before relying on automation.',
        ],
        example: {
            title: 'Validate weekly reporting setup',
            summary: 'Use Settings to prove scheduled automation works before leadership depends on it.',
            steps: [
                'Set the report schedule day, time, and audience.',
                'Save the schedule and confirm the preview looks right.',
                'Use Generate Now to inspect the current report quality.',
                'Review recent reports so you know what the automated output will actually look like.',
            ],
        },
    },
];

export function matchPageGuide(pathname: string): PageGuide | null {
    if (pathname === '/') {
        return PAGE_GUIDES.find((guide) => guide.path === '/') || null;
    }

    return PAGE_GUIDES.find((guide) => guide.path !== '/' && pathname.startsWith(guide.path)) || null;
}

export const PAGE_SETUP_SEQUENCE: SetupSequenceStep[] = [
    {
        order: 1,
        path: '/settings',
        title: 'Configure the system',
        reason: 'Make sure Jira sync, team assumptions, and report scheduling are sane before trusting the workspace.',
    },
    {
        order: 2,
        path: '/initiatives',
        title: 'Create the key initiatives',
        reason: 'Initiatives are the bridge between Jira delivery and the rest of the PM operating system.',
    },
    {
        order: 3,
        path: '/stakeholders',
        title: 'Capture the important people',
        reason: 'You will lose PM context quickly if contacts and recent conversations are not captured early.',
    },
    {
        order: 4,
        path: '/strategy',
        title: 'Map objectives, outcomes, and KPIs',
        reason: 'This is how the system knows whether the roadmap is moving the right outcomes.',
    },
    {
        order: 5,
        path: '/tasks',
        title: 'Add recurring PM operational work',
        reason: 'The command center is only useful if your non-Jira PM work lives in the system too.',
    },
    {
        order: 6,
        path: '/prioritization',
        title: 'Score the important backlog items',
        reason: 'Bounded prioritization creates shared decision logic instead of ad hoc ranking.',
    },
    {
        order: 7,
        path: '/decisions',
        title: 'Record the active product decisions',
        reason: 'This stops product reasoning from disappearing into meetings, Slack threads, and memory.',
    },
    {
        order: 8,
        path: '/fintech-context',
        title: 'Document operating constraints',
        reason: 'If this is a fintech workflow, sources of truth, manual steps, and reconciliation risk must be explicit.',
    },
];

export const OPERATING_RHYTHM: CadenceGuide[] = [
    {
        cadence: 'daily',
        title: 'Daily PM Triage',
        summary: 'Use the system to decide what needs intervention today, not to do deep reviews everywhere.',
        paths: ['/', '/tasks', '/sprint', '/focus', '/coach'],
        questions: [
            'What is blocked or overdue today?',
            'Which active initiative needs PM attention right now?',
            'What is the single highest-priority follow-up before the day ends?',
        ],
    },
    {
        cadence: 'weekly',
        title: 'Weekly PM Operating Review',
        summary: 'Use these pages to reset priorities, clean up decision debt, and keep execution aligned to strategy.',
        paths: ['/prioritization', '/decisions', '/risks', '/work-mix', '/workflow', '/stakeholders', '/narratives'],
        questions: [
            'Are we still working on the right things?',
            'What product decisions are still open or drifting?',
            'What risks, quality patterns, or stakeholder signals changed this week?',
        ],
    },
    {
        cadence: 'monthly',
        title: 'Monthly Strategy and System Review',
        summary: 'Use this cadence to review whether delivery is moving outcomes, not just generating activity.',
        paths: ['/strategy', '/fintech-context', '/onboarding', '/settings', '/ai-reports'],
        questions: [
            'Are initiatives linked to measurable outcomes and current KPIs?',
            'Did our operating assumptions or workflows change?',
            'Is the PM system still helping, or is it accumulating stale records?',
        ],
    },
];

export const START_DAY_FOCUS: StartDayStep[] = [
    {
        path: '/',
        why: 'Start here to see what needs intervention before opening specialty pages.',
    },
    {
        path: '/tasks',
        why: 'Clear overdue PM follow-ups and today’s operational work.',
    },
    {
        path: '/sprint',
        why: 'Check sprint health, carry-over risk, and blockers.',
    },
    {
        path: '/coach',
        why: 'Turn today’s signals into a short list of PM actions.',
    },
    {
        path: '/focus',
        why: 'Open this only if the command center or sprint view suggests active work is stuck.',
    },
];

export const WORKSPACE_LANES: WorkspaceLane[] = [
    {
        id: 'daily',
        title: 'Start Here Daily',
        summary: 'These are the core pages for the morning PM routine. If you only use a few screens today, use these.',
        paths: ['/', '/tasks', '/sprint', '/coach', '/focus'],
    },
    {
        id: 'run',
        title: 'Run The PM Work',
        summary: 'Use these when you need to capture PM context, follow-ups, people context, or decision memory.',
        paths: ['/initiatives', '/decisions', '/stakeholders'],
    },
    {
        id: 'plan',
        title: 'Plan And Align',
        summary: 'Open these when prioritizing, checking strategy alignment, or reviewing risk.',
        paths: ['/strategy', '/prioritization', '/risks', '/fintech-context'],
    },
    {
        id: 'communicate',
        title: 'Explain And Learn',
        summary: 'Use these for narratives, AI-assisted outputs, and PM learning or onboarding.',
        paths: ['/narratives', '/ai-reports', '/slideshow', '/onboarding'],
    },
    {
        id: 'investigate',
        title: 'Investigate Delivery',
        summary: 'These are evidence pages. Open them when you have a question to answer, not as part of every daily pass.',
        paths: ['/work-mix', '/workflow', '/bugs', '/aging', '/epics', '/tickets', '/docs', '/settings', '/info'],
    },
];

export function getPageWorkflowGuide(path: string): PageWorkflowGuide {
    switch (path) {
        case '/':
            return {
                cadence: ['daily'],
                fillChecklist: [
                    'No direct setup is required here. Keep initiatives, PM tasks, prioritization, and decisions current so this page stays useful.',
                    'Use this as the readout page, not the data-entry page.',
                ],
                lookAtFirst: [
                    'Today’s PM Work',
                    'Active Initiatives',
                    'Top Priorities',
                    'Decision Inbox',
                ],
            };
        case '/initiatives':
            return {
                cadence: ['setup', 'weekly', 'as_needed'],
                fillChecklist: [
                    'Create the initiative title and short summary.',
                    'Link the Jira issues that actually represent execution.',
                    'Assign owner, target date, and strategy links if they exist.',
                    'Add notes describing the problem, expected effect, and open assumptions.',
                ],
                lookAtFirst: [
                    'Initiatives with no Jira links',
                    'In-progress initiatives with low completion or many blocked issues',
                    'Themes with no recent movement',
                ],
            };
        case '/tasks':
            return {
                cadence: ['setup', 'daily', 'weekly'],
                fillChecklist: [
                    'Create tasks for non-engineering PM work only.',
                    'Use due date, initiative link, and Jira links when the task supports delivery.',
                    'Add meeting participants and notes so follow-up work is not trapped in calendar invites.',
                ],
                lookAtFirst: [
                    'Overdue bucket',
                    'Today bucket',
                    'Tasks with no initiative context that probably should be linked',
                ],
            };
        case '/prioritization':
            return {
                cadence: ['setup', 'weekly', 'as_needed'],
                fillChecklist: [
                    'Pick the initiatives or Jira items that are actually competing for capacity.',
                    'Score Reach, Impact, Confidence, and Effort using bounded values.',
                    'Write the rationale so the score can be defended later.',
                    'Link the item to the initiative when the Jira work is downstream execution.',
                ],
                lookAtFirst: [
                    'Highest-ranked items',
                    'Scores with weak rationale',
                    'Items that changed priority since the last planning review',
                ],
            };
        case '/decisions':
            return {
                cadence: ['setup', 'weekly', 'as_needed'],
                fillChecklist: [
                    'Write the problem context before finalizing the decision.',
                    'Capture the realistic options considered.',
                    'Mark the selected option and write the expected outcome.',
                    'Link initiatives and Jira work affected by the call.',
                ],
                lookAtFirst: [
                    'Draft decisions',
                    'Old decisions with no final outcome recorded',
                    'Important decisions missing linked Jira work or initiatives',
                ],
            };
        case '/stakeholders':
            return {
                cadence: ['setup', 'weekly', 'as_needed'],
                fillChecklist: [
                    'Add the stakeholder name, role, organization, and relationship type.',
                    'Link the initiatives they influence or care about.',
                    'Log interactions after important meetings or escalations.',
                    'Keep notes short, factual, and useful for future follow-up.',
                ],
                lookAtFirst: [
                    'Recent interactions',
                    'Important stakeholders with no recent notes',
                    'People linked to high-priority initiatives',
                ],
            };
        case '/strategy':
            return {
                cadence: ['setup', 'monthly', 'as_needed'],
                fillChecklist: [
                    'Create objectives first.',
                    'Add outcomes beneath each objective that make it measurable.',
                    'Attach KPIs with baseline, target, and measurement cadence.',
                    'Link initiatives so strategy is tied to active work.',
                ],
                lookAtFirst: [
                    'Objectives with no outcomes',
                    'Outcomes with no KPI',
                    'KPIs with stale or missing measurements',
                ],
            };
        case '/risks':
            return {
                cadence: ['weekly', 'monthly'],
                fillChecklist: [
                    'No manual setup belongs here; this page reflects hygiene problems elsewhere in the workspace.',
                    'Use the alerts to decide which linked pages need cleanup.',
                ],
                lookAtFirst: [
                    'High-severity alerts',
                    'Strategy linkage gaps',
                    'Active Jira work with no initiative context',
                ],
            };
        case '/narratives':
            return {
                cadence: ['weekly', 'as_needed'],
                fillChecklist: [
                    'Select the relevant Jira issue set first.',
                    'Add supporting initiatives, objectives, decisions, tasks, or risks when needed.',
                    'Choose the correct audience and narrative type.',
                    'Review the generated draft before sharing it.',
                ],
                lookAtFirst: [
                    'Selected source context',
                    'Audience and report type',
                    'Latest generated draft versus previous history',
                ],
            };
        case '/coach':
            return {
                cadence: ['daily', 'weekly', 'monthly'],
                fillChecklist: [
                    'No direct setup is required.',
                    'Use recommendations to create PM tasks, decisions, or cleanup actions in the relevant pages.',
                ],
                lookAtFirst: [
                    'Daily recommendations',
                    'Weekly recommendations tied to risk or prioritization drift',
                    'Monthly recommendations tied to onboarding or strategy hygiene',
                ],
            };
        case '/onboarding':
            return {
                cadence: ['setup', 'weekly', 'monthly'],
                fillChecklist: [
                    'Work through setup order before expecting the rest of the system to feel coherent.',
                    'Use the page-by-page guide below to understand what each screen expects.',
                    'Mark 30/60/90 steps complete only after the system and habits are actually in place.',
                ],
                lookAtFirst: [
                    'Setup order',
                    'Daily / weekly / monthly rhythm',
                    'Incomplete playbook steps',
                ],
            };
        case '/fintech-context':
            return {
                cadence: ['setup', 'monthly', 'as_needed'],
                fillChecklist: [
                    'Document sources of truth and critical pipelines.',
                    'Mark manual entry steps, reconciliation risk, and compliance constraints.',
                    'Link the context item to initiatives trying to remove friction or risk.',
                ],
                lookAtFirst: [
                    'Manual-step hotspots',
                    'Reconciliation-risk items',
                    'Context records not linked to any initiative even though roadmap work depends on them',
                ],
            };
        case '/sprint':
            return {
                cadence: ['daily', 'weekly'],
                fillChecklist: [
                    'No page-specific setup is needed beyond good Jira data.',
                    'Use filters when you need to narrow the sprint story by squad, epic, or risk.',
                ],
                lookAtFirst: [
                    'Completion rate',
                    'Blocked count',
                    'Carry-over risk and review/QA concentration',
                ],
            };
        case '/focus':
            return {
                cadence: ['daily', 'as_needed'],
                fillChecklist: [
                    'No direct setup is required.',
                    'Use this page after sync when you want the active execution picture rather than the whole backlog.',
                ],
                lookAtFirst: [
                    'Blocked cards',
                    'Active epics',
                    'Current WIP concentration',
                ],
            };
        case '/work-mix':
            return {
                cadence: ['weekly', 'monthly'],
                fillChecklist: [
                    'No direct setup is required.',
                    'Use filters to narrow the conversation to a team, theme, or period.',
                ],
                lookAtFirst: [
                    'Bug versus feature ratio',
                    'Changes in work mix across periods',
                    'Signals that roadmap capacity is being consumed elsewhere',
                ],
            };
        case '/workflow':
            return {
                cadence: ['weekly', 'as_needed'],
                fillChecklist: [
                    'No direct setup is required.',
                    'Use this page when something feels slow and you need evidence of the bottleneck.',
                ],
                lookAtFirst: [
                    'Longest time-in-stage',
                    'Bounce-back and reopen patterns',
                    'Lead time versus cycle time distribution',
                ],
            };
        case '/bugs':
            return {
                cadence: ['weekly', 'as_needed'],
                fillChecklist: [
                    'No direct setup is required.',
                    'Review this page whenever quality is competing with roadmap capacity.',
                ],
                lookAtFirst: [
                    'Open bug trend',
                    'Oldest unresolved bugs',
                    'Hotspots by area or component',
                ],
            };
        case '/aging':
            return {
                cadence: ['weekly'],
                fillChecklist: [
                    'No direct setup is required.',
                    'Use filters to focus on unresolved work and current review windows.',
                ],
                lookAtFirst: [
                    'Oldest blocked tickets',
                    'Aging in-progress work',
                    'Tickets that are stale because nobody owns the next move',
                ],
            };
        case '/epics':
            return {
                cadence: ['weekly', 'as_needed'],
                fillChecklist: [
                    'No direct setup is required beyond good Jira epic linkage.',
                    'Use this page to review delivery grouped by theme instead of ticket-by-ticket.',
                ],
                lookAtFirst: [
                    'Epics with blocked child work',
                    'Epics with slow progress',
                    'Tickets with no epic context',
                ],
            };
        case '/tickets':
            return {
                cadence: ['setup', 'daily', 'weekly'],
                fillChecklist: [
                    'Create and save recurring PM working views.',
                    'Select ticket sets you frequently use for reporting, docs, or narrative generation.',
                    'Use this as the raw operating table when you need detail.',
                ],
                lookAtFirst: [
                    'Your saved PM views',
                    'Selected tickets for the current conversation',
                    'Filters that represent weekly review, blockers, and release-ready work',
                ],
            };
        case '/ai-reports':
            return {
                cadence: ['weekly', 'as_needed'],
                fillChecklist: [
                    'Select the right Jira issue set before generating.',
                    'Choose the report type and tone for the audience.',
                    'Use history to compare drafts over time instead of regenerating blindly.',
                ],
                lookAtFirst: [
                    'Latest sync briefing',
                    'Selected ticket context',
                    'Report history for the audience you care about',
                ],
            };
        case '/docs':
            return {
                cadence: ['as_needed'],
                fillChecklist: [
                    'Select the tickets that need internal-facing explanation.',
                    'Pick the audiences that need documentation.',
                    'Review generated content before reuse.',
                ],
                lookAtFirst: [
                    'Tickets with weak documentation quality',
                    'Selected ticket set',
                    'Audience-specific notes',
                ],
            };
        case '/slideshow':
            return {
                cadence: ['weekly', 'monthly', 'as_needed'],
                fillChecklist: [
                    'Curate the story before presenting.',
                    'Use presentation mode for stakeholder or leadership sessions.',
                    'Review speaker notes instead of improvising off raw dashboard data.',
                ],
                lookAtFirst: [
                    'Slide order',
                    'Speaker notes',
                    'Whether the deck is telling the right story for the audience',
                ],
            };
        case '/settings':
            return {
                cadence: ['setup', 'monthly', 'as_needed'],
                fillChecklist: [
                    'Validate Jira connection and sync behavior.',
                    'Set team assumptions used by cost and delivery calculations.',
                    'Configure and test scheduled reports.',
                ],
                lookAtFirst: [
                    'Server environment status',
                    'Scheduled report preview and recent outputs',
                    'Any connection or config drift that would break trust in the dashboard',
                ],
            };
        default:
            return {
                cadence: ['as_needed'],
                fillChecklist: [
                    'Use the page guide to understand the intended workflow before adding more data.',
                ],
                lookAtFirst: [
                    'The page header summary',
                    'Guide panel instructions',
                ],
            };
    }
}
