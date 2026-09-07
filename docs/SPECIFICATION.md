# Factory Simulator 2 — prototype 0.1

Full Japanese proposal: [proposal.html](../dist/proposal.html).

## Core

- 38×30 isometric map; player-built 3×3 facilities; one-tile clearance for ports. Start with 4 facilities, 10 workers (8 assigned). Idle workers still incur wages.
- Simulation fixed step: 0.1 seconds. Rendering reads the authoritative simulation state; 1×/2×/4× change wall-clock pacing, not recipe times.
- 120 simulation seconds = one display day; one display day runs 08:00–18:00. Deadlines use simulation seconds.
- New construction and management dialogs pause production. Facility side panels remain live. Visibility loss pauses, and return requires explicit resume.
- DOM-free engine and UMD exports allow direct Node tests and local file:// play without packages.

## State transitions

Accepted, unreleased order → material payment → transfer to design → station queue → work → next stage.
Completed work goes to an available next-stage input, otherwise to warehouse, otherwise blocks its producing station.
Warehouse contents automatically return to an eligible next stage. Completed inspection transfers to dispatch; arrival realizes revenue and cost of sales.

Station input capacity is 2, including incoming transport reservations. An active or blocked job occupies the machine, not an input queue slot. Warehouse capacity is 6×level, also including incoming reservations.
Work-in-progress limit counts every unfinished job, including work, transfer, station queue, blocked output and warehouse. Lowering the limit does not delete existing jobs.
Release interval is at least 4 seconds. Active accepted orders are limited to 10; offers expire, accepted orders do not vanish at deadlines.

## Logistics

Breadth-first search on orthogonal grid neighbors excludes every occupied building footprint and map water/edge cells. Route endpoints are external ports.
Travel time = max(0.5, path edge count / 2.5). Transport support sets divisor 3.5 for transfers departing during the effect; duration remains fixed in flight.
Routing compares estimated station backlog and path length among staffed, nonbroken, available facilities. This is a heuristic, not an optimal production scheduler.
Paths are cached by topology revision. Add/remove construction invalidates cache. Background street markings are illustrative; any empty passable cell may be traversed. Vehicles have no collision or fleet capacity model yet.

## Economics

New product prices = source sale/cost ×10. Work seconds = source work ×1.2 +6 per stage.
Material payment occurs at release. Inventory material value = total material payments − materials recognized for shipped vehicles.
Operating profit = revenue − shipped material cost − wages − upkeep − warehouse charges − penalties − hiring/severance/maintenance costs.
Cash = initial cash + revenue + rewards − material payments − operating expenses − net capital expenditure.
Capex includes construction, upgrades and land less demolition recoveries (35% of associated investment). Scenario subsidies are never operating profit.
Late penalty = sale × min(0.25, 0.05 + secondsLate ×0.001).
No taxes, depreciation, interest, loans, labor law model or real-world financial valuation.
Cash < −3000 freezes the run as failed; a confirmation screen can start a new scenario.

## People and reliability

Wages 0.48 G/worker/second; hire 350 G; unassigned-worker departure 200 G. 0–4 workers per productive facility.
Worker capacity multipliers: 0, 0.55, 1.00, 1.33, 1.66. Equipment levels multiply by 1.0, 1.3, 1.6; condition below 30 multiplies by 0.8.
Condition falls only while working: 0.075 points/sec, reduced to 0.035 with any staffed maintenance shop. Multiple shops and staff do not stack.
At zero condition production stops. Repair 800 G/16 seconds; preventive maintenance 300 G/8 seconds. Both retain interrupted work. Preventive actions never count as failure repairs.
Random improvement event ×1.2 capacity for 35 seconds; multiple active effects do not stack.

## Content

Coast campaign has 4 chapters, manual reward claim, and a guaranteed machining failure on entering chapter 3.
Surge: 20 shipments + 18,000 G profit. Rescue: 2 repairs + 12 shipments + 8,000 G profit. Sandbox: no goals, 60,000 G starting cash.
Scenario seeds persist. Offers, degradation events, bonus offers, work and transport support are reproducible under the same action schedule.
Keep generating offers after scenario clearance. Rewards cannot be reclaimed.

## Saves and limits

Explicitly device-local save key `railworks-yard-save-v1`, preferences `railworks-yard-prefs-v1`; no old-game save migration. Autosave every 15 simulation seconds and on actions/visibility loss, plus manual save. Saving exceptions never crash play.
Schema 1. Serialization excludes route cache; restore reconstructs cache on demand.
Bounds: 36 facilities, 60 workers, WIP selectable up to 12. Map dimensions are fixed in prototype.
Offer list capped, news 30 items, chart history 240 samples. Completed order history is retained in save.

## Deferred

Road laying, finite transport fleets, collision/congestion, schedules for deliveries and finished goods storage, procurement and supplier delays, electricity, worker skills/fatigue/shifts, overtime, outsourcing, setup changes, cloud sync and signed native app distribution.

## Verification

`node --test tests/*.test.js`
`npm run check` (equivalent Node syntax checks and scripts/check-static.js; no installation required).

15 behavior tests pass. Three scenarios clear under the documented heuristic: coast 478s/22 shipments, surge 358s/20, rescue 391s/12. This proves existence of a successful strategy, not first-time difficulty or mobile frame rate.
Browser, native touch/audio, visual QA and real-device performance are not verified in this task.
