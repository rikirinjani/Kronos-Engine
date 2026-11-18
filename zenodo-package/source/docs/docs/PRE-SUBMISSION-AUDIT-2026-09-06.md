# Pre-Submission Audit: jamia-2026-kronos-engine.md

**Generated:** 2026-09-06  
**Manuscript:** `docs/papers/jamia-2026-kronos-engine.md`  
**Evidence matrix:** `docs/MANUSCRIPT-EVIDENCE-MATRIX-2026-09-06.md`

---

## Critical Issues (Must Fix Before Submission)

### C1: Section 3.2 — Stale Hospital Effect Sizes (Superseded Artifact)

**Problem:** The manuscript presents a table showing 5 hospital metrics with non-zero effect sizes (Tube feedings d=+0.65, Disease prevalence d=+0.53, etc.). The P-004 data (`p004-30seeds-summary.json`) shows ALL sentinelOutput metrics are degenerate (stdDev=0, same value across all 30 seeds). The 6 significant metrics are ALL world-level economy/technology, not hospital.

**Root cause:** The table numbers came from a superseded 212-metric artifact (commit 1e36cbd) generated against a nondeterministic DR distribution. Commit 9ca3ea0 reran against the deterministic distribution and all hospital metrics collapsed to degenerate. This is an artifact-version hygiene issue, not an integrity failure — but the stale data was never updated in the manuscript.

**Evidence:**
- `sentinelOutput.occupancyRate`: 0.0229 across all 30 seeds, stdDev=0, degenerate=true
- `sentinelOutput.icuOccupancyRate`: 0.0357 across all 30 seeds, stdDev=0, degenerate=true
- `sentinelOutput.mortalityPressure`: 0 across all 30 seeds, stdDev=0, degenerate=true
- `world.state._clinicalNutrition.tubeFeedings.length`: 2 across all 30 seeds, stdDev=0, degenerate=true
- 6 significant metrics: `nations.JPN.gdpGrowthRate` (d=-9.92), `nations.GBR.inflationRate` (d=-47.12), `marketIndex` (d=-11.72), `nations.IND.rdSpending` (d=+43.53), `nations.IND.patents` (d=-21.07), `nations.IDN.rdSpending` (d=+33.10) — ALL have df=1 (only 2 non-degenerate seeds)

**Fix:** Remove the fabricated hospital metrics table. Replace with accurate reporting:
- State that ALL sentinelOutput metrics are degenerate (zero variance across seeds)
- State that the 6 significant metrics are world-level economy/technology artifacts with df=1
- Remove the "hospital metrics with largest effect sizes" framing

### C2: Section 2.6 / Abstract — Integration Test Overstatement

**Problem:** Section 2.6 states "The test verified that climate-to-hospital (world→hospital) propagation produces measurable operational signal." The integration test assertions (heatwave.test.ts lines 178-182) only check `sentinelOutput !== null` — they do NOT compare baseline vs heatwave for divergence.

**Evidence:** Integration test assertions:
```
expect(baselineDR).not.toBeNull();
expect(heatwaveDR).not.toBeNull();
```

**Fix:**
- Section 2.6: Change "produces measurable operational signal" to "produces sentinel output" or "the adapter produces non-null sentinel output"
- Abstract: Change "the hospital produced observable operational changes" to accurately reflect what was verified
- Clarify that the integration test verifies the event pathway EXISTS (adapter produces output when events are injected), not that the climate config intervention produces hospital divergence

### C3: Section 1, Contribution #3 — Overstated Coupling Claim

**Problem:** Contribution #3 states "Verified one-way coupling of climate, economy, and health sectors via an integration test." The integration test verifies the adapter produces output when events are injected, but does NOT verify that the specific P-004 climate config intervention produces hospital divergence.

**Fix:** Rephrase to: "Integration test verifying the adapter produces sentinel output when macro events are injected; the adapter's event-driven pathway is operational, though the specific climate configuration intervention tested in P-004 does not propagate to hospital outcomes (design-scope limitation)."

### C4: Section 1, Contribution #5 — Overstated Prospective Claim

**Problem:** Contribution #5 states "Climate-emissions-to-hospital operational pipeline with a 30-sentinel regional network." This implies the pipeline produces hospital effects, which P-004 shows it does not (all sentinelOutput metrics degenerate).

**Fix:** Rephrase to: "Climate-emissions counterfactual demonstrating adapter deployment across a 30-sentinel regional network; all hospital sentinel metrics are degenerate under the tested configuration intervention, confirming the adapter's operational scalability without establishing clinical effect."

---

## Moderate Issues (Should Fix)

### M1: Abstract — "observable operational changes" claim

**Problem:** Abstract states "the hospital produced observable operational changes" — but P-004 shows zero hospital divergence.

**Fix:** Change to accurately reflect: the adapter correctly translated macro events into hospital parameters (the event pathway works), but the specific climate config intervention did not produce measurable hospital-level changes under the tested conditions.

### M2: Section 3.2 — "6 uncorrected significances dominated by economy artifacts"

**Problem:** The narrative is correct but the table contradicts it by showing hospital metrics.

**Fix:** After removing the fabricated table, the narrative is accurate. Ensure the revised text explicitly states: "None of the 6 significant metrics were hospital metrics; all were world-level economy/technology metrics with df=1 (only 2 non-degenerate seeds)."

### M3: Conclusion — "architectural correctness"

**Problem:** "Two exploratory experiments demonstrate the platform's architectural correctness" overstates what P-004 demonstrates (adapter works mechanically, config doesn't propagate).

**Fix:** Change to: "Two exploratory experiments demonstrate the platform's architectural operation: the adapter correctly translates macro events into hospital parameters (integration test verified), and the deterministic counterfactual pipeline produces reproducible results (P-003, P-004)."

### M4: Section 3.2 — "operational early indicators"

**Problem:** "we interpret these as operational early indicators rather than clinical findings" implies hospital effects exist but are early. P-004 shows zero hospital divergence.

**Fix:** Remove this framing. State instead that the climate config intervention did not produce measurable hospital-level changes under the tested conditions (20 ticks, specific config parameters).

---

## Minor Issues (Optional)

### m1: Figure descriptions

Figure descriptions are placeholder text ("about here"). These should be finalized before submission but are not evidence-integrity issues.

### m2: Section 2.6 test name

The integration test is named "baseline vs heatwave produces measurable differences" but only checks existence. This is a code-level issue, not a manuscript issue, but worth noting.

---

## Sections Confirmed Accurate

- **Section 1 (Introduction):** Correctly framed as architecture/methods paper. No clinical claims.
- **Section 2.1-2.5 (Architecture, Determinism, Sectors, Event Bus, Adapter):** Accurately describe implementation.
- **Section 2.7 (Counterfactual Pipeline):** Statistical methods correctly described.
- **Section 2.8-2.9 (Historical Data, Calibration):** Accurately described.
- **Section 3.1 (P-003):** Correctly framed as honest negative result. All claims verified.
- **Section 3.3 (Regional Network):** Accurately describes adapter deployment.
- **Section 3.4 (Performance):** Accurately described.
- **Section 4.1-4.3 (Adapter, Determinism, Comparison):** Accurately framed.
- **Section 4.4 (Limitations):** Comprehensive and accurate. Correctly identifies all major limitations.
- **Section 4.5 (Generalizability):** Accurately framed.
- **Section 5 (Conclusion):** Minor revision needed (M3).
- **References:** All appropriately cited. No fabrications.

---

## Residual Issues (Found by DR Independent Verification)

### R1: Section 3.2 — Stale Primary Outcome Numbers (line 281)

**Problem:** The revised Section 3.2 still cited "CSSD sterilization cycles d = −0.36, p = 0.091; dialysis sessions d = +0.28, p = 0.154; occupancy rate d = −0.22, p = 0.307" — numbers from the superseded 212-metric artifact. Line 279 says "all hospital sentinel metrics are degenerate" — line 281 directly contradicted it.

**Fix:** Replaced with "The pre-specified hospital primary outcomes (CSSD sterilization cycles, dialysis sessions, occupancy rate) are all degenerate in the current data (stdDev = 0, d = 0, no testable variance)."

### R2: Test-Suite Claims (lines 299, 409)

**Problem:** "324 tests" → reality: 323 (1 pre-existing E3 isolation test failure). "Jest" → project uses Vitest. "under 30 seconds" → ~84–105s on this hardware.

**Fix:** Updated to "323 tests", "Vitest", "under 2 minutes".

---

## Verdict

**READY FOR HUMAN AUTHOR REVIEW** — all critical issues (C1-C4) and residual issues (R1-R2) resolved. DR independent verification confirmed all fixes.
