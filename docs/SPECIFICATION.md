# v0.4の追加仕様

初回チュートリアル、並列編成、出荷と資金、管理タブ、待ち時間の短縮については [CHANGES_V04.md](CHANGES_V04.md) を参照してください。以下はv0.3までの基礎仕様です。相違がある箇所はv0.4の追加仕様を優先します。

# Factory Simulator 2 — prototype 0.3

Current Japanese change specification: [CHANGES_V03.md](CHANGES_V03.md).

Current Japanese game proposal: [proposal.html](../dist/proposal.html).

## Core

- 38×30 isometric map; player-built 3×3 facilities; one-tile clearance for ports. Start with 4 facilities, 10 workers (8 assigned). Idle workers still incur wages.
- Simulation fixed step: 0.1 seconds. Rendering reads the authoritative simulation state; 1×/2×/4× change wall-clock pacing, not recipe times.
- 120 simulation seconds = one display day; one display day runs 08:00–18:00. Deadlines use simulation seconds.
- New construction and management dialogs pause production. Facility side panels remain live. Visibility loss pauses, and return requires explicit resume.
- DOM-free engine and UMD exports allow direct Node tests and local file:// play without packages.

## State transitions

Accepted, unreleased order → release reservation and finite design capacity → paperwork from sales to design → design work → material procurement or advance stock allocation → raw material transport from supply yard to machining → assembly → inspection. Design resources are freed while procurement runs. Material funds/lead/capacity waits remain manufacturing WIP.
Completed work goes to an available next-stage input, otherwise to warehouse, otherwise blocks its producing station.
Warehouse contents automatically return to an eligible next stage. Completed inspection transfers to the finished-goods store at dispatch. Early arrivals incur 0.90 G/car/second until the deadline; shipment then realizes revenue and cost of sales. Late arrivals ship immediately.

Station input capacity is 2, including incoming transport reservations. An active or blocked job occupies the machine, not an input queue slot. Warehouse capacity is 6×level, also including incoming reservations.
Work-in-progress counts jobs with stage < 4, including work, transfer, station queue, blocked output and intermediate warehouse. Finished goods are excluded. Lowering the limit does not delete existing jobs.
Release interval is at least 4 seconds. Active accepted orders are limited to 10; offers expire, accepted orders do not vanish at deadlines.

## Logistics

Breadth-first search on orthogonal grid neighbors excludes every occupied building footprint and map water/edge cells. Route endpoints are external ports.
Travel time = max(0.5, path edge count / 2.5). Transport support sets divisor 3.5 for transfers departing during the effect; duration remains fixed in flight.
Routing compares estimated station backlog and path length among staffed, nonbroken, available facilities. This is a heuristic, not an optimal production scheduler.
Paths are cached by topology revision. Add/remove construction invalidates cache. Background street markings are illustrative; any empty passable cell may be traversed. Vehicles have no collision or fleet capacity model yet.

## Economics

New product prices = source sale/cost ×10. Work seconds = source work ×1.2 +6 per stage.
Material payment occurs at procurement after design, or when advance stock is ordered. Product-specific kits take 24–42 seconds (twice that in stockyard). Advance stock reserves its original arrival time; paid lots are allocated once and removed when leaving the yard. Unallocated advance stock is limited to 12 kits, including inbound. Yard holding costs 0.18 G/kit/sec from actual arrival until dispatch. Inventory material value = total material payments − materials recognized for shipped vehicles.
Operating profit = revenue − shipped material cost − wages − upkeep − warehouse charges − penalties − hiring/severance/maintenance costs.
Cash = initial cash + revenue + rewards − material payments − operating expenses − net capital expenditure.
Capex includes construction, upgrades and land less demolition recoveries (35% of associated investment). Scenario subsidies are never operating profit.
Late penalty = sale × min(0.25, 0.05 + secondsLate ×0.001).
No taxes, depreciation, interest, loans, labor law model or real-world financial valuation.
Cash <= 0 freezes the run as failed; a confirmation screen can start a new scenario.

## People and reliability

Wages 0.48 G/worker/second; hire 350 G; unassigned-worker departure 200 G. 0–4 workers per productive facility.
Worker capacity multipliers: 0, 0.55, 1.00, 1.33, 1.66. Equipment levels multiply by 1.0, 1.3, 1.6; condition below 30 multiplies by 0.8.
Condition falls only while working: 0.075 points/sec, reduced to 0.035 with any staffed maintenance shop. Multiple shops and staff do not stack.
At zero condition production stops. Repair 800 G/16 seconds; preventive maintenance 300 G/8 seconds. Both retain interrupted work. Preventive actions never count as failure repairs.
Random improvement event ×1.2 capacity for 35 seconds; multiple active effects do not stack.

## Content

Coast campaign has 4 chapters, manual reward claim, and a guaranteed machining failure on entering chapter 3.
Surge: 20 shipments + 18,000 G profit. Rescue: 2 repairs + 12 shipments + 8,000 G profit. Stockyard: 4 advance stock uses, 8 on-time shipments, 6,000 G profit; lead times doubled. Studio: 2 design buildings, 10 on-time shipments, 8,000 G profit. Just-in-time: 6 on-time shipments, 9,000 G profit, 12,000 G initial cash. Sandbox: no goals, 60,000 G starting cash.
Scenario seeds persist. Offers, degradation events, bonus offers, work and transport support are reproducible under the same action schedule.
Keep generating offers after scenario clearance. Rewards cannot be reclaimed.

## Saves and limits

Explicitly device-local save key `railworks-yard-save-v1`, preferences `railworks-yard-prefs-v1`; no old-game save migration. Autosave every 15 simulation seconds and on actions/visibility loss, plus manual save. Saving exceptions never crash play.
Schema 3; migrates schemas 1 and 2 without changing historical cash or material value. Legacy in-flight jobs have paid materials and skip a second purchase after design. New jobs follow the procurement rules. Serialization excludes route cache; restore reconstructs cache on demand.
Bounds: 36 facilities, 60 workers, WIP selectable up to 12. Map dimensions are fixed in prototype.
Offer list capped, news 30 items, chart history 240 samples. Completed order history is retained in save.

## Deferred

Road laying, finite transport fleets, collision/congestion, multiple suppliers and supply disruptions, electricity, worker skills/fatigue/shifts, overtime, outsourcing, setup changes, cloud sync and signed native app distribution.

## Verification

`node --test tests/*.test.js`
`npm run check` (equivalent Node syntax checks and scripts/check-static.js; no installation required).

34 behavior tests pass. All six scenarios clear under the documented heuristic; see CHANGES_V03.md for exact results. This proves existence of a successful strategy, not first-time difficulty or mobile frame rate.
Browser, native touch/audio, visual QA and real-device performance are not verified in this task.

## New operating details

Floor queue / blocked-output storage: 0.60 G/car/sec; intermediate warehouse: 0.25; finished goods: 0.90. All are part of operating expenses, with a separate subledger. Manual intermediate storage holds until resumeJob. Accepted orders may have releaseAt and per-stage routes; factory routeDefaults apply otherwise. Explicit routes wait for that facility, and already-dispatched transfers remain committed.

planner.js clones the live engine state and advances the same fixed step, without future offers or random events, up to 3600 seconds. It accounts for finite resource and waiting capacity, transport, deterioration, already-started repairs, wages, inventory costs, release gates, advance stock, material lead times and cash. Chart width uses two pixels per simulation second so release shifts remain visible as the horizon expands. It does not perform optimization or assume future player repairs.
