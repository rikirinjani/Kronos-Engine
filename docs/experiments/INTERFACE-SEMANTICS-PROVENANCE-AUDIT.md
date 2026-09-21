# Interface Semantics Provenance Audit

**Date:** 2026-09-21
**Purpose:** Determine whether the intended semantics of the adapter fields already exist in authoritative project evidence, before writing any Interface Specification v2.
**Scope:** Audit only. No mapping change, no adapter change, no DR change, no threshold/severity change, no Phase F rerun, no N=50, no Monte Carlo, no manuscript change.
**Prior artifact (not modified):** `docs/experiments/KRONOS-DR-INTERFACE-SPECIFICATION.md`

---

## 0. Headline — a correction to the previous specification

The previous specification asserted that **"the interface has no declared semantic
contract."** **That assertion was wrong.**

`docs/proposals/P-002-deers-rock-adapter.md` — the authoritative adapter design
proposal — **does declare semantics**, including explicit ranges for two fields:

```typescript
interface MacroConditionPacket {
  tick: number;                                     // world tick
  admissionMultiplier: number;                      // 1.0 = baseline
  diagnosisWeightOverrides: Record<string, number>; // ICD code → weight
  supplyChainPressure: number;                      // 0-1
  staffAvailabilityModifier: number;                // 0-1
  activeDisasterType?: string;                      // pandemic, earthquake, etc.
}
```

The correct finding is narrower and more interesting: **semantics are declared, but
the implementation contradicts them in two places, one declaration was never
implemented, and one field is not declared anywhere.**

---

## 1. Authoritative sources searched

| # | Source | Type | Date | Authority | Status |
|---|---|---|---|---|---|
| S1 | `docs/proposals/P-002-deers-rock-adapter.md` | Design proposal | 2026-06-29 | **Authoritative for adapter design intent** | Carries a 2026-08-31 status note qualifying its claims as "design intent, not current behavior" |
| S2 | `src/sectors/contracts/deers-rock-sentinel.md` | Sector contract | — | Authoritative for sector state/events/invariants | Silent on macro-packet field semantics |
| S3 | `docs/sentinel-integration-map.md` | Depth ledger | 2026-08-31 | Authoritative for wiring status | Documents inbound `health.*` as UNIMPLEMENTED |
| S4 | `docs/audits/REOPEN-AUDIT-2026-08-31.md` | Audit | 2026-08-31 | Authoritative audit | Flags packet-parameter calibration as ABSENT |
| S5 | `docs/handoffs/DR-HANDOFF-2026-09-01-adapter-consumption-path.md` | KE→DR handoff | 2026-09-01 | Authoritative for its date | **STALE — superseded by Phase E** |
| S6 | `docs/experiments/admission-threshold-design.md` | Experiment design | 2026-09-10 | **Self-classified "EXPLORATORY — NON-CANONICAL"** | Implementation trace only |
| S7 | `Deers-Rock/reopen-audit/paper/deers-rock-reopening-paper.md` | DR reopening paper | — | Authoritative audit (DR repo) | Independently finds the channel **inert** |
| S8 | `src/sectors/deers-rock-adapter.ts` (comments) | Implementation | — | Implementation | No semantic declarations beyond code |
| S9 | `Deers-Rock/dist/engine/*.js` | Implementation | — | Implementation | No semantic declarations |

**Not searched as authoritative:** the recent analysis artifacts
(`CROSS-SECTOR-DIMENSIONAL-AUDIT`, `SENTINEL-OBSERVABILITY-DIAGNOSTIC`,
`ADAPTER-DR-CALIBRATION`, `KRONOS-DR-INTERFACE-SPECIFICATION`) — these are the
present investigation, not prior evidence.

### Notable prior finding (S7)

The DR reopening paper independently reached the same conclusion this investigation
has been re-deriving:

> "the macro→micro channel is **inert**: the adapter computes a five-field
> MacroConditionPacket but DR's tick dispatcher drops the only two scheduled events
> (`admission_surge`, `staff_shortage`) and never reads the other three fields;
> sentinel output is byte-identical with and without extreme-weather and war events
> over 20 world ticks."

This is a **prior, independent confirmation** of the observability finding.

---

## 2. Field-by-field semantic provenance

### 2.1 `admissionMultiplier`

| Attribute | Record |
|---|---|
| **CLAIM** | "`admissionMultiplier: number; // 1.0 = baseline`" and "Pandemic declared → `admissionMultiplier` × 2.5" and "Pandemic → `admissionMultiplier = 2.5` ✅ Valid" |
| **SOURCE** | S1 (`P-002`), lines 176, 81, 257 |
| **SOURCE TYPE** | Design proposal |
| **EXPLICIT vs INFERRED** | **EXPLICIT** for "1.0 = baseline"; **EXPLICIT** for the multiplicative scale example |
| **IMPLEMENTATION CONSISTENT?** | **NO** — see contradiction C1 |

The declared baseline semantics ("1.0 = baseline") **are** consistent with the
implementation. The declared **scale semantics** ("× 2.5") are **not**.

### 2.2 `supplyChainPressure`

| Attribute | Record |
|---|---|
| **CLAIM** | "`supplyChainPressure: number; // 0-1`" |
| **SOURCE** | S1 (`P-002`), line 178 |
| **SOURCE TYPE** | Design proposal |
| **EXPLICIT vs INFERRED** | **EXPLICIT** — an explicit valid range is declared |
| **IMPLEMENTATION CONSISTENT?** | **YES** — adapter emits {0, 0.4}; DR clamps to [0, 1] |

### 2.3 `activeDisasterType`

| Attribute | Record |
|---|---|
| **CLAIM** | "`activeDisasterType?: string; // pandemic, earthquake, etc.`" |
| **SOURCE** | S1 (`P-002`), line 180 |
| **SOURCE TYPE** | Design proposal |
| **EXPLICIT vs INFERRED** | **EXPLICIT** (categorical vocabulary implied by examples) |
| **IMPLEMENTATION CONSISTENT?** | **NO** — see contradiction C2 |

### 2.4 `staffAvailabilityModifier`

| Attribute | Record |
|---|---|
| **CLAIM** | "`staffAvailabilityModifier: number; // 0-1`"; also "Pandemic → ... reduce staff availability"; narrative form "`staffAbsenteeism: 15%`" |
| **SOURCE** | S1 (`P-002`), lines 179, 75, 24 |
| **SOURCE TYPE** | Design proposal |
| **EXPLICIT vs INFERRED** | **EXPLICIT** for the range; the narrative form uses a different name and unit |
| **IMPLEMENTATION CONSISTENT?** | **YES** for range — adapter emits {1.0, 0.85} ⊂ [0,1] |

### 2.5 `diagnosisWeightOverrides`

| Attribute | Record |
|---|---|
| **CLAIM** | "`diagnosisWeightOverrides: Record<string, number>; // ICD code → weight`"; also "`respiratoryCaseWeight: +40%`" |
| **SOURCE** | S1 (`P-002`), lines 177, 23 |
| **SOURCE TYPE** | Design proposal |
| **EXPLICIT vs INFERRED** | **EXPLICIT** for the mapping form; **no range declared** |
| **IMPLEMENTATION CONSISTENT?** | **N/A — never implemented.** S5 records it as never scheduled; the current adapter still never consumes it |

### 2.6 climate `severity`

| Attribute | Record |
|---|---|
| **CLAIM** | **None found** |
| **SOURCE** | — |
| **SOURCE TYPE** | — |
| **EXPLICIT vs INFERRED** | **NEITHER — no authoritative claim exists** |
| **IMPLEMENTATION CONSISTENT?** | N/A — the adapter never reads it |

No authoritative source in either repository specifies what the climate event
`severity` is intended to mean, what its range is, or how it should relate to the
DR scenario severity.

### 2.7 Summary table

| FIELD | CLAIM | SOURCE | SOURCE TYPE | EXPLICIT vs INFERRED | IMPL. CONSISTENT? |
|---|---|---|---|---|---|
| `admissionMultiplier` | 1.0 = baseline; × 2.5 for pandemic | S1 P-002 | Design proposal | EXPLICIT | **NO** (C1) |
| `supplyChainPressure` | range 0-1 | S1 P-002 | Design proposal | EXPLICIT | YES |
| `activeDisasterType` | "pandemic, earthquake, etc." | S1 P-002 | Design proposal | EXPLICIT | **NO** (C2) |
| `staffAvailabilityModifier` | range 0-1 | S1 P-002 | Design proposal | EXPLICIT | YES |
| `diagnosisWeightOverrides` | ICD code → weight | S1 P-002 | Design proposal | EXPLICIT (no range) | N/A (never implemented) |
| climate `severity` | — | — | — | NONE | N/A (never read) |

---

## 3. Behavioral characterization vs semantic specification

The previous specification conflated these. They are distinct and must remain so.

### Behavioral characterization
**What the implementation demonstrably does.** Established by measurement.

- `admissionMultiplier`: 3-state staircase, steps at 1.50 / 2.00
- `supplyChainPressure`: dead ≤0.450, onset 0.475, saturates ≥0.525
- `activeDisasterType`: categorical; `natural-disaster` → earthquake
- `staffAvailabilityModifier`: integer-floor outpatient capacity; no effect on sentinel endpoints

### Semantic specification
**What the field is declared to mean.** Established by authoritative source.

- `admissionMultiplier`: "1.0 = baseline"; multiplicative scale ("× 2.5") — **S1**
- `supplyChainPressure`: "0-1" — **S1**
- `activeDisasterType`: disaster type from a vocabulary including pandemic, earthquake — **S1**
- `staffAvailabilityModifier`: "0-1" — **S1**
- `diagnosisWeightOverrides`: "ICD code → weight" — **S1**
- climate `severity`: **not declared anywhere**

### Interface contract
The combination of semantic meaning, units, valid domain, transformation, temporal
semantics, and target interpretation. **No complete interface contract exists** —
but this is because of *gaps and contradictions*, not because nothing is declared.

**The calibration results belong in the behavioral-characterization category.**
A measured threshold is not a semantic definition.

### Required terminology correction to the previous specification

| Previous wording | Corrected wording |
|---|---|
| "the interface has no declared semantic contract" | **"the interface has a partially declared semantic contract that the implementation contradicts in two places, omits in one place, and never implemented in another"** |
| fields classified as `UNSPECIFIED` for semantic meaning | **incorrect for `supplyChainPressure` and `staffAvailabilityModifier`** (ranges are declared) and for the meanings of all five fields (declared in S1) |
| fields classified as "DEFINED BUT QUANTIZED" | **behaviourally defined, semantically declared-and-contradicted** where C1/C2 apply |

The previous specification is **not modified**; this correction is recorded here.

---

## 4. Contradictions

### C1 — `admissionMultiplier`: multiplicative declaration vs additive implementation

| | Declaration (S1) | Implementation |
|---|---|---|
| Semantics | multiplicative scale | additive accumulation |
| Example | "Pandemic → `admissionMultiplier = 2.5`" | `1.0 + 0.3×w + 0.2×k` |
| Reaching 2.5 | set directly by a pandemic | requires `w + k ≥ 5` in one tick |
| Reachability of 2.5 | trivially | **climate caps at 1 event/tick** (S6), so `w ≤ 1`; `k ≥ 4` wars in one tick required |

The declared example is **unreachable** under the implemented formula. This is a
genuine semantic contradiction, not a mere difference of notation.

### C2 — `activeDisasterType`: declared vocabulary vs emitted value

| | Declaration (S1) | Implementation |
|---|---|---|
| Vocabulary | "pandemic, earthquake, etc." | emits **only** `"natural-disaster"` |
| DR mapping | — | `natural-disaster` → earthquake; `mass-casualty` → mass_casualty |

The declared example type **"pandemic" has no DR mapping at all**. The declared
vocabulary and the implemented vocabulary are disjoint.

### C3 — S5 handoff is stale (not a true contradiction)

S5 (2026-09-01) states: *"Only 2 of 5 macro fields are scheduled into DR's queue
(`admissionMultiplier`, `staffAvailabilityModifier`). The other 3
(`diagnosisWeightOverrides`, `supplyChainPressure`, `activeDisasterType`) are never
scheduled at all"* and *"There is no case for `admission_surge` or `staff_shortage`"*.

**The current implementation schedules 4 of 5** (`admission_surge`,
`staff_shortage`, `supply_chain_pressure`, `active_disaster`) and the DR dispatcher
**has cases for all four**. S5 was superseded by the Phase E coupling work.

**Recorded as stale, not as a live contradiction.** S5 remains accurate for its date.

### C4 — `diagnosisWeightOverrides`: declared but never implemented

Declared in S1 with semantics ("ICD code → weight"). S5 records it as never
scheduled. The current adapter still never consumes it. **Declared, never built.**

### C5 — S1's own authority is qualified

S1 carries a 2026-08-31 status note: the proposal's bidirectional claims "should be
read as **design intent**, not current behavior." This does not invalidate the
`MacroConditionPacket` field declarations (which are structural, not behavioural),
but it does mean S1 is authoritative for **intent**, not for **current state**.

---

## 5. Provenance classification

| Field | Classification |
|---|---|
| `admissionMultiplier` | **CONTRADICTORY** (declared multiplicative, implemented additive) |
| `supplyChainPressure` | **EXPLICITLY SPECIFIED** (range declared; implementation consistent) |
| `activeDisasterType` | **CONTRADICTORY** (declared vocabulary disjoint from emitted vocabulary) |
| `staffAvailabilityModifier` | **EXPLICITLY SPECIFIED** (range declared; implementation consistent) |
| `diagnosisWeightOverrides` | **IMPLICIT BUT DOCUMENTED** (semantics declared, no range, never implemented) |
| climate `severity` | **UNDEFINED** (no authoritative claim in either repository) |

**No field is "IMPLEMENTATION-ONLY" in the strict sense** — every packet field has
at least a declared form in S1. The problem is contradiction and omission, not
absence of intent.

---

## 6. Unresolved semantic decisions

Derived from the audit. Each item states what is known, what is unknown, why
existing evidence cannot resolve it, and what decision is required.

### D1 — `admissionMultiplier` scale semantics

1. **Known:** "1.0 = baseline" (S1); implementation is additive `1.0 + 0.3w + 0.2k`; DR response is a 3-state staircase.
2. **Unknown:** whether the field is intended to be **multiplicative** (S1's "× 2.5") or **additive** (implementation).
3. **Why evidence cannot resolve it:** S1 and the implementation disagree; no source adjudicates. S1's authority is qualified as "design intent"; S6 (the only design doc addressing the multiplier) is self-classified NON-CANONICAL.
4. **Decision required:** declare the intended scale semantics, and state whether a 3-state DR target is acceptable.

### D2 — `admissionMultiplier` reachable domain

1. **Known:** climate emits ≤1 weather event/tick; wars are the only route to higher values and are rare.
2. **Unknown:** whether the declared examples (e.g. 2.5) are intended to be reachable at all.
3. **Why evidence cannot resolve it:** reachability depends on the intended semantics (D1) which is unresolved.
4. **Decision required:** follows from D1.

### D3 — `activeDisasterType` vocabulary

1. **Known:** S1 declares "pandemic, earthquake, etc."; implementation emits only `natural-disaster`; DR maps `natural-disaster` and `mass-casualty`.
2. **Unknown:** the intended vocabulary, and whether unimplemented types are planned or abandoned.
3. **Why evidence cannot resolve it:** S1 gives examples, not an enumeration; no mapping table exists for "pandemic".
4. **Decision required:** declare the authoritative type vocabulary and its DR mappings.

### D4 — climate `severity` transmission

1. **Known:** climate severity is an unbounded magnitude; DR scenario severity is a normalised [0,1] interpolation parameter; the adapter never reads climate severity; the macro override hardcodes 0.6.
2. **Unknown:** whether severity is intended to be transmitted at all.
3. **Why evidence cannot resolve it:** **no authoritative source mentions the relationship.** S1 does not list severity in the packet.
4. **Decision required:** declare either that severity is intentionally not transmitted, or define a normalisation with an explicit rationale.

### D5 — `diagnosisWeightOverrides` lifecycle

1. **Known:** declared in S1 with semantics; never scheduled; never consumed; DR has its own ICD mechanism via `SCENARIO_DEFS.icdWeights`.
2. **Unknown:** deprecated / reserved / planned / accidental.
3. **Why evidence cannot resolve it:** no source states an intent; S5 records only that it is not scheduled.
4. **Decision required:** resolve the lifecycle, or declare it out of scope.

### D6 — `supplyChainPressure` temporal semantics

1. **Known:** range declared as 0-1 (S1); DR evaluates it only at `clock.tick % 50`; the resulting response is a step.
2. **Unknown:** whether restock-boundary time quantization is acceptable.
3. **Why evidence cannot resolve it:** S1 declares a range but not temporal semantics.
4. **Decision required:** declare the intended temporal semantics.

### D7 — primary endpoint selection

1. **Known:** `supplyStress` is threshold- and horizon-limited; `mortalityPressure` is structurally absent; `admissionSurge` is threshold-unreachable; `icuOccupancyRate` is the most responsive.
2. **Unknown:** which endpoint the interface is intended to serve.
3. **Why evidence cannot resolve it:** S1 declares `HospitalSentinelOutput` fields and their meanings but not which is primary.
4. **Decision required:** declare the primary endpoint.

---

## 7. Dead field — `diagnosisWeightOverrides`

```
semantic status:   IMPLICIT BUT DOCUMENTED (S1: "ICD code → weight"; no range)
implementation:    declared, populated, returned, NEVER consumed
lifecycle status:  UNKNOWN (deprecated / reserved / planned / accidental)
```

No authoritative evidence resolves the lifecycle. **Not invented.** The field is
retained as documented-but-dead pending a decision (D5).

---

## 8. Severity mapping status

Two distinct quantities, kept separate:

| | Kronos climate severity | DR scenario severity |
|---|---|---|
| **Definition** | `climate.ts:152`: `1 + rng×4 + temperatureAnomaly×0.5` | `_scenario.active.severity` |
| **Behavior** | increases with temperature anomaly; unbounded in construction | interpolates `surgeMin`→`surgeMax`; also drives `currentMortalityBoost` via phase |
| **Units** | unbounded magnitude (no unit declared) | normalised interpolation parameter |
| **Range** | intended ≈1–7.5 for the designed CO₂ ladder; observed ≈30 under the coupling defect; **not declared anywhere** | [0,1]; native DR sampling ≈[0.3, 1.0]; macro override fixed at 0.6 |
| **Authoritative mapping** | **NONE FOUND** | — |

```
MAPPING STATUS = UNDEFINED
```

No normalization formula is created here.

---

## 9. Minimum decisions required for a legitimate interface contract

| # | Decision | Type |
|---|---|---|
| D1 | `admissionMultiplier` scale semantics (multiplicative vs additive) + acceptability of a 3-state DR target | modelling |
| D2 | `admissionMultiplier` intended reachable domain (follows from D1) | modelling |
| D3 | `activeDisasterType` authoritative vocabulary + DR mappings | modelling |
| D4 | climate `severity` transmission (or explicit non-transmission) | modelling |
| D5 | `diagnosisWeightOverrides` lifecycle | housekeeping |
| D6 | `supplyChainPressure` temporal semantics | modelling |
| D7 | primary endpoint | measurement design |

**A legitimate interface contract requires D1, D3, D4 and D7 at minimum.** D2
follows from D1. D5 and D6 are required for completeness.

---

## 10. Jev adversarial review

Jev (`jev-1.13.0`) was given the source inventory, the previous specification, the
calibration results, and the behavioural/semantic distinction. 3 question sets,
22 questions. Jev was instructed not to invent missing semantics.

### 10.1 Provenance integrity

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Does every semantic claim have an authoritative source? | 1.38 | **Partially** | 0.06 `[low]` |
| Has implementation behaviour been promoted into semantics? | 0.11 | **No** | 0.84 |
| Is any unresolved modelling decision hidden? | 0.22 | **No** | 0.67 |
| Is the correction of the previous specification adequate? | 1.80 | **Yes** | 0.69 |
| Is C1 (multiplicative declaration vs additive implementation) a genuine contradiction? | 1.97 | **Yes** | 0.95 |
| Is C2 (declared vocabulary vs emitted vocabulary) a genuine contradiction? | 1.76 | **Yes** | 0.64 |
| Is C3 correctly classified as stale rather than contradictory? | 1.97 | **Yes** | 0.95 |
| Is `MAPPING STATUS = UNDEFINED` correct for severity? | 1.95 | **Yes** | 0.92 |

### 10.2 Classification justification

| Field classification | Score | Verdict | Conf |
|---|---|---|---|
| `admissionMultiplier` → CONTRADICTORY | 1.97 | **Yes** | 0.96 |
| `supplyChainPressure` → EXPLICITLY SPECIFIED | 1.98 | **Yes** | 0.97 |
| `activeDisasterType` → CONTRADICTORY | 1.88 | **Yes** | 0.82 |
| `staffAvailabilityModifier` → EXPLICITLY SPECIFIED | 1.91 | **Yes** | 0.87 |
| `diagnosisWeightOverrides` → IMPLICIT BUT DOCUMENTED | 0.88 | **Partially** | 0.00 `[low]` |
| climate `severity` → UNDEFINED | 1.99 | **Yes** | 0.98 |
| The claim that NO field is strictly IMPLEMENTATION-ONLY | 0.56 | **Partially** | 0.16 `[low]` |

### 10.3 Decision completeness

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Are the seven listed decisions complete? | 0.52 | **Mostly complete** | 0.22 `[low]` |
| Is the audit correct that D1, D3, D4, D7 are the minimum set? | 1.02 | **Partially** | 0.23 `[low]` |
| Is D1 genuinely a modelling decision rather than a recoverable fact? | 0.74 | **Partially** | 0.00 `[low]` |
| Is D5 genuinely housekeeping rather than modelling? | 0.94 | **Partially** | 0.08 `[low]` |
| Can a legitimate interface contract be produced now? | 0.80 | **Partially** | 0.68 |
| Is it likely further authoritative sources exist that were not searched? | 1.18 | **Partially** | 0.18 `[low]` |
| Is the audit sufficient to author a v2 specification? | 0.79 | **Partially** | 0.33 |

### 10.4 Where Jev agrees with KE

- **C1 is a genuine contradiction** (1.97, conf 0.95) — the strongest verdict.
- **C3 is correctly classified as stale, not contradictory** (1.97, conf 0.95).
- **`MAPPING STATUS = UNDEFINED` for severity is correct** (1.95, conf 0.92).
- **`admissionMultiplier` = CONTRADICTORY** (1.97, conf 0.96).
- **`supplyChainPressure` = EXPLICITLY SPECIFIED** (1.98, conf 0.97).
- **climate `severity` = UNDEFINED** (1.99, conf 0.98).
- **`activeDisasterType` = CONTRADICTORY** (1.88, conf 0.82).
- **`staffAvailabilityModifier` = EXPLICITLY SPECIFIED** (1.91, conf 0.87).
- **The correction to the previous specification is adequate** (1.80, conf 0.69).
- **Behaviour has NOT been promoted into semantics** (0.11 → No, conf 0.84).
- **No unresolved decision is hidden** (0.22 → No, conf 0.67).

### 10.5 Where Jev disagrees with KE

1. **"Every semantic claim has an authoritative source" — only Partially (1.38,
   conf 0.06).** Jev does not accept that all claims are fully sourced. **KE
   response:** the lowest-confidence items are the narrative-form claims in S1
   (e.g. `admissionRateMultiplier: 1.8`, `staffAbsenteeism: 15%`), which are
   **terminological drift** rather than declared interface semantics. Recorded as
   an open item, not resolved.
2. **`diagnosisWeightOverrides` classification — only Partially (0.88, conf 0.00).**
   Jev does not fully accept IMPLICIT BUT DOCUMENTED. **Recorded as an open item.**
3. **"No field is strictly IMPLEMENTATION-ONLY" — only Partially (0.56, conf 0.16).**
   Jev doubts the audit's own summary claim. **Not resolved.**
4. **The seven decisions are only "Mostly complete" (0.52)** — Jev does not
   confirm completeness.
5. **The D1/D3/D4/D7 minimum set is only Partially correct (1.02, conf 0.23).**
6. **D1's classification as a modelling decision is only Partially justified
   (0.74, conf 0.00)** — Jev leaves open that it may be recoverable.
7. **D5's classification as housekeeping is only Partially justified (0.94).**
8. **A legitimate contract is only Partially producible now (0.80, conf 0.68).**
9. **Further authoritative sources may exist that were not searched (1.18).**
10. **The audit is only Partially sufficient to author v2 (0.79, conf 0.33).**

### 10.6 Jev proposals

**None recorded.** Jev did not propose a semantic interpretation unsupported by
project evidence, so no item requires the `JEV PROPOSAL — NOT PROJECT FACT` label.

---

## 11. Final status

```text
SEMANTIC PROVENANCE:
  AUDIT COMPLETE. docs/experiments/INTERFACE-SEMANTICS-PROVENANCE-AUDIT.md
  9 authoritative sources searched. Previous specification NOT modified.
  No mapping change, no adapter change, no DR change, no threshold/severity
  change, no Phase F rerun, no N=50, no Monte Carlo, no manuscript change.

  CENTRAL CORRECTION: the previous specification's claim that "the interface has
  no declared semantic contract" was WRONG. Source S1 (P-002, the authoritative
  adapter design proposal) DOES declare semantics and ranges. The correct finding
  is that semantics are declared but CONTRADICTED by the implementation in two
  places, never implemented in one, and absent in one.

FIELDS EXPLICITLY SPECIFIED:
  supplyChainPressure       - range "0-1" declared in S1; implementation consistent
                              [Jev 1.98, conf 0.97]
  staffAvailabilityModifier - range "0-1" declared in S1; implementation consistent
                              [Jev 1.91, conf 0.87]

FIELDS IMPLEMENTATION-ONLY:
  NONE in the strict sense - every packet field has at least a declared form in S1.
  [Jev: only Partially confirmed, 0.56, conf 0.16 - recorded as an open item]
  diagnosisWeightOverrides is the closest case: semantics declared in S1
  ("ICD code -> weight") but NEVER implemented, scheduled, or consumed.
  [Jev classification: only Partially justified, 0.88, conf 0.00]

FIELDS CONTRADICTORY:
  admissionMultiplier - S1 declares MULTIPLICATIVE scale ("x 2.5", "= 2.5");
                        implementation is ADDITIVE (1.0 + 0.3*w + 0.2*k).
                        Reaching 2.5 requires 5 events in one tick; climate emits
                        at most 1 weather event per tick, so it is unreachable.
                        [Jev 1.97, conf 0.95]
  activeDisasterType  - S1 declares "pandemic, earthquake, etc."; implementation
                        emits ONLY "natural-disaster"; the declared example
                        "pandemic" has no DR mapping at all.
                        [Jev 1.88, conf 0.82]
  Also recorded: C3 (the S5 handoff) is STALE, not contradictory - superseded by
  Phase E. [Jev 1.97, conf 0.95]

FIELDS UNDEFINED:
  climate severity - no authoritative claim exists in either repository.
                     [Jev 1.99, conf 0.98]

MODELING DECISIONS REQUIRED:
  D1  admissionMultiplier scale semantics (multiplicative vs additive) and
      acceptability of a 3-state DR target
  D2  admissionMultiplier intended reachable domain (follows from D1)
  D3  activeDisasterType authoritative vocabulary and DR mappings
  D4  climate severity transmission, or explicit non-transmission
  D5  diagnosisWeightOverrides lifecycle
  D6  supplyChainPressure temporal semantics (restock-boundary quantization)
  D7  primary endpoint selection
  Audit states D1, D3, D4, D7 are the minimum set.
  [Jev: decisions only "Mostly complete" (0.52); the minimum-set claim only
   Partially correct (1.02, conf 0.23)]

JEV AGREEMENT:
  C1 genuine contradiction (conf 0.95); C3 correctly stale (conf 0.95);
  severity UNDEFINED correct (conf 0.92); admissionMultiplier CONTRADICTORY
  (conf 0.96); supplyChainPressure EXPLICITLY SPECIFIED (conf 0.97); climate
  severity UNDEFINED (conf 0.98); activeDisasterType CONTRADICTORY (conf 0.82);
  staffAvailabilityModifier EXPLICITLY SPECIFIED (conf 0.87); the correction to
  the previous specification is adequate (1.80); behaviour was NOT promoted into
  semantics (0.11); no unresolved decision is hidden (0.22).

JEV DISAGREEMENT:
  Not all claims fully sourced (1.38, conf 0.06); diagnosisWeightOverrides
  classification only partially justified (0.88, conf 0.00); "no field is
  IMPLEMENTATION-ONLY" only partially confirmed (0.56, conf 0.16); decisions only
  mostly complete (0.52); minimum-set claim only partially correct (1.02);
  D1's status as a modelling decision only partially justified (0.74);
  D5's status as housekeeping only partially justified (0.94); a legitimate
  contract is only partially producible now (0.80); further authoritative sources
  may exist (1.18); the audit is only partially sufficient to author v2
  (0.79, conf 0.33).
  Jev proposed no unsupported semantic interpretation, so no
  "JEV PROPOSAL - NOT PROJECT FACT" item arises.

LEGITIMATE INTERFACE CONTRACT POSSIBLE NOW: NO
  Semantics are declared but contradicted (2 fields), never implemented (1 field)
  and absent (1 field). At minimum D1, D3, D4 and D7 must be resolved. Jev
  concurs only partially (0.80, conf 0.68) and does not confirm the minimum set.
```

---

## 12. Boundary statement

No interface mapping was changed. No adapter change. No DR change. No threshold or
severity change. No Phase F rerun. No N=50. No Monte Carlo. No manuscript change.
The previous specification (`KRONOS-DR-INTERFACE-SPECIFICATION.md`) was **not
modified**; the required terminology correction is recorded in §3 of this document.

Jev did not modify code, did not execute experiments, and proposed no semantic
interpretation unsupported by project evidence.

---

## 13. Artifacts

- This audit: `docs/experiments/INTERFACE-SEMANTICS-PROVENANCE-AUDIT.md`
- Prior specification (unmodified): `docs/experiments/KRONOS-DR-INTERFACE-SPECIFICATION.md`
- Calibration: `docs/experiments/ADAPTER-DR-CALIBRATION.md`
- Observability: `docs/experiments/SENTINEL-OBSERVABILITY-DIAGNOSTIC.md`
- Jev raw responses (not committed): `%TEMP%/opencode/jev-semantics-results.json`
