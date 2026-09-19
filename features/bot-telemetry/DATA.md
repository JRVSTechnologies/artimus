# Data: Bot Telemetry & Monitoring Dashboard
Slug: `bot-telemetry` · Author: data-engineer · Status: DRAFT

## Decision
Store needed: YES

## Store type
Postgres (default). Supabase is already used in this project and its built-in Postgres + Realtime capabilities are perfect for tracking live bot telemetry and broadcasting it to the frontend via WebSockets. No additional store (like Redis) is required because the volume of state changes per bot (a few per second max) is well within Supabase's realtime broadcast limits.

## Schema
**New Table: `bot_telemetry`**
- `id` (uuid, primary key)
- `bot_id` (varchar, e.g., 'artimus', 'mcn-markets')
- `status` (varchar: 'online', 'offline', 'error')
- `currently_thinking` (text, latest state milestone)
- `last_task` (text, description of the last completed or attempted task)
- `task_status` (varchar: 'success', 'error', 'processing')
- `last_active_at` (timestamp, updated on every state change to calculate idle time)

## Migration
Since the project uses Supabase, we will create a `.sql` migration script in a `supabase/migrations` folder (or run it via the Supabase SQL editor):
`CREATE TABLE bot_telemetry (...)`
Plus, enabling Realtime on this table:
`alter publication supabase_realtime add table bot_telemetry;`

## Indexes
- Index on `bot_id` since the dashboard will query for the latest state of each bot.

## Data lifecycle
The `bot_telemetry` table acts as a current-state cache. It will only hold one row per `bot_id` (using an `upsert` pattern). Thus, data retention is infinite but size is negligible (O(N) where N = number of bots). For a historical log of "thinking" states, we could add an append-only `bot_telemetry_log` table later if needed, but per the PRD, historical analytics are out of scope.
