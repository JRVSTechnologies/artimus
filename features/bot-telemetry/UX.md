# UX: Bot Telemetry & Monitoring Dashboard
Slug: `bot-telemetry` · Author: ux · Status: DRAFT

## User flow
1. User navigates to `/bot_health` (Bot Health Status page).
2. User views the overall dashboard with summary cards for "Artimus Bot" and "MCN Markets Bot".
3. User observes the new "Currently Thinking" live feed embedded in the bot's detail card.
4. User observes the new "Last Execution" and "Idle Time" stats in the metrics grid.

## Screens
### Bot Health Status Dashboard
- Purpose: Monitor bot efficiency and effectiveness in real-time.
- Layout (375px): Single column stacked layout. Bot detail cards flow vertically. Inside the card, metrics grid is 1 column. "Currently Thinking" feed is at the bottom of the card.
- Layout (≥1024px): 2-column layout (Bot 1 on left, Bot 2 on right). Inside each card, metrics grid is 2x2. "Currently Thinking" feed takes full width at the bottom of the card.
- Components (shadcn): `<Card>`, `<Badge>`, `<ScrollArea>` (for feed), `<Skeleton>` (loading).
- States:
  - loading: Skeleton components for metrics and feed.
  - empty/offline: Feed shows "No active telemetry. Bot may be offline." Badge is gray.
  - error: Feed shows "Error connecting to telemetry stream" with a retry button.
  - partial: Some metrics load but feed fails -> show metrics, error state in feed box.
  - success: Live scrolling feed, metrics updated.
- Copy: 
  - Section headers: "Live Telemetry", "Last Execution", "Idle Time".
  - Empty state: "Awaiting next task..."
  - Error state: "Connection lost. Reconnecting..."
- Accessibility: 
  - Focus order: Bot Card 1 -> Metrics -> Feed -> Bot Card 2.
  - aria-live="polite" on the "Currently Thinking" scroll area so screen readers announce new milestones.
  - Keyboard path allows pausing the live feed if the delight list item DL-1 is accepted.

## Interaction details
- "Currently Thinking" feed auto-scrolls to the bottom as new events arrive.
- New events flash with a subtle background highlight for 1 second before fading.
- "Idle Time" metric counts up in real-time (e.g., "1m 12s", "1m 13s").

## Tradeoffs
Chose to embed the feed directly inside the Bot Card rather than a separate modal to allow side-by-side monitoring of multiple bots, though this reduces the space available for the feed.

## Suggested for later (out of scope)
| Idea | Cost |
|---|---|
| Search/filter within the Currently Thinking feed | M |
| Historical graph of idle time over the last week | L |
