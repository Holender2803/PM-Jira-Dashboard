# Jira PM Analytics Cockpit

Full-stack Next.js app for Product Managers to analyze Jira sprint delivery, workflow bottlenecks, work mix, bug load, aging tickets, and AI-generated status summaries.

Detailed project documentation:
- `docs/PROJECT_DOCUMENTATION.md`

## What It Includes

- Secure Jira ingestion (server-side only) with Atlassian API token
- Incremental/manual sync (`/api/sync`) with sync log persistence
- SQLite normalized storage for issues, sprints, saved views, AI reports
- PM-focused dashboards:
  - Overview
  - Sprint
  - Focus
  - Work Mix
  - Workflow
  - Bugs
  - Aging
  - Ticket Explorer
  - AI Reports
  - Settings
- Global filters across dashboards (sprint, status, issue type, assignee, priority, project, squad, epic, labels, date range, blocked/bugs/unresolved/selected)
- Ticket explorer with multi-select, saved views, and CSV export
- AI report generation for selected/filter-scoped tickets
- Demo mode with Jira-like seeded data (`NEXT_PUBLIC_DEMO_MODE=true`)

## Tech Stack

- Next.js App Router + TypeScript
- Zustand for UI state
- better-sqlite3 for persistence
- Recharts for visualization
- OpenAI or Groq API for AI report generation

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

3. Set at minimum:

- `JIRA_BASE_URL`
- `JIRA_USER_EMAIL`
- `JIRA_API_TOKEN`
- `OPENAI_API_KEY` or `GROQ_API_KEY` (optional for AI; mock fallback exists)

4. Run locally:

```bash
npm run dev
```

5. Open:

- `http://localhost:3000`

## Scripts

- `npm run dev` - local development
- `npm run build` - production build
- `npm run start` - run production build
- `npm run lint` - linting
- `npm run typecheck` - TypeScript type check

## Environment Variables

See `.env.example` for full list.

Important:

- `NEXT_PUBLIC_DEMO_MODE=true` enables seed data and bypasses live Jira dependency.
- `JIRA_JQL` can override default MDFM team scope.
- `DATABASE_PATH` defaults to `./data/jira-dashboard.db`.

## API Endpoints

- `GET /api/jira/issues` - returns issues + metadata with filter params
- `POST /api/sync` - runs Jira sync
  - supports `incremental`, `dateFrom`, `dateTo`, `testOnly`
- `GET /api/sync` - checks server Jira credential connectivity
- `GET/POST/DELETE /api/saved-views` - saved filter view management
- `GET/POST /api/ai/report` - AI report history + report generation

## Security Notes

- Jira API token is only used server-side for Jira requests.
- Never expose secrets in frontend code.
- If using manual credentials via Settings page, they are stored only in browser local storage and sent directly to backend when actions are triggered.

## Scheduled Sync (recommended)

Use any scheduler (cron, GitHub Actions, etc.) to call:

- `POST /api/sync` with `{ "incremental": true }`

This keeps dashboard data fresh while minimizing Jira API load.
