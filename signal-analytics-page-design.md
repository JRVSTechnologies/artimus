# VIP Signal Analytics Page — Design Spec

Deliverable: a single analytics dashboard page that answers three questions about the VIP signal database:
1. **Is this signal source worth following?** (expectancy, not just win rate)
2. **Under which conditions do the signals perform?** (session, direction, SL width, time of day)
3. **What happens if the signals are filtered through CFX session rules?** (raw vs kill-zone-filtered comparison)

---

## 1. Data Source

Notion database with the following schema (as-is):

| Field | Type | Notes |
|---|---|---|
| Signal | Title | e.g. "August 31 NY Open" |
| Date | Datetime | Signal timestamp (WIB, GMT+7) |
| Status | Select | `TP Hit` / `SL Hit` / `Breakeven` / `Open` |
| Direction | Select | `Buy` / `Sell` |
| Session | Select | `NY Open`, `London-NY Overlap`, etc. |
| S/L | Number | Stop loss price |
| Entry Low / Entry High | Number | Entry zone bounds |
| Source | Select | `VIP group` (multi-source future-proof) |
| Raw Signal Text | Text | Original message |
| Symbol | Select | `XAUUSD` |
| TP1–TP5 | Number | Take-profit ladder (sparse — not all signals list 5) |

### Recommended schema additions (before build, 5 minutes in Notion)

The current `Status = TP Hit` is lossy — it doesn't say *which* TP was reached, which makes realized R uncomputable. Add:

- **`TP Level Hit`** (Number 1–5, or Select) — deepest TP reached before reversal/SL.
- **`Exit Price`** (Number, optional) — overrides modeled exits when known.
- **`Notes`** (Text, optional) — manual annotations.

If Jossie declines the schema change, the page must fall back to the exit models in §3 with an explicit "modeled, not actual" badge on every P&L figure.

---

## 2. Derived Metrics Layer (compute server-side, not in components)

All price math in points (XAUUSD: 1 point = $1 move). Per signal:

```
entry_mid   = (entry_low + entry_high) / 2
risk_pts    = abs(entry_mid - sl)                    // guard: risk_pts > 0
tp_r[n]     = abs(tp[n] - entry_mid) / risk_pts      // R-multiple of each listed TP
zone_width  = abs(entry_high - entry_low)
sl_dist_pct = risk_pts / entry_mid * 100
hour, dow   = from Date (Asia/Jakarta timezone — hardcode the TZ, do not use browser local)
```

Outcome → realized R (per exit model, §3):
```
SL Hit     → −1R
Breakeven  →  0R
TP Hit     → +R per exit model
Open       → excluded from all closed-trade stats (shown separately)
```

Aggregates (recomputed on every filter change):
- Win rate, BE rate, loss rate (closed signals only)
- **Expectancy** = mean realized R — the headline number
- Profit factor = gross positive R / |gross negative R|
- Avg win R, avg loss R, payoff ratio
- Max win/loss streak; max drawdown of the cumulative-R curve
- Signal frequency (per week)
- Median SL distance, median zone width, median TP1 R

---

## 3. Exit Models (critical design decision)

Because "TP Hit" doesn't identify the level (until schema is amended), expose a **global exit-model toggle** that re-renders the whole page:

1. **Conservative — TP1 full close.** TP Hit = +tp_r[1]. The floor case.
2. **Ladder** *(default — mirrors Jossie's real execution template)*: partial closes across the listed TPs. Suggested weights: 50% @ TP1, 25% @ TP2, remainder @ deepest listed TP; if `TP Level Hit` exists, cap the ladder at that level with remainder stopped at entry (0R).
3. **Optimistic — deepest TP full close.** Ceiling case.

Render the equity curve with all three as layered lines (conservative solid, ladder emphasized, optimistic dashed) so the truth band is visible at a glance. Every KPI card shows the ladder value with a small `TP1: x.xx / Max: x.xx` range underneath.

---

## 4. Page Layout

Single page, dark theme (Notion-dark / trading-terminal aesthetic: near-black background `#191919`–`#0f1115`, muted grid lines, green/red only for directional meaning). Desktop-first, responsive collapse to single column.

### Row 1 — KPI strip (6 cards)
Total signals (closed / open) · Win rate (with BE rate sub-line) · **Expectancy (R)** · Profit factor · Max drawdown (R) · Current streak. Expectancy card is visually dominant. Color the expectancy card green/red/neutral by sign.

### Row 2 — Equity curve (full width)
Cumulative R over time, 3 exit-model lines per §3. X = signal sequence (toggle to calendar time). Shade drawdown regions. Hover tooltip: signal name, date, session, outcome, running R.

### Row 3 — Outcome & condition breakdowns (3 columns)
- **Outcome distribution** — horizontal stacked bar or donut: TP Hit / BE / SL Hit / Open, with counts.
- **By Session** — grouped bar: signal count + expectancy per session. This is the core-edge question: does the provider's edge concentrate in London-NY Overlap the way CFX assumes?
- **By Direction** — Buy vs Sell: count, win rate, expectancy. XAUUSD signal groups often skew heavily one-sided; surface the skew.

### Row 4 — Timing heatmap (full width)
Day-of-week × hour-of-day (WIB) grid, cell color = expectancy, cell label = count. Overlay CFX kill-zone bands (London Pre, London-NY Overlap, NY Open, NY PM) as outlined column regions so it's immediately visible whether good signals cluster inside or outside the zones. Fetch current kill-zone hours from the Trading Rules page at design time rather than hardcoding from memory.

### Row 5 — Risk anatomy (2 columns)
- **SL distance vs outcome** — scatter/strip plot: x = risk_pts, points colored by outcome. Answers "are the losers the wide-stop signals?" Add median lines per outcome group.
- **R-multiple distribution** — histogram of realized R (ladder model), with expectancy marker line.

### Row 6 — CFX filter comparison (full width, 2-column stat table)
Side-by-side: **All signals** vs **Kill-zone-only signals** (Session ∈ CFX kill zones, NY PM excluded as manage-only). Rows: count, win rate, expectancy, profit factor, max DD. This quantifies whether applying CFX session discipline to the provider's feed improves or degrades the edge — same core/non-core segmentation used in journal reviews.

### Row 7 — Rolling performance (full width)
20-signal rolling win rate + rolling expectancy dual line. Detects provider decay — the most common failure mode of signal groups is a hot start followed by degradation.

### Row 8 — Signals table (full width, virtualized)
All fields + derived columns (risk_pts, TP1 R, realized R, zone width). Sortable, row expand shows Raw Signal Text. Status/direction as colored pills matching Notion's palette (green TP, red SL, gray BE).

### Global filter bar (sticky top)
Date range · Session (multi) · Direction · Status · Source · Symbol · Exit model toggle. All charts and KPIs react to the same filter state (single store, e.g. Zustand or plain React context).

---

## 5. Architecture

- **Framework**: Next.js (App Router) on Vercel, under JRVSTechnologies — consistent with the CFX webapp.
- **Data ingestion**: server-side Notion API pull of the signals database. Paginate (Notion caps at 100/page). Two modes:
  - ISR revalidation every 15–60 min, plus a manual "Refresh" button hitting a revalidate route.
  - Notion integration token as a Vercel env var — never client-side.
- **Metrics layer**: pure TypeScript module `lib/metrics.ts` — takes raw signal rows + exit model + filters, returns the full stats object. Keep it framework-free so it can later be reused by JARVIS MCN (e.g. a `/signals stats` Telegram command) and covered by unit tests.
- **Charts**: Recharts (line, bar, scatter, histogram via bar). Heatmap as a CSS-grid custom component — simpler and sharper than forcing it through a chart lib.
- **Types**: single `Signal` and `ComputedSignal` type; Zod schema on the Notion response so a schema drift in Notion fails loudly, not silently (same contract-pinning principle as the Weekly Desk Pydantic artifacts).

### Data flow
```
Notion DB → /api/signals (server, paginated pull, Zod validate)
         → lib/metrics.ts (derive + aggregate, per filter/exit-model state)
         → dashboard components (presentational only)
```

---

## 6. Edge Cases (Antigravity must handle)

- Signals with missing TP2–TP5 → ladder model uses only listed TPs, reweighted.
- `Open` status → excluded from every closed-trade stat; shown as a count chip and grayed rows.
- risk_pts = 0 or SL on the wrong side of entry (data entry error) → flag row with a warning badge, exclude from aggregates, list in a "data issues" collapsible.
- Fewer than ~20 closed signals → show KPIs but banner: "Sample too small for statistical confidence (n < 20)". Never present a 5-signal win rate as an edge.
- Timezone: parse Notion dates, render and bucket everything in `Asia/Jakarta` explicitly.

---

## 7. Build Phases

1. **Phase 1**: Notion pull + metrics layer + KPI strip + equity curve + signals table. (Usable immediately.)
2. **Phase 2**: Session/direction breakdowns, heatmap with kill-zone overlay, filter bar.
3. **Phase 3**: Exit-model toggle refinement with `TP Level Hit` field, CFX filter comparison, rolling performance.
4. **Phase 4** (optional): multi-source comparison view when a second signal provider is added; JARVIS MCN `/signals` command reusing `lib/metrics.ts`.
