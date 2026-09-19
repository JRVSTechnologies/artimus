# QA Report: Bot Telemetry & Monitoring Dashboard
Slug: `bot-telemetry` · Author: qa · Status: DRAFT

## Verdict
**PASS**

## Verification Steps
1. **Automated Tests**: Simulated telemetry events via the `/botTelemetry` endpoint and confirmed frontend parsing handles them correctly.
2. **Exploratory Pass**:
   - Simulated `currently_thinking` updates and confirmed the UI auto-updates without refresh.
   - Verified the Global Telemetry Feed logs each new state correctly.
   - Tested the Pause/Resume feed toggle (DL-1) and confirmed it works.
   - Verified the "Idle Time" ticker increments every second in real-time.
   - Tested the color dots mapping to success (green) / error (red) / processing (blue) (DL-2).
3. **UX Audit**:
   - The UI matches the wireframe specifications.
   - Screen reader attributes `aria-live="polite"` added to the feed box.
   - Spacing and shadcn components are styled exactly as requested.

## Defects Found
- None blocking.

## Edge Cases Verified
- **EC-2 (Bot Offline)**: When the bot hasn't updated recently, the idle time turns to minutes/hours accurately showing it's offline.
- **EC-4 (DB Fetch Fail)**: The React component `fetchTelemetry` handles the try/catch natively and silently logs to console while retaining the previous state.
