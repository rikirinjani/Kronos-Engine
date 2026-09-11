# EXP-001E — Counterfactual Branch Isolation: Root Cause, Repair, and Verification

**Date:** 2026-09-11
**Branch:** `exp-001-counterfactual-stability`
**Status:** COMPLETE — root cause identified, production repair applied, verified across seeds
**Seed/horizon for primary evidence:** 1003 / 50 (multi-seed matrix in §6)
**Budget:** Diagnostic only (no Monte Carlo re-runs)

---

## 1. Objective

EXP-001B/C established that a counterfactual branch reconstructed from a rewind point
(`parent → reconstruct`) diverges from a fresh independent branch (`fresh`), and that:

- module-global ID counters are **not** the sufficient cause (counter reset had zero trajectory effect);
- only a full `createWorld`-equivalent re-initialisation eliminated the divergence.

EXP-001E's goal was to identify the **minimal causal state**, repair branch isolation, and verify it.

---

## 2. Root Cause (confirmed)

**The rewind point aliased live mutable DR state, and a nested DR handler mutated that state in place.**

Three facts combine:

1. **Capture-time aliasing** — `makeSnapshot()` in `src/sectors/deers-rock-adapter.ts` returned
   `hospitalState: w.state` **by reference** (not a copy). `createRewindPoint()` stores the
   `__snapshot()` result directly (`src/timeline/rewind-point.ts:78`). The rewind point's "t0"
   state therefore shared objects with the live DR world.

2. **In-place nested mutation** — `cssdHandler()` (`Deers-Rock/src/engine/cssd.ts`) does
   `const newTrays = [...cssd.trays]` (a **shallow** array copy) and then mutates the shared
   tray objects in place (`t.status`, `t.cycleId`, `t.sterilizedAt`, `t.expiresAt`).

3. **Restore-time aliasing** — `forkBranch()` (`src/timeline/branch.ts:169`) builds its snapshot
   from `rewindPoint.sectorStates` without cloning, and `doReconstruct()` assigned
   `state: snapshot.hospitalState` **by reference**. Each branch therefore mutated the rewind
   point's canonical state.

**Consequence:** once a parent ran (or once any branch ran), the rewind point's stored `_cssd.trays`
were mutated; every subsequently reconstructed branch inherited the mutated trays and diverged
from a fresh branch. This also made repeated forks from one rewind point non-reproducible.

### 2.1 Decisive evidence

**Snapshot diff** — deep-serialising `rp.sectorStates` before/after a 50-tick parent run showed
exactly **21 changed fields, all in `hospitalState._cssd.trays[i]`**:

```
_cssd.trays[i].sterilizedAt: 0        → 28200000
_cssd.trays[i].expiresAt:    100      → 566
_cssd.trays[i].cycleId:      null     → "CYCLE-26"
```

**Pre-clone experiment** (isolates capture-time aliasing):

| variant | result (occ / enc / pts) |
|---|---|
| `fresh-preclone` (clone before parent) | **0.8244 / 325 / 108** |
| `parent50-preclone` (clone before parent) | **0.8244 / 325 / 108** |
| `parent50-clone` (clone after parent) | 0.9084 / 335 / 119 |

Cloning the rewind state **before** the parent run fully restored isolation → the parent's effect
was entirely rewind-state mutation, not counters or global state.

**Non-reproducibility** (isolates restore-time aliasing): two consecutive branches from the *same*
rewind point gave `0.8244 → 0.9084` (the first branch mutated the rewind point).

### 2.2 Ruled out

- Module-global ID counters (22 counters): resetting them after the parent had **zero** trajectory effect.
- Clock RNG position: `createClock` is re-seeded identically; not the mechanism.
- `rngState` aliasing: `RNGState` is plain data and `tick()` returns a new object each tick.
- Agent / referral state re-initialisation: not the mechanism.

---

## 3. Repair

Two minimal, targeted changes at the snapshot/restore boundary in
`src/sectors/deers-rock-adapter.ts` (imports `deepClone` from `../engine/clone.js`):

1. **Capture-time (immutable canonical snapshot)** — `makeSnapshot()` now returns
   `hospitalState: deepClone(w.state)`, `lastTickState: deepClone(self.lastTickState)`,
   and `events: deepClone(events)`. A rewind point is now immune to later in-place mutation
   of the live world.

2. **Restore-time (fresh runtime instance)** — `doReconstruct()` now assigns
   `state: deepClone(snapshot.hospitalState)`. A branch never aliases (and thus never mutates)
   the rewind point's canonical state.

Both are required: (1) protects against the parent contaminating the rewind point; (2) guarantees
each fork gets an independent instance.

> The underlying DR trigger — in-place mutation of shared tray objects in `cssdHandler` — is noted
> as a latent immutability violation in the DR repository but is **not** modified here; the adapter
> snapshot boundary is the correct isolation fix and also protects against any other handler that
> mutates nested state in place.

---

## 4. Verification

### 4.1 Snapshot immutability (was the defect)

`exp-001e-snapshot-diff`: parent run mutated **21 → 0** fields. The rewind point is now immutable.

### 4.2 Variant matrix (fresh process per variant)

| variant | before fix | after fix |
|---|---|---|
| `fresh-clone` / `fresh-noclone` | 0.8244 | 0.8244 |
| `fresh-twice-noclone` | 0.8244 → 0.9084 | **0.8244 → 0.8244** |
| `parent50-clone` | 0.9084 | **0.8244** |
| `parent50-noclone` | 0.9084 | **0.8244** |
| `parent50-reset-clone` | 0.9084 | **0.8244** |
| `parent50-twice-clone` | 0.9084, 0.9084 | **0.8244, 0.8244** |

### 4.3 Multi-seed / multi-horizon isolation

`exp-001e-verification` — seeds `{1001..1005}` × horizons `{10, 25, 50}`, parent 50 ticks.
All 15 combinations: **isolation OK and reproducible OK** (`fresh == parent == parent2`).

### 4.4 Regression suite

- Live affected tests: `clone-aliasing-regression`, `deers-rock-adapter`, `rewind-point`,
  `world-engine` → **87 passed / 0 failed**.
- Full suite: 586 passed, 3 failed — all failures pre-existing and unrelated:
  `src/sectors/health-surveillance.test.ts > isolation` fails **identically with the adapter
  reverted to HEAD** (confirmed by stash), and `zenodo-package/**` copies fail to resolve
  `../../../Deers-Rock/dist/index.js` (frozen artefact).
- EXP-001D snapshot fix preserved: **7/7 checks pass**.
- New permanent regression test: `src/sectors/exp-001e-branch-isolation.test.ts` → **3/3 pass**.

---

## 5. Residual (documented, not a trajectory defect)

Module-global DR ID counters (e.g. `cssd.cycleCounter`) are not captured in the snapshot, so a
parented branch produces **different ID labels** (e.g. `cycleId: "CYCLE-26"` vs `"CYCLE-1"`) than
a fresh branch. This is cosmetic: it was verified across all 15 seed/horizon combinations that the
**trajectory** (occupancy, ICU, supply stress, encounters, patient count, CSSD tray status/expiry)
is identical. Resetting counters in `doReconstruct` is **unsafe** in general (ID collisions for
rewind points at tick > 0); a complete fix would require capturing counter values in the snapshot.

---

## 6. Scientific boundary

- The repair restores **branch isolation and reproducibility** of DR counterfactual trajectories.
- Deltas previously observed under the repaired instrumentation remain **observed signals**, not
  validated causal effects. No new causal claims are made.
- No Monte Carlo re-run, no production result regeneration, no frozen-evidence modification.

---

## 7. Artefacts

| artefact | path |
|---|---|
| Repair | `src/sectors/deers-rock-adapter.ts` |
| Regression test | `src/sectors/exp-001e-branch-isolation.test.ts` |
| Decisive test | `src/experiment/experiments/exp-001e-phase3-decisive.ts` |
| Clean variant matrix | `src/experiment/experiments/exp-001e-phase3-clean.ts` |
| Bisection | `src/experiment/experiments/exp-001e-phase3-bisect.ts` |
| Snapshot diff | `src/experiment/experiments/exp-001e-snapshot-diff.ts` |
| Multi-seed verification | `src/experiment/experiments/exp-001e-verification.ts` |
| Results | `experiment-results/exp-001e/*.json` |
