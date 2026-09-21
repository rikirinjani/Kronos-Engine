# EXP-002 v2 — RNG Fix Verified, but Climate Coupling Defect Found

**Date:** 2026-09-21
**Status:** BLOCKED — escalation required
**Severity:** Critical (affects frozen Phase F evidence chain)
**Track:** Research Track 2 (unreviewed)

---

## 1. Summary

Two independent results from this run:

1. **FIXED:** The EXP-002 v1 reproducibility failure was caused by era-state
   aliasing. Fixed. Reproducibility gate now passes (`replay identical: true`).
2. **FOUND:** The Kronos Engine climate sector has a **unit/scale defect in the
   economy→climate coupling** that drives CO₂ to ~4.2×10⁶ ppm/tick and pins
   `eventChance` at its 0.5 ceiling from tick 3–4 onward.

Finding (2) is **pre-existing** and is present in the **frozen Phase F** run.
It is not introduced by this work.

---

## 2. Defect A — Era-state aliasing (FIXED)

### Symptom
v1/v2-first-run: `seed-42 replay identical: false` → experiment aborted at the
reproducibility gate (exit code 2). No results written.

### Root cause
`loadEraState()` was called **once** in `main()` and the parsed object passed by
reference into every arm via `buildSectorConfigs(era, co2)`. That function
injects `era.nations`, `era.wars`, `era.alliances`, `era.globalState`
**by reference** into sector configs. The geopolitics sector mutates those
objects in place, so each successive run began from state polluted by all prior
runs — replay included.

Same class of defect as EXP-001E (rewind-point state aliasing).

### Fix
Load era state **fresh inside `runArm()`** (`exp-002-activation-threshold.ts:195`),
matching the Phase F pattern (`phase-f-intervention.ts:201`).

### Verification
```
seed-42 replay identical: true
```
Full 10-seed × 4-arm run completes; artifacts written.

---

## 3. Defect B — Economy→climate coupling unit error (PRE-EXISTING, OPEN)

### Evidence
Observed climate trajectory (seed 42, arm CO₂=280):

| tick | co2Concentration (ppm) | temperatureAnomaly | eventChance |
|-----:|-----------------------:|-------------------:|------------:|
| 0 | 2.82e2 | 0.033 | 0.05 |
| 1 | 2.84e2 | 0.066 | 0.05 |
| 2 | 2.86e2 | 0.098 | 0.05 |
| 3 | **4.93e6** | 42.06 | **0.5 (cap)** |
| 5 | 1.48e7 | 47.07 | 0.5 |
| 49 | 4.18e8 | 61.53 | 0.5 |

`eventChance` reaches the 0.5 ceiling at **tick 3 in every arm**
(CO₂ = 280, 400, 800, 1200).

### Root cause
`src/sectors/climate.ts:69` (GDP_SHIFT handler):

```ts
const emissionsFactor = 0.00005;
const emissionsDelta = gdpDelta * emissionsFactor;
annualEmissions: Math.max(0, s.annualEmissions + emissionsDelta)
```

`gdpDelta` is denominated in **USD**. From `docs/history/era-contemporary.json`
(RP-CONTEMP-002, 11 nations, total GDP 5.831e13 USD), the per-tick sum of GDP
deltas at the configured 2.5%/tick growth is:

```
sum gdpDelta @2.5%  = 1.458e12 USD/tick
emissionsDelta      = 1.458e12 * 0.00005 = 7.289e7 Gt/tick
co2Delta            = 7.289e7 * 0.45 / 7.8 = 4.205e6 ppm/tick
```

The model's own baseline is `annualEmissions = 37` Gt. The coupling therefore
adds emissions ~**2×10⁶ times larger than the baseline**, every tick.

Predicted tick-3 CO₂ jump 4.205e6 ppm vs observed 4.93e6 ppm — consistent
(residual from growth-rate noise and tick timing).

### Why the model cannot respond to the CO₂ ladder
`temperatureAnomaly = 3 * log2(co2 / 280)` and
`eventChance = clamp(0.1 + (anomaly - 1.2) * 0.05, 0.05, 0.5)`.

Once anomaly > 9.2, `eventChance` is pinned at 0.5. Anomaly exceeds 9.2 by
tick 4. Thereafter **every arm has identical event probability**, so the CO₂
ladder carries no information for the remaining 46 of 50 ticks.

---

## 4. Impact on frozen Phase F

Phase F (`experiment-results/phase-f/results.json`, seed 42, control) shows the
**same runaway**:

| tick | co2 | anomaly | chance |
|-----:|----:|--------:|-------:|
| 1 | 282.135 | 0.033 | 0.05 |
| 3 | 286.411 | 0.098 | 0.05 |
| 4 | **4,655,842** | 42.064 | **0.5** |
| 20 | 199,115,317 | 58.319 | 0.5 |

Phase F's horizon is H=20. `eventChance` is saturated for **ticks 4–20 (85% of
the horizon)**.

**Implication:** Phase F's control-vs-intervention contrast was driven almost
entirely by the 3-tick pre-saturation transient, plus stochastic event-timing
differences thereafter. The CO₂ pathway signal it reports is not a sustained
dose-response. This materially qualifies — and may invalidate — Phase F as
causal evidence.

---

## 5. EXP-002 v2 results (reproducible, but NOT a valid dose-response)

```
CO2  | Activation Rate | Mean ΔSupplyStress | Mean ΔOccupancy
 400 |              0% |              0.0000 |          0.0000
 800 |             50% |              0.0310 |         -0.0160
1200 |             70% |              0.0860 |         -0.0240
```

Mechanistic reading under Defect B: arms differ only during ticks 0–3. If no
event flips in that window, RNG streams stay identical and outcomes match
exactly. CO₂=400 → 0% activation across all 10 seeds is consistent with the
transient difference (eventChance 0.05 vs 0.118) failing to flip any draw.
The curve is **monotone and reproducible**, but it measures stochastic
event-timing sensitivity in a saturated system, not a CO₂ threshold.

**Conclusion: EXP-002 cannot answer the threshold question until Defect B is
resolved.** A valid design needs either a corrected coupling scale or a horizon
inside the pre-saturation window (H ≤ 3, which is too short for sentinel
response) — i.e. the coupling must be fixed.

---

## 6. Recommended remediation (requires human decision)

Defect B is in a **frozen** component. Options:

1. **Correct the coupling scale.** Re-derive `emissionsFactor` so a 2.5% GDP
   growth delta produces a realistic emissions increment (order 0.1–1 Gt/tick).
   Requires re-running Phase F → invalidates frozen Phase F artifacts.
2. **Clamp climate state.** Add a physical CO₂ ceiling so anomaly cannot exceed
   the range where `eventChance` saturates. Still changes frozen behaviour.
3. **Narrow the claim.** Retain Phase F but re-scope the manuscript to the
   pre-saturation transient only, with explicit disclosure.

Option 1 is the scientifically correct fix but has the largest blast radius
(Phase F, QMS records, manuscript evidence matrix, Zenodo package).
**This decision is reserved for the human owner.**

---

## 7. Artifacts

- Runner (fixed): `src/experiment/experiments/exp-002-activation-threshold.ts`
- Results (v2, reproducible): `experiment-results/exp-002/exp-002-results.json`
- Curve: `experiment-results/exp-002/activation-curve.csv`
- Phase F evidence examined: `experiment-results/phase-f/results.json`
- Defect site: `src/sectors/climate.ts:65-75` (GDP_SHIFT handler), `:146-147`
  (eventChance formula)

## 8. Reproducibility

| Gate | v1 | v2 |
|------|----|----|
| seed-42 replay identical | false | **true** |
| Run completes | no (abort) | yes |
| Defect B present | yes (untested) | yes (confirmed) |
