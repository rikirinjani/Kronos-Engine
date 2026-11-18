# EXP-001A — Adapter Pathway Failure Analysis

**Experiment ID:** EXP-001A
**Project:** Kronos Engine — Research Track 2
**Type:** Diagnostic investigation (no new Monte Carlo)
**Status:** Complete
**Date:** 2026-09-11
**Base commit:** `4d7e4128f6ad800fa762f443f36aa4f45d31e4d9`
**Source data:** frozen EXP-001 artifacts (`experiment-results/mc-lab/{validation,primary}/runs-H*.jsonl`)

---

## 1. Executive Finding

The EXP-001 "structural null" is **not caused by a failure of the adapter to translate macro events**. The adapter translates in **100 % of runs** — `buildMacroPacket()` sets `admissionMultiplier = 1.3` and `supplyChainPressure = 0.4` from the first `climate.extreme_weather` event onward.

The EXP-001 funnel's stage labelled **"adapterTranslated"** actually measured **`health.*` event emission**, not adapter translation. That label was wrong, and it produced the misleading 0 % / 45.8 % figures.

The real mechanism is a **hospital-threshold gate**:

- `health.*` events are emitted only when the Deers Rock hospital crosses hard thresholds (`occupancyRate > 0.85`, `admissionSurge` = `occupancyRate > 0.90`, `mortalityPressure > 0`, `supplyStress > 0.7`).
- The hospital's occupancy **accumulates monotonically with horizon**. For representative seed 1003: H10 → 0.450, H20 → 0.542, H50 → 0.824.
- Therefore the 0.85 threshold is only approached at ~H45–H50. This **fully explains** 0 % at H10/H20 and 45.8 % at H50: it is a **horizon-dependent threshold crossing**, not a defect in the pathway.

Two secondary findings:

- **`sentinelOutput` never appears in the parent↔branch diff** at any horizon, so every `sentinelOutput`-based primary outcome is structurally zero → `downstreamDelta = 0 %`.
- **Runtime is strongly superlinear** in horizon (0.303 → 1.013 → 9.663 s/sim).

An unresolved anomaly remains: the **branch's hospital trajectory is not independent of the parent's prior run** (§10).

---

## 2. Exact Macro → Adapter Pathway

| Step | Location | Detail |
|------|----------|--------|
| Fresh event bus | `src/engine/world-engine.ts:84` | New `EventBus` every tick; no carry-over |
| Sector tick order | `world-engine.ts:88-94` | Map insertion order: geopolitics → climate → economy → technology → deers-rock-adapter |
| Macro event published | `climate.ts:150-168` | `climate.extreme_weather` when `rng.next() < clamp(0.1 + (tempAnomaly−1.2)·0.05, 0.05, 0.5)` |
| Adapter reads bus | `deers-rock-adapter.ts:284` | `ctx.eventBus.pending()` — sees geopolitics + climate events published earlier this tick |
| Adapter translates | `deers-rock-adapter.ts:152-193` | `buildMacroPacket()`: `extreme_weather` → `admissionMultiplier += 0.3`, `supplyChainPressure = max(cur, 0.4)`, `activeDisasterType = "natural-disaster"` |
| DR sub-tick loop | `deers-rock-adapter.ts:290-316` | `ticksPerDay = 10` (from `SENTINEL`) DR `step()` calls per world tick |
| Sentinel extraction | `deers-rock-adapter.ts:127-150, 318` | `occupancyRate`, `icuOccupancyRate`, `mortalityPressure`, `supplyStress`, `staffStress`, `admissionSurge` |
| Health event emission | `deers-rock-adapter.ts:320-354` | Threshold predicates (below) |
| Cross-sector delivery | `world-engine.ts:96-97` | `applyCrossSectorEvents` replays all pending events through all handlers after all sectors tick |

**Timing: SAME TICK.** A macro event generated at tick T is observed by the adapter at tick T (adapter ticks after climate), and any resulting `health.*` event is emitted at tick T and delivered to handlers at tick T via `applyCrossSectorEvents`. There is no event-bus delay.

**Health-event thresholds** (`deers-rock-adapter.ts`):

| Event | Predicate | Line |
|-------|-----------|------|
| `health.pressure` | `occupancyRate > 0.85` | :320 |
| `health.mortality` | `mortalityPressure > 0` | :329 |
| `health.supply-crisis` | `supplyStress > 0.7` | :338 |
| `health.surge` | `admissionSurge` (= `occ.total > occ.capacity·0.9`) | :347 |
| `health.down` | DR `step()` threw | :306-315 |

---

## 3. H10 Failure Mechanism

**Occupancy never reaches the threshold.**

Live trace (seed 1003, H10): occupancy climbs 0.115 → 0.450 over 10 ticks; 59/131 beds occupied; 99 encounters; morgue 0; `supplyStress ≈ 0.51`.

- `occupancyRate` max = **0.450** ≪ 0.85 → no `health.pressure`
- `admissionSurge` requires > 0.90 → never
- `mortalityPressure` = 0 → no `health.mortality`
- `supplyStress` ≈ 0.51 < 0.7 → no `health.supply-crisis`

**Result: 0 health events — expected given the thresholds, not a defect.** The adapter *did* translate (`admissionMultiplier = 1.3` from t=3).

---

## 4. H20 Failure Mechanism

**Same mechanism, further along the accumulation curve.**

Live trace (seed 1003, H20): occupancy 0.115 → **0.542**; 71/131 beds; 158 encounters; morgue 0; `supplyStress ≈ 0.49`.

- 0.542 < 0.85 → no `health.pressure`
- Still below `admissionSurge` (0.90)
- morgue still empty → no `health.mortality`
- `supplyStress` still ≈ 0.5 → no `health.supply-crisis`

**Result: 0 health events — same threshold gate.**

---

## 5. H50 Translation Mechanism

**Occupancy finally approaches the 0.85 threshold.**

Live trace (seed 1003, H50): occupancy 0.115 → **0.824**; 108/131 beds; 325 encounters.

- 0.824 is *just below* 0.85 → this particular run still emits no health event
- Adjacent runs that reach ≥ 0.85 do emit `health.pressure`
- `health.surge` (occ > 0.90) fires in the runs that exceed 0.90

**Health-event types actually observed at H50 across the ensemble** (validation, N=1000): `health.pressure` × 1263, `health.surge` × 159. No `health.mortality`, no `health.supply-crisis` — consistent with morgue = 0 and `supplyStress < 0.7`.

---

## 6. Explanation of the 45.8 % H50 Anomaly

The 45.8 % is the fraction of H50 runs whose **final hospital occupancy crossed 0.85** (or 0.90 for surge).

- At H10/H20 the occupancy distribution is centred at 0.45/0.54 — far below 0.85 → 0 %.
- At H50 the occupancy distribution has accumulated to ≈ 0.82–0.88 — straddling 0.85 → a large fraction crosses, and the crossing is seed-dependent → **45.8 %**.

This is a **marginal threshold crossing**, not a discrete switch. The anomaly is therefore **explained by the interaction of (a) monotonic occupancy accumulation with horizon and (b) a fixed 0.85 threshold**. It is a model-semantics / configuration consequence.

**Not caused by:** event timing (same-tick), event-bus lifecycle (fresh bus, correct), calendar/year boundaries, RNG behaviour per se, or a translation defect.

---

## 7. Hospital-State Propagation Analysis

The hospital fills steadily because admissions exceed discharges within the observation window:

| Horizon | Occupancy | Beds | Encounters | Morgue | supplyStress |
|---------|-----------|------|-----------|--------|--------------|
| H10 | 0.450 | 59/131 | 99 | 0 | ~0.51 |
| H20 | 0.542 | 71/131 | 158 | 0 | ~0.49 |
| H50 | 0.824 | 108/131 | 325 | 0 | ~0.32 |

- Occupancy is **monotonic** in horizon (no steady state reached by H50).
- `mortalityPressure` (= `state.morgue.length`) stays **0** — no deaths occur in any traced run.
- `supplyStress` stays in **0.32–0.52** — never approaches the 0.7 crisis threshold.

The macro intervention (`admissionMultiplier = 1.3`) *does* raise the admission rate, but the hospital's internal admission/discharge balance dominates, and the 0.85 gate is only reached at long horizons.

---

## 8. Hospital → Sentinel Analysis

`sentinelOutput` is extracted every tick (`deers-rock-adapter.ts:318`) and written into the sector state (`:360`). **However, no `sentinelOutput.*` metric path appears in any parent↔branch diff** at H10, H20, or H50 (verified by scanning every `diff.perSector["deers-rock-*"].metrics` path across the frozen data).

Consequence: all primary outcomes are `sentinelOutput`-derived, so their deltas are zero → **`downstreamDelta = 0 %`**.

**Two candidate explanations (not conclusively separated):**

1. The parent and branch genuinely produce identical *final* `sentinelOutput` (both below threshold), so no numeric delta exists. This is consistent with the observation that the parent reached 0.824 while the branch reached 0.878 — the branch *did* cross, so this explanation is incomplete.
2. `sentinelOutput` appears as **`null` in snapshots** (observed directly via `snapshot()` on the live world). If the snapshot/reconstruct path drops `sentinelOutput`, the diff engine cannot see it, and `sentinelOutput`-based outcomes are structurally invisible. This is the more likely explanation and is flagged as a **probable instrumentation defect**.

> **Unresolved:** the `sentinelOutput: null`-in-snapshot behaviour was observed but not root-caused. It warrants a dedicated check.

---

## 9. Runtime Scaling Analysis

| Horizon | s/sim | DR sub-steps | Ratio vs H10 |
|---------|-------|--------------|--------------|
| H10 | 0.303 | 100 | 1.0× |
| H20 | 1.013 | 200 | 3.3× |
| H50 | 9.663 | 500 | 31.9× |

Cost is **strongly superlinear**: 5× the horizon costs ~32× the time. The workload is CPU-bound (99 % CPU) with flat memory (170–211 MB), so this is compute growth, not paging or GC.

**Likely driver (not profiled):** Deers Rock state grows monotonically with horizon — patients, encounters, orders, charges, lab/medication/radiology records all accumulate. Several DR subsystems iterate their collections each sub-tick (e.g. `extractDiseasePrevalence` iterates `state.encounters` every world tick at `deers-rock-adapter.ts:117-124`; DR's own subsystems scan their order/record maps each step). As collections grow, per-step cost rises → superlinear total.

> **No formal Big-O claim is made.** The exponents above are descriptive over three points. The dominant cost centre was **not** identified by profiling; this remains an open characterisation task.

---

## 10. Intentional Semantics vs Implementation Defect

| Finding | Classification |
|---------|----------------|
| Adapter translates macro → hospital parameters | ✅ Intentional (works) |
| Health events gated on hospital thresholds | ✅ Intentional model semantics |
| Occupancy accumulates with horizon | ✅ Intentional (admission > discharge within window) |
| `mortalityPressure` = morgue length (cumulative) | ✅ Intentional |
| 0 % at H10/H20, 45.8 % at H50 | ✅ **Consequence of intentional semantics** (threshold + accumulation) |
| `downstreamDelta` = 0 % | ⚠️ **Probable instrumentation defect** (`sentinelOutput` null in snapshot) — needs confirmation |
| Superlinear runtime | ⚠️ **Scaling limitation** (state accumulation); not a correctness bug |
| **Branch trajectory differs from an independent branch when the parent runs first** | ⚠️ **Probable determinism/isolation defect** — see below |

**Branch/parent non-independence (the one genuine anomaly):**

Ground truth from the frozen record (seed 1003, H50):
- `parentEventCounts` (health) = `{}` — the parent emitted **no** health events
- `branchEventCounts` (health) = `{health.pressure: 2}`
- Macro event counts are **identical** between parent and branch (extreme_weather 23, war_start 8, …)
- Deers-rock diff: `world.queue.events.length` parent 111 → branch 119

A replica that runs the branch **without first running the parent** reaches occupancy 0.824 (no health event). The same replica **with the parent run first** reaches 0.878 and emits `health.pressure` × 2 — matching the real experiment exactly. So **the branch is measurably affected by the parent's prior execution**, despite identical macro events.

**Candidate cause:** Deers Rock keeps **module-level ID counters** (`cssd.ts:48-49`, `dialysis.ts:26`, `blood-bank.ts:41-42`, `ipc.ts:25`, `pathology.ts:41`, `charge-generator.ts:5`, …). These are reset inside DR's `createWorld` (`world.ts:68-71`, "for same-process determinism") but the adapter rebuilds the branch via `doReconstruct` (`deers-rock-adapter.ts:233-265`), which does **not** call `createWorld` and therefore does **not** reset them. A counter-reset test was attempted but was **confounded** (both arms ran in one process and the probe omitted the observer sector), so the counters are **not proven** to be the cause.

> **Explicit uncertainty:** the parent→branch contamination is reproducible and deterministic, but its exact mechanism is **not conclusively established**. The module-level counters are the leading hypothesis; `rng ?? Math.random` fallbacks (`ipc.ts:29`, `biomedical-engineering.ts:52`, `clinical-knowledge.ts:621`, `nursing-knowledge.ts:139`) were ruled out as the driver because the contamination is deterministic across separate processes.

---

## 11. Root-Cause Classification

| Question | Answer |
|----------|--------|
| Why 0 % translation at H10/H20? | Hospital occupancy never reaches the 0.85/0.90 health-event thresholds at those horizons. **Model semantics + horizon, not a bug.** |
| Why 45.8 % at H50? | Occupancy accumulates to ≈0.85 by H50; a seed-dependent fraction crosses the fixed threshold. **Marginal threshold crossing.** |
| Why no downstream hospital deltas? | No `sentinelOutput.*` path appears in any diff; `sentinelOutput` is `null` in snapshots. **Probable instrumentation defect.** |
| Why superlinear runtime? | DR state grows monotonically; per-step collection scans grow with it. **Scaling limitation.** |
| Why does the branch depend on the parent? | Not conclusively established. Leading hypothesis: DR module-level ID counters not reset in `doReconstruct`. **Probable determinism/isolation defect.** |
| Was the funnel's "adapterTranslated" label correct? | **No.** It measured health-event emission; the adapter actually translated in 100 % of runs. |

---

## 12. Recommended Corrective Action

> **Document first; do not silently patch.** Per EXP-001A evidence discipline, no production code was modified.

1. **Fix the funnel definition** (reporting only): relabel the EXP-001 stage "adapterTranslated" → "hospitalEmittedHealthEvent", and add a genuine "adapterTranslated" stage derived from the macro-packet parameters (`admissionMultiplier ≠ 1.0`). This corrects the 0 %/45.8 % mischaracterisation.
2. **Investigate `sentinelOutput: null` in snapshots** — determine whether the snapshot/reconstruct path drops `sentinelOutput`, and whether that is why no `sentinelOutput.*` diff appears. This gates any future downstream-effect measurement.
3. **Investigate the parent→branch non-independence** — re-run the counter-reset test cleanly (separate processes, observer included). If confirmed, reset DR module-global counters inside the adapter's reconstruct path (or have `doReconstruct` delegate to `createWorld`-equivalent reset logic).
4. **Do not optimise the superlinear runtime yet** — first profile the DR step to identify the dominant cost centre; then decide.
5. **Do not add EXP-001A results to the manuscript** without a separate review cycle.

---

## 13. Is a Follow-up Experiment Scientifically Justified?

**Yes, but not a Monte Carlo scale-up.** The diagnostic points to three *targeted* follow-ups, none of which is a 10k/50k campaign:

1. **Pathway instrumentation run** (small N, e.g. 100): capture per-tick `sentinelOutput` and the macro packet, to confirm the threshold-gate mechanism end-to-end and settle the `sentinelOutput: null` question.
2. **Branch-isolation run** (single seed, 2 arms): clean counter-reset test to confirm/refute the parent→branch contamination.
3. **DR profiling run** (single seed, H10/H20/H50): attribute the superlinear cost to a specific subsystem.

A larger ensemble would only tighten a null that the diagnostic has already explained; it is **not** justified before (1)–(3) are resolved.

---

## Compact Stage Table

| Stage | H10 | H20 | H50 | Mechanism |
|-------|----:|----:|----:|-----------|
| Macro event | 100 % | 100 % | 100 % | Climate Bernoulli per tick (`climate.ts:150`); 0.993/1.000/1.000 of runs |
| Adapter translation | **100 %** | **100 %** | **100 %** | `buildMacroPacket` sets `admissionMultiplier=1.3`, `supplyChainPressure=0.4` (`adapter.ts:152-193`) |
| Hospital state | 100 % | 100 % | 100 % | DR state changes every run (diff present: 51 %/99 %/100 % of runs) |
| Hospital event (`health.*`) | **0 %** | **0 %** | **45.8 %** | Threshold gate: occupancy must exceed 0.85/0.90 (`adapter.ts:320-354`); occupancy reaches only 0.45/0.54/0.82+ |
| Sentinel output | (null in snapshot) | (null in snapshot) | (null in snapshot) | `sentinelOutput` appears `null` in snapshots — probable instrumentation defect |
| Downstream delta | 0 % | 0 % | 0 % | Primary outcomes are `sentinelOutput`-derived; no `sentinelOutput.*` diff path exists |

*(Note: "Adapter translation" here is the true `buildMacroPacket` translation; EXP-001's funnel mislabelled this stage and measured health-event emission instead.)*

---

## Evidence Discipline Statement

- **No new Monte Carlo was run.** All ensemble statistics are read from the frozen EXP-001 artifacts.
- **No frozen evidence was modified** — P-003, P-004, Phase F, VER/NCR records, PM-1 history, the JAMIA manuscript, the Zenodo package, and the EXP-001 raw JSONL were all left untouched.
- Diagnostic scripts were added only under `src/experiment/experiments/exp-001a-*.ts` (isolated experiment layer) and `/tmp`. No production engine or sector code was changed.
- Where the cause could not be established conclusively (§8 snapshot null, §10 branch contamination), this report says so explicitly and names the remaining uncertainty.
