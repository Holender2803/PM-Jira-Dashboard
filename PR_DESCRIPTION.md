# PM Jira Dashboard Enhancements

## Summary
This PR delivers a major PM analytics upgrade across Sprint, Workflow, and Bugs dashboards, including new forecasting, time-distribution, and quality-risk insights.

## What Was Added

### 1) Sprint Dashboard: Velocity Trending
- Added velocity analytics and 3-sprint rolling average:
  - `getVelocityTrend(...)` in `src/lib/analytics.ts`
- Added new chart:
  - `src/components/charts/VelocityChart.tsx`
- Integrated on Sprint page below summary metrics:
  - `src/app/(dashboard)/sprint/page.tsx`
- Updated Sprint page data flow to respect global filters via filtered issue set.

### 2) Workflow Dashboard: Cycle Time / Lead Time Distribution
- Added distribution analytics with percentile support and raw points grouped by issue type:
  - `getCycleLeadTimeDistribution(...)` in `src/lib/analytics.ts`
- Added histogram + percentile component:
  - `src/components/charts/CycleTimeChart.tsx`
- Added UI controls:
  - Toggle between Cycle Time and Lead Time
  - Segmented issue-type filter (`All`, `Story`, `Bug`, `Task`, `Sub-task`)
  - Expandable panel under status flow
- Added in-context explainer for chart interpretation (definitions, histogram, percentiles):
  - `src/app/(dashboard)/workflow/page.tsx`
- Updated Info page guide to document Cycle/Lead chart usage:
  - `src/app/(dashboard)/info/page.tsx`

### 3) Sprint Dashboard: Capacity Planning
- Added capacity forecasting analytics:
  - `getCapacityData(...)` in `src/lib/analytics.ts`
- Returns core requested metrics:
  - `committed`, `completed`, `completionRate`, `forecast3Sprint`, `teamCapacityDelta`
- Forecast model:
  - Rolling 3-sprint average completion rate × committed points
- Added reusable capacity planner component:
  - `src/components/CapacityPlanner.tsx`
- Includes:
  - Last 6 sprint capacity visualization
  - Forward-looking forecast with confidence band
  - PM callout for rolling completion behavior
  - What-if input for target points and projected completion/carryover
- Mounted in Sprint page as a collapsible panel below Velocity:
  - `src/app/(dashboard)/sprint/page.tsx`

### 4) Bugs Dashboard: Re-open Rate Tracking
- Added reopen analytics:
  - `getReopenRates(...)` in `src/lib/analytics.ts`
- Reopen definition implemented from status history:
  - transition from closed (`Done/Archived/Rejected`) to non-closed status
- Returns:
  - `totalBugs`, `reopenedCount`, `reopenRate`, `topReopenedTickets` (+ 30-day trend helpers)
- Added new KPI card component:
  - `src/components/ReopenRateCard.tsx`
- Includes:
  - Large reopen-rate KPI
  - Trend arrow vs prior 30-day window
  - Top 5 reopened tickets with Jira deep-links
  - Methodology tooltip
- Mounted with bug stat cards on Bugs page:
  - `src/app/(dashboard)/bugs/page.tsx`

## Technical Notes
- No new npm packages added.
- Existing Recharts stack reused.
- Global filters (including project/date) are respected by using filtered Zustand issue data in page-level integrations.

## Validation
- `npm run typecheck`
- `npm run lint`
- `npm run build`

All commands pass successfully.
