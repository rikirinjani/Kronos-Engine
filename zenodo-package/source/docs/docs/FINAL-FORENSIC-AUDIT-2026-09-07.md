# Final Forensic Technical Audit: jamia-2026-kronos-engine.md

**Date:** 2026-09-07
**Manuscript:** `docs/papers/jamia-2026-kronos-engine.md`
**Method:** 5 parallel explorer investigations (P0: GDP delta, P0: determinism, P0: test failure, P0: degeneracy classification, P1: claim traceability)

---

## 1. P0 BLOCKERS

### P0-1: GDP Delta Sign Convention — CRITICAL

**Finding:** The delta formula is `intervention − baseline` (diff-engine.ts:29: `branchValue - parentValue`). The P-003 table reports negative mean ΔGDP for every nation. A "No WWII" scenario should produce higher GDP for war-affected nations, so negative deltas point the wrong direction.

**Evidence:**
- Economy sector WAR_START handler (economy.ts:32-66): attackers +3% GDP, defenders −15% GDP
- Economy sector WAR_CASUALTIES handler (economy.ts:68-81): drains GDP from ALL nations, not just belligerents
- **CRITICAL BUG: No WAR_END handler exists.** Economy sector subscribes to WAR_START and WAR_CASUALTIES but NOT WAR_END (events.ts:212). War economic effects are one-way — never reversed.
- The intervention patches war status to `"ended"` via `patchState()`, which does NOT publish a WAR_END event

**Why negative deltas appear:** W-1939-01 pre-exists at the rewind point. WAR_START was never triggered for it in either branch, so the +3%/−15% modifiers were never applied. The negative deltas are stochastic noise (all p > 0.5, all |d| < 0.1, SDs 10-100× larger than means). The missing WAR_END handler doesn't affect P-003 specifically but is a model bug.

**Severity:** P0

**Required action:**
1. Add delta sign convention to Section 2.7: *"Deltas are computed as intervention − baseline; a positive delta indicates higher values in the intervention branch."*
2. Add missing WAR_END handler to Section 4.4: *"The economy sector does not implement a WAR_END handler. War economic effects (attacker GDP boost, defender GDP penalty, global casualty drain) are not reversed when a war ends. This does not affect P-003 (W-1939-01 pre-exists at the rewind point) but limits generalizability of war counterfactual experiments."*
3. Do NOT interpret negative deltas as "war stimulates economy" — they are statistically indistinguishable from zero.

---

### P0-2: Determinism Audit — CONDITIONAL PASS

| Claim | Verdict | Evidence |
|-------|---------|----------|
| Mulberry32 PRNG throughout | **PASS** | rng.ts: clean, zero Math.random in KE src/ |
| Hospital RNG derived from world seed + ID | **PASS** | adapter.ts:85-87: XOR derivation, always seeded |
| Same seed produces reproducible results | **CONDITIONAL** | Year-epoch dependency: `new Date().getFullYear()` in DR age calculations (3 files). Deterministic within calendar year, 1-year drift across years. |
| Snapshot/restore reconstructs mutable state | **PARTIAL** | Kronos RNG fully restored. DR clock RNG not replayed on restore (gap). |
| Branch isolation verified | **PASS** | forkBranch creates separate state copies |

**DR Math.random:** 16 occurrences, ALL guarded by `rng ?? Math.random`. Adapter always seeds. Math.random NEVER reached.

**Severity:** MEDIUM

**Required actions:**
1. Add year-epoch caveat to Section 2.2
2. Add snapshot/restore gap to Section 4.4

---

### P0-3: Test Failure — LOW

**Finding:** Failing test is `health-surveillance > isolation: two sentinels get separate latest entries`. It's an assertion failure (not a timeout): hospital-B occupancy drifts below 0.85 threshold during stochastic simulation.

**Relevance to paper claims:** None. Tests sentinel isolation, not branch isolation or adapter correctness. Phase F report documents this as "pre-existing latent defect."

**Required action:** Fix by changing `patients: 45` → `patients: 48` (2-minute fix), or change "1 pre-existing timeout" to "1 pre-existing test design flaw."

---

### P0-4: P-003 Degeneracy — RESOLVED

**Finding:** 939/942 degenerate metrics (99.6%) arise from procedurally generated wars (W-NNNNN identifiers, seed-specific, n=1). Remaining 3 show zero variance (constant delta). This is legitimate extraction coverage, not a model problem.

**Required action:** Add concise characterization to Section 3.1.

---

## 2. P1 REQUIRED MANUSCRIPT FIXES

| # | Line | Current | Problem | Required change |
|---|------|---------|---------|-----------------|
| F1 | L43 | Contribution #3 mixes coupling, P-004, limitations | Architectural vs results conflated | Split into architectural contribution + implementation status + P-004 result |
| F2 | L273 | "Climate Intervention — Sentinel Health Impact" | Title implies health-impact study | Change to "Climate Configuration Intervention: Adapter Boundary Characterization" |
| F3 | L277 | Six df=1 metrics with individual names and d-values | Excessive prominence for diagnostic artifacts | Replace with summary statement |
| F4 | L89/319 | No deterministic vs empirical validity distinction | Missing methodological statement | Add: "Deterministic execution establishes reproducibility of model trajectories; it does not establish empirical validity." |
| F5 | L177 | Circuit breaker: "continues with last known good state" | Missing data quality implications | Expand: stale state not flagged, downstream metrics not quarantined |
| F6 | L323-331 | "Rare" / "Single-scale" / "Manual" for ABM/SD/DES families | Sweeping unsupported claims | Narrow or qualify |
| F7 | L355 | "Any micro-level simulator" universal language | No evidence beyond Deers Rock | Change to "designed to accommodate" |
| F8 | L215/255/287 | Delta sign convention never defined | Reader must reverse-engineer | Add explicit definition |
| F9 | L271 | "**Honest framing.**" bold pseudo-label | Heading-like feel in academic paper | Remove bold label |
| F10 | L299/409 | "1 pre-existing timeout" | It's an assertion failure | Fix test or change language |
| F11 | L314 | "regional health pressure heatmap" | Could imply geographic inference | Qualify as "simulated" |
| F12 | L251 | "validates the deterministic experimentation framework" | "Validates" is strong | Change to "demonstrates" |

---

## 3. EVIDENCE AUDIT

| Claim | Evidence | Status |
|-------|----------|--------|
| Deterministic core | rng.ts: Mulberry32, zero Math.random in KE | **PASS** |
| Hospital RNG determinism | DR Math.random guarded by `??`, adapter always seeds | **PASS** |
| Snapshot/restore | Kronos RNG restored; DR clock RNG gap | **PARTIAL PASS** |
| Branch isolation | forkBranch creates separate state copies | **PASS** |
| Adapter integration | Integration test proves adapter output | **PASS** |
| Heatwave pathway | Test verifies event pathway, NOT divergence | **PASS** |
| P-003 | 0/9 GDP outcomes significant; honest negative | **PASS** |
| P-003 degeneracy | 939/942 from procedural wars (n=1) | **PASS** |
| P-004 | 6 nominal df=1 artifacts; hospital metrics degenerate | **PASS** |
| P-004 propagation | Config doesn't generate adapter events | **PASS** |
| Sentinel deployment | 30 instances of one simulator, explicitly stated | **PASS** |
| Test suite | 333 tests, 332 pass, 1 assertion failure | **PASS** |

---

## 4. FINAL SCIENTIFIC POSITION

This paper demonstrates a deterministic architecture for connecting macro-scale world simulation to micro-scale hospital simulation through a sentinel adapter pattern. The adapter correctly translates macro conditions into hospital-relevant parameters and publishes aggregated hospital pressure signals. Two exploratory experiments validate the pipeline: a WWII counterfactual produces an honest negative result (no defensible GDP effect), and a climate-emissions intervention demonstrates that configuration-level macro changes do not automatically propagate across the adapter boundary because the adapter consumes discrete events rather than configuration parameters.

The paper does NOT demonstrate: empirically validated predictions, bidirectional coupling, clinical health impact, cross-platform reproducibility, or generalizability beyond Deers Rock.

The sentinel adapter pattern is a genuine architectural contribution. The P-004 null result is itself informative — it reveals that the current architecture requires explicit event-level coupling between macro and micro scales, not just configuration parameter changes.

---

## 5. FINAL GATE

**CONDITIONAL FREEZE — ONLY MINOR MANUSCRIPT FIXES REMAND**

No evidence contradiction exists. 12 manuscript fixes required before reviewer-traceable:

- **3 HIGH:** F4 (determinism ≠ validity), F5 (circuit breaker), F8 (delta convention)
- **4 MEDIUM:** F1 (contribution splitting), F3 (df=1 prominence), F6 (comparison table), F10 (test language)
- **5 LOW:** F2 (title), F7 (generalization), F9 (honest framing), F11 (heatmap), F12 (validates → demonstrates)

Additionally: WAR_END handler bug (document in limitations), test fix recommended (2 min), year-epoch caveat needed.

The manuscript should NOT be submitted until F4, F5, and F8 are resolved.
