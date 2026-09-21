# Cross-Sector Dimensional Audit

**Date:** 2026-09-21
**Scope:** Bounded audit of cross-sector quantitative interfaces. Not a general refactor.
**Phases:** A (KE code-grounded verification) → B (KE empirical micro-validation) → C (Jev adversarial review) → D (this report)
**Status:** AUDIT ONLY — no production coupling corrected, no frozen artifact modified, no Phase F rerun, no N=50, no Monte Carlo, no GPU.

---

## 0. Headline

Jev's suspected defect class — *a dimensionless scalar multiplied directly by a raw
USD/GDP delta and assigned to a differently scaled model variable* — is
**confirmed**, and occurs in **three** places, not one. Two of the three are
instantiated in the Phase F world and are **material**.

A **new cascade** was found that neither KE nor Jev had identified: the climate
`severity` term scales with the runaway temperature anomaly, which drives
economy GDP destruction of 44–66% per event and **collapses total GDP by 99.87%**
over 20 ticks.

Two of Jev's earlier claims were **refuted** by KE against the code, and Jev
accepted both corrections (score 1.95, conf 0.93). Jev also **downgraded its own
earlier "Critical" rating** of the `gdpGrowthRate` accumulator from "defect" to
"inference only."

---

## 1. Audit table

| Coupling | Unit status | Instantiated? | Material? | Action |
|---|---|---|---|---|
| economy→climate emissions bridge | **CONFIRMED DEFECT** | yes | **critical** | correction required |
| economy→technology `rdAdjustment` | **CONFIRMED DEFECT** | yes | **material** (saturates) | correction required |
| climate `severity` → economy GDP cascade | **CONFIRMED CASCADE** | yes | **material** (collapses GDP) | correction required |
| GDP growth accumulator | **SUSPECTED / inference only** | yes | marginal in 20 ticks | correction advisable; not blocking |
| economy→geopolitics GDP passthrough | dimensionally consistent | yes | material (feedback) | review; no unit fix |
| `eventChance` ceiling | design clamp | yes | material (removes sensitivity) | redesign consideration |
| geopolitics relations severity shift | scale-driven | yes | material | dependent on severity fix |
| economy→energy `consumptionDelta` | **SUSPECTED UNIT DEFECT** | **no** | none | document; fix before energy is enabled |
| WAR_CASUALTIES normalization | implicit normalization | **no** (era has 0 wars) | none | document; fix before war scenarios |
| economy→demographics | scale-safe (sign only) | **no** | none | no action |

---

## 2. Phase A — KE code-grounded findings

### A1. `gdpGrowthRate`

| Question | Finding | Evidence |
|---|---|---|
| Units/semantics | **percentage rate** (pp per economy tick) | `economy.ts:160-161`: `effectiveGrowth = gdpGrowthRate + growthNoise`; `gdpGrowth = gdp * (effectiveGrowth / 100)` |
| Is `/100` appropriate? | **Yes** | same |
| Accumulation intended? | Partially — random walk is intended; unboundedness appears unintentional | `economy.ts:181` walk `+(rng-0.5)*0.3` |
| Clamp? | **None** | grep across `src/**/*.ts`: no `clamp` on `gdpGrowthRate` |
| Mean reversion? | **None** | contrast `economy.ts:164`: `inflationRate` HAS `meanReversion = (2.0 - inflationRate) * 0.1` |
| Writers | `economy.ts:47` `+2.0` (WAR_START attackers); `:59` `-5.0` (defenders); `:109` `+0.5` (INNOVATION); `:181` random walk | grep |
| Multiple events compound? | Yes — each INNOVATION adds +0.5 permanently | `economy.ts:109` |
| **Phase F activates this path?** | **Only the INNOVATION + walk paths.** `WAR_START` never fires — `era.wars = 0` | diagnostic: 0 wars, 19 innovations |
| Runaway independent of climate? | **Not within 20 ticks.** Mean 2.50 → 3.336 (+0.836 pp); max 4.133; no rate >10 or <−10 | diagnostic |

**Correction to Jev (Phase C item 1).** Jev's earlier review listed `RELATION_SHIFT`
as a `gdpGrowthRate` writer. **It is not** — `geopolitics.ts` does not modify
`gdpGrowthRate` anywhere. Jev's other listed writer, `WAR_START`, is real but
**not instantiated** because the era contains zero wars.

### A2. `technology.rdAdjustment`

| Question | Finding | Evidence |
|---|---|---|
| `gdpDelta` units | USD (per-nation, ~1e11–1e12) | `economy.ts:170` |
| `rdSpending` semantics | dimensionless fraction, clamped to [0.001, 0.1] | `technology.ts:132,152` |
| Intended `rdAdjustment` units | same scale as `researchOutput` | inferred from `:58` |
| Dimensionally meaningful? | **No** — the sector's own tick divides by `1e12`; the handler does not | `technology.ts:116` vs `:57` |
| **Instantiated in Phase F?** | **Yes** — technology cadence 5 | diagnostic |
| Material? | **Yes** — `researchOutput` 0 → 1.151e10; **all 11 nations pinned at the `technologyLevel` ceiling of 100 by tick 5** | diagnostic |

The discrepancy is ~20 orders of magnitude: the sector's own per-tick increment is
~1e-11; the handler contributes ~1e9–1e10.

### A3. Other candidates

| Candidate | Classification |
|---|---|
| `energy.ts:86` `consumptionDelta = gdpDelta * 0.00001` | **SUSPECTED UNIT DEFECT**, same class, **NOT INSTANTIATED** |
| WAR_CASUALTIES `drain * (gdp / 1e13)` | implicit undocumented reference-GDP normalization; **NOT INSTANTIATED** (0 wars) |
| `demographics.ts:67-72` | scale-safe (uses only the sign of `gdpDelta`); **NOT INSTANTIATED** |
| `geopolitics.ts:102` `gdp += gdpDelta` | dimensionally consistent (USD→USD); instantiated; creates bidirectional feedback |
| `climate.ts:152` `severity = 1 + rng*4 + anomaly*0.5` | **CONFIRMED CASCADE** (see §3) |
| `economy.ts:88` `gdpHit = severity*0.02` | **CONFIRMED CASCADE**, no floor on `gdp *=` |

### A4. New finding — severity → GDP collapse cascade

`climate.ts:152`: `severity = round((1 + rng*4 + temperatureAnomaly*0.5)*10)/10`

With the runaway anomaly (42–56), severity ≈ **22–33** (intended order: ~1–5).
`economy.ts:88-92`: `gdpHit = severity * 0.02` ≈ **0.44–0.66**; `gdp *= 1 - gdpHit`.
`eventChance` is saturated at 0.5, so ~10 events occur in 20 ticks.

**Observed: total GDP 5.831e13 → 7.361e10 — a 99.87% collapse**, reaching the
`Math.max(1e9, …)` floor in the tick path. `geopolitics.ts:116`
(`relations -= severity*2`) shifts relations by 44–66 points per event, clamped
at ±100.

This is a **second-order consequence of the climate coupling defect** and is
independent of it in the sense that it is a *separate* scaling error
(`severity` is not bounded to a physically meaningful range).

---

## 3. Phase B — KE empirical micro-validation

**Harness:** `scripts/audit-coupling-diagnostic.ts` (new diagnostic file; no
production code modified). Deterministic, single seed, 20 ticks, CPU only.
**Not** scientific evidence, **not** a Phase F rerun.

```
tick | co2        | anomaly | chance | gdpRate[min/mean/max]  | gdpTotal  | techRO[max] | techLvl[max/mean]
   1 | 2.82e+2    |   0.03  | 0.050  | 2.50/2.50/2.50         | 5.83e+13  | 0.00e+0     |  90.0/ 69.5
   3 | 2.86e+2    |   0.10  | 0.050  | 2.35/2.48/2.61         | 6.00e+13  | 1.03e+10    |  90.0/ 69.5
   4 | 4.93e+6    |  42.31  | 0.500  | 2.35/2.48/2.61         | 6.00e+13  | 1.03e+10    |  90.0/ 69.5
   5 | 9.87e+6    |  45.31  | 0.500  | 2.48/2.80/3.06         | 2.88e+13  | 9.28e+9     | 100.0/100.0
  10 | 4.43e+7    |  51.82  | 0.500  | 2.40/2.95/3.54         | 5.27e+12  | 1.38e+10    | 100.0/100.0
  20 | 1.36e+8    |  56.68  | 0.500  | 2.79/3.34/4.13         | 7.36e+10  | 1.15e+10    | 100.0/100.0
```

Verdicts:
- **A1** `gdpGrowthRate`: drift +0.836 pp; no runaway within horizon; WAR_START never fires.
- **A2** technology: **saturates at the 100 ceiling by tick 5** for every nation.
- **A3** severity cascade: **GDP collapses 99.87%**.
- Reference: `eventChance` saturates at 0.5 from tick 4.

**Acknowledged limitations:** single seed; no replication; **no ablation** (the
climate coupling was not neutralised, so the technology saturation and the GDP
collapse are observed *in the presence of* the climate defect and are not yet
attributed to independent causal edges); the tests observe the system rather than
isolating a single edge; the technology test does not quantitatively separate the
handler contribution from the sector's own tick contribution.

---

## 4. Phase C — Jev adversarial review of the verified state

Jev (`jev-1.13.0`) was re-invoked with the **verified** state (code facts +
diagnostic output), not the earlier summary. 5 question sets, 31 questions.
Two calls required retry (Jev returned HTTP 503/529 under load); all eventually
succeeded.

### 4.1 Unit interpretation

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Is the missing `/1e12` in the technology handler a genuine defect? | 1.54 | **Code-confirmed defect** | 0.31 `[low]` |
| Is the ~20-orders-of-magnitude characterization correct? | 1.61 | **Correct** | 0.41 |
| Is `gdpGrowthRate` a rate (so `/100` is right)? | 1.98 | **Correct** | 0.97 |
| Is the missing clamp/mean-reversion a genuine defect? | 1.03 | **Inference only** | 0.21 `[low]` |
| Are KE's corrections to Jev's own earlier claims valid? | 1.95 | **Valid corrections** | 0.93 |

**Jev observation.** Jev **withdraws** its earlier framing of the
`gdpGrowthRate` issue as a *defect*, reclassifying it as **inference only**. It
also **accepts both of KE's corrections** to its earlier review (WAR_START not
instantiated; `RELATION_SHIFT` is not a writer).

### 4.2 Instantiation and materiality

| Candidate | Score | Verdict | Conf |
|---|---|---|---|
| economy→climate bridge | 1.99 | **Instantiated and material** | 0.98 |
| economy→technology `rdAdjustment` | 1.98 | **Instantiated and material** | 0.97 |
| climate severity → GDP cascade | 2.00 | **Instantiated and material** | 1.00 |
| `gdpGrowthRate` accumulator | 1.76 | Instantiated and material | 0.64 |
| economy→geopolitics passthrough | 1.77 | Instantiated and material | 0.66 |
| `eventChance` ceiling | 1.95 | Instantiated and material | 0.92 |
| geopolitics relations severity shift | 1.89 | Instantiated and material | 0.84 |
| economy→energy | 0.02 | **Not instantiated** | 0.97 |
| WAR_CASUALTIES normalization | 0.41 | **Not instantiated** | 0.38 |
| economy→demographics | 0.00 | **Not instantiated** | 1.00 |

### 4.3 Micro-test adequacy

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Does Test A isolate `gdpGrowthRate`? | 0.18 | **Does not isolate** | 0.73 |
| Does Test B isolate the technology defect? | 0.09 | **Does not isolate** | 0.87 |
| Is a single deterministic seed sufficient? | 0.75 | Partially sufficient | 0.22 `[low]` |
| Is ablation needed? | 1.99 | **Needed** | 0.99 |
| Is KE's severity cascade a genuine additional finding? | 0.82 | Partially genuine | 0.49 |

**Jev observation.** Jev judges **both micro-tests inadequate as isolation
tests**, and **requires ablation** (conf 0.99) before the technology and severity
findings are treated as independent defects.

### 4.4 Coverage gaps

Gap **present**: cadence/timestep mismatch (1.87, conf 0.80); event ordering /
same-tick handler application order (1.89, conf 0.84); non-instantiated sectors
(1.85, conf 0.77); annual-vs-per-tick (1.68); shared RNG across sectors (1.65);
aggregation (1.57); overall "at least one important class unexamined" (1.97,
conf 0.95).
No gap: saturation (0.25), feedback/double-counting (0.23), severity scaling
(0.24) — the latter three are already covered by this audit.

### 4.5 Proceed decision

| Question | Score | Verdict | Conf |
|---|---|---|---|
| Can the corrected experiment safely proceed once only defect (1) is fixed? | 0.09 | **No — further audit needed** | 0.87 |
| Is fixing only the economy→climate bridge sufficient? | 0.02 | **No** | 0.97 |
| Does technology saturation block interpretation? | 0.42 | *see limitation* | 0.38 |
| Does the GDP collapse block interpretation? | 0.44 | *see limitation* | 0.33 |
| Is a systematic (not per-instance) correction approach warranted? | 0.33 | *see limitation* | 0.50 |

**KE methodological limitation (disclosed).** The last three questions were posed
with a *proceed-polarity* criteria scale ("No — further audit needed" → "Yes —
safe to proceed") against *does-X-block* questions. The scale does not match the
question polarity, so those three scores are **ambiguous and are not interpreted
here**. The two unambiguous decision-relevant answers are the first two.

---

## 5. Agreements

1. The scalar-times-USD defect class is real and confirmed in **three** instances.
2. The economy→climate bridge is **instantiated and material** (Jev conf 0.98).
3. The technology `rdAdjustment` is **instantiated and material** (Jev conf 0.97).
4. The severity→GDP cascade is **instantiated and material** (Jev conf 1.00).
5. `gdpGrowthRate` is a **rate**, so `/100` is correct.
6. Fixing only the economy→climate bridge is **not sufficient** (Jev conf 0.97).
7. A corrected Phase F **should not proceed** on the current evidence (Jev conf 0.87).
8. A **systematic** rather than per-instance correction approach is warranted.
9. Non-instantiated sectors (energy, demographics) are genuinely not exercised.

## 6. Disagreements

1. **`gdpGrowthRate` status.** KE classified it as a *structurally valid latent
   defect*. Jev **downgrades it to "inference only"** (1.03, conf 0.21) and
   separately still rates it "instantiated and material" (1.76) in the
   materiality question. **The two Jev answers are in tension and the disagreement
   with KE remains open.**
2. **Micro-test validity.** KE treated the diagnostics as adequate to establish
   the technology and severity findings. Jev judges **both "do not isolate"** and
   **requires ablation** (1.99). KE accepts that the tests are observational and
   not ablative; this remains open.
3. **Severity of the KE new finding.** Jev rates KE's severity cascade only
   "partially genuine" (0.82, conf 0.49) despite separately scoring it
   "instantiated and material" at confidence 1.00. **Internal tension, unresolved.**
4. **Coverage adequacy.** KE treated the audit as bounded and near-complete; Jev
   identifies **six further gap classes**, including cadence mismatch and event
   ordering (conf 0.80–0.84), and rates "at least one important class unexamined"
   at 1.97 (conf 0.95).

---

## 7. Unresolved issues

1. Is the technology saturation an **independent** defect or a consequence of the
   climate defect? **Requires ablation** (Jev: needed, conf 0.99).
2. Is the severity→GDP collapse independent of the emissions bridge? Both trace
   to the runaway anomaly; no ablation was run.
3. Does the **cadence mismatch** (economy 3, technology 5, geopolitics 1,
   climate 1) while handlers fire every tick create additional coupling error?
   Jev: gap present (conf 0.80). Unexamined by KE.
4. Does **same-tick handler application order** matter? Jev: gap present
   (conf 0.84). Unexamined.
5. Is **shared RNG across sectors** creating unintended correlation? Jev: gap
   present (1.65). Partially addressed by the earlier replay-identity check.
6. `gdpGrowthRate` defect status: defect or inference (Jev internal tension).
7. Whether the 20-tick horizon is long enough for `gdpGrowthRate` drift to matter
   at all.

---

## 8. Provenance implications

**Current state.** `experiment-results/phase-f/` and `docs/PHASE-F-DESIGN.md` are
**untracked in git**. Freeze is enforced by convention and file immutability only.

**Jev's recommendation (Phase C, earlier review).** Committing alone is
insufficient (0.33); content hashing needed (1.53); external timestamp needed
(1.52); dedicated frozen ref needed (1.83, conf 0.75).

**KE's determination of the minimum auditable mechanism** (KE owns this call;
Jev's stronger recommendation is noted but KE judges technical necessity):

| Element | KE verdict | Rationale |
|---|---|---|
| Commit artifact set | **Required** | Without a commit SHA the artifacts have no durable identity; any hash is otherwise unattributable |
| Content-hash manifest (committed) | **Required** | Detects later mutation; the existing `manifest.json` records output hashes but is itself uncommitted and unhashed |
| Explicit commit/reference relationship | **Required** | The manifest must name the commit it was produced from, and the commit must contain the manifest |
| Dedicated tag/branch | **Recommended, not required for minimum** | A tag is a movable pointer; the commit SHA already provides immutability. Value is discoverability, not integrity |
| External timestamp anchor | **Recommended, not required for minimum** | Git commit date is self-asserted but sufficient for internal auditability; an external anchor adds third-party non-repudiation if the evidence is to be relied on externally |

**Minimum auditable mechanism:** commit the artifact set; generate a content-hash
manifest over every artifact; commit the manifest; record the producing commit
SHA inside the manifest. This yields a machine-verifiable, tamper-evident,
attributable record using only existing tooling.

**Not done in this task** — provenance repair is a separate action and was not
authorized here.

---

## 9. Recommendation for the corrected Phase F

**Do not proceed to a corrected Phase F run on the current evidence.**

Required before any rerun:
1. **Ablation study** (Jev conf 0.99) separating the climate bridge, the
   technology `rdAdjustment`, and the severity cascade into independent causal
   edges.
2. **Systematic correction of the scalar-times-USD defect class**, not
   per-instance patching — three instances are confirmed and a fourth is
   suspected in a non-instantiated sector.
3. **Severity bounding** — `severity` must not scale without limit off a runaway
   anomaly.
4. **Cadence and event-ordering examination** (Jev gaps, conf 0.80–0.84).
5. **Provenance repair** of the frozen Phase F artifact set.
6. **Statistical redesign** — carried over unresolved from the previous Jev
   review (seed count and test adequacy were already flagged).

**Preservation rule (unchanged).** Any correction must be a new experiment with
a new commit, new experiment ID, new artifact directory and new provenance. The
frozen Phase F artifacts must never be overwritten, renamed, or deleted.

---

## 10. Final output

```text
AUDIT STATUS:
  COMPLETE (bounded cross-sector quantitative interface audit).
  Phase A code-grounded verification: DONE.
  Phase B empirical micro-validation: DONE (single seed, no ablation).
  Phase C Jev adversarial review of verified state: DONE (31 questions).
  Phase D combined report: THIS DOCUMENT.
  No production coupling corrected. No frozen artifact modified.
  No Phase F rerun. No N=50. No Monte Carlo. No GPU used.

CONFIRMED DEFECTS:
  1. economy->climate emissions bridge
     climate.ts:69  annualEmissions += gdpDelta * 0.00005  (USD -> Gt)
     magnitude ~1.97e6x; CO2 282 -> 1.365e8 ppm. [Jev: material, conf 0.98]
  2. economy->technology rdAdjustment
     technology.ts:57  rdAdjustment = gdpDelta * rdSpending * 0.5  (missing /1e12)
     researchOutput 0 -> 1.151e10; all nations pinned at technologyLevel ceiling
     100 by tick 5. [Jev: material, conf 0.97]
  3. climate severity -> economy GDP cascade
     climate.ts:152 severity = 1 + rng*4 + anomaly*0.5  (unbounded in anomaly)
     economy.ts:88  gdpHit = severity*0.02 -> 44-66% GDP loss per event
     total GDP 5.831e13 -> 7.361e10 (99.87% collapse). [Jev: material, conf 1.00]

INSTANTIATED DEFECTS:
  1. economy->climate emissions bridge        (yes)
  2. economy->technology rdAdjustment        (yes)
  3. climate severity -> economy GDP cascade (yes)
  4. eventChance 0.5 ceiling                 (yes; design clamp, material)
  5. geopolitics relations severity shift    (yes; scale-driven)
  6. economy->geopolitics GDP passthrough    (yes; consistent units, feedback risk)
  7. gdpGrowthRate unclamped accumulator     (yes; materiality marginal in 20 ticks)

MATERIAL DEFECTS:
  1. economy->climate emissions bridge        CRITICAL
  2. economy->technology rdAdjustment         MATERIAL (saturates technology)
  3. climate severity -> economy GDP cascade  MATERIAL (collapses economy)
  4. eventChance ceiling                      MATERIAL (removes CO2 sensitivity)
  5. geopolitics relations shift              MATERIAL (severity-driven)
  NOT MATERIAL: gdpGrowthRate accumulator within the 20-tick horizon
  NOT INSTANTIATED: energy consumptionDelta, WAR_CASUALTIES normalization,
                    demographics coupling

JEV AGREEMENT:
  - scalar-times-USD defect class real; three confirmed instances
  - all three material defects are instantiated and material (conf 0.97-1.00)
  - gdpGrowthRate is a rate, so /100 is correct (conf 0.97)
  - fixing only the climate bridge is NOT sufficient (conf 0.97)
  - corrected Phase F should NOT proceed (conf 0.87)
  - systematic rather than per-instance correction warranted
  - KE's corrections to Jev's own earlier claims are VALID (conf 0.93)

JEV DISAGREEMENT:
  - gdpGrowthRate: Jev downgrades from 'defect' to 'inference only' (1.03),
    in tension with its own 'instantiated and material' (1.76)
  - micro-tests: Jev judges BOTH 'do not isolate'; ablation REQUIRED (conf 0.99)
  - KE severity cascade rated only 'partially genuine' (0.82) while also
    'material' at conf 1.00 - internal tension
  - coverage: Jev identifies six further unexamined gap classes (cadence
    mismatch conf 0.80, event ordering conf 0.84, shared RNG, aggregation,
    annual-vs-per-tick, non-instantiated sectors)

PHASE F RERUN ELIGIBLE: NO

REQUIRED CORRECTIONS:
  1. Ablation study isolating the three confirmed defects as independent edges
  2. Systematic correction of the scalar-times-USD defect class (3 confirmed,
     1 suspected in a non-instantiated sector)
  3. Bound the climate severity term so it cannot scale off a runaway anomaly
  4. Examine cadence mismatch and same-tick handler ordering
  5. Repair frozen Phase F provenance (commit + content-hash manifest +
     recorded producing commit SHA)
  6. Redesign the statistical basis (seed count and test) - carried over
     unresolved from the prior Jev review
  7. Preserve frozen Phase F artifacts unchanged; corrections must be a new
     experiment with new ID, commit, artifacts and provenance
```

---

## 11. Boundary statement

No production coupling was corrected. No frozen Phase F artifact was modified,
renamed, or deleted. No Phase F rerun was executed. No N=50 run, no Monte Carlo,
no GPU was used. No manuscript was modified. The only new file in the repository
is the diagnostic harness `scripts/audit-coupling-diagnostic.ts` and this report.

Jev did not modify code and did not execute experiments.

---

## 12. Artifacts

- This report: `docs/experiments/CROSS-SECTOR-DIMENSIONAL-AUDIT.md`
- Diagnostic harness: `scripts/audit-coupling-diagnostic.ts`
- Jev raw responses (not committed): `%TEMP%/opencode/jev-audit2-results.json`
- Prior review: `docs/experiments/PHASE-F-JEV-ADVERSARIAL-REVIEW.md`
- Impact assessment: `docs/experiments/PHASE-F-ECONOMY-CLIMATE-COUPLING-IMPACT.md`
- NCR: `qms/records/nonconformities/2026-09-21-ncr-001-climate-coupling-unit-error.json`
