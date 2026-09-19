# PLAN: Bot Telemetry & Monitoring Dashboard
Slug: `bot-telemetry` · Author: tech-lead · Status: DRAFT

## 1. Database (Supabase)
- Run the SQL migration to create the `bot_telemetry` table and enable Supabase Realtime for it.
- **Contract Boundary**: The bots will write to this table directly, and the frontend will subscribe to it directly via `@supabase/supabase-js`. 

## 2. Backend / Bot Infrastructure
- **Python `telegram-bot`**: Add a small telemetry service to upsert the bot's state to Supabase on every message received, processed, or failed.
- **Node `userbot`**: Add a telemetry module to `index.js` to upsert its current thinking state and task status to Supabase.
- **Payload**: `upsert({ bot_id, status, currently_thinking, last_task, task_status, last_active_at: now() })`.

## 3. Frontend (`apps/web` / `src`)
- **Real-time Subscription**: Use `@supabase/supabase-js` in a React `useEffect` (or a custom hook) to subscribe to `postgres_changes` on the `bot_telemetry` table.
- **UI Components**:
  - Update `src/components/BotHealthStatus.jsx` (or create if missing) to match the wireframes in `UX.md`.
  - Create the "Currently Thinking" feed using a scrollable list that appends incoming websocket payloads.
  - Implement the "Idle Time" counter: A `setInterval` that calculates `Date.now() - last_active_at` every second and formats it as `Xm Ys`.
- **QA Delight Items**:
  - Implement DL-1 (Pause/Resume button) for the live feed stream.
  - Implement DL-2 (Color dots for task outcomes).
  - Implement DL-3 (Copy to clipboard for error logs).

## 4. Testing & QA
- Since we have an explicit Realtime contract via Supabase, frontend can mock the Supabase broadcast channel to simulate rapid telemetry events for component testing.
- Playwright E2E test: Mock the DB insert and verify the UI updates without refreshing.
