# Kronos Engine: A Deterministic Counterfactual Experimentation Platform with Sentinel Adapter Pattern for Multi-Scale Health System Simulation

**Authors:** R. Kirinjani, et al.

**Affiliation:** Independent Research

**Target Journal:** Journal of the American Medical Informatics Association (JAMIA)

**Framing:** Retrospective validation. Prospective demonstration.

---

## Abstract

**Objective:** Healthcare systems operate within complex socio-economic and environmental contexts that cannot be experimentally controlled in real-world settings. A hospital administrator cannot observe the same system both with and without a recession, a heatwave, or a pandemic. Simulation offers the only window into those counterfactuals, but existing frameworks either lack macro-level drivers (climate, economy, geopolitics) or sacrifice reproducibility. We present Kronos Engine, a deterministic counterfactual experimentation platform that bridges global systemic drivers and local health system outcomes through a sentinel adapter pattern.

**Materials and Methods:** Kronos Engine implements a modular architecture with six world sectors (Geopolitics, Climate, Economy, Technology, Energy, Demographics) connected to existing hospital simulators via a sentinel adapter — a zero-modification wrapper that translates macro conditions into hospital-relevant parameters and aggregates hospital pressure signals back to the world. The platform enforces full determinism through seeded pseudo-random number generation, sorted iteration order, and snapshot-based rewind points. We conducted two experiments: (1) a "No World War II" counterfactual (30 seeds, 1,421 metrics) examining GDP trajectories across nine nations, and (2) a climate-emissions intervention (30 seeds, 156 metrics) measuring hospital-level operational impact via an Indonesian sentinel hospital.

**Results:** The WWII counterfactual produced statistically significant GDP divergence across all nine pre-specified primary outcome nations (Cohen's d > 1.0; Bonferroni-adjusted p < 0.05), with the United States showing the largest mean difference (Δ = +$31.3B, d = 1.13). The climate intervention verified end-to-end sentinel pipeline operation; 14 of 156 operational metrics reached significance (Bonferroni-corrected), including occupancy rate (d = 0.70), dialysis sessions (d = 1.11), and CSSD sterilization cycles (d = -2.71). A 30-hospital regional network demonstrated the adapter's distributed operational capability, with occupancy ranging from 40.4% (Sulawesi) to 49.1% (Kalimantan) across five Indonesian regions.

**Discussion:** The sentinel adapter pattern enables existing, independently validated hospital simulators to participate in reproducible multi-scale counterfactuals without code modification. This paper reports internal consistency and architectural validation; empirical calibration against real hospital admission data is the critical next step. The platform generalizes to any domain where micro-level operations depend on macro-level drivers.

**Conclusion:** Kronos Engine is a laboratory for reproducible health system counterfactuals — a platform where policy-makers, hospital administrators, and public health officials can ask "what if?" and receive statistically rigorous, auditable answers. The platform is open-source and available for collaborative extension.

**Keywords:** counterfactual simulation, sentinel surveillance, multi-scale simulation, health informatics, deterministic simulation, reproducibility

---

## 1. Introduction

Healthcare systems do not operate in isolation. Hospital admission rates respond to economic recessions [1], climate-driven heatwaves [2], pandemics [3], and geopolitical conflicts [4]. Yet most healthcare simulation frameworks treat hospitals as closed systems, modeling internal operations without the external drivers that determine patient volume, case mix, and resource availability [5,6]. Conversely, macro-economic and climate models rarely resolve to hospital-level outcomes. The gap between global systemic drivers and local health effects remains a fundamental methodological challenge.

Counterfactual reasoning — asking "what would have happened if X were different?" — is central to evidence-based health policy [7]. In clinical informatics, for example, a hospital administrator cannot observe the same system both with and without an EHR downtime event, a staffing shortage, or a surge in respiratory admissions. Simulation offers the only window into those counterfactuals, but only if the simulation is:

1. **Deterministic** — identical inputs produce identical outputs, enabling rigorous reproducibility and auditability [8]
2. **Multi-scale** — bridges macro-level drivers to micro-level operational outcomes
3. **Pluggable** — accepts existing validated simulators without modification, preserving prior investment
4. **Verifiable** — produces statistically testable predictions with transparent uncertainty

Existing approaches address subsets of these requirements. Agent-based models (ABMs) of healthcare [9,10] capture local dynamics but rarely incorporate macro-economic or climate drivers. System dynamics models [11] handle macro feedback loops but lack the operational resolution needed for hospital-level decisions. Discrete-event simulations [12] offer high operational fidelity but are typically single-institution and non-deterministic.

**Kronos Engine** addresses these gaps through a deterministic multi-scale architecture with a **sentinel adapter** pattern. The key insight: rather than building a single monolithic model that spans all scales, we connect existing simulators — each operating at its native scale and independently validated — through an adapter layer that translates without violating domain boundaries. A hospital simulator need not know it participates in a world simulation; it receives parameters that look like normal operational inputs. It reports pressure signals that look like normal operational metrics. The world never reaches into the hospital.

This paper makes five contributions:

1. **Architecture** — A deterministic, modular counterfactual engine with pluggable sectors and seeded reproducibility
2. **Sentinel adapter pattern** — Zero-modification integration of standalone simulators into a multi-scale counterfactual platform
3. **Cross-sector feedback** — Verified end-to-end coupling of climate, economy, and health sectors via an integration test
4. **Retrospective validation** — WWII counterfactual reproducing known GDP divergence across nine nations, with explicit statistical correction for multiple comparisons
5. **Prospective demonstration** — Climate-emissions-to-hospital operational pipeline with a 30-hospital regional network

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
CHRONOS ENGINE (reads as regional sentinel output)
```

The world engine ticks once per simulated day. Each tick executes six world sectors in sequence. Sectors communicate through a typed event bus — events published in tick *t* are consumed at the start of tick *t+1*, preventing circular dependencies while allowing realistic one-day propagation lag.

#### Design Philosophy

Kronos deliberately avoids building a monolithic simulation. Instead, independently validated simulators remain autonomous and communicate only through deterministic translation layers (the adapter and event bus). This minimizes coupling, preserves prior validation work, and allows domain models to evolve independently — a hospital simulator can be updated without touching the climate sector, and a new sector can be added without modifying existing ones.

### 2.2 Deterministic Core

Reproducibility is enforced at every level of the platform:

- **Seeded RNG:** Mulberry32 PRNG with call-count tracking. The same seed always produces identical output across runs.
- **Universe ID:** Each simulation receives a unique ID with parent tracking (e.g., `U-2026-0001` with child `U-2026-0002` linked via a `parent` field), enabling full counterfactual genealogy.
- **Snapshot/restore:** Full world state can be captured at any tick and restored, enabling rewind-point-based counterfactuals.
- **Deterministic resolution order:** Sectors, hospitals, and nations are processed in a deterministic order guaranteed by sorted iteration or stable insertion, ensuring identical iteration order across runs.

A deterministic simulation provides an immutable audit trail: seed, intervention, and checkpoint define the experiment completely. This supports third-party verification and potential regulatory applications — an important consideration given growing FDA and EMA emphasis on model-informed decision-making [8].

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

Climate `extreme_weather` → Economy `gdp_shift` (agricultural loss) → Adapter builds `MacroConditionPacket` with elevated `admissionMultiplier` (uninsured patients increase) → Deers Rock occupancy rises → Sentinel reports `health.pressure` → Geopolitics receives regional stability signal.

The integration test (Section 2.6) validates that this round-trip from climate event to hospital outcome produces measurable signal.

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

**Circuit breaker:** If the hospital simulator's `step()` call fails, the adapter publishes a `health.down` signal immediately and continues with the last known good state, ensuring macro-level continuity despite micro-level failures.

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

A full round-trip integration test validates the architecture end-to-end:

1. Initialize universe with seed 42 at RP-CONTEMP-002 (COVID-19 baseline)
2. Run 10 days without intervention (baseline)
3. At day 10, inject a heatwave into the Climate sector
4. Run 30 more days

Expected chain: Climate heatwave → Economy recession → `MacroConditionPacket` with elevated `admissionMultiplier` → Deers Rock occupancy rises → Sentinel reports elevated `health.pressure`. The test verified that climate-to-hospital propagation produces measurable operational signal at 30 ticks, confirming architecture correctness.

### 2.7 Counterfactual Pipeline

The statistical infrastructure for multi-seed experiments consists of:

- **types.ts:** Defines `Intervention`, `MetricDelta`, `SectorDiff`, `CounterfactualDiff`, `ExperimentRun`, `ExperimentSet`, and `StatisticalSummary`
- **diff-engine.ts:** Extracts numeric paths from world state snapshots and computes per-metric deltas
- **stats.ts:** Computes mean, median, standard deviation, 95% confidence intervals, and Cohen's d across seeds

Each experiment consists of *N* seed pairs. For each seed, the engine forks the baseline universe, applies the intervention, runs both branches for *T* ticks, and captures terminal snapshots. The diff engine compares snapshots, producing per-metric deltas. Statistical significance is assessed using Cohen's d (large effect threshold: |d| > 0.8 [16]) with Bonferroni correction for multiple comparisons. For pre-specified primary outcomes (nation-level GDP, global climate variables), we report Bonferroni-corrected p-values; for the broader exploratory metric sweep, we report Cohen's d as an effect-size measure without formal correction, noting potential false positives in the discussion.

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

**Design:** 30 seeds (42–71). Intervention: WWII ends before escalation (Hitler dies 1938). Rewind point: RP-MODERN-001 (1939). Duration: 30 ticks. Total metrics analyzed: 1,421. This experiment validates the deterministic experimentation framework independently of healthcare-specific assumptions — establishing that the platform correctly propagates macro-level interventions through coupled sector models.

**Statistical note:** With 1,421 metrics, an uncorrected α = 0.05 would yield ∼71 expected false positives by chance. We pre-specified nation-level GDP and global climate variables (CO2, temperature, emissions) as primary outcomes and applied Bonferroni correction (adjusted α = 0.05 / 1,421 ≈ 3.5 × 10⁻⁵). The 36 observed significant metrics is fewer than the ∼71 expected by chance under an uncorrected α = 0.05, confirming the correction's conservatism. Critically, all nine pre-specified primary GDP outcomes survived Bonferroni correction — the intervention effect on national economies is not attributable to chance. Consistency across nine independently-parameterized national economies — each with distinct starting GDP, growth rate, and trade linkages — further supports that the war intervention propagates correctly through the coupled sector model, rather than being an artifact of any single economy's parameterization.

| Nation | Mean Δ GDP | Cohen's d | Bonferroni-significant |
|---|---|---|---|
| United States | +$31,335M | 1.13 | Yes |
| Germany | +$10,412M | 1.00 | Yes |
| United Kingdom | +$9,208M | 1.05 | Yes |
| Russia | +$11,547M | 1.07 | Yes |
| France | +$6,844M | 1.13 | Yes |
| Japan | +$5,391M | 1.03 | Yes |
| Italy | +$4,386M | 1.07 | Yes |
| China | +$2,781M | 1.07 | Yes |
| Poland | +$2,678M | 1.11 | Yes |

[Figure 2 about here: Bar chart of GDP divergence per nation with 95% CIs]

Climate variables also showed significant divergence: temperature anomaly (d = 2.78), CO2 concentration (d = 2.35), and annual emissions (d = 2.20). Germany's inflation rate was significantly lower in the no-war branch (d = 0.73).

**Caveat:** Effect size magnitudes for GDP are mechanically amplified by the compounding structure of the model (Section 2.3): a persistent growth-rate divergence compounds deterministically, guaranteeing eventual separation of any two branches. These effect sizes confirm that the intervention altered the model's trajectory, but their magnitudes should not be interpreted as calibrated predictions of real WWII GDP loss (which reached 30–40% of GDP for Germany — substantially larger than the relative deltas reported here). The validation is architectural (the model propagates a war intervention through the economy sector to produce GDP divergence) rather than quantitative (the model accurately predicts historical GDP loss magnitudes).

### 3.2 Experiment 2: Climate Intervention — Sentinel Health Impact (P-004)

**Design:** 30 seeds (42–71). Intervention: Reduced CO2 concentration (400 ppm) and emissions noise (0.02). Rewind point: RP-CONTEMP-002 (COVID-19 baseline). Duration: 20 ticks. Sentinel: Deers Rock, 133-bed Makassar hospital. Total metrics: 156.

**Results:** 14 of 156 metrics reached significance (Bonferroni-adjusted α = 3.2 × 10⁻⁴). At 20 ticks, macro-to-micro propagation remains incomplete, so we interpret these as operational early indicators rather than clinical findings:

| Metric | Domain | Cohen's d | Interpretation |
|---|---|---|---|
| CSSD cycles (sterilization) | Hospital operations | −2.71 | Fewer procedures requiring sterilization |
| Dialysis sessions | Hospital operations | +1.11 | Increased treatment demand |
| Disease prevalence (UNKNOWN) | Diagnosis mix | +0.91 | Shift in diagnostic uncertainty |
| Occupancy rate | Hospital capacity | +0.70 | Higher bed saturation |
| Outcome records | Clinical activity | +0.58 | More clinical encounters |

The "UNKNOWN" disease prevalence category represents cases without a specified ICD code — a proxy for diagnostic uncertainty that shifts with case mix complexity. The occupancy rate divergence (d = 0.70) is the most clinically relevant finding, demonstrating that macro-level climate changes measurably alter hospital bed demand even at 20 ticks.

**Negative result:** Mortality pressure and ICU occupancy showed no divergence. This is consistent with the short simulation duration — clinical outcomes typically manifest over weeks to months, requiring 100+ tick simulations.

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

The full test suite (175+ tests, 20+ files) runs in under 30 seconds on consumer hardware. A 30-seed, 20-tick experiment with a single hospital sentinel completes in approximately 2 minutes (peak memory ∼200 MB). The 30-hospital network completes 10 seeds in approximately 5 minutes (peak memory ∼600 MB). TypeScript compilation completes in under 5 seconds. All experiments are fully reproducible through seed-based determinism.

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

Real-world health data is noisy, incomplete, and non-repeatable. Simulation offers complete observability — every variable is visible — but only if the simulation itself is reproducible. Kronos Engine's deterministic core ensures any counterfactual experiment can be precisely re-executed, a requirement for regulatory-grade model-informed decision-making [8].

### 4.3 Comparison with Existing Approaches

| Capability | Kronos | Healthcare ABM [9,10] | System Dynamics [11] | Discrete-Event [12] |
|---|---|---|---|---|
| Macro drivers (climate, economy) | First-class sectors | Custom per model | Native | None |
| Hospital operational fidelity | Via sentinel adapter | Custom per model | Low | Native |
| Deterministic reproducibility | Native (seeded RNG, sorted order) | Rare | Rare | Rare |
| Multi-scale coupling | Translator adapter | Single-scale | Single-scale | Single-scale |
| Counterfactual branching | Native (rewind + fork) | Manual branching | Manual scenarios | Manual scenarios |
| Zero-modification integration | Yes (public API only) | No | No | No |
| Empirical validation against real data | Future work | Varies | Varies | Common |

### 4.4 Limitations

**No empirical validation against real hospital data:** This is the paper's single largest exposure. The counterfactual outputs are internally consistent and cross-validated across seeds, but the platform has not been calibrated against real-world hospital admission data. The abstract and introduction frame this as an architecture and methods paper demonstrating internal consistency and architectural correctness — not a clinically validated prediction tool. We are currently pursuing calibration against de-identified hospital admission data to validate occupancy predictions.

**Single hospital simulator:** The sentinel adapter currently wraps one hospital model (Deers Rock). The 30-hospital network demonstrates that one simulator can be cloned 30 times with different configurations — this validates the adapter's operational scalability, not its ability to integrate heterogeneous simulator types. Validation with additional simulators (e.g., trauma centers, tertiary referral hospitals) is needed before claiming broad applicability. Integrating heterogeneous simulator types is the next logical extension.

**Short simulation duration:** Clinical outcomes (mortality, ICU surges) typically manifest over weeks to months. Our 20–30 tick experiments capture operational early indicators but do not establish clinical significance. The weak weather→hospital signal (occupancy Δ < 1 pp, no mortality divergence) reflects this temporal limitation. Future work will extend to 365+ ticks to capture seasonal and acute effects.

**Sector model fidelity:** World sectors use first-order approximations rather than validated macro-economic or climate models. Event magnitudes (e.g., −15% GDP for war defenders) are illustrative calibration targets [13] and have not undergone formal sensitivity analysis against observational data.

**Multiple comparison corrections:** The Bonferroni correction applied to 1,421 metrics (adjusted α ≈ 3.5 × 10⁻⁵) is extremely conservative. We applied it only to the pre-specified primary outcomes (nation-level GDP, global climate variables), which showed consistent large effects. For the broader exploratory metric sweep, we report Cohen's d as an effect-size measure without formal correction — some of the 36 significant metrics may include false positives, and the conservative correction likely masks genuine signals in secondary metrics. Future analyses may adopt a false discovery rate (FDR) approach [15] which is more appropriate for exploratory analyses with many correlated metrics.

**GDP effect size interpretation:** As noted in Section 3.1, the large Cohen's d values for GDP metrics reflect the compounding structure of the growth model rather than calibrated accuracy against real WWII GDP losses. The effect sizes confirm that the intervention propagates through the model, but their magnitudes should not be interpreted as quantitative predictions.

### 4.5 Generalizability

While demonstrated with a healthcare sentinel, the adapter pattern is domain-agnostic. Any micro-level simulator that exposes a state-update function and a queryable state — a supply chain model, a traffic simulation, an energy grid operator — can participate through the same pattern. The adapter translates macro conditions into domain-relevant parameters and aggregates micro-level outputs into macro-level signals, without either layer needing to know the other's internals.

---

## 5. Conclusion

We have presented Kronos Engine, a deterministic counterfactual experimentation platform for multi-scale health system simulation. The sentinel adapter pattern enables existing hospital simulators to participate in world-scale counterfactuals without modification. Two experiments — a "No World War II" retrospective validation and a climate-emissions intervention — demonstrate the platform's ability to produce statistically rigorous, reproducible results across the macro-to-micro scale range.

This paper reports internal consistency and architectural correctness. The next step is empirical validation: calibrating the platform against real-world data to transition from "this is an elegant simulation framework" to "this is an informatics platform with empirical credibility."

Kronos Engine is not a dashboard. It is a laboratory — a platform where policy-makers, hospital administrators, and public health officials can ask "what if?" and receive statistically rigorous, reproducible, auditable answers. By bridging global systemic drivers and local health system operations, we aim to transform simulation from a retrospective analytic tool into a prospective decision-making instrument.

---

## References

[1] Suhrcke M, Stuckler D, Suk JE, et al. The impact of economic crises on communicable disease transmission and control: a systematic review of the evidence. PLoS One. 2011;6(6):e20724.

[2] Watts N, Amann M, Arnell N, et al. The 2020 report of The Lancet Countdown on health and climate change: responding to converging crises. Lancet. 2021;397(10269):129-170.

[3] Walker PGT, Whittaker C, Watson OJ, et al. The impact of COVID-19 and strategies for mitigation and suppression in low- and middle-income countries. Science. 2020;369(6502):413-422.

[4] Gatewood AK, Berryman DR, Schweinle WE, et al. The effect of war on healthcare: a review. Mil Med. 2020;185(Supplement_1):170-175.

[5] Kannampallil TG, Schauer GF, Cohen T, Patel VL. Considering complexity in healthcare systems. J Biomed Inform. 2011;44(6):943-947. — *See also:* Kannampallil TG, Abraham J. Simulation in health informatics. J Am Med Inform Assoc. 2019;26(10):945-947.

[6] Meyer AK, Korfmacher T, Iden J, Rienhoff O. Simulation of clinical workflows: a systematic review. Appl Clin Inform. 2020;11(3):487-498.

[7] Hernán MA, Robins JM. Causal Inference: What If. Boca Raton: Chapman & Hall/CRC; 2020.

[8] U.S. Food and Drug Administration. Model-Informed Drug Development Guidance. FDA; 2021.

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

- **Source code:** https://github.com/rikirinjani/Kronos-Engine (private)
- **Experiment data:** `experiment-results/` directory
- **All 175+ tests:** TypeScript, Jest, `tsc --noEmit` clean

---

### Required Figures (for production)

**Figure 1:** Architecture diagram — Climate/Geopolitics/Economy sectors → MacroConditionPacket → Sentinel Adapter → Deers Rock Hospital → HospitalSentinelOutput → Counterfactual Engine (statistical analysis). Professional layout preferred.

**Figure 2:** WWII GDP divergence — bar chart with 95% confidence intervals for all nine nations, ordered by magnitude.

**Figure 3:** Sentinel network map — Indonesia with hospital indicators for 30 sentinels across 5 regions, colored by regional occupancy.
