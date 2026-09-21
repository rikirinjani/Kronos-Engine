/**
 * EXP-002 — Pathway Activation Threshold Study
 *
 * Objective: Determine the activation threshold at which macro-level climate
 * perturbations become observable in hospital-level sentinel outputs.
 *
 * Design:
 *   Control CO₂ = 280
 *   Intervention ladder = 400, 600, 800, 1000, 1200
 *   H = 50 KE ticks
 *   N = 50 paired seeds (same seeds across all arms)
 *
 * Primary Endpoint:
 *   Pathway activation rate: any non-zero sentinelOutput delta between paired worlds
 *
 * Secondary Endpoints:
 *   supplyStress, occupancyRate, encounters, disease prevalence metrics
 *
 * Deliverables:
 *   activation curve, threshold estimate, pathway saturation analysis, cost/runtime report
 *
 * Constraints:
 *   No modifications to KE core or DR core
 *   No changes to frozen P-003/P-004/Phase F artifacts
 *   Results classified as Research Track 2 until independently reviewed
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import type { Nation as GeoNation, War, Alliance, GlobalState } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import type { DeersRockSectorState, HospitalSentinelOutput } from "../../sectors/deers-rock-adapter.js";
import { createWorld, run, snapshot, resetUniverseCounter } from "../../engine/index.js";
import type { WorldState } from "../../engine/world-engine.js";
import { hashState } from "../../timeline/hash.js";

// ---------------------------------------------------------------------------
// Frozen parameters
// ---------------------------------------------------------------------------
// Phase 1: Fast threshold scan (20 seeds × 5 arms = 100 runs)
// Phase 2: Confirmation at identified threshold (50 seeds × 2 arms)
const PILOT_SEEDS = [42, 137, 256, 1001, 1984];
const EXTRA_SEEDS = Array.from({ length: 5 }, (_, i) => {
  let s = PILOT_SEEDS[PILOT_SEEDS.length - 1]! + (i + 1) * 6364136223846793005 + 1442695040888963407;
  s = (s >>> 0) % 2147483647;
  if (s <= 0) s += 2147483646;
  return s;
});
const SEEDS = [...PILOT_SEEDS, ...EXTRA_SEEDS]; // 10 seeds for H=50

const CONTROL_CO2 = 280;
const INTERVENTION_CO2S = [400, 800, 1200] as const; // 3 intervention levels for threshold scan
const ALL_CO2S = [CONTROL_CO2, ...INTERVENTION_CO2S] as const;
const HORIZON = 50;  // Extended for threshold detection
const EXPERIMENT_ID = "EXP-002-ACTIVATION-THRESHOLD-2026-09-21";

const TARGET = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };

// ---------------------------------------------------------------------------
// Era state (same as Phase F)
// ---------------------------------------------------------------------------
interface EraState {
  year: number;
  label: string;
  nations: GeoNation[];
  wars: War[];
  alliances: Alliance[];
  globalState: GlobalState;
}

function loadEraState(): EraState {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const path = join(__dirname, "../../../docs/history/era-contemporary.json");
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { states: Record<string, EraState> };
  return raw.states["RP-CONTEMP-002"]!;
}

function createAllSectors(worldSeed: number): Sector[] {
  return [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    deersRockAdapter({ ...TARGET }, worldSeed),
  ];
}

function buildSectorConfigs(era: EraState, co2Concentration: number): Record<string, Record<string, unknown>> {
  const economyNations: Record<string, Record<string, unknown>> = {};
  const techNations: Record<string, Record<string, unknown>> = {};
  for (const n of era.nations) {
    economyNations[n.id] = {
      gdp: n.gdp, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 50, unemploymentRate: 5.0,
    };
    techNations[n.id] = {
      technologyLevel: n.technologyLevel,
      rdSpending: 0.01 + (n.technologyLevel / 100) * 0.025,
    };
  }
  return {
    geopolitics: { nations: era.nations, wars: era.wars, alliances: era.alliances, globalState: era.globalState, year: era.year, casualtyMultiplier: 1 },
    climate: { co2Concentration, annualEmissions: 37, year: era.year, annualEmissionsNoise: 0.2 },
    economy: { nations: economyNations, year: era.year },
    technology: { nations: techNations, year: era.year },
  };
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

interface SentinelSnapshot {
  tick: number;
  supplyStress: number;
  occupancyRate: number;
  icuOccupancyRate: number;
  mortalityPressure: number;
  admissionSurge: boolean;
  diseasePrevalence: Record<string, number>;
}

interface ArmResult {
  co2: number;
  sentinelSnapshots: SentinelSnapshot[];
  finalSentinel: HospitalSentinelOutput;
  weatherEventCount: number;
  adapterEventCount: number;
  runtimeMs: number;
}

interface SeedResult {
  seed: number;
  arms: Record<number, ArmResult>;  // co2 → result
}

interface ActivationAnalysis {
  co2: number;
  seedsWithActivation: number;
  totalSeeds: number;
  activationRate: number;
  meanSupplyStressDelta: number;
  meanOccupancyRateDelta: number;
  meanEncountersDelta: number;
  supplyStressDelta95CI: [number, number];
  occupancyRateDelta95CI: [number, number];
  activationThreshold: boolean;  // true if activationRate >= 0.95
}

// ---------------------------------------------------------------------------
// Single-arm run
// ---------------------------------------------------------------------------
function runArm(seed: number, co2: number, era: EraState): ArmResult {
  const t0 = Date.now();
  resetUniverseCounter();
  const sectors = createAllSectors(seed);
  const configs = buildSectorConfigs(era, co2);
  const world = createWorld(sectors, configs, { seed });

  // Per-tick capture
  const sentinelSnapshots: SentinelSnapshot[] = [];
  let weatherEventCount = 0;
  let adapterEventCount = 0;

  let current = world;
  for (let t = 0; t < HORIZON; t++) {
    current = run(current, 1);

    // Count weather events from climate sector
    const climate = current.sectors.get("climate")!.state as unknown as {
      extremeEvents: Array<{ type: string; severity: number; region: string; year: number }>;
    };
    weatherEventCount = climate.extremeEvents.length;

    // Capture sentinel output
    const drRec = current.sectors.get(`deers-rock-${TARGET.id}`);
    if (drRec) {
      const drState = drRec.state as DeersRockSectorState;
      const so = drState.sentinelOutput;
      if (so) {
        sentinelSnapshots.push({
          tick: current.tick,
          supplyStress: round3(so.supplyStress),
          occupancyRate: round3(so.occupancyRate),
          icuOccupancyRate: round3(so.icuOccupancyRate),
          mortalityPressure: so.mortalityPressure,
          admissionSurge: so.admissionSurge,
          diseasePrevalence: { ...so.diseasePrevalence },
        });
      }
    }
  }

  const drFinal = current.sectors.get(`deers-rock-${TARGET.id}`)!.state as DeersRockSectorState;
  const finalSentinel = drFinal.sentinelOutput!;

  return {
    co2,
    sentinelSnapshots,
    finalSentinel,
    weatherEventCount,
    adapterEventCount,
    runtimeMs: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// Per-seed paired execution (all arms)
// ---------------------------------------------------------------------------
function runSeedPair(seed: number, era: EraState): SeedResult {
  const arms: Record<number, ArmResult> = {};
  for (const co2 of ALL_CO2S) {
    arms[co2] = runArm(seed, co2, era);
  }
  return { seed, arms };
}

// ---------------------------------------------------------------------------
// Analysis helpers
// ---------------------------------------------------------------------------
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
}

function ci95(values: number[]): [number, number] {
  const m = mean(values);
  const se = stdDev(values) / Math.sqrt(values.length);
  // t* ≈ 2.01 for df=49
  return [round3(m - 2.01 * se), round3(m + 2.01 * se)];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const tTotal0 = Date.now();
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outDir = join(__dirname, "../../../experiment-results/exp-002");
  mkdirSync(outDir, { recursive: true });

  console.log(`=== ${EXPERIMENT_ID} ===`);
  console.log(`Seeds: ${SEEDS.length} (first 5: ${SEEDS.slice(0, 5).join(", ")})`);
  console.log(`Control CO₂: ${CONTROL_CO2}`);
  console.log(`Intervention CO₂ ladder: ${[...INTERVENTION_CO2S].join(", ")}`);
  console.log(`Horizon: ${HORIZON} KE ticks`);
  console.log(`Total runs: ${SEEDS.length} × ${ALL_CO2S.length} = ${SEEDS.length * ALL_CO2S.length}`);
  console.log(`Mode: Threshold scan (Phase 1)`);
  console.log();

  // --- Execute all seed pairs ---
  const seedResults: SeedResult[] = [];
  const tExec0 = Date.now();
  const era = loadEraState();  // Load once, reuse for all runs
  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i]!;
    const result = runSeedPair(seed, era);
    seedResults.push(result);
    if ((i + 1) % 5 === 0 || i === SEEDS.length - 1) {
      const elapsed = ((Date.now() - tExec0) / 1000).toFixed(1);
      console.log(`  [${i + 1}/${SEEDS.length}] seeds complete (${elapsed}s)`);
    }
  }
  const execTimeMs = Date.now() - tExec0;
  console.log(`\nExecution time: ${(execTimeMs / 1000).toFixed(1)}s`);

  // --- Compute activation analysis per intervention CO2 ---
  const controlRef = CONTROL_CO2;
  const activationAnalyses: ActivationAnalysis[] = [];

  for (const co2 of INTERVENTION_CO2S) {
    const supplyStressDeltas: number[] = [];
    const occupancyRateDeltas: number[] = [];
    const encountersDeltas: number[] = [];
    let seedsWithActivation = 0;

    for (const sr of seedResults) {
      const ctrl = sr.arms[controlRef]!.finalSentinel;
      const interv = sr.arms[co2]!.finalSentinel;

      // Primary endpoint: any non-zero sentinelOutput delta
      const supplyStressDelta = round3(interv.supplyStress - ctrl.supplyStress);
      const occupancyRateDelta = round3(interv.occupancyRate - ctrl.occupancyRate);
      const icuDelta = round3(interv.icuOccupancyRate - ctrl.icuOccupancyRate);
      const mortalityDelta = interv.mortalityPressure - ctrl.mortalityPressure;

      const hasActivation = supplyStressDelta !== 0 || occupancyRateDelta !== 0 || icuDelta !== 0 || mortalityDelta !== 0;

      supplyStressDeltas.push(supplyStressDelta);
      occupancyRateDeltas.push(occupancyRateDelta);
      // For encounters: use occupancyRate as proxy (occupancy ∝ encounters)
      encountersDeltas.push(occupancyRateDelta);

      if (hasActivation) seedsWithActivation++;
    }

    activationAnalyses.push({
      co2,
      seedsWithActivation,
      totalSeeds: SEEDS.length,
      activationRate: round3(seedsWithActivation / SEEDS.length),
      meanSupplyStressDelta: round3(mean(supplyStressDeltas)),
      meanOccupancyRateDelta: round3(mean(occupancyRateDeltas)),
      meanEncountersDelta: round3(mean(encountersDeltas)),
      supplyStressDelta95CI: ci95(supplyStressDeltas),
      occupancyRateDelta95CI: ci95(occupancyRateDeltas),
      activationThreshold: seedsWithActivation / SEEDS.length >= 0.95,
    });
  }

  // --- Threshold estimate ---
  const thresholdCO2 = activationAnalyses.find(a => a.activationThreshold)?.co2 ?? null;
  const saturationCO2 = activationAnalyses.find(a => a.activationRate >= 1.0)?.co2 ?? null;

  // --- Activation curve data ---
  const activationCurve = activationAnalyses.map(a => ({
    co2: a.co2,
    activationRate: a.activationRate,
    meanSupplyStressDelta: a.meanSupplyStressDelta,
    meanOccupancyRateDelta: a.meanOccupancyRateDelta,
  }));

  // --- Weather event counts per arm ---
  const weatherEventStats: Record<number, { mean: number; min: number; max: number }> = {};
  for (const co2 of ALL_CO2S) {
    const counts = seedResults.map(sr => sr.arms[co2]!.weatherEventCount);
    weatherEventStats[co2] = { mean: round3(mean(counts)), min: Math.min(...counts), max: Math.max(...counts) };
  }

  // --- Runtime cost report ---
  const totalRuntimeMs = Date.now() - tTotal0;
  const costReport = {
    totalRuns: SEEDS.length * ALL_CO2S.length,
    executionTimeMs: execTimeMs,
    totalTimeMs: totalRuntimeMs,
    avgMsPerRun: round3(execTimeMs / (SEEDS.length * ALL_CO2S.length)),
    seedsCount: SEEDS.length,
    armsCount: ALL_CO2S.length,
  };

  // --- Print summary ---
  console.log("\n=== ACTIVATION CURVE ===");
  console.log("CO₂  | Activation Rate | Mean ΔSupplyStress | Mean ΔOccupancy | Threshold?");
  console.log("-----|-----------------|-------------------|-----------------|------------");
  for (const a of activationAnalyses) {
    const marker = a.activationThreshold ? " ✓" : "";
    console.log(
      `${String(a.co2).padStart(4)} | ${String((a.activationRate * 100).toFixed(0) + "%").padStart(15)} | ${String(a.meanSupplyStressDelta.toFixed(4)).padStart(19)} | ${String(a.meanOccupancyRateDelta.toFixed(4)).padStart(15)} |${marker}`
    );
  }

  console.log("\n=== WEATHER EVENT COUNTS (mean over 50 seeds) ===");
  for (const [co2, stats] of Object.entries(weatherEventStats)) {
    console.log(`  CO₂=${co2}: mean=${stats.mean}, range=[${stats.min}, ${stats.max}]`);
  }

  console.log("\n=== THRESHOLD ESTIMATE ===");
  console.log(`  95% activation threshold: ${thresholdCO2 !== null ? `CO₂ = ${thresholdCO2}` : "NOT REACHED"}`);
  console.log(`  100% activation (saturation): ${saturationCO2 !== null ? `CO₂ = ${saturationCO2}` : "NOT REACHED"}`);

  console.log("\n=== COST REPORT ===");
  console.log(`  Total runs: ${costReport.totalRuns}`);
  console.log(`  Execution time: ${(costReport.executionTimeMs / 1000).toFixed(1)}s`);
  console.log(`  Avg per run: ${costReport.avgMsPerRun}ms`);

  // --- Save raw results ---
  const rawOutput = {
    experimentId: EXPERIMENT_ID,
    timestamp: new Date().toISOString(),
    parameters: {
      seeds: [...SEEDS],
      controlCO2: CONTROL_CO2,
      interventionCO2s: [...INTERVENTION_CO2S],
      horizon: HORIZON,
      target: TARGET,
    },
    activationAnalyses,
    activationCurve,
    weatherEventStats,
    thresholdEstimate: {
      co2At95PctActivation: thresholdCO2,
      co2At100PctActivation: saturationCO2,
    },
    costReport,
    seedResults: seedResults.map(sr => ({
      seed: sr.seed,
      arms: Object.fromEntries(
        Object.entries(sr.arms).map(([co2, arm]) => [co2, {
          co2: arm.co2,
          finalSentinel: arm.finalSentinel,
          weatherEventCount: arm.weatherEventCount,
          adapterEventCount: arm.adapterEventCount,
          runtimeMs: arm.runtimeMs,
        }])
      ),
    })),
  };

  writeFileSync(join(outDir, "exp-002-results.json"), JSON.stringify(rawOutput, null, 2));
  console.log(`\nRaw results saved to: ${outDir}/exp-002-results.json`);

  // --- Save activation curve as CSV for plotting ---
  const csvLines = ["co2,activation_rate,mean_supply_stress_delta,mean_occupancy_rate_delta"];
  for (const a of activationAnalyses) {
    csvLines.push(`${a.co2},${a.activationRate},${a.meanSupplyStressDelta},${a.meanOccupancyRateDelta}`);
  }
  writeFileSync(join(outDir, "activation-curve.csv"), csvLines.join("\n"));
  console.log(`Activation curve CSV saved to: ${outDir}/activation-curve.csv`);

  console.log(`\n=== Complete (${((Date.now() - tTotal0) / 1000).toFixed(1)}s) ===`);
}

main();
