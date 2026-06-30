# Kronos Engine — Project Overview

**A deterministic, multi-scale world simulator with pluggable sectors, seeded universes, Rewind Points, and counterfactual branching. Deers Rock HOE serves as the healthcare sentinel — a standalone hospital participating in a larger world without knowing it exists.**

*Philosophy: Simulation as Self-Critique. Counterfactuals by Construction. Every seed is a history — every snapshot is a choice.*

---

## Architecture

```
CHRONOS ENGINE (macro, 1 tick = 1 day)
    ↓ macro conditions (MacroConditionPacket)
ADAPTER LAYER (translation, scale bridge)
    ↓ admission modifiers, diagnosis weights
DEERS ROCK (micro, 1 tick = 1 minute) [x30 sentinels]
    ↑ pressure signals (HospitalSentinelOutput)
ADAPTER LAYER (aggregation, signal extraction)
    ↑ occupancy, mortality, disease prevalence
CHRONOS ENGINE (reads as regional sentinel output)
```

### Core invariant
**"The world does not reach into the hospital. It knocks on the adapter's door and waits for the signal."**

---

## Phase 0 — Foundation

### Engine Layer (Timeline Governor)

| Component | What | File |
|---|---|---|
| Seeded RNG | mulberry32 PRNG with call count tracking for deterministic replay | `src/engine/rng.ts` |
| UniverseID | `U-YYYY-NNNN` genealogy with parent tracking, intervention labels | `src/engine/universe.ts` |
| World Engine | `createWorld()`, `tick()`, `run()`, `snapshot()`, `restoreSnapshot()` with cross-sector event processing | `src/engine/world-engine.ts` |
| Rewind Points | Pre-seeded historical moments and runtime snapshots with FNV-1a integrity hashing | `src/timeline/rewind-point.ts` |
| Branch Engine | `forkBranch()` with intervention patching, parent tracking, CounterfactualDiff output | `src/timeline/branch.ts` |
| Era Loader | `buildSectorConfigs()` maps StrategicWorldState → sector configs. `loadEraConfig()` reads era JSON from disk | `src/engine/era-loader.ts` |

### Sector Layer (Sector Engineer)

**6 world sectors + 1 sentinel = 7 total**

| Sector | State | Key events | Connects to |
|---|---|---|---|
| **Geopolitics** | Nations, relations, wars, alliances, casualties | `war_start`, `war_end`, `war_casualties`, `relation_shift` | Economy (GDP hit), Energy (prices), Demographics (deaths) |
| **Climate** | CO2 concentration, temperature anomaly, annual emissions, extreme weather, sea level | `temp_shift`, `extreme_weather`, `emissions_change` | Economy (GDP hit), Energy (price spike), Health (admissions) |
| **Economy** | Per-nation GDP, growth rate, inflation, trade, unemployment, market index | `gdp_shift`, `inflation_change`, `trade_shift` | All sectors via GDP signal |
| **Technology** | R&D spending, research output, innovation count, patents, tech diffusion | `innovation`, `diffusion` | Energy (renewable breakthrough), Economy (productivity) |
| **Energy** | Energy mix (oil/gas/coal/nuclear/renewable), consumption, price, security, CO2 intensity | `price_shift`, `mix_shift`, `supply_shock` | Climate (emissions), Economy (price), Geopolitics (security) |
| **Demographics** | Population, birth/death rates, median age, dependency ratio, labor force, migration | `population_shift`, `aging_shift`, `labor_force_change`, `migration` | Economy (labor), Health (demand), Geopolitics (war deaths) |
| **Deers Rock** (sentinel) | 133-bed Tier A hospital in Makassar. Patients, encounters, diagnoses, medications, labs, surgery, agents | Controlled by Scenario Engine + adapter macro injection | Reports occupancy, mortality, disease prevalence back to world |

### Historical Data Layer (World Archivist)

| Era | Span | Rewind Points |
|---|---|---|
| Ancient | ~3000 BCE – 500 CE | Fall of Rome (476) |
| Medieval | 500–1500 | Black Death (1347), Fall of Constantinople (1453) |
| Early Modern | 1500–1800 | Columbus (1492), French Revolution (1789) |
| Industrial | 1800–1914 | Congress of Vienna (1815), WWI trigger (1914) |
| Modern | 1914–1991 | WWII (1939), Moon Landing (1969), Fall of USSR (1991) |
| Contemporary | 1991–present | 9/11 (2001), COVID-19 (2020), Baseline 2026 |

Each era is a `StrategicWorldState` JSON package containing nations with GDP, population, government type, technology level, health metrics, wars, alliances, and diplomatic relations. Cross-reference validated across all 14 Rewind Points.

### Sentinel Adapter (P-002)

The adapter is the architectural centerpiece:

```typescript
interface HospitalSentinelOutput {
  occupancyRate: number;        // 0-1
  icuOccupancyRate: number;     // 0-1
  mortalityPressure: number;    // deaths this period
  diseasePrevalence: Record<string, number>;  // top ICD codes
  supplyStress: number;         // 0-1
  staffStress: number;          // 0-1
  admissionSurge: boolean;      // above baseline threshold
}

interface MacroConditionPacket {
  admissionMultiplier: number;
  diagnosisWeightOverrides: Record<string, number>;
  supplyChainPressure: number;
  staffAvailabilityModifier: number;
  activeDisasterType?: string;
}
```

**Seed derivation:** `worldSeed ^ (hospitalId * 2654435761) >>> 0` — each sentinel gets a deterministic seed from the world seed.

**Temporal aggregation:** 1 World tick = 1440 Deers Rock ticks (1 day). Adapter runs `fastForward(days)` loop, publishes aggregated daily stats.

**Boundary violations (never do):**
- Import DR internals into KE
- Let KE read individual patient records
- Let DR read GDP, war status, or climate variables directly
- Share RNG between world and hospital ticks
- Let one sentinel know another's output
- Use wall clock instead of seeded tick

### Counterfactual Pipeline (Branch Analyst)

| Component | What |
|---|---|
| `types.ts` | `Intervention`, `MetricDelta`, `SectorDiff`, `CounterfactualDiff`, `ExperimentRun`, `ExperimentSet`, `StatisticalSummary` |
| `diff-engine.ts` | Numeric path extraction, metric deltas, event counting, multi-sector diff builder |
| `stats.ts` | Mean, median, SD, 95% CI, Cohen's d, multi-seed summary |

### Agent System (Meta Platform)

5 OMO agents configured in `oh-my-opencode-slim.json`:

| Agent | Model | Role |
|---|---|---|
| `@meta-platform` | DeepSeek V4 Flash | Superset — spans all domains |
| `@world-archivist` | DeepSeek V4 Flash | Historical data, era packages |
| `@sector-engineer` | DeepSeek V4 Flash | Sector implementation, DR adapter |
| `@branch-analyst` | DeepSeek V4 Flash | Counterfactual experiments, stats |
| `@timeline-governor` | DeepSeek V4 Flash | Universe, RNG, branch engine |

Coordination through `HANDOFF.md` (filesystem as bus, distributed via git). Self-harness governance at `self-harness/` with mandatory trace recording.

---

## Phase 1 — Calibration

### 1.1 Sensitivity Sweep
3/5/10/20 seeds tested across all 6 sectors. Economy most reliable signal. Climate weakest (CO2 drift overwhelmed intervention). Key finding: calibration needed before more seeds.

### 1.2 Model Calibration (4 gaps closed)

| Gap | Problem | Fix |
|---|---|---|
| A: War casualties | 1K vs 75M real deaths — 75,000x gap | Configurable `casualtyMultiplier` (default 1, ~2,500 for WWII) |
| B: War→GDP sign | Net-positive GDP with war (growth outranks 5% hit) | Split attacker/defender: attacker +3% GDP, defender -15% GDP |
| C: Climate CO2 noise | ±1 Gt/yr noise swamps 0.5 Gt/yr signal | Noise reduced 10x, configurable via `annualEmissionsNoise` |
| D: Economy wars[] init | `wars: []` regardless of config — war_casualties handler silently skipped GDP drain | Removed wars[] filter — drain already scales by GDP |

### 1.3 Statistical Power
30 seeds proven in P-003 re-run. `runExperiment()` supports arbitrary seeds with CI/SD/Cohen's d.

### 1.4 DR Sentinel Counterfactual (P-004)
COVID-19 era (RP-CONTEMP-002), 30 seeds, 20 ticks. **14/156 metrics significant.** DR pipeline verified end-to-end:

| Signal | Cohen's d | Meaning |
|---|---|---|
| CSSD cycles | -2.71 | Sterilization cycles diverged — operational proxy |
| Disease prevalence (UNKNOWN) | +0.91 | Diagnosis mix shifted |
| Occupancy rate | +0.70 | Bed saturation changed |
| Dialysis sessions | +1.11 | Treatment demand shifted |
| Outcome records | +0.58 | Clinical activity diverged |

---

## Phase 2 — Scale & Publication (Next)

### 2.1 Sentinel Network
Scale from 1 to 30+ Deers Rock sentinels across Indonesian cities. Each gets derived seed, local config, independent operation. KE sees a regional health pressure heatmap. DR never knows other hospitals exist.

### 2.2 Paper 1 (JAMIA)
*Target: Journal of the American Medical Informatics Association*

**Framing:** *"Retrospective validation. Prospective application."*

Contributions:
1. **Architecture** — deterministic multi-scale engine with sentinel adapter pattern
2. **Cross-sector feedback loop** — Climate → Economy → Health verified in integration test
3. **Sentinel paradigm** — standalone hospital participating in world simulation without code changes
4. **Counterfactual validation** — WWII GDP impact reproduced across all 9 nations (d > 1.0)
5. **Prospective application** — policy stress-testing, hospital investment, early warning

### 2.3 CI/CD
GitHub Actions, Dockerfile (multi-stage, node:24-alpine), Railway config. Delivered.

---

## Phase 3 — Product (Counterfactual Query Engine)

**Not a dashboard. A laboratory.** Ask "what if?" and get sector-level diffs with statistical confidence.

| Niche | Question | Output |
|---|---|---|
| Policy stress-test | "Add 50 beds per province under +2°C + recession + pandemic?" | Ensemble distribution across 1000 branches |
| Hospital investment | "Build 300-bed hospital in Jayapura?" | ROI curve comparing with/without branch |
| Pre-mortem | "Which hospital failure causes most damage?" | Ranked vulnerability map |

---

## Proposals Index

| # | Title | Status |
|---|---|---|
| P-001 | World Simulator Meta Platform | Approved |
| P-001A | Seed, Universe, Rewind Point Spec | Approved |
| P-001B | Meta Platform Sub-Agent Design | Approved |
| P-002 | Deers Rock Sentinel Adapter | Approved |
| P-003 | Counterfactual Experiment "No WWII" | Completed |

---

## Key Metrics

| Metric | Value |
|---|---|
| Total tests | 175+ |
| Test files | 20+ |
| World sectors | 6 |
| Sentinels | 1 (scaling to 30+) |
| Historical eras | 6 |
| Rewind Points | 14 |
| GitHub | `https://github.com/rikirinjani/Kronos-Engine` (private) |
| Self-harness traces | 17 |
| Self-harness failures | 4 |
| Agent count | 5 |

---

*One engine, infinite timelines. Every seed is a history — every snapshot is a choice.*

*— The wall, Kronos Engine HQ*
