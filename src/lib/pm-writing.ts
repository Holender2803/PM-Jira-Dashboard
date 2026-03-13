export interface PmWritingPrompt {
    label: string;
    text: string;
}

export const initiativeSummaryPrompts: PmWritingPrompt[] = [
    {
        label: 'Problem + Impact',
        text: 'We are solving [customer problem] because it is causing [user pain or business impact] in the current workflow.',
    },
    {
        label: 'Scope',
        text: 'This initiative focuses on improving [workflow or capability] without expanding into [adjacent scope we are intentionally excluding].',
    },
    {
        label: 'Success',
        text: 'Success looks like [measurable outcome] while keeping [risk, cost, or operational burden] under control.',
    },
];

export const initiativeNotesPrompts: PmWritingPrompt[] = [
    {
        label: 'Evidence',
        text: 'Evidence so far: [customer quotes, Jira patterns, support feedback, usage signal].',
    },
    {
        label: 'Open Questions',
        text: 'Open questions before commitment: [assumption], [dependency], [constraint].',
    },
    {
        label: 'Risks',
        text: 'Main delivery or product risks: [risk 1], [risk 2], [risk 3].',
    },
];

export const taskNotesPrompts: PmWritingPrompt[] = [
    {
        label: 'Purpose',
        text: 'The purpose of this PM task is to unblock or clarify [decision, dependency, or customer issue].',
    },
    {
        label: 'Needed Input',
        text: 'Before this task is complete, I need input from [team or stakeholder] on [specific topic].',
    },
    {
        label: 'Definition of Done',
        text: 'This task is done when [artifact, meeting, decision, or communication] has been completed and shared.',
    },
];

export const decisionContextPrompts: PmWritingPrompt[] = [
    {
        label: 'Tradeoff',
        text: 'We need to decide between [option A] and [option B] because [constraint, deadline, or risk] makes it hard to do both.',
    },
    {
        label: 'Do Nothing',
        text: 'If we do nothing, the likely outcome is [customer impact, delivery risk, or business downside].',
    },
    {
        label: 'Constraint',
        text: 'The main constraint driving this decision is [capacity, dependency, compliance, quality, or timing].',
    },
];

export const decisionFinalPrompts: PmWritingPrompt[] = [
    {
        label: 'Decision Statement',
        text: 'We decided to [chosen option] for [target audience or workflow] because it best balances [value] against [constraint].',
    },
    {
        label: 'Why This Option',
        text: 'We are choosing this option over the alternatives because it gives us [benefit] with an acceptable level of [risk or cost].',
    },
];

export const decisionExpectedOutcomePrompts: PmWritingPrompt[] = [
    {
        label: 'Expected Improvement',
        text: 'We expect this decision to improve [metric, delivery speed, product quality, or customer experience] over the next [time period].',
    },
    {
        label: 'Validation',
        text: 'We will know this worked when [observable signal, KPI movement, or stakeholder outcome] is visible.',
    },
];

export const decisionOptionProsPrompts: PmWritingPrompt[] = [
    {
        label: 'Benefits',
        text: 'Benefits of this option: [customer value], [delivery simplicity], [risk reduction].',
    },
    {
        label: 'Strategic Fit',
        text: 'This option aligns well with our current priorities because [reason].',
    },
];

export const decisionOptionConsPrompts: PmWritingPrompt[] = [
    {
        label: 'Tradeoffs',
        text: 'Tradeoffs of this option: [lost scope], [higher effort], [slower timeline], [customer risk].',
    },
    {
        label: 'Operational Risk',
        text: 'Main downside or operational risk: [risk] if [condition] happens.',
    },
];

export const stakeholderNotesPrompts: PmWritingPrompt[] = [
    {
        label: 'Influence',
        text: 'This stakeholder influences [decision area, team, or customer segment] and should be included when [specific trigger].',
    },
    {
        label: 'Primary Concern',
        text: 'They care most about [timeline, revenue, adoption, risk, or workflow pain] in relation to [initiative or product area].',
    },
    {
        label: 'Working Style',
        text: 'Best way to work with this stakeholder: [cadence, format, and level of detail they respond well to].',
    },
];

export const interactionNotesPrompts: PmWritingPrompt[] = [
    {
        label: 'Key Points',
        text: 'Key points raised in the conversation: [point 1], [point 2], [point 3].',
    },
    {
        label: 'Commitments',
        text: 'Commitments made during this interaction: [owner] will [action] by [date or milestone].',
    },
    {
        label: 'Follow-Up',
        text: 'Follow-up needed: [next action] with [stakeholder or team] because [reason].',
    },
];

export const objectiveDescriptionPrompts: PmWritingPrompt[] = [
    {
        label: 'Objective Framing',
        text: 'This objective exists to improve [customer or business outcome] in [workflow or product area] over the next [time period].',
    },
    {
        label: 'Why Now',
        text: 'This matters now because [market signal, customer pain, operational constraint, or company priority].',
    },
];

export const outcomeDescriptionPrompts: PmWritingPrompt[] = [
    {
        label: 'Outcome Statement',
        text: 'We want to move from [current state] to [desired state] for [customer segment, process, or metric].',
    },
    {
        label: 'Behavior Change',
        text: 'If this outcome is working, we should see [specific behavior or metric change] in [time period].',
    },
];

export const kpiSourceNotesPrompts: PmWritingPrompt[] = [
    {
        label: 'Measurement Source',
        text: 'This KPI is measured using [system, report, Jira query, or manual process], which is currently updated [cadence].',
    },
    {
        label: 'Known Gaps',
        text: 'Known measurement gaps or caveats: [lag, sample bias, missing data, or manual adjustment].',
    },
];

export const kpiMeasurementNotePrompts: PmWritingPrompt[] = [
    {
        label: 'Movement Explanation',
        text: 'This measurement moved because [product change, seasonal effect, operational issue, or data correction].',
    },
    {
        label: 'Confidence',
        text: 'Confidence in this reading is [high / medium / low] because [data quality or collection reason].',
    },
];

export const prioritizationRationalePrompts: PmWritingPrompt[] = [
    {
        label: 'Why High',
        text: 'This ranks highly because it reaches [audience] and materially improves [customer or business outcome] with manageable effort.',
    },
    {
        label: 'Why Lower',
        text: 'This is ranked below the top items because confidence is limited by [missing evidence or dependency] and effort is higher than the current alternatives.',
    },
    {
        label: 'Decision Use',
        text: 'This score should be used to compare against [competing item] during [planning or roadmap review].',
    },
];

export const fintechDescriptionPrompts: PmWritingPrompt[] = [
    {
        label: 'Source of Truth',
        text: 'The source of truth for this workflow is [system or dataset], while downstream teams often reference [secondary system or report].',
    },
    {
        label: 'Manual Work',
        text: 'Manual intervention currently happens at [step] when [condition], which creates [delay, error risk, or operational cost].',
    },
    {
        label: 'Reconciliation Risk',
        text: 'The main reconciliation risk is between [system A] and [system B] because [mismatch or timing issue].',
    },
];

export const fintechCompliancePrompts: PmWritingPrompt[] = [
    {
        label: 'Compliance Constraint',
        text: 'This workflow must satisfy [policy, audit, or regulatory requirement], which affects [data handling, approvals, or reporting].',
    },
    {
        label: 'Review Requirement',
        text: 'Before changes ship, [team or role] must review [control, report, or user flow] to confirm compliance impact is acceptable.',
    },
];
