# KE Monte Carlo / Counterfactual Laboratory — Resource Plan

**Created:** 2026-09-10
**Status:** Phase 0-2 complete, Phase 3 pending
**VPS:** Vultr CPU, Ubuntu 26.04, `45.32.122.6`

---

## Phase 0 — VPS Specification

| Property | Value |
|----------|-------|
| **Provider** | Vultr |
| **Plan** | CPU (High Performance) — *exact plan unknown, check Vultr dashboard* |
| **vCPU** | 2 (AMD EPYC-Milan, 1 core / 2 threads) |
| **CPU Freq** | 3,250 MHz |
| **RAM** | 3.3 GB |
| **Disk** | 47 GB (36 GB free) |
| **OS** | Ubuntu 26.04.1 LTS (Resolute Raccoon) |
| **Kernel** | 7.0.0-30-generic |
| **Node.js** | v22.23.2 |
| **npm** | 10.9.8 |
| **Git** | 2.53.0 |
| **IP** | 45.32.122.6 |
| **Hostname** | Somnium |
| **CPU Flags** | AVX, AVX2, FMA, SSE4.1, SSE4.2, SSE4a |
| **Hourly Cost** | *Unknown — check Vultr API* |
| **Credit Balance** | *Unknown — check Vultr API* |
| **Available Hours** | `CREDIT_BALANCE / COST_PER_HOUR` |

**Note:** Vultr metadata endpoint (169.254.169.254) not available. Pricing must be retrieved from the Vultr dashboard or API. The VPS appears to be a 2 vCPU High Performance instance (~$0.012/hr estimated).

---

## Phase 1 — Baseline Benchmark Results

**Date:** 2026-09-10T08:44:36Z
**Experiment:** `dr-counterfactual.ts` (Deers-Rock sentinel counterfactual)
**Horizon:** 20 ticks

| Seeds | Wall Time | Sims/sec | Per-sim | Memory |
|-------|-----------|----------|---------|--------|
| 1 | ~0.1s | 13.4 | 75ms | 484MB |
| 5 | ~0.1s | 66.8 | 15ms | 483MB |
| 10 | ~0.1s | 128.2 | 8ms | 483MB |
| 30 | ~0.1s | 373.6 | 3ms | 487MB |

**Key finding:** KE is extremely fast — **~370 sims/sec single-threaded** on this VPS. The simulation itself is lightweight; most time is Node.js startup overhead.

**Projections (single-threaded):**

| Simulations | Wall Time | CPU-hours | Est. Cost (@$0.012/hr) |
|-------------|-----------|-----------|-------------------------|
| 100 | <1s | <0.001 | $0.00 |
| 1,000 | ~3s | 0.002 | $0.00 |
| 10,000 | ~27s | 0.015 | $0.00 |
| 50,000 | ~2.2min | 0.07 | $0.001 |
| 100,000 | ~4.4min | 0.15 | $0.002 |
| 500,000 | ~22min | 0.74 | $0.009 |
| 1,000,000 | ~44min | 1.48 | $0.018 |

**Conclusion:** Even 500K simulations would cost less than $0.01 at estimated pricing. This VPS is massively over-provisioned for KE Monte Carlo work.

---

## Phase 2 — Parallel Scaling Results

| Config | Wall(s) | Sims/s | Scaling Eff |
|--------|---------|--------|-------------|
| 1-worker | 0.1 | 393.9 | 100% |
| 2-workers | 0.1 | 330.1 | 195% |

**Finding:** Timing too coarse (100ms resolution) to measure parallel scaling accurately. Both configurations complete in ~0.1s. KE is single-threaded; parallelization is via child process fan-out.

**Recommendation:** Parallel scaling is unnecessary at current throughput levels. A single worker can execute 500K sims in ~22 minutes. Use parallelization only if:
- Wall-clock time becomes a bottleneck (not currently)
- Multiple independent experiments need to run simultaneously

---

## Resource Budget Table

| Experiment | Replicates | Workers | Est. Runtime | Est. CPU-hrs | Est. Cost | Output Size | Status | Escalation Condition |
|------------|-----------|---------|-------------|-------------|-----------|-------------|--------|---------------------|
| **Phase 0:** VPS Setup | — | — | ~5min | — | — | — | ✅ DONE | — |
| **Phase 1:** Baseline 30-seed | 30 | 1 | ~0.1s | <0.001 | $0.00 | ~1KB | ✅ DONE | — |
| **Phase 2:** Parallel scaling | 30 | 1-2 | ~0.2s | <0.001 | $0.00 | ~2KB | ✅ DONE | — |
| **Stage A:** 100-sim validation | 100 | 1 | ~1s | <0.001 | $0.00 | ~10KB | ⬜ PENDING | ≤$5 budget |
| **Stage B:** 1k paired MC | 1,000 | 1 | ~6s | 0.003 | $0.00 | ~100KB | ⬜ PENDING | ≤$20 budget |
| **Stage B:** 10k paired MC | 10,000 | 1 | ~54s | 0.03 | $0.00 | ~1MB | ⬜ PENDING | ≤$20 budget |
| **Stage C:** 50k MC | 50,000 | 1 | ~4.4min | 0.15 | $0.002 | ~5MB | ⬜ PENDING | ≤$50 budget |
| **Stage C:** 100k MC | 100,000 | 1 | ~8.8min | 0.29 | $0.003 | ~10MB | ⬜ PENDING | ≤$50 budget |
| **Stage D:** 500k MC | 500,000 | 1 | ~44min | 1.48 | $0.018 | ~50MB | ⬜ PENDING | Requires human approval |
| **Stage D:** 1M MC | 1,000,000 | 1 | ~88min | 2.96 | $0.036 | ~100MB | ⬜ PENDING | Requires human approval |
| **Parameter sensitivity** | TBD | 1 | TBD | TBD | TBD | TBD | ⬜ PENDING | Stage B complete |
| **Pathway ablation** | TBD | 1 | TBD | TBD | TBD | TBD | ⬜ PENDING | Design only |

**Cost model:** Vultr charges fixed instance rate (not per-CPU-hour). The VPS costs ~$0.012/hr regardless of CPU utilization. CPU-hours listed are for reference only — actual cost is wall-clock time × hourly rate.

---

## Budget Policy

| Stage | Ceiling | Scope | Status |
|-------|---------|-------|--------|
| **A** | ≤$5 | Benchmark / resource characterization | ✅ COMPLETE |
| **B** | ≤$20 | 1k–10k Monte Carlo validation | ⬜ NEXT |
| **C** | ≤$50 | Expanded Monte Carlo / parameter sensitivity | ⬜ PENDING |
| **D** | Remaining budget | Requires explicit human approval | ⬜ PENDING |

**Current spend:** $0.00 (only benchmark runs executed)
**Remaining credit:** Unknown — check Vultr dashboard

---

## Escalation Report Template

At every escalation point:

```
spent_so_far:      $X.XX
remaining_credit:  $X.XX
projected_cost:    $X.XX
projected_runtime: Xmin
scientific_question: "What question does this experiment answer?"
```

**STOP if projected cost exceeds current stage budget.**

---

## Blockers

1. **Vultr pricing unknown** — need API key or dashboard access to confirm hourly rate and credit balance
2. **Zenodo upload blocked** — server down, cannot publish artifact (independent of this work)

---

## Next Steps

1. **Phase 3:** Design branching experiment architecture
2. **Phase 4:** Run 1k paired Monte Carlo simulations
3. **Phase 5:** Parameter sensitivity (if Phase 4 is informative)
4. **Phase 6:** Design pathway ablation (design only)

---

## Reproducibility Record

| Property | Value |
|----------|-------|
| Git commit | `4d7e412` (KE repo on VPS) |
| Experiment config | `dr-counterfactual.ts`, horizon=20, seeds=42-71 |
| Node.js | v22.23.2 |
| Platform | linux x64 |
| VPS | AMD EPYC-Milan, 2 vCPU, 3.3GB RAM, Ubuntu 26.04 |
| Benchmark script | `benchmark-phase1.mjs`, `benchmark-phase2.mjs` |
| Results | `experiment-results/mc-benchmark/phase1-benchmark.json`, `phase2-scaling.json` |
