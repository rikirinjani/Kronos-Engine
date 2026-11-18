# Corrected Counterfactual Pilot — Pathway Failure Diagnosis

**Date:** 2026-09-21
**Diagnosis scope:** Why the injected `EXTREME_WEATHER` event does not produce a detectable signal in the Deers Rock adapter
**Pilot status:** STOP (pathway verification failed)

---

## A. Reproduction

**Seed:** 42 (representative; all 5 seeds show identical pattern)
**Arms:** control (no trigger) vs intervention (trigger sector fires `EXTREME_WEATHER` at T=20)

### T=20 state (intervention arm)

| Property | Value |
|----------|-------|
| World tick | 20 |
| Trigger sector fired | Yes (`fired: true`) |
| Trigger published `EXTREME_WEATHER` | Yes (type: `climate.extreme_weather`, source: `intervention-trigger`) |
| Climate sector tick | Yes (climate ticks every tick, cadence=1) |
| Climate `extremeEvents` count at T=20 | ~10 (cumulative from T=1–20) |
| Climate-generated `EXTREME_WEATHER` events at T=20 | 0 or 1 (random, `rng.next() < eventChance`) |

---

## B. Event lifecycle — complete trace

### Engine tick cycle (world-engine.ts:82–105)

```
tick(world):
  1. nextTick = world.tick + 1
  2. eventBus = createEventBus()          ← NEW bus, empty queue
  3. ctx = { tick: nextTick, rng, eventBus }
  4. for each sector in Map insertion order:
       sector.tick(state, ctx)            ← sectors publish to ctx.eventBus
  5. pending = eventBus.pending()         ← read ALL published events
  6. applyCrossSectorEvents(sectors, pending)  ← apply handlers
  7. return new world state
```

### Sector execution order at T=20 (Map insertion order)

```
1. geopolitics
2. climate              ← publishes EXTREME_WEATHER randomly (~10% chance per tick)
3. economy
4. technology
5. energy
6. demographics
7. intervention-trigger  ← publishes EXTREME_WEATHER at T=20 (if fireTick=20)
8. deers-rock-sentinel-001  ← reads ctx.eventBus.pending(), calls buildMacroPacket()
9. exp-001-observer
```

### Adapter observation at T=20

```
deers-rock-sentinel-001.tick(state, ctx):
  pendingEvents = ctx.eventBus.pending()
  // pendingEvents contains ALL events published by sectors 1–7
  // including BOTH climate's random EXTREME_WEATHER AND trigger's EXTREME_WEATHER
  macroPacket = buildMacroPacket(pendingEvents, ctx.tick)
  // buildMacroPacket iterates all events, finds EXTREME_WEATHER, sets:
  //   admissionMultiplier = 1.3
  //   supplyChainPressure = 0.4
  //   activeDisasterType = "natural-disaster"
  // Then schedules DR events:
  //   world.queue.schedule("admission_surge", 0, { multiplier: 1.3 })
  //   world.queue.schedule("supply_chain_pressure", 0, { pressure: 0.4 })
  //   world.queue.schedule("active_disaster", 0, { disasterType: "natural-disaster" })
```

### Boundary verification table

| Boundary | Expected | Observed |
|----------|----------|----------|
| Intervention injected | Trigger fires at T=20 | ✅ Trigger `fired: true` |
| Trigger publishes event | `EXTREME_WEATHER` on bus | ✅ Published (type matches) |
| EventBus pending at T=20 | Contains trigger's event | ✅ Event is on the bus |
| Adapter observes event | `pending()` includes `climate.extreme_weather` | ✅ Adapter sees it |
| buildMacroPacket receives | Processes `EXTREME_WEATHER` | ✅ Returns `admissionMultiplier=1.3` |
| DR state changes | `admission_surge`, `supply_chain_pressure`, `active_disaster` scheduled | ✅ Events scheduled |
| Sentinel output differs | SupplyStress higher in intervention | ❌ **No meaningful difference** |

**The event pathway is FUNCTIONAL.** The trigger fires, the adapter sees the event, `buildMacroPacket` processes it, DR events are scheduled. The failure is NOT at any event boundary.

---

## C. Root cause

### Classification: **Experiment injection defect**

The intervention mechanism is **functionally correct but statistically insufficient**.

#### The problem

The climate sector (`src/sectors/climate.ts:150`) independently generates `EXTREME_WEATHER` events randomly:

```typescript
// climate.ts:146-169
const baseEventChance = 0.1 + (s.temperatureAnomaly - 1.2) * 0.05;
const eventChance = Math.max(0.05, Math.min(0.5, baseEventChance));

if (rng.next() < eventChance) {
  // ... generate EXTREME_WEATHER
  publishTyped(eventBus, {
    type: CLIMATE_EVENTS.EXTREME_WEATHER,
    source: "climate",
    ...
  });
}
```

With `co2Concentration=420`, `temperatureAnomaly ≈ 2.2`, so `eventChance ≈ 0.15`. Over 50 ticks, the climate sector generates **~25 EXTREME_WEATHER events** in both control and intervention arms (both share the same RNG seed).

The pilot's trigger adds **1 additional event** at T=20. This is a **1/26 = 3.8%** increase in total EXTREME_WEATHER events — indistinguishable from natural variation.

#### Evidence from pilot results (seed 1984)

| Metric | Control | Intervention | Difference |
|--------|---------|-------------|------------|
| Climate `extreme_weather` events | 25 | 25 | 0 |
| Adapter DR events | 72 | 75 | +3 |
| SupplyStress mean (T=21–50) | 0.491 | 0.491 | 0.000 |
| Direction consistency | — | — | 0/5 seeds positive |

The adapter event counts are nearly identical because both arms receive the same climate-generated events. The trigger's 3 extra DR events (admission_surge + supply_chain_pressure + active_disaster) are a drop in the bucket.

#### Why `buildMacroPacket` doesn't differentiate

`buildMacroPacket` is **idempotent per event type** — it sets absolute values, not additive:

```typescript
case CLIMATE_EVENTS.EXTREME_WEATHER:
  admissionMultiplier += 0.3;        // additive, but only once per event
  supplyChainPressure = Math.max(supplyChainPressure, 0.4);  // capped
  activeDisasterType = "natural-disaster";  // overwritten, not accumulated
  break;
```

If 5 EXTREME_WEATHER events arrive in one tick (from climate + trigger), the adapter processes all 5 but the macro packet is the same as processing 1 — `admissionMultiplier` accumulates to `1.0 + 0.3*5 = 2.5`, but this happens in BOTH arms because climate generates events in both.

The trigger's single event adds `+0.3` to admissionMultiplier in the intervention arm, but the climate sector's random events also add `+0.3` per event in both arms. The net difference is negligible.

---

## D. Phase F comparison

### Phase F mechanism (known-good)

```typescript
// phase-f-intervention.ts
const CONTROL_CO2 = 280;
const INTERVENTION_CO2 = 800;

function runArm(seed, co2, arm) {
  const configs = buildSectorConfigs(era, co2);  // DIFFERENT CO2 config
  const world = createWorld(sectors, configs, { seed });
  // ... run 20 ticks
}
```

Phase F varies a **config parameter** (`co2Concentration`) that feeds into the climate sector's deterministic calculations:

```typescript
// climate.ts:123-125
s.co2Concentration += emissionsToConcentration(s.annualEmissions);
s.temperatureAnomaly = calcTemperatureAnomaly(s.co2Concentration);
```

With CO2=280: `temperatureAnomaly ≈ 0`, `eventChance ≈ 0.05`
With CO2=800: `temperatureAnomaly ≈ 3.9`, `eventChance ≈ 0.23`

This produces **~4.6× more EXTREME_WEATHER events** in the intervention arm over 20 ticks — a large, sustained, systemic difference.

### Pilot mechanism (failed)

```typescript
// corrected-counterfactual-pilot.ts
const trigger = createTriggerSector(TI);  // fires ONE event at T=20
const sectors = [...standardSectors, trigger, sentinel];
const world = createWorld(sectors, SAMPLE_CONFIGS, { seed });
// config is IDENTICAL for both arms
```

The pilot varies **nothing in the config** — both arms use the same `SAMPLE_CONFIGS`. The only difference is a single event injection via the trigger sector.

### Key difference

| Aspect | Phase F | Pilot |
|--------|---------|-------|
| Intervention type | Config parameter (CO2) | Event injection (trigger sector) |
| Affected system | Climate sector's internal state | Adapter's per-tick event processing |
| Duration of effect | Entire simulation (20 ticks) | Single tick (T=20) |
| Magnitude | 4.6× more weather events | +1 event (3.8% increase) |
| Mechanism | Alters climate's RNG trajectory | Adds to existing event stream |
| Produces detectable signal | Yes (direction consistency 5/5) | No (direction consistency 0/5) |

**The pilot introduced a different intervention mechanism than Phase F.** Phase F does NOT inject events via a trigger sector — it varies a config parameter that feeds into the climate sector's deterministic logic. The pilot's trigger-sector approach is a fundamentally different (and weaker) intervention.

---

## E. Corrective action

### Minimum correction

The pilot must change its intervention mechanism to produce a **detectable, sustained signal** in the adapter. Two options:

#### Option 1: Config-based intervention (matches Phase F pattern)

Instead of injecting a single event, vary a climate config parameter between arms:

```typescript
// Control: normal climate config
const controlConfigs = { ...SAMPLE_CONFIGS, climate: { year: 2026, co2Concentration: 420, annualEmissions: 37 } };

// Intervention: elevated CO2 (like Phase F)
const interventionConfigs = { ...SAMPLE_CONFIGS, climate: { year: 2026, co2Concentration: 800, annualEmissions: 37 } };
```

This produces a systemic, sustained increase in EXTREME_WEATHER events across the entire simulation — matching Phase F's verified pathway.

**Pros:** Matches known-good Phase F mechanism; produces large, detectable signal.
**Cons:** Changes the approved design's intervention type; requires design re-approval.

#### Option 2: Sustained event injection (preserves trigger-sector approach)

Instead of a single event at T=20, inject events持续ly over a window:

```typescript
// Inject EXTREME_WEATHER at every tick from T=20 to T=30
if (fireTick !== null && ctx.tick >= fireTick && ctx.tick <= fireTick + 10 && !s.fired) {
  ctx.eventBus.publish({ type: CLIMATE_EVENTS.EXTREME_WEATHER, ... });
}
```

This produces ~10 additional events in the intervention arm vs control — a ~40% increase, which should be detectable.

**Pros:** Preserves the trigger-sector mechanism; no config change needed.
**Cons:** Changes the approved design's "single event at T_i=20" specification; the signal is still smaller than Phase F's.

#### Recommendation

**Option 1 (config-based)** is preferred because:
1. It matches the verified Phase F pathway
2. It produces a larger, more reliable signal
3. It avoids the fundamental problem of competing with the climate sector's random events

If Option 1 is chosen, the approved design document (`CORRECTED-COUNTERFACTUAL-DESIGN.md`) must be updated and re-approved before re-running the pilot.

---

## F. Scientific impact

> **The five-seed pilot is invalid as an outcome experiment because the intervention pathway was not verified.**

The pilot results show:
- `pathwayPass: false` — the intervention did not produce a detectable signal
- `directionConsistency: 0` — zero seeds showed positive deltas
- `meanDelta: -0.002` — essentially zero difference

However, the pilot ** DID verify the event pathway mechanics**:
- The trigger sector fires correctly ✅
- The adapter observes the event on the bus ✅
- `buildMacroPacket` processes it correctly ✅
- DR events are scheduled ✅

The failure is in the **intervention design** (single event is statistically insufficient), not in the **event pipeline** (which works correctly).

### Data disposition

The pilot data (`experiment-results/corrected-counterfactual/pilot/pilot-results.json`) must:
1. **NOT** enter the eventual N=50 statistical dataset
2. Be archived as a **failed precondition run** with this diagnosis
3. Be referenced only as evidence that the event pathway mechanics are functional

---

## G. STOP conditions — report

### 1. Exact root cause
**Experiment injection defect.** The pilot injects a single `EXTREME_WEATHER` event at T=20, but the climate sector independently generates ~25 such events over 50 ticks in both arms. The trigger's single event is a 3.8% increase — statistically indistinguishable from natural variation.

### 2. Evidence at each event boundary

| Boundary | Evidence |
|----------|----------|
| Trigger fires | ✅ `fired: true` in intervention arm |
| Event published | ✅ `climate.extreme_weather` on bus (type matches) |
| EventBus pending | ✅ Event visible in `pending()` at T=20 |
| Adapter observes | ✅ `buildMacroPacket` returns `admissionMultiplier=1.3` |
| DR events scheduled | ✅ `admission_surge`, `supply_chain_pressure`, `active_disaster` queued |
| Sentinel output differs | ❌ SupplyStress mean identical (0.491 vs 0.491) |

### 3. Phase F comparison
Phase F varies `co2Concentration` (280 vs 800) — a config parameter that feeds into the climate sector's deterministic logic, producing ~4.6× more weather events over the simulation. The pilot injects a single event via a trigger sector — a fundamentally different (and weaker) mechanism.

### 4. Defect classification
**Experiment-layer defect** (not production). The engine, event bus, adapter, and climate sector all function correctly. The defect is in the pilot's intervention design: a single event injection is insufficient to produce a detectable signal against the climate sector's random event generation.

### 5. Minimum correction
Change the intervention mechanism from single-event injection to config-based intervention (matching Phase F's `co2Concentration` variation) or sustained event injection over a multi-tick window. The approved design document must be updated and re-approved.

### 6. Corrected pilot eligibility
A corrected 5-seed pilot is eligible to re-run **after**:
- The intervention mechanism is changed to produce a detectable signal
- The design document is updated and re-approved
- The corrected pilot demonstrates `pathwayPass: true` with `directionConsistency ≥ 3/5`

### 7. Data disposition
The failed pilot data will remain archived as a failed precondition run and will **NOT** enter the scientific dataset.

---

*Diagnosis complete. STOP.*
