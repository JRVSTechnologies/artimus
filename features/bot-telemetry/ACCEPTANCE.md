# Acceptance: Bot Telemetry & Monitoring Dashboard
Slug: `bot-telemetry` · Author: qa · Status: DRAFT

## Acceptance criteria
| ID | Given | When | Then | PRD ref |
|---|---|---|---|---|
| AC-1 | The product owner is on the Bot Health Status page | The "Currently Thinking" feed updates | It displays structured state milestones emitted by the bots in real-time | Scope — in |
| AC-2 | The product owner views a specific bot's detail card | The page loads | The "Last Execution" metric displays the task description, timestamp, and status | Scope — in |
| AC-3 | The product owner views a specific bot's detail card | The page loads | The "Idle Time" tracker shows the time elapsed since the bot's last active task | Scope — in |
| AC-4 | The bot is actively processing signals | The telemetry is gathered | The core signal processing is not blocked or slowed down | Constraints |

## Scope-out assertions
| ID | Must NOT be present |
|---|---|
| SO-1 | Automated remediation or bot restart buttons |
| SO-2 | Configuration editing forms on this dashboard |
| SO-3 | Historical analytics data beyond the last 24 hours |

## Edge cases
| ID | Scenario | Expected behaviour |
|---|---|---|
| EC-1 | Real-time websocket/SSE connection drops | Reconnect gracefully; show a "Reconnecting..." indicator |
| EC-2 | Bot is offline and not emitting telemetry | "Idle Time" shows a warning state; "Currently Thinking" shows "Offline" |
| EC-3 | Network is extremely slow | Display skeleton loaders for Last Execution; handle missed real-time events gracefully |
| EC-4 | Database fails to fetch Last Execution row | Show a localized error message in the Last Execution section, keep rest of dashboard alive |

## Delight list (for product owner: accept / cut)
| ID | Suggestion | Why a user would notice | Cost | Decision |
|---|---|---|---|---|
| DL-1 | Pause/Resume live feed button | The "Currently Thinking" feed might scroll too fast to read | S | |
| DL-2 | Color-coded status dots for task outcomes | Quickly scan for errors (red) vs successes (green) in the feed | S | |
| DL-3 | Copy log to clipboard button | Makes it easy to share an error log with the team | S | |
| DL-4 | Audio ping on critical error | Immediate attention required when a bot fails | M | |
