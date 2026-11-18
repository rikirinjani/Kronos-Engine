# PHASE F — CAUSAL INTEGRATION EXPERIMENT — FINAL REPORT

**Experiment ID:** PHASE-F-CAUSAL-2026-09-06
**Status:** EXECUTED per frozen design `docs/PHASE-F-DESIGN.md`. No design parameters modified after observing results.
**Classification: E — Null stochastic result** (with a documented partial causal propagation in 1/5 seeds; see §15–16).

---

## 1. Implementation Status

Complete. Minimum infrastructure only — one experiment script + one contract-test file. Zero changes to KE or DR source code, zero changes to Phase E behavior, zero changes to the DR scientific model.

**Critical execution-environment defect found and remediated before the valid run:** the KE adapter imports DR from `Deers-Rock/dist/`. The Windows DR dist was stale (built 2026-09-04 05:52, predating the Phase E coupling consumers committed to DR source 2026-09-05). The first (v1) run therefore executed against DR code **without** the `admission_surge`/`supply_chain_pressure`/`active_disaster` consumers and was **invalid**. v1 artifacts are quarantined at `experiment-results/phase-f/v1-invalid-stale-dist/`. DR dist was rebuilt from DR HEAD `5884ba3` (identical to the canonical Mac Mini dist, built 2026-09-05 08:32 from the same commit) before the v2 run reported here.

## 2. Exact Files Changed

| File | Change |
|---|---|
| `src/experiment/experiments/phase-f-intervention.ts` | NEW — v2 instrumented experiment (v1 replaced; v1 was never committed) |
| `src/experiment/experiments/phase-f-intervention.test.ts` | NEW — 9 contract tests (frozen params, paired execution, 5-link instrumentation, isolation, replay) |
| `experiment-results/phase-f/*` | NEW — results.json, statistical-summary.json, manifest.json, this report |
| `experiment-results/phase-f/v1-invalid-stale-dist/*` | QUARANTINED — v1 artifacts (stale dist) |
| `Deers-Rock/dist/*` | REBUILT (gitignored build output; source untouched at HEAD `5884ba3`) |

No other files touched. KE source tree: only the two new experiment files (uncommitted).

## 3. KE Commit

`4d7e4128f6ad800fa762f443f36aa4f45d31e4d9` (Phase E handoff; Phase F files uncommitted on top)

## 4. DR Commit

`5884ba39729768693bb91dfd796d8fe2e246ea68` (Phase E E1/E2 consumers; source untouched)

## 5. Execution Environment

- Host: DESKTOP-MICDILT (Windows, x64)
- Node v22.23.2, vitest 3.2.7 (KE) / 3.2.6 (DR), TypeScript 5.8
- KE worktree: `C:\Users\think\Project_v2\Kronos Engine`
- DR worktree: `C:\Users\think\Project_v2\Deers-Rock` (dist rebuilt 2026-09-06 15:04 from HEAD `5884ba3`)
- Runtime: 35.8 s for 5 seeds × 2 arms × 20 KE ticks + seed-42 replay pair

## 6. Frozen Experimental Parameters (as executed)

- Control arm: `climate.co2Concentration = 280`
- Intervention arm: `climate.co2Concentration = 800`
- Seeds: 42, 43, 44, 45, 46
- Horizon: 20 KE ticks (= 200 DR minutes per arm; sentinel `ticksPerDay: 10`)
- Primary outcomes: occupancyRate, icuOccupancyRate, mortalityPressure, supplyStress, admissionSurge
- Success criterion: direction consistency ≥ 80% (4/5 seeds)
- Execution: fresh-world paired counterfactual (two `createWorld` calls per seed; arms differ ONLY in `climate.co2Concentration`; no `forkBranch`)
- Initial conditions: era RP-CONTEMP-002 (COVID-19 baseline 2020), sentinel makassar-001 (133 beds, 50 patients) + isolation sentinels B/C (identical config), climate annualEmissions=37, noise=0.2

## 7. Per-Seed Results

| Seed | occ Δ | icu Δ | mort Δ | supply Δ | surge flip | Weather events (c / i) | First weather tick (c / i) |
|---|---|---|---|---|---|---|---|
| 42 | 0 | 0 | 0 | 0 | no | 5 / 5 | 8 / 8 |
| 43 | 0 | 0 | 0 | 0 | no | 11 / 11 | 4 / 4 |
| 44 | 0 | 0 | 0 | 0 | no | 6 / 6 | 6 / 6 |
| 45 | 0 | 0 | 0 | 0 | no | 6 / 6 | 6 / 6 |
| 46 | 0 | 0 | 0 | **+0.17** | no | 11 / 13 | 2 / 2 |

## 8. Causal Trace (per link, across seeds)

**Link 1 — Climate (CO₂ → trajectory): OPERATIONAL but saturated.**
Arms differ by exactly +520 ppm CO₂ at every tick (config applied correctly). However, a pre-existing KE feedback dominates: economy publishes `GDP_SHIFT` with absolute dollar deltas (~10¹¹), and the climate handler adds `gdpDelta × 0.00005` to annualEmissions. Emissions explode from 37 Gt to ~10⁸ Gt within 3 ticks; CO₂ reaches ~10⁸ ppm by tick 4 in BOTH arms. Temperature anomaly hits ~42–58 in both arms; eventChance saturates at the 0.5 clamp in both arms from tick ~4 onward. **The intervention differentiates the climate only during ticks 1–3** (control eventChance 0.05 vs intervention 0.268).

**Link 2 — Extreme weather: DIVERGED in 1/5 seeds.**
Seeds 42–45: identical event streams across arms (same ticks, types, severities) — the tick-1–3 differentiation window produced no arm-differentiating draw. Seed 46: intervention fired an extra event at tick 5 (a draw fell in [0.05, 0.268) during the differentiation window) → RNG draw-count desynchronization → divergent weather streams thereafter (11 vs 13 events; different types/severities from tick 5 on).

**Link 3 — Adapter (weather → DR events): OPERATIONAL, verified per event.**
Every EXTREME_WEATHER occurrence was translated by the adapter into the expected DR-facing events: `admission_surge` (multiplier 1.3–1.5), `supply_chain_pressure` (0.4–0.5), `active_disaster` (natural-disaster). Instrumented via queue wrapper: 45–135 macro-coupling events per arm per seed, all following weather occurrences. WAR_START-driven `staff_shortage` events also observed (seeds 43–46, geopolitics pathway).

**Link 4 — DR consumption: OPERATIONAL, verified per tick.**
DR `step()` consumed every translated event into state: `_admissionMultiplier` ∈ {1.2…1.5} (non-default whenever weather active), `_supplyChainPressure` ∈ {0.1…0.5}, `_activeMacroDisaster` = "natural-disaster", and `scenario.ts` activated the mapped **earthquake** scenario deterministically (severity 0.6) in every arm/seed where weather occurred — i.e., all 10 arms. Scenario remained active through tick 20 (duration 120 ticks > horizon).

**Link 5 — Observable: NULL in 4/5 seeds; supplyStress responded in 1/5.**
- occupancy/icu/mortality: zero deltas in all 5 seeds. Two structural causes: (a) the 1.3× admission multiplier is **mathematically inert** — `markov.ts` computes `baseAdmit = floor(rng×3)` ∈ {0,1,2}, then `floor(baseAdmit × 1.3)` = baseAdmit identically (integer quantization); (b) DR discharge delay is 4320–10080 ticks (3–7 days) vs 200 DR minutes of horizon → no discharges/deaths possible → mortality structurally 0 and occupancy moves only via admissions.
- supplyStress: seed 46 intervention +0.17 (0.323 → 0.492). Mechanism: divergent weather (Link 2) → different `supplyChainPressure` at the DR tick-150 restock cycle → different effective restock thresholds (`central-supply.ts`) → different inventory depletion → different `computeSupplyStress`. This is the documented E1/E2 pathway, fully traced.
- admissionSurge: no flips (occupancy never crossed 0.9 in either arm).

## 9. Primary Outcome Deltas

- occupancyRate: [0, 0, 0, 0, 0] — mean 0, median 0
- icuOccupancyRate: [0, 0, 0, 0, 0] — mean 0, median 0
- mortalityPressure: [0, 0, 0, 0, 0] — mean 0, median 0
- supplyStress: [0, 0, 0, 0, +0.17] — mean +0.034, median 0, stdDev 0.076
- admissionSurge flips: 0/5

## 10. Direction Consistency

- occupancyRate: 0/5 nonzero (0% — criterion not met)
- supplyStress: 1/5 nonzero, 1/1 positive (20% — criterion not met)
- **Primary success criterion (≥80% direction consistency): NOT MET.**

## 11. Isolation Results

- **Seeds 42–45 (weather streams identical):** ALL invariants hold — untargeted sentinels B/C byte-identical across arms, KE world RNG state identical, non-DR sectors identical except `climate` (the intervened sector itself).
- **Seed 46 (weather streams diverged):** B/C sentinels differ, RNG state differs, economy/geopolitics/technology differ. **This is NOT contamination** — it is the documented world-level causal pathway: EXTREME_WEATHER is a broadcast event; all sentinels receive it (each consuming it with its own isolated derived RNG), and economy/geopolitics are documented EXTREME_WEATHER subscribers (`events.ts` EVENT_SUBSCRIPTIONS) whose state legitimately responds. The RNG divergence is draw-count desynchronization caused by the intervention-arm's extra event draw — an inherent property of same-seed paired counterfactuals with stochastic event gates, not cross-sentinel contamination. No wall-clock dependency anywhere (all seeds deterministic; replay proves it).
- Verdict: isolation invariants **hold as designed**; the seed-46 differences are attributable, per-link-traced, downstream effects of the intervention.

## 12. Deterministic Replay Result

Seed-42 control+intervention pair re-run: **identical** — final world hashes, weather event traces, adapter event traces, and full sentinel-output trajectories all reproduce exactly. Reproducibility: **PASS**.

## 13. Statistical / Descriptive Analysis

Per frozen plan (5 replicates, descriptive only, no p-values):
- Event occurrence: 5/5 seeds produced weather in BOTH arms (39 control vs 41 intervention events total). The control arm is NOT event-free because of the GDP→emissions runaway (Link 1) — the intended "quiet control" does not exist under this KE configuration.
- supplyStress: mean +0.034, median 0, spread [0, +0.17], 1/5 positive — a single-seed stochastic divergence effect, not a reproducible dose-response.
- All other primary outcomes: exactly zero across all seeds.
- No metric tuning, no seed addition/removal, no horizon extension, no intervention adjustment performed or proposed.

## 14. Regression Results

- **KE:** 323/324 pass (`--sequence.concurrent=false`). 1 deterministic failure: `health-surveillance.test.ts > isolation: two sentinels get separate latest entries`. Root cause: pre-existing latent defect in the E3 test — sentinel-B reaches 0.817 occupancy, below the 0.85 `health.pressure` publish threshold (stochastic-margin test design flaw), exposed by the DR dist alignment (the Phase E "324/324" baseline was measured against the stale dist; the canonical Mac Mini KE at `6096b59` predates the E3 sector entirely, so this test never ran there). **Not caused by Phase F** — Phase F touched zero source files. Reported, not patched (fixing it is outside the frozen scope).
- **DR:** 127/127 pass (`--sequence.concurrent=false`). Full-suite parallel runs show a pre-existing cross-file test-pollution flake (different single test fails per run: finance, then medical-records; each passes in isolation). Source untouched at `5884ba3`.
- **TypeScript:** KE `tsc --noEmit` clean; DR `tsc --noEmit` clean.
- **Phase F tests:** 9/9 pass.

## 15. Interpretation Category

**E — Null stochastic result** (primary classification).

The complete pathway is operational (Links 1–4 verified per-event/per-tick in all 10 arms), but the frozen seeds/horizon produce no measurable effect on the primary outcomes in 4/5 seeds, and a single-seed stochastic divergence (seed 46) that does not meet the direction-consistency criterion.

Notably this is **not** C (adapter failure — Link 3 verified working) and **not** D (DR consumption failure — Link 4 verified working).

## 16. Final Causal-Path Classification

Per-link verdicts:
1. CO₂ → climate trajectory: **PARTIAL** — differentiates only ticks 1–3; GDP→emissions runaway saturates both arms (pre-existing KE defect, outside frozen scope)
2. Climate → EXTREME_WEATHER: **OPERATIONAL** — diverged in 1/5 seeds (seed 46, tick 5)
3. EXTREME_WEATHER → adapter → DR events: **OPERATIONAL** (verified per event, all arms)
4. DR events → DR state: **OPERATIONAL** (multiplier, supply pressure, disaster scenario all consumed; earthquake activated in all 10 arms)
5. DR state → observables: **NULL for occupancy/icu/mortality (structural), PARTIAL for supplyStress (1/5 seeds, +0.17, fully traced)**

**Overall: the architecture transmits the intervention to the sentinel's supply-stress observable only through a stochastic event-gate divergence; the occupancy/mortality pathway is structurally inert at this horizon (quantized admission multiplier; discharge delay ≫ horizon).**

## 17. Remaining Architectural Limitations (observed, not modified)

1. **GDP→emissions runaway** (KE, pre-existing): economy publishes absolute-dollar GDP deltas; climate converts at 0.00005 Gt/$ → emissions ~10⁸ Gt within 3 ticks → eventChance saturates at 0.5 in both arms. The intervention's differentiation window is only ticks 1–3. Any future experiment needing a quiet control arm must address this first (outside Phase F scope).
2. **Admission-multiplier quantization** (DR, pre-existing): `floor(floor(rng×3) × 1.3)` ≡ `floor(rng×3)` — the 1.3× surge multiplier cannot change admissions. Occupancy is therefore structurally insensitive to EXTREME_WEATHER at any horizon.
3. **Discharge-delay ≫ horizon** (DR, by design): 3–7 day discharges vs 200-minute horizon → mortality and occupancy-turnover observables are structurally zero-delta.
4. **Stochastic event-gate desynchronization**: same-seed paired counterfactuals diverge in RNG draw-count when the intervention changes event occurrence — producing single-seed effects (seed 46) that are real but not reproducible dose-response evidence.
5. **Stale-dist hazard** (process): KE imports DR from `dist/`; a stale dist silently voids coupling experiments. The v1 run was invalidated by this. Recommend a dist-freshness check before future cross-repo experiments.

## 18. Evidence / Artifact Locations

- Results (5 seeds × 2 arms, full per-tick causal trace): `experiment-results/phase-f/results.json`
- Statistical summary + isolation aggregate: `experiment-results/phase-f/statistical-summary.json`
- Evidence manifest (commits, runtime, hashes, frozen params): `experiment-results/phase-f/manifest.json`
- This report: `experiment-results/phase-f/report.md`
- v1 quarantined (stale dist, invalid): `experiment-results/phase-f/v1-invalid-stale-dist/`
- Experiment implementation: `src/experiment/experiments/phase-f-intervention.ts`
- Contract tests: `src/experiment/experiments/phase-f-intervention.test.ts`
- Frozen design: `docs/PHASE-F-DESIGN.md`

---

**STOP.** Per the execution order: no further experiments, no horizon extension, no CO₂ adjustment, no seed addition, no new arms, no pathway modification, no paper reconstruction. Phase F evidence awaits independent review and classification.
