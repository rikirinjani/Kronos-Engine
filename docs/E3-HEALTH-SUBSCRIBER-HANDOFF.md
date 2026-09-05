# E3 HANDOFF — health.* Micro→Macro Subscriber (KE-side)

**From:** Phase E orchestrator (DR-side verification complete)
**To:** KE sector engineer
**Status:** IMPLEMENTATION REQUIRED IN KE — do NOT modify DR for this
**Date:** 2026-09-05

---

## 1. Problem

The Deers Rock adapter publishes five `health.*` events on the KE event bus
(`src/sectors/deers-rock-adapter.ts`, `tick()`):

| Event                 | Trigger (adapter, deterministic)                     | Payload |
|-----------------------|------------------------------------------------------|---------|
| `health.pressure`     | `sentinelOutput.occupancyRate > 0.85`                | `{hospitalId, city, occupancyRate}` |
| `health.mortality`    | `sentinelOutput.mortalityPressure > 0`               | `{hospitalId, city, deaths}` |
| `health.supply-crisis`| `sentinelOutput.supplyStress > 0.7`                  | `{hospitalId, city, supplyStress}` |
| `health.surge`        | `sentinelOutput.admissionSurge` (occupancy > 0.9)    | `{hospitalId, city, occupancyRate}` |
| `health.down`         | DR step threw (circuit breaker)                      | `{hospitalId, city, error, tick}` |

KE currently has **zero subscribers** — `applyCrossSectorEvents()`
(`src/engine/world-engine.ts`) iterates `sector.handlers` for matching
`eventType`, and no KE sector declares a handler for any `health.*` type.
The events are silently dropped.

## 2. Architectural boundary determination

The events are published INTO the KE event bus by the adapter; DR itself
never sees KE. Therefore any subscriber MUST be a KE sector (or a handler on
an existing KE sector). **This work belongs entirely in KE. Do not modify the
DR repository or the adapter's publishing logic.**

## 3. Required semantic (defensible consumer)

The earlier E3 assessment (commit `ce8b507`) established that mapping
hospital-local signals onto national/global KE state (geopolitics, economy,
climate) is scientifically indefensible: it violates the adapter's
`LOCAL_SIGNAL_ONLY` invariant ("Sentinel output is local observation. Never
extrapolated to national or regional level") and would invent unsupported
domain behavior.

The minimal DEFENSIBLE consumer is a **passive per-hospital health
surveillance recorder** — the KE-side analogue of real-world epidemiological
situational reporting (hospitals report occupancy/mortality/supply status to
a national surveillance system; the system RECORDS; it does not extrapolate
without validated mappings):

- New sector `src/sectors/health-surveillance.ts`:
  - `id: "health-surveillance"`, `name: "Health Surveillance"`, `cadence: 1`
  - `handlers`: one `TickHandler` per event type (`health.pressure`,
    `health.mortality`, `health.supply-crisis`, `health.surge`,
    `health.down`), each appending to state
  - `events: ["health.pressure", "health.mortality", "health.supply-crisis", "health.surge", "health.down"]`
  - State shape:
    ```ts
    interface HealthSurveillanceState extends SectorState {
      _sectorId: "health-surveillance";
      /** latest signal per hospital (keyed — NEVER aggregated to national level) */
      latest: Record<string, { tick: number; hospitalId: string; city: string;
                               occupancyRate?: number; deaths?: number;
                               supplyStress?: number; down?: boolean }>;
      /** per-event-type counters */
      eventCounts: Record<string, number>;
    }
    ```
- **Constraints (all hard requirements):**
  - No `rng` use anywhere in the sector (deterministic).
  - No wall-clock reads (use `event.tick`).
  - Records keyed by `hospitalId` — sentinel isolation preserved (hospital A's
    records never merge into hospital B's).
  - NO national/regional aggregation fields — this is the `LOCAL_SIGNAL_ONLY`
    boundary. Aggregation requires a separate validated mapping proposal.
  - No feedback into any other sector (no events published by this sector in
    v1).
  - Handler must be pure state-transition: `(event, state) => newState`.

## 4. Required causal integration test

`src/sectors/health-surveillance.test.ts`:

1. **Real event path (not a stub publisher):** build a KE world containing
   `createGeopoliticsSector()`, `createClimateSector()`, `createEconomySector()`,
   `createTechnologySector()`, one `deersRockAdapter` sentinel, and the new
   `health-surveillance` sector. Seed 42, `ticksPerDay: 10`.
2. Run **60 ticks** — at this horizon the sentinel's occupancy crosses the
   adapter's publish thresholds deterministically (verified: occupancy 0.97
   at tick 60 for seed 42, see `experiment-results/e4-horizon/`).
3. Assert:
   - `surveillance.eventCounts["health.pressure"] > 0` (event actually fired
     from the real adapter → subscriber → state change),
   - `surveillance.latest[sentinelHospitalId].occupancyRate > 0.85`,
   - surveillance state hash at tick 60 ≠ hash at init (real KE state update),
   - **determinism:** a second `createWorld` with the same seed and sectors
     produces an identical surveillance state hash,
   - **isolation:** with two sentinels (different `config.id`), each hospital
     gets its own `latest` entry; perturbing one sentinel's inputs leaves the
     other's records byte-identical (pattern: `e5-isolation.ts`),
   - full existing suite stays green (320/320 baseline).

## 5. Registration

Add the sector to experiment world constructions that should exercise the
micro→macro link (at minimum a test world; P-004 registration is a separate
decision — it changes the metric set and would require a fresh P-004 run
record).

## 6. Out of scope (explicitly)

- Any consumer that modulates geopolitics/economy/climate state from
  health signals — blocked pending a validated mapping (the `ce8b507`
  finding stands for feedback coupling).
- Any change to DR, the adapter's publishing thresholds, or the event
  payload shapes.
- National aggregation — requires its own scientific justification.
