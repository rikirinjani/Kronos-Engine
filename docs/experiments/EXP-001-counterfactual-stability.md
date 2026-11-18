# EXP-001 — Counterfactual Stability & Sensitivity Study

**Experiment ID:** EXP-001
**Project:** Kronos Engine — Research Track 2 (Post-v1.0)
**Status:** Exploratory — NOT part of P-003 / P-004 / Phase F
**Execution target:** Vultr CPU VPS (2 vCPU, 3.3 GB RAM)
**Budget Stage:** B (ceiling USD $0.25)
**Date:** 2026-09-10

---

## Final Verdict

> **EXP-001 COMPLETE — STRUCTURAL NULL**

The intervention produces a large, highly reproducible effect **inside the climate sector it directly targets**, but that effect **never propagates to any clinical/hospital outcome**. Across 10,000 paired worlds, the macro→micro pathway failed to translate at every horizon tested (0% at H=10 and H=20). The handful of FDR-significant metrics sit at or below the noise floor and are either direct climate-parameter effects or seed-dependent war bookkeeping artifacts.

---

## 1. Environment

| Property | Value |
|----------|-------|
| Host | Vultr CPU instance, hostname `Somnium` |
| CPU | AMD EPYC-Milan, 1 physical core / 2 vCPU (hyperthreading) |
| RAM | 3,392 MB total, 4,899 MB swap |
| Disk | 47 GB (NVMe/local SSD) |
| OS | Ubuntu 26.04, x86_64 |
| Node.js | v22.23.2 |
| TypeScript | 5.8.x |
| Git commit | `4d7e4128f6ad800fa762f443f36aa4f45d31e4d9` |
| Branch | `exp-001-counterfactual-stability` |
| Engine | Kronos Engine v1.0.0 (P-007 lineage unaffected) |

## 2. Baseline

| Check | Result |
|-------|--------|
| Build (`tsc`) | 0 errors |
| `stats.test.ts` | 32/32 pass |
| Determinism (same seed twice) | **Semantically identical** — only `createdAt`, `diff.capturedAt`, `runtimeMs` differ |
| Guards (`matchedHorizon`, `baselineIdentical`) | True on every run |

Determinism was verified by running identical seed ranges twice and deep-diffing the JSONL output: all simulation content (diff, guards, primaryOutcomes, observer event counts) is byte-identical. The only differences are wall-clock timestamps and the runtime measurement.

## 3. Experimental Design

- **Intervention (fixed):** `emissions_control` — `annualEmissionsNoise` 0.2 → 0.02, `co2Concentration` → 400.
- **Pairing:** each seed builds ONE baseline world; control and intervention branch from the identical pre-intervention state (rewind tick 0).
- **Seeds:** validation 1000–1999; primary 2000–11999. No overlap with manuscript seeds (42–71) or Phase F.
- **Horizons:** 10, 20, 50 ticks.
- **Isolation:** the EXP-001 observer sector is appended **last** in the sector list, so the RNG draw sequence for the five P-004 sectors is unchanged. No frozen artifact was modified.

> **Budget-driven scope note:** the full primary (N=10,000 × 3 horizons) is infeasible within Stage B because the H=50 cost is superlinear (see §8). The primary was therefore run at **H=10 and H=20** (N=10,000 each); H=50 was characterised at validation scale (N=1,000). This is a deliberate, documented budget gate, not a failure.

## 4. Resource Accounting

| Experiment | Wall Time | CPU Hours | Peak RSS | Output Size | Est. Cost |
|------------|-----------|-----------|----------|-------------|-----------|
| Validation N=1,000 H=10 | 307 s | 0.085 | 175 MB | 8.0 MB | $0.0026 |
| Validation N=1,000 H=20 | 1,020 s | 0.283 | 170 MB | 7.0 MB | $0.0085 |
| Validation N=1,000 H=50 | 9,663 s | 2.684 | 211 MB | 7.3 MB | $0.0805 |
| **Validation subtotal** | **10,991 s (3.05 h)** | **3.052** | 211 MB | 22.3 MB | **$0.0916** |
| Primary N=10,000 H=10 | 3,034 s (50.6 min) | 0.843 | ~175 MB | 75.9 MB | $0.0253 |
| Primary N=10,000 H=20 | 10,134 s (2.82 h) | 2.815 | ~180 MB | 65.8 MB | $0.0845 |
| **Primary subtotal** | **13,168 s (3.66 h)** | **3.658** | ~180 MB | 141.7 MB | **$0.1098** |
| **EXP-001 TOTAL** | **24,159 s (6.71 h)** | **6.710** | 211 MB | **164 MB** | **$0.201** |

- **Hourly rate assumed:** $0.03/hr (Vultr High Performance AMD 2 vCPU / 4 GB; actual rate not retrievable — no API key, metadata endpoint unavailable).
- **Cumulative Vultr spend (EXP-001 increment):** **≈ $0.201**
- **Stage B remaining:** ≈ $0.049
- **Dataset size:** 5 JSONL files, 164 MB total (3,000 validation + 20,000 primary paired runs).
- Memory stayed **flat** across all runs (170–211 MB). **Memory is not a constraint**; the workload is CPU-bound.

## 5. Statistical Results

### 5.1 Validation (N = 1,000)

| Horizon | Metrics | Tested | Degenerate | Degenerate Rate | Significant | FDR | Bonferroni | Expected FP (tested) |
|---------|---------|--------|-----------|-----------------|-------------|-----|-----------|----------------------|
| H=10 | 541 | 225 | 316 | 58.4% | 11 | 1 | 1 | 11.25 |
| H=20 | 1,248 | 194 | 1,054 | 84.5% | 15 | 2 | 2 | 9.70 |
| H=50 | 3,197 | 201 | 2,996 | 93.7% | 14 | 2 | 1 | 10.05 |

### 5.2 Primary (N = 10,000)

| Horizon | Metrics | Tested | Degenerate | Degenerate Rate | Significant | FDR | Bonferroni | Expected FP (tested) |
|---------|---------|--------|-----------|-----------------|-------------|-----|-----------|----------------------|
| H=10 | 2,672 | 236 | 2,436 | 91.2% | 29 | 13 | 5 | 11.80 |
| H=20 | 8,008 | 278 | 7,730 | 96.5% | 28 | 12 | 3 | 13.90 |

**Interpretation.** The FDR-significant count tracks the noise floor:
- H=10 primary: 13 FDR-significant vs **11.8 expected by chance** — marginally above.
- H=20 primary: 12 FDR-significant vs **13.9 expected by chance** — **below** the noise floor.

There is no robust, horizon-consistent intervention signal. The experiment does not reveal a stable counterfactual effect.

### 5.3 What *is* significant (and why it does not count)

The FDR-significant metrics are dominated by **direct climate-parameter effects** plus **artifacts**:

| Metric | q | Cohen's d | Nature |
|--------|---|-----------|--------|
| `firstEventTick.climate.extreme_weather` | 6.2e-89 | +1.78 | Direct: intervention delays first extreme weather |
| `extremeEvents.length` | 9.2e-11 | −0.34 | Direct: fewer extreme events |
| `eventCounts.climate.extreme_weather` | 9.2e-11 | −0.34 | Direct |
| `temperatureAnomaly` | 1.2e-05 | +0.05 | Direct climate state |
| `co2Concentration` | 1.8e-05 | +0.05 | Intervention parameter itself |
| `annualEmissions` | 2.0e-02 | +0.03 | Direct |
| `wars.W-*.startYear` (×7 at H=20) | ~2.5e-02 | ±400–960 | **Artifact**: seed-dependent war IDs, degenerate-scale d |

**No clinical or hospital outcome (`occupancy`, `cssd-cycles`, `dialysis-sessions`, any `deers-rock-*` sentinel metric) is significant at any horizon.**

The intervention demonstrably changes the climate sector — as it must, since it edits climate parameters — but that change does not reach the hospital.

## 6. Pathway Activation Funnel

The funnel traces the causal chain from macro event to observable downstream delta. Stages are **nested** (each requires the previous).

### Validation (N = 1,000)

| Stage | H=10 | H=20 | H=50 |
|-------|------|------|------|
| macroEventGenerated | 100.0% | 100.0% | 100.0% |
| adapterTranslated | **0.0%** | **0.0%** | **45.8%** |
| hospitalStateChanged | 0.0% | 0.0% | 45.8% |
| sentinelEmitted | 0.0% | 0.0% | **0.0%** |
| downstreamDelta | 0.0% | 0.0% | 0.0% |

### Primary (N = 10,000)

| Stage | H=10 | H=20 |
|-------|------|------|
| macroEventGenerated | 100.0% | 100.0% |
| adapterTranslated | **0.0%** | **0.0%** |
| hospitalStateChanged | 0.0% | 0.0% |
| sentinelEmitted | 0.0% | 0.0% |
| downstreamDelta | 0.0% | 0.0% |

### Transition rates

| Transition | H=10 | H=20 | H=50 |
|------------|------|------|------|
| macro → adapter | 0.0% | 0.0% | 45.8% |
| adapter → hospital state | — | — | 100.0% |
| hospital state → sentinel | — | — | **0.0%** |
| sentinel → downstream delta | — | — | — |

**This is the primary architectural diagnostic.** Macro events fire in every world, but the adapter almost never translates them into a health signal, and when it does (H=50), the signal still never reaches the sentinel output. The pathway is severed between the macro world and the hospital.

### Pathway activation frequency (branch events, H=20 primary)

| Event type | Fraction of runs |
|------------|------------------|
| `climate.extreme_weather` | 1.000 |
| `climate.temp_shift` | 1.000 |
| `economy.gdp_shift` | 1.000 |
| `economy.inflation_change` | 1.000 |
| `geopolitics.relation_shift` | 1.000 |
| `technology.innovation` | 1.000 |
| `geopolitics.war_start` | 0.889 |
| `geopolitics.war_casualties` | 0.871 |
| `geopolitics.war_end` | 0.465 |
| `technology.diffusion` | 0.002 |
| **`healthAny`** | **0.000** |

Macro sectors are highly active; the health sector is silent.

## 7. Degeneracy Analysis

| Horizon | Degenerate Rate (validation) | Degenerate Rate (primary) |
|---------|------------------------------|---------------------------|
| H=10 | 58.4% | 91.2% |
| H=20 | 84.5% | 96.5% |
| H=50 | 93.7% | — |

Two clear patterns:
1. **Degeneracy rises steeply with horizon.** Longer runs expose more seed-dependent bookkeeping paths (war IDs, event counts) whose per-seed deltas are constant or n<2, inflating the degenerate share.
2. **Degeneracy rises with ensemble size.** Larger N reveals more rare, seed-specific metric paths (e.g. `wars.W-*`) that are degenerate by construction.

**Practical consequence:** at H=20 / N=10,000, only **278 of 8,008 metrics (3.5%)** are testable. The effective observable surface of the model shrinks dramatically as the experiment scales — a finding in its own right.

## 8. Complexity & Scaling

### Cost per paired simulation

| Horizon | Validation (s/sim) | Primary (s/sim) |
|---------|--------------------|-----------------|
| H=10 | 0.307 | 0.303 |
| H=20 | 1.020 | 1.013 |
| H=50 | 9.663 | — |

### Empirical scaling

| Step | Horizon ratio | Cost ratio | Effective exponent |
|------|---------------|------------|--------------------|
| H=10 → H=20 | 2.0× | 3.3× | ~1.7 |
| H=20 → H=50 | 2.5× | 9.5× | ~2.5 |

Cost grows **superlinearly** with horizon. Cost per DR-step rises from ~3 ms (H=10) to ~4 ms (H=20) to ~18 ms (H=50). The process is **CPU-bound** (99% CPU) with flat memory (170–211 MB), so this is compute growth inside the simulation, not paging or GC.

> **No formal Big-O claim is made.** The exponent above is a descriptive fit over three points. Source inspection is needed to attribute the growth (candidate: accumulating per-tick encounter/event state inside the DR adapter); that investigation is out of scope for this experiment.

### Projected cost of the full primary

| Run | Wall Time | Est. Cost |
|-----|-----------|-----------|
| Primary N=10,000 H=10 | 0.84 h | $0.025 |
| Primary N=10,000 H=20 | 2.82 h | $0.085 |
| Primary N=10,000 H=50 | **26.8 h** | **$0.805** |
| **Full primary (3 horizons)** | **30.5 h** | **$0.915** |

The H=50 primary alone is **3.2× the entire Stage B ceiling**.

## 9. Findings

**Scaling wins**
- Memory is flat and small (≤211 MB) — the engine is memory-efficient even at N=10,000.
- Determinism is exact: identical seeds reproduce byte-identical semantic state and hashes.
- The observer-sector instrumentation is free: appending it last leaves the P-004 RNG stream untouched.

**Scaling failures**
- **Superlinear CPU cost in horizon** (~1.7–2.5 effective exponent). H=50 is 32× the cost of H=10 for 5× the horizon.
- **Effective observable surface collapses with scale**: 96.5% of metrics are degenerate at H=20/N=10,000.
- **Single-threaded execution**: no worker threads; parallelism requires process fan-out only.

**Architectural bottleneck (the headline)**
- The **macro→micro pathway is severed**. Macro events are ubiquitous (100%), health-adapter translation is 0% at H=10/H=20, and sentinel output never emits. The intervention's real climate effect does not reach the hospital.

**No CPU saturation, no serialization bottleneck, no GC pressure**
- Single-process CPU-bound; 2 vCPU allowed one validation + one primary run to proceed in parallel without mutual slowdown.

## 10. Recommendation

> **STOP — do not proceed to Stage C (N=50,000).**

Rationale:
1. The primary result is a **structural null**. Scaling to 50,000 would tighten the null, not overturn it, and the FDR-significant count already sits at the noise floor.
2. The **pathway is severed at the adapter** (0% translation at H=10/H=20). More samples cannot create a pathway that the model does not express.
3. The **H=50 cost is superlinear**; a 50k primary would cost ≈$4.6 (H=50 alone ≈$4.0), far beyond Stage B.

**Recommended next steps (in priority order):**
1. **Root-cause the pathway break** — investigate why `deers-rock-adapter` emits no `health.*` events at H≤20 despite 100% macro activity. This is a model/architecture question, not a sampling question.
2. **Root-cause the superlinear cost** — profile the DR adapter's per-tick state growth at increasing horizon.
3. **Only if (1) is resolved**, re-run a focused stability study at the horizon where translation first occurs (H≈50), at reduced N to fit Stage B.

## 11. Deliverables

```
docs/experiments/EXP-001-counterfactual-stability.md   (this report)
experiment-results/mc-lab/
  config.json          experiment configuration
  provenance.json      commit, node version, host, CPU, timestamps
  manifest.json        file inventory (names, bytes, line counts)
  resource.json        per-run wall time, CPU hours, peak RSS, cost
  validation/
    runs-H10.jsonl     N=1,000
    runs-H20.jsonl     N=1,000
    runs-H50.jsonl     N=1,000
    summary.json       statistical summary (per metric)
    diagnostics.json   funnel, pathway activation, degeneracy, trajectory classes
  primary/
    runs-H10.jsonl     N=10,000
    runs-H20.jsonl     N=10,000
    summary.json
    diagnostics.json
```

Raw per-seed deltas live in the `runs-H*.jsonl` files (one `Exp001Run` JSON object per line). Figure-ready data (Δ distributions, effect-size histograms, Stability Index ranking, funnel, horizon comparison, degeneracy-by-horizon) is derivable directly from `summary.json` and `diagnostics.json`.

## 12. Scientific Guardrails

- EXP-001 is **Research Track 2**. Its findings are **exploratory**.
- It **SHALL NOT** be cited as evidence supporting the JAMIA manuscript without a separate review cycle.
- No frozen artifact (P-003, P-004, Phase F, VER, NCR, PM-1, manuscript evidence, Zenodo package) was modified.
- The unexpected absence of a downstream effect is treated as a **hypothesis-generating finding** (pathway severance), not a manuscript amendment.
