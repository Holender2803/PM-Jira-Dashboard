# PM Jira Dashboard - Workflow Visibility and PM Ops Upgrade

## Summary
This PR delivers a large PM analytics upgrade focused on workflow visibility, risk tracking, workload insights, and better storytelling outputs.

## Major Additions

### Workflow Sankey (Grouped and Readable)
- Added canonical workflow-group mapping layer:
  - Backlog, Planning, In Progress, Review / QA, Awaiting, Blocked / Hold, Done
- Added grouped transition analytics in `getStatusTransitionFlow(...)`:
  - backward transition tracking
  - bottleneck source detection (`avg dwell > 2x median`)
  - unique-ticket counts per workflow group
- Added improved Sankey chart:
  - grouped node labels with ticket counts
  - edge threshold slider (`Min transitions to show`)
  - forward/backward color/opacity differentiation
  - hover tooltip (`X → Y: N transitions`)
  - top-left legend
  - sparse-data placeholder
- Mounted as primary Workflow section with controls.

### Global Workflow Group Filter (Cross-Dashboard)
- Added shared Zustand slice `workflowGroupFilter`.
- Synced local Sankey controls and global filter bar.
- Added global chip controls and presets:
  - `All`
  - `Active only`
- Added summary tag in filter bar when group filter is active.
- Applied group filtering across dashboards via in-memory filters and analytics filter params.

### Sprint, Focus, Bugs, Tickets Upgrades
- Sprint:
  - Velocity trend (including rolling 3-sprint average)
  - Capacity planner (forecast, confidence band, what-if)
- Focus:
  - Team Load view with per-assignee workload signals
- Bugs:
  - Reopen-rate KPI with prior-window trend and top reopened tickets
- Tickets:
  - SLA urgency panels, trend views, assignee breach insights

### Data/Backend and Reliability
- Jira query path updates and sync hardening.
- DB sync timestamp normalization and timezone-safe display formatting.
- Additional API/query filter support (`groupFilter`) and normalized issue shape handling.

### Documentation
- Added full implementation changelog:
  - `docs/IMPLEMENTATION_CHANGELOG.md`

## Files of Interest
- `src/lib/workflow-groups.ts`
- `src/lib/analytics.ts`
- `src/components/charts/SankeyChart.tsx`
- `src/app/(dashboard)/workflow/page.tsx`
- `src/components/filters/FilterBar.tsx`
- `src/store/app-store.ts`
- `src/lib/filters.ts`
- `src/lib/issue-store.ts`
- `src/app/api/jira/issues/route.ts`

## Validation
- `npm run build` passes.
