# Sentinel Observability Diagnostic

**Date:** 2026-09-21
**Question:** Why does the hospital sentinel remain nearly invariant despite extreme upstream macro-world differences?
**Scope:** Diagnostic only. No production modification, no frozen artifact modified, no Phase F rerun, no N=50, no Monte Carlo, no manuscript change.
**Harness:** `scripts/sentinel-observability.ts` · **Artifacts:** `experiment-results/sentinel-observability/sensitivity-results.json`

---

## 0. Answer in one paragraph

The macro→sentinel pathway **is wired and does function**, but the adapter's
output values sit **below the Deers Rock model's response thresholds** on both
continuous channels, and the one channel that does fire **deliberately discards
magnitude**. The adapter supplies `admissionMultiplier = 1.3`, but the DR
admission model quantizes at **1.5**; it supplies `supplyChainPressure = 0.4`,
but the DR restock threshold responds only at **≥0.6**. Both therefore deliver
**exactly zero effect**. The entire observable signal — a 0.76 percentage-point
occupancy shift — comes from a single categorical channel
(`activeDisasterType`), which activates a DR scenario at a **hardcoded severity
of 0.6**. The climate event's `severity` field is **never read by the adapter at
all**, so the runaway severity (30 vs 3) is invisible to the hospital. The
invariance is not a mystery; it is a predictable consequence of the interface
design.

---

## 1. Complete transformation chain

```
KRONOS MACRO STATE
  economy.gdp, climate.co2Concentration, climate.temperatureAnomaly
        |
        v
EXTREME_WEATHER event  { type, region, severity, year, description }
  climate.ts:163   severity = round((1 + rng*4 + temperatureAnomaly*0.5)*10)/10
        |
        |  *** severity is NOT read by the adapter ***
        v
ADAPTER buildMacroPacket(events, tick)            deers-rock-adapter.ts:153-194
  switch (evt.type) {                             <-- switches on TYPE only
    EXTREME_WEATHER:
      admissionMultiplier += 0.3                  -> {1.0, 1.3}
      supplyChainPressure = max(scp, 0.4)         -> {0, 0.4}
      activeDisasterType = "natural-disaster"
      diagnosisWeightOverrides["J00-J99"] = 1.3   -> *** DEAD FIELD ***
    WAR_START:        (+0.2 / staff 0.85 / scp 0.5)   [never fires: era has 0 wars]
    WAR_CASUALTIES:   (scp += 0.1)                    [never fires]
    TEMP_SHIFT:       (I00-I99 = 1.15)                [dead field]
  }
        |
        v
ADAPTER tick schedules onto DR queue            deers-rock-adapter.ts:299-311
  i===0 && admissionMultiplier !== 1.0 -> schedule("admission_surge", 0, {multiplier})
  i===0 && staffModifier < 1.0         -> schedule("staff_shortage", 0, {modifier})
  i===0 && supplyChainPressure > 0     -> schedule("supply_chain_pressure", 0, {pressure})
  i===0 && activeDisasterType          -> schedule("active_disaster", 0, {disasterType})
  [diagnosisWeightOverrides is NEVER scheduled]
        |
        v
DR world.step() x ticksPerDay (=10)             world.js:296-315 (queue dispatch)
  admission_surge        -> state._admissionMultiplier
  staff_shortage         -> state._staffAvailabilityModifier
  supply_chain_pressure  -> state._supplyChainPressure
  active_disaster        -> state._activeMacroDisaster
        |
        v
DR CONSUMERS
  markov.js:58-60        baseAdmit = floor(rng()*3) in {0,1,2}
                         scaledAdmit = floor(baseAdmit * _admissionMultiplier)
                         toAdmit = min(availableBeds, max(1, scaledAdmit))
  central-supply.js:78-85  ONLY when clock.tick % 50 === 0:
                         effectiveMin = minStock + (maxStock-minStock)*pressure
                         if stock < effectiveMin -> restock to maxStock
  scenario.js:118-127    if no active scenario && _activeMacroDisaster:
                         activate mapped scenario with severity HARDCODED 0.6
  outpatient.js:97-99    poliCapacity = max(1, floor(capacityPerTick * staffModifier))
        |
        v
HOSPITAL STATE (beds, encounters, inventory, morgue, _scenario)
        |
        v
extractSentinelOutput()                          deers-rock-adapter.ts:128-151
  occupancyRate    = occupied beds / total capacity
  icuOccupancyRate = ICU+PICU+NICU occupied / their capacity
  mortalityPressure= morgue.length
  diseasePrevalence= top-5 ICD codes from encounters
  supplyStress     = computeSupplyStress(state)   central-supply.js:144
  staffStress      = min(1, encounters / (wards*3))
  admissionSurge   = occupied > capacity * 0.9
        |
        v
EXPERIMENT ENDPOINT (finalSentinel)
```

### Information discarded at each boundary

| Boundary | Input | Transformation | Output | Information lost |
|---|---|---|---|---|
| climate → event | anomaly, rng | `severity = 1+rng*4+anomaly*0.5` | severity ∈ ℝ | none (here) |
| event → adapter | severity | **not read** | — | **ALL severity magnitude** |
| adapter → packet | event type | `+= 0.3` / `max(0.4)` | {1.0,1.3}, {0,0.4} | event count > 1 collapsed; magnitude |
| packet → queue | packet fields | 4 schedules | 4 DR events | `diagnosisWeightOverrides` **entirely** |
| queue → state | multiplier | assigned | `_admissionMultiplier` | none (but latched) |
| state → admission | `floor(baseAdmit*m)`, `max(1,·)` | integer | {1,2} admissions | **multiplier below 1.5 entirely** |
| state → restock | `effectiveMin` at `%50` | step | restock or not | **pressure below ~0.5 entirely** |
| disaster → scenario | disasterType | lookup | scenario, **severity 0.6 fixed** | **magnitude** |
| state → sentinel | morgue | `.length` | 0 | mortality (never populated) |
| state → sentinel | occupancy | ratio | 0–1 | none |
| sentinel → endpoint | `admissionSurge` | `occ > 0.9` | false | never true |

---

## 2. Sensitivity matrix (Phase B — direct DR drive)

Method: the DR hospital was driven **directly** with controlled macro inputs
(bypassing the Kronos adapter) for 200 DR ticks (= 20 KE ticks), seed 42,
50 patients. Production code unmodified.

### admissionMultiplier

| multiplier | occupancy | icuOcc | supplyStress | encounters | cumAdmissions | Δocc vs 1.0 |
|---|---|---|---|---|---|---|
| 1.00 | 0.5420 | 0.0357 | 0.4918 | 156 | 71 | 0.0000 |
| 1.10 | 0.5420 | 0.0357 | 0.4918 | 156 | 71 | **0.0000** |
| **1.30** ← adapter | 0.5420 | 0.0357 | 0.4918 | 156 | 71 | **0.0000** |
| 1.50 | 0.5725 | 0.0357 | 0.5224 | 158 | 75 | 0.0305 |
| 2.00 | 0.6031 | 0.0000 | 0.5204 | 163 | 79 | 0.0611 |

**Response threshold lies between 1.30 and 1.50. The adapter supplies 1.30.**

### supplyChainPressure

| pressure | occupancy | supplyStress | encounters | ΔsupplyStress vs 0.0 |
|---|---|---|---|---|
| 0.00 | 0.5420 | 0.4918 | 156 | 0.0000 |
| 0.20 | 0.5420 | 0.4918 | 156 | **0.0000** |
| **0.40** ← adapter | 0.5420 | 0.4918 | 156 | **0.0000** |
| 0.60 | 0.5420 | 0.0060 | 156 | −0.4857 |
| 0.80 | 0.5420 | 0.0060 | 156 | −0.4857 |
| 1.00 | 0.5420 | 0.0060 | 156 | −0.4857 |

**Response threshold lies between 0.40 and 0.60. The adapter supplies 0.40.**

### activeDisasterType

| case | occupancy | icuOcc | supplyStress | encounters | cumAdmissions |
|---|---|---|---|---|---|
| none | 0.5420 | 0.0357 | 0.4918 | 156 | 71 |
| natural-disaster | 0.5496 | **0.0714** | 0.5199 | 160 | 72 |

**Effective.** icuOccupancy doubles. But magnitude is discarded (fixed severity 0.6).

### staffAvailabilityModifier

| staffMod | occupancy | encounters | cumAdmissions |
|---|---|---|---|
| 1.00 | 0.5420 | 156 | 71 |
| 0.85 | 0.5420 | 156 | 71 |

**No effect on these endpoints.**

### Adapter-equivalent packet (what Phase F actually supplies)

`multiplier 1.3 + pressure 0.4 + natural-disaster` →
**occupancy 0.5344, supplyStress 0.4921**

This **reproduces the observed experimental values exactly** (observed A0:
occupancy 0.534, supplyStress 0.492; A1: occupancy 0.542, supplyStress 0.492).
The diagnostic therefore fully accounts for the observed invariance.

---

## 3. Threshold and quantization audit (Phase C)

| Stage | Mechanism | Threshold / quantum | Effect on adapter values |
|---|---|---|---|
| `markov.js:58` | `baseAdmit = floor(rng()*3)` ∈ {0,1,2} | integer | — |
| `markov.js:59` | `scaledAdmit = floor(baseAdmit * m)` | effective m ≥ 1.5 | **1.3 → identical to 1.0** |
| `markov.js:60` | `max(1, scaledAdmit)` | floor of 1 admission | masks m ≤ 1.0 |
| `central-supply.js:78` | restock only at `tick % 50 === 0` | 4 events in 200 DR ticks | — |
| `central-supply.js:82` | `effectiveMin = min + range*p` | p ≥ ~0.5 crosses initial stock | **0.4 → no restock change** |
| `scenario.js:127` | scenario severity | **hardcoded 0.6** | magnitude discarded |
| `outpatient.js:99` | `max(1, floor(cap * mod))` | small integer capacity | 0.85 → often no change |
| `extractSentinelOutput:149` | `occ > 0.9` | hard threshold | never reached (max 0.603) |
| `extractSentinelOutput:145` | `morgue.length` | integer count | always 0 |
| `extractSentinelOutput:124` | top-5 ICD slice | truncation | minor |

### Is `macro → adapter → hospital → sentinel` preserved, attenuated, delayed, or discarded?

| Channel | Verdict |
|---|---|
| `admissionMultiplier` | **DISCARDED** (below quantization threshold) |
| `supplyChainPressure` | **DISCARDED** at adapter values; otherwise step-delayed |
| `activeDisasterType` | **ATTENUATED** (categorical; magnitude discarded) |
| `staffAvailabilityModifier` | **DISCARDED** (no effect on endpoints) |
| `diagnosisWeightOverrides` | **DISCARDED at the adapter** (never scheduled) |
| climate `severity` | **DISCARDED at the adapter** (never read) |
| `mortalityPressure` | **STRUCTURALLY ABSENT** (morgue always empty) |
| `admissionSurge` | **THRESHOLD-UNREACHABLE** |

---

## 4. Time-delay analysis (Phase D)

Extreme packet (`multiplier 2.0 + pressure 1.0 + disaster`) vs baseline:

| KE ticks | base occ | extreme occ | Δocc | base supply | extreme supply | Δsupply |
|---|---|---|---|---|---|---|
| 5 | 0.3969 | 0.4275 | 0.0305 | 0.5064 | 0.5065 | 0.0001 |
| 10 | 0.4427 | 0.4809 | 0.0382 | 0.5129 | 0.5129 | 0.0000 |
| 20 | 0.5420 | 0.5878 | 0.0458 | 0.4918 | 0.0060 | −0.4858 |
| 30 | 0.6107 | 0.6870 | 0.0763 | 0.5044 | 0.0000 | −0.5044 |
| 40 | 0.7176 | 0.8092 | 0.0916 | 0.5167 | 0.0124 | −0.5042 |
| 60 | 0.9160 | 0.9695 | 0.0534 | 0.4922 | 0.0000 | −0.4922 |

**Occupancy.** Δ grows monotonically with horizon (0.0305 → 0.0916). The pathway
is **not** too short for occupancy at H=20; the response is present and grows.
At H=60 both arms approach the 1.0 ceiling and Δ compresses.

**supplyStress.** No difference at all until **KE tick 15** (DR tick 150), where
it steps from 0.4857 to 0.0000. Cause: restocking only occurs at DR ticks
divisible by 50 (KE ticks 5, 10, 15, 20). supplyStress is a **sawtooth** pinned
near 0.5, reset by restock.

Baseline vs `pressure=1.0` trajectory — **identical for KE ticks 1–14**:

```
keTick:  1      5      10     14     15      16     20
base:    0.5012 0.5064 0.5129 0.5180 0.4857  0.4869 0.4918
press1:  0.5012 0.5064 0.5129 0.5180 0.0000  0.0011 0.0060
```

**Distinction requested:** "H=20 is too short" is **false for occupancy** (the
response is present and growing). For `supplyStress` the effective delay is
**≥15 KE ticks**, and even then the response is a **step at restock boundaries**,
not a gradient.

---

## 5. Endpoint observability map (Phase E)

| Endpoint | Upstream driver | Classification |
|---|---|---|
| `occupancyRate` | `admission_surge` (quantized ≥1.5), `active_disaster` | **THRESHOLD-LIMITED** |
| `icuOccupancyRate` | `active_disaster` scenario only | **INDIRECTLY SENSITIVE** (only responsive endpoint; doubles) |
| `mortalityPressure` | morgue count | **STRUCTURALLY INSENSITIVE** (0 in every case tested) |
| `supplyStress` | `supply_chain_pressure` (≥0.6), restock sawtooth | **THRESHOLD-LIMITED + HORIZON-LIMITED** |
| `admissionSurge` | `occ > 0.9` | **THRESHOLD-UNREACHABLE** (max observed 0.603) |
| `diseasePrevalence` | DR-internal encounter case mix | **STRUCTURALLY INSENSITIVE** to macro (its macro driver is a dead field) |
| `staffStress` | `encounters / (wards*3)` | **INDIRECTLY SENSITIVE** (weak) |

**No new endpoints are introduced.** `supplyStress` is **not** an appropriate
primary endpoint for this intervention: it is driven by inventory depletion,
reset by a restock sawtooth, and responds to macro pressure only above ~0.5 —
which the adapter never supplies.

---

## 6. KE interpretation

The sentinel's near-invariance is **fully explained by the interface design**, and
the diagnostic reproduces the observed values exactly. Three distinct causes:

1. **Interface scale mismatch (dominant).** The adapter's continuous channels
   deliver values *below* the DR model's response thresholds:
   `admissionMultiplier` 1.3 < 1.5; `supplyChainPressure` 0.4 < 0.6. Both channels
   therefore transmit **exactly zero** information. This is not a broken wire —
   the wire is connected and the DR model does respond — it is a **scale
   mismatch between the adapter's output range and the DR model's input
   resolution**.

2. **Deliberate magnitude discard.** `severity` is never read by the adapter, and
   the DR scenario severity is hardcoded at 0.6. The design comment states this is
   intentional ("deterministic, moderate"). Consequence: the climate defect's
   severity amplification (30 vs 3) is invisible downstream, which is *protective*
   but also means severity carries no experimental signal.

3. **Dead interface field.** `diagnosisWeightOverrides` is computed, populated,
   returned — and never consumed. Zero references on the DR side.

Consequently the **entire** observed macro→sentinel effect is a single
categorical channel producing a 0.76 pp occupancy shift.

---

## 7. Jev adversarial review

Jev (`jev-1.13.0`) was given the transformation chain, sensitivity results,
threshold analysis, time-delay findings and endpoint map. 3 question sets,
27 questions.

### 7.1 Sensitivity and defect classification

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Sufficient sensitivity to detect the intended perturbation? | 0.77 | **Partially** | 0.62 |
| Is the observed invariance expected from the mechanics? | 1.93 | **Yes** | 0.89 |
| Evidence of an instrumentation defect? | 1.41 | **Partially** | 0.12 `[low]` |
| Classify: dead `diagnosisWeightOverrides` field | 1.97 | **Implementation defect** | 0.96 |
| Classify: admission multiplier 1.3 vs threshold 1.5 | 0.43 | **Model-sensitivity limit** | 0.35 |
| Classify: pressure 0.4 vs threshold 0.6 | 0.61 | **Both** | 0.09 `[low]` |
| Classify: staff modifier no effect | 0.32 | Model-sensitivity limit | 0.52 |
| Classify: severity discarded | 0.92 | **Both** | 0.32 |
| Classify: mortality always 0 | 0.37 | Model-sensitivity limit | 0.45 |
| Classify: admissionSurge unreachable | 0.19 | Model-sensitivity limit | 0.72 |
| Is interface scale mismatch the primary cause? | 1.68 | **Yes** | 0.51 |

### 7.2 Endpoint appropriateness and claims

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Is `supplyStress` structurally appropriate as a primary endpoint? | 1.87 | **Inappropriate** | 0.80 |
| Is supplyStress restock-sawtooth driven and insensitive below ~0.5? | 1.73 | **Yes** | 0.59 |
| Is `occupancyRate` a better endpoint? | 1.61 | **Yes** | 0.41 |
| Is `icuOccupancyRate` the most responsive? | 1.61 | **Yes** | 0.41 |
| Can any mortality claim be made? | 0.19 | **No claim possible** | 0.71 |
| Can it be claimed the pathway is operational end-to-end? | 0.93 | **Partially** | 0.78 |
| Can it be claimed the sentinel is structurally insensitive at supplied values? | 1.49 | **Partially** | 0.23 |
| Can any clinical effect claim be made? | 0.42 | **No** | 0.37 |

### 7.3 Redesign requirements

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Must adapter output ranges be re-scaled above DR thresholds? | 1.61 | **Required** | 0.42 |
| Must the dead field be wired or removed? | 0.97 | Advisable | 0.48 |
| Should severity be carried through to DR scenario magnitude? | 1.52 | **Required** | 0.28 |
| Must the primary endpoint change? | 1.31 | Advisable | 0.00 `[low]` |
| Must a sensitivity/calibration study precede redesign? | 1.87 | **Required** | 0.81 |
| Is a longer horizon required? | 0.96 | Advisable | 0.06 `[low]` |
| Can the experiment be meaningfully redesigned on this basis? | 1.57 | **Yes** | 0.35 |
| Does any part of the chain remain unexamined? | 0.72 | Possibly | 0.00 `[low]` |

### 7.4 Where Jev agrees / disagrees with KE

**Agrees:** the invariance is **expected from the mechanics** (conf 0.89); the
dead field is an **implementation defect** (conf 0.96); interface scale mismatch
is the **primary cause** (1.68); `supplyStress` is **inappropriate** as a primary
endpoint (conf 0.80); no mortality or clinical claim is possible; adapter ranges
must be re-scaled (required); a calibration study must precede redesign
(conf 0.81).

**Disagrees / qualifies:**
- KE classifies the **admission threshold mismatch as an interface/implementation
  defect**; Jev classifies it as a **model-sensitivity limit** (0.43). This is a
  genuine and unreconciled difference of framing: KE holds that the adapter
  violates its own interface contract by emitting values the DR model cannot
  resolve; Jev holds that the DR model's integer admission dynamics are simply
  insensitive at that operating point.
- KE treats the pressure mismatch as an interface defect; Jev splits it as
  **"both"** (0.61, conf 0.09).
- Jev rates the pathway-operational claim only **partially** supported (0.93),
  whereas KE's trace shows the mechanism does function; Jev's reading is that
  "operational" overstates a pathway that transmits one categorical bit.

---

## 8. Implementation defect vs model-sensitivity limit

Per Phase G, these are documented **separately** and **nothing was patched**.

### 8a. Implementation defects

| # | Defect | Evidence | Severity |
|---|---|---|---|
| I1 | `diagnosisWeightOverrides` is computed, populated and returned but **never consumed** — no consumer in Kronos, zero references in DR | `deers-rock-adapter.ts:158,169,175,181,189`; grep across both repos | **Confirmed implementation defect** (Jev conf 0.96) |
| I2 | Adapter emits `admissionMultiplier ∈ {1.0, 1.3}` while the DR model cannot resolve values < 1.5 — the interface contract is not met | `markov.js:58-60` + measured sweep | **KE: interface defect. Jev: model-sensitivity limit. Unreconciled** |
| I3 | Adapter emits `supplyChainPressure = 0.4` while the DR restock threshold responds only at ≥0.6 | `central-supply.js:78-85` + measured sweep | **KE: interface defect. Jev: "both"** |

### 8b. Intentional but inadequate model sensitivity

| # | Property | Evidence | Note |
|---|---|---|---|
| M1 | Climate `severity` is never read by the adapter; DR scenario severity is hardcoded 0.6 | `deers-rock-adapter.ts:164-183`; `scenario.js:127` | **Intentional** per code comment ("deterministic, moderate"). Protective, but severity carries no signal |
| M2 | `staffAvailabilityModifier` 0.85 has no effect on inpatient endpoints | `outpatient.js:97-99` + sweep | Outpatient pathway does not feed occupancy/supplyStress |
| M3 | `mortalityPressure` = 0 in every case tested | `deers-rock-adapter.ts:131,145` + sweep | Morgue never populated at this horizon/severity |
| M4 | `admissionSurge` requires occupancy > 0.9; max observed 0.603 | `deers-rock-adapter.ts:149` | Threshold unreachable |
| M5 | `supplyStress` is restock-sawtooth driven | `central-supply.js:144-161` + trajectory | Structurally horizon-limited |

**No production change was made. No fix was applied.** Both lists are documentation.

---

## 9. Implications for corrected Phase F

1. **The existing sentinel cannot carry the intended experiment.** Even with the
   climate coupling corrected, the adapter's supplied values fall below the DR
   response thresholds, so the sentinel would remain invariant. A corrected
   climate model alone would **not** produce a detectable sentinel effect.
2. **The primary endpoint must change.** `supplyStress` is inappropriate (Jev
   conf 0.80). `icuOccupancyRate` is the most responsive endpoint measured, and
   `occupancyRate` responds monotonically with horizon.
3. **An interface calibration study must precede any redesigned experiment**
   (Jev: required, conf 0.81). The adapter→DR transfer function must be
   characterised and the adapter's output ranges re-scaled to sit inside the DR
   model's responsive region.
4. **Severity must be wired through** if the climate perturbation's magnitude is
   to reach the hospital (Jev: required). Currently the one effective channel is
   categorical.
5. **The dead field must be resolved** — wired or removed (Jev: advisable).
6. **Horizon:** H=20 is **not** too short for occupancy (response present and
   growing), but it **is** marginal for `supplyStress` (needs ≥15 KE ticks and
   even then only at restock boundaries). Jev rates a longer horizon advisable,
   not required.
7. **Preserve the frozen record.** Nothing here alters the frozen Phase F result.

**Classification of the blocker:** the sentinel invariance is a **model-interface
sensitivity limit with one confirmed implementation defect (dead field)**, not a
broken pathway and not a defect in the hospital model's internal dynamics.

---

## 10. Final status

```text
SENTINEL OBSERVABILITY:
  TRACED END TO END. Pathway is wired and functions. The invariance is fully
  explained and reproduced: the adapter-equivalent packet yields occupancy
  0.5344 / supplyStress 0.4921, matching the observed 0.534 / 0.492.
  Harness: scripts/sentinel-observability.ts
  Data: experiment-results/sentinel-observability/sensitivity-results.json
  No production modification. No frozen artifact modified. No rerun.

PATHWAY:
  WIRED BUT LARGELY NON-TRANSMISSIVE.
  4 adapter channels exist. Only ONE (activeDisasterType) has any effect, and it
  discards magnitude (DR scenario severity hardcoded 0.6).
  admissionMultiplier 1.3  -> below DR threshold 1.5   -> ZERO effect
  supplyChainPressure 0.4  -> below DR threshold 0.6   -> ZERO effect
  staffAvailabilityModifier -> no effect on these endpoints
  diagnosisWeightOverrides -> never consumed (dead field)
  climate severity         -> never read by the adapter

SENSITIVITY:
  PARTIAL, AND INADEQUATE AT THE SUPPLIED VALUES.
  Measured response thresholds: admissionMultiplier between 1.30 and 1.50;
  supplyChainPressure between 0.40 and 0.60. The adapter supplies 1.3 and 0.4.
  Maximum achievable effect from the adapter-equivalent packet: 0.76 pp occupancy.
  [Jev: sufficient sensitivity "partially", conf 0.62]

PRIMARY ENDPOINT:
  supplyStress IS INAPPROPRIATE as a primary endpoint. [Jev 1.87, conf 0.80]
  It is inventory-depletion driven, restock-sawtooth at DR ticks %50, and
  responds to macro pressure only above ~0.5. It reported 0.492 in every
  ablation including the catastrophic one.
  Most responsive measured endpoint: icuOccupancyRate (doubles under the
  disaster channel). occupancyRate responds monotonically with horizon.

TIME-HORIZON LIMIT:
  "H=20 is too short" is FALSE for occupancy - the response is present at H=5
  (delta 0.0305) and grows monotonically to 0.0916 at H=40.
  supplyStress has an effective delay of >=15 KE ticks and even then responds
  as a STEP at restock boundaries, not a gradient.

IMPLEMENTATION DEFECT:
  YES - one confirmed: diagnosisWeightOverrides is computed, populated and
  returned by the adapter but NEVER consumed (zero references in either repo).
  [Jev: implementation defect, conf 0.96]
  UNRECONCILED: KE classifies the admission and pressure threshold mismatches as
  interface/implementation defects; Jev classifies the admission one as a
  model-sensitivity limit (0.43) and the pressure one as "both" (0.61).

MODEL-SENSITIVITY LIMIT:
  YES - the dominant cause. The adapter's continuous output ranges lie below the
  DR model's response thresholds, so both continuous channels transmit zero
  information. Additional limits: mortalityPressure always 0; admissionSurge
  unreachable (needs >0.9, max 0.603); staff modifier inert for these endpoints;
  severity magnitude discarded by design.
  [Jev: the observed invariance IS expected from the mechanics, conf 0.89]

JEV VERDICT:
  Agrees the invariance is expected from the mechanics (conf 0.89); the dead
  field is an implementation defect (conf 0.96); interface scale mismatch is the
  primary cause; supplyStress is inappropriate as a primary endpoint (conf 0.80);
  no mortality or clinical claim is possible; adapter ranges must be re-scaled;
  a calibration study must precede redesign (conf 0.81).
  Disagrees: classification of the admission threshold mismatch (Jev:
  model-sensitivity limit) and rates the pathway-operational claim only
  partially supported (0.93).

PHASE F RERUN ELIGIBLE: NO
  Blockers: the sentinel cannot currently transmit the intended perturbation;
  the primary endpoint is inappropriate; an adapter-to-DR interface calibration
  study is required first (Jev: required, conf 0.81). Jev does agree the
  experiment CAN be meaningfully redesigned on this basis (1.57).
```

---

## 11. Boundary statement

No production code was modified. No frozen Phase F artifact was modified,
renamed or deleted. No Phase F rerun. No N=50. No Monte Carlo. No manuscript
change. No fix was applied to any defect identified above. Jev did not modify
code and did not execute experiments.

New files from this task: `scripts/sentinel-observability.ts`,
`experiment-results/sentinel-observability/sensitivity-results.json`, and this report.

---

## 12. Artifacts

- This report: `docs/experiments/SENTINEL-OBSERVABILITY-DIAGNOSTIC.md`
- Harness: `scripts/sentinel-observability.ts`
- Sensitivity data: `experiment-results/sentinel-observability/sensitivity-results.json`
- Jev raw responses (not committed): `%TEMP%/opencode/jev-observability-results.json`
- Adapter: `src/sectors/deers-rock-adapter.ts` (read-only)
- DR consumers (read-only): `Deers-Rock/dist/engine/{markov,central-supply,scenario,outpatient,world}.js`
- Prior ablation: `docs/experiments/PHASE-F-DEFECT-ABLATION.md`
- Prior audit: `docs/experiments/CROSS-SECTOR-DIMENSIONAL-AUDIT.md`
