# Phase F — Economy→Climate Coupling Defect: Impact Assessment

**Date:** 2026-09-21
**Author:** orchestrator
**Scope:** Investigation only. No frozen artifact modified. No Phase F rerun.
**Related:** NCR-2026-09-21-001 · `docs/experiments/EXP-002-V2-CLIMATE-COUPLING-DEFECT.md`

---

## 0. Provenance statement

**Frozen Phase F artifacts were not modified by this investigation.**

- `src/sectors/climate.ts` — unmodified (verified via `git status`).
- `experiment-results/phase-f/{results,statistical-summary,manifest}.json`,
  `report.md`, `v1-invalid-stale-dist/` — unmodified (verified via `git status`).
- `docs/PHASE-F-DESIGN.md` — unmodified.

All Phase F numbers quoted below are **read directly from the frozen artifacts**.
Counterfactual values in §6 are **analytic projections**, explicitly **not**
Phase F results.

> **Provenance gap noted:** `experiment-results/phase-f/` and
> `docs/PHASE-F-DESIGN.md` are currently **untracked** in git (`??`). The
> "frozen" status is enforced by convention and file immutability, not by
> version control. Recommend committing them (or hashing them into a manifest)
> so freeze integrity is machine-verifiable.

---

## 1. Defect description

The climate sector's `GDP_SHIFT` handler converts economy GDP deltas into
atmospheric emissions using a fixed scalar that is not dimensionally reconciled
with the units of `gdpDelta`.

`src/sectors/climate.ts:63-75`:

```ts
{
  eventType: ECONOMY_EVENTS.GDP_SHIFT,
  handle(event, state) {
    const s = state as ClimateState;
    const gdpDelta = event.data.gdpDelta as number;   // USD
    const emissionsFactor = 0.00005;                  // dimensionless
    const emissionsDelta = gdpDelta * emissionsFactor; // treated as Gt
    return { ...s, annualEmissions: Math.max(0, s.annualEmissions + emissionsDelta) };
  },
}
```

The same handler set also receives `WAR_START` (+2.5 per war — dimensionally
consistent with the Gt baseline).

---

## 2. Unit analysis

| Item | Value |
|------|-------|
| **Conversion site** | `src/sectors/climate.ts:69` (`emissionsDelta = gdpDelta * 0.00005`) |
| **Input quantity** | `gdpDelta` — economy GDP increment, **USD per tick** |
| **Actual input units** | USD (e.g. USA gdp = 2.1e13) |
| **Expected input units** | Gt CO₂-equivalent per tick (baseline `annualEmissions = 37`) |
| **Factor applied** | `0.00005` — dimensionless |
| **Produced units** | dimensionless × USD = **USD-scaled number**, then assigned to a Gt-denominated field |
| **Missing conversion** | No USD→Gt emissions intensity bridge (e.g. tCO₂ per USD of GDP increment) |

### Magnitude

From `docs/history/era-contemporary.json` (`RP-CONTEMP-002`, 11 nations,
total GDP **5.831e13 USD**), at the configured `gdpGrowthRate` of 2.5%/tick:

```
sum(gdpDelta)        = 5.831e13 * 0.025      = 1.458e12 USD/tick
emissionsDelta       = 1.458e12 * 0.00005    = 7.289e7   (treated as Gt/tick)
baseline             = 37 Gt/tick
ratio                = 7.289e7 / 37          = 1.970e6 x
```

**The coupling injects ~1.97 million times the model's own baseline emissions,
every tick.**

Cross-check against observed state (EXP-002 v2, arm CO₂=280):
predicted ΔCO₂ = 7.289e7 × 0.45 / 7.8 = **4.205e6 ppm/tick**;
observed tick-3 jump ≈ **4.93e6 ppm** — consistent (residual from growth-rate
noise and tick timing).

---

## 3. Affected state variables

### Directly written
| Variable | Sector | Effect |
|----------|--------|--------|
| `annualEmissions` | climate | +7.289e7/tick (should be ~37) |
| `co2Concentration` | climate | +4.205e6 ppm/tick; 282 → 4.18e8 over 50 ticks |
| `temperatureAnomaly` | climate | `3*log2(co2/280)` → exceeds 9.2 by tick 4 |
| `extremeEvents` | climate | generation rate pinned at the 0.5 ceiling |

### Derived / published
| Variable | Formula | Effect |
|----------|---------|--------|
| `eventChance` | `clamp(0.1+(anomaly-1.2)*0.05, 0.05, 0.5)` | **saturated at 0.5** from tick 3–4 |

---

## 4. Dependency / pathway map

```
economy.tick()
  gdpGrowth = gdp * (gdpGrowthRate + noise)/100        [economy.ts:159-162]
  publish GDP_SHIFT { gdpDelta }                        [economy.ts:170]
        |
        v
climate GDP_SHIFT handler
  annualEmissions += gdpDelta * 0.00005   <-- DEFECT    [climate.ts:69]
        |
        v
  co2Concentration += emissions*0.45/7.8                [climate.ts:123]
  temperatureAnomaly  = 3*log2(co2/280)                 [climate.ts:125]
        |
        v
  eventChance = clamp(0.1+(anomaly-1.2)*0.05, 0.05, 0.5) [climate.ts:146-147]
        |                    ^
        |                    +-- SATURATES at 0.5 from tick 3-4
        v
  if (rng.next() < eventChance) publish EXTREME_WEATHER  [climate.ts:150]
        |
        v
  EventBus subscribers: economy, geopolitics             [events.ts EVENT_SUBSCRIPTIONS]
        |
        v
  DR adapter buildMacroPacket() -> queue.schedule(...)   [deers-rock-adapter.ts:301-310]
        |
        v
  DR state (_admissionMultiplier, _supplyChainPressure,
            _activeMacroDisaster, _scenario)
        |
        v
  sentinelOutput (occupancyRate, icuOccupancyRate,
                  mortalityPressure, supplyStress, admissionSurge)
```

---

## 5. Common-mode vs differential assessment

### 5a. Mechanism — common-mode

The additive emissions term is driven by the **absolute GDP level**, which is
identical in both arms (same era config). Measured from the frozen artifacts:

| seed | ctrl CO₂ [t1,t2,t3] | intv CO₂ [t1,t2,t3] |
|-----:|---------------------|---------------------|
| 42 | 284.3, 286.4, **4,655,842.2** | 804.3, 806.4, **4,656,362.2** |
| 43 | 284.3, 286.4, 4,063,533.8 | 804.3, 806.4, 4,064,053.8 |
| 44 | 284.3, 286.4, 4,553,667.1 | 804.3, 806.4, 4,554,187.1 |
| 45 | 284.3, 286.4, 4,223,768.6 | 804.3, 806.4, 4,224,288.6 |
| 46 | 284.3, 286.4, 3,741,358.0 | 804.3, 806.4, 3,737,121.2 |

At tick 3 the arms differ by only **~0.01%** (e.g. 520 ppm out of 4.66e6) despite
starting 520 ppm apart. **The explosion term is common-mode.** The intended
intervention (CO₂ 280 vs 800) is overwhelmed by it.

### 5b. Consequence — comparison-destroying

Because `eventChance` saturates in **both** arms, the CO₂ manipulation ceases to
produce any differential after tick 2.

Measured from frozen artifacts (all 5 seeds):

| seed | ctrl saturation tick | intv saturation tick | last differential tick |
|-----:|---------------------:|---------------------:|-----------------------:|
| 42–46 | 3 | 3 | **2** |

**Differential exposure window: 3 of 20 ticks (15% of horizon).**

Corroborating frozen evidence:
- `firstEventTickControl` = `[8,4,6,6,2]`; `firstEventTickIntervention` = `[8,4,6,6,2]` — **identical for all 5 seeds**.
- `controlTotalEvents` = 39; `interventionTotalEvents` = 41 — a 5% difference across 5 seeds × 20 ticks.
- 4 of 5 seeds show **no divergence at all** in `weatherEvents`, `adapterEvents`, or `sentinelTicks`.

### 5c. Verdict

**Common-mode in mechanism, but comparison-destroying in effect.**

The defect does not bias one arm relative to the other in the additive term.
However, by saturating both arms it **removes the treatment contrast** that the
design depends on. The user's framing distinguishes "common-mode → comparison
substantially unchanged" from "differential → comparison changed." This case is
a third mode: **common-mode perturbation that nullifies the contrast.** The
comparative result is materially affected — not by differential bias, but by
loss of treatment.

---

## 6. Counterfactual reconstruction (analytic, NOT a Phase F result)

Removing the `GDP_SHIFT→emissions` term leaves CO₂ growing at the baseline
2.1351 ppm/tick (emissions 37 Gt, noise ±0.1).

| tick | control (280) anomaly/chance | intervention (800) anomaly/chance | chance ratio |
|-----:|-----------------------------:|----------------------------------:|-------------:|
| 0 | 0.033 / 0.050 | 4.555 / 0.268 | **5.36×** |
| 3 | 0.130 / 0.050 | 4.590 / 0.269 | **5.39×** |
| 10 | 0.349 / 0.057 | 4.669 / 0.273 | **4.76×** |
| 19 | 0.614 / 0.071 | 4.769 / 0.278 | **3.94×** |

**Differential exposure window: observed 3 ticks → counterfactual 20 ticks.**
The defect compresses the differential window by **85%**.

Expected events over 20 ticks (counterfactual): intervention ≈ 20×0.27 ≈ 5.4;
control ≈ 20×0.05–0.07 ≈ 1.0–1.4. The corrected design would apply a sustained,
persistent treatment contrast.

> **This is a projection, not a result.** Whether a corrected model produces a
> detectable sentinel effect is an empirical question requiring a new run.

---

## 7. Impact classification

| Criterion | Assessment |
|-----------|------------|
| CO₂ concentration | **Affected** — explodes 282 → 4.18e8 ppm |
| Climate-event generation | **Affected** — rate pinned at ceiling |
| EXTREME_WEATHER frequency | **Affected** — saturated; arms converge |
| EventBus events | **Affected** — EXTREME_WEATHER/TEMP_SHIFT/EMISSIONS_CHANGE emissions distorted |
| DR adapter inputs | **Affected** — downstream of saturated weather stream |
| Hospital/sentinel outputs | **Indirectly affected** |
| Phase F control/intervention contrast | **Affected** — differential window 20→3 ticks (85% loss) |
| GDP→emissions saturation behaviour | **This is the mechanism** |

### Classification

**Pathway-validity impact.**

The pathway **mechanics** (Links 1–4) remain verified — Phase F demonstrated the
wiring end-to-end. But the **treatment** the design intended to apply was absent
for 85% of the horizon. The null result is therefore **uninformative**, not
informative-negative.

### Important nuance: Phase F is not an overclaim

Phase F's frozen `report.md` self-classifies as
**"E — Null stochastic result"** and states explicitly:
> "Primary success criterion (≥80% direction consistency): **NOT MET**."

Frozen statistics confirm: `directionConsistency` = **0 / 0 / 0 / 0.2** for
occupancy / ICU / mortality / supplyStress; 4 of 5 seeds all-zero; only seed 46
shows `supplyStress = +0.17`.

Phase F reported its null **honestly**. The defect does not turn a false positive
into a negative — it turns an honest null into an **uninterpretable** one. Any
downstream use of Phase F's null as evidence that "the macro→micro pathway does
not propagate to hospital observables" is **not supported by the data**, because
the macro perturbation was never sustained.

---

## 8. Recommendation

**C — Correct implementation + new Phase F rerun**, with a **D-component**.

Rationale:
- **A (preserve + document)** is insufficient: the defect materially affects the
  comparison, not merely its magnitude.
- **B (narrow the claim)** is partially valid but not sufficient alone: the
  pathway-mechanics evidence survives, but the null-effect claim becomes
  uninterpretable rather than merely weakened.
- **C** is required because the treatment contrast was lost; the question Phase F
  posed was never actually administered to the intervention arm over the horizon.
- **D-component**: a unit error of ~2e6× survived a "frozen" design, review, and
  execution. The economy→climate coupling should not be assumed to be the only
  dimensionally unreconciled interface. Recommend a **dimensional-consistency
  audit of all cross-sector couplings** (economy↔climate, geopolitics↔climate,
  climate↔economy, DR adapter unit conventions) before any new Phase F version
  is designed.

### Constraints on the corrected run (per provenance policy)

If a corrected model is produced it must be a **new experiment/version**:

- new commit;
- new experiment ID (e.g. `PHASE-F-v3-*`, distinct from `PHASE-F-CAUSAL-2026-09-06`);
- new artifact directory (e.g. `experiment-results/phase-f-v3/`);
- new manifest with explicit relationship to the frozen Phase F result;
- **never** overwrite or delete `experiment-results/phase-f/`.

The frozen Phase F result is retained as the historical record of the
pre-correction model.

---

## 9. Explicit statement

**No frozen Phase F artifact was modified, overwritten, renamed, or deleted
during this investigation.** No Phase F rerun was performed. All Phase F figures
are read-only quotations from the frozen artifacts. All corrected values in §6
are analytic projections, clearly labelled as not being Phase F results.

---

## 10. Artifacts

- This report: `docs/experiments/PHASE-F-ECONOMY-CLIMATE-COUPLING-IMPACT.md`
- Defect site: `src/sectors/climate.ts:63-75`, `:123-125`, `:146-147`
- Coupling source: `src/sectors/economy.ts:158-171`
- Frozen evidence (read-only): `experiment-results/phase-f/{results,statistical-summary}.json`, `report.md`
- Disposable diagnostic harness (not committed to repo): `%TEMP%/opencode/phasef-impact.mjs`
- NCR: `qms/records/nonconformities/2026-09-21-ncr-001-climate-coupling-unit-error.json`
- Prior finding: `docs/experiments/EXP-002-V2-CLIMATE-COUPLING-DEFECT.md`
