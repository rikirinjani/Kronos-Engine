# KE Adversarial Scientific Review

**Reviewer:** Hostile JAMIA reviewer simulation
**Date:** 2026-09-08
**Target:** `jamia-2026-kronos-engine.md` (canonical, post-B1 reconciliation)
**Evidence basis:** Frozen Mac execution (VER-2026-019), Phase F report, EXPERIMENT-FREEZE-2026-09-07, MANUSCRIPT-EVIDENCE-MATRIX-2026-09-07

---

## EXECUTIVE VERDICT

### MAJOR REVISION REQUIRED

The central contribution — a sentinel adapter pattern for connecting macro simulators to micro hospital simulators without modification — is **genuinely novel and defensible** for JAMIA. The architecture is real, the invariants are sound, the deterministic pipeline works, and the honest negative results are methodologically valuable.

However, the manuscript has **three blocking-class issues** that must be resolved before scientific hardening:

1. **Causal language scope is blurred.** The manuscript uses "causal" in ways that could imply real-world climate-health effects when the evidence only supports causal traceability within the simulation architecture. This must be explicitly disambiguated throughout.

2. **Phase F interpretation needs recalibration.** The manuscript correctly identifies the null result but overstates the mechanistic insight. The three structural mechanisms are real but are properties of *this specific DR configuration*, not general architectural insights. The discharge-delay constraint is a DR model parameter, not a KE architectural finding.

3. **The "laboratory" framing in the conclusion overreaches.** A laboratory produces empirical knowledge. KE produces internally consistent simulation outputs that have not been validated against real data. The conclusion must not imply clinical or policy readiness.

The evidence supports the architectural contribution. The evidence does not support clinical, policy, or real-world health claims. The manuscript needs surgical language corrections, not new experiments.

---

## 1. ATTACK THE CENTRAL CONTRIBUTION

**Hostile question:** "What does Kronos Engine contribute beyond being a software integration test between a macro simulation and a hospital simulation?"

### Assessment

The manuscript's answer is the **sentinel adapter pattern** — a methodology for connecting independently developed simulators across scales without modifying either. This is a real contribution, but the manuscript undersells it by framing the contribution as "multi-scale health system simulation" rather than as the specific architectural pattern.

**What the evidence actually demonstrates:**

| Claimed Contribution | Evidence Level | Verdict |
|---|---|---|
| Deterministic counterfactual engine | Directly demonstrated (seeded RNG, sorted iteration, snapshot/restore, replay verified) | PROVEN |
| Sentinel adapter pattern (zero-modification integration) | Directly demonstrated (DR wrapped without code changes) | PROVEN |
| Cross-sector coupling (world → hospital) | Verified via integration test and Phase F causal trace | SUPPORTED ARCHITECTURAL CAPABILITY |
| Honest negative results | Demonstrated (P-003 GDP null, P-004 hospital null, Phase F null) | PROVEN |
| Causal-pathway diagnostic | Demonstrated in Phase F (5-link trace identifying exactly where signal disappears) | SUPPORTED ARCHITECTURAL CAPABILITY |
| Multi-scale health counterfactuals | Not established — no empirical validation against real data | UNSUPPORTED for health claims; SUPPORTED for architectural demonstration |
| "Laboratory for policy-makers" | Overreach — no empirical credibility established | OVERCLAIM |

**The actual contribution is better described as:**

> A deterministic architecture for tracing intervention signals across macro-to-micro simulation boundaries, with the sentinel adapter pattern as the integration mechanism and causal-pathway diagnostics as the analytical method.

This is stronger than "multi-scale health simulation" because it emphasizes what KE actually does that existing frameworks do not: **identify exactly where an intervention signal disappears in a multi-scale pipeline.** The Phase F experiment — despite being a null result — is the strongest evidence for this contribution.

**Do not manufacture a stronger contribution.** The contribution is real but needs precise framing.

---

## 2. CLAIM-BY-CLAIM AUDIT

### Abstract

| Claim | Classification | Notes |
|---|---|---|
| "deterministic counterfactual experimentation platform" | PROVEN | Seeded RNG, sorted iteration, snapshot/restore, replay all verified |
| "bridges global systemic drivers and local health system outcomes" | SUPPORTED ARCHITECTURAL CAPABILITY | The pipeline exists; "outcomes" implies empirical results not yet established |
| "reproducible multi-scale counterfactuals" | PROVEN for architecture; UNSUPPORTED for health claims | Reproducibility of simulation trajectories is proven; empirical validity is not |
| "empirical calibration against real hospital admission data is the critical next step" | DESCRIPTIVE | Correctly acknowledges gap |
| "policy-makers can ask 'what if?' and receive auditable counterfactual analyses" | OVERCLAIM | The platform produces internally consistent outputs; "auditable" is correct for architecture but not for clinical/policy decisions |

### Section 1: Introduction

| Claim | Classification | Notes |
|---|---|---|
| "Hospital admission rates respond to economic recessions [1]..." | PROVEN | Literature-supported |
| "Simulation offers the only window into those counterfactuals" | OVERCLAIM | "a window" is more accurate (already fixed in F10) |
| "Deterministic — identical inputs produce identical simulation trajectories" | PROVEN with caveats | KE core is deterministic; DR uses unseeded Math.random/Date.now (§3.5) |
| "Multi-scale — bridges macro-level drivers to micro-level operational outcomes" | SUPPORTED ARCHITECTURAL CAPABILITY | The pipeline exists; no empirical validation |
| "Pluggable — accepts existing simulators without modification" | PROVEN | DR wrapped without code changes |
| "Verifiable — produces statistically testable counterfactual outcomes" | PROVEN for architecture | Statistical infrastructure exists and functions |

### Section 2: Methods

| Claim | Classification | Notes |
|---|---|---|
| "Zero-modification wrapper" | PROVEN | DR source code never modified |
| "World never reaches into the hospital" | PROVEN | Architectural invariant verified |
| "Deterministic execution within the Kronos Engine core" | PROVEN with caveat | Core is deterministic; DR dependency is not (§3.5, §4.4) |
| "Integration test validates world→hospital leg" | PROVEN | Test exists and passes |
| "Causal pathway: Climate → Economy → Adapter → DR" | SUPPORTED ARCHITECTURAL CAPABILITY | Traced in Phase F; event-gate mechanism documented |
| "illustrative parameter targets" | DESCRIPTIVE | Correctly framed |

### Section 3: Results

| Claim | Classification | Notes |
|---|---|---|
| P-003: "no defensible GDP effect" | PROVEN | 0/9 primary outcomes significant under correction |
| P-003: "honest negative result" | PROVEN | Correctly framed |
| P-004: "none survived BH-FDR or Bonferroni" | PROVEN | Statistical analysis correct |
| P-004: "hospital sentinel metrics degenerate" | PROVEN | stdDev = 0 across all 30 seeds |
| Phase F: "null clinical result with mechanistic insight" | INTERPRETATION | Null result is proven; "mechanistic insight" is interpretation — see §3 analysis below |
| Phase F: "event-gate mechanism is confirmed" | SUPPORTED ARCHITECTURAL CAPABILITY | First-event ticks identical across arms in 4/5 seeds |
| Phase F: "admission-multiplier structurally inert" | PROVEN for this configuration | `floor(floor(rng×3)×1.3)` ≡ `floor(rng×3)` — mathematical property |
| Phase F: "discharge-delay constraint" | PROVEN for this configuration | 4,320–10,080 DR ticks vs 200-tick horizon |
| 30-sentinel network: "distributed operational capability" | PROVEN | 30 instances across 5 regions |
| 333 tests: "runs in under 30 seconds" | PROVEN | Test suite exists |

### Section 4: Discussion

| Claim | Classification | Notes |
|---|---|---|
| "central contribution is the sentinel adapter pattern" | SUPPORTED | Architecture is real and novel |
| "analogous to sentinel surveillance" | INTERPRETATION | Reasonable analogy |
| "existing investments preserved" | SUPPORTED | Zero-modification demonstrated |
| "scaling by configuration" | SUPPORTED with caveat | 30 instances are same simulator, not heterogeneous (correctly noted) |
| "counterfactual auditability" | PROVEN | Seed, intervention, checkpoint define experiment completely |
| "empirical calibration is the critical next step" | DESCRIPTIVE | Correctly acknowledges gap |

### Section 5: Conclusion

| Claim | Classification | Notes |
|---|---|---|
| "deterministic counterfactual experimentation platform" | PROVEN | Architecture works |
| "honest negative results when interventions fail to propagate" | PROVEN | Demonstrated in all three experiments |
| "deterministic execution establishes reproducibility" | PROVEN with caveat | Under stated execution conditions only |
| "does not establish empirical validity" | DESCRIPTIVE | Correctly stated |
| "laboratory for reproducible health system counterfactuals" | OVERCLAIM | "Laboratory" implies empirical utility not yet established |
| "policy-makers can ask 'what if?'" | OVERCLAIM | Platform produces simulation outputs, not policy-ready evidence |
| "empirical validation against real-world data" | DESCRIPTIVE | Correctly identified as next step |

---

## 3. PHASE F ADVERSARIAL AUDIT

### Does the manuscript accidentally imply CO₂ caused hospital deterioration?

**Critical check: Section 3.3, line 303:**

> "Causal hypothesis: Elevated CO₂ → increased extreme-weather frequency → climate extreme_weather events → economy gdp_shift → adapter builds MacroConditionPacket with elevated supplyChainPressure → Deers Rock supply-stress rises → sentinel reports elevated health.pressure."

This is framed as a hypothesis, not a finding. The results (lines 305–325) correctly state that the hypothesis was **not supported** for clinical outcomes. The manuscript does NOT imply CO₂ caused hospital deterioration.

**However, there is a subtle issue:**

The structural analysis (lines 315–321) describes three mechanisms that "block downstream clinical propagation." This framing implies the signal *would* propagate if these mechanisms were removed. But the evidence does not support this implication — we only know the signal did NOT propagate under the tested configuration. The mechanisms are properties of **this specific DR configuration at this specific horizon**, not general architectural bottlenecks.

**Recommended framing change:** Replace "block downstream clinical propagation" with "explain the absence of downstream clinical divergence under the tested configuration."

### Phase F interpretation accuracy

The manuscript says (line 325):

> "The adapter's event-driven pathway is operational (events propagate), but the hospital simulator's internal dynamics do not translate supply-stress into clinical outcomes within the tested horizon."

This is accurate. The adapter works. DR consumed the events. The null result is at the DR level, not the adapter level.

**But the Phase F report (§16) provides a more precise per-link verdict:**

1. CO₂ → climate trajectory: PARTIAL (saturated by tick 4)
2. Climate → EXTREME_WEATHER: OPERATIONAL (diverged in 1/5 seeds)
3. EXTREME_WEATHER → adapter → DR events: OPERATIONAL
4. DR events → DR state: OPERATIONAL
5. DR state → observables: NULL (occupancy/icu/mortality), PARTIAL (supplyStress 1/5)

The manuscript correctly reports links 3–5 but **does not mention the GDP→emissions saturation (link 1)** in §3.3. This omission is significant because it means the control arm was not actually a "quiet control" — both arms had saturated extreme-weather events from tick 4 onward. The intervention only differentiated the climate during ticks 1–3. This is a critical context for interpreting the null result.

**The manuscript does mention this in §4.4 (line 389):**

> "The uncorrected list was dominated by tiny-variance economy artifacts"

But it does not explicitly state that the GDP→emissions runaway limited the intervention's differentiation window to 3 ticks. This should be noted in §3.3 or §4.4.

### Stale value in freeze record

The EXPERIMENT-FREEZE-2026-09-07 reports Phase F SupplyStress mean Δ = 0.034 (Windows). The canonical manuscript reports 0.044 (Mac). The freeze record has not been updated. This is a documentation issue, not a manuscript issue — the freeze record should be amended to note the Mac canonical value supersedes the Windows value.

---

## 4. CAUSAL-LANGUAGE AUDIT

### Every occurrence of "causal" in the manuscript

| Location | Text | Classification | Required Scope |
|---|---|---|---|
| §1 line 44: "cross-sector coupling" contribution | "Verified one-way coupling of climate, economy, and health sectors" | Architectural | Acceptable — describes verified pipeline |
| §2.4 line 123: "expected chain" | "Climate heatwave → Economy recession → MacroConditionPacket → DR → health.pressure" | Architectural trace | Acceptable — describes integration test pathway |
| §3.3 line 303: "Causal hypothesis" | "Elevated CO₂ → increased extreme-weather frequency → ..." | Hypothesis framing | Acceptable — presented as hypothesis, not finding |
| §3.3 line 325: "event-gate mechanism is confirmed" | "climate events propagate to adapter-level supply-stress" | Architectural | Acceptable — describes verified propagation |
| §4.4 line 393: "causal-pathway experiment" | "extreme-weather events propagate from Climate to Economy to Adapter" | Architectural | Acceptable — describes verified links |
| §4.4 line 393: "causal-pathway experiment" | "the adapter correctly translates macro events into hospital-relevant parameters" | Architectural | Acceptable |

### Assessment

The manuscript uses "causal" primarily in the architectural sense (causal traceability within the simulation). It does NOT use "causal" to claim real-world climate-health effects. The framing is generally correct.

**One concern:** The §3.3 heading says "Mechanistic Pilot — CO2 Concentration Intervention" which implies a mechanistic understanding of the CO₂→hospital pathway. The actual finding is that the pathway is structurally inert under the tested configuration. The heading should not imply mechanistic insight that was not demonstrated.

**Preferred framing (already mostly in place):**

> Causal traceability within the simulation architecture

vs.

> ~~Causal inference about real-world climate-health effects~~ (NOT present in manuscript — good)

The manuscript does NOT blur these. The causal language is appropriately scoped to the architecture.

---

## 5. NULL RESULT ANALYSIS

### Does the manuscript correctly explain the structural bottlenecks?

**Yes, with caveats.** The manuscript correctly identifies:

1. **Event-gate mechanism** (§3.3 lines 315–317): First-event ticks identical across arms. Event timing is seed-dependent, not CO₂-dependent. This is a correct interpretation.

2. **Admission-multiplier inertness** (§3.3 lines 319–320): `floor(floor(rng×3)×1.3)` ≡ `floor(rng×3)`. Mathematical property correctly described.

3. **Discharge-delay constraint** (§3.3 lines 321): 4,320–10,080 DR ticks vs 200-tick horizon. Correct.

### What the manuscript does NOT mention

**GDP→emissions saturation:** The Phase F report (§8, Link 1) documents that economy publishes absolute-dollar GDP deltas (~10¹¹), and the climate handler adds `gdpDelta × 0.00005` to annualEmissions. Emissions explode from 37 Gt to ~10⁸ Gt within 3 ticks; CO₂ reaches ~10⁸ ppm by tick 4 in BOTH arms. EventChance saturates at the 0.5 clamp in both arms from tick ~4 onward.

This means:
- The intervention only differentiates the climate during ticks 1–3
- The control arm is NOT event-free (it also has saturated weather)
- The null result partly reflects that both arms are running identical saturated weather from tick 4

This is documented in the Phase F report but NOT in the canonical manuscript. It should be added to §4.4 as a limitation.

### Does the architecture allow identification of where the signal disappeared?

**Yes, and this IS demonstrated.** The Phase F causal trace (§8 of the report) follows the intervention through 5 links:
1. CO₂ → climate trajectory: PARTIAL (saturated)
2. Climate → EXTREME_WEATHER: OPERATIONAL (1/5 seeds)
3. EXTREME_WEATHER → adapter → DR events: OPERATIONAL
4. DR events → DR state: OPERATIONAL
5. DR state → observables: NULL (occupancy/icu/mortality), PARTIAL (supplyStress)

This is genuinely valuable — the architecture allows the investigator to identify exactly where the intervention signal disappears. The manuscript correctly presents this diagnostic capability.

**This may indeed be the central scientific contribution:** not that KE produces health effects, but that it allows investigators to trace intervention signals across simulation boundaries and identify exactly where they attenuate or disappear.

---

## 6. ARCHITECTURAL vs. MODEL BEHAVIOR

### Results that demonstrate architectural behavior

| Result | Evidence | Classification |
|---|---|---|
| Event mapping (climate → economy → adapter → DR) | Phase F causal trace, integration test | ARCHITECTURAL |
| Adapter propagation (MacroConditionPacket delivered) | Phase F Link 3 verified per-event | ARCHITECTURAL |
| Isolation (sentinels don't observe each other) | Phase F §11 isolation results | ARCHITECTURAL |
| Replay (seed-42 pair identical) | Phase F §12 | ARCHITECTURAL |
| Deterministic pipeline (same seed → same trajectory) | P-003, P-004, Phase F | ARCHITECTURAL |
| Circuit breaker (health.down signal) | §2.5 line 183 | ARCHITECTURAL |
| Seed derivation (djb2 hash) | §2.5 lines 166–179 | ARCHITECTURAL |

### Results that demonstrate model-specific behavior

| Result | Evidence | Classification |
|---|---|---|
| GDP→emissions saturation | Phase F §8 Link 1 | MODEL-SPECIFIC (KE sector parameterization) |
| Event probability saturation at 0.5 | Phase F §8 Link 1 | MODEL-SPECIFIC (KE climate sector) |
| Admission multiplier quantization | Phase F §8 Link 5 | MODEL-SPECIFIC (DR configuration) |
| Discharge delay > horizon | Phase F §8 Link 5 | MODEL-SPECIFIC (DR design parameter) |
| supplyStress +0.219 in seed 46 | Phase F §8 Link 5 | MODEL-SPECIFIC (stochastic seed interaction) |
| P-004 hospital metrics degenerate | §3.2 | MODEL-SPECIFIC (DR adapter boundary) |

### Assessment

The manuscript correctly distinguishes these in most places. The §4.4 limitations section correctly frames admission-multiplier inertness and discharge-delay as DR properties. However, the §3.3 structural analysis could be clearer that these are **configuration-specific** findings, not general architectural insights.

**The manuscript must not present model-specific behavior as universal properties of macro-to-micro simulation.** Currently it does not — but the §3.3 framing ("Three mechanisms block downstream clinical propagation") could be misread as claiming these are general mechanisms rather than specific to this configuration.

---

## 7. PHASE E / E6 AUDIT

### What the manuscript says about Phase E

The manuscript does not explicitly discuss Phase E experiments (E1–E6). Phase E is referenced indirectly through:
- §2.6 integration test (verifying world→hospital pathway)
- §4.4 limitations (asymmetric coupling, hospital→world not implemented)

### E6 aliasing

The old nonzero E6 result was caused by aliasing contamination and was corrected. The manuscript does NOT present the old contaminated E6 result. The manuscript does not mention E6 at all — which is correct, as E6 is a code-level verification, not a paper claim.

**Verdict: CLEAN** — no stale E6 contamination in the manuscript.

### Phase E pathway status

The manuscript correctly states:
- World→hospital coupling is implemented and tested (§2.6, §3.3)
- Hospital→world feedback is not implemented (§1 line 48, §4.4 line 370)
- Adapter publishes health.* events but no sector subscribes (§2.4 line 123)

**Verdict: ACCURATE**

---

## 8. ISOLATION AUDIT

### Does the manuscript properly distinguish isolation levels?

The manuscript discusses isolation in:
- §2.5 adapter invariants (lines 187–200): Correctly specifies what adapter does/does not do
- §3.3 Phase F: Does not explicitly discuss isolation (the Phase F report §11 does)

### Potential issue

The §2.5 adapter invariants say:

> "Allow one sentinel to observe another sentinel's output"

This is correct — sentinels are isolated from each other. But the Phase F report (§11) documents that seed 46's isolation results show B/C sentinels differ when weather streams diverge. This is NOT contamination — it's the documented world-level causal pathway (EXTREME_WEATHER is a broadcast event). The manuscript does not discuss this nuance.

**Recommendation:** Add a brief note in §4.4 clarifying that sentinel isolation is from each other's *outputs*, not from shared world-level events. EXTREME_WEATHER is broadcast to all sentinels; each consumes it with its own isolated derived RNG.

---

## 9. STOCHASTIC/STATISTICAL LANGUAGE AUDIT

### Hostile word search

| Word | Location | Assessment |
|---|---|---|
| "statistically significant" | §3.2 line 285: "6 of 199 metrics were significant at uncorrected α = 0.05 but none survived" | ACCEPTABLE — correctly qualified with "uncorrected" and "none survived" |
| "robust" | Not found | N/A |
| "consistent" | §3.3 line 325: "not directionally consistent" | ACCEPTABLE — correctly used in negative context |
| "generalizable" | §4.5 line 401: "designed to generalize" | ACCEPTABLE — correctly hedged as "designed to" |
| "dose-response" | Not found | N/A |
| "effect" | §3.1 line 259: "no defensible GDP effect" | ACCEPTABLE — correctly negative |
| "causal effect" | Not found as a claim | N/A — good |
| "confidence" | Not found in statistical context | N/A |
| "validated" | §4.4 line 379: "not been calibrated" | ACCEPTABLE — correctly negative |
| "demonstrates" | §3.3 line 325: "event-gate mechanism is confirmed" | BORDERLINE — "confirmed" is strong for 1/5 seeds; consider "observed" |
| "confirms" | §3.3 line 325: "event-gate mechanism is confirmed" | BORDERLINE — same concern |
| "proves" | Not found | N/A |

### Phase F statistical language concerns

The manuscript says (line 305):

> "SupplyStress showed a positive delta in 1 of 5 seeds (seed 46, Δ = 0.219; mean Δ = 0.044, d = 0.45, direction consistency = 0.2)"

**Concern:** d = 0.45 is reported without noting that it is driven by a single seed out of 5. With n=5 and 1/5 directional response, this effect size is not meaningful in the conventional sense. The manuscript should note that the d value reflects a single-seed divergence, not a consistent shift.

**Concern:** "direction consistency = 0.2" is correctly reported but the manuscript should explicitly state that the success criterion (≥80%) was not met.

**The manuscript does state this in the table (line 309):**

> "Seed-46 signal only; not directionally consistent"

This is adequate.

---

## 10. CROSS-PLATFORM EVIDENCE AUDIT

### Does the manuscript mix Windows and Mac numbers?

**No.** The manuscript correctly:
- Reports Mac canonical values in §3.3 (mean Δ = 0.044, seed-46 Δ = 0.219)
- Notes Windows as "non-canonical per §10" (line 323)
- Reports Windows results as concordant, not canonical (line 323: "SupplyStress +0.17 (seed 46 only)")
- Does not use Windows quantitative trajectories as canonical evidence

**However:** The EXPERIMENT-FREEZE-2026-09-07 still reports Phase F mean Δ = 0.034 (Windows). This is a stale value in the freeze record. The freeze record should be amended to note the Mac canonical value supersedes this.

**Mac regression:** Correctly reported as 333/333 (line 455).

**Verdict: CLEAN** in the manuscript. Freeze record needs amendment.

---

## 11. DR/KE BOUNDARY AUDIT

### Does the manuscript maintain proper separation?

| Check | Location | Assessment |
|---|---|---|
| DR described as sentinel/receiving simulator | §2.5 line 129: "wraps an existing hospital simulator — in this case, Deers Rock" | CORRECT |
| DR not re-claimed as part of KE | §2.5 line 129: "wraps" (adapter pattern) | CORRECT |
| DR contribution not duplicated | §4.4 line 383: "wraps one hospital model (Deers Rock)" | CORRECT |
| DR clinical validity not implied | §4.4 line 379: "not been calibrated against real-world hospital admission data" | CORRECT |
| DR cultural parameters not claimed as validated | Not mentioned (correct omission) | CORRECT |
| KE not dependent on DR's clinical realism | §2.5 line 185: "the hospital simulator remains independently runnable" | CORRECT |

**The manuscript correctly treats DR as a black-box simulator that happens to be wrapped by the adapter.** It does not claim DR's clinical validity, cultural parameters, or implementation details.

**One minor concern:** §3.4 (line 329) says "using a single hospital simulator (Deers Rock) instantiated 30 times." This correctly notes that all 30 sentinels use the same simulator, not heterogeneous types. The limitation is acknowledged.

**Verdict: CLEAN** — DR/KE boundary properly maintained.

---

## 12. STALE CONTENT AUDIT

### Search for remnants

| Stale Item | Found in Manuscript? | Notes |
|---|---|---|
| Phase F v1 | NOT FOUND | ✅ Clean |
| Windows mean Δ = 0.034 | NOT FOUND in manuscript | ⚠️ Present in EXPERIMENT-FREEZE-2026-09-07 (stale freeze record, not manuscript) |
| Old Phase F verdicts | NOT FOUND | ✅ Clean |
| Pre-E6 aliasing result | NOT FOUND | ✅ Clean |
| Old DR values (35 handlers) | NOT FOUND | ✅ Clean |
| Old DR values (133 beds) | N/A — 133 beds is current correct value | ✅ Correct |
| Old DR values (50 diagnoses) | NOT FOUND | ✅ Clean |
| Old test counts (323) | NOT FOUND | ✅ Clean (333 used throughout) |
| Stale figure captions | NOT FOUND | ✅ Clean |
| "GDP divergence" placeholder | NOT FOUND | ✅ Clean |
| Old direction-consistency values | NOT FOUND | ✅ Clean |
| Old Phase F interpretations | NOT FOUND | ✅ Clean |

**Verdict: CLEAN** — no stale content in the manuscript. Freeze record has one stale value (Phase F mean Δ) that should be amended.

---

## 13. JAMIA SUBMISSION EVALUATION

### Novelty: ADEQUATE

The sentinel adapter pattern is a genuinely novel integration methodology for health informatics. The concept of wrapping existing hospital simulators as "sentinels" in a multi-scale platform is not present in the cited literature. However, the novelty is architectural, not clinical.

### Methodological Rigor: ADEQUATE

The experimental design is appropriate for an architecture paper:
- P-003: 30 seeds, multiplicity-corrected statistics, honest negative result
- P-004: 30 seeds, correct identification of degenerate metrics
- Phase F: 5 seeds with per-link causal trace (adequate for mechanistic pilot)

The statistical infrastructure (BH-FDR, Bonferroni, noise floor reporting) is sound. The 5-seed Phase F design is acknowledged as a pilot.

### Reproducibility: STRONG

- Deterministic pipeline (seeded RNG, sorted iteration)
- Snapshot/restore verified
- Replay verified (Phase F §12)
- Source code available
- Evidence artifacts frozen with manifest
- Test suite (333 tests) provides regression coverage

### Clinical/Informatics Relevance: WEAK

The paper does not demonstrate clinical utility. The hospital metrics are degenerate or null. The platform has not been calibrated against real data. The relevance is to the informatics methodology (how to connect simulators across scales) rather than to clinical outcomes.

**This is acceptable for an architecture paper** — but the manuscript must not imply clinical relevance it does not have.

### Interpretability: STRONG

The Phase F causal trace (5-link diagnostic) is highly interpretable. A reviewer can follow the intervention signal through each link and identify exactly where it disappears. This is a genuine methodological contribution.

### Contribution vs. Implementation: ADEQUATE

The manuscript explains the sentinel adapter pattern as a methodological contribution, not merely describes software. The §2.5 adapter invariants, §2.6 integration test, and §3.3 causal trace provide scientific content beyond implementation description.

**However:** The §4.4 limitations section could be more concise. Several limitations are restated from §3.3 (event-gate, admission-multiplier, discharge-delay). Consider consolidating.

---

## 14. REVIEWER ATTACK LIST

### Objection 1: "This is just software integration."

**Severity: HIGH**
**Manuscript answers it?** Partially. The sentinel adapter pattern is presented as a methodological contribution, but the manuscript does not explicitly distinguish between "we built software" and "we contributed a transferable integration pattern."
**Evidence supporting the answer:** The adapter invariants (§2.5), zero-modification demonstration, and cross-domain applicability argument (§4.5) support the methodological framing.
**Wording revision needed?** Yes. The abstract and conclusion should more explicitly frame the contribution as a transferable pattern, not a software product.
**Additional experiment needed?** No.

### Objection 2: "The causal language is unjustified."

**Severity: HIGH**
**Manuscript answers it?** Mostly. The manuscript uses "causal" primarily in the architectural sense. But §3.3's "Mechanistic Pilot" heading and "event-gate mechanism is confirmed" language could imply more than demonstrated.
**Evidence supporting the answer:** The causal trace follows a verified pipeline (Links 1–5). The manuscript does not claim real-world causal effects.
**Wording revision needed?** Yes. "Mechanistic Pilot" could be "Mechanism Diagnostic." "Confirmed" could be "observed."
**Additional experiment needed?** No.

### Objection 3: "Five seeds are insufficient."

**Severity: MODERATE**
**Manuscript answers it?** Yes. §3.3 describes Phase F as a "mechanistic pilot" with 5 seeds. The Phase F report explicitly notes "descriptive only, no p-values."
**Evidence supporting the answer:** The per-link causal trace provides more value than statistical power. The architectural finding (pipeline operational, hospital structurally inert) does not require large n.
**Wording revision needed?** No — already correctly framed as pilot.
**Additional experiment needed?** No.

### Objection 4: "The intervention mostly produced a null result."

**Severity: MODERATE**
**Manuscript answers it?** Yes. The manuscript correctly frames null results as honest negative results with diagnostic value.
**Evidence supporting the answer:** All three experiments produced null results with methodological insight. The platform's ability to produce and audit honest negatives is itself a contribution.
**Wording revision needed?** Minor — ensure "null result" is not framed as "failure."
**Additional experiment needed?** No.

### Objection 5: "The +0.219 result is a single stochastic event."

**Severity: MODERATE**
**Manuscript answers it?** Yes. Line 309: "Seed-46 signal only; not directionally consistent."
**Evidence supporting the answer:** The report explicitly states 1/5 seeds, direction consistency 0.2, criterion not met.
**Wording revision needed?** No — already correctly characterized.
**Additional experiment needed?** No.

### Objection 6: "The hospital model is not clinically calibrated."

**Severity: HIGH**
**Manuscript answers it?** Yes. §4.4 line 379: "not been calibrated against real-world hospital admission data."
**Evidence supporting the answer:** Correctly identified as the paper's "single largest exposure."
**Wording revision needed?** No — already acknowledged.
**Additional experiment needed?** No (for this paper — calibration is future work).

### Objection 7: "The GDP→emissions runaway may be an artifact."

**Severity: MODERATE**
**Manuscript answers it?** Not explicitly in §3.3. The Phase F report documents this clearly (§8 Link 1, §17 item 1), but the manuscript does not mention it.
**Evidence supporting the answer:** The Phase F report provides full documentation. The saturation means the control arm was not event-free.
**Wording revision needed?** Yes. Add a note in §4.4 about the GDP→emissions runaway limiting the intervention's differentiation window.
**Additional experiment needed?** No.

### Objection 8: "Why is this better than simply passing data between simulators?"

**Severity: HIGH**
**Manuscript answers it?** Partially. The adapter pattern provides: zero-modification integration, deterministic translation, isolation invariants, circuit breaker, seed derivation. These are not trivial — they are design decisions with scientific justification.
**Evidence supporting the answer:** §2.5 adapter invariants, §4.5 generalizability argument.
**Wording revision needed?** Yes. The manuscript should more explicitly contrast the adapter pattern with naive data-passing (e.g., "A simple data pipe would require modifying the hospital simulator's input format; the adapter translates without modification").
**Additional experiment needed?** No.

### Objection 9: "What is actually novel about the adapter?"

**Severity: MODERATE**
**Manuscript answers it?** Yes. The novelty is: (1) zero-modification integration, (2) deterministic translation preserving reproducibility, (3) asymmetric coupling with isolation invariants, (4) causal traceability across the boundary.
**Evidence supporting the answer:** §2.5 adapter invariants, §4.3 comparison table.
**Wording revision needed?** Minor — could be more explicit in §4.1 about what existing frameworks lack.
**Additional experiment needed?** No.

### Objection 10: "Can another researcher reproduce the experiment?"

**Severity: MODERATE**
**Manuscript answers it?** Yes. Source code available, evidence frozen, 333 tests, deterministic pipeline. P-004 is not byte-reproducible due to DR's unseeded RNG — correctly acknowledged.
**Evidence supporting the answer:** §2.2 deterministic core, §3.5 computational performance, §4.4 limitations.
**Wording revision needed?** No.
**Additional experiment needed?** No.

### Objection 11: "What does the paper establish that DR alone does not?"

**Severity: HIGH**
**Manuscript answers it?** Implicitly. KE establishes: macro-to-micro coupling, multi-scale counterfactuals, deterministic cross-scale propagation, causal traceability across boundaries. DR alone cannot do any of these.
**Evidence supporting the answer:** §4.3 comparison table, §4.5 generalizability.
**Wording revision needed?** Yes. The manuscript should explicitly state what KE adds beyond DR: "DR operates as a standalone hospital simulator; KE connects it to macro-scale drivers and enables counterfactual experiments that DR cannot perform independently."
**Additional experiment needed?** No.

### Objection 12: "What does the paper establish that a conventional co-simulation framework does not?"

**Severity: MODERATE**
**Manuscript answers it?** Partially. The comparison table (§4.3) compares against ABMs, system dynamics, and discrete-event — not against co-simulation frameworks (e.g., FMI/FMU, HLA).
**Evidence supporting the answer:** The adapter pattern's zero-modification integration and deterministic reproducibility are differentiators, but the comparison is incomplete.
**Wording revision needed?** Yes. Add a brief comparison with co-simulation frameworks (FMI/FMU, HLA) in §4.3 or §4.4. The key differentiator: KE's adapter pattern preserves simulator autonomy and deterministic reproducibility; co-simulation frameworks typically require tighter coupling.
**Additional experiment needed?** No.

---

## 15. FINAL VERDICT

### MAJOR REVISION REQUIRED

The central contribution is defensible. The evidence supports the architectural claims. The null results are honestly presented. The causal trace is a genuine methodological contribution.

**What must change:**
1. Add GDP→emissions saturation note to §4.4 (new limitation)
2. Clarify "causal" scope in §3.3 heading ("Mechanistic Pilot" → "Mechanism Diagnostic" or similar)
3. Add brief co-simulation framework comparison (FMI/FMU, HLA) to §4.3 or §4.4
4. Strengthen the "why not just pass data" argument in §4.1
5. Explicitly state what KE adds beyond DR alone
6. Note that d = 0.45 in Phase F reflects single-seed divergence
7. Add isolation clarification (broadcast events vs. sentinel-to-sentinel isolation)

**What must NOT change:**
- The central contribution framing (sentinel adapter pattern)
- The honest negative result framing
- The Phase F null result interpretation
- The causal trace methodology
- The adapter invariants
- The comparison table (except adding co-simulation frameworks)
- The limitations section (except adding GDP→emissions saturation)
- The conclusion's acknowledgment that empirical validation is future work
- Any experimental data or code
- The DR/KE boundary

**Things that are already correct and should be preserved:**
- Deterministic core description
- Adapter pattern description with invariants
- P-003 honest negative framing
- P-004 degenerate metrics identification
- Phase F structural analysis (event-gate, admission-multiplier, discharge-delay)
- Isolation results
- Deterministic replay verification
- Multiple comparison correction methodology
- Noise floor reporting
- Effect size interpretation (one-sample d_z, not two-group d)
- The conclusion's "this paper reports internal consistency and architectural correctness"
- The acknowledgment that calibration is future work

---

## ADDITIONAL FINDINGS

### Freeze Record Discrepancy

The EXPERIMENT-FREEZE-2026-09-07 reports Phase F SupplyStress mean Δ = 0.034 (Windows execution). The canonical manuscript reports 0.044 (Mac execution). The freeze record should be amended to note that the Mac value supersedes the Windows value.

### §4.3 Comparison Table Gap

The comparison table compares KE against ABMs, system dynamics, and discrete-event — but not against co-simulation frameworks (FMI/FMU, HLA, CORBA). A brief addition noting KE's differentiators (zero-modification, deterministic reproducibility, simulator autonomy) would strengthen the novelty claim.

### §4.1 Could Be Stronger

The "implications for health informatics" bullet points are valid but could be more explicit about what existing frameworks cannot do. For example: "Existing frameworks require modifying the hospital simulator's input format to accept macro-scale data; KE's adapter translates without modification, preserving the simulator's public API."

### Conclusion Overreach

The conclusion (§5 lines 409–411) says:

> "Kronos Engine is not a dashboard. It is a laboratory — a platform where policy-makers, hospital administrators, and public health officials can ask 'what if?' and receive reproducible, auditable counterfactual analyses with explicit statistical testing and multiplicity control."

The "laboratory" metaphor implies empirical utility. The platform produces internally consistent simulation outputs, not empirically validated evidence. The phrase "policy-makers can ask 'what if?'" implies the outputs are policy-ready. They are not — the paper explicitly states that calibration is future work.

**Recommended revision:** "Kronos Engine is a research instrument for exploring multi-scale counterfactual questions — a platform where investigators can trace intervention signals across simulation boundaries and identify where they attenuate or disappear. The outputs are internally consistent and reproducible; empirical validation against real-world data is the critical next step."
