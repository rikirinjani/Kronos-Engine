# Corrected Counterfactual Experiment — Design

**Status:** PROPOSED — NOT APPROVED — NOT EXECUTED
**Date:** 2026-09-19
**Author:** orchestrator (KE resume session)
**Depends on:** `docs/experiments/EXP-001-SERIES-RECONCILIATION.md`
**Authority:** KRONOS ENGINE AGENT RESUME / HANDOFF, §17
**Baseline:** `e9d0fed` (EXP-001E) on `exp-001-counterfactual-stability`

> Execution is forbidden until this design is approved (§ Approval). No Monte Carlo, no ensemble, no manuscript change, no Zenodo packaging is authorized by this document.

---

## 0. Objective

Produce **one clean, isolated, observable, reproducible counterfactual experiment** whose result can be reported without the instrumentation caveats that invalidated EXP-001.

The objective is *methodological validity first*, effect discovery second. A pre-registered null result from a valid apparatus is an acceptable outcome; an uninterpretable positive from an invalid apparatus is not.

## 0.1 Non-goals

- Not a rerun of EXP-001's 10,000-run ensemble.
- Not a 50,000-run scale-up.
- Not a clinical or policy claim.
- Not an empirical calibration exercise.
- Not a manuscript revision.
- Not proof of no effect if null.

## 0.2 Preconditions (all must hold before launch)

| ID | Precondition | Verification |
|----|--------------|--------------|
| P1 | Working tree contains no uncommitted modification to frozen evidence | `git status` review; R-1 resolved |
| P2 | Baseline commit pinned and pushed | `git rev-parse HEAD` recorded in provenance |
| P3 | EXP-001E isolation test passes | `exp-001e-branch-isolation.test.ts` 3/3 |
| P4 | EXP-001D snapshot test passes | 7/7 |
| P5 | Full suite failures accounted for | 586 pass; 3 known pre-existing failures documented |
| P6 | Design approved (§ Approval) | signed |

---

## 1. Paired-world construction

**Element:** Each replicate is a *pair* of worlds that are bit-identical up to the intervention tick.

- Same `worldSeed`.
- Same sector configuration, same sector list, same order.
- Same RNG draw sequence up to the intervention tick.
- Arm A = control (no intervention). Arm B = treatment (intervention applied at tick `T_i`).

**Invariant (gating):** at tick `T_i`, the two arms' serialized world state must hash identically. If the pre-intervention state hashes differ, the replicate is **discarded and logged**, not analysed.

**Implementation note:** construct both arms by `forkBranch` from a single rewind point captured at `T_i` (not by two independent runs), so that the pre-intervention trajectory is shared by construction and the isolation invariant is exercised directly.

---

## 2. Branch isolation

**Element:** Every replicate must demonstrate branch isolation *before* its result counts.

- Capture rewind point at `T_i` from the parent run.
- Fork arm A and arm B from that rewind point.
- **Isolation precheck:** fork a third, *null* branch (no intervention) and compare its trajectory to arm A. They must be identical.
- Additionally verify: a branch forked from the rewind point equals a fresh independent run with the same seed up to `T_i` (the EXP-001E invariant).

**Gate:** any isolation-precheck failure aborts the replicate and is recorded as an apparatus failure, not a result. A run whose isolation precheck fails must never enter the statistics.

**Residual awareness:** DR module-global ID counters are not captured in snapshots, so identifier labels may differ across branches. **Identifier equality is a separate diagnostic, not a gating criterion.** Trajectory equality is the gate.

---

## 3. Snapshot semantics

**Element:** Snapshot capture and reconstruction must be deep-isolated and observable.

Current baseline (`deers-rock-adapter.ts`):

| Field | Capture | Reconstruct |
|-------|---------|-------------|
| `hospitalState` | `deepClone` (line 217) | `deepClone` (line 242) |
| `lastTickState` | `deepClone` (line 219) | — |
| `events` | `deepClone` (line 215) | — |
| `sentinelOutput` | **by reference** (line 218) | **by reference** (line 253) |

**Required decisions before launch:**

- **D-S1 (RESOLVED — R-2):** `sentinelOutput` IS aliased (mutation propagates), but safe in practice because each tick creates a fresh object and no production code mutates it in-place. **Decision:** apply deepClone to sentinelOutput in `makeSnapshot` (line 218) and `doReconstruct` (line 253) for defense-in-depth. Cost is negligible; eliminates silent contamination risk.
- **D-S2:** Document the ID-counter residual explicitly in the provenance record; do not attempt counter reset (deemed unsafe for `T_i > 0`).

**Snapshot integrity check (per replicate):** deep-serialize `rp.sectorStates` before and after the parent run; the mutated-field count must be **0** (EXP-001E showed 21 pre-fix). Any non-zero count aborts the replicate.

---

## 4. sentinelOutput observability

**Element:** The EXP-001B defect (downstream channel invisible) must be structurally impossible to recur silently.

Assertions per replicate, all gating:

| Check | Expected |
|-------|----------|
| Live `sentinelOutput` populated after tick | non-null |
| Snapshot `sentinelOutput` populated | non-null |
| Snapshot `sentinelOutput` == live `sentinelOutput` | equal |
| Reconstruction preserves `sentinelOutput` | equal |
| Diff engine observes sentinelOutput paths | ≥ 11 paths |
| Raw `__snapshot()` returns non-null `sentinelOutput` | true |

Any failure aborts the replicate and is logged as an apparatus failure.

---

## 5. Observer inclusion

**Element:** Use the passive observer (`src/experiment/exp-001-observer.ts`) to record the cross-sector event stream independently of the endpoints.

- Observer appended **LAST** in the sector list — its contract states this preserves the RNG draw sequence for pre-existing sectors.
- Records `eventCounts`, `firstEventTick`, `totalEvents` for the 17 observed event types (including `health.pressure`, `health.mortality`, `health.supply-crisis`, `health.surge`, `health.down`).
- Observer state must be captured in the snapshot and survive reconstruction like any other sector.
- Observer output is a **secondary diagnostic**, used to explain *mechanism*; it is not a primary endpoint.

---

## 6. Exact intervention

**Element:** One intervention, one pathway, chosen so the endpoint is not structurally null.

**Selection constraints (from Phase F and EXP-001A):**

- The pathway must be integration-tested (Phase F verified `EXTREME_WEATHER → admission_surge + supply_chain_pressure + active_disaster → DR`).
- Avoid interventions whose endpoint is structurally null under the tested configuration: occupancy/mortality null, admission-multiplier quantization insensitive, discharge delay > observation horizon.
- Avoid threshold-defined endpoints: EXP-001A showed emission is a horizon-dependent threshold crossing, so a threshold endpoint manufactures its own horizon dependence.

**Proposed:** intervention on a **single macro parameter with a continuous downstream channel** — e.g. the CO₂ / climate channel used in Phase F (280 vs 800), or a single `EXTREME_WEATHER` injection through the verified pathway.

**Required before launch:** write the intervention as a one-line, deterministic, replayable operation with an explicit `T_i`, and state the *pre-registered expected direction* of the primary endpoint.

**Approved (R-3):** Single `EXTREME_WEATHER` event injected at tick T_i=20 via the verified Phase F pathway (→ admission_surge + supply_chain_pressure + active_disaster → Deers-Rock hospital model). Expected direction: supplyStress increases post-intervention.

---

## 7. Horizon

**Element:** Horizon must be justified per endpoint, not inherited.

Evidence: occupancy ≈ 0.45 @ H10, ≈ 0.54 @ H20, ≈ 0.82–0.88 @ H50 (seed-dependent). Phase F found H=20 insufficient for some pathways.

**Required:** choose `H` such that (a) the endpoint is non-degenerate, and (b) any threshold-crossing mechanism has occurred within the horizon. State the rationale numerically. If the endpoint is threshold-driven, prefer a continuous endpoint measured over the whole horizon instead of a single-tick value.

`H` is fixed before launch and is not adjusted adaptively.

**Approved (R-3):** H=50 ticks. Occupancy reaches 0.82–0.88 @ H50 (Phase F). Threshold-crossing effects have time to manifest. Post-intervention observation window: ticks 21–50 (30 ticks).

---

## 8. Endpoints

**Element:** Pre-registered, small, continuous, direction-specified.

| Tier | Content | Rule |
|------|---------|------|
| Primary | exactly **one** continuous endpoint: mean `supplyStress` over post-intervention ticks 21–50 | direction declared a priori: supplyStress increases |
| Secondary | a short, closed list (≤ 8) of pre-specified continuous endpoints (e.g. mean occupancyRate, mean mortalityPressure, admissionSurge frequency) | declared a priori |
| Diagnostic | observer event counts, ID-label equality, snapshot metrics | not hypothesis-tested |

**Approved (R-3):** Primary endpoint is mean `supplyStress` over post-intervention ticks 21–50 (the 30-tick window after T_i=20). Pre-specified direction: supplyStress increases under EXTREME_WEATHER intervention.

**Excluded a priori:** any metric with zero variance in the pre-screen; any threshold-defined binary outcome; any `wars.*.startYear`-class artifact; any direct climate parameter masquerading as a downstream effect.

---

## 9. Degeneracy handling

**Element:** Degeneracy is screened and reported, never counted as null.

Follow the P-003/P-004 practice:

1. Pre-screen all candidate metrics on a small pilot for variance.
2. Classify each as **testable** or **degenerate** (zero-variance, or n=1 seed-specific procedural artifacts).
3. Report the degenerate fraction.
4. Exclude degenerate metrics from the hypothesis family.
5. Do **not** interpret degeneracy as absence of effect.

**Stopping rule:** if the degenerate fraction of the pre-registered endpoint family exceeds a pre-set threshold (e.g. > 50%), stop and redesign rather than proceed.

---

## 10. Statistical plan

**Element:** Paired design, pre-registered test, effect size, power.

- **Design:** paired — each seed contributes a control/treatment pair; analyse the within-seed delta.
- **Test:** Wilcoxon signed-rank (primary, no normality assumption) with paired *t* / Cohen's `d_z` as a reported companion.
- **N:** pre-registered at **N=50 seeds**. 5-seed pilot used only for pathway/degeneracy validation, NOT for power estimation.
- **Alpha:** pre-registered (e.g. 0.05).
- **Effect size:** report `d_z` and its CI, not just *p*.
- **Direction:** two-sided (supplyStress increases is the expected direction, but test is two-sided).
- **Reporting:** per-seed deltas, distribution plots, and the aggregate test — not just the summary statistic.

**Approved (R-3):** N=50 pre-specified. Wilcoxon signed-rank is primary. Paired t-test + Cohen's d_z are companion analysis (not primary). 5-seed pilot for degeneracy/pathway validation only.

No adaptive sample-size extension after peeking.

---

## 11. Multiple-testing correction

**Element:** A small pre-registered family, corrected.

- The family is **declared before launch** (primary + secondary list). Do not test 236/278 metrics opportunistically.
- **BH-FDR** at pre-registered `q` (e.g. 0.05) across the declared family.
- **Bonferroni** reported as a conservative companion.
- Report the **expected false-positive count** for the family size (EXP-001 reported expected FP ≈ 11.8 / 13.9 — that framing stays).
- A result surviving only uncorrected is reported as **uncorrected**, never as a finding.

---

## 12. Provenance

**Element:** Every artifact is traceable and hashable.

| Artifact | Requirement |
|----------|-------------|
| Commit | exact `git rev-parse HEAD` recorded |
| Seed set | explicit list, no "seeds 42–71" shorthand |
| Config | full serialized config, including `T_i`, `H`, intervention spec |
| Raw results | JSONL, append-only, never overwritten |
| Hashes | SHA256 of every raw artifact |
| Report | `docs/experiments/` |
| Scripts | `src/experiment/experiments/` |
| PM-1 trace | `self-harness/traces/` |
| QMS | verification record under `qms/records/verifications/` |
| MemPalace | drawer with the decision + finding |
| Production change | separate commit if production code changes |

---

## 13. Deterministic replay

**Element:** Reproducibility is a gating property, not an aspiration.

- Same seed + config + commit ⇒ **bit-identical** trajectory.
- Verify by replaying a random sample of replicates and comparing serialized state hashes at the final tick.
- **Gate:** any replay mismatch aborts the run and is recorded as an apparatus failure.
- Record the replay-verification result in the QMS record.

---

## 14. Stopping criteria

**Element:** Pre-registered rules for success, failure, and abort. No post-hoc rationalization.

| Trigger | Action |
|---------|--------|
| Any isolation precheck failure | ABORT replicate; log apparatus failure |
| Any snapshot-integrity failure (mutated-field count ≠ 0) | ABORT replicate |
| Any sentinelOutput observability failure | ABORT replicate |
| Degenerate fraction > threshold (§9) | STOP experiment; redesign |
| Replay mismatch (§13) | ABORT run |
| Primary endpoint significant after BH-FDR, in pre-registered direction, with adequate power | SUCCESS — report |
| Primary endpoint not significant after correction | REPORT AS EXPLORATORY NEGATIVE — do not claim absence of effect |
| Apparatus failure rate above pre-set tolerance | STOP; treat as infrastructure defect, not science |

**Success is not required for a valid result.** A clean null is a reportable outcome; an uninterpretable positive is not.

---

## 15. Risks

| ID | Risk | Mitigation |
|----|------|------------|
| K-1 | `sentinelOutput` reference-sharing (D-S1 unresolved) reintroduces aliasing | resolve R-2; deepClone if uncertain |
| K-2 | ID-counter residual corrupts label-based joins | join on trajectory/state, not labels; record label-equality as diagnostic only |
| K-3 | Endpoint structurally null again (repeat of Phase F) | endpoint selection constrained by §6/§8; pilot pre-screen |
| K-4 | Threshold-driven horizon dependence (repeat of EXP-001A) | prefer continuous endpoints (§8) |
| K-5 | Frozen evidence overwritten by experiment tooling | P1; never write raw artifacts over committed paths |
| K-6 | Degeneracy mistaken for null | §9 explicit handling |

---

## 16. Approval

Execution requires an explicit human approval recorded below. Until then this document is a proposal only.

| Role | Decision | Date |
|------|----------|------|
| Research lead | **APPROVED WITH MODIFICATIONS** | 2026-09-19 |

**Approved parameters (R-3):**
- Intervention: single EXTREME_WEATHER at T_i=20
- H: 50 ticks; post-intervention window: ticks 21–50
- Primary endpoint: mean supplyStress over post-intervention ticks 21–50
- N: 50 seeds (pre-specified, not estimated from pilot)
- 5-seed pilot: degeneracy/pathway validation only
- Wilcoxon signed-rank: primary test
- Paired t-test + Cohen's d_z: companion analysis (not primary)
