# Decisions log (append-only)

Every agent reads this before starting work. Entries are added by the `pm` agent at feature sign-off using `templates/ADR_ENTRY.md`. Never edit past entries; supersede them.

## ADR-000: Stack and team process — 2026-09-13
Status: ACTIVE

**Shipped:** TypeScript monorepo (pnpm + Turborepo): `apps/web` Next.js App Router + Tailwind + shadcn/ui; `apps/api` Hono with Zod-generated OpenAPI; `packages/contract` (schemas, openapi.yaml, client); `packages/db` Drizzle + Postgres; Auth.js; Vitest + Playwright; Docker → Cloud Run.
**Why:** Common, well-documented stack so agents hallucinate less; explicit contract boundary so frontend and backend build in parallel.
**Alternatives rejected:** tRPC — dissolves the explicit contract the process depends on. Next.js API routes as backend — blurs the boundary. Prisma — Drizzle's plain-TS schema is easier for agents to read and diff.
**Process:** Gates at PRD, ACCEPTANCE+UX, and final sign-off require the product owner. QA runs before design (requirements) and after build (verification). Max 3 QA→builder loops before escalation. Data-engineer decides per-feature whether a store beyond Postgres is warranted (default: no); any such addition is routed to the product owner before the contract freezes. No standing solution-architect role — tech-lead absorbs system design at current scale; revisit if a feature needs a new service or crosses a service boundary.

## ADR-001: Bot Telemetry & Monitoring Dashboard — 2026-09-19
Status: ACTIVE

**Shipped:** Added a real-time bot telemetry system using Nhost Postgres (replacing the original Supabase Realtime plan due to lack of Supabase service role keys). `bot_telemetry` table added via migration script. Telegram and Userbot backends emit state via standard `pg`/`psycopg2` inserts. Frontend `BotHealthStatus.jsx` polls a Netlify function (`/.netlify/functions/botTelemetry`) to display "Currently Thinking", "Last Execution", and live ticker "Idle Time".
**Why:** To give the product owner real-time visibility into bot efficiency, identifying bottlenecks dynamically without reading raw terminal logs. Nhost Postgres was chosen as it's the primary database instance with valid credentials in `.env`.
**Alternatives rejected:** Supabase Realtime Broadcast — rejected because we lacked the service keys necessary to build the pipeline safely alongside the rest of the database, and Postgres polling at 2s intervals is sufficient for this volume.
**Scope Cuts:** Dropped audio ping on critical error (DL-4) to reduce complexity for V1.
