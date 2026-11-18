# EXP-001B — Snapshot Integrity & Parent/Branch Isolation Validation

**Research Track 2 — Targeted diagnostic validation**
**Date:** 2026-09-11
**Seed:** 1003 | **Horizon:** 20 (Part A), 50 (Part B)
**Hard boundaries respected:** No Monte Carlo. No production changes. No manuscript changes. No frozen artifact modifications.

---

## 1. Objective

Resolve the two unresolved issues from EXP-001A:

1. **sentinelOutput appears as `null` in snapshots**, making downstream `sentinelOutput.*` outcomes potentially invisible to the diff engine.
2. **Parent→branch execution contaminates the branch trajectory**, with module-level DR counters as the leading but unproven hypothesis.

---

## 2. A — Snapshot / sentinelOutput Integrity

### 2.1 Pipeline Trace

The diagnostic traced `sentinelOutput` through every stage of the snapshot/diff pipeline:

| Stage | Location | sentinelOutput | Status |
|-------|----------|---------------|--------|
| 1. Initial state (tick 0) | `deers-rock-adapter.ts:272` | `null` | Expected |
| 2. After tick 1 (LIVE) | `deers-rock-adapter.ts:318,360` | `{"occupancyRate":0.115, ...}` | **Populated** |
| 3. After tick 1 (SNAP) | `snapshot()` → `deepClone()` → `__snapshot()` | `{}` | **EMPTY** |
| 4. Raw `__snapshot()` output | `makeSnapshot()` at line 215-231 | `null` | **LOST** |
| 5. `__reconstruct()` output | `doReconstruct()` at line 233-265 | `null` | **LOST** |
| 6. Parent snapshot (H=20) | `snapshot(parentAfterHorizon)` | `{}` | **EMPTY** |
| 7. Branch snapshot (H=20) | `snapshot(branchAfterHorizon)` | `{}` | **EMPTY** |
| 8. Diff engine sentinelOutput.* paths | `extractNumericPaths()` | **0 paths** | **Invisible** |

### 2.2 sentinelOutput Lifecycle (Detailed)

**Extraction** (`deers-rock-adapter.ts:127-150`): `extractSentinelOutput()` produces a fully populated `HospitalSentinelOutput` with 10 fields (tick, hospitalId, city, occupancyRate, icuOccupancyRate, mortalityPressure, diseasePrevalence, supplyStress, staffStress, admissionSurge). Called at line 318 inside the tick handler.

**Tick handler return** (`deers-rock-adapter.ts:356-362`):
```typescript
return {
  ...s,                    // ← copies __snapshot/__reconstruct closures from previous state
  world,
  lastTickState: world.state,
  sentinelOutput,          // ← new value attached to this returned object
  circuitBreakerTripped: circuitTripped,
};
```

**Snapshot call** (`world-engine.ts:115-126`): `snapshot(world)` iterates sectors and calls `deepClone(record.state)`.

**deepClone dispatch** (`clone.ts:30-36`): Detects `__snapshot`/`__reconstruct` on the object and calls them:
```typescript
const snapshot = snapshotFn.call(obj);    // calls __snapshot()
return reconstructFn.call(obj, snapshot); // calls __reconstruct()
```

**makeSnapshot** (`deers-rock-adapter.ts:215-231`): Reads `self.sentinelOutput` — but `self` is bound to the **initial state object** via the closure, not the current tick's returned object.

### 2.3 Root Cause: Stale Closure Capture

**The defect is in the tick handler's spread operator.** At `deers-rock-adapter.ts:356-362`:

```typescript
return {
  ...s,  // ← copies __snapshot and __reconstruct from `s`
  world,
  lastTickState: world.state,
  sentinelOutput,
  circuitBreakerTripped: circuitTripped,
};
```

The `...s` spread copies the `__snapshot` and `__reconstruct` **closure functions** from the previous state `s`. These closures capture `s` (or an even earlier state) in their lexical scope:

- `initialState.__snapshot()` captures `initialState` (line 274) — has `sentinelOutput: null`
- After reconstruction, `reconstructed.__snapshot()` captures `reconstructed` (line 261) — has restored `sentinelOutput`
- After the tick handler spreads `...s`, the new object's `__snapshot()` still captures the **previous** `s`, not the new object

When `snapshot()` → `deepClone()` → `__snapshot()` is called on the post-tick state, `makeSnapshot(self)` receives the **previous** state `s` as `self`. That previous state has `sentinelOutput: null` (at tick 0) or the previous tick's value — **never the current tick's freshly computed value**.

**Evidence chain:**
1. LIVE state after tick 1: `sentinelOutput` = `{"occupancyRate":0.115, ...}` ✅
2. `__snapshot()` called on post-tick-1 state → reads `self.sentinelOutput` from stale closure → `null` ❌
3. `__reconstruct()` receives null snapshot → returns null ❌
4. Diff engine sees `{}` on both sides → 0 sentinelOutput.* paths → 0% downstreamDelta ❌

### 2.4 Snapshot/Diff Finding

**sentinelOutput is GENUINELY LOST during snapshot serialization due to a stale closure capture bug.** The `__snapshot()` closure on the tick-handler's returned state object references the previous state, not the current one. This means:

- The diff engine **never sees** `sentinelOutput.*` paths in any comparison
- The 0% `downstreamDelta` in EXP-001 is a **structural invisibility bug**, not evidence of genuine absence of downstream effect
- The EXP-001 funnel's Stage 4 (`sentinelEmitted`) and Stage 5 (`downstreamDelta`) are **always false** regardless of actual hospital state changes

### 2.5 Impact on EXP-001

The EXP-001 report's conclusion that "the intervention produces zero downstream effect on hospital outcomes" is **not supported by the data as collected**. The diff engine cannot observe `sentinelOutput` differences because the snapshot pathway drops them. Any `sentinelOutput.*` differences between parent and branch are structurally invisible.

This does **not** mean downstream effects exist — it means they **cannot be measured** with the current snapshot/diff infrastructure.

---

## 3. B — Parent/Branch Isolation

### 3.1 Experiment Design

Four cases using seed=1003, H=50 (matching the contaminated EXP-001 conditions):

| Case | Description | Counter Reset |
|------|-------------|---------------|
| 1 | Fresh world, branch only (independent baseline) | N/A |
| 2 | Parent then branch (no counter reset) | No |
| 3 | Parent then explicit DR counter reset then branch | Yes (all 15 DR counters) |
| 4 | Parent then full `createWorld`-equivalent re-initialization | Yes (full fresh world) |

### 3.2 Four-Case Comparison Table

| Metric | Case 1 (baseline) | Case 2 (no reset) | Case 3 (reset) | Case 4 (full-reinit) |
|--------|-------------------|-------------------|----------------|----------------------|
| occupancyRate | **0.824** | 0.878 | 0.878 | **0.824** |
| icuOccupancyRate | **0.714** | 0.964 | 0.964 | **0.714** |
| mortalityPressure | 0 | 0 | 0 | 0 |
| supplyStress | 0.324 | 0.324 | 0.324 | 0.324 |
| staffStress | 1.000 | 1.000 | 1.000 | 1.000 |
| healthEvents | **0** | 2 | 2 | **0** |
| encounters | **325** | 339 | 339 | **325** |
| patients | **108** | 115 | 115 | **108** |

### 3.3 Key Observations

1. **Case 2 (no reset) differs from Case 1 (baseline):** Confirmed contamination. Parent execution alters branch trajectory: occupancy +6.5%, ICU +34%, encounters +4.3%, patients +6.5%, 2 extra health.pressure events.

2. **Case 3 (counter reset) matches Case 2 exactly:** Explicitly resetting all 15 DR module-global counters (`chargeCounter`, `patientCounter`, `nikCounter`, `agentCounter`, `unitCounter`, `txCounter`, `planCounter`, `fracCounter`, `conferenceIdCounter`, `orderCounter` ×2, `scenarioCounter`, `cycleCounter`, `trayCounter`, `sessionCounter`, `assessCounter`, `tubeCounter`, `tpnCounter`, `caseCounter`, `maintCounter`) **does NOT eliminate the divergence**. The branch trajectory remains identical to the no-reset case.

3. **Case 4 (full reinit) matches Case 1 exactly:** Only a complete `createWorld`-equivalent re-initialization (fresh sectors, fresh world, fresh DR world construction) eliminates the divergence. The branch trajectory is identical to the independent baseline.

### 3.4 Counter-Reset Result

**Counter reset does NOT eliminate the parent→branch divergence.**

The leading hypothesis (module-level DR ID counters as the contamination source) is **ruled out as the sufficient cause**. The counters may contribute to ID differences (different patient/encounter IDs), but they do not explain the trajectory divergence (different occupancy, different health events).

### 3.5 Causal Classification

**Classification: Counters contribute, but are NOT the complete explanation.**

The contamination mechanism requires full `createWorld`-equivalent re-initialization to eliminate, which resets:
- All module-global DR counters
- The DR World state (patients, beds, encounters, agents)
- The DR clock and RNG
- The event queue
- All sector states

This suggests the contamination enters through the **DR World state reconstruction** (`__reconstruct()` at `deers-rock-adapter.ts:233-265`), which rebuilds the World from snapshot data but inherits module-global state that `createWorld()` would reset. The most likely additional vectors are:

- **Module-global RNG state** in DR subsystems (though DR clock RNG is function-scoped)
- **Module-level mutable collections** that are not captured in the snapshot (e.g., any module-scoped `Map` or `Set`)
- **The stale closure bug** (Section 2.3) which means the reconstructed state may carry incorrect `sentinelOutput`/`lastTickState` from the parent's execution context

---

## 4. Summary Table

| Question | Finding | Confidence |
|----------|---------|------------|
| Is adapter translation real? | Yes — 100% of macro→adapter translation confirmed | High |
| Is `sentinelOutput` preserved in snapshots? | **NO** — lost via stale `__snapshot` closure capture | High |
| Can diff observe `sentinelOutput`? | **NO** — 0 sentinelOutput.* paths in diff metrics | High |
| Is downstreamDelta genuinely zero? | **UNKNOWN** — cannot be measured; structural invisibility bug | High |
| Does parent execution alter branch? | Yes — confirmed at seed 1003, H50 | High |
| Do counter resets eliminate divergence? | **NO** — counter reset has zero effect on trajectory | High |
| Are counters causal? | **NO** — counters ruled out as sufficient cause | High |

---

## 5. Implications for EXP-001

### 5.1 Snapshot Bug Impact

The stale closure bug means:

1. **All EXP-001 diff results for `sentinelOutput.*` are invalid.** The diff engine never observed sentinelOutput values because they are lost during snapshot.
2. **The EXP-001 funnel's downstreamDelta stage is always false**, regardless of actual hospital state changes.
3. **The EXP-001 conclusion** ("structural null — intervention affects climate sector only, never propagates to hospital outcomes") **is not supported by the data**. The data cannot answer this question in its current form.
4. **The EXP-001 report must not be cited as evidence of absence** of downstream effects. It is evidence of a measurement infrastructure defect.

### 5.2 Isolation Bug Impact

The parent→branch contamination:

1. **Does not affect EXP-001's climate-sector results** (the intervention is applied after the rewind point).
2. **Does affect hospital-state comparisons** between parent and branch, because the branch inherits contaminated DR state.
3. **Is NOT caused by module-global counters** — a deeper mechanism is at play, likely involving the `__reconstruct()` path and stale closure state.

### 5.3 What Must NOT Be Done

Per the hard boundaries:
- ❌ Do not modify the EXP-001 report or its raw data
- ❌ Do not patch the snapshot bug and rerun
- ❌ Do not incorporate these findings into the JAMIA manuscript without separate review
- ❌ Do not modify frozen P-003/P-004/Phase F/QMS records

---

## 6. What Remains Unresolved

1. **Exact contamination vector in `__reconstruct()`:** Why does full `createWorld`-equivalent reinit fix the divergence but counter resets do not? The additional vectors (beyond counters) need identification.

2. **Whether downstream effects actually exist:** The snapshot bug prevents measurement. A fixed snapshot pathway would be needed to determine whether the climate intervention produces any hospital-state change.

3. **Module-global state beyond counters:** What mutable module-global state in DR is NOT reset by counter resets but IS reset by `createWorld()`? This requires DR source audit.

4. **sentinelOutput after snapshot fix:** Once the closure bug is fixed, the EXP-001 diff should be rerun to determine whether sentinelOutput differences exist between parent and branch.

---

## 7. Recommended Next Action

1. **Fix the stale closure bug** in `deers-rock-adapter.ts` tick handler (lines 356-362): the returned state object must create fresh `__snapshot`/`__reconstruct` closures that capture `this` (the new state), not spread them from the previous state.

2. **Identify the remaining contamination vectors** beyond module-global counters by auditing DR `__reconstruct()` against `createWorld()` for any mutable state that is not captured in the snapshot.

3. **Rerun EXP-001 with the fixed snapshot** to determine whether `sentinelOutput` differences exist and whether `downstreamDelta` is genuinely zero.

---

## Appendix: Diagnostic Artifacts

- `src/experiment/experiments/exp-001b-snapshot-trace.ts` — Part A diagnostic script
- `src/experiment/experiments/exp-001b-isolation-test.ts` — Part B diagnostic script
- `experiment-results/exp-001b/snapshot-trace.json` — Part A raw results
- `experiment-results/exp-001b/isolation-test.json` — Part B raw results
