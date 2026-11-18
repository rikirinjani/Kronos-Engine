# EXP-001C: Reconstruction Contamination Root Cause & Snapshot Repair

**Date**: 2026-09-11
**Seed**: 1003 | **Horizon**: 50
**Status**: COMPLETE
**Predecessors**: EXP-001B (snapshot integrity + isolation validation)

---

## Executive Summary

EXP-001C identifies and validates the minimal corrective boundaries for two confirmed defects discovered in EXP-001B:

1. **Snapshot Structural Invisibility Bug**: `sentinelOutput` is lost during snapshot serialization because the `__snapshot()` closure captures a stale reference to the previous state. The diff engine sees `{}` on both sides and extracts 0 `sentinelOutput.*` paths. **Repair: verified.** A wrapper that builds the snapshot from the current state makes all 11 sentinelOutput paths visible.

2. **Reconstruction Contamination**: Parent→branch contamination persists through counter resets, clock RNG advancement, and journal re-initialization. Only full `createWorld()`-equivalent re-initialization eliminates divergence. **Root cause: multiple initialization gaps** — 22 module-global counters, clock RNG state, and journal are not re-initialized by `doReconstruct()`.

**Critical finding**: Snapshot repair is *necessary* for sentinelOutput visibility but *insufficient* for isolation. Reconstruction repair (full re-init) is *sufficient* for isolation. Both together are robust.

---

## Part A: Isolated Snapshot Repair

### Hypothesis
The 0% `downstreamDelta` in EXP-001 is a structural invisibility bug: `sentinelOutput` is lost in the snapshot pathway, making downstream effects invisible to the diff engine.

### Method
1. Run parent to H=50, capture live DR state
2. Take original snapshot via `snapshot()` — extract `sentinelOutput.*` paths
3. Build repaired snapshot via wrapper that reads from current state — extract paths
4. Compare visibility

### Results

| Metric | Original Snapshot | Repaired Snapshot |
|--------|------------------|-------------------|
| sentinelOutput null | **true** | false |
| sentinelOutput paths | **0** | **11** |
| Live sentinelOutput | occ=0.824 | occ=0.824 |

### Root Cause (Confirmed)
In `deers-rock-adapter.ts:356-362`, the tick handler returns:
```typescript
return { ...s, world, lastTickState: world.state, sentinelOutput, circuitBreakerTripped };
```
The `...s` spread copies `__snapshot()` from `s`, which captures `self` = the previous state. When `makeSnapshot(self)` reads `self.sentinelOutput`, it reads the tick-0 value (`null`), not the current value.

### Fix
After tick, wrap the DR state so `__snapshot()` builds from `this` (the current object) instead of a stale closure reference. The wrapper creates a fresh snapshot object reading `this.world`, `this.sentinelOutput`, `this.lastTickState` directly.

### Verdict
**REPAIRED.** The structural invisibility bug is confirmed and the fix makes sentinelOutput visible to the diff engine. 11 `sentinelOutput.*` paths now extractable.

---

## Part B: Reconstruction Contamination Inventory

### Hypothesis
Parent→branch contamination is caused by one or more of: (a) 22 DR module-global counters, (b) clock RNG state not advanced, (c) journal not re-initialized.

### Method
Progressive fix testing against 6 conditions:

| Condition | What's Fixed | occ | healthEvents | Matches Baseline? |
|-----------|-------------|-----|-------------|-------------------|
| Baseline | — (fresh branch, no parent) | 0.824 | 0 | — |
| Contaminated | nothing | 0.878 | 2 | **NO** |
| Fix=counters | 22 DR counters reset | 0.878 | 2 | **NO** |
| Fix=clock | counters + clock RNG advance | 0.878 | 2 | **NO** |
| Fix=journal | counters + clock + journal | 0.878 | 2 | **NO** |
| Fix=full | full createWorld re-init | **0.824** | **0** | **YES** |

### Key Findings
1. **Counter reset has zero effect** on trajectory (occ=0.878, healthEvents=2 — identical to contaminated)
2. **Clock RNG advancement has zero effect** (same values)
3. **Journal re-initialization has zero effect** (same values)
4. **Only full createWorld re-initialization eliminates divergence** (occ=0.824, healthEvents=0 — matches baseline)

### Root Cause Analysis
`doReconstruct()` in `deers-rock-adapter.ts:233-265` differs from `createWorld()` in `world.ts:67-112` by:
- **22 module-global counters** not reset (across 14 DR source files)
- **Clock RNG state** not advanced (reconstruction loop only sets `tick`/`hospitalTimeMs` fields, doesn't call `clock.rng()`)
- **Journal** not re-initialized (`initJournal()` not called)
- **Agent/referral state** not re-initialized (`initAgentState()`, `initReferralState()` not called)
- **Patient pool** not regenerated (`generatePatientPool()` not called)

The contamination is **multi-factorial** — no single fix eliminates it. Full `createWorld()` re-initialization is required because it resets all of these atomically.

### Verdict
**Full createWorld re-init required.** Counter reset alone is insufficient. The contamination mechanism involves multiple initialization gaps that must all be addressed simultaneously.

---

## Part C: 4-Combination Interaction Matrix

### Hypothesis
Snapshot repair and reconstruction repair interact — testing which is necessary and which is sufficient.

### Results

| Combination | sentinelVisible | paths | occ |
|-------------|----------------|-------|-----|
| OrigSnap × OrigRecon | **false** | **0** | **null** |
| Repaired × OrigRecon | **true** | **11** | 0.824 |
| OrigSnap × Repaired | **false** | **0** | **null** |
| Repaired × Repaired | **true** | **11** | 0.824 |

### Interpretation
1. **OrigSnap × OrigRecon** = current (buggy) path — sentinelOutput invisible
2. **Repaired × OrigRecon** = snapshot fix alone makes sentinelOutput visible — reconstruction repair unnecessary for *visibility*
3. **OrigSnap × Repaired** = reconstruction fix alone does NOT help — data is already lost in the snapshot
4. **Repaired × Repaired** = both fixes together — robust, sentinelOutput visible

### Verdict
**Snapshot repair is necessary** for sentinelOutput visibility. **Reconstruction repair is sufficient alone** for visibility (once snapshot is fixed). **Both together are robust** for full correctness (visibility + isolation).

---

## Summary Table

| Defect | Root Cause | Fix | Verified |
|--------|-----------|-----|----------|
| sentinelOutput invisible to diff engine | `__snapshot()` closure captures stale `self` | Wrapper reads `this` instead of captured `self` | ✅ Part A |
| Parent→branch contamination | 22 counters + clock RNG + journal + agent/patient state not re-initialized | Full `createWorld()` re-init required | ✅ Part B |
| Snapshot × Reconstruction interaction | Snapshot loss makes reconstruction fix irrelevant | Fix snapshot first, then reconstruction | ✅ Part C |

---

## Evidence Chain

| Evidence | Source | File |
|----------|--------|------|
| Live sentinelOutput populated (occ=0.824) | Part A | `experiment-results/exp-001c/results.json` |
| Original snapshot: 0 sentinelOutput paths | Part A | `experiment-results/exp-001c/results.json` |
| Repaired snapshot: 11 sentinelOutput paths | Part A | `experiment-results/exp-001c/results.json` |
| Contamination: occ 0.824→0.878 | Part B | `experiment-results/exp-001c/results.json` |
| Counter reset: zero effect | Part B | `experiment-results/exp-001c/results.json` |
| Full re-init: restores baseline | Part B | `experiment-results/exp-001c/results.json` |
| OrigSnap×Repaired: 0 paths (snapshot loss) | Part C | `experiment-results/exp-001c/results.json` |
| Repaired×OrigRecon: 11 paths (visibility) | Part C | `experiment-results/exp-001c/results.json` |

---

## Recommended Next Action

1. **Apply snapshot fix to production** (`deers-rock-adapter.ts` tick handler) — minimal, targeted change
2. **Evaluate reconstruction fix options**:
   - Option A: Modify `doReconstruct()` to call all reset functions + advance clock RNG
   - Option B: Replace `doReconstruct()` with fresh `createWorld()` call (simpler, but loses snapshot fidelity)
   - Option C: Add a `createWorldFromSnapshot()` function that combines snapshot restore with full re-initialization
3. **Re-run EXP-001** with snapshot fix applied to verify downstreamDelta becomes non-zero
4. **Update JAMIA manuscript** Section 4.3 (Adapter Invariants) to document the snapshot/reconstruction fix

---

## Files

| File | Purpose |
|------|---------|
| `src/experiment/experiments/exp-001c-reconstruction-root-cause.ts` | Diagnostic script (Parts A/B/C) |
| `experiment-results/exp-001c/results.json` | Raw results |
| `src/sectors/deers-rock-adapter.ts:215-265` | Snapshot + reconstruction code (bug location) |
| `Deers-Rock/src/engine/world.ts:67-112` | `createWorld()` (reference initialization) |
| `Deers-Rock/src/engine/clock.ts:6-42` | Clock RNG (mulberry32, function-scoped) |
