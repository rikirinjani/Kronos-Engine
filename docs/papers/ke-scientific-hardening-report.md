# KE Scientific Language Hardening Report

**Date:** 2026-09-08
**Manuscript:** `docs/papers/jamia-2026-kronos-engine.md` (canonical, sole manuscript edited)
**Checklist source:** `docs/papers/ke-adversarial-scientific-review.md` (MAJOR REVISION REQUIRED)
**Scope:** Scientific-language and interpretation hardening only. No science, code, experiments, seeds, parameters, horizons, evidence, QMS records, or historical audit records were changed.

---

## 1. Revision Summary

The canonical KE manuscript was revised to separate four levels of claim and to scope every scientific statement to the evidence that supports it:

- **Level 1 — Architectural evidence** (adapter pathway, event translation, independent receiver, invariants, isolation, replay, causal traceability): described as architectural findings.
- **Level 2 — Simulation-mechanism observations** (event gate, GDP→emissions saturation, admission-multiplier quantization, discharge-delay mismatch): explicitly scoped to the implemented simulation architecture and tested configuration.
- **Level 3 — Experiment-specific observations** (seed 46 Δ = 0.219, direction consistency 1/5, structural nulls, mean Δ = 0.044): presented as descriptive findings.
- **Level 4 — Real-world inference** (CO₂ → hospital effects, clinical validity, predictive accuracy, policy effectiveness): explicitly marked as not established.

### Material finding during hardening (corrected)

The canonical §3.3 was found to report **Windows (non-canonical) Phase F values** — `seed 46, Δ = 0.17; mean Δ = 0.034` — despite the task premise that the canonical used Mac evidence. These were corrected to the canonical Mac values (`Δ = 0.219; mean Δ = 0.044`) per VER-2026-019. This is the single most consequential correction in this pass: it restores the manuscript's primary Phase F numbers to the canonical execution.

### Edit inventory

| # | Location | Change |
|---|---|---|
| 1 | Abstract Objective | "the only window" → "a window" |
| 2 | Abstract Methods | "a mechanistic pilot" → "a mechanism diagnostic" |
| 3 | Abstract Results | "The mechanistic pilot produced a structural null" → "The mechanism diagnostic produced..." |
| 4 | Abstract Conclusion | Removed "laboratory" + "policy-makers..." policy framing; reframed as research instrument |
| 5 | §1 | "the only window" → "a window" |
| 6 | §3.3 Design heading | "Mechanistic Pilot" → "Mechanism Diagnostic" |
| 7 | §3.3 | "Causal hypothesis" → "Hypothesized pathway" |
| 8 | §3.3 Results | Windows values → Mac canonical (0.219 / 0.044); added criterion-not-met clause |
| 9 | §3.3 Results table | +0.034 → +0.044 |
| 10 | §3.3 Structural analysis | "Three mechanisms block downstream clinical propagation" → "Within the implemented model and tested configuration, three mechanisms account for the absence of downstream clinical divergence" |
| 11 | §3.3 Event-gate | "confirm" → "indicate"; added "under the tested configuration" |
| 12 | §3.3 Platform consistency | Removed cross-platform trajectory-equivalence claim; Windows now qualitative-only |
| 13 | §3.3 Interpretation | "mechanistic insight" → "diagnostic mechanism finding"; scoped to implemented model/configuration/horizon |
| 14 | §2.4 | "validates ... produces a measurable hospital outcome" → "exercises ... produces a hospital operational signal" |
| 15 | §4.1 | "Why not just pass data" — expanded threefold → fourfold (added traceability/diagnosability) |
| 16 | §4.3 | Co-simulation comparison paragraph given citations [17] FMI, [18] HLA |
| 17 | §4.4 Short duration | Reattributed P-004 and Phase F nulls to specific mechanisms rather than generic "weak signal/temporal limitation" |
| 18 | §4.4 Event-gate/saturation | Reframed "revealed"/"confirms"; corrected saturation description to event-probability saturation; "full causal pathway" → "full macro-to-micro pathway" |
| 19 | §4.4 (new) | Added "Sentinel isolation and shared world events" limitation |
| 20 | §5 | "mechanistic pilot" → "mechanism diagnostic" |
| 21 | §5 | Conclusion reframed: removed policy-ready framing; "research instrument ... trace ... where the signal propagates, transforms, or disappears" |
| 22 | References | Added [17] FMI, [18] HLA |

---

## 2. Causal-Language Changes

| Before | After | Rationale |
|---|---|---|
| §3.3 "Causal hypothesis" | "Hypothesized pathway" | Avoids implying a causal finding; the statement is a hypothesis, not a result |
| §3.3 "event-gate mechanism is observed" / prior "confirmed" | "indicate ... within the implemented model" | Scopes to the implemented model; 1/5 seeds does not "confirm" |
| §4.4 "the full causal pathway" | "the full macro-to-micro pathway" | Causal scope limited to the architecture, not real-world health effects |
| §4.4 "revealed" | "traced that, within the implemented model" | Traceability is architectural; "revealed" implied discovery of a general mechanism |

Retained and correctly scoped (not removed — the paper's causal-trace contribution is preserved):
- §1 contribution #3: verified one-way coupling (architectural)
- §2.4 / §2.6: pathway traversal for one event chain, explicitly "not a general causal climate→hospital effect"
- §3.1: "should not be interpreted as a proven causal explanation" (negated)
- §4.4 isolation paragraph: "the documented world-level causal pathway" (architectural)

**Boundary made explicit:** the manuscript now uses causal language only for causal traceability within the simulation architecture, never for causal inference about real-world climate-health effects.

---

## 3. GDP→Emissions Saturation Addition

Added to §4.4 ("Event-gate mechanism and intervention saturation"):

> "In addition, within the implemented macro model a GDP-driven emissions feedback drove both arms toward very high CO₂ and temperature-anomaly values early in the horizon, saturating the climate sector's event-probability term in both arms from approximately tick 4 onward; the intervention therefore differentiated the two arms only during approximately the first three ticks. This saturation constrained the experiment's ability to maintain sustained intervention separation... It is a property of the implemented sector parameterization, not of the architecture, and it does not invalidate the experiment..."

Framing rules observed:
- Not called a defect or "broken."
- Phase F not implied invalid.
- Presented as a **model-dynamics diagnostic** the architecture made visible.
- No implication that economic growth causes atmospheric CO₂ saturation in reality.

---

## 4. Conclusion Correction

**Before (abstract and §5):** "Kronos Engine is a laboratory ... where policy-makers, hospital administrators, and public health officials can ask 'what if?'..."

**After (§5):** "Kronos Engine is not a dashboard. It is a research instrument for investigating multi-scale counterfactual questions — a platform where an investigator can trace an intervention from its macro-level origin through a defined semantic pathway into an independently executable healthcare simulation, and can determine where the signal propagates, transforms, or disappears. Each experiment is fully specified by its seed, intervention, and rewind point... we aim to eventually enable simulation as a prospective decision-making instrument — contingent on empirical validation against real-world health system data."

Policy-ready implication removed. The explicit acknowledgment that empirical validation remains future work is preserved. The abstract conclusion was aligned to the same framing.

---

## 5. Co-Simulation Comparison

Added to §4.3: a new column ("Co-Simulation (FMI/FMU, HLA)") in the comparison table and a paragraph positioning KE relative to FMI/FMU and HLA.

Defensible differentiators claimed (all supported by the implementation):
1. Wraps simulators via their existing public API without requiring FMI-compliant model export (zero-modification, demonstrated with DR).
2. Deterministic core enforcing seed-controlled reproducibility of counterfactual trajectories.

Explicit non-claims: KE does not claim to supersede FMI/FMU or HLA; the paragraph states the adapter is "a simpler, domain-specific alternative that trades generality for ease of integration." References [17] and [18] added.

---

## 6. "Why Not Just Pass Data?" Explanation

Expanded §4.1 to a fourfold answer distinguishing conventional integration from KE:
1. Contract preventing dependence on world-engine internals (preserves independent testability).
2. Temporal-scale translation (1 world tick = 1,440 hospital ticks).
3. Aggregation without exposing patient-level data (information asymmetry).
4. Deterministic, instrumented traceability — an investigator can determine whether a signal was never generated, generated but not translated, translated but not consumed, or consumed but did not reach the selected observable.

The paragraph does not claim KE invented co-simulation; it emphasizes the properties actually demonstrated.

---

## 7. DR-vs-KE Separation

§4.1 now contains an explicit "What KE adds beyond DR" paragraph:

- DR provides the operational domain model (hospital operations).
- KE adds deterministic counterfactual branching, multi-sector macro-to-micro translation, statistical analysis infrastructure (per-metric delta extraction, one-sample t-tests, BH-FDR/Bonferroni), and regional sentinel network coordination.

The manuscript does not re-claim DR as part of KE, does not duplicate DR's contribution, does not imply DR clinical validity, does not claim DR cultural parameters are validated, and does not make KE dependent on DR's clinical realism. The §2.5 statement that DR "remains independently runnable, testable, and versioned — an architectural consequence of non-modification, not a claim of external validation" is preserved.

---

## 8. d = 0.45 Contextualization

§3.3 Results now reads:

> "The d = 0.45 effect size reflects single-seed divergence (seed 46 only), not a consistent directional shift across seeds — the other four seeds had zero SupplyStress delta, and the pre-specified direction-consistency criterion (≥ 80%) was not met."

The statistic is retained (not removed); it is explicitly contextualized as a single-seed descriptive effect size. No new statistical tests were added.

---

## 9. Phase E / E6 Audit

| Item | Status in manuscript | Verdict |
|---|---|---|
| E1/E2 macro→DR pathways | Described via §2.4/§2.6 integration test and §3.3 Phase F trace | Accurate |
| diagnosisWeightOverrides | Not represented as successfully propagated (adapter consumes discrete events) | Accurate — no overclaim |
| E3 health-surveillance | Not presented as a national/global feedback pathway; `health.*` consumption explicitly unimplemented (§1, §2.4, §4.4) | Accurate |
| E4 emissions-control pathway | §3.2 attributes the null to the configuration/event-pathway mismatch (adapter consumes discrete events, not config params) | Accurate |
| E5 isolation | §2.5 invariants + new §4.4 isolation limitation | Accurate |
| E6 aliasing | Old contaminated nonzero result does not appear anywhere; E6 not cited as paper evidence | Clean |

No Phase E/E6 edits were required beyond the §4.4 isolation clarification.

---

## 10. Phase F Numerical Audit

| Quantity | Canonical (Mac) | Manuscript after hardening | Status |
|---|---|---|---|
| CO₂ control / intervention | 280 / 800 ppm | 280 / 800 ppm | ✅ |
| Seeds | 42–46 | 42–46 | ✅ |
| Horizon | 20 KE ticks | 20 KE ticks | ✅ |
| seed 46 supplyStress Δ | +0.219 | +0.219 | ✅ Corrected |
| Mean Δ | +0.044 | +0.044 (text and table) | ✅ Corrected |
| Direction consistency | 1/5 = 0.20 | 0.2 (1/5) | ✅ |
| Success criterion | ≥ 80% — NOT MET | "was not met" | ✅ |
| Occupancy / ICU / mortality | structurally null | Structural zero | ✅ |
| Adapter pathway | operational | "operational (events propagate)" | ✅ |
| DR consumption | operational | "consumed every translated event" (§2.6/§3.3 framing) | ✅ |
| Isolation invariants | passed | §4.4 isolation limitation | ✅ |
| Mac regression | 333/333 | "All 333 tests" (§ Supplementary) | ✅ |

The manuscript no longer implies a robust downstream health effect. The scientifically interesting result — that the architecture exposes *where and why* the signal failed to produce broad downstream differentiation — is preserved and foregrounded.

---

## 11. Cross-Platform Audit

- Windows quantitative trajectories are **not** treated as canonical. §3.3 now reports Mac values only.
- `mean Δ = 0.034` no longer appears in the canonical manuscript (it remains only in historical audit/inventory documents, which were not modified).
- The prior claim "identical KE RNG trajectories across platforms" was replaced: "Replay verification confirmed identical KE RNG trajectories for repeated runs of the canonical execution." Cross-platform trajectory equivalence is no longer claimed.
- The Windows run is reported only qualitatively (seed-46 response; same event-gate pattern; same structural nulls).
- Mac 333/333 regression remains correctly reported.

---

## 12. Stale-Content Audit

| Stale item | Canonical manuscript | Action |
|---|---|---|
| Phase F v1 | Absent | None |
| mean Δ = 0.034 | **Was present** (Windows) | Corrected to 0.044 |
| seed-46 Δ = 0.17 | **Was present** (Windows) | Corrected to 0.219 |
| "Mechanistic Pilot" | Was present | Replaced with "Mechanism Diagnostic" |
| "laboratory" / "policy-makers" | Was present (abstract §5) | Replaced with research-instrument framing |
| "only window" | Was present (abstract, §1) | Replaced with "a window" |
| Old DR values (35 handlers, 50 diagnoses) | Absent | None |
| 133 beds | Present and correct | None |
| Old test counts (323) | Absent (333 used) | None |
| Pre-E6 aliasing result | Absent | None |
| "GDP divergence" placeholder | Absent | None |

**Superseded draft files** (`jamia-2026-kronos-engine-v1-draft.md`, `-v2-redraft.md`, `-v3-redraft2.md`, `-v4-agent-reviewed.md`, `jamia-2026-kronos-engine(7).md`, `drafts/phase-f-draft.md`) still contain pre-hardening language (e.g., "laboratory," "only window," older statistical framing). These are not the canonical manuscript and were **not edited** per scope. They should be treated as historical/superseded. Historical audit records (evidence freeze, evidence matrix, inventory, reconciliation report) were not modified.

---

## 13. Final Claim Table

| Claim | Evidence type | Status | Scope |
|---|---|---|---|
| Adapter translates defined macro events into a typed packet | Architectural | Proven | KE implementation |
| DR consumes translated events via its public API | Architectural | Proven | KE/DR coupling |
| Zero-modification integration of DR | Architectural | Proven | Demonstrated in this work |
| Sentinel isolation (no sentinel observes another's output) | Architectural/experimental | Proven | Tested configuration |
| Deterministic replay of the canonical execution | Architectural | Proven | Same platform/seed |
| Intervention changed upstream extreme-weather event probability | Experimental | Observed | Phase F, implemented climate model |
| Seed 46 supplyStress Δ = +0.219 | Experimental | Observed | Single seed |
| Mean supplyStress Δ = +0.044; direction consistency 1/5 | Experimental | Observed | Five seeds |
| 80% direction-consistency criterion met | Experimental | **NOT MET** | Phase F |
| Occupancy / ICU / mortality null | Structural/experimental | Observed | Tested horizon |
| Admission-multiplier quantization | Model behavior | Observed | Implemented DR configuration |
| Discharge delay > observation horizon | Model behavior | Observed | Implemented DR configuration |
| GDP→emissions saturation | Model behavior | Observed | Implemented macro model |
| Event-gate behavior | Model behavior | Observed | Implemented model, tested configuration |
| Sentinel isolation excludes shared broadcast events | Architectural | Correctly scoped | KE design |
| Co-simulation positioning vs FMI/FMU, HLA | Interpretation | Supported | Implementation comparison |
| CO₂ causes real hospital deterioration | Real-world inference | **NOT ESTABLISHED** | Out of scope |
| Clinical / policy validity | Real-world inference | **NOT ESTABLISHED** | Future work |

---

## 14. Confirmation of Scope Compliance

- **No source code changed.**
- **No DR changed.**
- **No KE experiments changed.**
- **No Phase F design, seeds, parameters, or horizons changed.**
- **No experimental data changed.**
- **No QMS records changed.**
- **No PM-1 evidence changed.**
- **No frozen verdicts changed.**
- **No historical audit records changed.**
- **No new experiments run.**
- **No new statistical tests invented.**

Files written in this pass:
1. `docs/papers/jamia-2026-kronos-engine.md` (canonical manuscript — edited)
2. `docs/papers/ke-scientific-hardening-report.md` (this report — created)

---

## FINAL VERDICT

### READY FOR FINAL KE EDITORIAL / PRE-SUBMISSION REVIEW

The central contribution (sentinel adapter pattern; auditable macro-to-micro intervention traceability) remains intact and is now framed at the correct evidentiary level. The seven review-mandated corrections are applied: Mac canonical values restored, saturation limitation added, causal terminology scoped, conclusion reframed, co-simulation comparison added, "why not just pass data" addressed, DR/KE separation made explicit, d = 0.45 contextualized, and the isolation nuance documented.

No remaining claim in the canonical manuscript asserts a real-world climate-health, clinical, or policy effect. Empirical validation is explicitly future work.

The next phase is the separate final editorial/JAMIA pre-submission audit.
