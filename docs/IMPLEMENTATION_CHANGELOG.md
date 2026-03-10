# PM Jira Dashboard - Implementation Changelog

This document summarizes the implementation included in branch `feature/pm-center-plus-fixes` as of March 10, 2026.

## 1) Overview Dashboard - AI Morning Briefing
- Added a top-level `Today's Briefing` card above KPI cards.
- Briefing generation calls `POST /api/ai/report` with `type: morning_briefing` and executive tone.
- Frontend now sends structured sprint context (completion, days remaining, blockers, carry-over risk, longest blocked ticket) instead of raw issue dumps.
- Added briefing refresh action and loading skeleton.
- Added collapse/minimize behavior for compact summary view.
- Added UI hard cap (500 chars) with truncation safety and full-text hover/expand behavior.

## 2) AI Report Route and Prompting Controls
- Updated `morning_briefing` prompt for strict 3-sentence output behavior.
- Added explicit stop/format constraints to prevent confluence-style structured output.
- Set `max_tokens` for `morning_briefing` to `150`.
- Set `temperature` to `0.3` for `morning_briefing` for better instruction adherence.
- Removed confluence format guidance from the morning briefing path.

## 3) Shared Status Grouping and Chart Consistency
- Extracted canonical status-group mapping to shared utility:
  - `src/lib/statusGroups.ts`
- Updated Sankey and status-group charts to use the same resolver.

### Issues by Status Group
- Replaced raw status bars with canonical grouped statuses.
- Added `Include Done` toggle (default OFF) with hidden-done count label.

### Workflow Funnel
- Reworked funnel to emphasize active pipeline stages.
- Removed `Closed` bar from funnel visualization and added separate closed summary line below chart.
- Added per-bar tooltip with `X tickets (Y% of total)`.

### Work Mix Donut
- Added slice consolidation logic:
  - Merge low-percentage non-protected types into `Other`.
  - Cap named slices to 6 + optional `Other`.
- Added center label for dominant type and percent.

### Sprint Completion Donut
- Updated sprint completion legend to explicit slices:
  - Done, In Progress, In Review, In QA, Waiting, Blocked, Not Started.
- Added empty-state fallback (`No sprint data available`) when all slices are zero.

## 4) Sprint Dashboard - Data Quality and Forecasting

### Story Points Coverage Warning
- Added `hasStoryPointsCoverage(...)` utility.
- Added yellow warning banner under sprint filter area when story point coverage is low.
- Banner is dismissible per session via Zustand state.
- `Test Sub-task` issues are excluded from story-point-required coverage checks.

### Days Remaining KPI
- Added `Days Remaining` indicator next to sprint completion.
- Color logic:
  - green (`>5`)
  - amber (`2-5`)
  - red (`<=1`)
  - gray fallback when end date missing.

### Burndown Mini-Chart
- Added `Burndown (Mini)` chart under velocity trend.
- Added `/api/sync/history` endpoint to source snapshot history from `sync_log`.
- Added placeholder when historical sync density is insufficient.

### Carry-over Prediction
- Added `Carry-over Prediction` section below capacity planner.
- Added risk summary text plus at-risk ticket table.
- Table columns:
  - Key
  - Summary
  - Assignee
  - Current Status
  - Days Active

### Sprint Tickets Controls and Columns
- Added sortable `Type` column support in issue table.
- Added `Story Points`, `Due Date`, and `Resolution` columns for sprint tickets.
- Added sprint ticket view filter controls:
  - `All Tickets`
  - `Open Tickets`
  - `In Progress Tickets`
  - `In Review`
  - `Done`
  - `Exclude Sub Tickets` true/false toggle.
- View selection behavior:
  - selecting one or more view checkboxes automatically unchecks `All Tickets`
  - selecting `All Tickets` clears specific view filters and shows full scope.
- Fixed sub-ticket exclusion so only true sub-task issue types are excluded (not Story/Technical Task).

## 5) Jira Sync and Parsing Reliability
- Story points extraction now dynamically discovers story-point field keys from Jira `/field` metadata.
- Added numeric coercion for multiple field value shapes.
- Ensured field list is preserved in fallback search path.
- Incremental sync now also refreshes `sprint in openSprints()` to avoid stale active sprint data.
- Added Jira `resolution` ingestion and propagation to UI table.

## 6) Styling and UX Updates
- Updated status color mapping so `Done` is green in badges/charts.
- Updated sprint ticket filter section to visually match the top filter bar design language.

## 7) Validation
- Verified repeatedly with:
  - `npm run build`
- Build passes successfully.
