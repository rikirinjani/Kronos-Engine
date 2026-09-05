import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import type { Nation as GeoNation, War, Alliance, GlobalState } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { createEnergySector } from "../../sectors/energy.js";
import { createDemographicsSector } from "../../sectors/demographics.js";
import type { Sector, SectorState } from "../../sectors/types.js";
import { createWorld, run, snapshot, restoreSnapshot, resetUniverseCounter } from "../../engine/index.js";
import type { WorldSnapshot } from "../../engine/world-engine.js";
import type { WorldState } from "../../engine/world-engine.js";
import { createRewindPoint, rewindToSnapshot, forkBranch, hashState, resetBranchCounter, resetRewindCounter } from "../../timeline/index.js";
import type { RewindPoint } from "../../timeline/rewind-point.js";
import type { Intervention, Branch } from "../../timeline/branch.js";
import { buildFullDiff } from "../diff-engine.js";
import { computeSummary } from "../stats.js";
import type { CounterfactualDiff, ExperimentRun, ExperimentSet, MetricDelta, SectorDiff } from "../types.js";

// ---------------------------------------------------------------------------
// Scientific-rigor scaffolding (P-003).
//
// 1. PRIMARY_OUTCOMES: pre-specified outcome definitions, declared in code
//    (the paper claimed pre-specified nation-GDP outcomes that were never
//    actually specified anywhere). Reported distinctly per run and per set.
// 2. Matched-horizon guard: parent and child must advance the SAME number of
//    ticks from the SAME restored baseline. If tick counts differ, the run
//    fails loudly instead of silently diffing mismatched horizons.
// 3. Identical-baseline guard: the rewind point's stored baseline must
//    deep-equal the pristine parent baseline after the parent branch has
//    advanced (this is what the deep-clone fix guarantees). Fails loudly.
// 4. Bookkeeping fields (`year`, `tickCount`, ...) are stripped from the
//    causal metric set and reported separately, never as causal evidence.
// ---------------------------------------------------------------------------

export interface EraState {
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

function loadEraState(): EraState {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const path = join(__dirname, "../../../docs/history/era-modern.json");
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { states: Record<string, EraState> };
  return raw.states["RP-MODERN-001"]!;
}

function createAllSectors(): Sector[] {
  return [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    createEnergySector(),
    createDemographicsSector(),
  ];
}

function buildSectorConfigs(era: EraState): Record<string, Record<string, unknown>> {
  const economyNations: Record<string, Record<string, unknown>> = {};
  const techNations: Record<string, Record<string, unknown>> = {};
  const energyNations: Record<string, Record<string, unknown>> = {};
  const demoNations: Record<string, Record<string, unknown>> = {};

  for (const n of era.nations) {
    const tech = n.technologyLevel;
    economyNations[n.id] = {
      gdp: n.gdp,
      gdpGrowthRate: 2.5,
      inflationRate: 2.0,
      tradeVolume: 10 + (n.gdp / 1e12) * 10,
      unemploymentRate: 8.0,
    };
    techNations[n.id] = {
      technologyLevel: tech,
      rdSpending: 0.01 + (tech / 100) * 0.02,
    };
    energyNations[n.id] = {
      energyMix: { oil: 25, gas: 15, coal: 45, nuclear: 0, renewable: 5 },
      totalConsumption: 20 + (tech / 100) * 80,
      energyPrice: 80 + (1 - tech / 100) * 20,
      energySecurity: 30 + (tech / 100) * 40,
      co2Intensity: 0.6 - (tech / 100) * 0.2,
    };
    const le = n.healthMetrics.lifeExpectancy;
    demoNations[n.id] = {
      population: n.population,
      birthRate: 20 + (1 - le / 80) * 15,
      deathRate: 8 + (1 - le / 80) * 15,
      medianAge: 20 + (le / 80) * 20,
      dependencyRatio: 60 - (tech / 100) * 20,
      laborForceParticipation: 45 + (tech / 100) * 20,
      netMigration: 0,
    };
  }

  return {
    geopolitics: { nations: era.nations, wars: era.wars, alliances: era.alliances, globalState: era.globalState, year: era.year, casualtyMultiplier: 2500 },
    climate: { co2Concentration: 310, annualEmissions: 3, year: era.year, annualEmissionsNoise: 0.2 },
    economy: { nations: economyNations, year: era.year },
    technology: { nations: techNations, year: era.year },
    energy: { nations: energyNations, year: era.year },
    demographics: { nations: demoNations, year: era.year },
  };
}

// ---------------------------------------------------------------------------
// Pre-specified primary outcomes.
// The paths are resolved from the data package (RP-MODERN-001) at module load
// time so they are fixed before any seed runs — this is the code-side
// pre-registration the JAMIA paper claimed but never shipped.
// ---------------------------------------------------------------------------
export const PRIMARY_OUTCOMES: PrimaryOutcome[] = (() => {
  const era = loadEraState();
  const nationIds = era.nations.map((n) => n.id);
  return [
    {
      id: "nation-gdp",
      label: "Nation GDP (pre-specified primary)",
      description:
        "Per-nation GDP at the matched horizon (parent 1969 vs child 1969). Declared primary in the JAMIA paper; now actually specified in code.",
      sectors: ["economy", "geopolitics"],
      paths: nationIds.map((id) => `nations.${id}.gdp`),
    },
    {
      id: "war-casualties",
      label: "WWII cumulative casualties",
      description: "Cumulative casualties of W-1939-01 (the prevented war).",
      sectors: ["geopolitics"],
      paths: ["wars.W-1939-01.casualties"],
    },
    {
      id: "nation-population",
      label: "Nation population (secondary)",
      description: "Per-nation population divergence (avoided war deaths).",
      sectors: ["demographics"],
      paths: nationIds.map((id) => `nations.${id}.population`),
    },
  ];
})();

export function matchesSector(sectorId: string, patterns: string[]): boolean {
  return patterns.some((p) => (p.endsWith("*") ? sectorId.startsWith(p.slice(0, -1)) : sectorId === p));
}

/**
 * Matched-horizon guard. Parent and child must have advanced to the SAME tick
 * from the SAME restored baseline. A mismatch (e.g. the historical +3-tick
 * drift) would diff incommensurate horizons and fabricate causal effects.
 */
export function assertMatchedHorizon(parentTick: number, childTick: number, context = "counterfactual"): void {
  if (parentTick !== childTick) {
    throw new Error(
      `[counterfactual guard] Matched-horizon assertion FAILED for ${context}: parent reached tick ${parentTick} but child reached tick ${childTick}. ` +
        `Differing horizons make every metric delta meaningless (e.g. +3-tick drift fabricated year/tickCount effects). Refusing to run.`,
    );
  }
}

/** Rebuild the pre-intervention world exactly as forkBranch does, and deep-compare against the pristine parent baseline. */
function restoredPreInterventionSnapshot(rp: RewindPoint, sectorMap: Map<string, Sector>): WorldState {
  return restoreSnapshot(rewindToSnapshot(rp), sectorMap);
}

/**
 * Identical-baseline guard. Before the intervention, the child branch restores
 * from the rewind point. That restored state must deep-equal the pristine
 * parent baseline captured at the same tick. This is exactly what the
 * deep-clone fix guarantees; if the rewind point captured state by reference
 * and the parent's in-place advance corrupted it, this check throws.
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

/**
 * Strip bookkeeping/clock fields from the causal metric set. `year` and
 * `tickCount` track the simulation horizon, not the intervention — they must
 * never be reported as causal evidence (and with a matched horizon they are
 * always zero anyway).
 */
function stripBookkeepingFromDiff(diff: CounterfactualDiff): CounterfactualDiff {
  const perSector: Record<string, SectorDiff> = {};
  for (const [id, sd] of Object.entries(diff.perSector)) {
    perSector[id] = { ...sd, metrics: sd.metrics.filter((m) => !isBookkeepingPath(m.path)) };
  }
  return { ...diff, perSector };
}

function branchToDiff(branch: Branch, parentAfter30: WorldSnapshot): CounterfactualDiff {
  const sectorStates = buildParentChildEventArrays(parentAfter30, branch.childSnapshot);
  const diff = buildFullDiff(
    branch.id,
    branch.parentUniverse,
    branch.rewindTick,
    branch.childSnapshot.tick,
    sectorStates,
  );
  return stripBookkeepingFromDiff(diff);
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

function branchToRun(branch: Branch, parentAfter30: WorldSnapshot, seed: number, baselineSnap: WorldSnapshot): GuardedExperimentRun {
  const diff = branchToDiff(branch, parentAfter30);
  const parentBookkeeping = readBookkeeping(parentAfter30);
  const childBookkeeping = readBookkeeping(branch.childSnapshot);
  const guards: RunGuards = {
    matchedHorizon: parentAfter30.tick === branch.childSnapshot.tick,
    parentTick: parentAfter30.tick,
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
    rewindTick: branch.rewindTick,
    totalTicks: branch.childSnapshot.tick - branch.rewindTick,
    intervention: {
      type: "war_end",
      label: "No WWII",
      description: "Hitler dies in 1938 — prevents WWII from escalating",
      params: branch.intervention,
    },
    diff,
    guards,
    primaryOutcomes: collectPrimaryOutcomeEffects(diff, PRIMARY_OUTCOMES),
    createdAt: new Date().toISOString(),
  };
}

export function runSingleSeed(seed: number): GuardedExperimentRun {
  resetUniverseCounter();
  resetBranchCounter();
  resetRewindCounter();

  const era = loadEraState();
  const sectors = createAllSectors();
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));
  const configs = buildSectorConfigs(era);
  const world = createWorld(sectors, configs, { seed });

  const rp = createRewindPoint(world, "preseeded", {
    label: "WWII Begins (1939)",
    tags: ["wwii", "counterfactual", "rp-modern-001"],
  });

  // Independent deep-clone of the parent baseline at tick 0, taken BEFORE the
  // parent advances. This is the reference the identical-baseline guard uses.
  const baselineSnap = snapshot(world);

  const parentAfter30 = run(world, 30);

  // Guard: the rewind point's stored baseline must deep-equal the pristine
  // parent baseline even after the parent branch advanced 30 ticks.
  assertBaselineIntegrity(baselineSnap, rp, sectorMap);

  const NO_WWII_INTERVENTION: Intervention = {
    geopolitics: {
      wars: { "W-1939-01": { status: "ended" } },
    },
  };

  const branch = forkBranch(world, rp, NO_WWII_INTERVENTION, sectorMap, 30, "No WWII (Hitler dies 1938)");
  const parentSnap = snapshot(parentAfter30);

  // Guard: both branches ran the SAME number of ticks from the SAME baseline.
  assertMatchedHorizon(parentSnap.tick, branch.childSnapshot.tick, "P-003 No WWII");

  const runRecord = branchToRun(branch, parentSnap, seed, baselineSnap);
  return runRecord;
}

export function runExperiment(seeds: number[] = [42, 43, 44]): GuardedExperimentSet {
  const runs = seeds.map((seed) => runSingleSeed(seed));

  const intervention = runs[0]!.intervention;

  const summary = computeSummary(runs, intervention);

  const setId = `SET-${new Date().getFullYear()}-${String(runs[0]!.rewindTick).padStart(4, "0")}`;

  return {
    setId,
    label: "P-003: No WWII Counterfactual",
    description: "Branch at RP-MODERN-001 (1939 WWII trigger). Intervention prevents WWII. Compare parent vs child after 30 ticks (1969).",
    intervention,
    rewindTick: runs[0]!.rewindTick,
    rewindLabel: "WWII Begins (1939)",
    totalTicks: runs[0]!.totalTicks,
    numSeeds: seeds.length,
    runs,
    summary,
    primaryOutcomes: buildPrimaryOutcomeReport(runs, PRIMARY_OUTCOMES),
    createdAt: new Date().toISOString(),
    tags: ["counterfactual", "wwii", "p-003", "modern-era", "multi-seed"],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url).replace(/\\/g, "/").endsWith("wwii-no-war.ts") && process.argv[1].replace(/\\/g, "/").includes("wwii-no-war")) {
  const result = runExperiment();
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "../../../experiment-results/wwii-counterfactual");
  const summaryPath = join(outDir, "summary.json");
  const runsPath = join(outDir, "runs.json");
  writeFileSync(summaryPath, JSON.stringify(result.summary, null, 2));
  writeFileSync(runsPath, JSON.stringify(result.runs, null, 2));
  console.log(`Experiment complete. ${result.numSeeds} seeds, ${result.summary.metrics.length} metrics.`);
  console.log(`Summary: ${summaryPath}`);
  console.log(`Runs: ${runsPath}`);
}
