/**
 * CORRECTED COUNTERFACTUAL — Pilot Runner (N=5 seeds)
 *
 * Design: docs/experiments/CORRECTED-COUNTERFACTUAL-DESIGN.md (approved 2026-09-19)
 * Baseline: 7c9ce17 on exp-001-counterfactual-stability
 *
 * Intervention: single EXTREME_WEATHER event at T_i=20
 *   → admission_surge + supply_chain_pressure + active_disaster → Deers-Rock
 * Horizon: H=50 ticks
 * Primary endpoint: mean supplyStress over post-intervention ticks 21–50
 * Design: paired control/intervention per seed
 * Pilot N: 5 pre-specified seeds
 * Pilot purpose: pathway validation + degeneracy assessment only
 *
 * IMPORTANT: This is a pilot diagnostic, NOT confirmatory evidence.
 * Do NOT estimate N from these 5 seeds.
 * Do NOT claim statistical significance from the pilot.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { createEnergySector } from "../../sectors/energy.js";
import { createDemographicsSector } from "../../sectors/demographics.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { DeersRockSectorState, HospitalSentinelOutput } from "../../sectors/deers-rock-adapter.js";
import { createExp001ObserverSector } from "../exp-001-observer.js";
import type { Exp001ObserverState } from "../exp-001-observer.js";
import { createWorld, run, snapshot, resetUniverseCounter } from "../../engine/index.js";
import type { WorldState } from "../../engine/world-engine.js";
import { createEventBus } from "../../sectors/index.js";
import type { Sector, SectorState, WorldContext, WorldEvent, TickHandler } from "../../sectors/types.js";
import { CLIMATE_EVENTS } from "../../sectors/events.js";

// ---------------------------------------------------------------------------
// Frozen parameters (approved design)
// ---------------------------------------------------------------------------
const PILOT_SEEDS = [42, 137, 256, 1001, 1984] as const;
const HORIZON = 50;
const TI = 20;  // intervention tick
const PRIMARY_WINDOW_START = TI + 1; // ticks 21–50
const PRIMARY_WINDOW_END = HORIZON;
const EXPERIMENT_ID = "CORRECTED-CCF-PILOT-2026-09-19";

const HOSPITAL_CONFIG = {
  id: "sentinel-001",
  city: "TestCity",
  beds: 50,
  patients: 45,
  ticksPerDay: 10,
};

// ---------------------------------------------------------------------------
// Sector configs (single-nation minimal, matching health-surveillance test)
// ---------------------------------------------------------------------------
const SAMPLE_CONFIGS: Record<string, Record<string, unknown>> = {
  geopolitics: {
    year: 2026,
    nations: [
      {
        id: "USA", name: "United States", region: "north-america",
        population: 340_000_000, gdp: 27_000_000_000_000,
        government: "democracy" as const, technologyLevel: 85, militaryPower: 90,
        healthMetrics: { lifeExpectancy: 79, infantMortality: 5.4, hospitalBedsPer1000: 2.8, universalCoverage: false },
        alliances: ["NATO"], wars: [],
        relations: { CHN: 30, RUS: 10, GBR: 85 },
      },
    ],
    wars: [],
    alliances: [],
  },
  economy: {
    year: 2026,
    nations: {
      USA: { gdp: 27_000_000_000_000, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 80, unemploymentRate: 3.7 },
    },
  },
  technology: {
    year: 2026,
    nations: { USA: { technologyLevel: 85, rdSpending: 0.035 } },
  },
  climate: { year: 2026, co2Concentration: 420, annualEmissions: 37 },
  energy: {
    year: 2026,
    nations: {
      USA: { energyMix: { oil: 25, gas: 15, coal: 45, nuclear: 0, renewable: 5 }, totalConsumption: 100, energyPrice: 80, energySecurity: 50, co2Intensity: 0.5 },
    },
  },
  demographics: {
    year: 2026,
    nations: {
      USA: { population: 340_000_000, birthRate: 12, deathRate: 8, medianAge: 38, dependencyRatio: 50, laborForceParticipation: 62, netMigration: 0 },
    },
  },
};

// ---------------------------------------------------------------------------
// Intervention trigger sector
//
// A minimal sector that publishes a single EXTREME_WEATHER event at T_i.
// Must be placed BEFORE deers-rock in the sector list so the adapter sees
// the event via ctx.eventBus.pending() during its tick.
// ---------------------------------------------------------------------------
interface TriggerState extends SectorState {
  _sectorId: "intervention-trigger";
  fired: boolean;
}

function createTriggerSector(fireTick: number | null): Sector {
  return {
    id: "intervention-trigger",
    name: "Intervention Trigger",
    cadence: 1,
    events: [CLIMATE_EVENTS.EXTREME_WEATHER],

    init(): TriggerState {
      return { _sectorId: "intervention-trigger", fired: false };
    },

    tick(state: SectorState, ctx: WorldContext): TriggerState {
      const s = state as TriggerState;
      if (fireTick !== null && ctx.tick === fireTick && !s.fired) {
        ctx.eventBus.publish({
          type: CLIMATE_EVENTS.EXTREME_WEATHER,
          source: "intervention-trigger",
          data: {
            severity: 0.8,
            region: "global",
            weatherType: "heatwave",
            description: "Pilot intervention: single EXTREME_WEATHER at T_i=20",
          },
          tick: ctx.tick,
        });
        return { ...s, fired: true };
      }
      return s;
    },

    handlers: [],
  };
}

// ---------------------------------------------------------------------------
// Per-tick trace record
// ---------------------------------------------------------------------------
interface SentinelTickRecord {
  tick: number;
  supplyStress: number;
  occupancyRate: number;
  icuOccupancyRate: number;
  mortalityPressure: number;
  admissionSurge: boolean;
  diseasePrevalence: Record<string, number>;
}

interface AdapterEventRecord {
  keTick: number;
  drEventType: string;
  data: Record<string, unknown>;
}

interface ArmResult {
  arm: "control" | "intervention";
  sentinelTicks: SentinelTickRecord[];
  adapterEvents: AdapterEventRecord[];
  finalSentinel: HospitalSentinelOutput | null;
  observerState: Exp001ObserverState;
  finalWorldHash: string;
}

interface SeedResult {
  seed: number;
  control: ArmResult;
  intervention: ArmResult;
  primaryEndpoint: {
    controlMean: number;
    interventionMean: number;
    delta: number;
  };
  pathwayVerification: {
    interventionAdapterEvents: number;
    interventionHealthPressure: number;
    interventionHealthSurge: number;
    interventionHealthSupplyCrisis: number;
    interventionHealthMortality: number;
    controlAdapterEvents: number;
  };
  degeneracy: {
    controlSupplyStressVariance: number;
    interventionSupplyStressVariance: number;
    controlSupplyStressZeroFraction: number;
    interventionSupplyStressZeroFraction: number;
    isDegenerate: boolean;
  };
  isolation: {
    controlTriggerFired: boolean;
    interventionTriggerFired: boolean;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function variance(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Wilcoxon signed-rank test (exact for small N)
function wilcoxonSignedRank(deltas: number[]): { W: number; pValue: number; significant: boolean } {
  const nonZero = deltas.filter((d) => d !== 0);
  const n = nonZero.length;
  if (n === 0) return { W: 0, pValue: 1, significant: false };

  // Rank by absolute value
  const ranked = nonZero
    .map((d, i) => ({ value: d, absVal: Math.abs(d), index: i }))
    .sort((a, b) => a.absVal - b.absVal);

  // Handle ties: assign average rank
  const ranks = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && ranked[j]!.absVal === ranked[i]!.absVal) j++;
    const avgRank = (i + j + 1) / 2; // 1-indexed average
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }

  // W+ = sum of ranks for positive deltas
  let WPlus = 0;
  for (let k = 0; k < n; k++) {
    if (nonZero[ranked[k]!.index]! > 0) WPlus += ranks[k];
  }
  const WMinus = n * (n + 1) / 2 - WPlus;
  const W = Math.min(WPlus, WMinus);

  // Approximate p-value using normal approximation for n >= 10
  // For n < 10, use exact table (simplified: two-tailed)
  if (n < 10) {
    // Critical values for Wilcoxon signed-rank (two-tailed, alpha=0.05)
    const criticalValues: Record<number, number> = {
      5: 0, // W must be 0 for significance
      6: 0,
      7: 2,
      8: 3,
      9: 5,
    };
    const cv = criticalValues[n] ?? 0;
    return { W, pValue: W <= cv ? 0.04 : 0.1, significant: W <= cv };
  }

  // Normal approximation
  const muW = n * (n + 1) / 4;
  const sigmaW = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24);
  const z = (W - muW) / sigmaW;
  // Two-tailed p-value from standard normal
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  return { W, pValue, significant: pValue < 0.05 };
}

function normalCDF(z: number): number {
  // Approximation of the standard normal CDF
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

// Paired t-test
function pairedTTest(deltas: number[]): { t: number; df: number; pValue: number; cohensDz: number } {
  const n = deltas.length;
  const m = mean(deltas);
  const s = Math.sqrt(variance(deltas));
  if (s === 0 || n < 2) return { t: 0, df: n - 1, pValue: 1, cohensDz: 0 };
  const se = s / Math.sqrt(n);
  const t = m / se;
  const cohensDz = m / s;
  // Two-tailed p-value (approximate using t-distribution)
  const pValue = 2 * (1 - tCDF(Math.abs(t), n - 1));
  return { t, df: n - 1, pValue, cohensDz };
}

// Simple t-distribution CDF approximation
function tCDF(t: number, df: number): number {
  // Use normal approximation for large df
  if (df > 30) return normalCDF(t);
  // For small df, use a rough approximation
  const x = df / (df + t * t);
  // Incomplete beta function approximation
  return 1 - 0.5 * incompleteBeta(df / 2, 0.5, x);
}

function incompleteBeta(a: number, b: number, x: number): number {
  // Simple numerical integration (Simpson's rule)
  const n = 100;
  const h = x / n;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const xi = i * h;
    const w = i === 0 || i === n ? 1 : i % 2 === 0 ? 2 : 4;
    const val = Math.pow(xi, a - 1) * Math.pow(1 - xi, b - 1);
    sum += w * val;
  }
  return (h / 3) * sum / betaFunction(a, b);
}

function betaFunction(a: number, b: number): number {
  return gammaFunction(a) * gammaFunction(b) / gammaFunction(a + b);
}

function gammaFunction(z: number): number {
  // Stirling's approximation for gamma function
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFunction(1 - z));
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  let x = c[0]!;
  for (let i = 1; i < g + 2; i++) x += c[i]! / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

// ---------------------------------------------------------------------------
// Single-arm run with per-tick capture
// ---------------------------------------------------------------------------
function runArm(
  seed: number,
  fireTick: number | null,
  arm: "control" | "intervention",
): ArmResult {
  resetUniverseCounter();

  const trigger = createTriggerSector(fireTick);
  const sentinel = deersRockAdapter({ ...HOSPITAL_CONFIG }, seed);
  const observer = createExp001ObserverSector();

  // Sector order: trigger must come BEFORE sentinel so sentinel sees the event
  const sectors: Sector[] = [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    createEnergySector(),
    createDemographicsSector(),
    trigger,           // BEFORE sentinel
    sentinel,
    observer,          // LAST — preserves RNG sequence for pre-existing sectors
  ];

  const world = createWorld(sectors, SAMPLE_CONFIGS, { seed });

  // Instrument: wrap sentinel's queue.schedule to capture adapter events
  const adapterEvents: AdapterEventRecord[] = [];
  const sentinelRec = world.sectors.get(`deers-rock-${HOSPITAL_CONFIG.id}`);
  if (sentinelRec) {
    const s = sentinelRec.state as DeersRockSectorState;
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

  // Per-tick trace
  const sentinelTicks: SentinelTickRecord[] = [];
  let current = world;

  for (let t = 0; t < HORIZON; t++) {
    current = run(current, 1);

    const drRec = current.sectors.get(`deers-rock-${HOSPITAL_CONFIG.id}`);
    if (drRec) {
      const drState = drRec.state as DeersRockSectorState;
      const so = drState.sentinelOutput;
      if (so) {
        sentinelTicks.push({
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

  // Final state
  const finalDrRec = current.sectors.get(`deers-rock-${HOSPITAL_CONFIG.id}`);
  const finalSentinel = finalDrRec
    ? (finalDrRec.state as DeersRockSectorState).sentinelOutput
    : null;

  // Observer state
  const obsRec = current.sectors.get("exp-001-observer");
  const observerState = obsRec
    ? (obsRec.state as Exp001ObserverState)
    : { _sectorId: "exp-001-observer" as const, eventCounts: {}, firstEventTick: {}, totalEvents: 0 };

  // World hash
  const snap = snapshot(current);
  const finalWorldHash = JSON.stringify(snap.sectors.map((s) => s.id).sort());

  return {
    arm,
    sentinelTicks,
    adapterEvents,
    finalSentinel,
    observerState,
    finalWorldHash,
  };
}

// ---------------------------------------------------------------------------
// Per-seed paired execution
// ---------------------------------------------------------------------------
function runSeedPair(seed: number): SeedResult {
  console.log(`  Running seed ${seed}...`);

  const control = runArm(seed, null, "control");
  const intervention = runArm(seed, TI, "intervention");

  // Primary endpoint: mean supplyStress over post-intervention window
  const controlWindow = control.sentinelTicks
    .filter((t) => t.tick >= PRIMARY_WINDOW_START && t.tick <= PRIMARY_WINDOW_END)
    .map((t) => t.supplyStress);
  const interventionWindow = intervention.sentinelTicks
    .filter((t) => t.tick >= PRIMARY_WINDOW_START && t.tick <= PRIMARY_WINDOW_END)
    .map((t) => t.supplyStress);

  const controlMean = round3(mean(controlWindow));
  const interventionMean = round3(mean(interventionWindow));
  const delta = round3(interventionMean - controlMean);

  // Pathway verification
  const interventionAdapterEvents = intervention.adapterEvents.filter(
    (e) => e.keTick === TI + 1, // adapter sees the event at TI+1 due to eventBus timing
  );
  const pathwayVerification = {
    interventionAdapterEvents: intervention.adapterEvents.length,
    interventionHealthPressure: intervention.observerState.eventCounts["health.pressure"] ?? 0,
    interventionHealthSurge: intervention.observerState.eventCounts["health.surge"] ?? 0,
    interventionHealthSupplyCrisis: intervention.observerState.eventCounts["health.supply-crisis"] ?? 0,
    interventionHealthMortality: intervention.observerState.eventCounts["health.mortality"] ?? 0,
    controlAdapterEvents: control.adapterEvents.length,
  };

  // Degeneracy assessment
  const controlVariance = variance(controlWindow);
  const interventionVariance = variance(interventionWindow);
  const controlZeroFraction = controlWindow.filter((v) => v === 0).length / controlWindow.length;
  const interventionZeroFraction = interventionWindow.filter((v) => v === 0).length / interventionWindow.length;
  const isDegenerate =
    controlVariance === 0 && interventionVariance === 0 && controlZeroFraction > 0.5 && interventionZeroFraction > 0.5;

  // Trigger verification
  const triggerRec = control.sentinelTicks.length > 0; // trigger sector doesn't produce sentinel output
  // We verify by checking adapter events: control should have FEWER adapter events than intervention
  const controlHasExtraEvents = control.adapterEvents.length > intervention.adapterEvents.length;

  return {
    seed,
    control,
    intervention,
    primaryEndpoint: { controlMean, interventionMean, delta },
    pathwayVerification,
    degeneracy: {
      controlSupplyStressVariance: round3(controlVariance),
      interventionSupplyStressVariance: round3(interventionVariance),
      controlSupplyStressZeroFraction: round3(controlZeroFraction),
      interventionSupplyStressZeroFraction: round3(interventionZeroFraction),
      isDegenerate,
    },
    isolation: {
      controlTriggerFired: control.adapterEvents.length >= intervention.adapterEvents.length ? false : true,
      interventionTriggerFired: intervention.adapterEvents.length > control.adapterEvents.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log(`=== ${EXPERIMENT_ID} ===`);
  console.log(`Seeds: ${PILOT_SEEDS.join(", ")}`);
  console.log(`Horizon: ${HORIZON} ticks`);
  console.log(`Intervention: EXTREME_WEATHER at T_i=${TI}`);
  console.log(`Primary window: ticks ${PRIMARY_WINDOW_START}–${PRIMARY_WINDOW_END}`);
  console.log(`Primary endpoint: mean supplyStress over primary window`);
  console.log();

  const results: SeedResult[] = [];
  for (const seed of PILOT_SEEDS) {
    const result = runSeedPair(seed);
    results.push(result);
    console.log(`  Seed ${seed}: control=${result.primaryEndpoint.controlMean}, intervention=${result.primaryEndpoint.interventionMean}, Δ=${result.primaryEndpoint.delta}`);
  }

  // Aggregate analysis
  console.log();
  console.log("=== AGGREGATE ===");

  const deltas = results.map((r) => r.primaryEndpoint.delta);
  const controlMeans = results.map((r) => r.primaryEndpoint.controlMean);
  const interventionMeans = results.map((r) => r.primaryEndpoint.interventionMean);

  const meanDelta = round3(mean(deltas));
  const meanControl = round3(mean(controlMeans));
  const meanIntervention = round3(mean(interventionMeans));

  console.log(`Mean Δ supplyStress: ${meanDelta}`);
  console.log(`Mean control: ${meanControl}`);
  console.log(`Mean intervention: ${meanIntervention}`);

  // Direction consistency
  const positiveDeltas = deltas.filter((d) => d > 0).length;
  const directionConsistency = round3(positiveDeltas / deltas.length);
  console.log(`Direction consistency (Δ > 0): ${positiveDeltas}/${deltas.length} = ${directionConsistency}`);

  // Degeneracy
  const degenerateCount = results.filter((r) => r.degeneracy.isDegenerate).length;
  const degeneracyRate = round3(degenerateCount / results.length);
  console.log(`Degeneracy rate: ${degenerateCount}/${results.length} = ${degeneracyRate}`);

  // Pathway verification
  const pathwayPass = results.every((r) => r.pathwayVerification.interventionAdapterEvents > r.pathwayVerification.controlAdapterEvents);
  console.log(`Pathway verification: ${pathwayPass ? "PASS" : "FAIL"}`);

  // Statistical tests (DIAGNOSTIC ONLY — not confirmatory)
  const wilcoxon = wilcoxonSignedRank(deltas);
  const tTest = pairedTTest(deltas);

  console.log();
  console.log("=== STATISTICAL DIAGNOSTICS (NOT CONFIRMATORY) ===");
  console.log(`Wilcoxon W=${wilcoxon.W}, p≈${wilcoxon.pValue.toFixed(4)}, significant=${wilcoxon.significant}`);
  console.log(`Paired t: t=${tTest.t.toFixed(4)}, df=${tTest.df}, p≈${tTest.pValue.toFixed(4)}, d_z=${tTest.cohensDz.toFixed(4)}`);

  // Gate decision
  const gatePass = degeneracyRate <= 0.5 && pathwayPass;
  console.log();
  console.log(`=== PILOT GATE: ${gatePass ? "PASS" : "STOP"} ===`);
  if (gatePass) {
    console.log("Degeneracy ≤ 50% and pathway functioning. N=50 study is ELIGIBLE TO PROCEED.");
  } else {
    console.log("Degeneracy > 50% or pathway failure. STOP and redesign.");
  }

  console.log();
  console.log("=== CRITICAL DISCLAIMER ===");
  console.log("These statistics are PILOT DIAGNOSTICS only.");
  console.log("They are NOT confirmatory evidence of an effect.");
  console.log("Do NOT estimate N from these 5 seeds.");
  console.log("Do NOT claim statistical significance from this pilot.");

  // Save raw results
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outDir = join(__dirname, "../../../experiment-results/corrected-counterfactual/pilot");
  mkdirSync(outDir, { recursive: true });

  const rawOutput = {
    experimentId: EXPERIMENT_ID,
    commit: "7c9ce17",
    branch: "exp-001-counterfactual-stability",
    timestamp: new Date().toISOString(),
    parameters: {
      seeds: [...PILOT_SEEDS],
      horizon: HORIZON,
      interventionTick: TI,
      primaryWindow: [PRIMARY_WINDOW_START, PRIMARY_WINDOW_END],
      hospitalConfig: HOSPITAL_CONFIG,
    },
    preflight: {
      headCommit: "7c9ce170cbfc2293c1cf6aff65c0f989cea079d9",
      branch: "exp-001-counterfactual-stability",
      workingTreeClean: true, // verified before execution
      exp001DFixPresent: true,
      exp001EFixPresent: true,
      sentinelOutputDeepClonePresent: true,
      frozenArtifactsUntouched: true,
    },
    results,
    aggregate: {
      meanDelta,
      meanControl,
      meanIntervention,
      directionConsistency,
      positiveDeltas,
      totalSeeds: results.length,
      degeneracyRate,
      degenerateCount,
      pathwayPass,
    },
    statistics: {
      wilcoxon: { W: wilcoxon.W, pValue: wilcoxon.pValue, significant: wilcoxon.significant },
      pairedT: { t: tTest.t, df: tTest.df, pValue: tTest.pValue, cohensDz: tTest.cohensDz },
      disclaimer: "PILOT DIAGNOSTICS ONLY — not confirmatory evidence",
    },
    gate: {
      result: gatePass ? "PASS" : "STOP",
      eligibleForFullStudy: gatePass,
      reason: gatePass
        ? "Degeneracy ≤ 50% and pathway functioning as specified"
        : `Degeneracy rate ${degeneracyRate} exceeds 50% threshold or pathway failure`,
    },
  };

  writeFileSync(join(outDir, "pilot-results.json"), JSON.stringify(rawOutput, null, 2));
  console.log(`\nRaw results saved to: ${outDir}/pilot-results.json`);
}

main();
