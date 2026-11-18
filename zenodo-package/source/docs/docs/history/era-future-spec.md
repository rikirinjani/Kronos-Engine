# Future Era (S-BASELINE) — Schema Specification

**Status:** Draft
**Archivist:** World Archivist
**Purpose:** Define how the engine projects forward from RP-CONTEMP-003 (Baseline 2026).

## Concept

Unlike historical eras which are pre-seeded data packages, the Future era is a **parameterized projection** from the current state. The engine loads RP-CONTEMP-003 and applies trajectory parameters to advance through time.

## Schema

```typescript
interface FutureEraConfig {
  label: string;                        // "SSP1 Sustainability", "SSP3 Rivalry", etc.
  scenario: "baseline" | "optimistic" | "pessimistic";

  // Time horizon
  startYear: number;                    // 2026
  endYear: number;                      // 2050, 2100
  tickScale: "year" | "decade";         // how fast the clock moves

  // Per-nation projections (override + fallback to defaults)
  population: PopulationProjection;
  economy: EconomyProjection;
  technology: TechnologyProjection;
  climate: ClimateProjection;
  geopolitics: GeopoliticsProjection;
  health: HealthProjection;
  energy: EnergyProjection;
}

interface PopulationProjection {
  model: "un-median" | "un-low" | "un-high" | "constant";
  // Per-nation override: { "IDN": { growthRate: 0.5 }, "JPN": { growthRate: -0.3 } }
  overrides?: Record<string, { growthRate: number; fertilityRate?: number }>;
  globalGrowthRate?: number;            // fallback if no per-nation data
}

interface EconomyProjection {
  convergenceModel: "beta" | "gini" | "constant";
  // Beta convergence: poorer nations grow faster toward steady-state
  convergenceRate: number;              // 0.02 = 2% per year closing
  steadyStateGrowth: number;            // 1.5% per year for developed
  productivityMultiplier: number;       // AI/automation boost
  tradeLiberalization: number;          // -0.05 to +0.05 per tick
}

interface TechnologyProjection {
  adoptionCurve: "s-curve" | "linear" | "step";
  // S-curve params: midpoint year, steepness
  aiAdoption: { midpoint: number; steepness: number };
  biotechAdoption: { midpoint: number; steepness: number };
  cleanEnergyAdoption: { midpoint: number; steepness: number };
  rdSpendingGrowth: number;            // annual % change in R&D intensity
}

interface ClimateProjection {
  // SSP pathways mapped to CO2 trajectories
  sspScenario: "SSP1-1.9" | "SSP2-4.5" | "SSP3-7.0" | "SSP5-8.5";
  // Annual emission change (Gt/yr)
  emissionTrend: number;               // -0.5 = declining 0.5 Gt/yr
  // Climate sensitivity (C per doubling CO2)
  climateSensitivity: number;          // 3.0 default
  // Extreme weather frequency multiplier
  extremeWeatherMultiplier: number;    // 1.0 = current, 1.5 = 50% more
}

interface GeopoliticsProjection {
  allianceDecayRate: number;           // probability per tick of alliance weakening
  conflictProbability: number;         // baseline probability of new war per tick
  relationsDriftRate: number;          // how fast relations random-walk
  unipolarDecay: number;               // US dominance decline rate
  regionalBlocStrength: number;        // rise of regional blocs
}

interface HealthProjection {
  lifeExpectancyConvergence: number;   // gap closes by X years per decade
  pandemicFrequency: number;           // expected major pandemics per century
  pandemicSeverity: number;            // mortality multiplier
  universalCoverageSpread: number;     // rate of healthcare expansion
}

interface EnergyProjection {
  renewableAdoptionRate: number;       // % of energy mix per decade
  fossilFuelDeclineRate: number;
  energyIntensityDecline: number;      // % per year
  carbonPrice: number;                 // USD/ton, affects economy
}
```

## Default Configurations

Three scenario variants are provided in `era-future-defaults.json`:

| Scenario | Label | Population | Climate | Economy | Geopolitics |
|----------|-------|------------|---------|---------|-------------|
| baseline | Middle Road | UN medium | SSP2-4.5 | 2% convergence | Status quo drift |
| optimistic | Green Tech Boom | UN low | SSP1-1.9 | 3% + AI boost | Cooperative |
| pessimistic | Fragmentation | UN high | SSP3-7.0 | 1% stagnant | Conflict-prone |

## Integration with Era Loader

The `era-loader.ts` currently hardcodes era-specific defaults via functions like `gdpGrowthRateFor(year)`. For the Future era:

1. `buildSectorConfigs()` would detect `era === "future"` and check for a `FutureEraConfig` attached to the state
2. If present, it uses the config's parameters instead of the hardcoded `gdpGrowthRateFor()` etc.
3. If absent, it falls back to the baseline defaults

Example flow:
```
loadEraConfig("era-future-defaults.json", "RP-FUTURE-001")
  → detects era === "future"
  → loads RP-CONTEMP-003 as base state
  → applies FutureEraConfig parameters to sector configs
  → returns configured sectors ready for createWorld()
```

## File Locations

| File | Purpose |
|------|---------|
| `docs/history/era-future-spec.md` | This document — schema design |
| `docs/history/era-future-defaults.json` | Default configs for 3 scenarios |
| `src/timeline/future-types.ts` | TypeScript types (copy of schema above) |
| `src/engine/era-loader.ts` | Updated to handle `era === "future"` |
