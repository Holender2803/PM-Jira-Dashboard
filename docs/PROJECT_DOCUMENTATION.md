# PM Jira Dashboard Documentation

## Latest Branch Changelog
For a full branch-level breakdown of all implemented changes, see:
- `docs/IMPLEMENTATION_CHANGELOG.md`

## Project Purpose
This project is a full-stack Jira analytics cockpit for Product Managers.  
It helps answer operational PM questions around sprint execution, work mix, blockers, bugs, aging work, delivery outcomes, and AI-generated status reporting.

## What The App Does
- Connects to Jira securely using server-side credentials.
- Syncs issues from your MDFM/Legacy MDFM JQL scope.
- Normalizes issue data into SQLite for fast dashboard queries.
- Provides PM dashboards for:
  - Overview
  - Sprint
  - Focus
  - Work Mix
  - Workflow
  - Bugs
  - Aging
  - Epics
  - Tickets
  - AI Reports
  - Settings
  - Info (usage guide)
- Supports global filtering across dashboards.
- Supports ticket selection and AI summary generation.
- Supports demo mode without live Jira credentials.

## Current Architecture
- Frontend: Next.js App Router + TypeScript
- State: Zustand (`src/store/app-store.ts`)
- Backend/API:
  - `GET /api/jira/issues`
  - `GET/POST /api/sync`
  - `GET/POST/DELETE /api/saved-views`
  - `GET/POST /api/ai/report`
- Data store: SQLite (`better-sqlite3`) via `src/lib/db.ts`
- Analytics layer: `src/lib/analytics.ts`
- Jira ingestion: `src/lib/jira-client.ts`
- Filtering engine: `src/lib/filters.ts`

## Implemented Functional Highlights
- Jira search migration to `/rest/api/3/search/jql` to avoid removed endpoint errors.
- Incremental + full sync support.
- Global filter bar with searchable dropdowns.
- Quick filters (Blocked, Bugs, Unresolved, Selected, This Week, Sprint Window).
- Epic presence filtering (`with epic` / `without epic`).
- Epic normalization utilities so labels display as `KEY — Summary` when available.
- Epic quick-link to open selected epic in Jira.
- Filter-level clear controls (`x`) for selected values and search input.
- Ticket drawer with:
  - Rich Jira description rendering (ADF -> readable UI)
  - Status transition history
  - Time spent in statuses
  - Jira deep link
- AI report generation with Confluence-friendly formatting guidance.
- Copy full report action in AI Reports.
- New dedicated Epics dashboard for epic-level execution tracking.

## Security Model
- Jira token and AI provider keys are server-side only.
- `.env.local` is ignored from git.
- Manual credentials entered in Settings are browser-local and sent only on explicit user action.

## Environment Notes
Use `.env.example` as template.

Minimum live Jira setup:
- `JIRA_BASE_URL`
- `JIRA_USER_EMAIL`
- `JIRA_API_TOKEN`

AI setup (optional):
- OpenAI (`OPENAI_API_KEY`) or Groq (`GROQ_API_KEY`)

Demo mode:
- `NEXT_PUBLIC_DEMO_MODE=true`

## How To Run
```bash
npm install
npm run dev
```

## Validation Commands
```bash
npm run lint
npm run typecheck
npm run build
```

## Current Status
Project is in a production-style, usable state for PM analytics workflows, with active development on UX refinements and dashboard storytelling enhancements.
