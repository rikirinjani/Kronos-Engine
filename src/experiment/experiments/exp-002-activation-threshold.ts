/**
 * EXP-002 — Pathway Activation Threshold Study (v2, RNG-clean)
 *
 * v2 FIX: Each arm creates a FRESH world with independent RNG via
 * createWorld(). The v1 runner was correct in structure but lacked:
 *   (a) adapter event wrapper → adapterEventCount was always 0
 *   (b) climate tick recording → no causal trace
 *   (c) weather event recording → no per-tick event diffing
 *   (d) isolation checks → no verification of what changed
 *   (e) reproducibility check → no hash comparison
 *
 * Design (unchanged):
 *   Control CO₂ = 280
 *   Intervention ladder = 400, 800, 1200
 *   H = 50 KE ticks
 *   N = 10 paired seeds (same seeds across all arms)
 *
 * Primary Endpoint:
 *   Pathway activation rate: any non-zero sentinelOutput delta between paired worlds
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
const PILOT_SEEDS = [42, 137, 256, 1001, 1984];
const EXTRA_SEEDS = Array.from({ length: 5 }, (_, i) => {
  let s = PILOT_SEEDS[PILOT_SEEDS.length - 1]! + (i + 1) * 6364136223846793005 + 1442695040888963407;
  s = (s >>> 0) % 2147483647;
  if (s <= 0) s += 2147483646;
  return s;
});
const SEEDS = [...PILOT_SEEDS, ...EXTRA_SEEDS]; // 10 seeds

const CONTROL_CO2 = 280;
const INTERVENTION_CO2S = [400, 800, 1200] as const;
const ALL_CO2S = [CONTROL_CO2, ...INTERVENTION_CO2S] as const;
const HORIZON = 50;
const EXPERIMENT_ID = "EXP-002-ACTIVATION-THRESHOLD-V2-2026-09-21";

const TARGET = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };

// ---------------------------------------------------------------------------
// Era state
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

interface ClimateTick {
  tick: number;
  co2: number;
  temperatureAnomaly: number;
  eventChance: number;
}

interface WeatherEventRecord {
  tick: number;
  weatherType: string;
  severity: number;
  region: string;
}

interface AdapterEventRecord {
  keTick: number;
  drEventType: string;
  data: Record<string, unknown>;
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
  climateTicks: ClimateTick[];
  weatherEvents: WeatherEventRecord[];
  adapterEvents: AdapterEventRecord[];
  sentinelSnapshots: SentinelSnapshot[];
  finalSentinel: HospitalSentinelOutput;
  finalWorldHash: string;
  sectorHashes: Record<string, string>;
  rngStateHash: string;
  runtimeMs: number;
}

interface SeedResult {
  seed: number;
  arms: Record<number, ArmResult>;
  isolation: {
    keRngIdentical: boolean;
    nonDrSectors: Record<string, { identical: boolean; documentedSubscriber: boolean }>;
  };
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
  activationThreshold: boolean;
}

const DOCUMENTED_WEATHER_SUBSCRIBERS = new Set(["economy", "geopolitics"]);

// ---------------------------------------------------------------------------
// Single-arm run (fresh world, independent RNG)
// ---------------------------------------------------------------------------
function runArm(seed: number, co2: number): ArmResult {
  const t0 = Date.now();
  resetUniverseCounter();
  // EXP-002 v2 fix: load era state FRESH per arm. buildSectorConfigs injects
  // era.nations/wars/alliances/globalState by reference, and the geopolitics
  // sector mutates them in place. Reusing one parsed object across arms/runs
  // leaks mutated state forward and breaks reproducibility (same aliasing class
  // as EXP-001E). Phase F loads inside runArm for exactly this reason.
  const era = loadEraState();
  const sectors = createAllSectors(seed);
  const configs = buildSectorConfigs(era, co2);
  const world = createWorld(sectors, configs, { seed });

  // --- Adapter event wrapper: capture DR queue.schedule calls ---
  const adapterEvents: AdapterEventRecord[] = [];
  for (const rec of world.sectors.values()) {
    if (!rec.sector.id.startsWith("deers-rock-")) continue;
    const s = rec.state as DeersRockSectorState;
    const origSchedule = s.world.queue.schedule.bind(s.world.queue);
    (s.world.queue as unknown as { schedule: typeof origSchedule }).schedule =
      (type: string, delayTicks: number, data: Record<string, unknown> = {}) => {
        const evt = origSchedule(type, delayTicks, data);
        if (["admission_surge", "supply_chain_pressure", "active_disaster", "staff_shortage"].includes(type)) {
          adapterEvents.push({ keTick: world.tick + 1, drEventType: type, data: { ...data } });
        }
        return evt;
      };
  }

  // --- Per-tick capture ---
  const climateTicks: ClimateTick[] = [];
  const weatherEvents: WeatherEventRecord[] = [];
  const sentinelSnapshots: SentinelSnapshot[] = [];

  let current = world;
  for (let t = 0; t < HORIZON; t++) {
    current = run(current, 1);
    const keTick = current.tick;

    // Link 1: climate state
    const climate = current.sectors.get("climate")!.state as unknown as {
      co2Concentration: number;
      temperatureAnomaly: number;
      extremeEvents: Array<{ type: string; severity: number; region: string; year: number }>;
    };
    const eventChance = Math.max(0.05, Math.min(0.5, 0.1 + (climate.temperatureAnomaly - 1.2) * 0.05));
    climateTicks.push({
      tick: keTick,
      co2: round3(climate.co2Concentration),
      temperatureAnomaly: round3(climate.temperatureAnomaly),
      eventChance: round3(eventChance),
    });

    // Link 2: new EXTREME_WEATHER events this tick
    const alreadyRecorded = weatherEvents.length;
    const allEvents = climate.extremeEvents;
    if (allEvents.length > alreadyRecorded) {
      for (let i = alreadyRecorded; i < allEvents.length; i++) {
        const e = allEvents[i]!;
        weatherEvents.push({ tick: keTick, weatherType: e.type, severity: e.severity, region: e.region });
      }
    }

    // Link 5: sentinel output
    const drRec = current.sectors.get(`deers-rock-${TARGET.id}`);
    if (drRec) {
      const drState = drRec.state as DeersRockSectorState;
      const so = drState.sentinelOutput;
      if (so) {
        sentinelSnapshots.push({
          tick: keTick,
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

  // --- Final hashes for isolation ---
  const finalSnap = snapshot(current);
  const sectorHashes: Record<string, string> = {};
  for (const s of finalSnap.sectors) {
    sectorHashes[s.id] = hashState(s.state);
  }
  const rngStateHash = hashState(current.rngState);

  const drFinal = current.sectors.get(`deers-rock-${TARGET.id}`)!.state as DeersRockSectorState;
  const finalSentinel = drFinal.sentinelOutput!;

  return {
    co2,
    climateTicks,
    weatherEvents,
    adapterEvents,
    sentinelSnapshots,
    finalSentinel,
    finalWorldHash: hashState(finalSnap.sectors),
    sectorHashes,
    rngStateHash,
    runtimeMs: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// Per-seed paired execution (all arms — fresh world each time)
// ---------------------------------------------------------------------------
function runSeedPair(seed: number): SeedResult {
  const arms: Record<number, ArmResult> = {};
  for (const co2 of ALL_CO2S) {
    arms[co2] = runArm(seed, co2);
  }

  // Isolation: RNG state must differ across arms (each has independent RNG)
  // But for the SAME CO2, RNG should be identical (same seed, same consumption)
  // We check that at least control vs highest intervention differ
  const controlRng = arms[CONTROL_CO2]!.rngStateHash;
  const maxIntervRng = arms[ALL_CO2S[ALL_CO2S.length - 1]!]!.rngStateHash;
  const keRngIdentical = controlRng === maxIntervRng;

  // Non-DR sectors: check if differences are documented (weather subscribers)
  const nonDrSectors: Record<string, { identical: boolean; documentedSubscriber: boolean }> = {};
  for (const [id, h] of Object.entries(arms[CONTROL_CO2]!.sectorHashes)) {
    if (id.startsWith("deers-rock-")) continue;
    const identical = arms[ALL_CO2S[ALL_CO2S.length - 1]!]!.sectorHashes[id] === h;
    nonDrSectors[id] = { identical, documentedSubscriber: DOCUMENTED_WEATHER_SUBSCRIBERS.has(id) };
  }

  return { seed, arms, isolation: { keRngIdentical, nonDrSectors } };
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
  return [round3(m - 2.01 * se), round3(m + 2.01 * se)];
}

function gitHead(dir: string): string {
  try {
    const { execSync } = require("node:child_process");
    return execSync("git rev-parse HEAD", { cwd: dir }).toString().trim();
  } catch { return "unknown"; }
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
  console.log(`Mode: Threshold scan (Phase 1, v2 RNG-clean)`);
  console.log();

  // --- Execute all seed pairs ---
  const seedResults: SeedResult[] = [];
  const tExec0 = Date.now();
  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i]!;
    const result = runSeedPair(seed);
    seedResults.push(result);
    if ((i + 1) % 5 === 0 || i === SEEDS.length - 1) {
      const elapsed = ((Date.now() - tExec0) / 1000).toFixed(1);
      console.log(`  [${i + 1}/${SEEDS.length}] seeds complete (${elapsed}s)`);
    }
  }
  const execTimeMs = Date.now() - tExec0;
  console.log(`\nExecution time: ${(execTimeMs / 1000).toFixed(1)}s`);

  // --- Reproducibility: re-run seed 42 pair ---
  console.log(`\n=== Reproducibility check (seed 42 re-run) ===`);
  const replay42 = runSeedPair(42);
  const orig42 = seedResults[0]!;
  const replayIdentical =
    replay42.arms[CONTROL_CO2]!.finalWorldHash === orig42.arms[CONTROL_CO2]!.finalWorldHash &&
    replay42.arms[ALL_CO2S[ALL_CO2S.length - 1]!]!.finalWorldHash === orig42.arms[ALL_CO2S[ALL_CO2S.length - 1]!]!.finalWorldHash &&
    JSON.stringify(replay42.arms[CONTROL_CO2]!.climateTicks) === JSON.stringify(orig42.arms[CONTROL_CO2]!.climateTicks) &&
    JSON.stringify(replay42.arms[ALL_CO2S[ALL_CO2S.length - 1]!]!.climateTicks) === JSON.stringify(orig42.arms[ALL_CO2S[ALL_CO2S.length - 1]!]!.climateTicks) &&
    JSON.stringify(replay42.arms[CONTROL_CO2]!.adapterEvents) === JSON.stringify(orig42.arms[CONTROL_CO2]!.adapterEvents) &&
    JSON.stringify(replay42.arms[ALL_CO2S[ALL_CO2S.length - 1]!]!.adapterEvents) === JSON.stringify(orig42.arms[ALL_CO2S[ALL_CO2S.length - 1]!]!.adapterEvents);
  console.log(`  seed-42 replay identical: ${replayIdentical}`);
  if (!replayIdentical) {
    console.error("REPRODUCIBILITY FAILURE — STOP per design.");
    process.exitCode = 2;
    return;
  }

  // --- Compute activation analysis per intervention CO2 ---
  const activationAnalyses: ActivationAnalysis[] = [];

  for (const co2 of INTERVENTION_CO2S) {
    const supplyStressDeltas: number[] = [];
    const occupancyRateDeltas: number[] = [];
    const encountersDeltas: number[] = [];
    let seedsWithActivation = 0;

    for (const sr of seedResults) {
      const ctrl = sr.arms[CONTROL_CO2]!.finalSentinel;
      const interv = sr.arms[co2]!.finalSentinel;

      const supplyStressDelta = round3(interv.supplyStress - ctrl.supplyStress);
      const occupancyRateDelta = round3(interv.occupancyRate - ctrl.occupancyRate);
      const icuDelta = round3(interv.icuOccupancyRate - ctrl.icuOccupancyRate);
      const mortalityDelta = interv.mortalityPressure - ctrl.mortalityPressure;

      const hasActivation = supplyStressDelta !== 0 || occupancyRateDelta !== 0 || icuDelta !== 0 || mortalityDelta !== 0;

      supplyStressDeltas.push(supplyStressDelta);
      occupancyRateDeltas.push(occupancyRateDelta);
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
    const counts = seedResults.map(sr => sr.arms[co2]!.weatherEvents.length);
    weatherEventStats[co2] = { mean: round3(mean(counts)), min: Math.min(...counts), max: Math.max(...counts) };
  }

  // --- Adapter event counts per arm ---
  const adapterEventStats: Record<number, { mean: number; min: number; max: number }> = {};
  for (const co2 of ALL_CO2S) {
    const counts = seedResults.map(sr => sr.arms[co2]!.adapterEvents.length);
    adapterEventStats[co2] = { mean: round3(mean(counts)), min: Math.min(...counts), max: Math.max(...counts) };
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

  console.log("\n=== WEATHER EVENT COUNTS (mean over seeds) ===");
  for (const [co2, stats] of Object.entries(weatherEventStats)) {
    console.log(`  CO₂=${co2}: mean=${stats.mean}, range=[${stats.min}, ${stats.max}]`);
  }

  console.log("\n=== ADAPTER EVENT COUNTS (mean over seeds) ===");
  for (const [co2, stats] of Object.entries(adapterEventStats)) {
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
    version: "v2-RNG-clean",
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
    adapterEventStats,
    thresholdEstimate: {
      co2At95PctActivation: thresholdCO2,
      co2At100PctActivation: saturationCO2,
    },
    isolation: {
      allKeRngIdentical: seedResults.every(r => r.isolation.keRngIdentical),
      nonDrSectorDiffs: Object.keys(seedResults[0]!.isolation.nonDrSectors).map(id => ({
        sector: id,
        seedsWithDiff: seedResults.filter(r => !r.isolation.nonDrSectors[id]!.identical).length,
        documentedSubscriber: DOCUMENTED_WEATHER_SUBSCRIBERS.has(id),
      })),
    },
    costReport,
    seedResults: seedResults.map(sr => ({
      seed: sr.seed,
      arms: Object.fromEntries(
        Object.entries(sr.arms).map(([co2, arm]) => [co2, {
          co2: arm.co2,
          climateTicks: arm.climateTicks,
          weatherEvents: arm.weatherEvents,
          adapterEvents: arm.adapterEvents,
          finalSentinel: arm.finalSentinel,
          finalWorldHash: arm.finalWorldHash,
          rngStateHash: arm.rngStateHash,
          runtimeMs: arm.runtimeMs,
        }])
      ),
      isolation: sr.isolation,
    })),
    replayIdentical,
  };

  writeFileSync(join(outDir, "exp-002-results.json"), JSON.stringify(rawOutput, null, 2));
  console.log(`\nRaw results saved to: ${outDir}/exp-002-results.json`);

  // --- Save activation curve as CSV ---
  const csvLines = ["co2,activation_rate,mean_supply_stress_delta,mean_occupancy_rate_delta"];
  for (const a of activationAnalyses) {
    csvLines.push(`${a.co2},${a.activationRate},${a.meanSupplyStressDelta},${a.meanOccupancyRateDelta}`);
  }
  writeFileSync(join(outDir, "activation-curve.csv"), csvLines.join("\n"));
  console.log(`Activation curve CSV saved to: ${outDir}/activation-curve.csv`);

  console.log(`\n=== Complete (${((Date.now() - tTotal0) / 1000).toFixed(1)}s) ===`);
}

main();
