# EXP-001 Series — Reconciliation

**Status:** PREPARED (awaiting review/approval)
**Date:** 2026-09-19
**Author:** orchestrator (KE resume session)
**Authority:** KRONOS ENGINE AGENT RESUME / HANDOFF, §17
**Execution status:** NOT EXECUTED — this document classifies existing results only.

---

## 0. Repository state at time of reconciliation

| Item | Value |
|------|-------|
| Active branch | `exp-001-counterfactual-stability` |
| HEAD | `e9d0fed` (EXP-001E branch isolation fix) |
| Remote tracking | `origin/exp-001-counterfactual-stability` @ `e9d0fed` (in sync) |
| `master` | `4d7e412` = `origin/master` |
| Other worktree | `reopen-remediation` @ `698146f` → `C:/Users/think/Project_v2/Kronos-Engine-remediation` |
| `git fetch --all --prune` | no remote changes |

Production commits under review:

```
f37e6ce  EXP-001D  snapshot integrity fix (sentinelOutput visible through snapshot)
e9d0fed  EXP-001E  branch isolation fix (deepClone at capture + reconstruct)
```

Both are separate and intentional. Neither is to be combined or rewritten.

### 0.1 Working-tree hazard (blocking hygiene, not science)

The working tree contains **uncommitted modifications to frozen evidence**:

| File | Committed | Working tree | Effect |
|------|-----------|--------------|--------|
| `experiment-results/dr-counterfactual/runs.json` | 14,424 lines | 128 lines | 99.1% truncated |
| `experiment-results/dr-counterfactual/summary.json` | 6,524 lines | 175 lines | ~97% truncated |
| `experiment-results/wwii-counterfactual/p003-calibrated-runs.json` | — | modified | P-003 evidence |
| `qms/records/.../ncr-006-p004-*.json`, `ver-004-dr-reopen.json` | — | modified | QMS records |
| `docs/papers/jamia-2026-kronos-engine.md` | — | modified | manuscript evidence |
| `.zenodo.json`, `CITATION.cff`, `LICENSE` | — | modified | package metadata |

The committed + pushed versions are intact, so **no evidence is lost in git**. The on-disk truncation is uncommitted and must not be committed. Recovery, if desired, is `git restore <path>` — **not executed here; requires explicit authorization.**

---

## 1. Purpose

Classify every result in the EXP-001 series (`EXP-001 → EXP-001A → EXP-001B → EXP-001C → EXP-001D → EXP-001E`) into exactly one category, so that the corrected experiment is designed from a known baseline rather than from a partially-valid evidence base.

Categories:

| Category | Meaning |
|----------|---------|
| **VALID** | Result stands as reported. |
| **VALID BUT MISLABELLED** | The measurement is real; the label/interpretation is wrong. |
| **DIAGNOSTIC ONLY** | Real observation, but not a scientific effect estimate. |
| **INVALIDATED BY INSTRUMENTATION** | The measurement could not observe what it claimed. |
| **REQUIRES RE-RUN** | Depends on defective instrumentation; must be regenerated under repaired baseline. |

---

## 2. Classification table

### 2.1 EXP-001 (original run)

| # | Item | Original framing | Classification | Basis |
|---|------|------------------|----------------|-------|
| 1 | Macro intervention applied | macro event = 100% | **VALID** | Direct injection confirmed; intervention reached the world. |
| 2 | "adapter translation = 0% H10/H20, 45.8% H50" | adapter failed to translate | **VALID BUT MISLABELLED** | The metric `adapterTranslated` actually measured `health.*` event *emission*. True adapter translation occurred in **100%** of runs (EXP-001A). |
| 3 | "structural null" (H10/H20) | structural null in adapter | **INVALIDATED BY INSTRUMENTATION** | Emission rate is a horizon-dependent threshold crossing (occupancy 0.45@H10 → 0.54@H20 → ~0.82–0.88@H50), not adapter failure. |
| 4 | `downstreamDelta = 0` | no downstream effect | **INVALIDATED BY INSTRUMENTATION** | `sentinelOutput` was lost through the snapshot pathway (EXP-001B). The downstream measurement was structurally invisible. |
| 5 | H10: 236 tested / 29 sig / 13 FDR (exp. FP ≈ 11.8) | hospital/climate effects | **REQUIRES RE-RUN** | Generated under defective instrumentation. Survivors were largely direct climate parameters and artifact-like `wars.*.startYear`. |
| 6 | H20: 278 tested / 28 sig / 12 FDR (exp. FP ≈ 13.9) | hospital/climate effects | **REQUIRES RE-RUN** | Same as #5. |
| 7 | Runtime/cost: 23,000 paired sims, ~6.71 h, ~$0.201 | logistics | **VALID** | Operational record; unaffected by instrumentation defects. |

### 2.2 EXP-001A

| # | Item | Classification | Basis |
|---|------|----------------|-------|
| 8 | `adapterTranslated` measures `health.*` emission, not adapter translation | **VALID** | Metric-definition audit; explains the mislabel in #2. |
| 9 | Adapter translation actually 100% | **VALID** | Direct observation post-relabel. |
| 10 | Threshold semantics (occupancy >0.85 pressure; >0.90 surge; mortalityPressure >0; supplyStress >0.7) | **VALID** | Confirmed in `deers-rock-adapter.ts` tick handler. Model-semantic result. |

### 2.3 EXP-001B

| # | Item | Classification | Basis |
|---|------|----------------|-------|
| 11 | Snapshot loses `sentinelOutput` (live populated, snapshot `{}`, raw `__snapshot()` null) | **VALID** (diagnostic) | Reproduced; fixed by `f37e6ce`. |
| 12 | Parent/branch contamination (seed 1003/H50: fresh 0.824 vs parent→branch 0.878) | **VALID** (diagnostic) | Reproduced. Mechanism later pinned to state aliasing by EXP-001E. |
| 13 | Module-global DR ID counter hypothesis | **REJECTED as sufficient cause** | Tested and ruled out; superseded by aliasing (#16). |

### 2.4 EXP-001C

| # | Item | Classification | Basis |
|---|------|----------------|-------|
| 14 | Stale snapshot closure (snapshot read tick-0 `self.sentinelOutput` = null) | **VALID** (diagnostic) | Root cause of #11; fixed by `f37e6ce`. |

### 2.5 EXP-001D (`f37e6ce`)

| # | Item | Classification | Basis |
|---|------|----------------|-------|
| 15 | Snapshot fix: tick handler captures current state | **VALID** (production) | live == snapshot; 11 sentinelOutput paths visible; diff engine sees 11; 7/7 verification passed. |
| 16 | Seed 1003/H50 observed deltas: occupancy 0.824→0.969 (Δ+0.145); supplyStress 0.324→0.037 (Δ−0.287); diseasePrevalence.E11 32→56 (Δ+24) | **DIAGNOSTIC ONLY** | Observed under repaired instrumentation but **before** branch isolation was fixed (#17). Not validated causal estimates. |

### 2.6 EXP-001E (`e9d0fed`)

| # | Item | Classification | Basis |
|---|------|----------------|-------|
| 17 | Root cause: snapshot aliasing. `makeSnapshot()` stored `hospitalState` by reference; `doReconstruct()` aliased it; `cssdHandler` shallow-copied `[...cssd.trays]` but mutated tray objects in place | **VALID** | Deep diff: exactly 21 of 12,211 fields mutated, all `_cssd.trays[i]` (`sterilizedAt 0→28200000`, `expiresAt 100→566`, `cycleId null→"CYCLE-26"`). |
| 18 | Mechanism pinned by pre-clone experiment (clone before parent = 0.8244; clone after = 0.9084) | **VALID** | Isolates the effect to rewind-state mutation. |
| 19 | Fix: deepClone at capture (`hospitalState`/`lastTickState`/`events`) and at reconstruct (`hospitalState`) | **VALID** (production) | Snapshot diff 21→0; variant matrix converges to fresh baseline (0.8244 / 325 / 108). |
| 20 | Isolation + reproducibility: seeds 1001–1005 × H{10,25,50} = 15/15 PASS | **VALID** | Direct verification. |
| 21 | Regression: EXP-001D 7/7 preserved; new isolation test 3/3; full suite 586 passed | **VALID** | 3 residual failures pre-existing (health-surveillance identical at HEAD; zenodo-package DR dependency resolution). |
| 22 | Residual: DR module-global ID counters not captured in snapshot → ID labels (e.g. CSSD `cycleId`) may differ between fresh and parented branches | **DIAGNOSTIC ONLY** | Trajectory identical across all 15 combinations. Label equality ≠ trajectory equality. Counter reset explicitly deemed unsafe for rewind points at tick > 0. |

### 2.7 Frozen prior evidence (unchanged, restated for the record)

| # | Item | Classification | Basis |
|---|------|----------------|-------|
| 23 | P-003: 30 seeds 42–71; 291 testable / 942 degenerate (939 from seed-specific procedural wars n=1); 19 uncorrected sig; 1 BH-FDR + Bonferroni survivor; 0/9 GDP sig; GDP \|d_z\| ≤ 0.09 | **VALID** (frozen) | Exploratory negative. Not proof of no real-world effect. |
| 24 | P-004: 30 seeds; 106 testable / 93 degenerate; 6 uncorrected sig; 0 FDR; 0 Bonferroni | **VALID** (frozen) | Six uncorrected results tied to df=1/tiny-variance world-level economy/technology artifacts. No defensible corrected hospital effect. |
| 25 | Phase F: CO₂ 280/800; seeds 42–46; H=20; supplyStress Δ=+0.219 (seed 46), mean ≈ +0.044, direction consistency 1/5 = 0.20; 80% criterion not met; occupancy/mortality structurally null; admission multiplier quantization insensitive; discharge delay > horizon; GDP→emissions runaway; adapter pathway integration-tested; isolation invariants passed; Mac regression 333/333 | **VALID** (frozen) | Architectural/diagnostic result. Not evidence of a general macro→health causal effect. |

---

## 3. Consequences

1. **The EXP-001 "downstream null" is dead as evidence.** It cannot be cited as showing absence of downstream effect (#3, #4).
2. **EXP-001's H10/H20 statistics cannot be reused.** They were produced by an instrument that could not see the downstream channel (#5, #6).
3. **The repaired baseline has no large-ensemble result yet.** `f37e6ce` + `e9d0fed` fixed the apparatus; no corrected ensemble has been run.
4. **The seed 1003/H50 deltas (#16) are the strongest *observable* signals so far, but they are diagnostics, not estimates.**
5. **The original "structural null" language must not appear in any downstream write-up as an adapter failure** — it is a threshold-crossing semantics result (#2, #3, #10).

---

## 4. What this reconciliation does NOT establish

- No statistically validated hospital causal effect.
- No corrected large-ensemble effect estimate.
- No clinical or real-world predictive validity.
- No empirical calibration.
- No generalizable climate → hospital effect.
- No policy conclusion.

---

## 5. Open items

| ID | Item | Owner | Status |
|----|------|-------|--------|
| R-1 | Decide fate of truncated frozen artifacts in working tree (restore vs investigate) | **RESOLVED** | Restored all 15 frozen-evidence tracked files to HEAD (e9d0fed). Only 3 intentional analysis code files remain modified. |
| R-2 | Confirm `sentinelOutput` reference-sharing at capture/reconstruct (adapter lines 218, 253) is safe or requires deepClone | **RESOLVED** | sentinelOutput IS aliased but safe in practice. deepClone recommended for defense-in-depth. 5/5 tests pass. |
| R-3 | Approve corrected-experiment design | human | **PROPOSED — PENDING APPROVAL** |
| R-4 | Zenodo v1.0: correct stale manuscript/artifact values before first immutable publication | human | OPEN |

---

## 6. Approval

This reconciliation is a **classification of existing results**. It authorizes nothing. The corrected experiment design is a separate document and must be approved before any execution.

| Role | Decision | Date |
|------|----------|------|
| Research lead | PENDING | — |
