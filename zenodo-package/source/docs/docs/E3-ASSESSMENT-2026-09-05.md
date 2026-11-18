# E3 Assessment — health.* KE Consumer Audit

**Date:** 2026-09-05
**Trigger:** DR handoff "PHASE E3 HEALTH.* SUBSCRIBER" (post Phase E, commit `f53f210`)
**Question:** Does any existing KE sector/state variable provide a defensible consumer for at least one `health.*` event?

## Verdict

**E3 BLOCKED — no defensible KE consumer exists.**

## Evidence

### 1. Zero health.* subscribers (mechanically proven)

Complete non-test, non-adapter `TickHandler` inventory (`eventType:` grep across `src/`):

| Sector | Subscribed events |
|--------|-------------------|
| geopolitics | `economy.gdp_shift`, `climate.extreme_weather` |
| climate | `economy.gdp_shift`, `geopolitics.war_start` |
| economy | `geopolitics.war_start`, `geopolitics.war_casualties`, `climate.extreme_weather`, `technology.innovation` |
| technology | `economy.gdp_shift` |
| energy | `geopolitics.war_start`, `climate.extreme_weather`, `economy.gdp_shift`, `technology.innovation` |
| demographics | `geopolitics.war_start`, `economy.gdp_shift` |

No handler matches any of: `health.pressure`, `health.mortality`, `health.supply-crisis`, `health.surge`, `health.down`. Events are queued by `applyCrossSectorEvents()` (`world-engine.ts:57-75`) and silently dropped.

### 2. Exhaustive health-semantic state inventory

Only two health-semantic state structures exist in KE, both in geopolitics:

- `Nation.healthMetrics` (`geopolitics.ts:17-22`): `{ lifeExpectancy, infantMortality, hospitalBedsPer1000, universalCoverage }` — **per-nation, static**. Set once at `init()` from era data; never mutated in `tick()`.
- `GlobalState.avgHealthOutcome` (`geopolitics.ts:49`): global scalar — **static**. Default 73; never mutated in `tick()`.

All other sector state (economy GDP, demographics rates, climate CO2, technology levels, energy mix) has no health semantics.

### 3. Granularity mismatch (decisive)

Every `health.*` payload is **hospital-local**:

| Event | Payload fields |
|-------|---------------|
| `health.pressure` | hospitalId, city, occupancyRate |
| `health.mortality` | hospitalId, city, deaths |
| `health.supply-crisis` | hospitalId, city, supplyStress |
| `health.surge` | hospitalId, city, occupancyRate |
| `health.down` | hospitalId, city, error, tick |

Every KE state variable is **national** (`nations.<ID>.*`) or **global** (`globalState.*`, `marketIndex`). KE has no city-level, regional-health, or health-system state. The scale gap between one 133-bed hospital and a 270M-person nation (or 8.2B-person global aggregate) is 5-7 orders of magnitude.

### 4. Adapter invariant forbids the extrapolation

`ADAPTER_INVARIANTS.LOCAL_SIGNAL_ONLY` (`deers-rock-adapter.ts:51`):

> "Sentinel output is local observation. Never extrapolated to national or regional level."

Wiring `health.pressure` (Makassar occupancy) into `nations.IDN.healthMetrics.lifeExpectancy` or `globalState.avgHealthOutcome` would directly violate KE's own documented boundary contract. The invariant exists precisely because a single-hospital sentinel is a biased local sample, not a national estimator.

### 5. Candidate-by-candidate rejection

| Candidate consumer | Rejection reason |
|--------------------|------------------|
| `geopolitics.Nation.healthMetrics.*` | National granularity; static era data; violates LOCAL_SIGNAL_ONLY; 1-hospital → 270M-person extrapolation indefensible |
| `geopolitics.GlobalState.avgHealthOutcome` | Global granularity; static; same violation, worse scale |
| `demographics.DemographicsNationState.deathRate` | National per-1000 rate; hospital morgue count is not a national mortality sample; violates LOCAL_SIGNAL_ONLY |
| `economy.*` (GDP, healthcare spending) | No healthcare-spending state exists; occupancy→GDP causal model would be invented, not existing |
| `climate/technology/energy.*` | No health semantics whatsoever |
| New registry/accumulator in existing sector | Write-only log fails "observable downstream effect" requirement; registry with downstream effect re-creates the extrapolation violation; handoff forbids inventing consumers |

## Conclusion

The micro→macro channel is **architecturally asymmetric by design**: the sentinel emits valid local signals, but KE's national/global world model provides no state variable at a granularity where those signals could be consumed defensibly. This is not a wiring gap to fix — it is a scale-separation property of the architecture, correctly enforced by the adapter invariants.

**Classification:** BLOCKED (no defensible consumer; none invented per handoff instruction).

## Implications for the paper

- Macro→micro coupling: PROVEN (Phase E, `admission_surge`, `staff_shortage`, `supplyStress`)
- Micro→macro coupling: NOT PROVEN — documented architectural asymmetry (this assessment)
- The sentinel boundary is valid; bidirectional semantic coupling remains incomplete at the KE granularity level. This is an honest, reportable finding, not a defect.

## What would unblock E3 (future work, out of scope)

A defensible consumer requires KE state at city/regional-health granularity — e.g., a regional health-system sector with per-region capacity, or a sentinel-network aggregator over a statistically defensible hospital sample. Both are new architecture, explicitly out of E3 scope per handoff ("Do not create an arbitrary health sector solely to make the test pass").
