# P-002 Contract vs Implementation Reconciliation

**Date:** 2026-09-21
**Purpose:** Strict reconciliation between P-002's authoritative semantics, the current adapter, the current DR consumption, the calibration behaviour, and the prior independent reopening audit.
**Primary specification:** `docs/proposals/P-002-deers-rock-adapter.md` (S1), used as primary unless another authoritative source explicitly supersedes a provision.
**Scope:** Reconciliation only. No production patch, no adapter tuning, no DR change, no Phase F rerun, no N=50, no Monte Carlo, no manuscript change.
**Prior artifacts (unmodified):** `KRONOS-DR-INTERFACE-SPECIFICATION.md`, `INTERFACE-SEMANTICS-PROVENANCE-AUDIT.md`

---

## A. Reconciliation matrix

| Field | P-002 specification | Current adapter | DR consumer | Calibration behaviour | Status |
|---|---|---|---|---|---|
| `admissionMultiplier` | `// 1.0 = baseline` (S1:176); scale table "Pandemic → × 2.5" (S1:81); validation "Pandemic → `= 2.5` ✅" (S1:257) | `1.0 + 0.3w + 0.2k`; w ∈ {0,1}, k ≤ 5 ⇒ **m_max = 2.3** (`deers-rock-adapter.ts:164-175`) | `_admissionMultiplier` → `floor(baseAdmit × m)`, `baseAdmit ∈ {0,1,2}` (`markov.js:58-60`) | 3-state staircase; steps at 1.50 / 2.00; emitted 1.3 → step 0 | **IMPLEMENTATION DIVERGENCE** (see §B nuance) |
| `supplyChainPressure` | `// 0-1` (S1:178); scale table "Climate disaster → … supply stress" (S1:83) | `max(·, 0.4)` on `EXTREME_WEATHER`; emits {0, 0.4} ⊂ [0,1] (`adapter:167`) | `effectiveMin = min + range×p`; restock only at `tick % 50` (`central-supply.js:78-85`) | dead ≤0.450; onset 0.475; saturates ≥0.525 | **CONFORMING** (range respected; see §D) |
| `activeDisasterType` | `// pandemic, earthquake, etc.` (S1:180) | emits **only** `"natural-disaster"` (`adapter:168`) | maps `natural-disaster`→`earthquake`, `mass-casualty`→`mass_casualty`, unknown→none (`scenario.js:2-8`) | earthquake scenario, severity 0.6, ICU occupancy doubles | **DR CONSUMPTION DIVERGENCE** (see §C) |
| `staffAvailabilityModifier` | `// 0-1` (S1:179); "reduce staff availability" on war (S1:75) | `min(1.0, 0.85)` on `WAR_START`; emits {1.0, 0.85} ⊂ [0,1] (`adapter:173`) | `poliCapacity = max(1, floor(cap × mod))` (`outpatient.js:97-99`) | 0.85 → **no effect** on sentinel endpoints | **CONFORMING** (range respected; see §E) |
| `diagnosisWeightOverrides` | `// ICD code → weight` (S1:177); "`respiratoryCaseWeight: +40%`" (S1:23) | computed, populated, returned; **never scheduled** (`adapter:158-189`) | **none**; DR has its own `SCENARIO_DEFS.icdWeights` (`scenario.js:180`) | n/a | **DEAD / UNCONSUMED** + UNRESOLVED lifecycle (see §F) |
| climate `severity` | **not mentioned in P-002's packet**; scale table promises "trauma surge, supply stress" for climate disasters (S1:83) | never read by the adapter (`adapter:164-183`) | n/a | n/a | **SPECIFICATION AMBIGUOUS** (see §G) |

---

## B. `admissionMultiplier` — highest priority

### P-002 declaration

| Element | Content | Source |
|---|---|---|
| Declared semantic | "1.0 = baseline" | S1:176 |
| Scale interpretation | **multiplicative** — "`admissionMultiplier` × 2.5" | S1:81 |
| Validation example | "Pandemic → `admissionMultiplier = 2.5` ✅ Valid" | S1:257 |
| Intended meaning | a multiplier on baseline admissions, where 1.0 is baseline | S1:176, 184 |
| Narrative form | "`admissionRateMultiplier: 1.8`" (different field name) | S1:21 |

### Implementation

```
w = number of EXTREME_WEATHER events this tick   ∈ {0, 1}
      climate.ts:150 — a single `if (rng.next() < eventChance)`, so at most ONE per tick
k = number of WAR_START events this tick          ∈ {0..5}
      geopolitics.ts:231-259 — one roll per nation; only nations with a relation < −60 qualify
m = 1.0 + 0.3·w + 0.2·k
      deers-rock-adapter.ts:157, 166, 172
```

- **Additive**, not multiplicative. Each event **adds** a constant.
- **Event accumulation:** additive across event types within a single tick.
- **Maximum events per tick:** `w_max = 1` (climate emits at most one weather event per tick); `k_max = 5` (nations with a relation below −60, per S6's era analysis of RP-CONTEMP-002).
- **Maximum reachable multiplier:** `m_max = 1.0 + 0.3(1) + 0.2(5) = **2.3**`.
- **Relationship to DR:** DR applies `floor(baseAdmit × m)` with `baseAdmit ∈ {0,1,2}`, then `max(1, ·)`. The DR side is a **multiplier** — consistent with a multiplicative reading.

### Is P-002's 2.5 reachable?

**No.** `m_max = 2.3 < 2.5`, and reaching 2.3 requires **five simultaneous war declarations in a single tick** (probability ≈ 0.02⁵ × combinations; effectively never). In the ordinary case (`w = 1`, `k = 0`) the value is **1.3**.

```
STATUS = IMPLEMENTATION DIVERGENCE
```

### Nuance that must be recorded (and challenged)

P-002's **interface declaration line** says only `admissionMultiplier: number; // 1.0 = baseline`.
The **multiplicative scale** appears in a narrative "Scale Translation Table" (S1:81) and a
validation table (S1:257) — neither is the interface declaration.

- Under a **strict reading of the declaration line**, the implementation is **CONFORMING**
  ("1.0 = baseline" holds).
- Under a **reading of the examples as prescriptive**, the implementation **DIVERGES**
  (2.5 unreachable).

The reconciliation records **IMPLEMENTATION DIVERGENCE** because the declared *scale
semantics* (multiplicative) is not implemented, while explicitly flagging that P-002's
own text is not unambiguous about whether the example is binding. **This ambiguity is a
candidate for a specification clarification, not only a code change.**

**Not repaired here.**

---

## C. `activeDisasterType` — vocabulary reconciliation

### P-002 vocabulary vs adapter-emitted vs DR-recognized

| P-002 value | Adapter can emit? | DR recognizes? | Status |
|---|---|---|---|
| `pandemic` | **NO** | **NO** — no mapping exists | **DR CONSUMPTION DIVERGENCE** |
| `earthquake` | NO (adapter emits the *category* `natural-disaster`, not the scenario name) | Indirectly — via `natural-disaster` → `earthquake` | Reconcilable by mapping, not by literal value |
| `natural-disaster` | **YES** (the only value emitted) | **YES** → `earthquake` | **CONFORMING** (for the values it does emit) |
| `mass-casualty` | **NO** | **YES** → `mass_casualty` | Defined but **unreachable** from this adapter |
| "etc." (unspecified) | NO | unknown → **no activation (safe)** | **SPECIFICATION AMBIGUOUS** |

### Findings

1. P-002's declared vocabulary ("pandemic, earthquake, etc.") and the adapter's emitted
   vocabulary (`natural-disaster` only) are **effectively disjoint at the literal level**.
2. `pandemic` — P-002's only named example — has **no DR mapping at all**.
3. `mass-casualty` is **recognized by DR but never emitted by the adapter**.
4. The adapter emits a **category** (`natural-disaster`) where P-002 names **scenario
   types** (`pandemic`, `earthquake`). The layer of the vocabulary differs.

```
STATUS = DR CONSUMPTION DIVERGENCE
```

No missing mappings are invented. No authoritative document supersedes P-002 on this point.

---

## D. `supplyChainPressure`

| Question | Finding |
|---|---|
| Respects declared range (0-1)? | **YES** — emits {0, 0.4}; DR clamps to [0,1] |
| Preserves intended semantics? | P-002's scale table says climate disaster → "supply stress". The adapter sets 0.4 on weather. **Consistent.** |
| Introduces thresholding / time quantization? | **Yes, but in the DR model, not the adapter.** DR evaluates the threshold only at `tick % 50`. |
| Materially different from declared semantics? | **No.** P-002 declares a **range**, not a continuous-response guarantee. |

### Does P-002 promise continuous semantics?

**No.** P-002 declares only `// 0-1` (a normalized input range) and a qualitative mapping
("supply stress"). It makes **no promise of a continuous or proportional response**.

**Therefore the observed thresholding and restock-boundary quantization are NOT adapter
divergences.** They are properties of the receiving DR model operating within the declared
range. Classifying quantization as a defect would require a specification that promises
continuity, and none exists.

```
STATUS = CONFORMING
```
(Quantization recorded as a **model property**, not a divergence.)

---

## E. `staffAvailabilityModifier`

| Question | Finding |
|---|---|
| P-002 declared meaning/range | "reduce staff availability" (S1:75); `// 0-1` (S1:179) |
| Adapter calculation | `min(1.0, 0.85)` on `WAR_START`; emits {1.0, 0.85} ⊂ [0,1] |
| DR consumption | `poliCapacity = max(1, floor(capacityPerTick × modifier))` — **consumed** |
| Actual endpoint effects | **None** on occupancy, ICU occupancy, supplyStress or encounters |

### Does P-002 intend this field to affect those endpoints?

**No.** P-002 declares the field's meaning (staff availability) and its range (0-1). It
does **not** specify which sentinel endpoints must respond. The "no effect on supplyStress"
observation is therefore **not evidence of a defect** — P-002 never claimed that
`staffAvailabilityModifier` drives `supplyStress`.

Its effect is real but confined to outpatient capacity, which does not feed the measured
inpatient endpoints at this horizon.

```
STATUS = CONFORMING
```

---

## F. `diagnosisWeightOverrides` — special case

### The question

Does P-002 **require** this field to be implemented?

| Evidence | Content |
|---|---|
| P-002 declaration | `diagnosisWeightOverrides: Record<string, number>; // ICD code → weight` (S1:177) |
| P-002 invariant | "The adapter may transform information, but it may never invent domain behavior" (S1:253) |
| P-002 narrative | "`respiratoryCaseWeight: +40%`" (S1:23) |
| Implementation | computed, populated, returned — **never scheduled** |
| DR | has its own `SCENARIO_DEFS.icdWeights` (`scenario.js:180`) with no adapter input |

### Determination

P-002 declares the field as **part of the packet interface**. It does **not** state that
the field must be transmitted to DR, nor that DR must consume it. P-002's invariant
("translate, don't decide") is about the adapter's authority, not about transmission
obligation. No authoritative document supersedes or clarifies this.

A declared interface field that is never transmitted is a **strong** indication of
incompleteness, but P-002 does not establish it as **required behavior**.

```
STATUS = DEAD / UNCONSUMED
LIFECYCLE = UNRESOLVED
```

**Not classified as IMPLEMENTATION DIVERGENCE**, because the authoritative source does not
establish that it is required behavior. **Not implemented.**

---

## G. `severity`

Two quantities, kept distinct:

| | Kronos climate severity | DR scenario severity |
|---|---|---|
| Definition | `climate.ts:152` `1 + rng×4 + temperatureAnomaly×0.5` | `_scenario.active.severity` |
| Units | unbounded magnitude | normalized interpolation parameter |
| Range | intended ≈1–7.5; observed ≈30 under the coupling defect; **not declared** | [0,1]; native sampling ≈[0.3,1.0]; macro override **fixed 0.6** |
| P-002 mentions? | **No** — absent from the packet declaration (S1:174-181) | Not named as a field |

### Does P-002 specify a mapping?

**No.** P-002's packet contains no severity field. Its scale table promises that a climate
disaster produces "trauma surge, supply stress" — a **qualitative** effect, not a magnitude.

```
MAPPING = UNDEFINED
```

No mapping is created.

### Is `activeDisasterType` + fixed DR severity 0.6 consistent with P-002?

**Yes, consistent.** P-002 declares `activeDisasterType` as a **categorical** field
(`?: string`). It does not declare any magnitude channel. Activating a scenario at a fixed
severity is compatible with a categorical declaration. (The DR-side comment at
`scenario.js:126` calls 0.6 "deterministic, moderate" — a DR-internal choice.)

```
STATUS = CONFORMING (for the categorical channel)
```

The *absence* of severity transmission is **not a divergence from P-002**, because P-002
never promised it. It is a **specification gap**, not an implementation defect.

---

## H. Reopening audit reconciliation

### What the reopening paper actually claims

`Deers-Rock/reopen-audit/paper/deers-rock-reopening-paper.md`:

> "the macro→micro channel is **inert**: the adapter computes a five-field
> MacroConditionPacket but DR's tick dispatcher **drops the only two scheduled events**
> (`admission_surge`, `staff_shortage`) and **never reads the other three fields**;
> sentinel output is byte-identical with and without extreme-weather and war events over
> 20 world ticks."

Corroborated by `docs/handoffs/DR-HANDOFF-2026-09-01-...md`:

> "There is **no case for `admission_surge` or `staff_shortage`** and no default handler —
> both events are dequeued and silently ignored."

### Which "inert" is it?

The four candidate meanings are **materially different findings**. Resolving this is the
point of the reconciliation.

| # | Meaning | Applies to the reopening paper? | Applies to the current state? |
|---|---|---|---|
| 1 | Implementation absent | **YES** — DR had no cases for the scheduled events; they were silently dropped | **NO** — DR now has cases for all four (`world.js:296-315`) |
| 2 | Implementation present but below DR thresholds | No — nothing was reaching DR | **YES** — `m = 1.3 < 1.50`; `p = 0.4 < 0.475` |
| 3 | Implementation present but semantically divergent | Not assessed | **YES** — additive vs multiplicative; vocabulary disjoint |
| 4 | Implementation present but endpoint-insensitive | Not assessed | **YES** — `mortalityPressure` absent; `admissionSurge` unreachable |

### Reconciliation

- The reopening paper's "inert" is **meaning (1): implementation absent**. That was correct
  for its date.
- **Meaning (1) is superseded** by the Phase E coupling work: DR now dispatches all four
  macro events.
- The **current** inertness is a *different phenomenon* — a combination of **(2) below
  threshold**, **(3) semantically divergent**, and **(4) endpoint-insensitive**.

**Conclusion:** the word "inert" describes **two different failures at two different
times**. Citing the reopening paper as evidence for the current state would be incorrect;
so would claiming the current state refutes it. They are sequential, not contradictory.

```
REOPENING AUDIT RECONCILED = SUPERSEDED (meaning 1), not refuted
```

---

## I. Jev review

Jev (`jev-1.13.0`) was given P-002, the reconciliation matrix, the code-grounded
findings, the calibration results and the reopening-audit finding. 3 question sets,
22 questions. Jev was instructed not to invent missing semantics.

### I.1 Authority and classification

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Was P-002 correctly treated as primary authoritative? | 1.86 | **Yes** | 0.79 |
| Is `admissionMultiplier` = IMPLEMENTATION DIVERGENCE correct? | 1.33 | **Partially** | 0.40 `[low]` |
| Is `supplyChainPressure` = CONFORMING correct? | 1.91 | **Yes** | 0.86 |
| Is `activeDisasterType` = DR CONSUMPTION DIVERGENCE correct? | 1.62 | **Yes** | 0.42 |
| Is `staffAvailabilityModifier` = CONFORMING correct? | 1.93 | **Yes** | 0.90 |
| Is `diagnosisWeightOverrides` = DEAD / UNCONSUMED correct? | 1.84 | **Yes** | 0.76 |
| Is climate `severity` = SPECIFICATION AMBIGUOUS correct, and is non-transmission not a divergence? | 1.96 | **Yes** | 0.95 |
| Is the declaration-line vs narrative-examples nuance handled correctly? | 1.90 | **Yes** | 0.85 |

### I.2 Specification vs behaviour, and the reopening audit

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Has implementation behaviour been mistaken for specification? | 0.67 | **Partially** | 0.00 `[low]` |
| Were the calibration results used correctly (behaviour, not specification)? | 1.93 | **Yes** | 0.90 |
| Is "inert" correctly interpreted as meaning (1) implementation absent? | 1.95 | **Yes** | 0.93 |
| Is SUPERSEDED (not refuted, not current) the right disposition? | 1.93 | **Yes** | 0.90 |
| Is the four-way "inert" distinction meaningful and correctly applied? | 1.92 | **Yes** | 0.88 |
| Is the current inertness correctly characterised as below-threshold + divergent + endpoint-insensitive? | 1.83 | **Yes** | 0.74 |

### I.3 Correction boundary

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Is it correct that NO discrepancy is MUST CORRECT outright? | 1.85 | **Yes** | 0.78 |
| Is SPECIFICATION CHANGE REQUIRED right for `admissionMultiplier`? | 1.68 | **Yes** | 0.53 |
| Is SPECIFICATION CHANGE REQUIRED right for the vocabulary? | 1.80 | **Yes** | 0.70 |
| Is UNRESOLVED right for `diagnosisWeightOverrides`? | 1.78 | **Yes** | 0.66 |
| Is the correction boundary sufficient? | 0.77 | **Mostly sufficient** | 0.35 `[low]` |
| Does any proposed correction lack specification support? | 0.58 | **Partially** | 0.13 `[low]` |
| Is the P-002 imprecision finding justified? | 1.88 | **Yes** | 0.82 |
| Is the identified minimum correction set actually sufficient? | 0.80 | **Partially** | 0.00 `[low]` |

### I.4 Where Jev agrees with KE

- **P-002 was correctly treated as primary authoritative** (1.86, conf 0.79).
- **The reopening-audit reconciliation is correct** (1.95, conf 0.93) — Jev's strongest
  verdict in this review.
- **The four-way "inert" distinction is meaningful and correctly applied** (1.92, conf 0.88).
- **"Inert" = meaning (1), now superseded, not refuted** (1.93, conf 0.90).
- **`severity` = SPECIFICATION AMBIGUOUS, and non-transmission is not a divergence from
  P-002** (1.96, conf 0.95).
- **`supplyChainPressure` = CONFORMING** (1.91, conf 0.86) — quantization correctly treated
  as a DR model property.
- **`staffAvailabilityModifier` = CONFORMING** (1.93, conf 0.90).
- **`diagnosisWeightOverrides` = DEAD / UNCONSUMED rather than divergence** (1.84, conf 0.76).
- **The nuance (declaration line vs narrative examples) is handled correctly** (1.90, conf 0.85).
- **The P-002 imprecision finding is justified** (1.88, conf 0.82).
- **No discrepancy qualifies as MUST CORRECT outright** (1.85, conf 0.78).
- **The calibration results were used correctly, as behaviour not specification**
  (1.93, conf 0.90).

### I.5 Where Jev disagrees with KE

1. **`admissionMultiplier` classification — only Partially correct (1.33, conf 0.40).**
   Jev does not fully accept IMPLEMENTATION DIVERGENCE. **KE response:** this aligns with
   the nuance already recorded in §B — P-002's *declaration line* ("1.0 = baseline") is
   satisfied; only its *narrative examples* are unreachable. Jev's partial verdict
   strengthens the case that this is a **specification ambiguity**, not a clean code
   divergence. **Recorded; not resolved.**
2. **Possible behaviour-mistaken-for-specification (0.67, conf 0.00).** Jev flags a
   partial concern but does not identify where. **Recorded as an open item, not resolved.**
3. **Some proposed corrections may lack specification support (0.58, conf 0.13).**
   **Recorded as an open item.**
4. **The correction boundary is only "Mostly sufficient" (0.77).**
5. **The minimum correction set is only Partially sufficient (0.80, conf 0.00).**
   Jev does not confirm that the identified minimum is adequate.

### I.6 Jev proposals

**None recorded.** Jev did not propose a semantic interpretation unsupported by project
evidence, so no item requires the `JEV PROPOSAL — NOT PROJECT FACT` label.

---

## M. Final status

```text
P-002 RECONCILIATION:
  COMPLETE. docs/experiments/P-002-IMPLEMENTATION-RECONCILIATION.md
  P-002 treated as primary authoritative [Jev 1.86, conf 0.79].
  P-002 NOT modified. Frozen Phase F NOT modified.
  No production patch, no adapter tuning, no DR change, no Phase F rerun,
  no N=50, no Monte Carlo, no manuscript change.

CONFORMING FIELDS:
  supplyChainPressure        range 0-1 respected; thresholding/time quantization
                             are DR model properties, NOT adapter divergences,
                             because P-002 promises a range, not continuity.
                             [Jev 1.91, conf 0.86]
  staffAvailabilityModifier  range 0-1 respected; consumed by DR. No endpoint
                             effect, but P-002 never promised one.
                             [Jev 1.93, conf 0.90]
  activeDisasterType         CONFORMING for the values it does emit
                             (natural-disaster -> earthquake).

IMPLEMENTATION DIVERGENCES:
  admissionMultiplier        P-002's "x 2.5" example is UNREACHABLE: the
                             implementation is additive (1.0 + 0.3w + 0.2k) with
                             w <= 1 (climate emits at most one weather event per
                             tick) and k <= 5 (nations with a relation < -60),
                             giving m_max = 2.3 < 2.5. Ordinary emitted value 1.3.
                             NUANCE: P-002's interface declaration line says only
                             "1.0 = baseline" (satisfied); the multiplicative scale
                             appears only in narrative/validation tables.
                             [Jev: only Partially correct, 1.33, conf 0.40 -
                             consistent with the nuance; strengthens the reading
                             that this is a specification ambiguity]

DR CONSUMPTION DIVERGENCES:
  activeDisasterType         P-002 names "pandemic, earthquake, etc."; the adapter
                             emits ONLY "natural-disaster". P-002's only named
                             example "pandemic" has NO DR mapping. mass-casualty is
                             recognized by DR but never emitted. The adapter emits
                             a CATEGORY where P-002 names SCENARIO TYPES.
                             [Jev 1.62, conf 0.42]

SPECIFICATION CHANGES REQUIRED:
  admissionMultiplier scale semantics (multiplicative vs additive)
  activeDisasterType authoritative vocabulary + DR mappings
  climate severity transmission (or explicit non-transmission)
  primary endpoint selection
  (NO item qualifies as MUST CORRECT TO CONFORM TO P-002 outright - in every case
   the authoritative text is narrative rather than declarative, or silent.
   [Jev 1.85, conf 0.78])
  Jev: the correction boundary is only "Mostly sufficient" (0.77) and the minimum
  correction set only "Partially" sufficient (0.80, conf 0.00).

UNRESOLVED:
  diagnosisWeightOverrides   declared in P-002, never scheduled, never consumed;
                             lifecycle unknown. Classified DEAD / UNCONSUMED
                             rather than divergence because P-002 does not
                             establish it as required behaviour.
                             [Jev 1.84, conf 0.76; UNRESOLVED correct, 1.78]
  plus: possible behaviour-mistaken-for-specification (Jev 0.67, conf 0.00);
        possible corrections lacking specification support (Jev 0.58, conf 0.13);
        P-002's narrative naming drift (admissionRateMultiplier, staffAbsenteeism %).

REOPENING AUDIT RECONCILED:
  YES - SUPERSEDED, NOT REFUTED. [Jev 1.95, conf 0.93; four-way distinction 1.92]
  The reopening paper's "inert" = meaning (1) implementation absent (DR had no cases
  for the scheduled events). Correct for its date; superseded by the Phase E coupling
  work (DR now dispatches all four macro events).
  The CURRENT inertness is a DIFFERENT phenomenon: meaning (2) below DR thresholds
  (m=1.3 < 1.50; p=0.4 < 0.475) + meaning (3) semantically divergent (additive vs
  multiplicative; disjoint vocabulary) + meaning (4) endpoint-insensitive
  (mortalityPressure structurally absent; admissionSurge threshold-unreachable).
  Citing the paper as evidence for the current state would be incorrect; claiming the
  current state refutes it would also be incorrect. Sequential, not contradictory.

JEV VERDICT:
  Confirms P-002 correctly authoritative (1.86); reopening-audit reconciliation
  correct (1.95, conf 0.93); four-way inert distinction valid (1.92); inert =
  meaning (1) superseded (1.93); severity SPECIFICATION AMBIGUOUS (1.96, conf 0.95);
  supplyChainPressure CONFORMING (1.91); staffAvailabilityModifier CONFORMING (1.93);
  diagnosisWeightOverrides DEAD not divergence (1.84); nuance handled correctly (1.90);
  P-002 imprecision finding justified (1.88); no MUST CORRECT outright (1.85);
  calibration used correctly (1.93).
  Qualifies: admissionMultiplier classification only Partially correct (1.33,
  conf 0.40); possible behaviour-mistaken-for-specification (0.67, conf 0.00);
  possible corrections lacking specification support (0.58, conf 0.13); correction
  boundary only Mostly sufficient (0.77); minimum correction set only Partially
  sufficient (0.80, conf 0.00).
  No unsupported semantic interpretation proposed -> no "JEV PROPOSAL" item.

CORRECTION BOUNDARY:
  SPECIFICATION CHANGE REQUIRED - admissionMultiplier scale semantics;
                                 activeDisasterType vocabulary;
                                 climate severity transmission;
                                 primary endpoint
  UNRESOLVED                   - diagnosisWeightOverrides lifecycle
  OPTIONAL MODELING CHANGE     - supplyChainPressure response shape;
                                 staffAvailabilityModifier endpoint effect
  MUST CORRECT TO CONFORM       - NONE outright
  Nothing implemented.

PHASE F RERUN ELIGIBLE: NO
  Blockers unchanged: the interface contract is not precise enough to generate
  unambiguous obligations; four specification changes are required first.
```

---

## J. Correction boundary

Classified **without implementing anything**.

| Discrepancy | Classification | Reasoning |
|---|---|---|
| `admissionMultiplier` additive vs P-002's multiplicative examples | **SPECIFICATION CHANGE REQUIRED** (with an alternative `MUST CORRECT` reading) | P-002's interface declaration says only "1.0 = baseline" (satisfied); the multiplicative scale appears in narrative/validation tables. Resolution requires either amending P-002 to declare additive semantics, or changing the adapter to multiplicative. **Which is correct is a modelling decision.** If P-002's examples are treated as binding, this becomes `MUST CORRECT TO CONFORM TO P-002`. |
| `activeDisasterType` vocabulary disjointness (`pandemic` unmapped) | **SPECIFICATION CHANGE REQUIRED** | P-002 gives examples ("etc."), not an enumeration. The authoritative vocabulary must be declared before any adapter change; otherwise a change would be guessing. |
| `diagnosisWeightOverrides` declared-but-untransmitted | **UNRESOLVED** | P-002 does not establish the field as required behavior. Lifecycle unknown. |
| `supplyChainPressure` thresholding/quantization | **OPTIONAL MODELING CHANGE** | P-002 promises a range, not continuity. No conformance gap. Changing DR response shape would be a modelling choice. |
| `staffAvailabilityModifier` no sentinel-endpoint effect | **OPTIONAL MODELING CHANGE** | P-002 does not promise an endpoint effect. |
| climate `severity` transmission | **SPECIFICATION CHANGE REQUIRED** | P-002 is silent. Declaring non-transmission (or defining a mapping) is a specification act. |
| primary endpoint selection | **SPECIFICATION CHANGE REQUIRED** | Not specified in P-002. |

**No item is classified `MUST CORRECT TO CONFORM TO P-002` outright**, because in every
case the authoritative text is either narrative rather than declarative, or silent. This
is itself a significant finding: **the primary specification is not precise enough to
generate unambiguous code obligations.**

---

## K. Historical provenance

- **Frozen Phase F was not modified.**
- **P-002 was not modified.**
- **P-002 does not appear obsolete**, but it **is** internally imprecise: its interface
  declaration and its narrative examples carry different specificity, and one declared
  field has no implementation. This is documented rather than resolved.
- **The current implementation is NOT silently treated as the new specification.**
  Where P-002 and the implementation disagree, the disagreement is recorded as a
  divergence requiring a decision — not as an implicit amendment.

---

## L. Unresolved issues

1. Is P-002's `× 2.5` example **binding** or **illustrative**?
2. What is the authoritative `activeDisasterType` vocabulary, and what are its DR mappings?
3. Is `diagnosisWeightOverrides` deprecated, reserved, planned, or accidental?
4. Is climate `severity` intended to be transmitted at all?
5. Which sentinel endpoint is primary?
6. Does P-002's `admissionRateMultiplier: 1.8` / `staffAbsenteeism: 15%` narrative drift
   constitute an alternative (superseded) naming, or a documentation error?

---

## N. Boundary statement

No production patch. No adapter tuning. No DR change. No threshold or severity change.
No Phase F rerun. No N=50. No Monte Carlo. No manuscript change. P-002 was not modified.
Frozen Phase F was not modified.

---

## O. Artifacts

- This reconciliation: `docs/experiments/P-002-IMPLEMENTATION-RECONCILIATION.md`
- Companion data: `experiment-results/adapter-dr-calibration/p002-reconciliation.json`
- P-002 (unmodified): `docs/proposals/P-002-deers-rock-adapter.md`
- Semantic provenance audit: `docs/experiments/INTERFACE-SEMANTICS-PROVENANCE-AUDIT.md`
- Calibration: `docs/experiments/ADAPTER-DR-CALIBRATION.md`
