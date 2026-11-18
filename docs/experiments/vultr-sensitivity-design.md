# Vultr Exploratory Sensitivity Study — Design (Phase 1)

**Created:** 2026-09-10
**Status:** DESIGN (pre-compute)
**Classification:** EXPLORATORY — NON-CANONICAL
**Boundary:** The canonical Phase F result (Mac, VER-2026-019) remains frozen. Nothing here modifies Phase F design, DR, KE experiment code, QMS records, PM-1 evidence, or the manuscripts.

---

## 0. Scientific Question

> Where does the macro intervention signal disappear between macro state, event generation, semantic adaptation, and downstream healthcare outcomes?

Phase F identified candidate bottlenecks: (1) stochastic extreme-weather event gate, (2) GDP→emissions runaway/saturation, (3) integer admission quantization, (4) discharge-delay/horizon mismatch, (5) supply-chain/restocking dynamics, (6) small admission multipliers, (7) event frequency vs downstream accumulation.

This study determines which existing parameters control propagation/attenuation. It does **not** attempt to make the model produce an effect.

---

## 1. Verified Implementation Facts (grounding)

All facts below were read directly from the implementation (KE commit `4d7e412`, DR commit `5884ba3`).

### 1.1 Event generation (KE `climate.ts`)
- One event draw per world tick: `if (rng.next() < eventChance)` → **at most one `EXTREME_WEATHER` per world tick**.
- `eventChance = clamp(0.1 + (temperatureAnomaly − 1.2) × 0.05, 0.05, 0.5)`.
- `annualEmissions` updated by: `+ gdpDelta × 0.00005` (per `GDP_SHIFT`), `+ warEmissions`, `+ noise`.
- `co2Concentration += emissionsToConcentration(annualEmissions)`.

### 1.2 GDP→emissions feedback (KE `economy.ts` → `climate.ts`)
- Economy publishes `GDP_SHIFT` with **absolute dollar** `gdpDelta` (`newGdp − n.gdp`), order ~10¹¹.
- Climate converts at `0.00005` → emissions inflate enormously → temperature anomaly rises → `eventChance` saturates at the 0.5 clamp.

### 1.3 Semantic adaptation (KE `deers-rock-adapter.ts` `buildMacroPacket`)
- `EXTREME_WEATHER`: `admissionMultiplier += 0.3`; `supplyChainPressure = max(·, 0.4)`; `activeDisasterType = "natural-disaster"`; `diagnosisWeightOverrides["J00-J99"] = 1.3`.
- `WAR_START`: `admissionMultiplier += 0.2`; `staffAvailabilityModifier = min(·, 0.85)`; `supplyChainPressure = max(·, 0.5)`; `diagnosisWeightOverrides["S00-T88"] = 1.5`.
- `WAR_CASUALTIES`: `supplyChainPressure = min(1, +0.1)`.
- `TEMP_SHIFT`: `diagnosisWeightOverrides["I00-I99"] = 1.15`.
- Events are scheduled into DR at `i === 0` of each world tick (once per world tick).

### 1.4 Admission quantization (DR `markov.ts`)
```
baseAdmit   = floor(rng() × 3)                     // {0,1,2}
scaledAdmit = floor(baseAdmit × _admissionMultiplier)
toAdmit     = min(availableBeds, max(1, scaledAdmit))
```
Because `max(1, ·)` is applied, `toAdmit ∈ {1,1,2}` at multiplier 1.3 (identical to baseline). The multiplier changes `toAdmit` only when:
- `baseAdmit = 2` and `m ≥ 1.5` (2×1.5 = 3), or
- `baseAdmit = 1` and `m ≥ 2.0` (1×2 = 2), or
- higher thresholds at larger `m`.

### 1.5 Discharge (DR `markov.ts`)
- `dischargeDelay = 4320 + floor(rng() × 5760)` DR ticks (4320–10080; 3–7 simulated days at 1 tick = 1 min).
- Phase F: `ticksPerDay = 10`, horizon 20 → **200 DR ticks** total. Discharge is structurally impossible within the horizon.

### 1.6 Existing tunable parameters (no new parameters introduced)
| Parameter | Where | Phase F value | Existing range/notes |
|---|---|---|---|
| `climate.co2Concentration` | climate config | 280 / 800 | any number |
| `climate.annualEmissions` | climate config | 37 | any ≥0 |
| `climate.annualEmissionsNoise` | climate config | 0.2 | any ≥0 |
| horizon (KE ticks) | runner loop | 20 | any ≥1 |
| `ticksPerDay` | sentinel config | 10 | default `TICKS_PER_WORLD_TICK` (1440) |
| sentinel `beds` / `patients` | sentinel config | 133 / 50 | any |
| `casualtyMultiplier` | geopolitics config | 1 | any |
| nation `gdp` / `gdpGrowthRate` | economy config | era values | any |

---

## 2. Independent Variables (Stage A — OFAT)

| ID | Factor | Levels | Bottleneck targeted |
|---|---|---|---|
| H | Horizon (KE ticks) | 20, 60, 200 | #4 discharge/horizon; #7 accumulation |
| T | `ticksPerDay` | 10, 100, 1440 | #4 effective observation window |
| C | Intervention CO₂ (control fixed 280) | 800, 2000, 5000 | #2 saturation window |
| E | `annualEmissionsNoise` | 0.2, 0.02, 0 | #2 GDP→emissions runaway |
| N | `annualEmissions` | 37, 3.7 | #2 saturation onset |
| M | multiplier boundary (structural + observed) | analytic | #1 quantization; #6 multiplier size |
| S | supply-chain / restock (structural trace) | analytic + observed | #5 restock dynamics |

Stage B (only if Stage A shows sensitivity): focused 2–3 factor interaction (e.g., T×H, C×E).
Stage C: identify configurations worth a future frozen canonical experiment.

---

## 3. Outcomes (per arm, per tick)

**Link 1 (macro):** `co2Concentration`, `temperatureAnomaly`, `eventChance`.
**Link 2 (event):** cumulative `EXTREME_WEATHER` count; per-tick occurrence; first-event tick.
**Link 3 (adapter):** count of `admission_surge` / `supply_chain_pressure` / `active_disaster` / `staff_shortage` events; the `admissionMultiplier` value delivered.
**Link 4 (DR state):** `_admissionMultiplier`, `_supplyChainPressure`, `_activeMacroDisaster`, active scenario.
**Link 5 (observable):** `occupancyRate`, `icuOccupancyRate`, `mortalityPressure`, `supplyStress`, `admissionSurge`, plus occupied-bed count and cumulative admissions where available.

**Signal-loss localization:** for each configuration, record the last link at which the intervention arms differ. This is the primary diagnostic.

---

## 4. Experimental Structure

- **Paired fresh-world execution** (control vs intervention), identical to Phase F semantics; arms differ only in the swept factor.
- **Seeds:** Stage A uses 8 seeds (42–49) per configuration — enough to distinguish structural from single-seed stochastic effects without thousands of replicates. A factor that is structurally inert (e.g., multiplier 1.3) needs few seeds; stochastic event-gate effects need more.
- **Stage A first**, then Stage B only around factors that show sensitivity. No full Cartesian product.
- All runs exercise the real pathway KE → event bus → adapter → DR → sentinel output. No bypass, no direct outcome injection.

---

## 5. Reproducibility Metadata (mandatory per run)

experiment ID; KE commit SHA; DR commit SHA; OS; Node version; CPU arch; Vultr instance type; seed; all non-default parameters; horizon; run timestamp; result hash; execution duration; `exploratory: true`.

---

## 6. Isolation

Paired fresh-world execution ⇒ each arm has independent state; no shared mutable simulation state; no cross-run RNG contamination; deterministic (seeded) — no wall-clock dependence. Parallelism (if used) must be process-level with separate output files; semantics must be identical to sequential execution (verified by re-running one config sequentially and comparing hashes).

---

## 7. Compute Budget Plan

Grounded in prior Stage A measurement on the same VPS (`docs/experiments/ke-monte-carlo-vultr-report.md`): sustained throughput ≈ **1.0 paired-sim/sec** (N=1000 = 16.7 min), single-threaded, memory ~0.5 GB, disk ~9 KB/run.

| Stage | Configs × seeds | Paired sims | Est. wall | Est. cost (@~$0.012/hr) |
|---|---|---|---|---|
| A (OFAT) | ~18 × 8 | 144 | ~2.5 min | <$0.01 |
| B (focused) | ~12 × 16 | 192 | ~3.5 min | <$0.01 |
| C (confirmation) | ~4 × 32 | 128 | ~2.5 min | <$0.01 |
| **Total** | | **~464** | **~9 min** | **<$0.01** |

Budget ceiling for this pass: **$5** (Stage A ceiling), far below the $300 credit. We will not spend the credit merely because it exists.

---

## 8. Classification (mandatory per finding)

STRUCTURAL · STOCHASTIC · PARAMETER-SENSITIVE · HORIZON-SENSITIVE · INTERACTION · UNKNOWN.

---

## 9. No-Go Conditions

Stop and diagnose if: Vultr execution changes simulation semantics; parallel execution introduces shared-state contamination; commits are not reproducible; results differ due to uncontrolled environment changes; an exploratory modification becomes necessary to obtain a response; or the study starts optimizing to produce an effect.

---

## 10. Deliverables

- `docs/experiments/vultr-sensitivity-design.md` (this file)
- `docs/experiments/vultr-sensitivity-report.md`
- `docs/experiments/vultr-sensitivity-results.json`
- ≤3 candidate follow-up canonical experiments (not frozen)
