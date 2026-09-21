# Adapter–DR Interface Calibration

**Date:** 2026-09-21
**Objective:** Determine the response characteristics of the existing Deers Rock model to the parameters the sentinel adapter is designed to provide.
**Not the objective:** selecting parameter values that make Phase F produce a desired effect.
**Scope:** Diagnostic only. No production code modified. No adapter mapping changed. No DR threshold changed. No scenario severity changed. No Phase F rerun. No N=50. No Monte Carlo. No GPU.
**Harness:** `scripts/adapter-dr-calibration.ts` · **Data:** `experiment-results/adapter-dr-calibration/calibration-results.json`

---

## 1. Calibration design

Single-variable sweeps. All other inputs held constant. The DR hospital is driven
**directly**, bypassing the Kronos adapter, so the input value is exactly known.

| Setting | Value |
|---|---|
| Hospital | `makassar-001` (Makassar, 133 beds, 50 patients) |
| Seed | world 42 → hospital seed via `getHospitalSeed` |
| Horizon | 20 KE ticks = **200 DR ticks** (`ticksPerDay = 10`) |
| Macro injection | scheduled at `i === 0` of each KE tick, `delayTicks = 0` (adapter-equivalent) |
| Replication | none — deterministic, single seed |
| Compute | CPU |

**Baseline (no macro input):** occupancy 0.5420 · ICU occupancy 0.0357 ·
supplyStress 0.4918 · encounters 156 · cumulative admissions 71 · discharges 0 ·
morgue 0.

### Exact input grid

| Channel | Grid |
|---|---|
| `admissionMultiplier` | 1.00, 1.10, 1.20, 1.30, 1.40, 1.50, 1.60, 1.80, 2.00 — plus fine scan 1.40→1.60 step 0.02 |
| `supplyChainPressure` | 0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 1.00 — plus fine scan 0.400→0.700 step 0.025 |
| `activeDisasterType` | inactive · active (`"natural-disaster"`) |
| `staffAvailabilityModifier` | (measured in the prior diagnostic: 0.85 has no effect on these endpoints) |

---

## 2. Response — admissionMultiplier

| multiplier | occupancy | Δocc | icuOcc | encounters | cumAdm | morgue | supplyStress |
|---|---|---|---|---|---|---|---|
| 1.00 | 0.5420 | 0.0000 | 0.0357 | 156 | 71 | 0 | 0.4918 |
| 1.10 | 0.5420 | 0.0000 | 0.0357 | 156 | 71 | 0 | 0.4918 |
| 1.20 | 0.5420 | 0.0000 | 0.0357 | 156 | 71 | 0 | 0.4918 |
| **1.30** ← adapter | 0.5420 | **0.0000** | 0.0357 | 156 | 71 | 0 | 0.4918 |
| 1.40 | 0.5420 | 0.0000 | 0.0357 | 156 | 71 | 0 | 0.4918 |
| **1.50** | 0.5725 | 0.0305 | 0.0357 | 158 | 75 | 0 | 0.5224 |
| 1.60 | 0.5725 | 0.0305 | 0.0357 | 158 | 75 | 0 | 0.5224 |
| 1.80 | 0.5725 | 0.0305 | 0.0357 | 158 | 75 | 0 | 0.5224 |
| **2.00** | 0.6031 | 0.0611 | 0.0000 | 163 | 79 | 0 | 0.5204 |

**Fine scan (onset localisation):** no change at 1.40, 1.42, 1.44, 1.46, 1.48;
**first change exactly at 1.50**.

### Response function

A **two-step staircase** across the entire [1.00, 2.00+] range:

| Input band | Admissions step | Occupancy |
|---|---|---|
| 1.00 ≤ m < 1.50 | step 0 | 0.5420 |
| 1.50 ≤ m < 2.00 | step 1 | 0.5725 |
| m ≥ 2.00 | step 2 | 0.6031 |

**Mechanism.** `markov.js`: `baseAdmit = floor(rng()*3) ∈ {0,1,2}`;
`scaledAdmit = floor(baseAdmit * multiplier)`; `toAdmit = min(beds, max(1, scaledAdmit))`.
- `baseAdmit = 1` only changes at m ≥ 2.0
- `baseAdmit = 2` changes at m ≥ 1.5
- the `max(1, ·)` floor masks any decrease below m = 1.0

**The adapter supplies 1.30 → step 0 → zero effect, confirmed at every tick.**
Trajectories for m = 1.00 and m = 1.30 are identical at all 20 KE ticks.

---

## 3. Response — supplyChainPressure

| pressure | occupancy | supplyStress | Δsupply | encounters | cumAdm |
|---|---|---|---|---|---|
| 0.00 | 0.5420 | 0.4918 | 0.0000 | 156 | 71 |
| 0.10 | 0.5420 | 0.4918 | 0.0000 | 156 | 71 |
| 0.20 | 0.5420 | 0.4918 | 0.0000 | 156 | 71 |
| 0.30 | 0.5420 | 0.4918 | 0.0000 | 156 | 71 |
| **0.40** ← adapter | 0.5420 | 0.4918 | **0.0000** | 156 | 71 |
| **0.475** | 0.5420 | 0.4736 | −0.0181 | 156 | 71 |
| 0.50 | 0.5420 | 0.2894 | −0.2024 | 156 | 71 |
| **0.525** | 0.5420 | **0.0060** | −0.4857 | 156 | 71 |
| 0.60–1.00 | 0.5420 | 0.0060 | −0.4857 | 156 | 71 |

**Fine scan:** identical through 0.450; first change at **0.475**; saturated by
**0.525**.

### Response function

| Input band | Response |
|---|---|
| 0.00 ≤ p ≤ 0.45 | **dead zone** — supplyStress 0.4918 |
| 0.45 < p < 0.525 | **narrow responsive band** — 0.4918 → 0.0060 |
| p ≥ 0.525 | **saturated floor** — supplyStress 0.0060 |

**Mechanism.** `central-supply.js`: restock **only** when `clock.tick % 50 === 0`;
`effectiveMin = minStock + (maxStock − minStock) × pressure`; restock if
`stock < effectiveMin`. The initial stock is `(min+max)/2` (depletion 0.5), so a
threshold below the realised depletion at the restock tick does nothing.

**The adapter supplies 0.40 → dead zone → zero effect.**

### Delay

supplyStress trajectories are **identical for p = 0.0, 0.4, 0.5 and 1.0 for KE
ticks 1–14**, diverging only at **KE tick 15** (DR tick 150 — a `%50` boundary):

```
keTick:  1      5      10     14     15      16     20
p=0.0:   0.5012 0.5064 0.5129 0.5180 0.4857  0.4869 0.4918
p=0.4:   0.5012 0.5064 0.5129 0.5180 0.4857  0.4869 0.4918
p=0.5:   0.5012 0.5064 0.5129 0.5180 0.2833  0.2845 0.2894
p=1.0:   0.5012 0.5064 0.5129 0.5180 0.0000  0.0011 0.0060
```

The channel is **structurally delayed to restock boundaries** (KE ticks 5, 10,
15, 20) and then produces a **step**, not a gradient.

---

## 4. Response — activeDisasterType

| case | scenario | severity | phase | occupancy | icuOcc | encounters | supplyStress |
|---|---|---|---|---|---|---|---|
| inactive | — | — | — | 0.5420 | 0.0357 | 156 | 0.4918 |
| active | **earthquake** | **0.6** | sustained | 0.5496 | **0.0714** | 160 | 0.5199 |

Scenario activates at **KE tick 1** via `mapMacroDisasterToScenario("natural-disaster") → "earthquake"`.

**Categorical channel:** only the event *type* is transmitted. The magnitude is
not — severity is a hardcoded constant. ICU occupancy **doubles**; this is the
only endpoint that responds substantially.

---

## 5. Thresholds, quantisation, saturation, delay — summary

| Channel | Lower threshold | Responsive region | Saturation | Quantisation | Delay |
|---|---|---|---|---|---|
| `admissionMultiplier` | **1.50** | 1.50 – 2.00+ | 2 discrete steps | **2 steps** over [1.0, 2.0+] | none |
| `supplyChainPressure` | **0.475** | 0.475 – 0.525 | floor at 0.0060 | effectively continuous within a 0.05 band | **to restock boundaries** (KE ticks 5/10/15/20) |
| `activeDisasterType` | categorical | type only | fixed severity 0.6 | **categorical** | scenario ramps over its duration |
| `staffAvailabilityModifier` | — | none on these endpoints | — | — | — |

**Adapter values vs thresholds:** multiplier **1.30 < 1.50** (dead zone);
pressure **0.40 < 0.475** (dead zone). Both continuous channels transmit
**exactly zero** information at the values the adapter supplies.

---

## 6. Information-loss analysis

```
adapter input  ->  DR transformation  ->  hospital state  ->  sentinel output
```

| Channel | Transmission class | Effective information loss |
|---|---|---|
| `admissionMultiplier` | **quantised** | continuous input → **2 discrete admission steps**; everything below 1.5 discarded; `max(1, ·)` discards all decreases |
| `supplyChainPressure` | **thresholded** | dead below 0.45; compresses a 0.075-wide band; saturates above 0.525; sampled only at `%50` boundaries |
| `activeDisasterType` | **categorical** | type → scenario type; **all magnitude discarded** |
| `staffAvailabilityModifier` | **discarded** (for these endpoints) | no effect on occupancy / ICU / supplyStress / encounters |
| `diagnosisWeightOverrides` | **discarded** | never leaves the adapter |
| climate event `severity` | **discarded** | never read by the adapter |
| `mortalityPressure` | **structurally absent** | morgue empty in every case |
| `admissionSurge` | **threshold-unreachable** | needs occupancy > 0.9; max observed 0.6031 |

---

## 7. Dead-field verification (Phase D)

`diagnosisWeightOverrides`:

| Stage | Evidence |
|---|---|
| declared | `deers-rock-adapter.ts:23` (`MacroConditionPacket`) |
| initialised | `:158` |
| populated | `:169` `J00-J99 = 1.3` · `:175` `S00-T88 = 1.5` · `:181` `I00-I99 = 1.15` |
| returned | `:189` |
| **consumed** | **none** — adapter tick schedules only the 4 macro events (`:299-311`); repository-wide search finds **zero references** on the Deers Rock side |

**Classification: DEAD INTERFACE FIELD.** Repository evidence confirms and does not
contradict this.

**Note.** The DR model *does* have an ICD-weight mechanism
(`getScenarioEffects` returns `def.icdWeights`), but it is driven by
`SCENARIO_DEFS`, not by any adapter input. The adapter's override duplicates an
existing DR capability that is not wired to it.

---

## 8. Severity semantics (Phase E)

**Code-grounded facts:**

| Fact | Source |
|---|---|
| DR scenario severity is a **normalised interpolation parameter** | `surgeForPhase`: `surgeMultiplier = surgeMin + (surgeMax − surgeMin) × severity` |
| Per-scenario surge range | `SCENARIO_DEFS`, e.g. earthquake `surgeMin 3, surgeMax 6` |
| DR's **own native** severity sampling | `scenario.js:152`: `severity = 0.3 + rng() × 0.7` → **[0.3, 1.0]** |
| Macro override severity | `scenario.js:127`: **hardcoded 0.6** |
| Kronos climate severity | `climate.ts:152`: `1 + rng×4 + temperatureAnomaly×0.5` → **unbounded magnitude** (intended ~1–7.5; observed ~30 under the coupling defect) |
| Adapter reads climate severity? | **No** — `buildMacroPacket` switches on event *type* only |

**Why is severity hardcoded at 0.6?** The code comment states the intent:
*"Fixed severity for macro-disaster: deterministic, moderate (0.6)."* It is a
**deliberate determinism choice** for the macro-override path, not an accident.

**Does 0.6 represent a canonical scenario assumption?** 0.6 lies inside the DR
model's own native sampling range [0.3, 1.0] and near its midpoint, so it is
*consistent with* the model's distribution. However, no specification documents it
as canonical. **KE reads it as a mid-range assumption; Jev reads it as an
arbitrary constant (score 0.35). This is an unreconciled difference.**

**Is there a variable severity input elsewhere?** **Yes** — `severity` is a
first-class parameter of the DR scenario model, used by both the native spawner
and the macro override, and consumed by `surgeForPhase` and `getScenarioEffects`.

**Would changing it alter the model contract?** It would not break the DR
contract — severity is already variable by design. But transmitting the Kronos
climate severity into it **would repeat the unit-error class**: the DR field is
normalised [0,1]; the climate value is an unbounded magnitude. A **normalisation
mapping** would be required, which is a **modelling decision**, not a bug fix.

**No new severity mapping is selected here.**

---

## 9. Jev adversarial review

Jev (`jev-1.13.0`) was given the measured curves and the implementation semantics.
3 question sets, 23 questions.

### 9.1 Calibration validity and semantics

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Does the admission sweep truly isolate that input? | 1.49 | **Partially** | 0.24 `[low]` |
| Does the pressure sweep truly isolate that input? | 1.13 | **Partially** | 0.45 |
| Does the disaster test truly isolate that input? | 1.28 | **Partially** | 0.16 `[low]` |
| Is the 1.5 admission threshold implementation behaviour? | 1.87 | **Implementation behaviour** | 0.81 |
| Is the 0.475 pressure threshold implementation behaviour? | 1.74 | **Implementation behaviour** | 0.60 |
| Is severity 0.6 a canonical assumption? | 0.35 | **Arbitrary constant** | 0.47 |
| Would transmitting climate severity be dimensionally compatible? | 1.81 | **Incompatible — would repeat the unit-error class** | 0.72 |
| Is the 2-step admission staircase genuine quantisation? | 1.94 | **Genuine quantisation** | 0.91 |
| Is the restock-boundary delay genuine? | 1.98 | **Yes** | 0.96 |

### 9.2 Adapter vs model, and tuning

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Should the adapter's output values be changed? | 0.14 | **No** | 0.79 |
| Should the DR model's thresholds be changed instead? | 0.40 | **No** | 0.40 |
| Would raising adapter values purely because they produce effects be outcome-driven tuning? | 1.99 | **Yes** | 0.98 |
| Can a non-outcome-driven justification be constructed? | 1.32 | **Partially** | 0.00 `[low]` |
| Do the DR thresholds constitute a de facto interface contract? | 0.77 | **Partially** | 0.13 `[low]` |
| Does the dead field matter to the intended experiment? | 0.56 | **Partially** | 0.16 `[low]` |
| Should severity be wired through now? | 1.00 | **Requires prior modelling decision** | 1.00 |

### 9.3 Interpretability and next steps

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Can the current sentinel support an interpretable experiment? | 0.22 | **No** | 0.68 |
| Is the achievable response range adequate? | 0.46 | **No** | 0.31 |
| Are additional calibration dimensions required? | 1.92 | **Yes** | 0.88 |
| Must calibration precede any mapping decision? | 1.78 | **Yes** | 0.67 |
| Would any mapping need an explicitly declared modelling assumption? | 1.94 | **Yes** | 0.91 |
| Is this calibration sufficient for a go/no-go decision? | 0.85 | **Partially** | 0.38 |

### 9.4 Where Jev agrees / disagrees with KE

**Agrees:**
- The 1.5 admission and 0.475 pressure thresholds are **implementation
  behaviour**, not intended semantics (conf 0.81 / 0.60).
- The admission staircase is **genuine quantisation** (conf 0.91).
- The restock-boundary delay is **genuine** (conf 0.96).
- Transmitting climate severity would **repeat the unit-error class** (conf 0.72).
- **Changing adapter values purely to produce effects is outcome-driven tuning**
  (conf 0.98) — the strongest verdict in this review.
- Wiring severity **requires a prior modelling decision** (conf 1.00).
- **The current sentinel cannot support an interpretable experiment** (conf 0.68).
- **Additional calibration dimensions are required** (conf 0.88).
- **A declared modelling assumption is required** for any mapping (conf 0.91).

**Disagrees / qualifies:**
- **Severity 0.6:** KE reads it as a canonical mid-range assumption (it lies in
  the model's native [0.3, 1.0] sampling range); **Jev calls it an arbitrary
  constant** (0.35). Unreconciled.
- **Neither change is endorsed.** Jev says **not** to change the adapter (0.14)
  **and not** to change the DR model (0.40). KE's framing had leaned toward the
  adapter's ranges being the defect; Jev declines to assign the change to either
  side without a declared assumption.
- **Isolation is only partial.** Jev rates all three sweeps "partially" isolating
  (conf 0.16–0.45) — the channels are not fully independent (admissions shift
  supplyStress; the pressure channel is time-coupled to restock boundaries).
- **Calibration sufficiency** is only "partially" established (0.85).

---

## 10. Implications for the adapter contract

1. **The adapter's continuous outputs lie in the DR model's dead zones.** This is
   an **interface contract failure** in the descriptive sense: the values emitted
   cannot be resolved by the receiving model. Jev characterises the thresholds as
   "implementation behaviour" and is only "partial" on calling them a contract.
2. **The contract is not documented anywhere.** There is no written statement of
   the expected input range for `admissionMultiplier` or `supplyChainPressure`.
   That absence is why the mismatch went undetected.
3. **The severity channel is dimensionally incompatible** as currently wired —
   DR expects normalised [0,1], Kronos produces an unbounded magnitude. Any
   wiring must include an explicit normalisation with a declared assumption.
4. **One dead field** (`diagnosisWeightOverrides`) — declared, populated,
   returned, never consumed.
5. **The achievable response ceiling is low.** Even at the top of the responsive
   regions, occupancy moves ~6 pp; from the adapter's current values it moves
   0.76 pp.

---

## 11. Recommendation — is a corrected Phase F technically possible?

**Not on the current interface.** The blockers are:

1. Both continuous channels are dead at the adapter's supplied values.
2. The primary endpoint (`supplyStress`) is inappropriate (prior diagnostic).
3. The one effective channel is categorical and magnitude-free.
4. The severity channel is dimensionally incompatible without a normalisation
   decision.
5. Additional calibration dimensions are required (Jev 1.92, conf 0.88).

**What must precede any mapping change** (and what must *not* justify it):

**Permitted justifications** — model semantics; dimensional consistency; a
documented interface contract; an explicitly declared modelling assumption.

**Prohibited justification** — "this value produced a significant Δ."

Jev's verdict is unambiguous on this point: raising adapter values because they
produce measurable effects **would be outcome-driven tuning** (conf 0.98).

**Therefore:** no adapter value is proposed here. The next legitimate step is a
**declared interface specification** — a written statement of the intended input
range and semantics for each adapter→DR channel, justified from the DR model's
own behaviour (as measured here) and from dimensional consistency — followed by
a **mapping decision** made against that specification, not against observed
effect sizes.

---

## 12. Final status

```text
ADAPTER-DR CALIBRATION:
  COMPLETE. Three single-variable sweeps with fine-scan onset localisation.
  20 KE ticks (200 DR ticks), 50 patients, deterministic, CPU only.
  Harness: scripts/adapter-dr-calibration.ts
  Data: experiment-results/adapter-dr-calibration/calibration-results.json
  No production code modified. No mapping changed. No threshold changed.
  No scenario severity changed. No Phase F rerun. No N=50. No Monte Carlo. No GPU.

ADMISSION RESPONSE:
  TWO-STEP STAIRCASE. Lower threshold EXACTLY 1.50 (fine scan: no change at
  1.40-1.48, first change at 1.50).
    1.00 <= m < 1.50  -> step 0, occupancy 0.5420
    1.50 <= m < 2.00  -> step 1, occupancy 0.5725
    m >= 2.00         -> step 2, occupancy 0.6031
  Mechanism: floor(baseAdmit * m) with baseAdmit = floor(rng()*3) in {0,1,2};
  max(1, .) masks all decreases.
  Adapter supplies 1.30 -> step 0 -> ZERO effect, confirmed at every tick.

SUPPLY RESPONSE:
  NARROW BAND + SATURATION. Lower threshold 0.475.
    0.00 <= p <= 0.45   -> dead zone, supplyStress 0.4918
    0.45 < p < 0.525    -> responsive, 0.4918 -> 0.0060
    p >= 0.525          -> saturated floor 0.0060
  Mechanism: restock only at clock.tick % 50 === 0; effectiveMin = min + range*p.
  Delay: identical for p=0.0/0.4/0.5/1.0 through KE tick 14; divergence only at
  KE tick 15 (a restock boundary). Response is a STEP, not a gradient.
  Adapter supplies 0.40 -> dead zone -> ZERO effect.

DISASTER RESPONSE:
  CATEGORICAL AND EFFECTIVE, BUT MAGNITUDE-FREE.
  "natural-disaster" -> earthquake scenario, active from KE tick 1, severity
  hardcoded 0.6. Occupancy 0.5420 -> 0.5496; ICU occupancy 0.0357 -> 0.0714
  (doubles); encounters 156 -> 160. This is the ONLY effective channel.

INFORMATION LOSS:
  admissionMultiplier      -> QUANTISED   (continuous input -> 2 steps)
  supplyChainPressure      -> THRESHOLDED (dead <0.45, saturates >0.525,
                                           sampled only at %50 boundaries)
  activeDisasterType       -> CATEGORICAL (all magnitude discarded)
  staffAvailabilityModifier-> DISCARDED   (no effect on these endpoints)
  diagnosisWeightOverrides -> DISCARDED   (never leaves the adapter)
  climate event severity   -> DISCARDED   (never read by the adapter)
  mortalityPressure        -> STRUCTURALLY ABSENT (morgue empty in every case)
  admissionSurge           -> THRESHOLD-UNREACHABLE (needs >0.9, max 0.6031)

DEAD FIELDS:
  CONFIRMED: diagnosisWeightOverrides - declared (:23), initialised (:158),
  populated (:169/:175/:181), returned (:189), NEVER consumed (zero references
  on the Deers Rock side; the adapter schedules only the 4 macro events).
  Classification: DEAD INTERFACE FIELD. Repository evidence confirms.
  Note: DR has its own ICD-weight mechanism via SCENARIO_DEFS.icdWeights, not
  wired to any adapter input.

SEVERITY SEMANTICS:
  DR scenario severity is a NORMALISED interpolation parameter in [0,1]:
  surgeMultiplier = surgeMin + (surgeMax - surgeMin) * severity.
  DR's own native spawning samples severity = 0.3 + rng()*0.7 -> [0.3, 1.0].
  The macro override hardcodes 0.6 (comment: "deterministic, moderate").
  A variable severity input DOES exist elsewhere - severity is a first-class
  scenario parameter.
  Changing it would NOT break the DR contract, but transmitting the Kronos
  climate severity directly WOULD repeat the unit-error class: DR expects
  normalised [0,1]; climate severity is an unbounded magnitude (~1-7.5 intended,
  ~30 under the defect). A normalisation mapping would be a MODELLING DECISION.
  [Jev: incompatible without normalisation, conf 0.72; requires prior modelling
  decision, conf 1.00]
  UNRECONCILED: KE reads 0.6 as a canonical mid-range assumption (it lies in the
  model's native sampling range); Jev reads it as an arbitrary constant (0.35).

JEV VERDICT:
  Agrees: the 1.5 and 0.475 thresholds are implementation behaviour (conf 0.81 /
  0.60); the admission staircase is genuine quantisation (0.91); the
  restock-boundary delay is genuine (0.96); transmitting climate severity would
  repeat the unit-error class (0.72); raising adapter values because they produce
  effects WOULD BE outcome-driven tuning (conf 0.98); wiring severity requires a
  prior modelling decision (conf 1.00); the current sentinel CANNOT support an
  interpretable experiment (conf 0.68); additional calibration dimensions are
  required (conf 0.88); a declared modelling assumption is required (conf 0.91).
  Disagrees/qualifies: severity 0.6 is an arbitrary constant (Jev) vs a canonical
  mid-range assumption (KE); Jev declines to assign the fix to either the adapter
  (0.14) or the DR model (0.40); all three sweeps isolate only PARTIALLY
  (conf 0.16-0.45); calibration sufficiency only partial (0.85).

MAPPING CHANGE JUSTIFIED: NO
  No adapter value is proposed. Any future mapping must be justified from model
  semantics, dimensional consistency, a documented interface contract, or an
  explicitly declared modelling assumption - never from observed effect size.
  The immediate prerequisite is a written interface specification, not a
  parameter choice.

PHASE F RERUN ELIGIBLE: NO
  Blockers: both continuous channels are dead at the adapter's supplied values;
  the primary endpoint is inappropriate; the one effective channel is
  magnitude-free; the severity channel is dimensionally incompatible without a
  normalisation decision; further calibration dimensions are required.
```

---

## 13. Boundary statement

No production code was modified. No adapter mapping was changed. No DR threshold
was changed. No scenario severity was changed. No frozen Phase F artifact was
modified, renamed or deleted. No Phase F rerun. No N=50. No Monte Carlo. No
manuscript change. No Modal GPU. Jev did not modify code and did not execute
experiments.

New files from this task: `scripts/adapter-dr-calibration.ts`,
`experiment-results/adapter-dr-calibration/calibration-results.json`, and this report.

---

## 14. Artifacts

- This report: `docs/experiments/ADAPTER-DR-CALIBRATION.md`
- Harness: `scripts/adapter-dr-calibration.ts`
- Calibration data: `experiment-results/adapter-dr-calibration/calibration-results.json`
- Jev raw responses (not committed): `%TEMP%/opencode/jev-calibration-results.json`
- Prior diagnostic: `docs/experiments/SENTINEL-OBSERVABILITY-DIAGNOSTIC.md`
- Prior ablation: `docs/experiments/PHASE-F-DEFECT-ABLATION.md`
- DR sources (read-only): `Deers-Rock/dist/engine/{markov,central-supply,scenario,outpatient,world}.js`
