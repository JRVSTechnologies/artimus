# PRD: Bot Telemetry & Monitoring Dashboard
Slug: `bot-telemetry` · Author: pm · Status: DRAFT · Date: 2026-09-19

## Problem
The current Bot Health Status page only shows high-level metrics (uptime, ping, CPU, memory). It lacks visibility into the bots' internal state, making it difficult to monitor efficiency and effectiveness. The product owner cannot see what the bots are currently thinking, their last executed tasks, or their idle time.

## Users
Product Owner (Jossie). Primary user monitoring bot efficiency to drive improvements.

## Scope — in
- Real-time "Currently Thinking" stream showing structured state milestones emitted by the bots.
- Display of the bot's "Last Execution/Work Done" with task descriptions, timestamps, and outcome status.
- Real-time "Idle Time" tracker indicating how long since the last active task.
- A redesigned bot detail view that incorporates these new metrics alongside existing CPU/Memory stats.

## Scope — out
- Automated remediation or restart capabilities from this dashboard.
- Modifying bot configuration directly from this screen.
- Historical analytics beyond the last 24 hours.

## Success metric
Product owner can identify specific bottlenecks or inefficiencies in bot execution loops based on real-time telemetry data within 5 minutes of observing a slowdown.

## Constraints
- Needs to integrate with the existing Next.js App Router and shadcn/ui dashboard.
- Telemetry gathering must not block or slow down the bots' core signal processing.

## Related decisions
- ADR-000: Builds on the existing Next.js + Tailwind UI stack.

## Open questions
1. Should the "Currently Thinking" feed be a raw log tail, or structured state milestones emitted by the bots? — default if unanswered: Structured state milestones (easier to read and parse).
2. For "Last Execution", should we query this directly from the `packages/db` Postgres database, or do we need a fast in-memory store like Redis? — default if unanswered: Postgres database, pulling the latest `tasks` row.
3. Are we tracking "Idle Time" per specific skill/sub-task or just overall bot idleness? — default if unanswered: Overall bot idleness.
