# Sentinel Integration Map

> Depth ledger tracking all external systems wired into Kronos Engine.
> Inspired by Cosmogonic's Tsotchke depth ledger (22 registry entries, 9 deep / 7 wired / 2 harvest / 3 fenced / 1 meta).

**Last updated:** 2026-08-31

---

## Depth Classification

| Class | Meaning | Sim Impact |
|-------|---------|------------|
| `deep` | Bidirectional wiring — **design intent, not current state** (see "Bidirectional Claims vs Current State" below): macro → micro → macro feedback loop. System receives `MacroConditionPacket`, simulator advances, and sentinel output is **published** to the event bus; inbound consumption of `health.*` events is **UNIMPLEMENTED** as of 2026-08-31. | Full (intended) |
| `wired` | Macro-in only: system receives macro conditions but does not feed back to world. | Unidirectional |
| `harvest` | Data consumed for analysis but no sim impact. World engine observes but does not control. | None |
| `fenced` | Referenced or studied but not wired into the deterministic sim. No runtime integration. | None |

---

## Bidirectional Claims vs Current State

> **Audit context (2026-08-31):** the sentinel adapter (`src/sectors/deers-rock-adapter.ts`) publishes `health.*` events into the event bus, but **no sector registers a handler for any `health.*` event** — the events are dropped. The `deep` classification below is design intent; see the status table for what is actually wired today.

**Current state: world → hospital only.**

| Direction | Path | Status |
|---|---|---|
| World → hospital | Macro events → `MacroConditionPacket` → 1,440 DR ticks/day → aggregated `HospitalSentinelOutput` | ✅ **Implemented and verified** |
| Hospital → world (sentinel feedback) | Adapter publishes `health.pressure`, `health.mortality`, `health.surge`, `health.down`, `health.supply-crisis` onto the event bus | ❌ **UNIMPLEMENTED** — no sector subscribes to any `health.*` event; the published events are dropped |

**What this means:**

- The adapter's `handlers` list is empty (`const handlers: TickHandler[] = []`); it publishes sentinel output but never receives. No other sector registers a `health.*` handler, so nothing consumes the sentinel's pressure signals.
- The architectural hypothesis — *"The world does not reach into the hospital. It knocks on the adapter's door and waits for the signal."* — **holds for the outbound direction** (world → adapter → hospital). It is **UNIMPLEMENTED inbound**: the signal is published, but nothing answers the door.
- **Ledger consequence:** Deers Rock's `deep` classification in the registry is design intent (target: macro → micro → macro feedback loop). In the current build its effective wiring is `wired` (macro-in only; sentinel output published but unconsumed), so the "Wired fraction = 1.000" row reflects a one-way system, not a true bidirectional loop. Implementing a sector that subscribes to `health.*` is required before the `deep` label is factually accurate.

**Verified in code (2026-08-31):** `deers-rock-adapter.ts` publishes `health.pressure`, `health.mortality`, `health.surge`, `health.down`, `health.supply-crisis` and declares an empty `handlers` list; the event bus (`src/sectors/event-bus.ts`) delivers published events only to registered subscribers; `src/integration/heatwave.test.ts` exercises only the world → hospital leg (climate events → DR sentinel output).

---

## Registry

| # | System | Type | Class | Wiring Since | Files | Notes |
|---|--------|------|-------|-------------|-------|-------|
| 1 | Deers Rock HOE | Hospital simulator | `deep` | P-002 (2026-06-29) | `src/sectors/deers-rock-adapter.ts`, `deers-rock-adapter.test.ts`, `src/sectors/types.ts` | Full sentinel adapter. Zero DR code modifications. Multi-instance, circuit breaker, 1440:1 temporal aggregation, string-ID seed derivation. 30-hospital network configured in `src/data/indonesian-hospitals.ts`. ⚠️ `deep` is design intent — inbound `health.*` consumption UNIMPLEMENTED (2026-08-31); see "Bidirectional Claims vs Current State". |
| 2 | Deers Rock HOE (Makassar) | Hospital simulator | `deep` | P-004 (2026-06-30) | Same adapter as #1 | Counterfactual experiment confirmed pipeline: climate intervention → occupancy shift (d=0.70) → CSSD cycles (d=-2.71). Same inbound `health.*` caveat as #1 — world→hospital only (2026-08-31). |

---

## Planned / In Progress

| # | System | Type | Target Class | Priority | Notes |
|---|--------|------|-------------|----------|-------|
| — | Second hospital simulator | Hospital simulator | `deep` | Future | Wrapping a different simulator type would close the "all sentinels run Deers Rock" limitation from §4.4. Requires adapter variant or second adapter module. |
| — | NHI coverage database | Healthcare policy | `harvest` | Future | Import real NHI coverage rules as validation targets for counterfactual policy experiments. |
| — | WHO/CDC climate-health data | Epidemiology | `harvest` | Future | Calibration targets for Climate → Health coupling. |

---

## Scientific Wired Fraction

| Metric | Value |
|--------|-------|
| Total adapters | 1 |
| `deep` | 1 |
| `wired` | 0 |
| `harvest` | 0 |
| `fenced` | 0 |
| **Wired fraction** | **1/1 = 1.000** |

---

## Wiring Integrity Rules

1. **Deep adapters must never bypass the simulator's public `step()` interface** (verified by test)
2. **Deep adapters must never leak patient-level data** (verified by code review)
3. **Fenced systems must never appear in the deterministic sim's import graph** (enforced by TypeScript module resolution)
4. **When adding a new adapter, update this map before merging**
