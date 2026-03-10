# PM Jira Dashboard - Overview + Sprint Data Quality and Chart Reliability Upgrade

## Summary
This PR delivers a combined UX and data-quality upgrade across Overview and Sprint pages, with stronger AI morning briefing behavior, canonical chart grouping, and improved sprint ticket controls for PM operations.

## What Changed

### 1) Overview: AI Morning Briefing
- Added `Today's Briefing` card at top of Overview.
- Generates on load using `/api/ai/report` with `morning_briefing` type.
- Uses structured sprint metrics instead of raw issue dumps.
- Added refresh action, skeleton loading, minimize/collapse mode.
- Added frontend display guardrail (max 500 chars with truncation behavior).

### 2) AI Report Route Improvements
- Tightened morning briefing prompt to strict 3 sentences.
- Removed confluence formatting path for morning briefing requests.
- `max_tokens` for morning briefing set to `150`.
- `temperature` for morning briefing set to `0.3`.

### 3) Chart Standardization and Readability
- Introduced shared status-group mapping utility (`src/lib/statusGroups.ts`) and reused in Sankey + grouped charts.
- Issues by Status:
  - grouped into canonical workflow groups
  - `Include Done` toggle (default OFF)
  - hidden done count hint for readability
- Workflow Funnel:
  - active stages shown in funnel
  - closed shown as separate summary stat below chart
  - per-bar tooltip includes count and percent
- Work Mix Donut:
  - low-value non-protected slices collapse into `Other`
  - max named slices cap
  - dominant center label
- Sprint Completion Donut:
  - explicit multi-stage legend
  - empty-state placeholder when no data

### 4) Sprint Dashboard Data Quality and Forecasting
- Story point coverage utility + dismissible warning banner (session-only via Zustand).
- Added Days Remaining KPI with color coding and missing-date fallback.
- Added Burndown mini-chart under velocity with sync-history approximation.
- Added Carry-over prediction table + summary block.

### 5) Sprint Ticket Table and Filtering
- Added/updated columns:
  - Type (sortable)
  - Story Points
  - Due Date
  - Resolution
- Added ticket view controls:
  - `All Tickets`
  - `Open Tickets`
  - `In Progress Tickets`
  - `In Review`
  - `Done`
  - `Exclude Sub Tickets` true/false toggle
- Selection behavior:
  - specific view selection unchecks `All Tickets`
  - selecting `All Tickets` clears specific selections
- Fixed sub-ticket exclusion logic to target actual sub-task issue types only.
- `Test Sub-task` is excluded from story-point-required coverage checks.

### 6) Jira Data Ingestion and Sync Fixes
- Story points extraction now dynamically detects Jira story-point custom field ids.
- Added robust numeric coercion when field values differ by shape.
- Preserved explicit field list in search fallback path.
- Incremental sync now also refreshes active sprint scope (`sprint in openSprints()`).
- Added resolution parsing (`fields.resolution.name`) for closed-ticket analysis.

### 7) Visual Consistency
- Updated `Done` status color to green.
- Restyled Sprint ticket filter block to align with top filter bar visual language.

## Files of Interest
- `src/app/(dashboard)/page.tsx`
- `src/app/(dashboard)/sprint/page.tsx`
- `src/app/api/ai/report/route.ts`
- `src/app/api/jira/issues/route.ts`
- `src/app/api/sync/route.ts`
- `src/app/api/sync/history/route.ts`
- `src/components/charts/DashboardCharts.tsx`
- `src/components/charts/SankeyChart.tsx`
- `src/components/charts/BurndownMiniChart.tsx`
- `src/components/filters/FilterBar.tsx`
- `src/components/tables/IssueTable.tsx`
- `src/components/ui/Badges.tsx`
- `src/lib/analytics.ts`
- `src/lib/jira-client.ts`
- `src/lib/statusGroups.ts`
- `src/lib/workflow.ts`
- `src/store/app-store.ts`
- `src/types/index.ts`
- `docs/IMPLEMENTATION_CHANGELOG.md`

## Validation
- `npm run build` passes.
