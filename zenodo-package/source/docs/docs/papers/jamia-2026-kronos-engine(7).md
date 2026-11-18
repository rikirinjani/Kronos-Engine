# Kronos Engine: A Deterministic Architecture for Multi-Scale Counterfactual Simulation Using Sentinel Adapters

**Authors:** Riki Rinjani

**Affiliation:** Hisfarma IAI (Himpunan Seminar Farmasi Komunitas Ikatan Apoteker Indonesia)

**ORCID:** [0009-0002-9364-2637](https://orcid.org/0009-0002-9364-2637)

**Target Journal:** Journal of the American Medical Informatics Association (JAMIA)

**Framing:** Architecture and methods paper. Component validation through exploratory experiments.

---

## Abstract

**Objective:** Healthcare systems operate within complex socio-economic and environmental contexts that cannot be experimentally controlled in real-world settings. Simulation offers a window into counterfactual scenarios, but existing frameworks either lack macro-level drivers (climate, economy, geopolitics) or sacrifice reproducibility. We present Kronos Engine, a deterministic counterfactual experimentation platform that connects macro-scale drivers to local health system simulators through a sentinel adapter pattern — a constrained translation boundary that preserves simulator autonomy while enabling multi-scale intervention experiments.

**Materials and Methods:** Kronos Engine implements a modular architecture with six world sectors (Geopolitics, Climate, Economy, Technology, Energy, Demographics) connected to existing hospital simulators via a sentinel adapter — a zero-modification wrapper that translates macro conditions into hospital-relevant parameters and publishes aggregated hospital pressure signals on the world event bus. Inbound consumption of these health signals by world sectors is not yet implemented; the coupling is asymmetric by design. The platform enforces deterministic execution through seeded pseudo-random number generation, sorted iteration order, and snapshot-based rewind points with verified branch isolation. We conducted three exploratory experiments: (1) a "No World War II" counterfactual (30 seeds, 1,233 metrics) examining GDP trajectories across nine nations, (2) a climate-emissions intervention (30 seeds, 199 metrics) testing whether a climate configuration change propagates to hospital outcomes via the sentinel adapter, and (3) a causal-pathway intervention (5 seeds, 5 primary outcomes) testing whether an extreme-weather→supply-stress pathway propagates through the adapter under elevated CO₂.

**Results:** The WWII counterfactual produced no defensible GDP effect under multiplicity-controlled statistics: 0 of 9 pre-specified GDP primary outcomes were significant (19 of 1,233 metrics significant at uncorrected α = 0.05, but none after BH-FDR or Bonferroni). The single metric surviving both corrections was the trivially mechanical reduction in war casualties. The climate-emissions intervention verified that the adapter's event-driven pathway is operational: an integration test confirmed the adapter produces sentinel output when macro events are injected. However, the specific climate configuration intervention (reduced CO2 concentration and emissions noise) did not produce measurable hospital-level changes — all hospital sentinel metrics were degenerate (zero variance across 30 seeds), and the 6 uncorrected significant metrics were world-level economy/technology artifacts with df = 1. The causal-pathway intervention (elevated CO₂ → extreme weather → supply stress) produced a SupplyStress signal in 1 of 5 seeds (seed 46, Δ = 0.219), while occupancy, ICU, and mortality remained at zero across all seeds. Identical first-event timing across arms confirmed the event-gate mechanism: extreme weather triggers supply-stress events, but downstream clinical propagation is blocked by admission-multiplier inertness and discharge-delay constraints. A 30-sentinel deployment across five Indonesian regions demonstrated the adapter's distributed operational capability.

**Discussion:** The sentinel adapter pattern enables existing, independently developed hospital simulators to participate in reproducible multi-scale counterfactuals without code modification. This paper reports architectural validation and component-level demonstration; empirical calibration against real hospital admission data is the critical next step. The coupling is asymmetric: world→hospital is implemented and integration-tested, but hospital→world feedback remains unimplemented. The causal-pathway experiment reveals an event-gate mechanism: extreme-weather events propagate to supply-stress but are blocked at admission and discharge stages by structural constraints in the hospital simulator. The pattern is designed to generalize to any domain where micro-level operations depend on macro-level drivers.

**Conclusion:** Kronos Engine demonstrates a deterministic architectural method for connecting independently developed macro-scale and health-system simulations through a constrained sentinel adapter, enabling reproducible intervention experiments while preserving simulator autonomy and explicit scale boundaries. Three exploratory experiments demonstrate the pipeline's capacity to produce honest negative results and to reveal structural constraints — including event-gate mechanisms and admission/discharge inertia — that govern cross-scale propagation. The platform provides a reproducible environment for asking and testing counterfactual questions; it does not yet establish that its outputs are sufficiently valid for clinical or policy decisions. The platform is open-source and available for collaborative extension.

**Keywords:** counterfactual simulation, sentinel surveillance, multi-scale simulation, health informatics, deterministic simulation, reproducibility

---

## 1. Introduction

Healthcare systems do not operate in isolation. Hospital admission rates respond to economic recessions [1], climate-driven heatwaves [2], pandemics [3], and geopolitical conflicts [4]. Yet most healthcare simulation frameworks treat hospitals as closed systems, modeling internal operations without the external drivers that determine patient volume, case mix, and resource availability [5,6,7]. Conversely, macro-economic and climate models rarely resolve to hospital-level outcomes. The gap between global systemic drivers and local health effects remains a fundamental methodological challenge.

Counterfactual reasoning — asking "what would have happened if X were different?" — is central to evidence-based health policy [8]. Simulation offers a window into those counterfactuals when real-world experimentation is impossible, but existing approaches address only subsets of the requirements for rigorous counterfactual analysis. Agent-based models (ABMs) of healthcare [9,10] capture local dynamics but rarely incorporate macro-economic or climate drivers. System dynamics models [11] handle macro feedback loops but lack the operational resolution needed for hospital-level decisions. Discrete-event simulations [12] offer high operational fidelity but are typically single-institution and non-deterministic.

**Kronos Engine** addresses these gaps through a deterministic multi-scale architecture with a **sentinel adapter** pattern. The key insight: rather than building a single monolithic model that spans all scales, we connect existing simulators — each operating at its native scale and independently developed — through an adapter layer that translates without violating domain boundaries. A hospital simulator need not know it participates in a world simulation; it receives parameters that look like normal operational inputs. It reports pressure signals that look like normal operational metrics. The world never reaches into the hospital.

This paper makes six contributions:

1. **Architecture** — A deterministic, modular counterfactual engine with pluggable sectors and seeded reproducibility
2. **Sentinel adapter pattern** — Zero-modification integration of standalone simulators into a multi-scale counterfactual platform
3. **Cross-sector coupling (world → hospital)** — A constrained sentinel adapter interface for integrating independently developed micro-scale simulators into deterministic macro-scale counterfactual execution without modifying simulator source code. The adapter's event-driven pathway is verified operational through interface-level integration testing (Section 2.6); the specific climate configuration intervention tested in P-004 does not propagate to hospital outcomes because the adapter consumes discrete events rather than configuration parameters (Section 3.2); inbound hospital→world feedback is architecturally unimplemented (Section 4.4)
4. **Retrospective counterfactual** — WWII counterfactual whose corrected analysis shows no defensible GDP effect (0 of 9 primary outcomes significant under BH-FDR/Bonferroni), demonstrating the pipeline's capacity to produce and audit an honest negative result
5. **Prospective demonstration** — Climate-emissions counterfactual demonstrating adapter deployment across a 30-sentinel regional network; all hospital sentinel metrics are degenerate under the tested configuration intervention, confirming the adapter's operational scalability without establishing clinical effect
6. **Causal-pathway intervention** — Phase F extreme-weather→supply-stress experiment revealing an event-gate mechanism: climate events propagate to supply-stress but are blocked at admission and discharge stages by structural constraints (admission-multiplier inertness, DR discharge delay), producing a null clinical result with mechanistic insight

---

## 2. Materials and Methods

### 2.1 Architecture Overview

[Figure 1 about here: Architecture diagram — Climate/Geopolitics/Economy sectors → MacroConditionPacket → Sentinel Adapter → Deers Rock Hospital → HospitalSentinelOutput → Counterfactual Engine → Statistical Analysis]

Kronos Engine operates at two timescales connected by an adapter layer:

```
CHRONOS ENGINE (macro, 1 tick = 1 day)
    |  macro conditions (MacroConditionPacket)
    v
ADAPTER LAYER (translation, scale bridge)
    |  admission modifiers, diagnosis weights
    v
DEERS ROCK (micro, 1 tick = 1 minute) [×N sentinels]
    |  health pressure signal (HospitalSentinelOutput)
    v
ADAPTER LAYER (aggregation, signal extraction)
    |  occupancy, mortality, prevalence
    v
CHRONOS ENGINE (sentinel output published — not consumed)
```

The world engine ticks once per simulated day. Each tick executes six world sectors in sequence. Sectors communicate through a typed event bus — events published in tick *t* are consumed at the start of tick *t+1*, preventing circular dependencies while allowing realistic one-day propagation lag.

#### Design Philosophy

Kronos deliberately avoids building a monolithic simulation. Instead, independently developed simulators remain autonomous and communicate only through deterministic translation layers (the adapter and event bus). This minimizes coupling, preserves prior development work, and allows domain models to evolve independently — a hospital simulator can be updated without touching the climate sector, and a new sector can be added without modifying existing ones.

### 2.2 Deterministic Core

Reproducibility is enforced at every level of the platform:

- **Seeded RNG:** Mulberry32 PRNG with call-count tracking. The same seed always produces identical output across runs. When Kronos Engine calls a sentinel adapter's `step()` method, it provides a deterministic RNG derived from the world seed and sentinel identifier (Section 2.5). The hospital simulator uses this RNG for all simulation-internal randomness, ensuring seed-reproducible results across runs with the same seed.
- **Universe ID:** Each simulation receives a unique ID with parent tracking (e.g., `U-2026-0001` with child `U-2026-0002` linked via a `parent` field), enabling full counterfactual genealogy.
- **Snapshot/restore:** Full world state can be captured at any tick and restored, enabling rewind-point-based counterfactuals. A `Snapshotable<T>` interface provides `__snapshot()` and `__reconstruct()` methods on sector adapters that maintain class-instance and closure state across clones. The `extractSnapshot`/`reconstructFromSnapshot` functions in `clone.ts` use these methods during deep-clone, ensuring that EventQueue instances, RNG closures, and other non-plain objects are fully independent after restore — not shared by reference.
- **Deterministic resolution order:** Sectors, hospitals, and nations are processed in a deterministic order guaranteed by sorted iteration or stable insertion, ensuring identical iteration order across runs.
- **Branch isolation:** Counterfactual branches are created from checkpoints via `forkBranch`, which stores canonical world state on the `RewindPoint` and reconstructs sector state via `sectorReconstructors` — per-sector functions that capture and restore adapter-specific state (EventQueue, RNG closures, sentinel configuration). Post-fix verification (P1/P2/P3) confirms that plain objects, class instances, and closures are fully independent across branches after restore. No shared mutable state exists between baseline and intervention branches.

Deterministic execution supports reproducible audit artifacts: seed, intervention, and checkpoint define the experiment completely, supporting third-party verification.

**Deterministic execution establishes reproducibility of model trajectories; it does not establish empirical validity.** A reproducible counterfactual produces the same output for the same seed and intervention, but whether those outputs correspond to real-world behavior requires empirical calibration against observed data.

**Calendar-year dependency:** Patient age calculations in the hospital simulator use `new Date().getFullYear()` as a reference epoch. Reproducibility is guaranteed within a single calendar year; running the same seed across calendar years produces a one-year age drift. This does not affect the experiments reported here (all conducted within 2026) but constrains cross-year reproducibility.

### 2.3 World Sectors

Six sectors model the macro environment, each with state variables, tick handlers, and cross-sector event handlers:

| Sector | State Variables | Key Events |
|---|---|---|
| Geopolitics | Nations (GDP, military, alliances, government type); active wars; diplomatic relations | `war_start`, `war_end`, `war_casualties`, `relation_shift` |
| Climate | CO2 concentration, temperature anomaly, annual emissions, extreme weather count, sea level rise | `temp_shift`, `extreme_weather`, `emissions_change` |
| Economy | Per-nation GDP, growth rate, inflation, trade volume, unemployment, market index | `gdp_shift`, `inflation_change`, `trade_shift` |
| Technology | R&D spending, patents, innovation count, tech diffusion index | `innovation`, `diffusion` |
| Energy | Energy mix (oil/gas/coal/nuclear/renewable), consumption, price, security, CO2 intensity | `price_shift`, `mix_shift`, `supply_shock` |
| Demographics | Population, birth/death rates, median age, dependency ratio, labor force, migration | `population_shift`, `aging_shift`, `labor_force_change`, `migration` |

Sector models use first-order differential approximations calibrated to historical data ranges. For example, GDP evolves as:

```
GDP[t+1] = GDP[t] × (1 + growthRate[t] / 100)
growthRate[t+1] = growthRate[t] + baseVolatility × N(0,1) + eventEffects
```

Event magnitudes are calibrated to approximate historical ranges — for example, a war event applies a −15% GDP modifier to the defender, consistent with WWII-era estimates that German GDP contracted by 30–40% over the war period [13]. These are illustrative calibration targets rather than literature-derived point estimates; all sector parameters are configurable per era, enabling the same mathematical framework to simulate ancient agrarian economies and modern industrial economies under different parameter regimes.

### 2.4 Cross-Sector Event Bus

Sectors communicate through a typed event bus with a one-tick propagation delay. An example chain illustrates the full cross-sector pathway:

Climate `extreme_weather` → Economy `gdp_shift` (agricultural loss) → Adapter builds `MacroConditionPacket` with elevated `admissionMultiplier` (uninsured patients increase) → Deers Rock occupancy rises → Sentinel reports `health.pressure` (published on the event bus; as of 2026-09-05 no sector subscribes to `health.*`, so the signal is not consumed).

The coupling is **asymmetric by design**: world sectors can influence hospital state through the adapter (implemented and integration-tested), but hospital state does not currently feed back into world-sector evolution (unimplemented). This is an intentional modularity boundary — the `LOCAL_SIGNAL_ONLY` invariant on the adapter forbids extrapolating hospital-local signals to national or global state. The integration test (Section 2.6) demonstrates the world→hospital leg of this pathway. Inbound `health.*` consumption is unimplemented and constitutes future work.

### 2.5 Sentinel Adapter Pattern

The sentinel adapter is the paper's primary architectural contribution. It wraps an existing hospital simulator — in this case, Deers Rock, a 133-bed Tier A hospital simulator in Makassar, Indonesia — as a `Sector` within Kronos Engine.

**Core invariant:** *The world does not reach into the hospital. It knocks on the adapter's door and waits for the signal.*

The adapter performs two asymmetric translations:

**Macro → Micro (downstream):** World events are translated into a `MacroConditionPacket` — parameters that any hospital simulator would recognize as normal operational inputs:

```typescript
interface MacroConditionPacket {
  tick: number;                          // world tick number
  admissionMultiplier: number;           // 1.0 = baseline
  diagnosisWeightOverrides: Record<string, number>;
  supplyChainPressure: number;           // 0-1
  staffAvailabilityModifier: number;     // 0-1
  activeDisasterType?: string;
}
```

The hospital simulator never sees GDP, war status, or climate data — only parameters like "admission rate today is 1.8× normal" or "respiratory case weight increased by 40%."

**Micro → Macro (upstream):** The adapter reads aggregated hospital state and publishes a `HospitalSentinelOutput` — pressure signals, not patient records:

```typescript
interface HospitalSentinelOutput {
  occupancyRate: number;
  icuOccupancyRate: number;
  mortalityPressure: number;
  diseasePrevalence: Record<string, number>;
  supplyStress: number;
  staffStress: number;
  admissionSurge: boolean;
}
```

**Temporal aggregation:** One world tick (1 day) equals 1,440 hospital ticks (1 minute each). The adapter's `tick()` method loops internally for the configured number of micro-ticks per world tick and publishes aggregated daily statistics.

**Seed derivation:** Each sentinel derives its RNG seed deterministically from the world seed and its string identifier (e.g., `"jkt-001"`) using a djb2 hash:

```typescript
function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++)
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
  return hash >>> 0;
}

function getHospitalSeed(worldSeed: number, hospitalId: string): number {
  return (worldSeed ^ hashString(hospitalId)) >>> 0;
}
```

String-based hashing avoids ambiguity when sentinel IDs share numeric suffixes, ensuring unique seeds across all sentinels.

**Circuit breaker:** If the hospital simulator's `step()` call fails, the adapter publishes a `health.down` signal immediately and continues with the last known good state, ensuring macro-level continuity despite micro-level failures. The current implementation does not explicitly flag stale state in downstream metrics, does not quarantine metrics from a degraded sentinel, and the statistical analysis pipeline does not distinguish degraded from healthy sentinels. This preserves macro-level continuity at the cost of potentially exposing stale micro-level output — a data-quality limitation for experiments where sentinel degradation is non-trivial.

**Zero modification:** The hospital simulator's source code is never modified. The adapter calls `step(world)` to advance the simulator and reads operational state (`world.state.beds`, `world.state.morgue`, `world.state.encounters`) directly for sentinel metrics extraction. No patient-level data (identifiers, clinical notes, lab results) is exposed to the world engine. The hospital simulator remains independently runnable, testable, and versioned.

> **Sentinel Adapter Invariants**
>
> The adapter SHALL:
> - Translate macro conditions into domain-relevant parameters, never inventing hospital behavior
> - Preserve simulator autonomy (independent execution, testing, and versioning)
> - Maintain deterministic execution through seeded RNG and stable iteration order
> - Expose only aggregated pressure signals to the world engine, never individual patient data
>
> The adapter SHALL NOT:
> - Bypass the simulator's public `step()` interface to advance the simulation
> - Leak patient-level details (identifiers, clinical notes, lab results) to the world engine
> - Introduce non-deterministic behavior
> - Allow one sentinel to observe another sentinel's output
> - Let the world engine read or influence hospital state directly

### 2.6 Integration Test: Heatwave to Health Crisis

An integration test demonstrates the world→hospital leg of the architecture:

1. Initialize universe with seed 42 at RP-CONTEMP-002 (COVID-19 baseline)
2. Run 10 days without intervention (baseline)
3. At day 10, inject a heatwave into the Climate sector
4. Run 30 more days

Expected chain: Climate heatwave → Economy recession → `MacroConditionPacket` with elevated `admissionMultiplier` → Deers Rock occupancy rises → Sentinel reports elevated `health.pressure`. The test verified that the adapter produces non-null sentinel output in both baseline and intervention runs, confirming the adapter's event-driven pathway is operational; inbound `health.*` consumption is not implemented. Note: this test verifies the event pathway exists (adapter produces output when events are injected), not that the specific climate configuration intervention in P-004 produces hospital divergence — P-004 modifies config parameters that the adapter does not consume (Section 3.2).

### 2.7 Counterfactual Pipeline

The statistical infrastructure for multi-seed experiments consists of:

- **types.ts:** Defines `Intervention`, `MetricDelta`, `SectorDiff`, `CounterfactualDiff`, `ExperimentRun`, `ExperimentSet`, and `StatisticalSummary`
- **diff-engine.ts:** Extracts numeric paths from world state snapshots and computes per-metric deltas
- **stats.ts:** Computes mean, median, standard deviation, 95% confidence intervals, and Cohen's d across seeds

Deltas are computed as intervention minus baseline (Δ = intervention − baseline); a positive delta indicates a higher value in the intervention branch.

Each experiment consists of *N* seed pairs. For each seed, the engine forks the baseline universe, applies the intervention, runs both branches for *T* ticks, and captures terminal snapshots. The diff engine compares snapshots, producing per-metric deltas. For every metric with at least two non-identical per-seed deltas, significance is assessed with a one-sample t-statistic against H₀: mean delta = 0 and a two-sided p-value with df = n − 1. Effect size is reported as one-sample Cohen's d_z (mean / SD of per-seed deltas) [16] — a standardized shift away from zero, labeled explicitly because it is not a two-group Cohen's d. Metrics that cannot be tested — fewer than two deltas, zero variance (constant delta across seeds), or numerically meaningless effect sizes (|d| > 1000 from floating-point jitter around a constant) — are flagged degenerate and excluded from the testing family. Benjamini–Hochberg FDR and Bonferroni corrections are applied across all non-degenerate metrics at α = 0.05 [15]. Alongside observed significance counts we report the noise floor — the false positives expected by chance at α = 0.05 across the total and the tested (non-degenerate) metric families — so observed counts can be judged against chance.

### 2.8 Historical Data Layer

Six historical eras are pre-seeded as `StrategicWorldState` JSON packages:

| Era | Time Span | Rewind Points |
|---|---|---|
| Ancient | ~3000 BCE–500 CE | Fall of Rome (476) |
| Medieval | 500–1500 | Black Death (1347), Fall of Constantinople (1453) |
| Early Modern | 1500–1800 | Columbus (1492), French Revolution (1789) |
| Industrial | 1800–1914 | Congress of Vienna (1815), WWI trigger (1914) |
| Modern | 1914–1991 | WWII (1939), Moon Landing (1969), Fall of USSR (1991) |
| Contemporary | 1991–present | 9/11 (2001), COVID-19 (2020), Baseline 2026 |

An era loader (`buildSectorConfigs`) maps `StrategicWorldState` into sector configurations at initialization, enabling any rewind point to serve as the starting state for counterfactual experiments.

### 2.9 Model Calibration

Initial experiments revealed four calibration gaps corrected before final validation — transparency about these discoveries is itself a methodological rigor signal:

| Gap | Problem | Correction |
|---|---|---|
| War casualties | Simulated casualties (∼1K) vs. historical (∼75M for WWII) — 75,000× gap | Configurable `casualtyMultiplier`; set to ∼2,500 for WWII experiments (illustrative target, consistent with estimates in [13]) |
| War→GDP sign | Net-positive GDP with war (economic growth outranks 5% GDP hit) | Split attacker/defender: attacker +3% GDP, defender −15% GDP (illustrative calibration targets) |
| Climate CO2 noise | ±1 Gt/yr noise swamps 0.5 Gt/yr emissions signal | Noise reduced 10×, now configurable via `annualEmissionsNoise` |
| Economy wars[] init | Empty `wars[]` array regardless of config — war_casualties handler silently skipped GDP drain | Removed filter; drain already scales by GDP |

Calibration parameters are configurable per era, enabling the same engine to simulate periods under different parameter regimes. The default `casualtyMultiplier` is 1.0 for peacetime simulations.

---

## 3. Results

### 3.1 Experiment 1: WWII Counterfactual (P-003)

**Design:** 30 seeds (42–71). Intervention: WWII ends before escalation (Hitler dies 1938). Rewind point: RP-MODERN-001 (1939). Duration: 30 ticks. Total metrics analyzed: 1,233 (291 non-degenerate and testable; 942 degenerate/untestable). Of the 942 degenerate metrics, 939 arise from procedurally generated war structures (unique seed-specific identifiers such as W-NNNNN) that appear in the state tree of individual simulation seeds but not across the full ensemble; their sub-fields produce deltas in exactly one of 30 runs (n = 1), insufficient for a t-test. The remaining 3 degenerate metrics have zero variance (constant delta across all seeds). This experiment demonstrates the deterministic experimentation framework independently of healthcare-specific assumptions — establishing that the platform correctly propagates macro-level interventions through coupled sector models.

**Statistical note:** Analysis follows Section 2.7: per-metric one-sample t-tests (df = n − 1), with Benjamini–Hochberg FDR and Bonferroni correction applied across the 291 non-degenerate tested metrics. The noise floor — false positives expected by chance at α = 0.05 — is 61.65 across all 1,233 metrics and 14.55 across the tested family. We observed 19 significant metrics at uncorrected α = 0.05, only slightly above the 14.55 tested-family noise floor, and exactly one survived both BH-FDR and Bonferroni: `wars.W-1939-01.casualties` (d = −1.46, adjusted p ≈ 2.4 × 10⁻⁶). This effect is trivially mechanical — ending the war stops its casualties — and is not a substantive economic finding. Critically, none of the nine pre-specified GDP primary outcomes were significant under any correction (all pAdjusted > 0.8; pBonferroni = 1 for all nine), so the pre-specified primary-outcome direction-consistency criterion is not met. P-003 is therefore best interpreted as an exploratory negative result demonstrating the reproducible counterfactual pipeline — the intervention propagates deterministically through the coupled sector model without producing a statistically defensible macroeconomic outcome.

| Nation | Mean Δ GDP | Cohen's d_z | p (uncorrected) | pBonferroni | Significant |
|---|---|---|---|---|---|
| United States | −$24.9M | −0.04 | 0.767 | 1.00 | No |
| Germany | −$35.7M | −0.06 | 0.678 | 1.00 | No |
| United Kingdom | −$47.3M | −0.08 | 0.560 | 1.00 | No |
| Russia | −$42.7M | −0.07 | 0.609 | 1.00 | No |
| France | −$53.3M | −0.09 | 0.522 | 1.00 | No |
| Japan | −$38.1M | −0.06 | 0.652 | 1.00 | No |
| China | −$4.4M | −0.01 | 0.954 | 1.00 | No |
| Italy | −$23.4M | −0.04 | 0.771 | 1.00 | No |
| Poland | −$41.2M | −0.07 | 0.615 | 1.00 | No |

[Figure 2 about here: Bar chart of GDP differences across pre-specified primary outcomes with 95% CIs]

Climate variables showed no significant divergence in the corrected analysis: temperature anomaly (d = −0.22, p = 0.234), CO2 concentration (d = −0.15, p = 0.417), and annual emissions (d = −0.19, p = 0.313), all non-significant. Germany's inflation rate did not differ significantly between branches (d = −0.02, p = 0.903).

With corrected baselines and multiplicity-controlled statistics, the intervention produces **no defensible GDP effect**: 0 of 9 primary outcomes significant, and primary-outcome direction consistency is not established (all nine mean deltas are small and negative, all with pAdjusted > 0.8). The only multiplicity-controlled survivor is the trivially mechanical reduction in `wars.W-1939-01.casualties` — ending a war stops its casualties. P-003 should therefore be read as an exploratory negative result that demonstrates the reproducible counterfactual pipeline, not as evidence of GDP effects. The experiment's validation value is architectural: the intervention deterministically propagates through the coupled sector model across seeds, even though the resulting economic effect is statistically indistinguishable from noise.

### 3.2 Experiment 2: Climate Configuration Intervention — Adapter Boundary Characterization (P-004)

**Design:** 30 seeds (42–71). Intervention: Reduced CO2 concentration (400 ppm) and emissions noise (0.02). Rewind point: RP-CONTEMP-002 (COVID-19 baseline). Duration: 20 ticks. Sentinel: Deers Rock, 133-bed Makassar hospital. Total metrics: 199 (106 non-degenerate and testable; 93 degenerate/untestable).

**Results:** 6 of 199 metrics were significant at uncorrected α = 0.05; **none survived BH-FDR (minimum q = 0.198) or Bonferroni (pBonferroni = 1 for all)**. The noise floor at α = 0.05 is 9.95 false positives expected across all 199 metrics and 5.3 across the 106 tested metrics, so the 6 uncorrected significances are indistinguishable from chance. Critically, **none of the 6 significant metrics were hospital metrics** — all were world-level economy/technology metrics with df = 1 (only 2 non-degenerate seeds out of 30), and none survived multiplicity correction. These are economy-fragment artifacts driven by near-zero-variance GDP deltas in two seeds, not substantive intervention effects.

**All hospital sentinel metrics are degenerate.** Every `sentinelOutput.*` metric — occupancy rate, ICU occupancy, mortality pressure, disease prevalence, supply stress, staff stress, admission surge — has zero variance across all 30 seeds (stdDev = 0, same value in baseline and intervention branches). The adapter correctly produced sentinel output (the event pathway is operational), but the climate configuration intervention (reduced CO2 concentration and emissions noise) did not propagate into hospital outcomes. The adapter consumes discrete events (`admission_surge`, `staff_shortage`, `supplyStress`) rather than climate configuration parameters; under the current model architecture and tested horizons (20 ticks), the config-level intervention does not generate the discrete events the adapter listens for. This is a design-scope limitation, not evidence that climate interventions can never affect hospital outcomes.

The pre-specified hospital primary outcomes (CSSD sterilization cycles, dialysis sessions, occupancy rate) are all degenerate in the current data (stdDev = 0, d = 0, no testable variance). None survived multiplicity correction.

### 3.3 Regional Sentinel Network

A 30-hospital sentinel network was deployed across five Indonesian regions using a single hospital simulator (Deers Rock) instantiated 30 times with different configurations and derived seeds:

| Region | Hospitals | Occupancy (baseline) | Occupancy (intervention) | Δ |
|---|---|---|---|---|
| Java | 9 | 48.3% | 48.1% | −0.2pp |
| Sumatra | 7 | 46.4% | 46.7% | +0.3pp |
| Kalimantan | 3 | 49.1% | 48.5% | −0.6pp |
| Sulawesi | 5 | 40.4% | 40.6% | +0.2pp |
| Eastern Indonesia | 6 | 42.7% | 42.3% | −0.4pp |

The network demonstrates the adapter's distributed operational capability — each hospital derives an independent seed from the world seed, receives the same macro packet, and reports independently. Regional occupancy variation (40.4%–49.1%) reflects capacity configuration differences (fewer beds per capita produces higher occupancy) rather than demand differences. At the 10-tick simulation duration, occupancy deltas between baseline and intervention branches remained below 1 percentage point, and no acute clinical outcomes (ICU occupancy, mortality) were observed.

### 3.4 Computational Performance

The full test suite (333 tests, 37 files; 333 passing on macOS arm64, 332 on Windows due to a platform-specific assertion threshold in the health-surveillance isolation test) runs in under 2 minutes on consumer hardware. A 30-seed, 20-tick experiment with a single hospital sentinel completes in approximately 2 minutes (peak memory ∼200 MB). The 30-hospital network completes 10 seeds in approximately 5 minutes (peak memory ∼600 MB). TypeScript compilation completes in under 5 seconds. All experiments are fully reproducible through seed-based determinism.

### 3.5 Experiment 3: Causal-Pathway Intervention (Phase F)

**Design:** 5 seeds (42–46), fresh-world paired execution. Control: CO₂ = 280 ppm (pre-industrial baseline). Intervention: CO₂ = 800 ppm (high-emissions scenario). Duration: 20 KE ticks. Rewind point: RP-CONTEMP-002 (COVID-19 baseline). Sentinel: Deers Rock, 133-bed Makassar hospital. Primary outcomes: occupancy rate, ICU occupancy, mortality pressure, supply stress, admission surge flips. Success criterion: direction consistency ≥ 80% (4/5 seeds). Execution platform: macOS 26.6.2 arm64, Node v26.5.0 (canonical per §10 cross-platform mandate).

**Causal hypothesis:** Elevated CO₂ → increased extreme-weather frequency → climate `extreme_weather` events → economy `gdp_shift` → adapter builds `MacroConditionPacket` with elevated `supplyChainPressure` → Deers Rock supply-stress rises → sentinel reports elevated `health.pressure`.

**Results:** SupplyStress showed a positive delta in 1 of 5 seeds (seed 46, Δ = 0.219; mean Δ = 0.044, d = 0.45, direction consistency = 0.2). Occupancy rate, ICU occupancy, and mortality pressure were zero across all 5 seeds in both arms (Δ = 0 for all, stdDev = 0). No admission surge flips occurred. The intervention produced 41 extreme-weather events versus 39 in control; first-event ticks were identical across arms ([8, 4, 6, 6, 2]).

| Outcome | Mean Δ | Direction Consistency | Interpretation |
|---|---|---|---|
| SupplyStress | +0.044 | 0.2 (1/5) | Seed-46 signal only; not directionally consistent |
| Occupancy Rate | 0 | 0 (0/5) | Structural zero — no bed occupancy change |
| ICU Occupancy | 0 | 0 (0/5) | Structural zero — no ICU change |
| Mortality Pressure | 0 | 0 (5/5 zero) | Structural zero — no mortality change |
| Admission Surge Flips | 0 | — | No flips in either arm |

**Structural analysis:** Three mechanisms block downstream clinical propagation:

1. **Event-gate mechanism:** Identical first-event ticks across arms confirm that extreme-weather events trigger at the same world ticks regardless of CO₂ level. The climate sector's `extreme_weather` count increases with CO₂, but event *timing* is deterministic and seed-dependent, not CO₂-dependent. The signal propagates from Climate to Economy to Adapter (supply-stress), but the hospital simulator's internal dynamics do not amplify this signal into clinical outcomes.

2. **Admission-multiplier inertness:** The adapter's `admissionMultiplier` is computed as `floor(floor(rng × 3) × 1.3)`. For a single extreme-weather event, `floor(rng × 3)` produces 0, 1, or 2; multiplying by 1.3 and re-flooring yields the same integer. The multiplier is structurally inert for isolated events — it can only differentiate when multiple events compound within a single tick.

3. **Discharge-delay constraint:** DR's discharge delay (4,320–10,080 DR ticks) exceeds the 200-DR-tick observation horizon. Patients admitted during the experiment cannot discharge before the experiment ends, so occupancy and mortality remain at baseline regardless of admission changes. This is a temporal-scale mismatch between world-tick and hospital-tick horizons.

**Platform consistency:** Windows execution (non-canonical per §10) produced concordant results: SupplyStress +0.17 (seed 46 only), same event-gate pattern, same structural nulls. Replay verification confirmed identical KE RNG trajectories across platforms.

**Interpretation:** The Phase F experiment is a null clinical result with mechanistic insight. The event-gate mechanism is confirmed: climate events propagate to adapter-level supply-stress, but admission and discharge stages are structurally inert under the tested configuration. The adapter's event-driven pathway is operational (events propagate), but the hospital simulator's internal dynamics do not translate supply-stress into clinical outcomes within the tested horizon. This is a design-scope limitation — the adapter correctly translates macro events into hospital-relevant parameters, but the hospital simulator's admission and discharge mechanics require either multiple compounding events or longer horizons to produce measurable clinical divergence.

---

## 4. Discussion

### 4.1 The Sentinel Adapter Paradigm

The central contribution of this work is the **sentinel adapter pattern**: a methodology for integrating existing domain-specific simulators into a multi-scale counterfactual platform without modifying their source code. The hospital simulator retains full autonomy — it can be developed, tested, and validated independently by its own team. The adapter translates between scales without violating domain boundaries.

This is analogous to the public health concept of **sentinel surveillance**, where selected hospitals monitor disease trends without claiming to represent the entire population [14]. Our pattern extends this idea to simulation: sentinel hospitals participate in a larger world, report local pressure signals, and remain ignorant of the macro-level forces affecting them.

The implications for health informatics include:
- **Existing investments preserved:** Validated hospital simulators need not be rewritten or retrofitted
- **Scaling by configuration:** Adding a new sentinel requires only a configuration file, not code changes — though all 30 sentinels in this study run the same simulator with different seeds, not heterogeneous simulator types
- **Distributed observation:** 30 hospitals across 5 regions provide a regional health pressure heatmap
- **Counterfactual auditability:** Seed, intervention, and checkpoint define every experiment completely

### 4.2 Determinism as a Methodological Requirement

Real-world health data is noisy, incomplete, and non-repeatable. Simulation offers complete observability — every variable is visible — but only if the simulation itself is reproducible. Kronos Engine's deterministic core ensures any counterfactual experiment can be precisely re-executed, supporting auditability and third-party verification.

### 4.3 Comparison with Existing Approaches

| Capability | Kronos | Healthcare ABM [9,10] | System Dynamics [11] | Discrete-Event [12] |
|---|---|---|---|---|
| Macro drivers (climate, economy) | First-class sectors | Custom per model | Native | None |
| Hospital operational fidelity | Via sentinel adapter | Custom per model | Low | Native |
| Deterministic reproducibility | Native (seeded RNG, sorted order, Snapshotable deep-clone) | Rare in healthcare applications | Rare in healthcare applications | Rare in healthcare applications |
| Multi-scale coupling | Translator adapter | Typically single-scale | Typically single-scale | Typically single-scale |
| Counterfactual branching | Native (rewind + fork) | Implementation-dependent | Scenario-based | Scenario-based |
| Zero-modification integration | Yes (public API only) | Implementation-dependent | Implementation-dependent | Implementation-dependent |
| Empirical validation against real data | Not yet | Varies | Varies | Common |

### 4.4 Limitations

**Asymmetric coupling:** The sentinel adapter implements world→hospital coupling (macro conditions influence hospital state) but not hospital→world feedback (hospital pressure signals do not feed back into world-sector evolution). The adapter publishes `health.*` events on the world event bus, but no world sector subscribes to them. This is an intentional architectural boundary — the `LOCAL_SIGNAL_ONLY` invariant forbids extrapolating hospital-local signals to national or global state — but it limits claims of closed-loop world simulation. Bidirectional coupling remains future work.

**Incomplete war-event reversibility:** The economy sector implements WAR_START and WAR_CASUALTIES event handlers but does not implement a WAR_END handler. War economic effects (attacker GDP boost, defender GDP penalty, global casualty drain) are therefore not reversed when a war ends. This does not affect P-003 because W-1939-01 pre-exists at the rewind point and its WAR_START handler is not triggered during the experiment, but it limits the generalizability of counterfactual experiments involving dynamically started and ended conflicts.

**Snapshot restore fidelity:** The snapshot/restore mechanism faithfully restores Kronos-level RNG state through call-count replay. However, the hospital simulator's internal clock RNG is recreated from the saved seed without replaying prior calls, so hospital-internal random state may diverge slightly on restore versus continuous execution. This does not affect cross-branch comparability (both branches experience the same restore behavior) but means the adapter does not guarantee sub-tick hospital-level byte-reproducibility after restore.

**No defensible micro→macro consumer:** The granularity mismatch between hospital-local signals (one 133-bed facility in Makassar) and national/global state variables (270M-person nation, 8.2B-person global aggregate) is 5–7 orders of magnitude. Wiring hospital pressure into national health metrics would violate the adapter's own `LOCAL_SIGNAL_ONLY` invariant. A defensible consumer requires KE state at city or regional-health granularity — e.g., a regional health-system sector or a sentinel-network aggregator over a statistically defensible hospital sample. Both are new architecture, explicitly out of current scope.

**Climate configuration does not propagate to hospital outcomes:** The P-004 climate-emissions intervention (reduced CO2 concentration and emissions noise) produces zero variance on all hospital sentinel metrics — every `sentinelOutput.*` metric is degenerate (stdDev = 0, same value across all 30 seeds). The DR adapter consumes discrete events (`admission_surge`, `staff_shortage`, `supplyStress`) rather than climate configuration parameters. Under the current model architecture and tested horizons (20 ticks), the climate intervention does not propagate into DR outcomes. The 6 uncorrected significant metrics in P-004 are world-level economy/technology artifacts, not hospital effects. This is a design-scope limitation, not evidence that climate interventions can never affect hospital outcomes.

**No empirical validation against real hospital data:** This is the paper's single largest exposure. The counterfactual outputs are internally consistent and cross-validated across seeds, but the platform has not been calibrated against real-world hospital admission data. The abstract and introduction frame this as an architecture and methods paper demonstrating internal consistency and architectural correctness — not a clinically validated prediction tool. We are currently pursuing calibration against de-identified hospital admission data to validate occupancy predictions.

**Single hospital simulator:** The sentinel adapter currently wraps one hospital model (Deers Rock). The 30-hospital network demonstrates that one simulator can be cloned 30 times with different configurations — this confirms the adapter's operational scalability, not its ability to integrate heterogeneous simulator types. Validation with additional simulators (e.g., trauma centers, tertiary referral hospitals) is needed before claiming broad applicability. Integrating heterogeneous simulator types is the next logical extension.

**Short simulation duration:** Clinical outcomes (mortality, ICU surges) typically manifest over weeks to months. Our 20–30 tick experiments capture operational early indicators but do not establish clinical significance. The hospital metrics are degenerate under the tested configuration intervention (Section 3.2), reflecting the causal disconnect at the climate→event step rather than a temporal limitation. Future work will extend to 365+ ticks to capture seasonal and acute effects.

**Sector model fidelity:** World sectors use first-order approximations rather than validated macro-economic or climate models. Event magnitudes (e.g., −15% GDP for war defenders) are illustrative calibration targets [13] and have not undergone formal sensitivity analysis against observational data.

**Multiple comparison corrections:** We apply Benjamini–Hochberg FDR and Bonferroni corrections across all non-degenerate metrics at α = 0.05 (Section 2.7). For P-003 the corrected family is 291 tested metrics (of 1,233); the noise floor is 14.55 expected false positives at α = 0.05, and the 19 uncorrected significances are statistically indistinguishable from chance. Exactly one metric — the mechanical war-casualties reduction — survived FDR or Bonferroni. For P-004 the corrected family is 106 tested metrics (of 199; noise floor 5.3); none of the 6 uncorrected significances survived. All 6 significant P-004 metrics are world-level economy/technology metrics with df = 1 (only 2 non-degenerate seeds); all hospital sentinel metrics are degenerate (zero variance). The reported effect sizes are one-sample d_z values, not two-group Cohen's d values, and are not comparable to effect sizes in the clinical literature.

**GDP effect size interpretation:** As noted in Section 3.1, the corrected analysis yields no defensible GDP effect: all nine pre-specified GDP primary outcomes were non-significant with small one-sample d_z values (|d| ≤ 0.09), and the effect sizes should not be interpreted as quantitative predictions of real WWII GDP loss (which reached 30–40% of GDP for Germany). The absence of a multiplicity-controlled GDP signal — despite deterministic propagation of the intervention through the sector model — is itself the finding: it constrains claims the platform can support and motivates the architectural (rather than quantitative) framing of this experiment.

### 4.5 Generalizability

While demonstrated with a healthcare sentinel, the adapter pattern is designed to accommodate micro-level simulators exposing equivalent state-update and state-query interfaces — for example, supply chain models, traffic simulations, or energy grid operators — provided they implement the adapter's contract. The adapter translates macro conditions into domain-relevant parameters and aggregates micro-level outputs into macro-level signals, without either layer needing to know the other's internals.

---

## 5. Conclusion

We have presented Kronos Engine, a deterministic counterfactual experimentation platform for multi-scale health system simulation. The sentinel adapter pattern enables existing hospital simulators to participate in world-scale counterfactuals without modification, preserving simulator autonomy while enabling multi-scale intervention experiments.

Two exploratory experiments — a "No World War II" retrospective counterfactual and a climate-emissions intervention — demonstrate the platform's architectural operation. The WWII counterfactual produced no defensible GDP effect under multiplicity-controlled statistics, illustrating the platform's capacity to produce and audit honest negative results. The climate-emissions counterfactual verified that the adapter's event-driven pathway is operational (the adapter produces sentinel output when macro events are injected), though the specific climate configuration intervention did not propagate to hospital outcomes — all hospital sentinel metrics were degenerate. Neither experiment establishes empirically validated predictions; both demonstrate that the architecture functions as designed and that the deterministic counterfactual pipeline produces reproducible results.

This paper reports architectural validation. The critical next step is empirical calibration against real-world hospital admission data to transition from internally consistent simulation outputs to empirically grounded informatics. The platform is open-source and available for collaborative extension.

---

## References

[1] Suhrcke M, Stuckler D, Suk JE, et al. The impact of economic crises on communicable disease transmission and control: a systematic review of the evidence. PLoS One. 2011;6(6):e20724.

[2] Watts N, Amann M, Arnell N, et al. The 2020 report of The Lancet Countdown on health and climate change: responding to converging crises. Lancet. 2021;397(10269):129-170.

[3] Walker PGT, Whittaker C, Watson OJ, et al. The impact of COVID-19 and strategies for mitigation and suppression in low- and middle-income countries. Science. 2020;369(6502):413-422.

[4] Gatewood AK, Berryman DR, Schweinle WE, et al. The effect of war on healthcare: a review. Mil Med. 2020;185(Supplement_1):170-175.

[5] Kannampallil TG, Schauer GF, Cohen T, Patel VL. Considering complexity in healthcare systems. J Biomed Inform. 2011;44(6):943-947.

[6] Kannampallil TG, Abraham J. Simulation in health informatics. J Am Med Inform Assoc. 2019;26(10):945-947.

[7] Meyer AK, Korfmacher T, Iden J, Rienhoff O. Simulation of clinical workflows: a systematic review. Appl Clin Inform. 2020;11(3):487-498.

[8] Hernán MA, Robins JM. Causal Inference: What If. Boca Raton: Chapman & Hall/CRC; 2020.

[9] Tracy M, Cerdá M, Keyes KM. Agent-based modeling in public health: current applications and future directions. Annu Rev Public Health. 2018;39:77-94.

[10] Auchincloss AH, Diez Roux AV. A new tool for epidemiology: the usefulness of dynamic-agent models in understanding place effects on health. Am J Epidemiol. 2008;168(1):1-8.

[11] Homer JB, Hirsch GB. System dynamics modeling for public health: background and opportunities. Am J Public Health. 2006;96(3):452-458.

[12] Jacobson SH, Hall SN, Swisher JR. Discrete-event simulation of health care systems. In: Hall RW, ed. Patient Flow: Reducing Delay in Healthcare Delivery. Springer; 2006:211-252.

[13] Harrison M, ed. The Economics of World War II: Six Great Powers in International Comparison. Cambridge University Press; 1998.

[14] World Health Organization. Immunization, Vaccines and Biologicals: Sentinel Surveillance. WHO; 2021.

[15] Benjamini Y, Hochberg Y. Controlling the false discovery rate: a practical and powerful approach to multiple testing. J R Stat Soc Series B. 1995;57(1):289-300.

[16] Cohen J. Statistical Power Analysis for the Behavioral Sciences. 2nd ed. Lawrence Erlbaum Associates; 1988.

---

## Supplementary Material

- **Source code:** https://github.com/rikirinjani/Kronos-Engine (public)
- **Experiment data:** `experiment-results/` directory
- **332 of 333 tests pass (1 assertion failure in health-surveillance isolation test):** TypeScript, Vitest, `tsc --noEmit` clean
- **Evidence freeze:** `docs/EVIDENCE-FREEZE-2026-09-05.md`
- **Phase E verification:** `HANDOFF-PHASE-E.md`

---

### Required Figures (for production)

**Figure 1:** Architecture diagram — Climate/Geopolitics/Economy sectors → MacroConditionPacket → Sentinel Adapter → Deers Rock Hospital → HospitalSentinelOutput → Counterfactual Engine (statistical analysis). Shows the asymmetric coupling: world→hospital is implemented; hospital→world is not yet implemented. Professional layout preferred.

**Figure 2:** WWII counterfactual: GDP differences across pre-specified primary outcomes — bar chart with 95% confidence intervals for all nine nations, ordered by magnitude. All nine primary outcomes are non-significant under multiplicity correction.

**Figure 3:** Sentinel network map — Indonesia with hospital indicators for 30 sentinels across 5 regions, colored by regional occupancy.
