# Phase F — Three-Edge Causal Ablation

**Date:** 2026-09-21
**Scope:** Causal ablation of the three confirmed Phase F defect edges. Diagnostic only.
**Status:** ABLATION COMPLETE — no production coupling modified, no frozen artifact modified, no Phase F rerun, no N=50, no Monte Carlo, no GPU.
**Harness:** `scripts/phase-f-ablation.ts` · **Artifacts:** `experiment-results/phase-f-ablation/ablation-results.json`

---

## 1. Method — how ablation was achieved without touching production

The engine applies cross-sector handlers in `applyCrossSectorEvents`
(`world-engine.ts:70`): it iterates `record.sector.handlers` and calls
`handler.handle(event, record.state)` when `handler.eventType` matches the
published event.

Ablation is therefore performed by **filtering the targeted handler out of the
sector instance's `handlers` array**, on instances returned by the sector
factories. Production source is not modified; no production file is edited.

Each ablated edge maps to exactly one handler:

| Edge | Sector instance | Handler removed |
|---|---|---|
| economy → climate emissions | climate | `ECONOMY_EVENTS.GDP_SHIFT` |
| economy → technology `rdAdjustment` | technology | `ECONOMY_EVENTS.GDP_SHIFT` |
| climate severity → economy GDP damage | economy | `CLIMATE_EVENTS.EXTREME_WEATHER` |

Handlers **not** removed (deliberately left active): climate `WAR_START`,
economy `WAR_START` / `WAR_CASUALTIES` / `INNOVATION`, geopolitics
`EXTREME_WEATHER` (relations shift).

`rdAdjustment` was measured by wrapping the technology handler with a
diagnostic recorder that delegates to the original — instrumentation only.

### Ablation matrix

| ID | Definition | climateEdge | techEdge | severityEdge |
|---|---|---|---|---|
| A0 | original (all edges active) | – | – | – |
| A1 | climate edge ablated | ✓ | | |
| A2 | technology edge ablated | | ✓ | |
| A3 | severity→GDP ablated | | | ✓ |
| A4 | all three ablated | ✓ | ✓ | ✓ |
| A12 | climate + technology | ✓ | ✓ | |
| A13 | climate + severity→GDP | ✓ | | ✓ |
| A23 | technology + severity→GDP | | ✓ | ✓ |

### Seed manifest

`42, 43, 44, 45, 46` (canonical Phase F seeds, for continuity) **+ `137`**
(seed-robustness probe). Horizon **20 KE ticks** (matches frozen Phase F).
Control CO₂ = 280. **8 ablations × 6 seeds = 48 deterministic world-runs.**
Execution 47.3 s, CPU only.

---

## 2. Terminal trajectories (tick 20, seed 42)

```
abl | co2      | anomaly | chance | weather | sevMax | gdpTotal  | gdpFloor | techLvl max/mean | ceil | rdAdjSum
A0  | 1.36e+8  |  56.68  | 0.500  |    8    |  30.2  | 7.36e+10  |    0     |  100 / 100.0     |  11  | 4.74e+10
A1  | 3.23e+2  |   0.61  | 0.071  |    0    |   0.0  | 6.79e+13  |    0     |  100 / 100.0     |  11  | 1.41e+11
A2  | 1.24e+8  |  56.29  | 0.500  |    7    |  31.2  | 1.58e+11  |    0     |   90 /  72.0     |   0  | 0.00e+0
A3  | 2.70e+8  |  59.64  | 0.500  |    8    |  30.8  | 6.88e+13  |    0     |  100 / 100.0     |  11  | 1.53e+11
A4  | 3.23e+2  |   0.61  | 0.071  |    1    |   4.5  | 6.90e+13  |    0     |   90 /  72.2     |   0  | 0.00e+0
A12 | 3.23e+2  |   0.61  | 0.071  |    1    |   4.5  | 6.28e+13  |    0     |   90 /  72.2     |   0  | 0.00e+0
A13 | 3.23e+2  |   0.61  | 0.071  |    0    |   0.0  | 6.79e+13  |    0     |  100 / 100.0     |  11  | 1.41e+11
A23 | 2.58e+8  |  59.43  | 0.500  |    7    |  32.5  | 6.82e+13  |    0     |   90 /  72.0     |   0  | 0.00e+0
```

Full per-tick trajectories for all 48 runs: `experiment-results/phase-f-ablation/ablation-results.json`
(measured: CO₂, anomaly, eventChance, weather total, severity max/mean, GDP total,
GDP delta, growth-rate mean/max, GDP floor hits, rdAdjustment, researchOutput,
technologyLevel max/mean, technology ceiling hits, admission multiplier,
supply-chain pressure, active disaster, occupancy, supplyStress, admissionSurge).

---

## 3. Primary causal questions

### Q1 — Does removing the economy→climate edge prevent CO₂ runaway?
**Yes — strongly supported.**

| | A0 | A1 |
|---|---|---|
| final CO₂ (6 seeds) | 8.89e7 … 1.62e8 | **3.23e2 (all seeds)** |
| eventChance reaches 0.5 | tick 4 (all seeds) | **never** |

A1 CO₂ = 322.7 ppm = 280 + 2.135 × 20 — exactly the baseline emissions
trajectory. The climate edge fully accounts for the runaway.

### Q2 — Does removing the technology edge prevent saturation, independently of climate?
**Yes — strongly supported, and the two are independent.**

| | technology ceiling hits | first saturation tick |
|---|---|---|
| A0 | 11/11 nations, all seeds | 5 |
| A1 (climate ablated, technology **active**) | **11/11, all seeds** | **5** |
| A2 (technology ablated) | 0 | never |
| A4 | 0 | never |

**Ablating the climate edge does not touch technology saturation.** A1 reproduces
A0's technology outcome exactly. Technology saturation is driven solely by the
economy→technology edge.

### Q3 — Does removing severity→GDP prevent the GDP collapse, independently of climate?
**Yes for the outcome; partially for the attribution.**

| | final GDP | GDP floor hits |
|---|---|---|
| A0 | 4.47e9 … 8.60e10 | [0,11,9,0,9,10] |
| A3 | 5.46e13 … 6.88e13 | **0 in all seeds** |
| A1 | 5.16e13 … 6.79e13 | 0 |

A3 restores GDP **while CO₂ still runs away to 2.70e8 and severity stays at 30.8.**
So the GDP collapse is caused by the severity→GDP edge, not directly by the
climate edge. However the severity *magnitude* is climate-driven (see Q4), so the
edge is **triggered by** climate. Attribution is "partially isolated" — outcome
separable, trigger not.

### Q4 — Does ablating one edge alter another edge's behaviour?
**Yes — a material feedback loop exists.**

**A3 CO₂ (2.70e8) is roughly double A0 CO₂ (1.36e8).** A23 CO₂ (2.58e8) behaves
the same. Removing the severity→GDP edge **increases** CO₂.

Mechanism: severity→GDP destroys GDP → the economy shrinks → published
`gdpDelta` shrinks → the climate emissions edge receives less input → CO₂ is
*lower* in A0 than it would be. So the climate edge's magnitude depends on the
severity edge via economy size.

Also: severityMax tracks climate, not technology — A0 30.2–33.0, A2 (technology
ablated) 31.2, A1 (climate ablated) 0.0–4.9.

### Q5 — Is the all-three-ablation world numerically stable?
**Yes.**

A4 across all 6 seeds: CO₂ 322–323 ppm; anomaly 0.611–0.623; weather 0–2;
severityMax 0.0–5.0; GDP 6.74e13–6.90e13; growth-rate mean 2.34–3.22;
technologyLevel mean 72.1–72.3. No runaway, no floor hits, no ceiling hits.
(GDP growth over 20 KE ticks with economy cadence 3 ≈ 1.025^6.67 = 1.18,
consistent with observed 5.83e13 → ~6.8e13.)

---

## 4. Causal attribution

```
Defect            Observed phenotype (A0)        Ablation result              Δ from A0                    Attribution
----------------  -----------------------------  ---------------------------  ---------------------------  ---------------------------
climate edge      CO2 8.9e7-1.6e8, sat tick 4     A1: CO2 323, never saturates  runaway eliminated           ISOLATED (strong)
tech edge         11/11 at ceiling by tick 5     A2: 0 ceiling hits            saturation eliminated        ISOLATED (strong)
severity->GDP     GDP 4.5e9-8.6e10, floors      A3: GDP 5.5e13-6.9e13         collapse eliminated          PARTIALLY ISOLATED
                                                                                                             (outcome separable,
                                                                                                              trigger is climate-
                                                                                                              dependent)
```

| Attribution | Classification |
|---|---|
| Climate edge causes CO₂ runaway | **isolated / strongly supported** |
| Technology edge causes technology saturation | **isolated / strongly supported** |
| Technology defect is independent of climate | **isolated / strongly supported** |
| Severity→GDP causes GDP collapse | **partially isolated** (trigger confounded with climate) |
| Climate edge magnitude independent of severity edge | **confounded** — the feedback loop prevents it |

**Explicit non-claim:** the three edges are **not** fully independent. The
severity→GDP edge is *downstream* of the climate edge (it is triggered by
climate-driven severity), and the climate edge's *magnitude* is modulated by the
severity edge through economy size. Two of the three are cleanly separable in
their **outcomes**; none are separable in their **triggers**.

---

## 5. Interaction observations

| Observation | Reading |
|---|---|
| A1 reproduces A0's technology saturation exactly (11/11 at tick 5) | technology edge is orthogonal to climate |
| A13 (climate+severity ablated) still shows 11/11 ceiling hits | confirms orthogonality |
| A12 (climate+technology ablated) shows 0 ceiling hits | confirms the technology edge is the sole cause |
| A3 CO₂ (2.70e8) ≈ 2× A0 CO₂ (1.36e8) | negative feedback: GDP destruction suppresses emissions |
| A23 CO₂ 2.58e8 | same feedback, technology edge irrelevant to it |
| severityMax tracks climate edge only | severity is climate-driven |

The pairwise runs were necessary: A12 and A13 are what establish that technology
saturation is orthogonal to both other edges. Jev agreed pairwise combinations
were required (1.65).

---

## 6. Severity-bound investigation

**Formula:** `severity = round((1 + rng*4 + temperatureAnomaly*0.5) * 10) / 10`

| Question | Finding |
|---|---|
| Intended range | anomaly 0 … 4.555 for CO₂ 280 … 800 ⇒ **severity 1 … 5.28** |
| Is `temperatureAnomaly` dimensionless? | Nominally °C, but used as a plain scalar in this formula; it is computed as `3 * log2(co2/280)` and is never bounded |
| Is `temperatureAnomaly` supposed to be bounded? | **Yes, implicitly** — the formula's design range assumes a physically plausible anomaly. There is no bound in code |
| Observed under A0 (runaway) | anomaly 54.8 … 57.4 ⇒ severity **30.2 … 33.0** |
| Observed under A1 (climate ablated) | anomaly 0.612 … 0.618 ⇒ severity **0.0 … 4.9** — back inside the intended range |
| Under corrected climate coupling | anomaly ≈ 0.6 (control) to ≈ 4.6 (intervention CO₂ 800) ⇒ severity ≈ 1 … 7.3, i.e. **intended range** |

**Conclusion.** The severity formula does **not** require a clamp. Once the
upstream climate coupling is corrected, severity returns to its intended range
automatically. The severity anomaly is **solely upstream runaway**, not a defect
in the severity formula itself.

Per instruction, **no clamp value is chosen** — a clamp would be a modelling
decision, not a bug fix, and the evidence does not require one.

---

## 7. Unresolved confounding

1. **Feedback loop is irreducible in this design.** Climate → severity → GDP →
   economy size → `gdpDelta` → climate emissions. No ablation removes a single
   direction without altering the other. Jev: "hidden feedback paths present"
   (1.62).
2. **Uncontrolled geopolitics edge.** The geopolitics `EXTREME_WEATHER` relations
   handler was deliberately left active. Jev rates this a **minor threat** (0.77)
   but it is not controlled.
3. **Q3 attribution confidence is very low.** Jev scored the severity→GDP
   independence claim "partially" justified at confidence **0.06**.
4. **Hospital sentinel is nearly insensitive.** `supplyStress` = **0.492 in every
   ablation including A0**; `occupancyRate` 0.534 (A0) vs 0.542 (A1/A4). The
   sentinel appears driven by DR-internal dynamics rather than macro state. Jev
   rates this a **moderate concern** for the corrected experiment's ability to
   detect an effect (1.39, but confidence 0.09). **This is unresolved and
   materially affects whether a corrected Phase F can detect anything.**
5. **Single horizon, single CO₂ level.** All runs use CO₂ = 280 and H = 20.
   Whether the feedback loop behaves the same at the intervention level
   (CO₂ = 800) is untested.
6. **Non-instantiated sectors** (energy, demographics) remain unaudited
   empirically.

---

## 8. Jev review of the measured results

Jev (`jev-1.13.0`) was given the **measured trajectories**, not KE's
interpretation. 4 question sets, 23 questions.

### 8.1 Ablation validity

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Does A1 isolate the climate edge? | 1.89 | **Yes / justified** | 0.83 |
| Does A2 isolate the technology edge? | 1.88 | **Yes / justified** | 0.81 |
| Does A3 isolate the severity→GDP edge? | 1.63 | Yes / justified | 0.45 |
| Do hidden feedback paths remain? | 1.62 | **Hidden paths present** | 0.43 |
| Is the uncontrolled geopolitics relations edge a threat? | 0.77 | Minor threat | 0.00 |

### 8.2 Causal attribution

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Q1 attribution justified | 1.92 | **Yes** | 0.87 |
| Q2 attribution (technology independence) justified | 1.70 | **Yes** | 0.55 |
| Q3 attribution justified | 1.37 | **Partially** | 0.06 `[low]` |
| Q4 feedback interpretation justified | 0.90 | **Partially** | 0.41 |
| Q5 stability conclusion justified | 1.75 | **Yes** | 0.63 |
| Is KE's non-separability caveat adequate? | 1.44 | **Slightly understates** | 0.17 |

### 8.3 Interactions and downstream dependence

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Is the technology defect downstream of climate? | 1.75 | **Independent** | 0.63 |
| Is the severity→GDP edge downstream of climate? | 0.07 | **Downstream of another defect** | 0.89 |
| Does CO₂ depend on economy size (feedback confirmed)? | 1.72 | **Yes** | 0.58 |
| Is the A3 > A0 CO₂ result explained? | 0.49 | Fully explained | 0.27 `[low]` |
| Were pairwise combinations necessary? | 1.65 | **Yes** | 0.48 |

### 8.4 Corrected model architecture

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Does the severity formula need a clamp? | 2.00 | **Solely upstream — no clamp needed** | 0.99 |
| Is bounding upstream sufficient to keep severity in range? | 1.98 | **Yes** | 0.97 |
| Is a systematic (not per-instance) correction warranted? | 1.98 | **Yes** | 0.97 |
| Additional structural changes needed beyond the three edges? | 0.51 | Some changes needed | 0.24 `[low]` |
| Is sentinel insensitivity a concern? | 1.39 | Moderate concern | 0.09 `[low]` |
| Is the corrected model ready to design and run? | 0.83 | **Partially ready** | 0.59 |

### 8.5 Where Jev agrees / disagrees

**Agrees:** all three ablations isolate their named edges; Q1 and Q2 attributions
justified; technology is **independent** of climate (0.63); severity→GDP is
**downstream** of climate (0.89); the feedback loop is real; pairwise runs were
necessary; **no severity clamp needed** (0.99); a systematic correction is
warranted (0.97); A4 is stable.

**Disagrees / qualifies:**
- Q3 attribution only **partially** justified (conf 0.06) — Jev does not accept
  the severity→GDP independence as fully established.
- Q4 feedback interpretation only **partially** justified.
- KE's non-separability caveat **slightly understates** the coupling.
- Hidden feedback paths **remain**.
- The corrected model is only **partially ready**.
- The **sentinel insensitivity** is a moderate concern (low confidence).

---

## 9. Provenance repair plan (separate action — not performed here)

Frozen Phase F remains untouched. This is a **plan only**.

| Step | Action | Rationale |
|---|---|---|
| 1 | Identify the **producing commit SHA** for the Phase F artifact set | `manifest.json` records a `keCommit` field; it must be verified against the actual producing commit, and the manifest must itself be committed so the reference is durable |
| 2 | Generate a **content-hash manifest** over every artifact in `experiment-results/phase-f/` (results.json, statistical-summary.json, manifest.json, report.md, v1-invalid-stale-dist/*) and `docs/PHASE-F-DESIGN.md` | Detects later mutation; the current `manifest.json` hashes outputs but is itself uncommitted and unhashed |
| 3 | **Commit** the artifact set and the content-hash manifest | Without a commit SHA the artifacts have no durable identity and no hash is attributable |
| 4 | Record the **commit/reference relationship** — producing commit SHA inside the manifest, and the manifest inside that commit | Closes the loop: artifact → hash → commit → manifest |
| 5 | **Timestamp** — rely on the git commit date as the minimum; add an external anchor only if the evidence is to be relied on outside the project | Git dates are self-asserted; an external anchor adds third-party non-repudiation |
| 6 | Optionally place a **tag/branch** at the frozen commit | Discoverability only; a tag is movable and adds no integrity beyond the SHA |

**KE's minimum auditable mechanism:** steps 1–4. Steps 5 (external anchor) and 6
(tag) are recommended, not required for internal auditability.

**Explicitly excluded:** no retroactive alteration of the scientific result; no
editing of any frozen artifact; no rewrite of history.

---

## 10. Recommendation for corrected model architecture

1. **Correct the three edges as one systematic class**, not as three patches. The
   class is *dimensionless/percentage scalar × raw USD delta → differently scaled
   field*. A single reconciliation convention (explicit unit bridge at every
   cross-sector boundary) should be applied. Jev: systematic correction warranted
   (0.97).
2. **Do not clamp severity.** Bound the upstream climate coupling instead; this
   restores severity to its intended range automatically (Jev 0.99/0.97).
3. **Address the feedback loop explicitly.** Because economy size feeds back into
   the climate edge, the corrected model should either (a) document the loop as
   intended model behaviour, or (b) break it with an explicit unit bridge so that
   emissions respond to a *physical* emissions quantity rather than to a raw
   monetary delta.
4. **Resolve the sentinel insensitivity before designing the replacement
   experiment.** If `supplyStress` is invariant at 0.492 across every ablation
   including the catastrophic A0, the corrected Phase F may be unable to detect
   any effect. This must be understood before a rerun is designed.
5. **Re-examine the non-instantiated couplings** (energy, demographics) when those
   sectors are enabled.
6. **Carry forward the unresolved statistical redesign** from the prior reviews
   (seed count, test adequacy).

**The corrected model is NOT ready.** Jev: "partially ready" (0.83).

---

## 11. Final status

```text
ABLATION STATUS:
  COMPLETE. 8 ablations x 6 seeds = 48 deterministic world-runs, H=20, CPU only.
  Harness: scripts/phase-f-ablation.ts
  Artifacts: experiment-results/phase-f-ablation/ablation-results.json
  No production coupling modified. No frozen artifact modified.
  No Phase F rerun. No N=50. No Monte Carlo. No GPU.

CLIMATE EDGE ISOLATED:
  YES - STRONGLY SUPPORTED.
  A0 CO2 8.89e7..1.62e8 (saturates tick 4) vs A1 CO2 = 3.23e2 in all seeds
  (never saturates). A1 equals the exact baseline emissions trajectory.
  [Jev 1.89, conf 0.83]

TECHNOLOGY EDGE ISOLATED:
  YES - STRONGLY SUPPORTED, AND INDEPENDENT OF CLIMATE.
  A1 (climate ablated, technology active) reproduces A0's saturation exactly:
  11/11 nations at ceiling, first saturation tick 5. A2 -> 0 ceiling hits.
  A12 -> 0 ceiling hits; A13 -> 11/11. [Jev 1.88, conf 0.81;
  independence Jev 1.75, conf 0.63]

SEVERITY->GDP EDGE ISOLATED:
  PARTIALLY.
  Outcome is separable: A3 restores GDP to 5.46e13..6.88e13 with 0 floor hits
  while CO2 still runs away to 2.70e8 and severity stays at 30.8.
  Trigger is NOT separable: severity magnitude is climate-driven, so the edge is
  downstream of the climate defect. [Jev 1.63 conf 0.45 for isolation;
  Q3 attribution only "partially" justified, conf 0.06]

INTERACTIONS:
  MATERIAL FEEDBACK CONFIRMED.
  A3 CO2 (2.70e8) is ~2x A0 CO2 (1.36e8): ablating severity->GDP INCREASES CO2
  because the economy stays large and publishes larger GDP deltas into the
  climate emissions edge. A23 behaves identically (2.58e8).
  Chain: climate -> CO2 -> anomaly -> severity -> GDP damage -> economy size ->
  gdpDelta -> climate emissions.
  Technology edge is orthogonal to both other edges.
  Pairwise runs were necessary to establish orthogonality. [Jev 1.65]

REMAINING CONFOUNDERS:
  1. Irreducible feedback loop (climate <-> economy size)
  2. Uncontrolled geopolitics EXTREME_WEATHER relations edge [Jev: minor threat]
  3. Q3 attribution confidence very low (Jev conf 0.06)
  4. HOSPITAL SENTINEL NEARLY INSENSITIVE: supplyStress = 0.492 in EVERY
     ablation including the catastrophic A0; occupancy 0.534 vs 0.542
     [Jev: moderate concern, conf 0.09]
  5. Single horizon (H=20) and single CO2 level (280); intervention-level
     behaviour untested
  6. Non-instantiated sectors (energy, demographics) empirically unaudited

JEV VERDICT:
  Agrees all three ablations isolate their edges; Q1 and Q2 justified;
  technology independent of climate; severity->GDP downstream of climate;
  feedback real; pairwise necessary; A4 stable.
  Disagrees/qualifies: Q3 only partially justified (conf 0.06); Q4 only
  partially justified; KE's caveat slightly understates the coupling; hidden
  feedback paths remain; corrected model only "partially ready".
  Strongly supports: NO severity clamp needed (2.00, conf 0.99); upstream bound
  sufficient (1.98, conf 0.97); systematic correction warranted (1.98, conf 0.97).

CORRECTED MODEL READY: NO
  Jev: "partially ready" (0.83). Blockers: the unresolved sentinel
  insensitivity; the irreducible feedback loop; the unsettled statistical
  redesign carried over from prior reviews.

PHASE F RERUN ELIGIBLE: NO
```

---

## 12. Boundary statement

No production coupling was corrected. No frozen Phase F artifact was modified,
renamed, or deleted. No Phase F rerun was executed. No N=50 run, no Monte Carlo,
no GPU was used. No manuscript was modified. No corrected results were published.
Jev did not modify code and did not execute experiments.

New files in the repository from this task: `scripts/phase-f-ablation.ts`,
`experiment-results/phase-f-ablation/ablation-results.json`, and this report.

---

## 13. Artifacts

- This report: `docs/experiments/PHASE-F-DEFECT-ABLATION.md`
- Harness: `scripts/phase-f-ablation.ts`
- Trajectory data: `experiment-results/phase-f-ablation/ablation-results.json`
- Jev raw responses (not committed): `%TEMP%/opencode/jev-ablation-results.json`
- Prior audit: `docs/experiments/CROSS-SECTOR-DIMENSIONAL-AUDIT.md`
- Prior review: `docs/experiments/PHASE-F-JEV-ADVERSARIAL-REVIEW.md`
- Impact assessment: `docs/experiments/PHASE-F-ECONOMY-CLIMATE-COUPLING-IMPACT.md`
- NCR: `qms/records/nonconformities/2026-09-21-ncr-001-climate-coupling-unit-error.json`
