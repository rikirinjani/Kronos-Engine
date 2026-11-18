# Vultr Exploratory Sensitivity Study — Report

**Study ID:** VULTR-SENSITIVITY-2026-09-10
**Date:** 2026-09-10
**Status:** EXPLORATORY — NON-CANONICAL
**Boundary:** The canonical Phase F result (Mac, VER-2026-019) remains frozen. Nothing here modifies or supersedes Phase F design, DR, KE experiment code, QMS records, PM-1 evidence, or the manuscripts.

---

## 1. Executive Summary

Using the Vultr VPS as an exploratory resource, we probed where the macro intervention signal attenuates between macro state, event generation, semantic adaptation, and downstream healthcare outcomes. Twelve exploratory configurations (8–1 seeds each) were run through the real KE → event bus → sentinel adapter → DR → sentinel-output pathway.

**Primary finding — the intervention's effective window is 3 of 20 ticks.** A per-tick trace shows the two CO₂ arms (280 vs 800 ppm) differ only during **ticks 1–3**. At **tick 4**, a GDP→emissions feedback drives both arms to CO₂ ≈ 4.7×10⁶ ppm and pins `eventChance` at its 0.5 clamp; from tick 4 onward every traced field (CO₂, anomaly, eventChance, weather count, adapter multiplier, occupancy, supplyStress) is **identical** between arms. The intervention is therefore exposed to the event gate for only ~15% of the nominal horizon.

**Secondary findings:**
- The GDP→emissions runaway is **not** controlled by the initial `annualEmissions` (37 → 3.7 changes nothing) nor by emissions noise (0.2 → 0.02 → 0 does nothing). Only slowing GDP growth (2.5 → 0.1) reduces final CO₂ (by ~1 order of magnitude) — yet still saturates by tick 20.
- The adapter can only produce admission multipliers **{1.0, 1.2, 1.3, 1.5}**. Because `toAdmit = max(1, floor(baseAdmit × m))` with `baseAdmit ∈ {0,1,2}`, multipliers in **[1.0, 1.5) are fully inert**; 1.5 changes admissions only when `baseAdmit = 2` (≈1/3 of ticks). Observed multipliers never exceeded 1.5.
- Increasing the CO₂ intervention (800 → 2000 → 5000) increases the *frequency* of arm-divergent event streams (3/8 → 7/8 → 7/8 seeds) but the downstream effect **direction is sign-unstable** (both positive and negative supplyStress deltas) — not a dose-response.
- supplyStress is the only downstream observable that responded to the weather-gate pathway; occupancy/ICU movements observed in some seeds are RNG-cascade effects of event-stream divergence, not quantized-admission effects.
- Discharge-delay/horizon probing was **computationally infeasible** at scale in this pass (superlinear DR cost); a structural analysis is provided instead.
- Isolation held as designed: untargeted sentinels B/C were identical across arms whenever the broadcast event stream was identical, and differed only when the world-level event stream diverged (the documented broadcast pathway).

**Verdict:** EXPLORATORY FINDINGS READY — CANDIDATE EXPERIMENTS IDENTIFIED.

---

## 2. Scientific Question

> Where does the macro intervention signal disappear between macro state, event generation, semantic adaptation, and downstream healthcare outcomes?

Candidate bottlenecks (from Phase F): (1) stochastic extreme-weather event gate, (2) GDP→emissions runaway/saturation, (3) integer admission quantization, (4) discharge-delay/horizon mismatch, (5) supply-chain/restocking dynamics, (6) small admission multipliers, (7) event frequency vs downstream accumulation.

---

## 3. Compute Environment

| Property | Value |
|---|---|
| Provider / instance | Vultr VPS `45.32.122.6` (hostname `Somnium`) |
| OS | Ubuntu 26.04, kernel 7.0.0-30-generic |
| CPU | AMD EPYC-Milan, 2 vCPU (1 physical core) |
| RAM / disk | 3.3 GB / 47 GB |
| Node | v22.23.2 |
| Execution | sequential, single-threaded (KE engine is single-threaded) |
| Concurrency note | An unrelated orphaned `exp-001-stability.js` process was running concurrently; it does not affect determinism (separate process/output), only wall-clock timing. |

---

## 4. Exact Commits

| Repo | Commit |
|---|---|
| Kronos Engine | `4d7e4128f6ad800fa762f443f36aa4f45d31e4d9` |
| Deers-Rock | `5884ba39729768693bb91dfd796d8fe2e246ea68` |

Exploratory runner: `src/experiment/experiments/vultr-sensitivity.ts` (new file; does not modify any frozen experiment or DR source). Harness matched Phase F exactly (3 sentinels; arms differ only in the swept factor).

**Harness validation:** the runner reproduces Phase F's seed-46 structure (control weather=11, intervention weather=13; seed-46 supplyStress Δ = **+0.17**). Note: the Linux VPS reproduces the **Windows** Phase F value (+0.17), not the **Mac canonical** value (+0.219). The quantitative value is platform-sensitive; only the qualitative structure reproduces. This is a non-canonical platform observation and does not alter the Mac canonical evidence.

---

## 5. Experimental Design

Fresh-world paired execution (identical to Phase F semantics). Stage A one-factor-at-a-time screening; 8 seeds (42–49) for cheap configs, fewer for expensive ones. Independent variables (all existing parameters, no new parameters introduced):

| Config | Horizon | ticksPerDay | CO₂ (c/i) | annualEmissions | noise | gdpGrowth | seeds |
|---|---|---|---|---|---|---|---|
| A0_base | 20 | 10 | 280/800 | 37 | 0.2 | 2.5 | 8 |
| A1_H60 | 60 | 10 | 280/800 | 37 | 0.2 | 2.5 | 8 |
| A6_C2000 | 20 | 10 | 280/2000 | 37 | 0.2 | 2.5 | 8 |
| A7_C5000 | 20 | 10 | 280/5000 | 37 | 0.2 | 2.5 | 8 |
| A8_noise002 | 20 | 10 | 280/800 | 37 | 0.02 | 2.5 | 8 |
| A9_noise0 | 20 | 10 | 280/800 | 37 | 0 | 2.5 | 8 |
| A10_emiss3p7 | 20 | 10 | 280/800 | 3.7 | 0.2 | 2.5 | 8 |
| A11_gdp0p1 | 20 | 10 | 280/800 | 37 | 0.2 | 0.1 | 8 |
| TRACE_base | 20 | 10 | 280/800 | 37 | 0.2 | 2.5 | 1 (full trace) |
| TRACE_H60 | 60 | 10 | 280/800 | 37 | 0.2 | 2.5 | 1 (full trace) |
| A4_T100 | 20 | 100 | 280/800 | 37 | 0.2 | 2.5 | aborted (too slow) |
| A5_T250 | 20 | 250 | 280/800 | 37 | 0.2 | 2.5 | not run (too slow) |

Outcomes captured per arm per tick: CO₂, temperature anomaly, eventChance, cumulative extreme-weather count, adapter event count, delivered `admissionMultiplier`, supply-chain pressure, active scenario, occupancy, ICU, mortality, supplyStress.

---

## 6. Compute / Cost Accounting

| Metric | Value |
|---|---|
| Configs completed | 12 (incl. pilot + validation + 2 trace runs) |
| Measured run time | 694.9 s (≈11.6 min) |
| Est. instance cost (@~$0.012/hr) | ≈ **$0.002** |
| Budget ceiling for this pass | $5 (Stage A) |
| $300 credit consumed | <0.01% |

Cost was not a constraint. Wall-clock cost of long-horizon runs was, however, a real constraint (see §8).

---

## 7. Admission-Quantization Findings (Question 1)

**Structural (proof from `markov.ts`):**
```
baseAdmit   = floor(rng() × 3) ∈ {0,1,2}
scaledAdmit = floor(baseAdmit × m)
toAdmit     = min(availableBeds, max(1, scaledAdmit))
```
- `m ∈ [1.0, 1.5)`: `toAdmit = {1,1,2}` — **identical to baseline**. Fully inert.
- `m ∈ [1.5, 2.0)`: `baseAdmit=2 → 3` ⇒ `toAdmit = {1,1,3}`. Changes admissions only when `baseAdmit=2` (P≈1/3 of ticks).
- `m ∈ [2.0, 2.5)`: `{1,2,4}`.

**Observed multipliers (empirical):** across all configs, the only delivered multipliers were **1.2** (WAR_START), **1.3** (EXTREME_WEATHER), and **1.5** (EXTREME_WEATHER + WAR_START coincident in the same tick). No value >1.5 was ever observed.

**Event-gate constraint (structural):** the climate sector draws **at most one** `EXTREME_WEATHER` per world tick, and pending events are consumed one tick later — so two weather events cannot coincide. The only route to a multiplier >1.3 is weather+war coincidence → 1.5.

**Conclusion:** Within the existing model, the admission pathway is **structurally inert except for the rare 1.5 case, and even then only on ~1/3 of ticks**. Increasing event frequency does not raise the multiplier beyond 1.5; it only changes how often 1.5 occurs.
*Classification:* STRUCTURAL (quantization) + INTERACTION (weather+war coincidence).

---

## 8. Horizon / Discharge Findings (Question 2)

**Empirical status: INFEASIBLE in this pass.** Configurations that push the DR clock toward the discharge delay (4320–10080 DR ticks) — `ticksPerDay=100` (effective window 2000) and `ticksPerDay=250` (5000) — exhibited severe superlinear cost: a single paired simulation at T=100 did not complete within 12 minutes. The likely cause is that each admission schedules a `discharge` event at +4320…+10080 that never fires within the horizon, so the DR event queue grows linearly with admissions, making per-tick work grow superlinearly. (A0_base at 200 DR ticks = 3.3 s/pair; A1_H60 at 600 DR ticks = 54 s/pair.)

**Structural finding (from traces):** occupancy accumulates monotonically because discharge never triggers:
- TRACE_base (H=20, 200 DR ticks): occupancy 0.115 → 0.534.
- TRACE_H60 (H=60, 600 DR ticks): occupancy 0.115 → 0.893.
With `ticksPerDay=10`, the DR clock must exceed 4320 to enable any discharge — i.e. horizon > 432 ticks. At Phase F's horizon (20) the discharge pathway is **structurally closed**.

**Conclusion:** the Phase F horizon is far too short to expose occupancy turnover; whether occupancy would *diverge* once discharge opens cannot be answered without a computationally optimized runner (candidate experiment #2).
*Classification:* STRUCTURAL (discharge window closed at Phase F horizon) + HORIZON-SENSITIVE (unresolved).

---

## 9. Event-Frequency Findings (Question 3)

Separating the three stages:

| Stage | Behaviour | Classification |
|---|---|---|
| Event generation | ≤1 weather draw/world tick; probability = clamp(0.1+(anomaly−1.2)×0.05, 0.05, 0.5); saturated to 0.5 from tick 4 in both arms | STRUCTURAL |
| Event translation | Adapter maps every weather event → `admission_surge` (×1.3) + `supply_chain_pressure` (0.4) + `active_disaster`; operational per event | STRUCTURAL / ARCHITECTURAL |
| Downstream accumulation | Responds only when the event *stream* diverges (ticks 1–3 window); direction sign-unstable | STOCHASTIC |

Increasing CO₂ leverage (A6=2000, A7=5000) raised the fraction of seeds with arm-divergent weather streams from 3/8 (A0) to 7/8, but did **not** produce consistent downstream direction: A7 supplyStress deltas were {43:+0.001, 44:−0.187, 46:+0.169, 48:−0.186}. This is a stochastic event-gate effect, not a dose-response.

---

## 10. Supply-Chain Findings (Question 4)

- `supplyStress` was the only downstream observable that responded to the weather-gate pathway (seed 46 Δ = +0.17 at baseline; consistent with the Phase F E1/E2 pathway).
- The mechanism is: weather event → adapter `supply_chain_pressure` (0.4–0.5) → DR restock threshold → inventory depletion → `computeSupplyStress`. When event streams diverge (ticks 1–3), the DR restock cycle receives different pressure and the inventory trajectory diverges.
- Because the arm-divergent event stream is stochastic, the supplyStress response is a **single-seed stochastic effect** at baseline and becomes **sign-unstable** at longer horizons (A1_H60: 46:−0.071, 47:+0.032, 48:−0.168).
- `supplyChainPressure` rises to ~0.4–0.5 whenever a weather event occurs; it is not the limiting factor. The limiting factor is whether the *event stream* diverges at all.
*Classification:* STOCHASTIC (dominant) + INTERACTION (restock cycle × event timing).

---

## 11. GDP→Emissions Saturation Findings (Question 5)

Full per-tick trace (TRACE_base, seed 42):

| t | control CO₂ | intervention CO₂ | c. eventChance | i. eventChance | identical? |
|---|---|---|---|---|---|
| 1 | 282 | 802 | 0.05 | 0.268 | no |
| 2 | 284 | 804 | 0.05 | 0.268 | no |
| 3 | 286 | 806 | 0.05 | 0.269 | no |
| 4 | 4.66×10⁶ | 4.66×10⁶ | 0.5 | 0.5 | **yes** |
| 5 | 9.31×10⁶ | 9.31×10⁶ | 0.5 | 0.5 | yes |
| … | … | … | 0.5 | 0.5 | yes |
| 20 | 1.99×10⁸ | 1.99×10⁸ | 0.5 | 0.5 | yes |

- **Onset of saturation: tick 4.** The differentiation window is ticks 1–3.
- Mechanism: economy publishes `GDP_SHIFT` with absolute-dollar deltas (~10¹¹); climate converts at `0.00005` → emissions inflate from 37 to ~10⁸ within 3 ticks.
- Final CO₂ (both arms): 1.99×10⁸ (H20), 8.20×10⁸ (H60).
- Reducing initial `annualEmissions` (37 → 3.7): no effect (final CO₂ 1.99×10⁸).
- Reducing noise (0.2 → 0.02 → 0): no effect (deterministic GDP term dominates).
- Reducing `gdpGrowth` (2.5 → 0.1): final CO₂ 2.29×10⁷ (≈1 order lower) but still saturated (eventChance 0.5).

**Conclusion:** the GDP→emissions feedback is the dominant bottleneck. It caps the intervention's exposure to a 3-tick window and forces both arms onto an identical saturated trajectory for the remaining 85% of the horizon.
*Classification:* STRUCTURAL + PARAMETER-SENSITIVE (gdpGrowth) + MODEL-BEHAVIOUR.

---

## 12. Structural vs Stochastic Classification (summary)

| Finding | Classification |
|---|---|
| Admission quantization (`m<1.5` inert; 1.5 only baseAdmit=2) | STRUCTURAL |
| Adapter multiplier bounded ≤1.5 (≤1 weather draw/tick) | STRUCTURAL |
| GDP→emissions saturation at tick 4 | STRUCTURAL + MODEL-BEHAVIOUR |
| Discharge window closed at Phase F horizon | STRUCTURAL |
| Occupancy accumulation with horizon | HORIZON-SENSITIVE |
| Weather-gate divergence → downstream response | STOCHASTIC |
| SupplyStress single-seed response; sign-unstable at H60 | STOCHASTIC |
| CO₂ leverage increases divergence frequency, not direction | STOCHASTIC / PARAMETER-SENSITIVE |
| Weather+WAR_START coincidence → multiplier 1.5 | INTERACTION |
| gdpGrowth controls saturation onset magnitude | PARAMETER-SENSITIVE |
| Whether occupancy diverges once discharge opens | UNKNOWN (infeasible this pass) |

---

## 13. Candidate Bottlenecks Ranked by Importance

1. **GDP→emissions saturation** (dominant). Caps the intervention window to 3/20 ticks and collapses both arms. Any future experiment that needs a live control arm must address this first.
2. **Stochastic event gate** (primary source of downstream variance). Only 1 weather draw/tick, and only ticks 1–3 carry arm-differentiating probability.
3. **Admission quantization + bounded multiplier** (structural attenuation). The admission pathway is inert for m<1.5 and only partially active at 1.5.
4. **Discharge-delay ≫ horizon** (structural). Occupancy turnover is impossible at Phase F's horizon.
5. **Supply-chain restock cycle** (the only responsive downstream pathway; stochastic).
6. **Event frequency vs accumulation** (secondary; frequency raises divergence probability but not direction).
7. **Small multipliers** (a consequence of #3 and the adapter's fixed +0.3/+0.2 increments).

---

## 14. Candidate Follow-Up Experiments (≤3)

### Candidate 1 — Bounded emissions-feedback / extended differentiation window
- **Scientific question:** With the GDP→emissions runaway suppressed, does the CO₂ intervention produce a *consistent* downstream direction across seeds?
- **Independent variable:** emissions-feedback gain (existing code path `gdpDelta × 0.00005`; requires a designed, frozen parameterisation — e.g. cap or rescale).
- **Controlled:** seeds 42–49, horizon 20, ticksPerDay 10, sentinel config, control/intervention CO₂ 280/800.
- **Primary outcome:** direction consistency of supplyStress and occupancy across seeds.
- **Expected mechanism:** a live control arm preserves event-gate separation beyond tick 3.
- **Why informative / different from Phase F:** Phase F could not separate "no signal" from "signal erased by saturation"; this isolates the saturation contribution.
- **Support if:** direction consistency rises materially above 1/5 with the runaway suppressed. **Falsify if:** still ~1/5.
- *Note: requires an approved model parameterisation; not run here.*

### Candidate 2 — Discharge-horizon occupancy experiment (with an optimized runner)
- **Scientific question:** Once the DR discharge pathway opens, does occupancy accumulate *differently* between arms, or does it remain RNG-cascade-only?
- **Independent variable:** effective observation window (horizon × ticksPerDay) crossing 4320 DR ticks.
- **Controlled:** seeds, sentinel config, CO₂.
- **Primary outcome:** occupancy / ICU / mortality trajectory divergence.
- **Why informative:** a signal that appears only after discharge opens is a fundamentally different explanation from one that never propagates.
- **Support if:** arm-divergent occupancy emerges once discharge is active. **Falsify if:** occupancy remains RNG-cascade-only.
- *Requires fixing the superlinear queue growth (computational work) first.*

### Candidate 3 — Admission-multiplier threshold characterisation
- **Scientific question:** At what multiplier values does the integer admission process actually change, and does that change produce a measurable occupancy response?
- **Independent variable:** admission multiplier spanning the quantization boundary (1.3 → 2.0).
- **Controlled:** sentinel config, horizon, seeds, all other parameters.
- **Primary outcome:** `toAdmit` distribution and occupancy response.
- **Why informative:** maps the exact boundary structure that Phase F identified as inert.
- **Support if:** occupancy responds monotonically to the multiplier once the boundary is crossed. **Falsify if:** even at m=2.0 the occupancy response is negligible within the horizon.
- *Note: requires a controlled way to set the multiplier without bypassing the KE→adapter→DR pathway (e.g. a designed coincident-event intervention).*

---

## 15. Explicit Limitations

- **Non-canonical platform.** The VPS is Linux; it reproduces the Windows Phase F value (+0.17), not the Mac canonical (+0.219). Quantitative values are not comparable to Mac canonical evidence.
- **Few seeds.** 8 seeds (fewer for some configs). Adequate for screening, not for estimation.
- **No significance testing.** Descriptive only; no p-values were computed (consistent with the exploratory mandate).
- **Discharge/horizon question unresolved.** Computationally infeasible in this pass; the structural prediction is not empirically confirmed.
- **Full traces stored for only 2 configs** (saturation onset); other configs store final-tick rows only.
- **Concurrent orphan process** (`exp-001-stability.js`) shared the CPU, inflating wall-clock times; it does not affect determinism.
- **Occupancy/ICU movements** are RNG-cascade effects of event-stream divergence; they are not evidence of an admission-multiplier effect.

---

## 16. Non-Canonical Statement

**All results in this report are EXPLORATORY — NON-CANONICAL.** They are not manuscript evidence and must not enter any paper as canonical evidence. The canonical Phase F result (Mac execution, VER-2026-019) is unchanged and remains the sole authoritative Phase F evidence. No code, DR, frozen experiments, QMS records, PM-1 evidence, or manuscripts were modified.

---

## FINAL VERDICT

### EXPLORATORY FINDINGS READY — CANDIDATE EXPERIMENTS IDENTIFIED

The dominant bottleneck is the GDP→emissions runaway, which reduces the intervention's effective exposure to 3 of 20 ticks. Admission quantization (inert below multiplier 1.5) and the bounded multiplier set are confirmed structural attenuators. The discharge/horizon question remains open and is the strongest candidate for a future controlled experiment.
