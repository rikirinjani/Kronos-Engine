# P-002 Decision Brief

**Date:** 2026-09-21
**Purpose:** Present the four remaining specification decisions for explicit human decision. This brief **does not decide them**.
**Status:** DECISION SUPPORT ONLY — no P-002 amendment, no adapter change, no DR change, no Phase F rerun, no N=50, no further calibration, no manuscript change.
**Companion:** `docs/experiments/P-002-IMPLEMENTATION-RECONCILIATION.md`, `docs/experiments/INTERFACE-SEMANTICS-PROVENANCE-AUDIT.md`

---

## 0. How to read this brief

Every claim is tagged with one of five evidence classes. **The classes are not
interchangeable**, and several of the decisions below are unanswerable from the
first four.

| Tag | Meaning |
|---|---|
| **[DOC]** | **Documented fact** — stated in an authoritative source |
| **[OBS]** | **Observed implementation behaviour** — what the code demonstrably does |
| **[CAL]** | **Calibration observation** — measured response of the DR model |
| **[INF]** | **Modelling inference** — reasoned, not directly evidenced |
| **[UNK]** | **Decision that cannot be made from existing evidence** |

Source shorthand: **P-002** = `docs/proposals/P-002-deers-rock-adapter.md`;
**ADAPTER** = `src/sectors/deers-rock-adapter.ts`;
**DR** = `Deers-Rock/dist/engine/*.js`.

**Nothing in this brief is a recommendation.** Options are presented as symmetric
alternatives.

---

## 1. Decision 1 — `admissionMultiplier` semantics

| Item | Current evidence | Option A | Option B | Consequences | Evidence still required | Decision owner |
|---|---|---|---|---|---|---|
| **Scale semantics** | **[DOC]** P-002 declares `admissionMultiplier: number; // 1.0 = baseline` (P-002:176). **[DOC]** P-002's scale table states "Pandemic declared → `admissionMultiplier` × 2.5" (P-002:81). **[DOC]** P-002's validation table states "Pandemic → `admissionMultiplier = 2.5` ✅ Valid" (P-002:257). **[OBS]** Implementation is **additive**: `1.0 + 0.3·w + 0.2·k` (ADAPTER:157,166,172). **[INF]** DR's `floor(baseAdmit × m)` is a **multiplicative** application (DR markov.js:58-60) | **A — Multiplicative.** Each contributing event multiplies the baseline; a pandemic sets 2.5 directly. Adapter must be changed to conform to P-002's examples | **B — Additive.** Events add fixed increments to the 1.0 baseline. P-002 must be amended to declare additive semantics and withdraw the "× 2.5" example | **A:** changes adapter behaviour; aligns with DR's multiplicative mechanism; requires re-deriving the per-event factors; invalidates the currently-observed emitted values. **B:** preserves current behaviour; requires a P-002 amendment; the "× 2.5" example becomes documented as withdrawn | **[UNK]** Whether P-002's `× 2.5` was intended as a **binding contract term** or an **illustrative example**. P-002's declaration line and its narrative tables carry different specificity, and no source adjudicates | Human owner |
| **Meaning of `1.0`** | **[DOC]** "1.0 = baseline" (P-002:176). **[OBS]** Emitted value is 1.0 when no contributing event occurs | Baseline = "no macro perturbation" | Baseline = "one unit of ordinary demand" | Both readings are compatible with the current implementation; the distinction matters only if the scale semantics (above) changes | None | Human owner |
| **Valid domain** | **[DOC]** No numeric domain declared. **[OBS]** Emitted values: {1.0, 1.3} ordinarily; reachable set bounded below | Domain `[1.0, ∞)` — the field is a multiplier and cannot reduce admissions below baseline | Domain `[0, ∞)` — permitting suppression of admissions | Option B would require DR's `max(1, ·)` floor to be revisited; DR currently cannot admit fewer than 1 | Whether admission **suppression** (m < 1.0) is ever intended | Human owner |
| **Is 2.5 normative or illustrative?** | **[DOC]** P-002 uses 2.5 in a narrative scale table and a validation table, not in the interface declaration. **[OBS]** `m_max = 2.3` under current event constraints | **Normative** — 2.5 is a contract value that the system must be able to produce | **Illustrative** — 2.5 is an example magnitude, not a guarantee of reachability | Normative reading implies the adapter is non-conforming and must change. Illustrative reading implies the example should be marked as such | **[UNK]** Authorial intent. **Cannot be resolved from the repository** | Human owner |
| **Reachable domain under current event constraints** | **[OBS]** `w ≤ 1` — climate emits at most one `EXTREME_WEATHER` per tick (climate.ts:150). **[OBS]** `k ≤ 5` — geopolitics rolls once per nation and only nations with a relation < −60 qualify (geopolitics.ts:231-259); five such nations exist in RP-CONTEMP-002. **[INF]** `m_max = 1.0 + 0.3(1) + 0.2(5) = 2.3`. **[OBS]** Ordinary case (`w=1, k=0`) = **1.3** | **Keep current constraints** — accept `m_max = 2.3` and treat higher P-002 examples as unreachable | **Relax constraints** — allow more events per tick or additional contributing event types | Relaxing constraints changes macro-sector behaviour, not just the interface, and would invalidate existing experiment baselines | Whether the reachable domain is a *design intent* or an *incidental consequence* of sector dynamics | Human owner |
| **Interaction with DR quantisation** | **[CAL]** DR admission response is a **3-state staircase**: `m < 1.50` → step 0; `1.50 ≤ m < 2.00` → step 1; `m ≥ 2.00` → step 2. Emitted 1.3 → **step 0** (no effect) | **Accept quantisation** — it is a DR model property; declare it as part of the interface behaviour | **Change DR quantisation** — make the admission response continuous | Changing DR is outside the current boundary and would invalidate frozen evidence | Whether a 3-state target is acceptable for a continuous Kronos quantity | Human owner |

---

## 2. Decision 2 — `activeDisasterType` vocabulary

| Item | Current evidence | Option A | Option B | Consequences | Evidence still required | Decision owner |
|---|---|---|---|---|---|---|
| **Layer of the vocabulary** | **[DOC]** P-002 declares `activeDisasterType?: string; // pandemic, earthquake, etc.` (P-002:180) — the examples are **scenario-like names**. **[OBS]** The adapter emits `"natural-disaster"` — a **category**, not a scenario name (ADAPTER:168). **[DOC]** DR's `mapMacroDisasterToScenario` maps **categories** to scenario types: `natural-disaster` → `earthquake`, `mass-casualty` → `mass_casualty`, unknown → no activation (DR scenario.js:2-8) | **A — Adapter emits DR scenario types** (`earthquake`, `pandemic`, …) directly | **B — Adapter emits a macro category**; DR owns category→scenario mapping (ratifies the current layering) | **A:** couples the adapter to DR's internal scenario vocabulary — in tension with P-002's invariant "the adapter translates, it does not decide" (P-002:253-262). **B:** preserves the boundary; requires declaring the **category** vocabulary, which does not currently exist | **[UNK]** Which layer is intended to own the vocabulary | Human owner |
| **Authoritative vocabulary** | **[DOC]** P-002 gives examples only ("pandemic, earthquake, etc.") — **no enumeration**. **[OBS]** Adapter vocabulary = {`natural-disaster`}. **[DOC]** DR scenario vocabulary = {earthquake, forest_fire, sunken_ship, pandemic, industrial_accident, tsunami, mass_casualty} (DR scenario.js:9-66). **[DOC]** DR **category** vocabulary = {`natural-disaster`, `mass-casualty`} (DR scenario.js:2-8) | **Declare the DR scenario vocabulary as authoritative** (7 types) | **Declare a macro category vocabulary as authoritative** (currently 2 values) | A 7-value vocabulary is richer but larger than the current coupling supports. A 2-value vocabulary is honest about what exists but narrow | **[UNK]** The intended vocabulary. Not derivable from existing evidence | Human owner |
| **`natural-disaster`** | **[OBS]** The only value the adapter emits. **[DOC]** DR maps it to `earthquake`. **[CAL]** Produces an earthquake scenario, severity 0.6; ICU occupancy doubles (0.0357 → 0.0714) | Keep as the canonical category | Deprecate in favour of scenario-type names | Removing it requires a replacement path for the only currently-working channel | — | Human owner |
| **`earthquake`** | **[DOC]** Named in P-002's examples. **[OBS]** Adapter never emits it; DR reaches it only via the `natural-disaster` category | Emit directly (Option A above) | Keep as a DR-internal scenario name | Direct emission implies the adapter knows DR scenario names | — | Human owner |
| **`pandemic`** | **[DOC]** P-002's **only named example** (P-002:180, 74, 81). **[OBS]** Adapter never emits it. **[DOC]** DR has a `pandemic` **scenario** but **no category mapping** for it. **[CAL]** Never exercised | Add a `pandemic` category and a DR mapping | Declare `pandemic` withdrawn from the interface vocabulary | Adding it requires a modelling decision about what macro conditions should activate a pandemic scenario | **[UNK]** Whether `pandemic` is intended to be reachable from the current macro sectors | Human owner |
| **`mass-casualty`** | **[DOC]** DR recognises it (`→ mass_casualty`). **[OBS]** Adapter **never emits** it. **[DOC]** Not named in P-002 | Wire a producer for it | Declare it DR-reserved and unreachable from this adapter | Wiring it requires a macro event type that currently does not exist | — | Human owner |
| **Producer → consumer mapping** | **[DOC]** DR has a mapping table (2 entries). **[OBS]** The adapter has no vocabulary declaration at all | Publish an explicit **adapter→DR mapping table** as part of the contract | Leave mapping implicit in DR code | Explicit table makes divergence detectable; implicit mapping is how the current disjointness went unnoticed | — | Human owner |

---

## 3. Decision 3 — climate `severity` transmission

| Item | Current evidence | Option A | Option B | Consequences | Evidence still required | Decision owner |
|---|---|---|---|---|---|---|
| **Transmission** | **[DOC]** P-002's `MacroConditionPacket` contains **no severity field** (P-002:174-181). **[DOC]** P-002 promises only a qualitative effect: "Climate disaster (local) → Trauma surge, supply stress" (P-002:83). **[OBS]** The adapter never reads the climate event's `severity` (ADAPTER:164-183) | **A — Explicitly NOT transmitted.** Declare severity as a macro-internal quantity with no interface role | **B — Transmitted via a formally defined normalization** with an explicit rationale | **A:** simplest; preserves the adapter boundary; the macro channel stays categorical; severity remains unobservable to the hospital. **B:** requires a normalization decision, introduces a new coupling that must itself be calibrated, and risks repeating the unit-error class if done carelessly | **[UNK]** Whether magnitude transmission is **scientifically required** for the research question. P-002 is silent | Human owner |
| **Semantic/unit incompatibility** | **[DOC]** Kronos climate severity = `1 + rng×4 + temperatureAnomaly×0.5` (climate.ts:152) — an **unbounded magnitude**. **[DOC]** DR scenario severity is a **normalised interpolation parameter on [0,1]**: `surgeMultiplier = surgeMin + (surgeMax − surgeMin) × severity` (DR scenario.js:85-93, 179). **[DOC]** DR's own native sampling is `0.3 + rng()×0.7` → **[0.3, 1.0]** (DR scenario.js:152) | — | — | **Direct transmission is not admissible without a mapping.** This is a **documented unit incompatibility**, not a modelling preference | — | — (factual) |
| **Fixed DR severity 0.6** | **[DOC]** DR's macro override hardcodes `severity = 0.6`, commented "deterministic, moderate" (DR scenario.js:126-127). **[CAL]** That value yields the measured earthquake response | Keep 0.6 fixed (consistent with a categorical channel) | Derive severity from a transmitted magnitude (depends on Option B above) | Keeping 0.6 fixed is **consistent with P-002**, which declares the field as categorical with no magnitude channel | — | Human owner |
| **Consequence of Option B** | **[INF]** A normalization would need to map the *intended* climate severity range (≈1–7.5 for the designed CO₂ ladder) onto [0,1]. **[OBS]** Under the coupling defect the observed severity reached ≈30, outside any intended range | Define the normalization against the **intended** range with an explicit rationale | Define it against the **observed** range | Defining against the observed (defective) range would encode the defect into the contract | Whether a magnitude channel is required at all (Decision 3 Option A/B) | Human owner |

> **Explicit constraint carried from the task:** do **not** invent a normalization
> merely to increase pathway sensitivity. A normalization is admissible only if the
> scientific question requires magnitude transmission.

---

## 4. Decision 4 — primary endpoint

| Item | Current evidence | Option A | Option B | Consequences | Evidence still required | Decision owner |
|---|---|---|---|---|---|---|
| **Interface target vs diagnostic endpoint** | **[DOC]** P-002 declares 9 `HospitalSentinelOutput` fields (P-002:143-154) and assigns each an **outbound role** in a signal table: 95% occupancy → `health.pressure`; mortality spike → `health.mortality`; disease prevalence shift → `health.disease-burden`; supply stress > 0.7 → `health.supply-crisis`; admission surge → `health.surge` (P-002:157-163). **[OBS]** No field is declared *primary* | **Keep the distinction explicit** — the interface target is what the adapter transmits; the diagnostic endpoint is what an experiment measures | Treat P-002's signal table as an endpoint ranking | P-002 assigns **roles**, not **priorities**; conflating them would invent a ranking | Which field, if any, P-002 intends as the experimental primary | Human owner |
| **`supplyStress`** | **[DOC]** P-002 assigns it the `health.supply-crisis` role at > 0.7. **[OBS]** Computed as inventory depletion, restocked only at `tick % 50` (DR central-supply.js:78,144). **[CAL]** Dead ≤ 0.450; onset 0.475; saturates ≥ 0.525. Reported **0.492 in every ablation including a catastrophic one** | Keep as the primary diagnostic endpoint | Demote to a secondary/diagnostic signal | Keeping it requires the pressure channel to be above threshold, which depends on Decisions 1–2 and on a DR model property. Demoting it changes the pre-registered success criterion | Whether `supplyStress` answers the intended scientific question | Human owner |
| **`occupancyRate`** | **[DOC]** P-002 assigns it the `health.pressure` role at > 0.85. **[CAL]** Responds monotonically with horizon (Δ 0.0305 at H=5 → 0.0916 at H=40); the threshold-unreachable `admissionSurge` flag depends on it | Primary diagnostic endpoint | Retain as a secondary signal | More responsive than `supplyStress`, but sensitivity is **not** a justification (see §5) | Whether occupancy answers the intended scientific question | Human owner |
| **`icuOccupancyRate`** | **[DOC]** Declared in P-002's output contract. **[CAL]** The **only** endpoint with a substantial measured response — doubles (0.0357 → 0.0714) under the disaster channel | Primary diagnostic endpoint | Retain as a secondary signal | Most responsive measured endpoint, but it responds to a **categorical** channel, not to a graded macro perturbation | Whether ICU occupancy answers the intended scientific question | Human owner |
| **`mortalityPressure`** | **[DOC]** P-002 assigns it the `health.mortality` role. **[OBS]** `morgue.length`. **[CAL]** **0 in every case tested** | Retain as a declared signal | Exclude from endpoint candidates at this horizon | Structurally absent at the tested horizon/severity; retaining it as primary would be unsupported | Whether mortality can respond at any admissible horizon | Human owner |
| **`admissionSurge`** | **[DOC]** P-002 assigns it the `health.surge` role. **[CAL]** Requires occupancy > 0.9; maximum observed 0.6031 — **never reached** | Retain as a declared signal | Exclude from endpoint candidates | Threshold-unreachable at the tested horizon | Whether the threshold is reachable at any admissible horizon | Human owner |
| **`staffStress`, `diseasePrevalence`** | **[DOC]** Both declared. **[OBS]** `diseasePrevalence`'s macro driver (`diagnosisWeightOverrides`) is a dead field; `staffStress` is derived from encounters | Retain as declared signals | Exclude from endpoint candidates | Neither is currently driven by a macro channel | — | Human owner |

> **Explicit constraint carried from the task:** do **not** select an endpoint
> because it is more sensitive. Endpoint choice must follow the scientific question.

---

## 5. What we must NOT infer from calibration

This section exists to prevent five specific inferences that the calibration data
**cannot** support.

| # | Invalid inference | Why it is invalid |
|---|---|---|
| 1 | **Stronger effect ⇒ correct semantics.** "A value producing a larger Δ must be the right value." | Effect size is an outcome of the model, not a statement of meaning. Choosing semantics by effect size is outcome-driven tuning. |
| 2 | **More sensitive endpoint ⇒ automatically correct endpoint.** "ICU occupancy responds most, so it should be primary." | Sensitivity is a property of the model's transfer function. Endpoint choice must be justified by the scientific question the experiment asks. |
| 3 | **Reachable value ⇒ normative value.** "1.3 is what the adapter emits, therefore 1.3 is the specified value." | Reachability is a consequence of sector dynamics and event constraints. The specification is not derived from what happens to be reachable. |
| 4 | **DR behaviour ⇒ interface specification.** "DR quantises admissions in 3 states, therefore the contract says admissions are 3-state." | DR's response is **behavioural characterisation**. The interface contract is a declaration of meaning, units and domain. Conflating them is precisely the error corrected in `INTERFACE-SEMANTICS-PROVENANCE-AUDIT.md` §3. |
| 5 | **Existing implementation ⇒ intended scientific model.** "The code does X, therefore X was intended." | P-002 and the implementation already diverge (Decision 1). The implementation is evidence of what was built, not of what was specified. |

**Corollary.** The calibration results belong to the **behavioural
characterization** category throughout this brief. They inform *consequences* of
each option; they do not determine which option is correct.

---

## 6. Summary — decisions required

| # | Decision | Options | Blocking evidence gap |
|---|---|---|---|
| D1 | `admissionMultiplier` scale semantics | Multiplicative (A) vs additive (B) | Whether P-002's `× 2.5` is binding or illustrative **[UNK]** |
| D1b | `admissionMultiplier` valid domain | `[1.0, ∞)` vs `[0, ∞)` | Whether admission suppression is intended **[UNK]** |
| D1c | Reachable domain | Keep `m_max = 2.3` vs relax event constraints | Whether reachability is intended **[UNK]** |
| D2 | `activeDisasterType` vocabulary | Adapter emits scenario types (A) vs macro categories (B) | Which layer owns the vocabulary **[UNK]** |
| D2b | Authoritative vocabulary | 7 DR scenario types vs current 2 categories | Intended enumeration **[UNK]** |
| D2c | `pandemic` treatment | Add category+mapping vs declare withdrawn | Whether it is intended to be reachable **[UNK]** |
| D3 | Climate severity transmission | Not transmitted (A) vs normalized mapping (B) | Whether magnitude is scientifically required **[UNK]** |
| D4 | Primary endpoint | `supplyStress` vs `occupancyRate` vs `icuOccupancyRate` | The scientific question the experiment answers **[UNK]** |

**Every decision above is marked [UNK] — none is resolvable from existing
repository evidence.** That is the central finding of this brief.

---

## 7. Jev review

Jev (`jev-1.13.0`) reviewed the brief for neutrality and for options smuggled in
through implementation behaviour. 3 question sets, 21 questions. Jev was instructed
to **review, not decide**.

### 7.1 Neutrality

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Are the alternatives presented neutrally? | 1.56 | **Yes** | 0.34 |
| Is any option smuggled in through implementation behaviour? | 0.44 | **No** | 0.34 |
| Is any option smuggled in through calibration evidence? | 0.36 | **No** | 0.45 |
| Is any option smuggled in by treating P-002's examples as binding authority? | 0.44 | **No** | 0.34 |
| Is there a hidden default option? | 0.87 | **Partially** | 0.39 `[low]` |
| Does the brief avoid recommending any option? | 1.63 | **Yes** | 0.45 |
| Are Option A and Option B of comparable detail and prominence? | 1.47 | **Partially** | 0.21 `[low]` |

### 7.2 Evidence discipline

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Are the five evidence classes applied correctly? | 1.75 | **Yes** | 0.62 |
| Is the "must not infer" section adequate? | 1.15 | **Partially** | 0.61 |
| Has implementation behaviour been treated as specification? | 0.42 | **No** | 0.37 |
| Is calibration used only for consequences, not to justify options? | 1.16 | **Partially** | 0.23 `[low]` |
| Is the `[UNK]` marking used correctly? | 1.28 | **Partially** | 0.28 `[low]` |
| Is any decision marked `[UNK]` that could be resolved from existing evidence? | 1.26 | **Partially** | 0.00 `[low]` |
| Is the interface-target vs diagnostic-endpoint distinction drawn correctly? | 1.87 | **Yes** | 0.81 |

### 7.3 Completeness

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Are the four decisions the correct and complete set? | 0.83 | **Mostly complete** | 0.15 `[low]` |
| Is any specification decision missing? | 0.76 | **Partially** | 0.00 `[low]` |
| Are the sub-items correctly identified? | 1.62 | **Yes** | 0.42 |
| Is "human owner" the correct decision owner? | 1.55 | **Yes** | 0.32 |
| Is the brief sufficient for the human to make the decisions? | 0.38 | **No** | 0.43 |
| Is the severity constraint (no sensitivity-driven normalization) respected? | 1.99 | **Yes** | 0.98 |
| Is the endpoint constraint (no sensitivity-driven selection) respected? | 1.99 | **Yes** | 0.98 |

### 7.4 Where Jev agrees with KE

- **The alternatives are presented neutrally** (1.56).
- **No option is smuggled in** via implementation behaviour (0.44), calibration
  (0.36), or P-002's examples treated as binding (0.44).
- **The brief does not recommend an option** (1.63).
- **The evidence classes are applied correctly** (1.75).
- **Implementation behaviour was NOT treated as specification** (0.42 → No).
- **The interface-target vs diagnostic-endpoint distinction is drawn correctly**
  (1.87, conf 0.81).
- **Both explicit constraints are respected**, each at 1.99 with conf 0.98 — the
  strongest verdicts in this review: no sensitivity-driven normalization; no
  sensitivity-driven endpoint selection.

### 7.5 Where Jev disagrees / qualifies

1. **A hidden default option may exist (0.87, conf 0.39).** Jev does not identify
   which. **Recorded as an open item; not resolved.**
2. **Option A / Option B asymmetry (1.47, conf 0.21).** Some option pairs are not of
   equal prominence. **Recorded; not resolved.**
3. **The "must not infer" section is only Partially adequate (1.15, conf 0.61)** —
   Jev indicates further prohibited inferences may be missing.
4. **Calibration may be used partly to justify options rather than only to inform
   consequences (1.16, conf 0.23).**
5. **`[UNK]` usage is only Partially correct (1.28, conf 0.28)**, and Jev indicates
   **some decisions may be wrongly marked `[UNK]`** (1.26, conf 0.00) — i.e. possibly
   resolvable from existing evidence. **Not resolved.**
6. **The four decisions may not be the complete set (0.83; missing decisions 0.76).**
   Jev does not enumerate what is missing. **Recorded as an open item.**
7. **The brief is judged NOT sufficient for the human to make the decisions**
   (0.38, conf 0.43). **KE response:** this is the most consequential qualification
   and is **accepted as an open finding** — see §8.

### 7.6 Jev proposals

**None recorded.** Jev reviewed rather than decided, as instructed, and proposed no
semantic interpretation.

---

## 8. Status

```text
DECISION BRIEF:
  COMPLETE. docs/experiments/P-002-DECISION-BRIEF.md
  Four decisions presented with evidence classes, symmetric options, consequences,
  remaining evidence gaps and decision owner. NO DECISION TAKEN.
  No P-002 amendment. No adapter change. No DR change. No Phase F rerun.
  No N=50. No further calibration. No MemPalace repair. No manuscript change.

NEUTRALITY:
  Jev confirms the alternatives are presented neutrally (1.56) and that the brief
  does not recommend an option (1.63).
  Jev finds NO smuggling via implementation behaviour (0.44), calibration (0.36),
  or P-002 examples treated as binding authority (0.44).
  Jev finds NO treatment of implementation behaviour as specification (0.42).
  Both explicit constraints are respected at 1.99 (conf 0.98):
    no sensitivity-driven normalization; no sensitivity-driven endpoint selection.
  QUALIFICATIONS: possible hidden default option (0.87); Option A/B asymmetry (1.47).

EVIDENCE DISCIPLINE:
  Jev confirms the five evidence classes are applied correctly (1.75) and that the
  interface-target vs diagnostic-endpoint distinction is correct (1.87, conf 0.81).
  QUALIFICATIONS: "must not infer" only partially adequate (1.15); calibration may
  partly justify options rather than only inform consequences (1.16); [UNK] usage
  only partially correct (1.28) and some decisions may be wrongly marked [UNK]
  (1.26, conf 0.00).

DECISIONS REQUIRED (all marked [UNK] in the brief):
  D1   admissionMultiplier scale semantics        multiplicative vs additive
  D1b  admissionMultiplier valid domain           [1.0, inf) vs [0, inf)
  D1c  reachable domain                           keep m_max = 2.3 vs relax constraints
  D2   activeDisasterType vocabulary layer        scenario types vs macro categories
  D2b  authoritative vocabulary                   7 DR types vs 2 categories
  D2c  pandemic treatment                         add category+mapping vs declare withdrawn
  D3   climate severity transmission              not transmitted vs normalized mapping
  D4   primary endpoint                           supplyStress vs occupancyRate vs
                                                  icuOccupancyRate

JEV VERDICT:
  Neutral, no smuggling, no recommendation, constraints respected.
  BUT the brief is judged NOT sufficient for the human to make the decisions
  (0.38, conf 0.43), and Jev flags: a possible hidden default option; option
  asymmetry; an incomplete "must not infer" section; possibly incomplete decision
  set; and possibly incorrect [UNK] markings. Jev does not enumerate the missing
  items in any of these cases.
  These qualifications are RECORDED AS OPEN, NOT RESOLVED.

NEXT STEP: human decision on the four specification questions, followed by the
P-002 amendment. Not started.
```

---

## 9. Boundary statement

No P-002 amendment. No adapter change. No DR change. No Phase F rerun. No N=50. No
further calibration. No MemPalace repair. No manuscript change. No decision has been
taken in this document.

---

## 10. Artifacts

- This brief: `docs/experiments/P-002-DECISION-BRIEF.md`
- Reconciliation: `docs/experiments/P-002-IMPLEMENTATION-RECONCILIATION.md`
- Semantic provenance audit: `docs/experiments/INTERFACE-SEMANTICS-PROVENANCE-AUDIT.md`
- Calibration: `docs/experiments/ADAPTER-DR-CALIBRATION.md`
- P-002 (unmodified): `docs/proposals/P-002-deers-rock-adapter.md`
