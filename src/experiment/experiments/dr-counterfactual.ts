import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import type { Nation as GeoNation, War, Alliance, GlobalState } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector, SectorState } from "../../sectors/types.js";
import { createWorld, run, snapshot, restoreSnapshot, resetUniverseCounter } from "../../engine/index.js";
import type { WorldSnapshot, WorldState } from "../../engine/world-engine.js";
import { createRewindPoint, rewindToSnapshot, forkBranch, hashState, resetBranchCounter, resetRewindCounter } from "../../timeline/index.js";
import type { RewindPoint } from "../../timeline/rewind-point.js";
import { buildFullDiff } from "../diff-engine.js";
import { computeSummary } from "../stats.js";
import type { CounterfactualDiff, ExperimentRun, ExperimentSet, SectorDiff } from "../types.js";

// ---------------------------------------------------------------------------
// Scientific-rigor scaffolding (P-004).
// Same contract as P-003: pre-specified primary outcomes, matched-horizon
// guard, identical-baseline guard, and bookkeeping-field handling.
// ---------------------------------------------------------------------------

const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };

interface EraState {
  year: number;
  label: string;
  nations: GeoNation[];
  wars: War[];
  alliances: Alliance[];
  globalState: GlobalState;
}

/** Bookkeeping fields that track the simulation clock, not intervention effects. */
export const BOOKKEEPING_PATHS = ["year", "tickCount"] as const;

export function isBookkeepingPath(path: string): boolean {
  return BOOKKEEPING_PATHS.includes(path as (typeof BOOKKEEPING_PATHS)[number]) || path.endsWith(".year") || path.endsWith(".tickCount");
}

export interface PrimaryOutcome {
  id: string;
  label: string;
  description: string;
  /** Sector ids scanned for this outcome ("*" suffix = prefix match). */
  sectors: string[];
  /** Exact metric paths (sector-relative) that constitute this outcome. */
  paths: string[];
}

export interface PrimaryOutcomeEffect {
  outcomeId: string;
  outcomeLabel: string;
  sector: string;
  path: string;
  parentValue: number;
  branchValue: number;
  absoluteDelta: number;
  relativeDelta: number;
}

export interface PrimaryOutcomeReport {
  id: string;
  label: string;
  description: string;
  sectors: string[];
  paths: string[];
  observedPaths: string[];
  expectedPathCount: number;
  observedPathCount: number;
  perSeedMeanDelta: number[];
  overallMeanDelta: number;
  directionConsistent: boolean;
}

export interface RunGuards {
  matchedHorizon: boolean;
  parentTick: number;
  childTick: number;
  baselineIdentical: boolean;
  baselineStateHash: string;
  bookkeeping: {
    year: { parent: number; child: number };
    tickCount: { parent: number; child: number };
  };
}

export interface GuardedExperimentRun extends ExperimentRun {
  guards: RunGuards;
  primaryOutcomes: PrimaryOutcomeEffect[];
}

export interface GuardedExperimentSet extends Omit<ExperimentSet, "runs"> {
  runs: GuardedExperimentRun[];
  primaryOutcomes: PrimaryOutcomeReport[];
}

function loadEraState(eraFile: string, rpId: string): EraState {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const path = join(__dirname, `../../../docs/history/${eraFile}`);
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { states: Record<string, EraState> };
  return raw.states[rpId]!;
}

function createAllSectors(worldSeed: number): Sector[] {
  return [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    deersRockAdapter({ ...SENTINEL }, worldSeed),
  ];
}

function buildSectorConfigs(era: EraState): Record<string, Record<string, unknown>> {
  const economyNations: Record<string, Record<string, unknown>> = {};
  const techNations: Record<string, Record<string, unknown>> = {};

  for (const n of era.nations) {
    economyNations[n.id] = {
      gdp: n.gdp,
      gdpGrowthRate: 2.5,
      inflationRate: 3.0,
      tradeVolume: 50,
      unemploymentRate: 5.0,
    };
    techNations[n.id] = {
      technologyLevel: n.technologyLevel,
      rdSpending: 0.01 + (n.technologyLevel / 100) * 0.025,
    };
  }

  return {
    geopolitics: { nations: era.nations, wars: era.wars, alliances: era.alliances, globalState: era.globalState, year: era.year, casualtyMultiplier: 1 },
    climate: { co2Concentration: 420, annualEmissions: 37, year: era.year, annualEmissionsNoise: 0.2 },
    economy: { nations: economyNations, year: era.year },
    technology: { nations: techNations, year: era.year },
  };
}

// ---------------------------------------------------------------------------
// Pre-specified primary outcomes for P-004: CSSD cycles, dialysis sessions,
// and hospital occupancy at the DR sentinel. Declared in code before any seed
// runs; the paths match the DR adapter's sector-state shape.
// ---------------------------------------------------------------------------
export const PRIMARY_OUTCOMES: PrimaryOutcome[] = [
  {
    id: "cssd-cycles",
    label: "Sterile Processing (CSSD) cycles",
    description: "Total sterilizer cycles processed at the sentinel hospital over the horizon.",
    sectors: ["deers-rock-*"],
    paths: ["world.state._cssd.cycles.length", "lastTickState._cssd.cycles.length"],
  },
  {
    id: "dialysis-sessions",
    label: "Dialysis sessions",
    description: "Total dialysis encounters completed at the sentinel hospital over the horizon.",
    sectors: ["deers-rock-*"],
    paths: ["world.state._dialysis.sessions.length", "lastTickState._dialysis.sessions.length"],
  },
  {
    id: "occupancy",
    label: "Hospital occupancy",
    description: "Sentinel occupancy rate and ICU occupancy rate (surge pressure).",
    sectors: ["deers-rock-*"],
    paths: ["sentinelOutput.occupancyRate", "sentinelOutput.icuOccupancyRate"],
  },
];

export function matchesSector(sectorId: string, patterns: string[]): boolean {
  return patterns.some((p) => (p.endsWith("*") ? sectorId.startsWith(p.slice(0, -1)) : sectorId === p));
}

/**
 * Matched-horizon guard. Parent and child must have advanced to the SAME tick
 * from the SAME restored baseline. A mismatch would diff incommensurate
 * horizons and fabricate causal effects.
 */
export function assertMatchedHorizon(parentTick: number, childTick: number, context = "counterfactual"): void {
  if (parentTick !== childTick) {
    throw new Error(
      `[counterfactual guard] Matched-horizon assertion FAILED for ${context}: parent reached tick ${parentTick} but child reached tick ${childTick}. ` +
        `Differing horizons make every metric delta meaningless. Refusing to run.`,
    );
  }
}

/** Rebuild the pre-intervention world exactly as forkBranch does, and deep-compare against the pristine parent baseline. */
function restoredPreInterventionSnapshot(rp: RewindPoint, sectorMap: Map<string, Sector>): WorldState {
  return restoreSnapshot(rewindToSnapshot(rp), sectorMap);
}

/**
 * Identical-baseline guard. The child branch restores from the rewind point
 * before the intervention; that restored state must deep-equal the pristine
 * parent baseline captured at the same tick.
 */
export function assertBaselineIntegrity(baseline: WorldSnapshot, rp: RewindPoint, sectorMap: Map<string, Sector>): void {
  const restored = restoredPreInterventionSnapshot(rp, sectorMap);
  const baselineById = new Map(baseline.sectors.map((s) => [s.id, s.state]));
  const mismatches: string[] = [];
  for (const [id, record] of restored.sectors) {
    const b = baselineById.get(id);
    if (!b) {
      mismatches.push(`${id}: present in restored child but missing from parent baseline`);
      continue;
    }
    const hb = hashState(b);
    const hr = hashState(record.state);
    if (hb !== hr) {
      mismatches.push(`${id}: baseline hash ${hb} != restored pre-intervention hash ${hr}`);
    }
  }
  if (mismatches.length > 0) {
    throw new Error(
      `[counterfactual guard] Identical-baseline check FAILED: the child would restore from a baseline that differs from the parent baseline (${mismatches.join("; ")}). ` +
        `This indicates by-reference baseline corruption or rewind-point divergence. Refusing to run a contaminated counterfactual.`,
    );
  }
}

function readBookkeeping(snap: WorldSnapshot, sectorId = "geopolitics"): { year: number; tickCount: number } {
  const state = snap.sectors.find((s) => s.id === sectorId)?.state as Record<string, unknown> | undefined;
  return { year: (state?.year as number) ?? NaN, tickCount: (state?.tickCount as number) ?? NaN };
}

function buildParentChildEventArrays(
  parentSnap: WorldSnapshot,
  childSnap: WorldSnapshot,
): Map<string, { parent: SectorState; branch: SectorState; parentEvents: []; branchEvents: [] }> {
  const map = new Map<string, { parent: SectorState; branch: SectorState; parentEvents: []; branchEvents: [] }>();
  for (const ps of parentSnap.sectors) {
    const cs = childSnap.sectors.find((s) => s.id === ps.id);
    if (cs) {
      map.set(ps.id, { parent: ps.state, branch: cs.state, parentEvents: [], branchEvents: [] });
    }
  }
  return map;
}

/** Strip bookkeeping/clock fields from the causal metric set. */
function stripBookkeepingFromDiff(diff: CounterfactualDiff): CounterfactualDiff {
  const perSector: Record<string, SectorDiff> = {};
  for (const [id, sd] of Object.entries(diff.perSector)) {
    perSector[id] = { ...sd, metrics: sd.metrics.filter((m) => !isBookkeepingPath(m.path)) };
  }
  return { ...diff, perSector };
}

function collectPrimaryOutcomeEffects(diff: CounterfactualDiff, outcomes: PrimaryOutcome[]): PrimaryOutcomeEffect[] {
  const effects: PrimaryOutcomeEffect[] = [];
  for (const outcome of outcomes) {
    for (const [sectorId, sd] of Object.entries(diff.perSector)) {
      if (!matchesSector(sectorId, outcome.sectors)) continue;
      for (const path of outcome.paths) {
        const m = sd.metrics.find((metric) => metric.path === path);
        if (m) {
          effects.push({
            outcomeId: outcome.id,
            outcomeLabel: outcome.label,
            sector: sectorId,
            path,
            parentValue: m.parentValue,
            branchValue: m.branchValue,
            absoluteDelta: m.absoluteDelta,
            relativeDelta: m.relativeDelta,
          });
        }
      }
    }
  }
  return effects;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function buildPrimaryOutcomeReport(runs: GuardedExperimentRun[], outcomes: PrimaryOutcome[]): PrimaryOutcomeReport[] {
  return outcomes.map((o) => {
    const expectedPathCount = o.paths.length;
    const observedPaths = new Set<string>();
    const perSeedMeanDelta: number[] = [];
    for (const run of runs) {
      const effects = run.primaryOutcomes.filter((e) => e.outcomeId === o.id);
      for (const e of effects) observedPaths.add(e.path);
      const deltas = effects.map((e) => e.absoluteDelta);
      perSeedMeanDelta.push(deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0);
    }
    const overallMeanDelta = perSeedMeanDelta.length > 0 ? perSeedMeanDelta.reduce((a, b) => a + b, 0) / perSeedMeanDelta.length : 0;
    const nonzero = perSeedMeanDelta.filter((d) => Math.abs(d) > 1e-9);
    const directionConsistent = nonzero.length === 0 || nonzero.every((d) => Math.sign(d) === Math.sign(nonzero[0]!));
    return {
      id: o.id,
      label: o.label,
      description: o.description,
      sectors: o.sectors,
      paths: o.paths,
      observedPaths: [...observedPaths].sort(),
      expectedPathCount,
      observedPathCount: observedPaths.size,
      perSeedMeanDelta,
      overallMeanDelta: round2(overallMeanDelta),
      directionConsistent,
    };
  });
}

export function runSingleSeed(seed: number): GuardedExperimentRun {
  resetUniverseCounter();
  resetBranchCounter();
  resetRewindCounter();

  const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
  const sectors = createAllSectors(seed);
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));
  const configs = buildSectorConfigs(era);
  const world = createWorld(sectors, configs, { seed });

  const rp = createRewindPoint(world, "preseeded", {
    label: "COVID-19 Baseline (2020)",
    tags: ["covid19", "contemporary", "sentinel"],
  });

  // Independent deep-clone of the parent baseline at tick 0, taken BEFORE the
  // parent advances.
  const baselineSnap = snapshot(world);

  const parentAfter20 = run(world, 20);

  // Guard: the rewind point's stored baseline must deep-equal the pristine
  // parent baseline even after the parent branch advanced 20 ticks.
  assertBaselineIntegrity(baselineSnap, rp, sectorMap);

  const intervention: Record<string, Record<string, unknown>> = {
    climate: {
      annualEmissionsNoise: 0.02,
      co2Concentration: 400,
    },
  };

  const branch = forkBranch(world, rp, intervention, sectorMap, 20, "Lower CO2 reduces extreme weather");

  const parentSnap = snapshot(parentAfter20);

  // Guard: both branches ran the SAME number of ticks from the SAME baseline.
  assertMatchedHorizon(parentSnap.tick, branch.childSnapshot.tick, "P-004 DR Sentinel");

  const sectorStates = buildParentChildEventArrays(parentSnap, branch.childSnapshot);
  const diff = stripBookkeepingFromDiff(
    buildFullDiff(branch.id, branch.parentUniverse, branch.rewindTick, branch.childSnapshot.tick, sectorStates),
  );

  const parentBookkeeping = readBookkeeping(parentSnap);
  const childBookkeeping = readBookkeeping(branch.childSnapshot);
  const guards: RunGuards = {
    matchedHorizon: parentSnap.tick === branch.childSnapshot.tick,
    parentTick: parentSnap.tick,
    childTick: branch.childSnapshot.tick,
    baselineIdentical: true, // assertBaselineIntegrity threw earlier if this was false
    baselineStateHash: hashState(baselineSnap.sectors),
    bookkeeping: {
      year: { parent: parentBookkeeping.year, child: childBookkeeping.year },
      tickCount: { parent: parentBookkeeping.tickCount, child: childBookkeeping.tickCount },
    },
  };

  return {
    runId: `run-${seed}`,
    seed,
    rewindTick: rp.tick,
    totalTicks: 20,
    intervention: {
      type: "emissions_control",
      label: "Lower emissions reduce heatwave impact on hospitals",
      description: "Reduced CO2 concentration and emissions noise → fewer extreme weather events → less hospital surge",
      params: intervention,
    },
    diff,
    guards,
    primaryOutcomes: collectPrimaryOutcomeEffects(diff, PRIMARY_OUTCOMES),
    createdAt: new Date().toISOString(),
  };
}

export function runExperiment(seeds: number[] = [42, 43, 44]): GuardedExperimentSet {
  const runs = seeds.map((seed) => runSingleSeed(seed));
  const intervention = runs[0]!.intervention;
  const summary = computeSummary(runs, intervention);
  const setId = `SET-${new Date().getFullYear()}-DR`;

  return {
    setId,
    label: "P-004: DR Sentinel Counterfactual (COVID-19)",
    description: "Branch at RP-CONTEMP-002 (COVID-19, 2020). Intervention reduces CO2 concentration and noise → fewer extreme weather events → less hospital surge.",
    intervention,
    rewindTick: runs[0]!.rewindTick,
    rewindLabel: "COVID-19 Baseline (2020)",
    totalTicks: runs[0]!.totalTicks,
    numSeeds: seeds.length,
    runs,
    summary,
    primaryOutcomes: buildPrimaryOutcomeReport(runs, PRIMARY_OUTCOMES),
    createdAt: new Date().toISOString(),
    tags: ["counterfactual", "covid19", "sentinel", "p-004", "contemporary", "multi-seed"],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url).replace(/\\/g, "/").endsWith("dr-counterfactual.ts") && process.argv[1].replace(/\\/g, "/").includes("dr-counterfactual")) {
  // Parse seeds from command line: --seeds 42,43,44,... or use default [42,43,44]
  const seedsArg = process.argv.find((a) => a.startsWith("--seeds="));
  const seeds = seedsArg
    ? seedsArg.split("=")[1]!.split(",").map(Number)
    : [42, 43, 44];
  const result = runExperiment(seeds);
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "../../../experiment-results/dr-counterfactual");
  const summaryPath = join(outDir, "summary.json");
  const runsPath = join(outDir, "runs.json");
  writeFileSync(summaryPath, JSON.stringify(result.summary, null, 2));
  writeFileSync(runsPath, JSON.stringify(result.runs, null, 2));
  console.log(`Experiment complete. ${result.numSeeds} seeds, ${result.summary.metrics.length} metrics.`);
  console.log(`Summary: ${summaryPath}`);
  console.log(`Runs: ${runsPath}`);
}
