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
import { createWorld, run, snapshot, resetUniverseCounter } from "../../engine/index.js";
import type { WorldState, WorldSnapshot } from "../../engine/world-engine.js";
import { createRewindPoint, forkBranch, resetBranchCounter, resetRewindCounter } from "../../timeline/index.js";
import { buildFullDiff } from "../diff-engine.js";
import { computeSummary } from "../stats.js";
import type { ExperimentRun, ExperimentSet } from "../types.js";

const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };

interface EraState {
  year: number;
  label: string;
  nations: GeoNation[];
  wars: War[];
  alliances: Alliance[];
  globalState: GlobalState;
}

function loadEraState(eraFile: string, rpId: string): EraState {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const path = join(__dirname, `../../../docs/history/${eraFile}`);
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { states: Record<string, EraState> };
  return raw.states[rpId]!;
}

function createAllSectors(): Sector[] {
  return [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    deersRockAdapter({ ...SENTINEL }, 42),
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

export function runSingleSeed(seed: number): ExperimentRun {
  resetUniverseCounter();
  resetBranchCounter();
  resetRewindCounter();

  const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
  const sectors = createAllSectors();
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));
  const configs = buildSectorConfigs(era);
  const world = createWorld(sectors, configs, { seed });

  const rp = createRewindPoint(world, "preseeded", {
    label: "COVID-19 Baseline (2020)",
    tags: ["covid19", "contemporary", "sentinel"],
  });

  const parentAfter20 = run(world, 20);

  const intervention: Record<string, Record<string, unknown>> = {
    climate: {
      annualEmissionsNoise: 0.02,
      co2Concentration: 400,
    },
  };

  const branch = forkBranch(world, rp, intervention, sectorMap, 20, "Lower CO2 reduces extreme weather");

  const parentSnap = snapshot(parentAfter20);
  const sectorStates = buildParentChildEventArrays(parentSnap, branch.childSnapshot);
  const diff = buildFullDiff(branch.id, branch.parentUniverse, branch.rewindTick, branch.childSnapshot.tick, sectorStates);

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
    createdAt: new Date().toISOString(),
  };
}

export function runExperiment(seeds: number[] = [42, 43, 44]): ExperimentSet {
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
    createdAt: new Date().toISOString(),
    tags: ["counterfactual", "covid19", "sentinel", "p-004", "contemporary", "multi-seed"],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url).replace(/\\/g, "/").endsWith("dr-counterfactual.ts") && process.argv[1].replace(/\\/g, "/").includes("dr-counterfactual")) {
  const result = runExperiment();
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "../../../experiment-results/dr-counterfactual");
  const summaryPath = join(outDir, "summary.json");
  const runsPath = join(outDir, "runs.json");
  writeFileSync(summaryPath, JSON.stringify(result.summary, null, 2));
  writeFileSync(runsPath, JSON.stringify(result.runs, null, 2));
  console.log(`Experiment complete. ${result.numSeeds} seeds, ${result.summary.metrics.length} metrics.`);
  console.log(`Summary: ${summaryPath}`);
  console.log(`Runs: ${runsPath}`);
}
