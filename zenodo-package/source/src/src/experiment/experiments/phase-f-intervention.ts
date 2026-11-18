/**
 * PHASE F — Causal Integration Experiment (v2, instrumented)
 *
 * Frozen design: docs/PHASE-F-DESIGN.md
 * Pathway: CO₂ → climate response → EXTREME_WEATHER → KE adapter → DR intervention → DR sentinel output
 *
 * Execution: fresh-world paired counterfactual (no forkBranch).
 *   Control arm:      climate.co2Concentration = 280
 *   Intervention arm: climate.co2Concentration = 800
 *   Seeds 42–46, horizon 20 KE ticks, sentinel makassar-001 (+ B/C isolation sentinels).
 *
 * Causal trace (mandatory, per-link):
 *   Link 1 climate:      per-tick CO₂, temperatureAnomaly, eventChance
 *   Link 2 weather:     EXTREME_WEATHER occurrences (tick, type, severity)
 *   Link 3 adapter:     DR events scheduled by adapter (admission_surge /
 *                        supply_chain_pressure / active_disaster) via queue wrapper
 *   Link 4 DR:          per-tick DR state fields (_admissionMultiplier,
 *                        _supplyChainPressure, _activeMacroDisaster, _scenario.active)
 *   Link 5 observable:  per-tick sentinel output (5 primary outcomes)
 *
 * Isolation (E5 invariants): untargeted sentinels B/C byte-identical across arms;
 *   KE world RNG state identical across arms; non-DR sectors compared and
 *   differences attributed to documented downstream EXTREME_WEATHER subscribers
 *   (economy, geopolitics — events.ts EVENT_SUBSCRIPTIONS).
 *
 * Reproducibility: seed-42 control+intervention pair re-run; hash comparison.
 *
 * v2 note: v1 run (2026-09-06 07:45) executed against a STALE Deers-Rock dist
 * (built 2026-09-04, predating Phase E coupling consumers in src 2026-09-05).
 * v1 artifacts are quarantined as invalid. DR dist rebuilt 2026-09-06 15:04
 * from DR HEAD 5884ba3 before this run.
 */
import { writeFileSync, mkdirSync, readFileSync, renameSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import type { Nation as GeoNation, War, Alliance, GlobalState } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter, getHospitalSeed } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import { createWorld, run, snapshot, resetUniverseCounter } from "../../engine/index.js";
import type { WorldState, WorldSnapshot } from "../../engine/world-engine.js";
import { hashState } from "../../timeline/hash.js";
import type { DeersRockSectorState, HospitalSentinelOutput } from "../../sectors/deers-rock-adapter.js";

// ---------------------------------------------------------------------------
// Frozen parameters — DO NOT MODIFY (design frozen 2026-09-05)
// ---------------------------------------------------------------------------
const SEEDS = [42, 43, 44, 45, 46] as const;
const HORIZON = 20;
const CONTROL_CO2 = 280;
const INTERVENTION_CO2 = 800;
const EXPERIMENT_ID = "PHASE-F-CAUSAL-2026-09-06";

const TARGET = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };
const ISOLATION_SENTINELS = [
  { id: "sentinel-B", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 },
  { id: "sentinel-C", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 },
];

interface EraState {
  year: number;
  label: string;
  nations: GeoNation[];
  wars: War[];
  alliances: Alliance[];
  globalState: GlobalState;
}

// ---------------------------------------------------------------------------
// Causal-trace record types
// ---------------------------------------------------------------------------
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
  drEventType: string;      // admission_surge | supply_chain_pressure | active_disaster | staff_shortage
  data: Record<string, unknown>;
}

interface DrStateTick {
  keTick: number;
  drTick: number;
  admissionMultiplier: number;
  supplyChainPressure: number;
  activeMacroDisaster: string | undefined;
  scenarioActive: { type: string; phase: string; severity: number; startTick: number } | null;
  scenarioHistoryCount: number;
}

interface SentinelTick {
  keTick: number;
  occupancyRate: number;
  icuOccupancyRate: number;
  mortalityPressure: number;
  supplyStress: number;
  admissionSurge: boolean;
}

interface ArmResult {
  arm: "control" | "intervention";
  co2Initial: number;
  climateTicks: ClimateTick[];
  weatherEvents: WeatherEventRecord[];
  adapterEvents: AdapterEventRecord[];
  drStateTicks: DrStateTick[];
  sentinelTicks: SentinelTick[];
  finalSentinel: HospitalSentinelOutput;
  finalWorldHash: string;
  sectorHashes: Record<string, string>;
  rngStateHash: string;
}

interface SeedResult {
  seed: number;
  control: ArmResult;
  intervention: ArmResult;
  deltas: {
    occupancyRate: number;
    icuOccupancyRate: number;
    mortalityPressure: number;
    supplyStress: number;
    admissionSurgeFlipped: boolean;
  };
  isolation: {
    sentinelBIdentical: boolean;
    sentinelCIdentical: boolean;
    keRngIdentical: boolean;
    nonDrSectors: Record<string, { identical: boolean; documentedSubscriber: boolean }>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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
    ...ISOLATION_SENTINELS.map((c) => deersRockAdapter({ ...c }, worldSeed)),
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

/** Sectors with documented downstream EXTREME_WEATHER subscriptions (events.ts). */
const DOCUMENTED_WEATHER_SUBSCRIBERS = new Set(["economy", "geopolitics"]);

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Instrumented single-arm run
// ---------------------------------------------------------------------------
function runArm(seed: number, co2: number, arm: "control" | "intervention"): ArmResult {
  resetUniverseCounter();
  const era = loadEraState();
  const sectors = createAllSectors(seed);
  const configs = buildSectorConfigs(era, co2);
  const world = createWorld(sectors, configs, { seed });

  // --- Link 3 instrumentation: wrap every sentinel's DR queue.schedule ---
  const adapterEvents: AdapterEventRecord[] = [];
  for (const rec of world.sectors.values()) {
    if (!rec.sector.id.startsWith("deers-rock-")) continue;
    const s = rec.state as DeersRockSectorState;
    const origSchedule = s.world.queue.schedule.bind(s.world.queue);
    (s.world.queue as unknown as { schedule: typeof origSchedule }).schedule =
      (type: string, delayTicks: number, data: Record<string, unknown> = {}) => {
        const evt = origSchedule(type, delayTicks, data);
        // Only record macro-coupling events (the adapter's translations)
        if (["admission_surge", "supply_chain_pressure", "active_disaster", "staff_shortage"].includes(type)) {
          adapterEvents.push({ keTick: world.tick + 1, drEventType: type, data: { ...data } });
        }
        return evt;
      };
  }

  // --- Per-tick trace ---
  const climateTicks: ClimateTick[] = [];
  const weatherEvents: WeatherEventRecord[] = [];
  const drStateTicks: DrStateTick[] = [];
  const sentinelTicks: SentinelTick[] = [];

  let current = world;
  for (let t = 0; t < HORIZON; t++) {
    current = run(current, 1);
    const keTick = current.tick;

    // Link 1: climate state
    const climate = current.sectors.get("climate")!.state as unknown as {
      co2Concentration: number; temperatureAnomaly: number; extremeEvents: Array<{ type: string; severity: number; region: string; year: number }>;
    };
    const eventChance = Math.max(0.05, Math.min(0.5, 0.1 + (climate.temperatureAnomaly - 1.2) * 0.05));
    climateTicks.push({
      tick: keTick,
      co2: round3(climate.co2Concentration),
      temperatureAnomaly: round3(climate.temperatureAnomaly),
      eventChance: round3(eventChance),
    });

    // Link 2: new EXTREME_WEATHER events this tick (diff vs previous count)
    const prevCount = t === 0 ? 0 : weatherEvents.length;
    const allEvents = climate.extremeEvents;
    // extremeEvents accumulates; record only newly added ones with this tick
    const alreadyRecorded = weatherEvents.length;
    if (allEvents.length > alreadyRecorded) {
      for (let i = alreadyRecorded; i < allEvents.length; i++) {
        const e = allEvents[i]!;
        weatherEvents.push({ tick: keTick, weatherType: e.type, severity: e.severity, region: e.region });
      }
    }
    void prevCount;

    // Links 4+5: DR state and sentinel output of TARGET sentinel
    const drRec = current.sectors.get(`deers-rock-${TARGET.id}`)!;
    const drState = drRec.state as DeersRockSectorState;
    const hs = drState.world.state as unknown as {
      _admissionMultiplier: number;
      _supplyChainPressure: number;
      _activeMacroDisaster: string | undefined;
      _scenario: { active: { type: string; phase: string; severity: number; startTick: number } | null; history: unknown[] };
    };
    drStateTicks.push({
      keTick,
      drTick: drState.world.clock.tick,
      admissionMultiplier: hs._admissionMultiplier,
      supplyChainPressure: hs._supplyChainPressure,
      activeMacroDisaster: hs._activeMacroDisaster,
      scenarioActive: hs._scenario.active
        ? { type: hs._scenario.active.type, phase: hs._scenario.active.phase, severity: hs._scenario.active.severity, startTick: hs._scenario.active.startTick }
        : null,
      scenarioHistoryCount: hs._scenario.history.length,
    });

    const so = drState.sentinelOutput;
    if (so) {
      sentinelTicks.push({
        keTick,
        occupancyRate: round3(so.occupancyRate),
        icuOccupancyRate: round3(so.icuOccupancyRate),
        mortalityPressure: so.mortalityPressure,
        supplyStress: round3(so.supplyStress),
        admissionSurge: so.admissionSurge,
      });
    }
  }

  // --- Final hashes for isolation + reproducibility ---
  const finalSnap = snapshot(current);
  const sectorHashes: Record<string, string> = {};
  for (const s of finalSnap.sectors) {
    sectorHashes[s.id] = hashState(s.state);
  }
  const rngStateHash = hashState(current.rngState);

  const drFinal = current.sectors.get(`deers-rock-${TARGET.id}`)!.state as DeersRockSectorState;
  const finalSentinel = drFinal.sentinelOutput!;

  return {
    arm,
    co2Initial: co2,
    climateTicks,
    weatherEvents,
    adapterEvents,
    drStateTicks,
    sentinelTicks,
    finalSentinel,
    finalWorldHash: hashState(finalSnap.sectors),
    sectorHashes,
    rngStateHash,
  };
}

// ---------------------------------------------------------------------------
// Per-seed paired execution
// ---------------------------------------------------------------------------
function runSeedPair(seed: number): SeedResult {
  const control = runArm(seed, CONTROL_CO2, "control");
  const intervention = runArm(seed, INTERVENTION_CO2, "intervention");

  const c = control.finalSentinel;
  const i = intervention.finalSentinel;
  const deltas = {
    occupancyRate: round3(i.occupancyRate - c.occupancyRate),
    icuOccupancyRate: round3(i.icuOccupancyRate - c.icuOccupancyRate),
    mortalityPressure: i.mortalityPressure - c.mortalityPressure,
    supplyStress: round3(i.supplyStress - c.supplyStress),
    admissionSurgeFlipped: i.admissionSurge !== c.admissionSurge,
  };

  // Isolation: untargeted sentinels must be byte-identical across arms
  const sentinelBIdentical = control.sectorHashes[`deers-rock-sentinel-B`] === intervention.sectorHashes[`deers-rock-sentinel-B`];
  const sentinelCIdentical = control.sectorHashes[`deers-rock-sentinel-C`] === intervention.sectorHashes[`deers-rock-sentinel-C`];

  // Isolation: KE world RNG state must be identical (intervention is config-only)
  const keRngIdentical = control.rngStateHash === intervention.rngStateHash;

  // Non-DR sectors: identical, or differ via documented EXTREME_WEATHER subscribers
  const nonDrSectors: Record<string, { identical: boolean; documentedSubscriber: boolean }> = {};
  for (const [id, h] of Object.entries(control.sectorHashes)) {
    if (id.startsWith("deers-rock-")) continue;
    const identical = h === intervention.sectorHashes[id];
    nonDrSectors[id] = { identical, documentedSubscriber: DOCUMENTED_WEATHER_SUBSCRIBERS.has(id) };
  }

  return {
    seed,
    control,
    intervention,
    deltas,
    isolation: { sentinelBIdentical, sentinelCIdentical, keRngIdentical, nonDrSectors },
  };
}

// ---------------------------------------------------------------------------
// Descriptive statistics (frozen plan: per-seed delta, mean, median,
// direction consistency, spread, effect magnitude, event occurrence rate)
// ---------------------------------------------------------------------------
function describe(values: number[]) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = n % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const variance = n > 1 ? values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const positive = values.filter((v) => v > 1e-9).length;
  const negative = values.filter((v) => v < -1e-9).length;
  const zero = n - positive - negative;
  return {
    perSeed: values.map((v) => round3(v)),
    mean: round3(mean),
    median: round3(median),
    min: round3(Math.min(...values)),
    max: round3(Math.max(...values)),
    stdDev: round3(Math.sqrt(variance)),
    directionConsistency: round3(Math.max(positive, negative) / n),
    positive, negative, zero,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../../experiment-results/phase-f");
mkdirSync(outDir, { recursive: true });

// Quarantine v1 artifacts (stale DR dist — invalid evidence)
const v1Files = ["results.json", "statistical-summary.json", "report.md"];
const quarantineDir = join(outDir, "v1-invalid-stale-dist");
mkdirSync(quarantineDir, { recursive: true });
for (const f of v1Files) {
  const src = join(outDir, f);
  if (existsSync(src)) renameSync(src, join(quarantineDir, f));
}

console.log(`=== PHASE F Causal Integration Experiment (v2) ===`);
console.log(`Experiment ID: ${EXPERIMENT_ID}`);
console.log(`Control CO₂=${CONTROL_CO2} | Intervention CO₂=${INTERVENTION_CO2} | Seeds ${SEEDS.join(",")} | Horizon ${HORIZON} KE ticks`);

const t0 = Date.now();
const seedResults: SeedResult[] = [];
for (const seed of SEEDS) {
  const r = runSeedPair(seed);
  seedResults.push(r);
  const c = r.control, i = r.intervention;
  console.log(`\n--- Seed ${seed} ---`);
  console.log(`  L1 climate: finalCO2 c=${c.climateTicks.at(-1)!.co2} i=${i.climateTicks.at(-1)!.co2} | anomaly c=${c.climateTicks.at(-1)!.temperatureAnomaly} i=${i.climateTicks.at(-1)!.temperatureAnomaly}`);
  console.log(`  L2 weather: events c=${c.weatherEvents.length} i=${i.weatherEvents.length} (ticks c=[${c.weatherEvents.map(e => e.tick)}] i=[${i.weatherEvents.map(e => e.tick)}])`);
  console.log(`  L3 adapter: DR events c=${c.adapterEvents.length} i=${i.adapterEvents.length} (types i=[${i.adapterEvents.map(e => e.drEventType).join(",") || "none"}])`);
  console.log(`  L4 DR: scenarioActive c=${c.drStateTicks.some(t => t.scenarioActive)} i=${i.drStateTicks.some(t => t.scenarioActive)} | supplyPressure>0 c=${c.drStateTicks.some(t => t.supplyChainPressure > 0)} i=${i.drStateTicks.some(t => t.supplyChainPressure > 0)}`);
  console.log(`  L5 observable: occ c=${c.finalSentinel.occupancyRate} i=${i.finalSentinel.occupancyRate} (Δ=${r.deltas.occupancyRate}) | supply c=${c.finalSentinel.supplyStress} i=${i.finalSentinel.supplyStress} (Δ=${r.deltas.supplyStress})`);
  console.log(`  isolation: B=${r.isolation.sentinelBIdentical} C=${r.isolation.sentinelCIdentical} rng=${r.isolation.keRngIdentical} nonDR=${Object.entries(r.isolation.nonDrSectors).map(([k, v]) => `${k}:${v.identical ? "same" : "diff"}`).join(" ")}`);
}

// --- Reproducibility: re-run seed 42 pair, compare hashes + traces ---
console.log(`\n=== Reproducibility check (seed 42 re-run) ===`);
const replay42 = runSeedPair(42);
const orig42 = seedResults[0]!;
const replayIdentical =
  replay42.control.finalWorldHash === orig42.control.finalWorldHash &&
  replay42.intervention.finalWorldHash === orig42.intervention.finalWorldHash &&
  JSON.stringify(replay42.control.weatherEvents) === JSON.stringify(orig42.control.weatherEvents) &&
  JSON.stringify(replay42.intervention.weatherEvents) === JSON.stringify(orig42.intervention.weatherEvents) &&
  JSON.stringify(replay42.control.adapterEvents) === JSON.stringify(orig42.control.adapterEvents) &&
  JSON.stringify(replay42.intervention.adapterEvents) === JSON.stringify(orig42.intervention.adapterEvents) &&
  JSON.stringify(replay42.control.sentinelTicks) === JSON.stringify(orig42.control.sentinelTicks) &&
  JSON.stringify(replay42.intervention.sentinelTicks) === JSON.stringify(orig42.intervention.sentinelTicks);
console.log(`  seed-42 replay identical: ${replayIdentical}`);
if (!replayIdentical) {
  console.error("REPRODUCIBILITY FAILURE — STOP per design §9.");
  process.exitCode = 2;
}

// --- Descriptive statistics ---
const stats = {
  occupancyRate: describe(seedResults.map((r) => r.deltas.occupancyRate)),
  icuOccupancyRate: describe(seedResults.map((r) => r.deltas.icuOccupancyRate)),
  mortalityPressure: describe(seedResults.map((r) => r.deltas.mortalityPressure)),
  supplyStress: describe(seedResults.map((r) => r.deltas.supplyStress)),
  admissionSurgeFlips: seedResults.filter((r) => r.deltas.admissionSurgeFlipped).length,
  eventOccurrenceRate: {
    controlArmSeedsWithWeather: seedResults.filter((r) => r.control.weatherEvents.length > 0).length,
    interventionArmSeedsWithWeather: seedResults.filter((r) => r.intervention.weatherEvents.length > 0).length,
    controlTotalEvents: seedResults.reduce((a, r) => a + r.control.weatherEvents.length, 0),
    interventionTotalEvents: seedResults.reduce((a, r) => a + r.intervention.weatherEvents.length, 0),
    firstEventTickControl: seedResults.map((r) => r.control.weatherEvents[0]?.tick ?? null),
    firstEventTickIntervention: seedResults.map((r) => r.intervention.weatherEvents[0]?.tick ?? null),
  },
};

// --- Isolation aggregate ---
const isolationAggregate = {
  allUntargetedSentinelsIdentical: seedResults.every((r) => r.isolation.sentinelBIdentical && r.isolation.sentinelCIdentical),
  allKeRngIdentical: seedResults.every((r) => r.isolation.keRngIdentical),
  nonDrSectorDiffs: Object.keys(seedResults[0]!.isolation.nonDrSectors).map((id) => ({
    sector: id,
    seedsWithDiff: seedResults.filter((r) => !r.isolation.nonDrSectors[id]!.identical).length,
    documentedSubscriber: DOCUMENTED_WEATHER_SUBSCRIBERS.has(id),
  })),
};

// --- Evidence manifest ---
function gitHead(dir: string): string {
  try { return execSync("git rev-parse HEAD", { cwd: dir }).toString().trim(); } catch { return "unknown"; }
}
const manifest = {
  experimentId: EXPERIMENT_ID,
  executedAt: new Date().toISOString(),
  keCommit: gitHead(join(__dirname, "../../..")),
  drCommit: gitHead(join(__dirname, "../../../..", "Deers-Rock").replace("Kronos Engine", "Deers-Rock")),
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  executionHost: process.env.COMPUTERNAME ?? "unknown",
  frozenParameters: {
    controlCO2: CONTROL_CO2, interventionCO2: INTERVENTION_CO2,
    seeds: [...SEEDS], horizonKeTicks: HORIZON,
    primaryOutcomes: ["occupancyRate", "icuOccupancyRate", "mortalityPressure", "supplyStress", "admissionSurge"],
    successCriterion: "direction consistency >= 80% (4/5 seeds)",
  },
  initialConditions: {
    era: "RP-CONTEMP-002 (COVID-19 baseline 2020, era-contemporary.json)",
    sentinel: TARGET,
    isolationSentinels: ISOLATION_SENTINELS,
    climateConfig: { annualEmissions: 37, annualEmissionsNoise: 0.2 },
    note: "Arms differ ONLY in climate.co2Concentration (280 vs 800); fresh-world paired execution, no forkBranch",
  },
  drDistNote: "DR dist rebuilt 2026-09-06T15:04 from DR HEAD 5884ba3 (v1 run used stale 2026-09-04 dist and was quarantined)",
  outputHashes: {
    perSeedControlWorld: seedResults.map((r) => r.control.finalWorldHash),
    perSeedInterventionWorld: seedResults.map((r) => r.intervention.finalWorldHash),
  },
  artifactLocations: {
    results: "experiment-results/phase-f/results.json",
    stats: "experiment-results/phase-f/statistical-summary.json",
    manifest: "experiment-results/phase-f/manifest.json",
    report: "experiment-results/phase-f/report.md",
    v1Quarantined: "experiment-results/phase-f/v1-invalid-stale-dist/",
  },
};

// --- Write artifacts ---
writeFileSync(join(outDir, "results.json"), JSON.stringify(seedResults, null, 2));
writeFileSync(join(outDir, "statistical-summary.json"), JSON.stringify({ stats, isolationAggregate, replayIdentical }, null, 2));
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

const dt = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n=== Complete (${dt}s) ===`);
console.log(`Artifacts: ${outDir}`);
console.log(`Replay identical: ${replayIdentical}`);
console.log(`Stats occupancy: mean=${stats.occupancyRate.mean} dirConsistency=${stats.occupancyRate.directionConsistency}`);
console.log(`Weather events: control=${stats.eventOccurrenceRate.controlTotalEvents} intervention=${stats.eventOccurrenceRate.interventionTotalEvents}`);
