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
import { createWorld, run, snapshot, resetUniverseCounter } from "../../engine/index.js";
import type { WorldSnapshot } from "../../engine/world-engine.js";
import { createRewindPoint, forkBranch, resetBranchCounter, resetRewindCounter } from "../../timeline/index.js";
import type { Intervention, Branch } from "../../timeline/branch.js";
import { buildFullDiff, compareSectorStates } from "../diff-engine.js";
import { computeSummary } from "../stats.js";
import type { CounterfactualDiff, ExperimentRun, ExperimentSet } from "../types.js";

export interface EraState {
  year: number;
  label: string;
  nations: GeoNation[];
  wars: War[];
  alliances: Alliance[];
  globalState: GlobalState;
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

function branchToDiff(branch: Branch, parentAfter30: WorldSnapshot): CounterfactualDiff {
  const sectorStates = buildParentChildEventArrays(parentAfter30, branch.childSnapshot);
  return buildFullDiff(
    branch.id,
    branch.parentUniverse,
    branch.rewindTick,
    branch.childSnapshot.tick,
    sectorStates,
  );
}

function branchToRun(branch: Branch, parentAfter30: WorldSnapshot, seed: number): ExperimentRun {
  const diff = branchToDiff(branch, parentAfter30);
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
    createdAt: new Date().toISOString(),
  };
}

export function runSingleSeed(seed: number): ExperimentRun {
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

  const parentAfter30 = run(world, 30);

  const NO_WWII_INTERVENTION: Intervention = {
    geopolitics: {
      wars: { "W-1939-01": { status: "ended" } },
    },
  };

  const branch = forkBranch(world, rp, NO_WWII_INTERVENTION, sectorMap, 30, "No WWII (Hitler dies 1938)");

  return branchToRun(branch, snapshot(parentAfter30), seed);
}

export function runExperiment(seeds: number[] = [42, 43, 44]): ExperimentSet {
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

