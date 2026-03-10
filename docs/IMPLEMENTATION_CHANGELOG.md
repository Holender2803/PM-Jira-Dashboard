# PM Jira Dashboard - Implementation Changelog

This document summarizes the full implementation scope currently included in branch `feature/workflow-visibility-risk`.

## 1) Platform and Data Foundations
- Added/expanded normalized issue model fields:
  - `dueDate`
  - richer changelog/status-derived metrics
  - workflow-group aware filtering support
- Updated DB sync timestamp handling to ISO UTC format for consistency.
- Added robust timestamp normalization/display utilities to avoid timezone drift.
- Expanded demo data coverage to better represent PM dashboard scenarios.

## 2) Jira Integration and Sync Reliability
- Jira search integration updated to modern Cloud endpoint behavior.
- Sync pipeline supports incremental/full refresh workflows.
- API responses include normalized issue shapes for dashboard stability.
- Server-side issue querying supports additional filter dimensions, including workflow-group filtering.

## 3) Global Filtering System Enhancements
- Filter bar upgraded with searchable dropdown behavior and clear controls.
- Added richer quick filters:
  - Blocked
  - Bugs
  - Unresolved
  - At Risk
  - Selected
  - This Week
  - Sprint Window
- Epic controls improved:
  - `Key - Summary` display
  - Jira deep-link from selected epic
- Added global workflow group filtering:
  - groups: `Backlog`, `Planning`, `In Progress`, `Review / QA`, `Awaiting`, `Blocked / Hold`, `Done`
  - persisted in Zustand under shared state (`workflowGroupFilter`)
  - synchronized between local dashboard controls and global filter bar
  - summary tag shown when group filter is active

## 4) Workflow Grouping and Status Mapping
- Introduced canonical workflow-group resolver with alias mapping for heterogeneous Jira statuses.
- Added hardcoded stage index ordering to make flow analysis consistent.
- Added helper utilities for:
  - resolving raw status -> canonical group
  - generating status lists for SQL/group filters
  - active-only presets

## 5) Dashboard Additions and Upgrades

### Overview
- Improved sync timestamp rendering and display consistency.
- Global filtering behavior integrated with new workflow-group model.

### Sprint Dashboard
- Velocity trending added:
  - completed points/tickets by sprint
  - rolling 3-sprint average
- Capacity Planning module added:
  - committed vs completed
  - 3-sprint forecast
  - capacity delta
  - confidence band
  - what-if planning input

### Focus Dashboard
- Added Team Load tab and workload card grid.
- Per-assignee workload metrics include:
  - open/in-progress points
  - blocked/overdue signals
  - overload threshold highlighting
- Assignee selection ties back to global filter state.

### Workflow Dashboard
- Added Cycle/Lead time distribution module:
  - histogram
  - p50/p75/p95 percentiles
  - issue-type segmentation
  - explanatory guidance
- Added grouped Status Flow Sankey:
  - canonical 7-group transitions
  - forward/backward coloring
  - threshold slider (`Min transitions to show`)
  - bottleneck mode (source dwell > 2x median)
  - node ticket counts
  - hover tooltip for transition details
  - in-chart legend and sparse-data placeholder behavior

### Bugs Dashboard
- Reopen Rate analytics added:
  - reopen detection from status history transitions (closed -> active)
  - reopen KPI + trend vs prior window
  - top reopened tickets with Jira links
- Bugs by area improved with better epic labeling.

### Tickets Dashboard
- Added SLA panel and urgency visualization:
  - urgency buckets (`Overdue`, `Due Today`, `Due This Week`, `Due Soon`, `On Track`)
  - at-risk table with sortable columns
  - assignee breach views
  - trend chart

### Epics Dashboard
- Epic display improvements to show `Key - Summary` format consistently where available.

### AI Reports
- AI report workflow improved for PM weekly storytelling output and copy/paste usage.

### Info Page
- Added guidance explaining dashboard purposes and usage expectations.

## 6) Analytics Layer Expansion (`src/lib/analytics.ts`)
- Added/expanded analytics functions for:
  - sprint velocity trend
  - capacity planning and forecasting
  - cycle/lead distributions
  - assignee workload
  - grouped status-transition flow
  - SLA status/trend/assignee breach metrics
  - reopen-rate metrics
- Added optional workflow group filtering support to filter-object analytics entry points.

## 7) State Management (`src/store/app-store.ts`)
- Added shared workflow-group slice:
  - `workflowGroupFilter`
  - synchronized with `filters.groupFilter`
  - survives navigation and keeps chart/global controls in sync

## 8) UX and Styling
- Filter bar styling unified with dashboard surface.
- Added new reusable chip/tag styles for workflow-group control rows and summary tags.
- Added stronger visual hierarchy for high-signal controls and chart legends.

## 9) Environment and Config
- `.env.example` updated with additional app configuration guidance, including display timezone support.

## 10) Validation
- Project builds successfully with:
  - `npm run build`

